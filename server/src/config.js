import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

// Load local environment variables from server/.env if present
dotenv.config({ path: envPath });

export function parseDatabaseUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;
  try {
    const parsed = new URL(urlStr);
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      database: parsed.pathname ? parsed.pathname.replace(/^\//, "") : "brandvoice_db",
      user: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
      ssl: parsed.searchParams.get("ssl-mode") === "REQUIRED" || parsed.searchParams.get("ssl") === "true",
    };
  } catch {
    return null;
  }
}

export function validateEnvironment() {
  const issues = [];
  const model = process.env.GEMINI_MODEL?.trim();
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // Validate model configuration
  if (!model) {
    issues.push(
      "GEMINI_MODEL is not configured. Specify a model such as 'gemini-2.5-flash' in server/.env.",
    );
  }

  // Validate API key configuration without printing the key value
  const isKeyConfigured = Boolean(apiKey && apiKey !== "your_gemini_api_key_here");
  if (!isKeyConfigured) {
    issues.push(
      "GEMINI_API_KEY is missing or contains placeholder text. Add your real Google AI Studio key to server/.env.",
    );
  }

  // Validate n8n Notion webhook configuration without printing the URL
  const n8nWebhook = process.env.N8N_NOTION_WEBHOOK_URL?.trim();
  const isN8nConfigured = Boolean(n8nWebhook && n8nWebhook.startsWith("http"));

  // Validate Google Client ID
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const isGoogleConfigured = Boolean(googleClientId && googleClientId !== "your_google_client_id");
  if (!isGoogleConfigured) {
    issues.push(
      "GOOGLE_CLIENT_ID is not configured in server/.env. Google Sign-In requires a Google Cloud OAuth Client ID.",
    );
  }

  // Validate JWT Secret
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const isJwtConfigured = Boolean(
    jwtSecret && jwtSecret !== "replace_with_a_long_random_secret" && jwtSecret.length >= 16,
  );
  if (!isJwtConfigured) {
    issues.push(
      "JWT_SECRET is missing or using placeholder in server/.env. A strong secret is required to sign session tokens.",
    );
  }

  // Validate MySQL Configuration
  const dbUrlConfig = parseDatabaseUrl(process.env.DATABASE_URL || process.env.MYSQL_URL);
  const mysqlHost = process.env.MYSQL_HOST || dbUrlConfig?.host || "localhost";
  const mysqlPort = parseInt(
    process.env.MYSQL_PORT || (dbUrlConfig?.port ? String(dbUrlConfig.port) : "3306"),
    10,
  );
  const mysqlDatabase =
    process.env.MYSQL_DATABASE?.trim() || dbUrlConfig?.database || "brandvoice_db";
  const mysqlUser = process.env.MYSQL_USER?.trim() || dbUrlConfig?.user || "";
  const mysqlPassword = process.env.MYSQL_PASSWORD || dbUrlConfig?.password || "";
  const mysqlSsl =
    process.env.MYSQL_SSL === "true" ||
    process.env.MYSQL_SSL === "1" ||
    Boolean(dbUrlConfig?.ssl);
  const mysqlSkipCreateDb =
    process.env.MYSQL_SKIP_CREATE_DB === "true" ||
    process.env.MYSQL_SKIP_CREATE_DB === "1";
  const isDbConfigured = Boolean(mysqlUser && mysqlUser !== "your_mysql_user");
  if (!isDbConfigured) {
    issues.push(
      "MYSQL_USER or MYSQL_PASSWORD not configured in server/.env. Database features will run in in-memory mode until configured.",
    );
  }

  // Safe startup logging - NEVER print key characters or secret values
  console.log("--------------------------------------------------");
  console.log("Brand Voice AI — Backend Environment Startup Check");
  console.log(`Port: ${process.env.PORT || 3001}`);
  console.log(`Frontend Origin: ${process.env.FRONTEND_ORIGIN || "http://localhost:8080"}`);
  console.log(`Gemini Model: ${model ? `Configured ("${model}")` : "MISSING"}`);
  console.log(
    `Gemini API Key: ${
      isKeyConfigured
        ? `Configured (${apiKey.length} characters)`
        : "NOT CONFIGURED (Generation endpoints will return 503)"
    }`,
  );
  console.log(
    `n8n Notion Webhook: ${
      isN8nConfigured ? "Configured" : "NOT CONFIGURED (Notion save endpoint will return 503)"
    }`,
  );
  // Validate Notion OAuth Configuration
  const notionClientId = process.env.NOTION_OAUTH_CLIENT_ID?.trim();
  const notionClientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET?.trim();
  const notionRedirectUri =
    process.env.NOTION_OAUTH_REDIRECT_URI?.trim() ||
    `http://localhost:${process.env.PORT || 3001}/api/notion/oauth/callback`;
  const notionEncryptionKey =
    process.env.NOTION_TOKEN_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim();

  const isNotionOAuthConfigured = Boolean(
    notionClientId &&
      notionClientSecret &&
      notionClientId !== "your_notion_client_id" &&
      notionClientSecret !== "your_notion_client_secret",
  );

  console.log(
    `Notion OAuth (Per-User): ${
      isNotionOAuthConfigured
        ? "Configured (Public OAuth)"
        : "NOT CONFIGURED (Add NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET to server/.env)"
    }`,
  );
  console.log(
    `Google Sign-In: ${
      isGoogleConfigured ? "Configured" : "NOT CONFIGURED (Add GOOGLE_CLIENT_ID to server/.env)"
    }`,
  );
  console.log(
    `JWT Session Security: ${
      isJwtConfigured ? "Configured" : "NOT CONFIGURED (Add JWT_SECRET to server/.env)"
    }`,
  );
  console.log(
    `MySQL Database: ${
      isDbConfigured
        ? `Configured (${mysqlUser}@${mysqlHost}:${mysqlPort}/${mysqlDatabase}${mysqlSsl ? " [SSL]" : ""})`
        : "NOT CONFIGURED (Using in-memory repository)"
    }`,
  );
  if (issues.length > 0) {
    console.log("Notice: " + issues.join(" | "));
  }
  console.log("--------------------------------------------------");

  return {
    port: parseInt(process.env.PORT || "3001", 10),
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:8080",
    geminiApiKey: apiKey || "",
    geminiModel: model || "gemini-2.5-flash",
    isGeminiConfigured: isKeyConfigured,
    n8nNotionWebhookUrl: n8nWebhook || "",
    isN8nConfigured,
    googleClientId: googleClientId || "",
    isGoogleConfigured,
    jwtSecret: jwtSecret || "",
    isJwtConfigured,
    notion: {
      clientId: notionClientId || "",
      clientSecret: notionClientSecret || "",
      redirectUri: notionRedirectUri,
      encryptionKey: notionEncryptionKey || "",
      isOAuthConfigured: isNotionOAuthConfigured,
    },
    mysql: {
      host: mysqlHost,
      port: mysqlPort,
      database: mysqlDatabase,
      user: mysqlUser,
      password: mysqlPassword,
      ssl: mysqlSsl,
      skipCreateDb: mysqlSkipCreateDb,
    },
    isDbConfigured,
    issues,
  };
}

export const config = {
  get port() {
    return parseInt(process.env.PORT || "3001", 10);
  },
  get frontendOrigin() {
    return process.env.FRONTEND_ORIGIN || "http://localhost:8080";
  },
  get geminiApiKey() {
    return process.env.GEMINI_API_KEY?.trim() || "";
  },
  get geminiModel() {
    return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  },
  get isGeminiConfigured() {
    const key = process.env.GEMINI_API_KEY?.trim();
    return Boolean(key && key !== "your_gemini_api_key_here");
  },
  get n8nNotionWebhookUrl() {
    return process.env.N8N_NOTION_WEBHOOK_URL?.trim() || "";
  },
  get isN8nConfigured() {
    const url = process.env.N8N_NOTION_WEBHOOK_URL?.trim();
    return Boolean(url && url.startsWith("http"));
  },
  get googleClientId() {
    return process.env.GOOGLE_CLIENT_ID?.trim() || "";
  },
  get isGoogleConfigured() {
    const cid = process.env.GOOGLE_CLIENT_ID?.trim();
    return Boolean(cid && cid !== "your_google_client_id");
  },
  get jwtSecret() {
    return process.env.JWT_SECRET?.trim() || "";
  },
  get isJwtConfigured() {
    const secret = process.env.JWT_SECRET?.trim();
    return Boolean(secret && secret !== "replace_with_a_long_random_secret" && secret.length >= 16);
  },
  get notion() {
    const clientId = process.env.NOTION_OAUTH_CLIENT_ID?.trim() || "";
    const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET?.trim() || "";
    const redirectUri =
      process.env.NOTION_OAUTH_REDIRECT_URI?.trim() ||
      `http://localhost:${process.env.PORT || 3001}/api/notion/oauth/callback`;
    const encryptionKey =
      process.env.NOTION_TOKEN_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim() || "";
    const isOAuthConfigured = Boolean(
      clientId &&
        clientSecret &&
        clientId !== "your_notion_client_id" &&
        clientSecret !== "your_notion_client_secret",
    );
    return {
      clientId,
      clientSecret,
      redirectUri,
      encryptionKey,
      isOAuthConfigured,
    };
  },
  get mysql() {
    const dbUrlConfig = parseDatabaseUrl(process.env.DATABASE_URL || process.env.MYSQL_URL);
    return {
      host: process.env.MYSQL_HOST || dbUrlConfig?.host || "localhost",
      port: parseInt(
        process.env.MYSQL_PORT || (dbUrlConfig?.port ? String(dbUrlConfig.port) : "3306"),
        10,
      ),
      database: process.env.MYSQL_DATABASE?.trim() || dbUrlConfig?.database || "brandvoice_db",
      user: process.env.MYSQL_USER?.trim() || dbUrlConfig?.user || "",
      password: process.env.MYSQL_PASSWORD || dbUrlConfig?.password || "",
      ssl:
        process.env.MYSQL_SSL === "true" ||
        process.env.MYSQL_SSL === "1" ||
        Boolean(dbUrlConfig?.ssl),
      skipCreateDb:
        process.env.MYSQL_SKIP_CREATE_DB === "true" ||
        process.env.MYSQL_SKIP_CREATE_DB === "1",
    };
  },
  get isDbConfigured() {
    const dbUrlConfig = parseDatabaseUrl(process.env.DATABASE_URL || process.env.MYSQL_URL);
    const user = process.env.MYSQL_USER?.trim() || dbUrlConfig?.user;
    return Boolean(user && user !== "your_mysql_user");
  },
};
