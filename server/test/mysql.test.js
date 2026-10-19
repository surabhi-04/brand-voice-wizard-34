import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import {
  createDatabasePool,
  ensureDatabaseExists,
  runDatabaseMigrations,
  initializeDatabase,
  MySQLRepository,
} from "../src/db.js";
import { createApp } from "../src/app.js";

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

describe("MySQL Database & Repository Integration Suite", () => {
  let pool;
  let repo;

  before(async () => {
    // Initialize real MySQL database schema and pool
    const init = await initializeDatabase(config.mysql);
    pool = init.pool;
    repo = init.repository;
  });

  after(async () => {
    // Clean up test records and close connection pool
    if (pool) {
      try {
        await pool.execute("DELETE FROM campaigns WHERE id LIKE 'test_mysql_%'");
        await pool.execute("DELETE FROM users WHERE id LIKE 'usr_test_mysql_%'");
      } catch {
        // ignore cleanup errors
      } finally {
        await pool.end();
      }
    }
  });

  it("successfully connects to MySQL brandvoice_db schema and verifies migrations", async () => {
    const [result] = await pool.query("SELECT DATABASE() AS currentDb");
    assert.equal(result[0].currentDb, "brandvoice_db");

    const [tables] = await pool.query("SHOW TABLES");
    const tableNames = tables.map((t) => Object.values(t)[0]);
    assert.ok(tableNames.includes("users"), "users table must exist in brandvoice_db");
    assert.ok(tableNames.includes("campaigns"), "campaigns table must exist in brandvoice_db");
    assert.ok(
      tableNames.includes("user_notion_connections"),
      "user_notion_connections table must exist in brandvoice_db",
    );
  });

  it("persists and manages per-user Notion connections in MySQL with strict isolation", async () => {
    const testUserId = `usr_test_mysql_${Date.now()}`;
    await pool.execute("INSERT INTO users (id, google_id, name, email) VALUES (?, ?, ?, ?)", [
      testUserId,
      `google_${testUserId}`,
      "Notion Connected User",
      `${testUserId}@notiontest.com`,
    ]);

    const conn = await repo.saveNotionConnection(testUserId, {
      workspaceId: "ws_mysql_test_123",
      workspaceName: "Fieldwork MySQL Workspace",
      workspaceIcon: "https://example.com/icon.png",
      botId: "bot_123",
      encryptedAccessToken: "enc_token_mysql_123",
      destinationPageId: "dest_p1",
      destinationPageName: "2026 Strategy",
      status: "active",
    });

    assert.ok(conn);
    assert.equal(conn.workspaceId, "ws_mysql_test_123");
    assert.equal(conn.workspaceName, "Fieldwork MySQL Workspace");
    assert.equal(conn.encryptedAccessToken, "enc_token_mysql_123");
    assert.equal(conn.destinationPageId, "dest_p1");

    // Fetch by userId
    const fetched = await repo.getNotionConnectionByUserId(testUserId);
    assert.ok(fetched);
    assert.equal(fetched.workspaceId, "ws_mysql_test_123");

    // Update destination
    const updated = await repo.updateNotionDestination(testUserId, {
      destinationPageId: "dest_p2",
      destinationPageName: "Brand Campaigns",
    });
    assert.equal(updated.destinationPageId, "dest_p2");
    assert.equal(updated.destinationPageName, "Brand Campaigns");

    // Delete connection
    const deleted = await repo.deleteNotionConnection(testUserId);
    assert.equal(deleted, true);

    const afterDelete = await repo.getNotionConnectionByUserId(testUserId);
    assert.equal(afterDelete, null);

    // Clean up
    await pool.execute("DELETE FROM users WHERE id = ?", [testUserId]);
  });

  it("performs complete user lifecycle with MySQL repository", async () => {
    const testGoogleId = `test_google_${Date.now()}`;
    const user = await repo.createUser({
      googleId: testGoogleId,
      name: "Ada Lovelace",
      email: `ada_${Date.now()}@example.com`,
      profilePicture: "https://example.com/ada.jpg",
    });

    assert.ok(user.id.startsWith("usr_"));
    assert.equal(user.name, "Ada Lovelace");

    const foundById = await repo.findUserById(user.id);
    assert.equal(foundById.id, user.id);
    assert.equal(foundById.email, user.email);

    const foundByGoogleId = await repo.findUserByGoogleId(testGoogleId);
    assert.equal(foundByGoogleId.id, user.id);

    const updated = await repo.updateUser(user.id, { name: "Countess Ada Lovelace" });
    assert.equal(updated.name, "Countess Ada Lovelace");

    // Clean up
    await pool.execute("DELETE FROM users WHERE id = ?", [user.id]);
  });

  it("persists campaigns with foreign key integrity and supports JSON fields", async () => {
    const testUserId = `usr_test_mysql_${Date.now()}`;
    const testCampaignId = `test_mysql_camp_${Date.now()}`;

    // Create user first
    await repo.createUser({
      googleId: `google_${Date.now()}`,
      name: "Campaign Tester",
      email: `tester_${Date.now()}@test.com`,
    });
    // Set explicit id for test reference
    await pool.execute("INSERT INTO users (id, google_id, name, email) VALUES (?, ?, ?, ?)", [
      testUserId,
      `google_${testUserId}`,
      "Test Author",
      `${testUserId}@test.com`,
    ]);

    const sampleProfile = {
      summary: "Distinctive and technical voice",
      audience: "Developers and founders",
      themes: ["AI", "Reliability"],
      characteristics: ["Precise", "Direct"],
      inferredFields: [],
    };

    const sampleTweets = [
      { id: "tweet-1", text: "First tweet for MySQL verification", angle: "Hook", label: "Hook" },
      { id: "tweet-2", text: "Second tweet with metrics", angle: "Proof", label: "Proof" },
    ];

    const saved = await repo.saveCampaign({
      id: testCampaignId,
      userId: testUserId,
      brandName: "BrandVoice MySQL Test",
      industry: "Developer Tools",
      objective: "Product launch",
      productInfo: "Next-gen campaign assistant",
      brandVoiceProfile: sampleProfile,
      tweets: sampleTweets,
      notionUrl: "https://notion.so/test-mysql-page",
      notionPageId: "page_mysql_123",
    });

    assert.equal(saved.id, testCampaignId);
    assert.equal(saved.brandName, "BrandVoice MySQL Test");
    assert.deepEqual(saved.brandVoiceProfile, sampleProfile);
    assert.deepEqual(saved.tweets, sampleTweets);

    // Verify retrieving by ID
    const retrieved = await repo.getCampaignById(testCampaignId, testUserId);
    assert.ok(retrieved);
    assert.equal(retrieved.id, testCampaignId);
    assert.equal(retrieved.notionUrl, "https://notion.so/test-mysql-page");

    // Verify finding by ID without user scope
    const found = await repo.findCampaignById(testCampaignId);
    assert.ok(found);
    assert.equal(found.id, testCampaignId);

    // Update Notion info
    const updated = await repo.updateCampaignNotion(testCampaignId, testUserId, {
      notionUrl: "https://notion.so/updated-page",
      notionPageId: "page_updated_456",
    });
    assert.equal(updated.notionUrl, "https://notion.so/updated-page");
    assert.equal(updated.notionPageId, "page_updated_456");

    // List user campaigns
    const userCampaigns = await repo.getUserCampaigns(testUserId);
    assert.equal(userCampaigns.length, 1);
    assert.equal(userCampaigns[0].id, testCampaignId);
    assert.equal(userCampaigns[0].brandName, "BrandVoice MySQL Test");

    // Delete campaign
    const deleted = await repo.deleteCampaign(testCampaignId, testUserId);
    assert.equal(deleted, true);

    const afterDelete = await repo.getCampaignById(testCampaignId, testUserId);
    assert.equal(afterDelete, null);

    // Clean up test user
    await pool.execute("DELETE FROM users WHERE id = ?", [testUserId]);
  });

  it("GET /api/health accurately reports connected MySQL database without exposing secrets", async () => {
    const app = createApp({ repository: repo, pool });
    const { status, data } = await request(app, "GET", "/api/health");

    assert.equal(status, 200);
    assert.equal(data.status, "ok");
    assert.equal(data.databaseConfigured, true);
    assert.equal(data.databaseConnected, true);
    assert.equal(data.database.status, "connected");
    assert.equal(data.database.database, "brandvoice_db");
    assert.equal(data.database.host, "localhost");
    assert.equal(data.database.port, 3306);

    // Security check: ensure NO password or secret is exposed
    const dataString = JSON.stringify(data);
    assert.equal(dataString.includes("root"), false, "Password must not be exposed in health check");
    assert.equal(dataString.includes("password"), false, "Password field must not be exposed");
  });
});
