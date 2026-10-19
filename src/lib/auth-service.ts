import { z } from "zod";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  profilePicture?: string | null;
}

export interface AuthConfig {
  googleClientId: string | null;
  isGoogleConfigured: boolean;
  isJwtConfigured: boolean;
  isDbConfigured: boolean;
}

const authUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  profilePicture: z
    .string()
    .nullish()
    .transform((v) => v || undefined),
});

function apiUrl(path: string) {
  const envBase = import.meta.env["VITE_API_BASE_URL"]?.trim();
  const base = envBase !== undefined ? envBase : (import.meta.env.DEV ? "http://localhost:3001" : "");
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

export async function getAuthConfig(): Promise<AuthConfig> {
  try {
    const res = await fetch(apiUrl("/api/auth/config"), {
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!res.ok) {
      return {
        googleClientId: import.meta.env["VITE_GOOGLE_CLIENT_ID"] || null,
        isGoogleConfigured: Boolean(import.meta.env["VITE_GOOGLE_CLIENT_ID"]),
        isJwtConfigured: false,
        isDbConfigured: false,
      };
    }
    const data = await res.json();
    return {
      googleClientId: data.googleClientId || import.meta.env["VITE_GOOGLE_CLIENT_ID"] || null,
      isGoogleConfigured: Boolean(
        data.isGoogleConfigured || import.meta.env["VITE_GOOGLE_CLIENT_ID"],
      ),
      isJwtConfigured: Boolean(data.isJwtConfigured),
      isDbConfigured: Boolean(data.isDbConfigured),
    };
  } catch {
    return {
      googleClientId: import.meta.env["VITE_GOOGLE_CLIENT_ID"] || null,
      isGoogleConfigured: Boolean(import.meta.env["VITE_GOOGLE_CLIENT_ID"]),
      isJwtConfigured: false,
      isDbConfigured: false,
    };
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (!data?.user) return null;
    return authUserSchema.parse(data.user);
  } catch {
    return null;
  }
}

export async function signInWithGoogle(
  credentialOrTokens: string | { idToken?: string; accessToken?: string },
): Promise<AuthUser> {
  const payload =
    typeof credentialOrTokens === "string"
      ? { idToken: credentialOrTokens }
      : credentialOrTokens;

  let res: Response;
  try {
    res = await fetch(apiUrl("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch (reason) {
    if (
      reason instanceof TypeError &&
      (reason.message.includes("fetch") ||
        reason.message.includes("NetworkError") ||
        reason.message.includes("Failed"))
    ) {
      throw new Error(
        "Unable to connect to the authentication server. Make sure the backend server is running on port 3001.",
      );
    }
    throw reason;
  }

  if (!res.ok) {
    const detail = await res.text();
    let message = `Authentication failed (${res.status})`;
    try {
      const parsed = JSON.parse(detail);
      if (parsed.error) message = parsed.error;
    } catch {
      if (detail.trim()) message = detail.trim();
    }
    throw new Error(message);
  }

  const data = await res.json();
  return authUserSchema.parse(data.user);
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
  } catch {
    // Ignore network error on logout
  }
}
