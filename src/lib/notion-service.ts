import { z } from "zod";

function getApiUrl(path: string): string {
  const envBase = import.meta.env["VITE_API_BASE_URL"]?.trim();
  const base = envBase !== undefined ? envBase : (import.meta.env.DEV ? "http://localhost:3001" : "");
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

export const notionStatusSchema = z.object({
  connected: z.boolean(),
  workspaceId: z.string().nullable().optional(),
  workspaceName: z.string().nullable().optional(),
  workspaceIcon: z.string().nullable().optional(),
  destination: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  isConfigured: z.boolean().default(true),
});

export type NotionStatus = z.infer<typeof notionStatusSchema>;

export const notionDestinationItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().nullable().optional(),
  url: z.string().optional(),
});

export type NotionDestinationItem = z.infer<typeof notionDestinationItemSchema>;

export const notionDestinationsResponseSchema = z.object({
  destinations: z.array(notionDestinationItemSchema),
  currentDestinationId: z.string().nullable().optional(),
  currentDestinationName: z.string().nullable().optional(),
});

export type NotionDestinationsResponse = z.infer<typeof notionDestinationsResponseSchema>;

export class NotionServiceError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "NotionServiceError";
    this.code = code;
  }
}

function extractErrorMessage(detail: string, status: number): { message: string; code?: string } {
  if (!detail) return { message: `Notion service returned an error (${status}).` };
  try {
    const parsed = JSON.parse(detail) as {
      error?: string | { message?: string };
      message?: string;
      code?: string;
    };
    const message =
      (typeof parsed.error === "string" ? parsed.error : undefined) ||
      (parsed.error && typeof parsed.error.message === "string" ? parsed.error.message : undefined) ||
      (typeof parsed.message === "string" ? parsed.message : undefined) ||
      detail;
    return { message, code: parsed.code };
  } catch {
    return { message: detail };
  }
}

/**
 * Check if the currently authenticated user has connected their Notion workspace.
 */
export async function getNotionStatus(): Promise<NotionStatus> {
  try {
    const res = await fetch(getApiUrl("/api/notion/status"), {
      headers: { Accept: "application/json" },
      credentials: "include",
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { connected: false, isConfigured: true };
      }
      const detail = await res.text();
      const { message, code } = extractErrorMessage(detail, res.status);
      throw new NotionServiceError(message, code);
    }

    const data: unknown = await res.json();
    return notionStatusSchema.parse(data);
  } catch (err) {
    if (err instanceof NotionServiceError) throw err;
    return { connected: false, isConfigured: false };
  }
}

/**
 * Get the Notion OAuth authorization URL to initiate connecting the user's workspace.
 */
export async function getNotionAuthorizeUrl(redirectUrl?: string): Promise<{ url: string }> {
  const query = redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : "";
  const res = await fetch(getApiUrl(`/api/notion/oauth/authorize${query}`), {
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    const detail = await res.text();
    const { message, code } = extractErrorMessage(detail, res.status);
    throw new NotionServiceError(message, code);
  }

  const data = (await res.json()) as { url: string };
  return data;
}

/**
 * Disconnect the authenticated user's Notion workspace.
 */
export async function disconnectNotion(): Promise<{ success: boolean }> {
  const res = await fetch(getApiUrl("/api/notion/disconnect"), {
    method: "POST",
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    const detail = await res.text();
    const { message, code } = extractErrorMessage(detail, res.status);
    throw new NotionServiceError(message, code);
  }

  return { success: true };
}

/**
 * List accessible destination pages in the user's Notion workspace.
 */
export async function getNotionDestinations(): Promise<NotionDestinationsResponse> {
  const res = await fetch(getApiUrl("/api/notion/destinations"), {
    headers: { Accept: "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    const detail = await res.text();
    const { message, code } = extractErrorMessage(detail, res.status);
    throw new NotionServiceError(message, code);
  }

  const data: unknown = await res.json();
  return notionDestinationsResponseSchema.parse(data);
}

/**
 * Update the user's chosen destination page in their Notion workspace.
 */
export async function setNotionDestination(
  destinationPageId: string,
  destinationPageName: string,
): Promise<{ success: boolean; destination: { id: string; name: string } }> {
  const res = await fetch(getApiUrl("/api/notion/destination"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "include",
    body: JSON.stringify({ destinationPageId, destinationPageName }),
  });

  if (!res.ok) {
    const detail = await res.text();
    const { message, code } = extractErrorMessage(detail, res.status);
    throw new NotionServiceError(message, code);
  }

  return (await res.json()) as { success: boolean; destination: { id: string; name: string } };
}
