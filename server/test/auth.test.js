import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import {
  generateSessionToken,
  verifySessionToken,
  verifyGoogleIdToken,
  SESSION_COOKIE_NAME,
  JWT_ISSUER,
  JWT_AUDIENCE,
  AuthError,
} from "../src/auth.js";
import { MemoryRepository } from "../src/db.js";

const TEST_JWT_SECRET = "super_secret_test_key_minimum_32_characters_long_12345";
const TEST_GOOGLE_CLIENT_ID = "1234567890-testclientid.apps.googleusercontent.com";

// Helper for making requests with cookie handling
async function request(app, method, path, body = null, headers = {}, cookie = null) {
  const server = app.listen(0);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}${path}`;

  const reqHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };
  if (cookie) {
    reqHeaders.Cookie = cookie;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : null,
    });
    const status = res.status;
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const setCookie = res.headers.get("set-cookie");
    return { status, data, headers: res.headers, setCookie };
  } finally {
    server.close();
  }
}

describe("Google Authentication & JWT Security Suite", () => {
  it("rejects missing or empty Google ID token", async () => {
    await assert.rejects(
      async () => {
        await verifyGoogleIdToken("", TEST_GOOGLE_CLIENT_ID);
      },
      (err) => {
        assert.ok(err instanceof AuthError);
        assert.equal(err.status, 400);
        return true;
      },
    );
  });

  it("rejects Google verification if GOOGLE_CLIENT_ID is not configured", async () => {
    await assert.rejects(
      async () => {
        await verifyGoogleIdToken("dummy.token.here", "");
      },
      (err) => {
        assert.ok(err instanceof AuthError);
        assert.equal(err.status, 503);
        assert.equal(err.code, "CONFIG_ERROR");
        return true;
      },
    );
  });

  it("issues JWT with required claims (sub, iss, aud, exp)", () => {
    const user = {
      id: "usr_test_1",
      google_id: "google_sub_12345",
      name: "Eleanor Vance",
      email: "eleanor@example.com",
      profile_picture: "https://example.com/eleanor.jpg",
    };

    const token = generateSessionToken(user, TEST_JWT_SECRET);
    assert.ok(typeof token === "string" && token.length > 50);

    const verified = verifySessionToken(token, TEST_JWT_SECRET);
    assert.equal(verified.sub, "usr_test_1");
    assert.equal(verified.iss, JWT_ISSUER);
    assert.equal(verified.aud, JWT_AUDIENCE);
    assert.equal(verified.email, "eleanor@example.com");
    assert.equal(verified.name, "Eleanor Vance");
    assert.ok(verified.exp);
  });

  it("rejects JWT with wrong secret or tampered signature", () => {
    const user = {
      id: "usr_test_2",
      google_id: "google_sub_67890",
      name: "Arthur Dent",
      email: "arthur@example.com",
    };
    const token = generateSessionToken(user, TEST_JWT_SECRET);

    assert.throws(
      () => {
        verifySessionToken(token, "different_secret_key_that_is_long_enough_123");
      },
      (err) => {
        assert.ok(err instanceof AuthError);
        assert.equal(err.status, 401);
        return true;
      },
    );
  });

  it("POST /api/auth/google verifies credentials, creates user in DB, and sets HttpOnly cookie", async () => {
    const repo = new MemoryRepository();
    const app = createApp({
      repository: repo,
      jwtSecret: TEST_JWT_SECRET,
      googleClientId: TEST_GOOGLE_CLIENT_ID,
      mockGoogleAuth: true,
      requireAuth: true,
    });

    const res = await request(app, "POST", "/api/auth/google", {
      idToken: "mock_verified_google_token",
      mockGoogleId: "google_sub_verified_999",
      mockName: "Sarah Connor",
      mockEmail: "sarah@resistance.org",
      mockPicture: "https://example.com/sarah.png",
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.user);
    assert.equal(res.data.user.email, "sarah@resistance.org");
    assert.equal(res.data.user.name, "Sarah Connor");
    assert.ok(res.data.user.id.startsWith("usr_"));

    // Check Set-Cookie header contains bv_session and HttpOnly
    assert.ok(res.setCookie, "Response must include Set-Cookie header");
    assert.ok(res.setCookie.includes(SESSION_COOKIE_NAME));
    assert.ok(res.setCookie.includes("HttpOnly"));

    // User must be persisted in repository
    const dbUser = await repo.findUserByGoogleId("google_sub_verified_999");
    assert.ok(dbUser);
    assert.equal(dbUser.email, "sarah@resistance.org");
  });

  it("GET /api/auth/me returns authenticated user with valid session cookie", async () => {
    const repo = new MemoryRepository();
    const dbUser = await repo.createUser({
      googleId: "google_sub_me_123",
      name: "Marcus Aurelius",
      email: "marcus@rome.gov",
    });

    const token = generateSessionToken(dbUser, TEST_JWT_SECRET);
    const cookie = `${SESSION_COOKIE_NAME}=${token}`;

    const app = createApp({
      repository: repo,
      jwtSecret: TEST_JWT_SECRET,
      requireAuth: true,
    });

    const res = await request(app, "GET", "/api/auth/me", null, {}, cookie);
    assert.equal(res.status, 200);
    assert.equal(res.data.user.id, dbUser.id);
    assert.equal(res.data.user.email, "marcus@rome.gov");
    assert.equal(res.data.user.name, "Marcus Aurelius");
  });

  it("GET /api/auth/me returns 401 when session cookie is missing", async () => {
    const repo = new MemoryRepository();
    const app = createApp({
      repository: repo,
      jwtSecret: TEST_JWT_SECRET,
      requireAuth: true,
    });

    const res = await request(app, "GET", "/api/auth/me");
    assert.equal(res.status, 401);
    assert.equal(res.data.code, "UNAUTHORIZED");
  });

  it("POST /api/auth/logout clears session cookie", async () => {
    const app = createApp({
      jwtSecret: TEST_JWT_SECRET,
      requireAuth: true,
    });

    const res = await request(app, "POST", "/api/auth/logout");
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.setCookie);
    assert.ok(res.setCookie.includes(`${SESSION_COOKIE_NAME}=;`));
  });

  it("GET /api/auth/config returns public configuration flags", async () => {
    const app = createApp({
      googleClientId: TEST_GOOGLE_CLIENT_ID,
    });

    const res = await request(app, "GET", "/api/auth/config");
    assert.equal(res.status, 200);
    assert.ok("isGoogleConfigured" in res.data);
    assert.ok("isJwtConfigured" in res.data);
    assert.ok("isDbConfigured" in res.data);
  });
});

describe("Multi-User Scoping and Campaign Data Isolation Suite", () => {
  it("enforces strict user isolation: User 2 cannot access or view User 1's campaigns", async () => {
    const repo = new MemoryRepository();
    const user1 = await repo.createUser({
      googleId: "google_user_1",
      name: "User One",
      email: "user1@example.com",
    });
    const user2 = await repo.createUser({
      googleId: "google_user_2",
      name: "User Two",
      email: "user2@example.com",
    });

    const tokenUser1 = generateSessionToken(user1, TEST_JWT_SECRET);
    const tokenUser2 = generateSessionToken(user2, TEST_JWT_SECRET);

    const app = createApp({
      repository: repo,
      jwtSecret: TEST_JWT_SECRET,
      requireAuth: true,
      mock: true,
    });

    // User 1 creates a campaign
    const campaignId = "camp_user1_private_001";
    await repo.saveCampaign({
      id: campaignId,
      userId: user1.id,
      brandName: "Acme Atelier",
      objective: "Brand awareness",
      tweets: [{ id: "t1", text: "User 1 tweet", label: "Announcement" }],
      notionUrl: "https://notion.so/user1-page",
    });

    // User 1 requests campaign history -> sees their campaign
    const history1 = await request(
      app,
      "GET",
      "/api/campaigns/history",
      null,
      {},
      `${SESSION_COOKIE_NAME}=${tokenUser1}`,
    );
    assert.equal(history1.status, 200);
    assert.equal(history1.data.length, 1);
    assert.equal(history1.data[0].id, campaignId);
    assert.equal(history1.data[0].brandName, "Acme Atelier");

    // User 2 requests campaign history -> receives empty array (zero data leakage)
    const history2 = await request(
      app,
      "GET",
      "/api/campaigns/history",
      null,
      {},
      `${SESSION_COOKIE_NAME}=${tokenUser2}`,
    );
    assert.equal(history2.status, 200);
    assert.equal(history2.data.length, 0);

    // User 2 attempts to regenerate a tweet in User 1's campaign -> receives 403 Forbidden
    const regenerateAttempt = await request(
      app,
      "POST",
      `/api/campaigns/${campaignId}/tweets/1/regenerate`,
      {
        brandName: "Acme Atelier",
        objective: "Brand awareness",
      },
      {},
      `${SESSION_COOKIE_NAME}=${tokenUser2}`,
    );
    assert.equal(regenerateAttempt.status, 403);
    assert.ok(regenerateAttempt.data.error.includes("permission"));
  });

  it("rejects unauthenticated requests to campaign generation when requireAuth is active", async () => {
    const app = createApp({
      jwtSecret: TEST_JWT_SECRET,
      requireAuth: true,
    });

    const res = await request(app, "POST", "/api/campaigns/generate", {
      brandName: "Fieldwork",
      objective: "Brand awareness",
    });
    assert.equal(res.status, 401);
  });

  it("POST /api/auth/google accepts accessToken and creates user session", async () => {
    const repository = new MemoryRepository();
    const app = createApp({
      jwtSecret: TEST_JWT_SECRET,
      repository,
      mockGoogleAuth: true,
    });

    const res = await request(app, "POST", "/api/auth/google", {
      accessToken: "mock_google_access_token_xyz",
      mockGoogleId: "google_access_user_789",
      mockName: "OAuth User",
      mockEmail: "oauth@example.com",
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.user.email, "oauth@example.com");
    assert.equal(res.data.user.name, "OAuth User");
    assert.ok(res.setCookie);
    assert.ok(res.setCookie.includes(SESSION_COOKIE_NAME));

    // Verify user exists in repository
    const userInDb = await repository.findUserByGoogleId("google_access_user_789");
    assert.ok(userInDb);
    assert.equal(userInDb.email, "oauth@example.com");
  });
});
