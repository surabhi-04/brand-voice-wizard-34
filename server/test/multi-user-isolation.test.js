import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { MemoryRepository } from "../src/db.js";
import { encryptToken } from "../src/crypto.js";
import { generateSessionToken } from "../src/auth.js";

const TEST_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TEST_JWT_SECRET = "test_jwt_secret_for_isolation_tests_99999";

const sampleTweets = Array.from({ length: 10 }, (_, i) => ({
  id: `tweet_iso_${i + 1}`,
  label: "Hook",
  angle: "Direct",
  tone: "Bold",
  text: `Campaign tweet angle for test brand index ${i + 1}`,
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
    const fetchHeaders = { ...headers };
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
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { status, data, headers: response.headers };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe("Phase 4: Two-User Separation & Guest Mode Verification Suite", () => {
  let repo;
  let app;
  let userAlice;
  let userBob;

  beforeEach(async () => {
    repo = new MemoryRepository();

    // 1. Sign in with distinct accounts
    userAlice = await repo.createUser({
      googleId: "google_alice_101",
      name: "Alice Rivera",
      email: "alice@lumina-studio.test",
    });

    userBob = await repo.createUser({
      googleId: "google_bob_202",
      name: "Bob Stone",
      email: "bob@zenith-creative.test",
    });

    app = createApp({
      mock: true,
      repository: repo,
      jwtSecret: TEST_JWT_SECRET,
      notionEncryptionKey: TEST_ENCRYPTION_KEY,
      isNotionOAuthConfigured: true,
      skipAuthForTests: false,
    });
  });

  it("Step 1: Sign in with distinct accounts verified", async () => {
    assert.notEqual(userAlice.id, userBob.id);
    assert.equal(userAlice.email, "alice@lumina-studio.test");
    assert.equal(userBob.email, "bob@zenith-creative.test");

    // Both users can access protected session check
    const resA = await request(app, "GET", "/api/auth/me", { headers: authHeaders(userAlice) });
    const resB = await request(app, "GET", "/api/auth/me", { headers: authHeaders(userBob) });

    assert.equal(resA.status, 200);
    assert.equal(resA.data.user.id, userAlice.id);
    assert.equal(resA.data.user.name, "Alice Rivera");

    assert.equal(resB.status, 200);
    assert.equal(resB.data.user.id, userBob.id);
    assert.equal(resB.data.user.name, "Bob Stone");
  });

  it("Step 2: Connect distinct Notion workspaces for each user", async () => {
    // Alice connects Workspace A
    const encTokenA = encryptToken("notion_token_alice_secret_A", TEST_ENCRYPTION_KEY);
    await repo.saveNotionConnection(userAlice.id, {
      workspaceId: "ws_alice_lumina_999",
      workspaceName: "Alice Lumina Studio",
      encryptedAccessToken: encTokenA,
      destinationPageId: "page_alice_dest_1",
      destinationPageName: "Lumina Brand Campaigns",
      status: "active",
    });

    // Bob connects Workspace B
    const encTokenB = encryptToken("notion_token_bob_secret_B", TEST_ENCRYPTION_KEY);
    await repo.saveNotionConnection(userBob.id, {
      workspaceId: "ws_bob_zenith_888",
      workspaceName: "Bob Zenith Agency",
      encryptedAccessToken: encTokenB,
      destinationPageId: "page_bob_dest_2",
      destinationPageName: "Zenith Social Database",
      status: "active",
    });

    // Alice queries connection status -> sees only Workspace A
    const statusA = await request(app, "GET", "/api/notion/status", {
      headers: authHeaders(userAlice),
    });
    assert.equal(statusA.status, 200);
    assert.equal(statusA.data.connected, true);
    assert.equal(statusA.data.workspaceId, "ws_alice_lumina_999");
    assert.equal(statusA.data.workspaceName, "Alice Lumina Studio");
    assert.equal(statusA.data.destination.name, "Lumina Brand Campaigns");

    // Bob queries connection status -> sees only Workspace B
    const statusB = await request(app, "GET", "/api/notion/status", {
      headers: authHeaders(userBob),
    });
    assert.equal(statusB.status, 200);
    assert.equal(statusB.data.connected, true);
    assert.equal(statusB.data.workspaceId, "ws_bob_zenith_888");
    assert.equal(statusB.data.workspaceName, "Bob Zenith Agency");
    assert.equal(statusB.data.destination.name, "Zenith Social Database");
  });

  it("Step 3: Save campaigns into respective Notion workspaces without cross-contamination", async () => {
    // Setup connections
    await repo.saveNotionConnection(userAlice.id, {
      workspaceId: "ws_alice_lumina_999",
      workspaceName: "Alice Lumina Studio",
      encryptedAccessToken: encryptToken("tok_alice", TEST_ENCRYPTION_KEY),
      destinationPageId: "page_alice_dest_1",
      destinationPageName: "Lumina Brand Campaigns",
      status: "active",
    });

    await repo.saveNotionConnection(userBob.id, {
      workspaceId: "ws_bob_zenith_888",
      workspaceName: "Bob Zenith Agency",
      encryptedAccessToken: encryptToken("tok_bob", TEST_ENCRYPTION_KEY),
      destinationPageId: "page_bob_dest_2",
      destinationPageName: "Zenith Social Database",
      status: "active",
    });

    // Alice saves campaign
    const saveA = await request(app, "POST", "/api/campaigns/camp_alice_lumina_01/notion-save", {
      headers: authHeaders(userAlice),
      body: {
        brandName: "Lumina Organic Coffee",
        objective: "Brand awareness",
        campaignObjective: "Brand awareness",
        tweets: sampleTweets,
      },
    });
    assert.equal(saveA.status, 200);
    assert.equal(saveA.data.saved, true);
    assert.ok(saveA.data.url);

    // Bob saves campaign
    const saveB = await request(app, "POST", "/api/campaigns/camp_bob_zenith_02/notion-save", {
      headers: authHeaders(userBob),
      body: {
        brandName: "Zenith Electric Bikes",
        objective: "Product launch",
        campaignObjective: "Product launch",
        tweets: sampleTweets,
      },
    });
    assert.equal(saveB.status, 200);
    assert.equal(saveB.data.saved, true);
    assert.ok(saveB.data.url);

    // Verify campaigns in repository are strictly bound to their respective owners
    const campA = await repo.getCampaignById("camp_alice_lumina_01", userAlice.id);
    const campB = await repo.getCampaignById("camp_bob_zenith_02", userBob.id);

    assert.equal(campA.brandName, "Lumina Organic Coffee");
    assert.equal(campB.brandName, "Zenith Electric Bikes");

    // Alice cannot see Bob's campaign
    const aliceCheckingBob = await repo.getCampaignById("camp_bob_zenith_02", userAlice.id);
    assert.equal(aliceCheckingBob, null);

    // Bob cannot see Alice's campaign
    const bobCheckingAlice = await repo.getCampaignById("camp_alice_lumina_01", userBob.id);
    assert.equal(bobCheckingAlice, null);
  });

  it("Step 4: Campaign history and connection status are strictly isolated", async () => {
    // Setup connections & campaigns
    await repo.saveNotionConnection(userAlice.id, {
      workspaceId: "ws_alice_lumina_999",
      workspaceName: "Alice Lumina Studio",
      encryptedAccessToken: encryptToken("tok_alice", TEST_ENCRYPTION_KEY),
      status: "active",
    });
    await repo.saveCampaign({
      id: "camp_alice_hist_1",
      userId: userAlice.id,
      brandName: "Alice Brand 1",
      objective: "Brand awareness",
      tweets: sampleTweets,
      notionUrl: "https://notion.so/alice-1",
    });

    await repo.saveNotionConnection(userBob.id, {
      workspaceId: "ws_bob_zenith_888",
      workspaceName: "Bob Zenith Agency",
      encryptedAccessToken: encryptToken("tok_bob", TEST_ENCRYPTION_KEY),
      status: "active",
    });
    await repo.saveCampaign({
      id: "camp_bob_hist_2",
      userId: userBob.id,
      brandName: "Bob Brand 2",
      objective: "Engagement",
      tweets: sampleTweets,
      notionUrl: "https://notion.so/bob-2",
    });

    // Alice requests history
    const histA = await request(app, "GET", "/api/campaigns/history", {
      headers: authHeaders(userAlice),
    });
    assert.equal(histA.status, 200);
    assert.equal(histA.data.length, 1);
    assert.equal(histA.data[0].id, "camp_alice_hist_1");
    assert.equal(histA.data[0].brandName, "Alice Brand 1");

    // Bob requests history
    const histB = await request(app, "GET", "/api/campaigns/history", {
      headers: authHeaders(userBob),
    });
    assert.equal(histB.status, 200);
    assert.equal(histB.data.length, 1);
    assert.equal(histB.data[0].id, "camp_bob_hist_2");
    assert.equal(histB.data[0].brandName, "Bob Brand 2");

    // Alice disconnects her Notion workspace
    const discA = await request(app, "POST", "/api/notion/disconnect", {
      headers: authHeaders(userAlice),
    });
    assert.equal(discA.status, 200);
    assert.equal(discA.data.success, true);

    // Alice is now disconnected
    const checkA = await request(app, "GET", "/api/notion/status", {
      headers: authHeaders(userAlice),
    });
    assert.equal(checkA.data.connected, false);

    // Bob remains connected unaffected
    const checkB = await request(app, "GET", "/api/notion/status", {
      headers: authHeaders(userBob),
    });
    assert.equal(checkB.data.connected, true);
    assert.equal(checkB.data.workspaceName, "Bob Zenith Agency");
  });

  it("Step 5: Unauthenticated guest demo mode functions freely but cannot touch private data", async () => {
    // 1. Guest can generate campaigns
    const guestGen = await request(app, "POST", "/api/campaigns/generate", {
      headers: { "x-test-guest": "true" },
      body: {
        brandName: "Guest Atelier",
        objective: "Education",
      },
    });
    assert.equal(guestGen.status, 200);
    assert.ok(guestGen.data.campaignId);
    assert.equal(guestGen.data.tweets.length, 10);

    // 2. Guest generation does not write to database
    assert.equal(repo.campaigns.size, 0);

    // 3. Guest cannot view campaign history
    const guestHist = await request(app, "GET", "/api/campaigns/history");
    assert.equal(guestHist.status, 401);
    assert.equal(guestHist.data.code, "UNAUTHORIZED");

    // 4. Guest cannot view Notion status
    const guestStatus = await request(app, "GET", "/api/notion/status");
    assert.equal(guestStatus.status, 401);

    // 5. Guest cannot save to Notion
    const guestSave = await request(app, "POST", "/api/campaigns/guest_camp/notion-save", {
      body: {
        brandName: "Guest Brand",
        objective: "Brand awareness",
        tweets: sampleTweets,
      },
    });
    assert.equal(guestSave.status, 401);

    // 6. Guest cannot initiate Notion OAuth
    const guestOAuth = await request(app, "GET", "/api/notion/oauth/authorize");
    assert.equal(guestOAuth.status, 401);
  });

  it("Duplicate save protection: re-saving an already saved campaign returns cached Notion page without duplicating", async () => {
    // Alice connects Workspace
    await repo.saveNotionConnection(userAlice.id, {
      workspaceId: "ws_alice_lumina_999",
      workspaceName: "Alice Lumina Studio",
      encryptedAccessToken: encryptToken("tok_alice", TEST_ENCRYPTION_KEY),
      status: "active",
    });

    // First save
    const firstSave = await request(app, "POST", "/api/campaigns/camp_alice_dup_test/notion-save", {
      headers: authHeaders(userAlice),
      body: {
        brandName: "Lumina Duo",
        objective: "Brand awareness",
        tweets: sampleTweets,
      },
    });
    assert.equal(firstSave.status, 200);
    assert.equal(firstSave.data.saved, true);
    const initialUrl = firstSave.data.url;

    // Second save (duplicate call)
    const secondSave = await request(app, "POST", "/api/campaigns/camp_alice_dup_test/notion-save", {
      headers: authHeaders(userAlice),
      body: {
        brandName: "Lumina Duo",
        objective: "Brand awareness",
        tweets: sampleTweets,
      },
    });
    assert.equal(secondSave.status, 200);
    assert.equal(secondSave.data.saved, true);
    assert.equal(secondSave.data.alreadySaved, true);
    assert.equal(secondSave.data.url, initialUrl);
  });

  it("Guest campaign transfer: transfers eligible guest campaign on login securely without duplicate", async () => {
    // 1. Unauthenticated guest cannot transfer campaign
    const unauthedTransfer = await request(app, "POST", "/api/campaigns/transfer-guest", {
      body: {
        campaignId: "guest_transfer_123",
        brandName: "Guest Brand Alpha",
        tweets: sampleTweets,
      },
    });
    assert.equal(unauthedTransfer.status, 401);

    // 2. Alice transfers guest campaign into her account
    const aliceTransfer = await request(app, "POST", "/api/campaigns/transfer-guest", {
      headers: authHeaders(userAlice),
      body: {
        campaignId: "guest_transfer_123",
        brandName: "Guest Brand Alpha",
        objective: "Product launch",
        tweets: sampleTweets,
      },
    });
    assert.equal(aliceTransfer.status, 200);
    assert.equal(aliceTransfer.data.transferred, true);
    assert.equal(aliceTransfer.data.campaignId, "guest_transfer_123");

    // 3. Alice re-transfers same campaign -> returns alreadyOwned without duplicate
    const reTransfer = await request(app, "POST", "/api/campaigns/transfer-guest", {
      headers: authHeaders(userAlice),
      body: {
        campaignId: "guest_transfer_123",
        brandName: "Guest Brand Alpha",
        tweets: sampleTweets,
      },
    });
    assert.equal(reTransfer.status, 200);
    assert.equal(reTransfer.data.transferred, true);
    assert.equal(reTransfer.data.alreadyOwned, true);

    // 4. Bob tries to claim Alice's campaign -> blocked with 403
    const bobSteal = await request(app, "POST", "/api/campaigns/transfer-guest", {
      headers: authHeaders(userBob),
      body: {
        campaignId: "guest_transfer_123",
        brandName: "Stolen Brand",
        tweets: sampleTweets,
      },
    });
    assert.equal(bobSteal.status, 403);
    assert.equal(bobSteal.data.error.includes("associated with another account"), true);
  });
});
