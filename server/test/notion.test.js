import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { MemoryRepository } from "../src/db.js";
import {
  encryptToken,
  decryptToken,
  generateOAuthState,
  verifyOAuthState,
} from "../src/crypto.js";
import { generateSessionToken } from "../src/auth.js";

const TEST_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TEST_JWT_SECRET = "test_jwt_secret_for_notion_tests_12345";

const sampleTweets = Array.from({ length: 10 }, (_, i) => ({
  id: `t_${i + 1}`,
  label: "Hook",
  angle: "Hook",
  tone: "Friendly",
  text: `Tactile tools for creators number ${i + 1}`,
}));

function authHeaders(user) {
  const token = generateSessionToken(user, TEST_JWT_SECRET);
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function request(app, method, path, { headers = {}, body = null } = {}) {
  const server = app.listen(0);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}${path}`;

  try {
    const fetchHeaders = {
      ...headers,
    };
    if (body && !fetchHeaders["Content-Type"]) {
      fetchHeaders["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });

    const status = response.status;
    const responseHeaders = response.headers;
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { status, data, headers: responseHeaders };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe("Per-User Notion Integration & Security Suite", () => {
  describe("AES-256-GCM Token Encryption & CSRF State Security", () => {
    it("encrypts and decrypts Notion access tokens with authenticated integrity", () => {
      const originalToken = "secret_notion_user_token_abc123xyz789";
      const encrypted = encryptToken(originalToken, TEST_ENCRYPTION_KEY);

      assert.notEqual(encrypted, originalToken);
      assert.ok(encrypted.includes(":"));
      const parts = encrypted.split(":");
      assert.equal(parts.length, 3); // iv, authTag, ciphertext

      const decrypted = decryptToken(encrypted, TEST_ENCRYPTION_KEY);
      assert.equal(decrypted, originalToken);
    });

    it("rejects tampered ciphertext or modified auth tag", () => {
      const originalToken = "secret_notion_user_token_abc123xyz789";
      const encrypted = encryptToken(originalToken, TEST_ENCRYPTION_KEY);
      const parts = encrypted.split(":");

      // Tamper with ciphertext
      const tamperedCipher = parts[0] + ":" + parts[1] + ":" + parts[2].slice(0, -2) + "aa";
      assert.throws(() => decryptToken(tamperedCipher, TEST_ENCRYPTION_KEY));

      // Tamper with auth tag
      const tamperedTag = parts[0] + ":" + "00".repeat(16) + ":" + parts[2];
      assert.throws(() => decryptToken(tamperedTag, TEST_ENCRYPTION_KEY));
    });

    it("generates and verifies tamper-proof OAuth state bound to user ID", () => {
      const state = generateOAuthState({
        userId: "usr_alice_456",
        jwtSecret: TEST_JWT_SECRET,
        redirectUrl: "http://localhost:8080/#studio",
      });

      assert.ok(typeof state === "string" && state.length > 20);

      const payload = verifyOAuthState(state, TEST_JWT_SECRET);
      assert.equal(payload.userId, "usr_alice_456");
      assert.equal(payload.redirectUrl, "http://localhost:8080/#studio");
    });

    it("rejects tampered or wrong-secret OAuth state", () => {
      const state = generateOAuthState({
        userId: "usr_alice_456",
        jwtSecret: TEST_JWT_SECRET,
      });

      assert.throws(() => verifyOAuthState(state, "wrong_secret_123456789"));
      assert.throws(() => verifyOAuthState(state + "tampered", TEST_JWT_SECRET));
    });
  });

  describe("Multi-User Notion Isolation in Repositories", () => {
    it("maintains strict per-user isolation in MemoryRepository", async () => {
      const repo = new MemoryRepository();

      await repo.saveNotionConnection("usr_user_A", {
        workspaceId: "ws_A",
        workspaceName: "Alice's Studio",
        encryptedAccessToken: "enc_token_A",
      });

      await repo.saveNotionConnection("usr_user_B", {
        workspaceId: "ws_B",
        workspaceName: "Bob's Brand House",
        encryptedAccessToken: "enc_token_B",
      });

      const connA = await repo.getNotionConnectionByUserId("usr_user_A");
      const connB = await repo.getNotionConnectionByUserId("usr_user_B");

      assert.equal(connA.workspace_id, "ws_A");
      assert.equal(connA.workspace_name, "Alice's Studio");
      assert.equal(connA.encrypted_access_token, "enc_token_A");

      assert.equal(connB.workspace_id, "ws_B");
      assert.equal(connB.workspace_name, "Bob's Brand House");
      assert.equal(connB.encrypted_access_token, "enc_token_B");

      // Disconnecting User A must not affect User B
      await repo.deleteNotionConnection("usr_user_A");
      assert.equal(await repo.getNotionConnectionByUserId("usr_user_A"), null);
      assert.notEqual(await repo.getNotionConnectionByUserId("usr_user_B"), null);
    });
  });

  describe("Per-User Notion API Endpoints & Save Flow", () => {
    let repo;
    let app;
    let userAlice;
    let userBob;

    beforeEach(async () => {
      repo = new MemoryRepository();
      userAlice = await repo.createUser({
        googleId: "google_alice_1",
        name: "Alice Rivera",
        email: "alice@fieldwork.test",
      });
      userBob = await repo.createUser({
        googleId: "google_bob_2",
        name: "Bob Stone",
        email: "bob@fieldwork.test",
      });

      app = createApp({
        mock: true,
        repository: repo,
        jwtSecret: TEST_JWT_SECRET,
        notionEncryptionKey: TEST_ENCRYPTION_KEY,
        isNotionOAuthConfigured: true,
        requireAuth: true,
      });
    });

    it("GET /api/notion/status reports connected=false when user has not connected", async () => {
      const { status, data } = await request(app, "GET", "/api/notion/status", {
        headers: authHeaders(userAlice),
      });
      assert.equal(status, 200);
      assert.equal(data.connected, false);
      assert.equal(data.workspaceName, null);
    });

    it("GET /api/notion/oauth/authorize returns authorization URL with bound state", async () => {
      const { status, data } = await request(app, "GET", "/api/notion/oauth/authorize", {
        headers: authHeaders(userAlice),
      });
      assert.equal(status, 200);
      assert.ok(data.url);
      assert.ok(data.url.includes("state="));
    });

    it("User connects Notion, callback saves credentials, and status reports connected", async () => {
      const state = generateOAuthState({
        userId: userAlice.id,
        jwtSecret: TEST_JWT_SECRET,
      });

      const { status, headers } = await request(
        app,
        "GET",
        `/api/notion/oauth/callback?code=test_code_123&state=${encodeURIComponent(state)}`,
      );

      // Callback should redirect to frontend
      assert.equal(status, 302);
      assert.ok(headers.get("location").includes("notion_connected=true"));

      // Status should now be connected
      const { status: statusCheck, data } = await request(app, "GET", "/api/notion/status", {
        headers: authHeaders(userAlice),
      });
      assert.equal(statusCheck, 200);
      assert.equal(data.connected, true);
      assert.equal(data.workspaceName, "Mock Team Workspace");
      assert.equal(data.destination.name, "Campaigns Database");
    });

    it("POST /api/campaigns/:id/notion-save returns NOTION_NOT_CONNECTED when user has not connected", async () => {
      // Alice is authenticated, but Notion is NOT connected
      const { status, data } = await request(
        app,
        "POST",
        "/api/campaigns/camp_123/notion-save",
        {
          headers: authHeaders(userAlice),
          body: {
            brandName: "Acme",
            objective: "Brand awareness",
            campaignObjective: "Brand awareness",
            tweets: sampleTweets,
          },
        },
      );

      assert.equal(status, 400);
      assert.equal(data.saved, false);
      assert.equal(data.code, "NOTION_NOT_CONNECTED");
      assert.equal(data.error, "Connect your Notion workspace to save campaigns.");
    });

    it("Two users connect distinct Notion workspaces and campaigns are strictly isolated", async () => {
      // 1. User Alice connects Workspace A
      const encTokenA = encryptToken("notion_token_workspace_A", TEST_ENCRYPTION_KEY);
      await repo.saveNotionConnection(userAlice.id, {
        workspaceId: "ws_alice_workspace",
        workspaceName: "Alice Personal Studio",
        encryptedAccessToken: encTokenA,
        destinationPageId: "page_alice_dest_1",
        destinationPageName: "Alice Campaigns Page",
        status: "active",
      });

      // 2. User Bob connects Workspace B
      const encTokenB = encryptToken("notion_token_workspace_B", TEST_ENCRYPTION_KEY);
      await repo.saveNotionConnection(userBob.id, {
        workspaceId: "ws_bob_workspace",
        workspaceName: "Bob Agency HQ",
        encryptedAccessToken: encTokenB,
        destinationPageId: "page_bob_dest_2",
        destinationPageName: "Bob Client Work Page",
        status: "active",
      });

      // Verify Alice saves to her own workspace
      const { status: statusA, data: dataA } = await request(
        app,
        "POST",
        "/api/campaigns/camp_alice_1/notion-save",
        {
          headers: authHeaders(userAlice),
          body: {
            brandName: "Alice Brand",
            objective: "Brand awareness",
            campaignObjective: "Brand awareness",
            tweets: sampleTweets,
          },
        },
      );
      assert.equal(statusA, 200);
      assert.equal(dataA.saved, true);

      // Verify Bob saves to his own workspace
      const { status: statusB, data: dataB } = await request(
        app,
        "POST",
        "/api/campaigns/camp_bob_1/notion-save",
        {
          headers: authHeaders(userBob),
          body: {
            brandName: "Bob Brand",
            objective: "Product launch",
            campaignObjective: "Product launch",
            tweets: sampleTweets,
          },
        },
      );
      assert.equal(statusB, 200);
      assert.equal(dataB.saved, true);

      // Verify campaign ownership in repository
      const savedCampaignsAlice = await repo.getCampaignHistory(userAlice.id);
      const savedCampaignsBob = await repo.getCampaignHistory(userBob.id);

      assert.equal(savedCampaignsAlice.length, 1);
      assert.equal(savedCampaignsAlice[0].brandName, "Alice Brand");

      assert.equal(savedCampaignsBob.length, 1);
      assert.equal(savedCampaignsBob[0].brandName, "Bob Brand");

      // Verify User A cannot access or disconnect User B's Notion connection
      await request(app, "POST", "/api/notion/disconnect", {
        headers: authHeaders(userAlice),
      });

      const aliceConn = await repo.getNotionConnectionByUserId(userAlice.id);
      const bobConn = await repo.getNotionConnectionByUserId(userBob.id);

      assert.equal(aliceConn, null);
      assert.notEqual(bobConn, null);
      assert.equal(bobConn.workspace_name, "Bob Agency HQ");
    });

    it("handles revoked Notion token by marking status revoked and returning 401", async () => {
      // Connect with token
      const encToken = encryptToken("revoked_token_123", TEST_ENCRYPTION_KEY);
      await repo.saveNotionConnection(userAlice.id, {
        workspaceId: "ws_revoked",
        workspaceName: "Revoked Workspace",
        encryptedAccessToken: encToken,
        status: "active",
      });

      // App configured with fetchImpl that returns 401
      const appWithRevokedFetch = createApp({
        mock: false,
        repository: repo,
        jwtSecret: TEST_JWT_SECRET,
        notionEncryptionKey: TEST_ENCRYPTION_KEY,
        isNotionOAuthConfigured: true,
        requireAuth: true,
        fetchImpl: async () => ({
          status: 401,
          ok: false,
          text: async () => JSON.stringify({ message: "API token is invalid." }),
        }),
      });

      const { status, data } = await request(
        appWithRevokedFetch,
        "POST",
        "/api/campaigns/camp_revoked/notion-save",
        {
          headers: authHeaders(userAlice),
          body: {
            brandName: "Acme",
            objective: "Brand awareness",
            campaignObjective: "Brand awareness",
            tweets: sampleTweets,
          },
        },
      );

      assert.equal(status, 401);
      assert.equal(data.saved, false);
      assert.equal(data.code, "NOTION_AUTH_EXPIRED");

      const updatedConn = await repo.getNotionConnectionByUserId(userAlice.id);
      assert.equal(updatedConn.status, "revoked");
    });
  });

  describe("Guest Demo Mode & Protected Access Controls", () => {
    it("allows unauthenticated visitor (guest) to generate campaign without signing in", async () => {
      const repo = new MemoryRepository();
      const app = createApp({
        repository: repo,
        jwtSecret: TEST_JWT_SECRET,
        notionEncryptionKey: TEST_ENCRYPTION_KEY,
        mock: true,
      });

      const { status, data } = await request(app, "POST", "/api/campaigns/generate", {
        headers: { "x-test-guest": "true" },
        body: {
          brandName: "Guest Atelier",
          objective: "Brand awareness",
        },
      });

      assert.equal(status, 200);
      assert.ok(data.campaignId);
      assert.equal(data.tweets.length, 10);
      assert.ok(data.profile);

      // Verify guest generation does NOT touch database or user history
      assert.equal(repo.campaigns.size, 0);
    });

    it("strictly blocks guests from accessing campaign history", async () => {
      const repo = new MemoryRepository();
      const app = createApp({
        repository: repo,
        jwtSecret: TEST_JWT_SECRET,
        notionEncryptionKey: TEST_ENCRYPTION_KEY,
        requireAuth: true,
        mock: true,
      });

      const { status } = await request(app, "GET", "/api/campaigns/history");
      assert.equal(status, 401);
    });

    it("strictly blocks guests from saving to Notion without Google authentication", async () => {
      const repo = new MemoryRepository();
      const app = createApp({
        repository: repo,
        jwtSecret: TEST_JWT_SECRET,
        notionEncryptionKey: TEST_ENCRYPTION_KEY,
        requireAuth: true,
        mock: true,
      });

      const { status, data } = await request(app, "POST", "/api/campaigns/camp_guest_1/notion-save", {
        body: {
          brandName: "Guest Brand",
          objective: "Brand awareness",
          tweets: sampleTweets,
        },
      });
      assert.equal(status, 401);
      assert.equal(data.code, "UNAUTHORIZED");
    });

    it("strictly blocks guests from initiating Notion OAuth", async () => {
      const repo = new MemoryRepository();
      const app = createApp({
        repository: repo,
        jwtSecret: TEST_JWT_SECRET,
        notionEncryptionKey: TEST_ENCRYPTION_KEY,
        requireAuth: true,
        mock: true,
      });

      const { status } = await request(app, "GET", "/api/notion/oauth/authorize");
      assert.equal(status, 401);
    });
  });
});
