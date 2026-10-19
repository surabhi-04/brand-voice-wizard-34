import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM

/**
 * Derives a 32-byte Buffer key from a secret string.
 * If the key is a 64-character hex string, it parses it directly.
 * Otherwise, it uses SHA-256 to derive a deterministic 32-byte key.
 */
export function deriveKey(secret) {
  if (!secret || typeof secret !== "string") {
    throw new Error("Encryption key is required and must be a non-empty string.");
  }
  const trimmed = secret.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  return crypto.createHash("sha256").update(trimmed).digest();
}

/**
 * Encrypts a sensitive plaintext string using AES-256-GCM authenticated encryption.
 * Output format: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function encryptToken(plainText, secret) {
  if (!plainText || typeof plainText !== "string") {
    throw new Error("Plaintext must be a non-empty string.");
  }
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Enforces authentication tag validation to detect any tampering at rest.
 */
export function decryptToken(encryptedString, secret) {
  if (!encryptedString || typeof encryptedString !== "string") {
    throw new Error("Encrypted payload must be a non-empty string.");
  }
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format. Expected iv:authTag:ciphertext.");
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = deriveKey(secret);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generates a signed, tamper-proof OAuth state token bound to the authenticated user ID.
 * Prevents account-linking CSRF attacks by binding the initiating user to the callback.
 */
export function generateOAuthState({ userId, jwtSecret, redirectUrl }) {
  if (!userId) {
    throw new Error("User ID is required to generate OAuth state.");
  }
  if (!jwtSecret) {
    throw new Error("JWT secret is required to sign OAuth state.");
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    {
      sub: userId,
      nonce,
      purpose: "notion_oauth",
      redirectUrl: redirectUrl || null,
    },
    jwtSecret,
    {
      expiresIn: "15m",
      issuer: "brand-voice-ai",
      audience: "brand-voice-ai-notion-oauth",
    },
  );
}

/**
 * Verifies and decodes an OAuth state token.
 * Rejects expired, tampered, or wrong-audience state tokens.
 */
export function verifyOAuthState(stateToken, jwtSecret) {
  if (!stateToken || typeof stateToken !== "string") {
    throw new Error("OAuth state token is required.");
  }
  if (!jwtSecret) {
    throw new Error("JWT secret is required.");
  }

  try {
    const payload = jwt.verify(stateToken, jwtSecret, {
      issuer: "brand-voice-ai",
      audience: "brand-voice-ai-notion-oauth",
    });

    if (payload.purpose !== "notion_oauth" || !payload.sub) {
      throw new Error("Invalid OAuth state payload.");
    }

    return {
      userId: payload.sub,
      redirectUrl: payload.redirectUrl,
    };
  } catch (err) {
    throw new Error(`Invalid or expired OAuth state: ${err.message}`);
  }
}
