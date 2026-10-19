import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

export const SESSION_COOKIE_NAME = "bv_session";
export const JWT_ISSUER = "brand-voice-ai";
export const JWT_AUDIENCE = "brand-voice-ai-app";
export const JWT_EXPIRY = "24h";

export class AuthError extends Error {
  constructor(message, status = 401, code = "UNAUTHORIZED") {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Verifies a Google ID token received from Google Identity Services.
 * Enforces audience verification against the configured Google Client ID.
 */
export async function verifyGoogleIdToken(idToken, googleClientId) {
  if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
    throw new AuthError("Google ID token is required.", 400, "MISSING_TOKEN");
  }

  if (!googleClientId || googleClientId === "your_google_client_id") {
    throw new AuthError(
      "Google Client ID is not configured on the server. Set GOOGLE_CLIENT_ID in server/.env.",
      503,
      "CONFIG_ERROR",
    );
  }

  try {
    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({
      idToken: idToken.trim(),
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new AuthError("Invalid Google ID token payload.", 401, "INVALID_TOKEN");
    }

    return {
      googleId: payload.sub,
      email: payload.email || "",
      name: payload.name || payload.email?.split("@")[0] || "Brand Voice User",
      profilePicture: payload.picture || null,
      emailVerified: Boolean(payload.email_verified),
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError(
      `Google token verification failed: ${err.message}`,
      401,
      "VERIFICATION_FAILED",
    );
  }
}

/**
 * Verifies a Google OAuth 2.0 access token by querying Google's userinfo endpoint.
 */
export async function verifyGoogleAccessToken(accessToken) {
  if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
    throw new AuthError("Google access token is required.", 400, "MISSING_TOKEN");
  }

  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken.trim()}` },
    });

    if (!res.ok) {
      throw new AuthError("Google access token verification failed.", 401, "INVALID_TOKEN");
    }

    const payload = await res.json();
    if (!payload || !payload.sub) {
      throw new AuthError("Invalid Google user payload.", 401, "INVALID_TOKEN");
    }

    return {
      googleId: payload.sub,
      email: payload.email || "",
      name: payload.name || payload.email?.split("@")[0] || "Brand Voice User",
      profilePicture: payload.picture || null,
      emailVerified: Boolean(payload.email_verified),
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError(
      `Google token verification failed: ${err.message}`,
      401,
      "VERIFICATION_FAILED",
    );
  }
}

/**
 * Generates an application-issued JWT session token for an authenticated user.
 */
export function generateSessionToken(user, jwtSecret) {
  if (!jwtSecret || jwtSecret === "replace_with_a_long_random_secret") {
    throw new AuthError(
      "JWT secret is not configured on the server. Set JWT_SECRET in server/.env.",
      503,
      "CONFIG_ERROR",
    );
  }

  return jwt.sign(
    {
      sub: user.id,
      googleId: user.google_id || user.googleId,
      email: user.email,
      name: user.name,
      picture: user.profile_picture || user.profilePicture || null,
    },
    jwtSecret,
    {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: JWT_EXPIRY,
    },
  );
}

/**
 * Verifies the signature, expiry, issuer, and audience of an application session token.
 */
export function verifySessionToken(token, jwtSecret) {
  if (!jwtSecret) {
    throw new AuthError("JWT secret is not configured.", 503, "CONFIG_ERROR");
  }

  try {
    return jwt.verify(token, jwtSecret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AuthError(
        "Your session has expired. Please sign in again.",
        401,
        "SESSION_EXPIRED",
      );
    }
    throw new AuthError("Invalid authentication session.", 401, "INVALID_SESSION");
  }
}

/**
 * Sets the secure HttpOnly cookie on the response.
 */
export function setSessionCookie(res, token) {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
}

/**
 * Clears the session cookie on the response.
 */
export function clearSessionCookie(res) {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Authentication middleware that enforces user authentication on protected routes.
 */
export function createAuthMiddleware({ jwtSecret, repository, skipAuthForTests = false }) {
  return async function requireAuth(req, res, next) {
    // In test or development mock mode where skipAuthForTests is explicitly enabled
    if (skipAuthForTests) {
      req.user = {
        id: "usr_mock_test_123",
        google_id: "google_mock_sub_123",
        name: "Test Designer",
        email: "designer@fieldwork.test",
        profile_picture: null,
      };
      return next();
    }

    const token =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7).trim()
        : null);

    if (!token) {
      return res.status(401).json({
        error: "Authentication required. Please sign in with Google to continue.",
        code: "UNAUTHORIZED",
      });
    }

    try {
      const payload = verifySessionToken(token, jwtSecret);
      const user = await repository.findUserById(payload.sub);
      if (!user) {
        return res.status(401).json({
          error: "User account not found. Please sign in again.",
          code: "USER_NOT_FOUND",
        });
      }

      req.user = user;
      next();
    } catch (err) {
      if (err instanceof AuthError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
      }
      return res.status(401).json({ error: "Invalid session token.", code: "UNAUTHORIZED" });
    }
  };
}

/**
 * Optional authentication middleware: attaches user if a valid session exists,
 * but allows unauthenticated visitors (guests) to proceed with req.user = null.
 */
export function createOptionalAuthMiddleware({ jwtSecret, repository, skipAuthForTests = false }) {
  return async function optionalAuth(req, _res, next) {
    if (skipAuthForTests) {
      if (req.headers["x-test-guest"] === "true") {
        req.user = null;
        return next();
      }
      req.user = {
        id: "usr_mock_test_123",
        google_id: "google_mock_sub_123",
        name: "Test Designer",
        email: "designer@fieldwork.test",
        profile_picture: null,
      };
      return next();
    }

    const token =
      req.cookies?.[SESSION_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7).trim()
        : null);

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const payload = verifySessionToken(token, jwtSecret);
      const user = await repository.findUserById(payload.sub);
      req.user = user || null;
    } catch {
      req.user = null;
    }

    return next();
  };
}
