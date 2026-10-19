import mysql from "mysql2/promise";
import crypto from "node:crypto";

/**
 * In-memory repository fallback for test environments or when MySQL is not yet configured.
 * Guarantees that unit tests and mock flows work with identical data contracts and strict isolation.
 */
export class MemoryRepository {
  constructor() {
    this.users = new Map();
    this.campaigns = new Map();
    this.notionConnections = new Map();
  }

  async findUserByGoogleId(googleId) {
    for (const user of this.users.values()) {
      if (user.google_id === googleId) return { ...user };
    }
    return null;
  }

  async findUserById(id) {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async createUser({ googleId, name, email, profilePicture }) {
    const now = new Date().toISOString();
    const id = `usr_${crypto.randomUUID()}`;
    const user = {
      id,
      google_id: googleId,
      name,
      email,
      profile_picture: profilePicture || null,
      created_at: now,
      updated_at: now,
    };
    this.users.set(id, user);
    return { ...user };
  }

  async updateUser(id, { name, email, profilePicture }) {
    const user = this.users.get(id);
    if (!user) return null;
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (profilePicture !== undefined) user.profile_picture = profilePicture;
    user.updated_at = new Date().toISOString();
    this.users.set(id, user);
    return { ...user };
  }

  async findOrCreateGoogleUser({ googleId, name, email, profilePicture }) {
    const existing = await this.findUserByGoogleId(googleId);
    if (existing) {
      if (
        (name && existing.name !== name) ||
        (profilePicture && existing.profile_picture !== profilePicture)
      ) {
        return this.updateUser(existing.id, { name, email, profilePicture });
      }
      return existing;
    }
    return this.createUser({ googleId, name, email, profilePicture });
  }

  async saveCampaign({
    id,
    userId,
    brandName,
    industry = "",
    objective,
    productInfo = "",
    brandVoiceProfile = null,
    tweets = null,
    notionUrl = null,
    notionPageId = null,
  }) {
    const now = new Date().toISOString();
    const campaignId = id || `camp_${Date.now()}`;
    const record = {
      id: campaignId,
      userId,
      user_id: userId,
      brand_name: brandName,
      brandName,
      industry,
      campaign_objective: objective,
      objective,
      product_info: productInfo,
      productInfo,
      brand_voice_profile: brandVoiceProfile,
      brandVoiceProfile,
      tweets,
      notion_url: notionUrl,
      notionUrl,
      notion_page_id: notionPageId,
      notionPageId,
      created_at: now,
      updated_at: now,
    };
    this.campaigns.set(campaignId, record);
    return { ...record };
  }

  async updateCampaignNotion(campaignId, userId, { notionUrl, notionPageId }) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.user_id !== userId) return null;
    if (notionUrl !== undefined) {
      campaign.notion_url = notionUrl;
      campaign.notionUrl = notionUrl;
    }
    if (notionPageId !== undefined) {
      campaign.notion_page_id = notionPageId;
      campaign.notionPageId = notionPageId;
    }
    campaign.updated_at = new Date().toISOString();
    this.campaigns.set(campaignId, campaign);
    return { ...campaign };
  }

  async getCampaignById(campaignId, userId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.user_id !== userId) return null;
    return { ...campaign };
  }

  async findCampaignById(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;
    return { ...campaign };
  }

  async getUserCampaigns(userId) {
    const results = [];
    for (const campaign of this.campaigns.values()) {
      if (campaign.user_id === userId) {
        results.push({
          id: campaign.id,
          brandName: campaign.brand_name || campaign.brandName,
          objective: campaign.campaign_objective || campaign.objective,
          url: campaign.notion_url || campaign.notionUrl || undefined,
          pageId: campaign.notion_page_id || campaign.notionPageId || undefined,
          createdAt: campaign.created_at,
        });
      }
    }
    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async getCampaignHistory(userId) {
    return this.getUserCampaigns(userId);
  }

  async deleteCampaign(campaignId, userId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign || campaign.user_id !== userId) return false;
    return this.campaigns.delete(campaignId);
  }

  // --- Per-User Notion Connection Methods ---

  async getNotionConnectionByUserId(userId) {
    if (!userId) return null;
    const conn = this.notionConnections.get(userId);
    return conn ? { ...conn } : null;
  }

  async saveNotionConnection(userId, data) {
    if (!userId) throw new Error("userId is required to save Notion connection");
    const existing = this.notionConnections.get(userId) || {};
    const now = new Date().toISOString();
    const id = data.id || existing.id || `notion_conn_${crypto.randomUUID()}`;
    const record = {
      ...existing,
      ...data,
      id,
      user_id: userId,
      userId,
      workspace_id: data.workspaceId || data.workspace_id || existing.workspace_id,
      workspace_name: data.workspaceName || data.workspace_name || existing.workspace_name,
      workspace_icon: data.workspaceIcon ?? data.workspace_icon ?? existing.workspace_icon ?? null,
      bot_id: data.botId || data.bot_id || existing.bot_id || null,
      encrypted_access_token:
        data.encryptedAccessToken ||
        data.encrypted_access_token ||
        existing.encrypted_access_token,
      destination_page_id:
        data.destinationPageId ?? data.destination_page_id ?? existing.destination_page_id ?? null,
      destination_page_name:
        data.destinationPageName ??
        data.destination_page_name ??
        existing.destination_page_name ??
        null,
      status: data.status || existing.status || "active",
      created_at: existing.created_at || now,
      updated_at: now,
    };
    this.notionConnections.set(userId, record);
    return { ...record };
  }

  async updateNotionDestination(userId, { destinationPageId, destinationPageName }) {
    const existing = this.notionConnections.get(userId);
    if (!existing) return null;
    existing.destination_page_id = destinationPageId || null;
    existing.destination_page_name = destinationPageName || null;
    existing.updated_at = new Date().toISOString();
    this.notionConnections.set(userId, existing);
    return { ...existing };
  }

  async updateNotionStatus(userId, status) {
    const existing = this.notionConnections.get(userId);
    if (!existing) return null;
    existing.status = status;
    existing.updated_at = new Date().toISOString();
    this.notionConnections.set(userId, existing);
    return { ...existing };
  }

  async deleteNotionConnection(userId) {
    if (!userId) return false;
    return this.notionConnections.delete(userId);
  }
}

/**
 * MySQL Database Repository implementation using mysql2/promise connection pool.
 */
export class MySQLRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async findUserByGoogleId(googleId) {
    const [rows] = await this.pool.execute(
      "SELECT id, google_id, name, email, profile_picture, created_at, updated_at FROM users WHERE google_id = ? LIMIT 1",
      [googleId],
    );
    return rows[0] || null;
  }

  async findUserById(id) {
    const [rows] = await this.pool.execute(
      "SELECT id, google_id, name, email, profile_picture, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    return rows[0] || null;
  }

  async createUser({ googleId, name, email, profilePicture }) {
    const id = `usr_${crypto.randomUUID()}`;
    await this.pool.execute(
      "INSERT INTO users (id, google_id, name, email, profile_picture) VALUES (?, ?, ?, ?, ?)",
      [id, googleId, name, email, profilePicture || null],
    );
    return this.findUserById(id);
  }

  async updateUser(id, { name, email, profilePicture }) {
    const fields = [];
    const values = [];
    if (name !== undefined) {
      fields.push("name = ?");
      values.push(name);
    }
    if (email !== undefined) {
      fields.push("email = ?");
      values.push(email);
    }
    if (profilePicture !== undefined) {
      fields.push("profile_picture = ?");
      values.push(profilePicture);
    }
    if (fields.length === 0) return this.findUserById(id);
    values.push(id);
    await this.pool.execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
    return this.findUserById(id);
  }

  async findOrCreateGoogleUser({ googleId, name, email, profilePicture }) {
    const existing = await this.findUserByGoogleId(googleId);
    if (existing) {
      if (
        (name && existing.name !== name) ||
        (profilePicture && existing.profile_picture !== profilePicture)
      ) {
        return this.updateUser(existing.id, { name, email, profilePicture });
      }
      return existing;
    }
    return this.createUser({ googleId, name, email, profilePicture });
  }

  async ensureUserExists(userId) {
    if (!userId) return;
    const [rows] = await this.pool.execute("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
    if (rows.length === 0) {
      await this.pool.execute(
        `INSERT INTO users (id, google_id, name, email)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id=id`,
        [userId, `system_${userId}`, userId, `${userId}@local.brandvoice`],
      );
    }
  }

  async saveCampaign({
    id,
    userId,
    brandName,
    industry = "",
    objective,
    productInfo = "",
    brandVoiceProfile = null,
    tweets = null,
    notionUrl = null,
    notionPageId = null,
  }) {
    const campaignId = id || `camp_${Date.now()}`;
    const profileJson = brandVoiceProfile ? JSON.stringify(brandVoiceProfile) : null;
    const tweetsJson = tweets ? JSON.stringify(tweets) : null;

    if (userId) {
      await this.ensureUserExists(userId);
    }

    await this.pool.execute(
      `INSERT INTO campaigns
       (id, user_id, brand_name, industry, campaign_objective, product_info, brand_voice_profile, tweets, notion_url, notion_page_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         brand_name = VALUES(brand_name),
         industry = VALUES(industry),
         campaign_objective = VALUES(campaign_objective),
         product_info = VALUES(product_info),
         brand_voice_profile = VALUES(brand_voice_profile),
         tweets = VALUES(tweets),
         notion_url = COALESCE(VALUES(notion_url), notion_url),
         notion_page_id = COALESCE(VALUES(notion_page_id), notion_page_id)`,
      [
        campaignId,
        userId,
        brandName,
        industry,
        objective,
        productInfo,
        profileJson,
        tweetsJson,
        notionUrl,
        notionPageId,
      ],
    );

    return this.getCampaignById(campaignId, userId);
  }

  async updateCampaignNotion(campaignId, userId, { notionUrl, notionPageId }) {
    await this.pool.execute(
      `UPDATE campaigns
       SET notion_url = COALESCE(?, notion_url), notion_page_id = COALESCE(?, notion_page_id)
       WHERE id = ? AND user_id = ?`,
      [notionUrl || null, notionPageId || null, campaignId, userId],
    );
    return this.getCampaignById(campaignId, userId);
  }

  async getCampaignById(campaignId, userId) {
    const [rows] = await this.pool.execute(
      `SELECT id, user_id, brand_name, industry, campaign_objective, product_info,
              brand_voice_profile, tweets, notion_url, notion_page_id, created_at, updated_at
       FROM campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
      [campaignId, userId],
    );
    if (!rows[0]) return null;
    return this._mapCampaignRow(rows[0]);
  }

  async findCampaignById(campaignId) {
    const [rows] = await this.pool.execute(
      `SELECT id, user_id, brand_name, industry, campaign_objective, product_info,
              brand_voice_profile, tweets, notion_url, notion_page_id, created_at, updated_at
       FROM campaigns WHERE id = ? LIMIT 1`,
      [campaignId],
    );
    if (!rows[0]) return null;
    return this._mapCampaignRow(rows[0]);
  }

  _mapCampaignRow(item) {
    return {
      id: item.id,
      userId: item.user_id,
      user_id: item.user_id,
      brandName: item.brand_name,
      industry: item.industry,
      objective: item.campaign_objective,
      productInfo: item.product_info,
      brandVoiceProfile:
        typeof item.brand_voice_profile === "string"
          ? JSON.parse(item.brand_voice_profile)
          : item.brand_voice_profile,
      tweets: typeof item.tweets === "string" ? JSON.parse(item.tweets) : item.tweets,
      notionUrl: item.notion_url,
      notionPageId: item.notion_page_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
  }

  async getUserCampaigns(userId) {
    const [rows] = await this.pool.execute(
      `SELECT id, brand_name AS brandName, campaign_objective AS objective,
              notion_url AS url, notion_page_id AS pageId, created_at AS createdAt
       FROM campaigns
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      brandName: r.brandName,
      objective: r.objective,
      url: r.url || undefined,
      pageId: r.pageId || undefined,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    }));
  }

  async getCampaignHistory(userId) {
    return this.getUserCampaigns(userId);
  }

  async deleteCampaign(campaignId, userId) {
    const [result] = await this.pool.execute("DELETE FROM campaigns WHERE id = ? AND user_id = ?", [
      campaignId,
      userId,
    ]);
    return result.affectedRows > 0;
  }

  // --- Per-User Notion Connection Methods ---

  async getNotionConnectionByUserId(userId) {
    if (!userId) return null;
    const [rows] = await this.pool.execute(
      `SELECT id, user_id, workspace_id, workspace_name, workspace_icon, bot_id,
              encrypted_access_token, destination_page_id, destination_page_name,
              status, created_at, updated_at
       FROM user_notion_connections
       WHERE user_id = ? LIMIT 1`,
      [userId],
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      user_id: r.user_id,
      workspaceId: r.workspace_id,
      workspace_id: r.workspace_id,
      workspaceName: r.workspace_name,
      workspace_name: r.workspace_name,
      workspaceIcon: r.workspace_icon,
      workspace_icon: r.workspace_icon,
      botId: r.bot_id,
      bot_id: r.bot_id,
      encryptedAccessToken: r.encrypted_access_token,
      encrypted_access_token: r.encrypted_access_token,
      destinationPageId: r.destination_page_id,
      destination_page_id: r.destination_page_id,
      destinationPageName: r.destination_page_name,
      destination_page_name: r.destination_page_name,
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
    };
  }

  async saveNotionConnection(userId, data) {
    if (!userId) throw new Error("userId is required to save Notion connection");
    await this.ensureUserExists(userId);
    const id = data.id || `notion_conn_${crypto.randomUUID()}`;
    const workspaceId = data.workspaceId || data.workspace_id;
    const workspaceName = data.workspaceName || data.workspace_name;
    const workspaceIcon = data.workspaceIcon ?? data.workspace_icon ?? null;
    const botId = data.botId || data.bot_id || null;
    const encryptedAccessToken = data.encryptedAccessToken || data.encrypted_access_token;
    const destinationPageId = data.destinationPageId ?? data.destination_page_id ?? null;
    const destinationPageName = data.destinationPageName ?? data.destination_page_name ?? null;
    const status = data.status || "active";

    await this.pool.execute(
      `INSERT INTO user_notion_connections
         (id, user_id, workspace_id, workspace_name, workspace_icon, bot_id,
          encrypted_access_token, destination_page_id, destination_page_name, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         workspace_id = VALUES(workspace_id),
         workspace_name = VALUES(workspace_name),
         workspace_icon = VALUES(workspace_icon),
         bot_id = VALUES(bot_id),
         encrypted_access_token = VALUES(encrypted_access_token),
         destination_page_id = COALESCE(VALUES(destination_page_id), destination_page_id),
         destination_page_name = COALESCE(VALUES(destination_page_name), destination_page_name),
         status = VALUES(status),
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        userId,
        workspaceId,
        workspaceName,
        workspaceIcon,
        botId,
        encryptedAccessToken,
        destinationPageId,
        destinationPageName,
        status,
      ],
    );

    return this.getNotionConnectionByUserId(userId);
  }

  async updateNotionDestination(userId, { destinationPageId, destinationPageName }) {
    if (!userId) return null;
    await this.pool.execute(
      `UPDATE user_notion_connections
       SET destination_page_id = ?, destination_page_name = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [destinationPageId || null, destinationPageName || null, userId],
    );
    return this.getNotionConnectionByUserId(userId);
  }

  async updateNotionStatus(userId, status) {
    if (!userId) return null;
    await this.pool.execute(
      `UPDATE user_notion_connections
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [status, userId],
    );
    return this.getNotionConnectionByUserId(userId);
  }

  async deleteNotionConnection(userId) {
    if (!userId) return false;
    const [result] = await this.pool.execute(
      "DELETE FROM user_notion_connections WHERE user_id = ?",
      [userId],
    );
    return result.affectedRows > 0;
  }
}

let globalPool = null;

export function buildSslOptions(dbConfig) {
  if (!dbConfig?.ssl) {
    return undefined;
  }
  const sslOptions = { rejectUnauthorized: true };
  if (dbConfig.caCert) {
    sslOptions.ca = dbConfig.caCert;
  }
  return sslOptions;
}

export function buildPoolOptions(dbConfig) {
  const connectionLimit = process.env.VERCEL ? 3 : 10;
  const poolOptions = {
    host: dbConfig.host || "localhost",
    port: parseInt(dbConfig.port || "3306", 10),
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database || "brandvoice_db",
    waitForConnections: true,
    connectionLimit,
    queueLimit: 0,
    timezone: "Z",
  };

  const ssl = buildSslOptions(dbConfig);
  if (ssl) {
    poolOptions.ssl = ssl;
  }

  return poolOptions;
}

export function createDatabasePool(dbConfig) {
  if (globalPool) return globalPool;
  const poolOptions = buildPoolOptions(dbConfig);
  globalPool = mysql.createPool(poolOptions);
  return globalPool;
}

export async function closeDatabasePool() {
  if (globalPool) {
    const p = globalPool;
    globalPool = null;
    await p.end();
  }
}

export async function ensureDatabaseExists(dbConfig) {
  if (dbConfig.skipCreateDb) {
    return;
  }

  const connOptions = {
    host: dbConfig.host || "localhost",
    port: parseInt(dbConfig.port || "3306", 10),
    user: dbConfig.user,
    password: dbConfig.password,
  };

  const ssl = buildSslOptions(dbConfig);
  if (ssl) {
    connOptions.ssl = ssl;
  }

  try {
    const connection = await mysql.createConnection(connOptions);
    try {
      const dbName = (dbConfig.database || "brandvoice_db").replace(/`/g, "``");
      await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      );
    } finally {
      await connection.end();
    }
  } catch (err) {
    // If user lacks CREATE DATABASE privileges on hosted cloud database, skip safely
    if (err.code === "ER_DBACCESS_DENIED_ERROR" || err.code === "ER_ACCESS_DENIED_ERROR") {
      console.warn(
        `[Database Notice] Skipping CREATE DATABASE: ${err.message}. Assuming target database already exists.`,
      );
      return;
    }
    throw err;
  }
}

export async function runDatabaseMigrations(pool) {
  const usersTableSql = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      google_id VARCHAR(128) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      profile_picture TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_google_id (google_id),
      INDEX idx_users_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const campaignsTableSql = `
    CREATE TABLE IF NOT EXISTS campaigns (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      brand_name VARCHAR(255) NOT NULL,
      industry VARCHAR(255) DEFAULT '',
      campaign_objective VARCHAR(100) NOT NULL,
      product_info TEXT,
      brand_voice_profile JSON,
      tweets JSON,
      notion_url VARCHAR(500) NULL,
      notion_page_id VARCHAR(100) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_campaigns_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_campaigns_user_id (user_id),
      INDEX idx_campaigns_created_at (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  const userNotionConnectionsTableSql = `
    CREATE TABLE IF NOT EXISTS user_notion_connections (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL UNIQUE,
      workspace_id VARCHAR(128) NOT NULL,
      workspace_name VARCHAR(255) NOT NULL,
      workspace_icon TEXT NULL,
      bot_id VARCHAR(128) NULL,
      encrypted_access_token TEXT NOT NULL,
      destination_page_id VARCHAR(128) NULL,
      destination_page_name VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_notion_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_notion_user_id (user_id),
      INDEX idx_notion_workspace_id (workspace_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await pool.query(usersTableSql);
  await pool.query(campaignsTableSql);
  await pool.query(userNotionConnectionsTableSql);

  // Seed default anonymous user to satisfy foreign keys for anonymous sessions safely
  await pool.query(
    `INSERT IGNORE INTO users (id, google_id, name, email)
     VALUES ('usr_anonymous', 'system_anonymous', 'Anonymous User', 'anonymous@brandvoice.local');`,
  );
}

export async function initializeDatabase(dbConfig) {
  await ensureDatabaseExists(dbConfig);
  const pool = createDatabasePool(dbConfig);
  await runDatabaseMigrations(pool);
  await pool.query("SELECT 1");
  return { pool, repository: new MySQLRepository(pool) };
}
