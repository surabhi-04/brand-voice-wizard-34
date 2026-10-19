import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { config } from "./config.js";
import { campaignInputSchema, saveCampaignRequestSchema } from "./schemas.js";
import {
  generateCampaignResult,
  regenerateSingleTweet,
  regenerateAllTweets,
  ConfigurationError,
  GeminiProviderError,
} from "./gemini.js";
import {
  verifyGoogleIdToken,
  verifyGoogleAccessToken,
  generateSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  SESSION_COOKIE_NAME,
  AuthError,
} from "./auth.js";
import {
  MemoryRepository,
  MySQLRepository,
  createDatabasePool,
  runDatabaseMigrations,
} from "./db.js";
import {
  encryptToken,
  decryptToken,
  generateOAuthState,
  verifyOAuthState,
} from "./crypto.js";
import {
  getNotionAuthorizationUrl,
  exchangeNotionOAuthCode,
  listAccessibleDestinations,
  createNotionCampaignPage,
  NotionApiError,
  NotionAuthError,
  NotionDestinationError,
} from "./notion.js";

/**
 * Format campaign brief and generated results into structured Markdown for the Notion page content
 */
export function formatCampaignDocument(data, campaignId, maxContentLength = 950) {
  const result = data.result || {};
  const profile = data.profile || result.profile || {};
  let voiceSummary = (profile.summary || "").trim();
  if (voiceSummary.length > 130) {
    voiceSummary = voiceSummary.slice(0, 127).trim() + "…";
  }

  const rawThemes = Array.isArray(profile.themes) ? profile.themes : [];
  const themes = rawThemes.slice(0, 3);

  const rawChars = Array.isArray(profile.characteristics) ? profile.characteristics : [];
  const characteristics = rawChars.slice(0, 3);

  const rawTweets = Array.isArray(data.tweets)
    ? data.tweets
    : Array.isArray(result.tweets)
      ? result.tweets
      : [];

  const lines = [];
  lines.push("### Brand Voice Profile");
  if (voiceSummary) lines.push(`• Voice: ${voiceSummary}`);
  if (themes.length > 0) lines.push(`• Themes: ${themes.join(" · ")}`);
  if (characteristics.length > 0) lines.push(`• Style: ${characteristics.join(" · ")}`);
  lines.push("");
  lines.push("### Campaign Tweets (1–10)");

  const headerLength = lines.join("\n").length + 1;
  const numTweets = Math.max(1, rawTweets.length || 10);
  const remainingBudget = Math.max(100, maxContentLength - headerLength);

  const budgetPerTweetLine = Math.floor(remainingBudget / numTweets);

  rawTweets.forEach((t, idx) => {
    let angle = (t.angle || t.label || `Tweet ${idx + 1}`).trim();
    if (angle.length > 20) angle = angle.slice(0, 18).trim() + "…";
    const prefix = `${idx + 1}. [${angle}] `;
    const maxTextLen = Math.max(15, budgetPerTweetLine - prefix.length - 1);
    let text = (t.text || "").trim();
    if (text.length > maxTextLen) {
      text = text.slice(0, maxTextLen - 1).trim() + "…";
    }
    lines.push(`${prefix}${text}`);
  });

  let doc = lines.join("\n").trim();
  if (doc.length > maxContentLength) {
    doc = doc.slice(0, maxContentLength - 1).trim() + "…";
  }
  return doc;
}

/**
 * Format campaign brief and generated results into the payload expected by the n8n Notion workflow
 */
export function formatN8nNotionPayload(data, campaignId) {
  const input = data.input || {};
  const result = data.result || {};

  const brand = (data.brand || data.brandName || input.brandName || "").trim();
  const objective =
    data.campaignObjective || data.objective || input.objective || "Brand awareness";
  const industry = (data.industry || input.industry || "").trim();
  const audience = (data.audience || input.audience || result.profile?.audience || "").trim();
  const productInfo = (
    data.productInfo ||
    data.product ||
    data.offer ||
    data.details ||
    input.details ||
    ""
  ).trim();
  const additionalContext = (
    data.additionalContext ||
    data.instructions ||
    input.instructions ||
    ""
  ).trim();

  let preferredTones = [];
  if (Array.isArray(data.preferredTones) && data.preferredTones.length > 0) {
    preferredTones = data.preferredTones;
  } else if (typeof data.preferredTones === "string" && data.preferredTones.trim()) {
    preferredTones = data.preferredTones
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  } else if (Array.isArray(data.tones) && data.tones.length > 0) {
    preferredTones = data.tones;
  } else if (Array.isArray(input.tones) && input.tones.length > 0) {
    preferredTones = input.tones;
  }

  // Boolean includeEmojis for Notion Checkbox property
  const rawEmojiUsage =
    data.includeEmojis !== undefined
      ? data.includeEmojis
      : data.emojiUsage !== undefined
        ? data.emojiUsage
        : input.emojiUsage;

  let includeEmojis = false;
  if (typeof rawEmojiUsage === "boolean") {
    includeEmojis = rawEmojiUsage;
  } else if (typeof rawEmojiUsage === "string") {
    const lower = rawEmojiUsage.toLowerCase().trim();
    includeEmojis =
      lower === "yes" ||
      lower.includes("naturally") ||
      lower.includes("more") ||
      lower.includes("few");
  }

  // Numeric emojiCount for Notion Number property
  let emojiCount = 0;
  if (includeEmojis) {
    const rawEmojiCount = data.emojiCount !== undefined ? data.emojiCount : input.emojiCount;
    if (typeof rawEmojiCount === "number") {
      emojiCount = Math.max(0, Math.min(10, Math.round(rawEmojiCount)));
    } else if (typeof rawEmojiCount === "string") {
      const match = rawEmojiCount.match(/(\d+)/);
      emojiCount = match ? Math.max(0, Math.min(10, parseInt(match[1], 10))) : 4;
    } else {
      emojiCount = 4;
    }
  }

  const createdAt = data.createdAt || new Date().toISOString();
  const id = campaignId || data.campaignId || result.campaignId || `camp_${Date.now()}`;
  const campaignName = `${brand ? brand : "Campaign"} — ${objective}`;

  const fieldLengths =
    brand.length +
    industry.length +
    objective.length +
    audience.length +
    productInfo.length +
    additionalContext.length +
    preferredTones.join(", ").length +
    campaignName.length;

  const estimatedN8nOverhead = Math.max(380, fieldLengths + 380);
  const maxPageContentLength = Math.max(300, Math.min(950, 1900 - estimatedN8nOverhead));

  const safeDoc = formatCampaignDocument(data, id, maxPageContentLength);

  return {
    campaignId: id,
    campaignName,
    brand,
    brandName: brand,
    industry,
    campaignObjective: objective,
    objective,
    audience,
    productInfo,
    product: productInfo,
    offer: productInfo,
    details: productInfo,
    additionalContext,
    instructions: additionalContext,
    preferredTones,
    tones: preferredTones,
    includeEmojis,
    emojiCount,
    createdAt,
    pageContent: safeDoc,
  };
}

export function createApp(options = {}) {
  const app = express();

  // Repository initialization (MySQL or in-memory)
  let repository;
  if (options.repository) {
    repository = options.repository;
  } else if (options.mock || !config.isDbConfigured) {
    repository = new MemoryRepository();
  } else {
    // When config.isDbConfigured is true and no repository passed, use MySQLRepository.
    // Do not silently fall back to in-memory storage!
    const pool = options.pool || createDatabasePool(config.mysql);
    repository = new MySQLRepository(pool);
  }

  // CORS configuration
  const allowedOrigin = options.frontendOrigin || config.frontendOrigin;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          origin === allowedOrigin ||
          origin === "http://localhost:8080" ||
          origin === "http://127.0.0.1:8080"
        ) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive in dev/local environment
      },
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Accept",
        "Authorization",
        "X-Mock-Provider",
        "X-Test-Mock-User",
      ],
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  // Auth rate limiter to protect authentication endpoints from brute force
  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication requests. Please try again in 15 minutes." },
  });
  app.use("/api/auth", authRateLimiter);

  // Authentication middleware
  const jwtSecret = options.jwtSecret || config.jwtSecret;
  const skipAuthForTests =
    options.requireAuth === true
      ? false
      : Boolean(options.skipAuthForTests ?? options.mock !== undefined);
  const requireAuth = createAuthMiddleware({
    jwtSecret,
    repository,
    skipAuthForTests,
  });
  const optionalAuth = createOptionalAuthMiddleware({
    jwtSecret,
    repository,
    skipAuthForTests,
  });

  // Guest rate limiter to protect Gemini quota for unauthenticated visitors
  const guestGenerateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => Boolean(req.user),
    message: {
      error:
        "Guest demo limit reached (10 generations per 15 minutes). Sign in with Google to continue.",
      code: "GUEST_RATE_LIMIT",
    },
  });

  // Health check endpoint
  app.get("/api/health", async (_req, res) => {
    let databaseConnected = false;
    let databaseStatus = "unconfigured";
    let databaseError = null;

    if (repository instanceof MemoryRepository || options.mock) {
      databaseStatus = "in_memory";
    } else if (repository instanceof MySQLRepository && repository.pool) {
      try {
        await repository.pool.query("SELECT 1");
        databaseConnected = true;
        databaseStatus = "connected";
      } catch (err) {
        databaseStatus = "error";
        databaseError = err.message || "Failed to query database";
      }
    } else if (config.isDbConfigured) {
      databaseStatus = "configured";
    }

    res.json({
      status: "ok",
      geminiConfigured: config.isGeminiConfigured,
      geminiModel: config.geminiModel,
      n8nConfigured: config.isN8nConfigured,
      googleConfigured: config.isGoogleConfigured,
      jwtConfigured: config.isJwtConfigured,
      databaseConfigured: config.isDbConfigured,
      databaseConnected,
      database: {
        status: databaseStatus,
        connected: databaseConnected,
        database: config.mysql.database,
        host: config.mysql.host,
        port: config.mysql.port,
        ...(databaseError ? { error: databaseError } : {}),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Public Auth Config endpoint for frontend discovery
  app.get("/api/auth/config", (_req, res) => {
    res.json({
      googleClientId: config.googleClientId || null,
      isGoogleConfigured: config.isGoogleConfigured,
      isJwtConfigured: config.isJwtConfigured,
      isDbConfigured: config.isDbConfigured,
    });
  });

  // POST /api/auth/google — Verify Google ID token or Access Token and establish JWT session
  app.post("/api/auth/google", async (req, res) => {
    try {
      const idToken = req.body?.idToken || req.body?.credential;
      const accessToken = req.body?.accessToken;

      if (
        (!idToken || typeof idToken !== "string") &&
        (!accessToken || typeof accessToken !== "string")
      ) {
        return res
          .status(400)
          .json({ error: "Missing Google ID token or access token in request body." });
      }

      const googleClientId = options.googleClientId || config.googleClientId;
      let googleUser;

      // In mock/test environments
      if (options.mockGoogleAuth) {
        googleUser = {
          googleId: req.body.mockGoogleId || "google_mock_sub_123",
          name: req.body.mockName || "Test User",
          email: req.body.mockEmail || "test@example.com",
          profilePicture: req.body.mockPicture || null,
          emailVerified: true,
        };
      } else if (idToken) {
        googleUser = await verifyGoogleIdToken(idToken, googleClientId);
      } else {
        googleUser = await verifyGoogleAccessToken(accessToken);
      }

      // Find or create user in repository
      const user = await repository.findOrCreateGoogleUser({
        googleId: googleUser.googleId,
        name: googleUser.name,
        email: googleUser.email,
        profilePicture: googleUser.profilePicture,
      });

      // Issue JWT session token
      const sessionToken = generateSessionToken(user, jwtSecret);
      setSessionCookie(res, sessionToken);

      return res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profilePicture: user.profile_picture || null,
        },
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      return res.status(500).json({
        error: "An unexpected error occurred during Google authentication.",
      });
    }
  });

  // GET /api/auth/me — Return current authenticated user profile
  app.get("/api/auth/me", requireAuth, (req, res) => {
    return res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        profilePicture: req.user.profile_picture || null,
      },
    });
  });

  // POST /api/auth/logout — Invalidate session and clear cookie
  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    return res.json({ success: true, message: "Logged out successfully" });
  });

  // =========================================================================
  // Notion Per-User OAuth & Workspace Integration Routes
  // =========================================================================

  // GET /api/notion/status — Check if authenticated user has connected Notion
  app.get("/api/notion/status", requireAuth, async (req, res) => {
    try {
      const conn = await repository.getNotionConnectionByUserId(req.user.id);
      return res.json({
        connected: Boolean(conn && conn.status === "active"),
        workspaceId: conn?.workspace_id || null,
        workspaceName: conn?.workspace_name || null,
        workspaceIcon: conn?.workspace_icon || null,
        destination: conn?.destination_page_id
          ? {
              id: conn.destination_page_id,
              name: conn.destination_page_name || "Selected page",
            }
          : null,
        isConfigured: config.notion.isOAuthConfigured || Boolean(options.mock),
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to retrieve Notion connection status." });
    }
  });

  // GET /api/notion/oauth/authorize — Initiate Notion OAuth flow for user
  app.get("/api/notion/oauth/authorize", requireAuth, (req, res) => {
    try {
      const isConfigured = config.notion.isOAuthConfigured || Boolean(options.mock);
      if (!isConfigured) {
        return res.status(503).json({
          error:
            "Notion OAuth is not configured on the server. Please add NOTION_OAUTH_CLIENT_ID and NOTION_OAUTH_CLIENT_SECRET to server/.env.",
          code: "NOTION_NOT_CONFIGURED",
        });
      }

      const state = generateOAuthState({
        userId: req.user.id,
        jwtSecret,
        redirectUrl: req.query.redirect_url,
      });

      if (options.mock) {
        const mockCallbackUrl = `http://localhost:${config.port}/api/notion/oauth/callback?code=mock_notion_code&state=${encodeURIComponent(state)}`;
        return res.json({ url: mockCallbackUrl });
      }

      const url = getNotionAuthorizationUrl({
        clientId: config.notion.clientId,
        redirectUri: config.notion.redirectUri,
        state,
      });

      return res.json({ url });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /api/notion/oauth/callback — Handle OAuth redirect from Notion
  app.get("/api/notion/oauth/callback", async (req, res) => {
    try {
      const allowedOrigin = options.frontendOrigin || config.frontendOrigin;

      // Handle user denial / cancellation
      if (req.query.error) {
        return res.redirect(
          `${allowedOrigin}/#studio?notion_error=${encodeURIComponent(req.query.error)}`,
        );
      }

      const { code, state } = req.query;
      if (!code || !state) {
        return res.status(400).send("Missing OAuth code or state parameter.");
      }

      // Cryptographically verify CSRF state token and extract bound user ID
      let statePayload;
      try {
        statePayload = verifyOAuthState(state, jwtSecret);
      } catch (err) {
        return res
          .status(400)
          .send(`Invalid, tampered, or expired OAuth state token: ${err.message}`);
      }

      const userId = statePayload.userId;

      // If user already has an active session cookie, ensure it matches state userId
      const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
      if (cookieToken) {
        try {
          const sessionPayload = verifySessionToken(cookieToken, jwtSecret);
          if (sessionPayload.sub !== userId) {
            return res
              .status(403)
              .send("Account mismatch: OAuth state does not match the active session.");
          }
        } catch {
          // Ignore invalid cookie; state token is primary authority
        }
      }

      // Exchange code for Notion access tokens
      const mockResp = options.mock
        ? {
            accessToken: "mock_notion_access_token_123",
            workspaceId: "mock_ws_123",
            workspaceName: "Mock Team Workspace",
            workspaceIcon: null,
            botId: "mock_bot_123",
          }
        : null;

      const tokenData = await exchangeNotionOAuthCode({
        code,
        clientId: config.notion.clientId,
        clientSecret: config.notion.clientSecret,
        redirectUri: config.notion.redirectUri,
        fetchImpl: options.fetchImpl || fetch,
        mockResponse: mockResp,
      });

      // Encrypt sensitive Notion access token at rest using AES-256-GCM
      const encKey = options.notionEncryptionKey || config.notion.encryptionKey;
      const encryptedAccessToken = encryptToken(tokenData.accessToken, encKey);

      // Save connection to MySQL / repository bound to authenticated userId
      await repository.saveNotionConnection(userId, {
        workspaceId: tokenData.workspaceId,
        workspaceName: tokenData.workspaceName,
        workspaceIcon: tokenData.workspaceIcon,
        botId: tokenData.botId,
        encryptedAccessToken,
        status: "active",
      });

      // Auto-select initial destination page if available
      try {
        const mockDest = options.mock
          ? [{ id: "mock_p1", title: "Campaigns Database" }]
          : null;
        const pages = await listAccessibleDestinations({
          accessToken: tokenData.accessToken,
          fetchImpl: options.fetchImpl || fetch,
          mockDestinations: mockDest,
        });
        if (pages && pages.length > 0) {
          await repository.updateNotionDestination(userId, {
            destinationPageId: pages[0].id,
            destinationPageName: pages[0].title,
          });
        }
      } catch (err) {
        // Non-blocking auto-select
      }

      const redirectUrl =
        statePayload.redirectUrl ||
        `${allowedOrigin}/#studio?notion_connected=true&workspace=${encodeURIComponent(
          tokenData.workspaceName,
        )}`;

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error("[Notion OAuth Callback Error]", err);
      const allowedOrigin = options.frontendOrigin || config.frontendOrigin;
      return res.redirect(`${allowedOrigin}/#studio?notion_error=callback_failed`);
    }
  });

  // POST /api/notion/disconnect — Disconnect Notion workspace for authenticated user
  app.post("/api/notion/disconnect", requireAuth, async (req, res) => {
    try {
      await repository.deleteNotionConnection(req.user.id);
      return res.json({ success: true, message: "Notion workspace disconnected successfully." });
    } catch (err) {
      return res.status(500).json({ error: "Failed to disconnect Notion workspace." });
    }
  });

  // GET /api/notion/destinations — List accessible pages/databases in user's Notion workspace
  app.get("/api/notion/destinations", requireAuth, async (req, res) => {
    try {
      const conn = await repository.getNotionConnectionByUserId(req.user.id);
      if (!conn || conn.status !== "active") {
        return res.status(400).json({
          error: "No active Notion workspace connected. Please connect Notion first.",
          code: "NOTION_NOT_CONNECTED",
        });
      }

      const encKey = options.notionEncryptionKey || config.notion.encryptionKey;
      let accessToken;
      try {
        accessToken = decryptToken(conn.encrypted_access_token, encKey);
      } catch {
        return res.status(500).json({
          error: "Failed to decrypt Notion credentials. Please reconnect your workspace.",
          code: "DECRYPTION_FAILED",
        });
      }

      const mockDest = options.mock
        ? [
            { id: "mock_p1", title: "Campaign Library", icon: "📁", url: "https://notion.so/p1" },
            { id: "mock_p2", title: "Marketing Wiki", icon: "🚀", url: "https://notion.so/p2" },
          ]
        : null;

      const destinations = await listAccessibleDestinations({
        accessToken,
        fetchImpl: options.fetchImpl || fetch,
        mockDestinations: mockDest,
      });

      return res.json({
        destinations,
        currentDestinationId: conn.destination_page_id || null,
        currentDestinationName: conn.destination_page_name || null,
      });
    } catch (err) {
      if (err instanceof NotionAuthError) {
        await repository.updateNotionStatus(req.user.id, "revoked");
        return res.status(401).json({ error: err.message, code: err.code });
      }
      return res.status(500).json({ error: err.message || "Failed to retrieve Notion destinations." });
    }
  });

  // POST /api/notion/destination — Select destination page in user's workspace
  app.post("/api/notion/destination", requireAuth, async (req, res) => {
    try {
      const { destinationPageId, destinationPageName } = req.body || {};
      if (!destinationPageId || typeof destinationPageId !== "string") {
        return res.status(400).json({ error: "destinationPageId is required." });
      }

      const updated = await repository.updateNotionDestination(req.user.id, {
        destinationPageId: destinationPageId.trim(),
        destinationPageName: (destinationPageName || "Selected Page").trim(),
      });

      if (!updated) {
        return res.status(400).json({
          error: "No Notion connection found for your account. Please connect Notion first.",
          code: "NOTION_NOT_CONNECTED",
        });
      }

      return res.json({
        success: true,
        destination: {
          id: updated.destination_page_id,
          name: updated.destination_page_name,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: "Failed to update Notion destination." });
    }
  });

  const generateMiddleware =
    options.requireAuth === true ? requireAuth : [optionalAuth, guestGenerateLimiter];
  const tweetAuthMiddleware = options.requireAuth === true ? requireAuth : optionalAuth;

  // POST /api/campaigns/generate (Supports Guest Demo Mode & Authenticated Users)
  app.post("/api/campaigns/generate", generateMiddleware, async (req, res) => {
    try {
      const parsed = campaignInputSchema.safeParse(req.body);
      if (!parsed.success) {
        const errorMessages = parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", ");
        return res.status(400).json({ error: `Validation error: ${errorMessages}` });
      }

      const useMock = Boolean(options.mock || req.headers["x-mock-provider"] === "true");
      const result = await generateCampaignResult(parsed.data, { mock: useMock });

      // If user is authenticated, save campaign draft record associated with authenticated user
      // If user is a guest, do NOT store into database, guaranteeing no access to private user data
      if (req.user) {
        await repository.saveCampaign({
          id: result.campaignId,
          userId: req.user.id,
          brandName: parsed.data.brandName,
          industry: parsed.data.industry,
          objective: parsed.data.objective,
          productInfo: parsed.data.details,
          brandVoiceProfile: result.profile,
          tweets: result.tweets,
        });
      }

      return res.json(result);
    } catch (err) {
      if (err instanceof ConfigurationError) {
        return res.status(err.status).json({
          error:
            "Gemini API key is not configured. Add your GEMINI_API_KEY to server/.env to enable generation.",
        });
      }
      if (err instanceof GeminiProviderError) {
        return res.status(err.status).json({ error: err.message });
      }
      return res
        .status(500)
        .json({ error: err.message || "An unexpected error occurred generating the campaign." });
    }
  });

  // POST /api/campaigns/:campaignId/tweets/:tweetNumber/regenerate (Guest & Authenticated)
  app.post(
    "/api/campaigns/:campaignId/tweets/:tweetNumber/regenerate",
    tweetAuthMiddleware,
    async (req, res) => {
      try {
        const tweetNumber = parseInt(req.params.tweetNumber, 10);
        if (isNaN(tweetNumber) || tweetNumber < 1 || tweetNumber > 10) {
          return res
            .status(400)
            .json({ error: "tweetNumber must be an integer between 1 and 10." });
        }

        const parsed = campaignInputSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid campaign brief provided." });
        }

        const userId = req.user?.id;
        if (userId) {
          const existing = await repository.getCampaignById(req.params.campaignId, userId);
          // If campaign exists in DB but is not owned by this user, block access
          if (!existing && !skipAuthForTests) {
            const campaignOwnerCheck =
              (await repository.findCampaignById?.(req.params.campaignId)) ||
              repository.campaigns?.get?.(req.params.campaignId);
            const ownerId = campaignOwnerCheck?.user_id || campaignOwnerCheck?.userId;
            if (ownerId && ownerId !== userId) {
              return res.status(403).json({
                error: "You do not have permission to modify this campaign.",
              });
            }
          }
        } else {
          // If guest, ensure they cannot target/modify saved campaigns in DB
          const campaignInDb =
            (await repository.findCampaignById?.(req.params.campaignId)) ||
            repository.campaigns?.get?.(req.params.campaignId);
          if (campaignInDb) {
            return res.status(403).json({
              error: "Authentication required to modify saved campaigns.",
            });
          }
        }

        const useMock = Boolean(options.mock || req.headers["x-mock-provider"] === "true");
        const tweet = await regenerateSingleTweet(req.params.campaignId, tweetNumber, parsed.data, {
          mock: useMock,
        });

        if (userId) {
          const existing = await repository.getCampaignById(req.params.campaignId, userId);
          if (existing && Array.isArray(existing.tweets)) {
            const updatedTweets = [...existing.tweets];
            const idx =
              updatedTweets.findIndex((t) => t.id === tweet.id) !== -1
                ? updatedTweets.findIndex((t) => t.id === tweet.id)
                : tweetNumber - 1;
            if (idx >= 0 && idx < updatedTweets.length) {
              updatedTweets[idx] = tweet;
              await repository.saveCampaign({
                ...existing,
                id: req.params.campaignId,
                userId,
                tweets: updatedTweets,
                notionUrl: null,
                notionPageId: null,
              });
            }
          } else if (!existing) {
            // Adopt guest campaign into user's account upon regeneration
            await repository.saveCampaign({
              id: req.params.campaignId,
              userId,
              brandName: parsed.data.brandName,
              industry: parsed.data.industry,
              objective: parsed.data.objective,
              productInfo: parsed.data.details,
              tweets: [tweet],
            });
          }
        }

        return res.json(tweet);
      } catch (err) {
        if (err instanceof ConfigurationError) {
          return res.status(err.status).json({ error: err.message });
        }
        if (err instanceof GeminiProviderError) {
          return res.status(err.status).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message });
      }
    },
  );

  // POST /api/campaigns/:campaignId/regenerate (Guest & Authenticated)
  app.post("/api/campaigns/:campaignId/regenerate", tweetAuthMiddleware, async (req, res) => {
    try {
      const parsed = campaignInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid campaign brief provided." });
      }

      const userId = req.user?.id;
      if (userId) {
        const existing = await repository.getCampaignById(req.params.campaignId, userId);
        if (!existing && !skipAuthForTests) {
          const campaignOwnerCheck =
            (await repository.findCampaignById?.(req.params.campaignId)) ||
            repository.campaigns?.get?.(req.params.campaignId);
          const ownerId = campaignOwnerCheck?.user_id || campaignOwnerCheck?.userId;
          if (ownerId && ownerId !== userId) {
            return res.status(403).json({
              error: "You do not have permission to modify this campaign.",
            });
          }
        }
      } else {
        const campaignInDb =
          (await repository.findCampaignById?.(req.params.campaignId)) ||
          repository.campaigns?.get?.(req.params.campaignId);
        if (campaignInDb) {
          return res.status(403).json({
            error: "Authentication required to modify saved campaigns.",
          });
        }
      }

      const useMock = Boolean(options.mock || req.headers["x-mock-provider"] === "true");
      const tweets = await regenerateAllTweets(req.params.campaignId, parsed.data, {
        mock: useMock,
      });

      if (userId) {
        const existing = await repository.getCampaignById(req.params.campaignId, userId);
        if (existing) {
          await repository.saveCampaign({
            ...existing,
            id: req.params.campaignId,
            userId,
            tweets,
            notionUrl: null,
            notionPageId: null,
          });
        } else {
          // Adopt guest campaign into user's account upon full regeneration
          await repository.saveCampaign({
            id: req.params.campaignId,
            userId,
            brandName: parsed.data.brandName,
            industry: parsed.data.industry,
            objective: parsed.data.objective,
            productInfo: parsed.data.details,
            tweets,
          });
        }
      }

      return res.json({ tweets });
    } catch (err) {
      if (err instanceof ConfigurationError) {
        return res.status(err.status).json({ error: err.message });
      }
      if (err instanceof GeminiProviderError) {
        return res.status(err.status).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/campaigns/transfer-guest (Adopt guest campaign into authenticated user's account)
  app.post("/api/campaigns/transfer-guest", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required." });
      }

      const { campaignId, brandName, industry, objective, details, brandVoiceProfile, tweets } =
        req.body || {};
      if (!campaignId) {
        return res.status(400).json({ error: "campaignId is required." });
      }

      // Check if campaign already exists in repository
      const existing =
        (await repository.findCampaignById?.(campaignId)) ||
        repository.campaigns?.get?.(campaignId);

      if (existing) {
        const ownerId = existing.user_id || existing.userId;
        if (ownerId && ownerId !== userId) {
          return res.status(403).json({
            error: "This campaign is associated with another account and cannot be transferred.",
          });
        }
        // Already owned by this user
        return res.json({
          transferred: true,
          alreadyOwned: true,
          campaignId,
        });
      }

      // Save new campaign record under authenticated user
      await repository.saveCampaign({
        id: campaignId,
        userId,
        brandName: brandName || "Brand",
        industry: industry || "",
        objective: objective || "Brand awareness",
        productInfo: details || "",
        brandVoiceProfile: brandVoiceProfile || null,
        tweets: Array.isArray(tweets) ? tweets : [],
      });

      return res.json({
        transferred: true,
        campaignId,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to transfer guest campaign." });
    }
  });

  // POST /api/campaigns/:campaignId/notion-save (Protected & Scoped)
  app.post("/api/campaigns/:campaignId/notion-save", requireAuth, async (req, res) => {
    try {
      const isMock = Boolean(options.mock || req.headers["x-mock-provider"] === "true");
      const userId = req.user?.id || "usr_anonymous";

      const parsed = saveCampaignRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join(", ");
        return res.status(400).json({
          saved: false,
          error: `Invalid campaign payload for Notion save: ${issues}`,
        });
      }

      // Check if user has an active Notion workspace connection
      const connection = await repository.getNotionConnectionByUserId(userId);

      // Protection against duplicate saves where practical
      const existingCampaign = await repository.getCampaignById(req.params.campaignId, userId);
      const existingNotionUrl = existingCampaign?.notion_url || existingCampaign?.notionUrl;
      const existingNotionPageId = existingCampaign?.notion_page_id || existingCampaign?.notionPageId;
      if (existingNotionUrl && !req.body.force) {
        return res.json({
          saved: true,
          url: existingNotionUrl,
          id: existingNotionPageId,
          alreadySaved: true,
          workspaceName: connection?.workspace_name || null,
        });
      }

      // --- Priority 1: Per-User Direct Notion Save ---
      if (connection && connection.status === "active") {
        let decryptedToken;
        try {
          const encKey = options.notionEncryptionKey || config.notion.encryptionKey;
          decryptedToken = decryptToken(connection.encrypted_access_token, encKey);
        } catch (err) {
          return res.status(500).json({
            saved: false,
            error: "Failed to decrypt stored Notion credentials. Please reconnect your workspace.",
          });
        }

        try {
          const pageResult = await createNotionCampaignPage({
            accessToken: decryptedToken,
            campaignId: req.params.campaignId,
            brandName: parsed.data.brand || parsed.data.brandName || "Brand",
            objective: parsed.data.campaignObjective || parsed.data.objective || "Brand awareness",
            industry: parsed.data.industry,
            audience: parsed.data.audience,
            productInfo: parsed.data.productInfo || parsed.data.product,
            brandVoiceProfile: parsed.data.profile || parsed.data.result?.profile,
            tweets: parsed.data.tweets || parsed.data.result?.tweets,
            destinationPageId: connection.destination_page_id,
            fetchImpl: options.fetchImpl || fetch,
            mockResult: isMock
              ? {
                  id: "mock_page_id",
                  url: "https://notion.so/brand-voice/mock-saved-campaign",
                }
              : null,
          });

          await repository.saveCampaign({
            id: req.params.campaignId,
            userId,
            brandName: parsed.data.brand || parsed.data.brandName || "Brand",
            industry: parsed.data.industry,
            objective: parsed.data.campaignObjective || parsed.data.objective || "Brand awareness",
            productInfo: parsed.data.productInfo || parsed.data.product,
            brandVoiceProfile: parsed.data.profile || parsed.data.result?.profile,
            tweets: parsed.data.tweets || parsed.data.result?.tweets,
            notionUrl: pageResult.url,
            notionPageId: pageResult.id,
          });

          return res.json({
            saved: true,
            url: pageResult.url,
            id: pageResult.id,
          });
        } catch (err) {
          if (err instanceof NotionAuthError) {
            await repository.updateNotionStatus(userId, "revoked");
            return res.status(401).json({
              saved: false,
              code: "NOTION_AUTH_EXPIRED",
              error: err.message,
            });
          }
          if (err instanceof NotionDestinationError) {
            return res.status(403).json({
              saved: false,
              code: "NOTION_DESTINATION_INACCESSIBLE",
              error: err.message,
            });
          }
          return res.status(err.status || 500).json({
            saved: false,
            error: err.message || "Failed to save campaign to your Notion workspace.",
          });
        }
      }

      // --- When User Has NOT Connected Notion ---
      // For all real users, we NEVER fall back to the owner's personal Notion integration.
      // Every user must connect their own Notion workspace.
      const isTestMockUser = req.user?.id?.startsWith("usr_test_") || req.user?.id === "usr_mock_test_123";
      const isLegacyWebhookTest = !options.requireAuth && skipAuthForTests && isTestMockUser && !options.requireUserNotion;

      if (!isLegacyWebhookTest) {
        return res.status(400).json({
          saved: false,
          code: "NOTION_NOT_CONNECTED",
          error: "Connect your Notion workspace to save campaigns.",
        });
      }

      // --- Legacy n8n Webhook Fallback ---
      if (!config.isN8nConfigured && !isMock) {
        return res.status(503).json({
          saved: false,
          error: "n8n Notion webhook is not configured. Add N8N_NOTION_WEBHOOK_URL to server/.env.",
        });
      }

      const payload = formatN8nNotionPayload(parsed.data, req.params.campaignId);

      // Mock mode
      if (isMock) {
        const mockUrl = "https://notion.so/brand-voice/mock-saved-campaign";
        await repository.saveCampaign({
          id: payload.campaignId,
          userId,
          brandName: payload.brand || "Fieldwork",
          industry: payload.industry,
          objective: payload.campaignObjective,
          productInfo: payload.productInfo,
          brandVoiceProfile: parsed.data.profile || parsed.data.result?.profile,
          tweets: parsed.data.tweets || parsed.data.result?.tweets,
          notionUrl: mockUrl,
          notionPageId: "mock_page_id",
        });

        return res.json({
          saved: true,
          url: mockUrl,
        });
      }

      // Real HTTP POST to n8n webhook
      const webhookUrl = config.n8nNotionWebhookUrl;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const sanitizedUrl = (() => {
        try {
          const parsedUrl = new URL(webhookUrl);
          return `${parsedUrl.origin}${parsedUrl.pathname}`;
        } catch {
          return webhookUrl.split("?")[0];
        }
      })();

      const payloadFieldNames = Object.keys(payload);
      console.log(
        `[n8n Outgoing] Method: POST | URL: ${sanitizedUrl} | Fields: [${payloadFieldNames.join(", ")}]`,
      );

      let n8nResponse;
      try {
        n8nResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/plain, */*",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          return res.status(504).json({
            saved: false,
            error: "Saving to Notion timed out after 20 seconds. Please check your n8n workflow.",
          });
        }
        return res.status(502).json({
          saved: false,
          error: `Failed to connect to the n8n webhook: ${err.message}`,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      let responseText = "";
      try {
        responseText = await n8nResponse.text();
      } catch (err) {
        responseText = `<error reading response body: ${err.message}>`;
      }

      console.log(`[n8n Incoming] Status: ${n8nResponse.status} | Body: ${responseText}`);

      if (!n8nResponse.ok) {
        let errMessage = `n8n webhook returned status ${n8nResponse.status}`;
        try {
          const parsedErr = JSON.parse(responseText);
          if (parsedErr?.message) {
            errMessage = `n8n workflow error (${n8nResponse.status}): ${parsedErr.message}`;
          } else if (parsedErr?.error) {
            errMessage = `n8n workflow error (${n8nResponse.status}): ${typeof parsedErr.error === "string" ? parsedErr.error : JSON.stringify(parsedErr.error)}`;
          }
        } catch {
          if (responseText && responseText.trim()) {
            errMessage = `n8n webhook error (${n8nResponse.status}): ${responseText.trim().slice(0, 150)}`;
          }
        }
        return res.status(502).json({
          saved: false,
          error: errMessage,
        });
      }

      let responseBody = null;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        return res.status(502).json({
          saved: false,
          error: `n8n webhook returned invalid JSON response: ${responseText.slice(0, 120)}`,
        });
      }

      const pageId =
        responseBody?.id ||
        responseBody?.pageId ||
        (Array.isArray(responseBody) && responseBody[0]?.id) ||
        undefined;

      const notionUrl =
        responseBody?.url ||
        responseBody?.notionUrl ||
        responseBody?.pageUrl ||
        (Array.isArray(responseBody) && responseBody[0]?.url) ||
        (typeof responseBody?.page === "string" ? responseBody.page : responseBody?.page?.url) ||
        undefined;

      if (!pageId && !notionUrl) {
        return res.status(502).json({
          saved: false,
          error: "n8n response did not confirm page creation with a Notion page URL or ID.",
        });
      }

      // Persist saved campaign in repository under authenticated user
      await repository.saveCampaign({
        id: payload.campaignId || pageId,
        userId,
        brandName: payload.brand || "Campaign",
        industry: payload.industry,
        objective: payload.campaignObjective,
        productInfo: payload.productInfo,
        brandVoiceProfile: parsed.data.profile || parsed.data.result?.profile,
        tweets: parsed.data.tweets || parsed.data.result?.tweets,
        notionUrl,
        notionPageId: pageId,
      });

      return res.json({
        saved: true,
        url: notionUrl,
        id: pageId,
      });
    } catch (err) {
      return res.status(500).json({
        saved: false,
        error: err.message || "An unexpected error occurred while saving to Notion.",
      });
    }
  });

  // GET /api/campaigns/history (Protected & Strictly User-Scoped)
  app.get("/api/campaigns/history", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || "usr_anonymous";
      const userCampaigns = await repository.getUserCampaigns(userId);
      return res.json(userCampaigns);
    } catch (err) {
      return res.status(500).json({ error: err.message || "Failed to load campaign history." });
    }
  });

  // 404 Handler
  app.use((_req, res) => {
    res.status(404).json({ error: "Endpoint not found." });
  });

  return app;
}
