import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export function getTweetCharacterCount(content: string): number {
  return typeof content === "string" ? content.length : 0;
}

export const emojiUsageOptions = ["Yes", "No"] as const;
export type EmojiUsage = (typeof emojiUsageOptions)[number];

export const emojiCountOptions = [
  "1 out of 10",
  "2 out of 10",
  "3 out of 10",
  "4 out of 10",
  "5 out of 10",
  "6 out of 10",
  "7 out of 10",
  "8 out of 10",
  "9 out of 10",
  "All 10 tweets",
] as const;
export type EmojiCount = (typeof emojiCountOptions)[number];

export const campaignInputSchema = z.object({
  brandName: z.string().trim().min(1, "Add a brand name to continue.").max(100),
  industry: text(100).default(""),
  objective: z.enum([
    "Brand awareness",
    "Product launch",
    "Engagement",
    "Community building",
    "Education",
    "Traffic",
  ]),
  details: text(1500).default(""),
  audience: text(160).default(""),
  tones: z
    .array(
      z.enum(["Witty", "Friendly", "Bold", "Professional", "Playful", "Informative", "Empathetic"]),
    )
    .max(7)
    .default([]),
  instructions: text(1000).default(""),
  emojiUsage: z.enum(emojiUsageOptions).default("No"),
  emojiCount: z.enum(emojiCountOptions).default("4 out of 10"),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const tweetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(60),
  angle: z.string().min(1).max(60).optional(),
  tone: z.string().min(1).max(60).optional(),
  text: z.string().trim().min(1).max(1000),
});

export const campaignResultSchema = z.object({
  campaignId: z.string().min(1),
  profile: z.object({
    summary: z.string().min(1),
    audience: z.string().min(1),
    themes: z.array(z.string().min(1)).min(1),
    characteristics: z.array(z.string().min(1)).min(1),
    inferredFields: z.array(z.enum(["summary", "audience", "themes", "characteristics"])),
  }),
  tweets: z.array(tweetSchema).length(10, "The campaign service must return exactly 10 tweets."),
});

export type CampaignResult = z.infer<typeof campaignResultSchema>;
export type Tweet = CampaignResult["tweets"][number];
export const campaignHistorySchema = z.array(
  z.object({
    id: z.string().min(1),
    brandName: z.string().min(1),
    objective: z.string().min(1),
    createdAt: z.string().optional(),
    url: z
      .string()
      .url()
      .nullish()
      .transform((v) => v || undefined),
  }),
);
export type CampaignHistoryItem = z.infer<typeof campaignHistorySchema>[number];

export function hasCampaignApi() {
  return Boolean(import.meta.env["VITE_API_BASE_URL"]?.trim());
}

export class IntegrationPendingError extends Error {
  constructor(
    message = "Campaign generation is not connected yet. Add the deployed Express API address to VITE_API_BASE_URL to enable it.",
  ) {
    super(message);
    this.name = "IntegrationPendingError";
  }
}

function apiUrl(path: string) {
  const envBase = import.meta.env["VITE_API_BASE_URL"]?.trim();
  const base = envBase !== undefined ? envBase : (import.meta.env.DEV ? "http://localhost:3001" : "");
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

function extractErrorMessage(detail: string, status: number): string {
  if (!detail) return `The campaign service returned an error (${status}).`;
  try {
    const parsed = JSON.parse(detail) as {
      error?: string | { message?: string };
      message?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error && typeof parsed.error.message === "string") return parsed.error.message;
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // raw text response
  }
  return detail;
}

export class AuthRequiredError extends Error {
  constructor(message = "Authentication required. Please sign in with Google to continue.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class NotionNotConnectedError extends Error {
  constructor(message = "Connect your Notion workspace to save campaigns.") {
    super(message);
    this.name = "NotionNotConnectedError";
  }
}

async function request<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 401) {
      throw new AuthRequiredError(extractErrorMessage(detail, 401));
    }
    try {
      const parsed = JSON.parse(detail) as { code?: string; error?: string };
      if (parsed.code === "NOTION_NOT_CONNECTED") {
        throw new NotionNotConnectedError(
          parsed.error || "Connect your Notion workspace to save campaigns.",
        );
      }
    } catch (err) {
      if (err instanceof NotionNotConnectedError) throw err;
    }
    throw new Error(extractErrorMessage(detail, response.status));
  }
  const payload: unknown = await response.json();
  return schema.parse(payload);
}

export async function generateCampaign(input: CampaignInput) {
  const validated = campaignInputSchema.parse(input);
  return request("/api/campaigns/generate", validated, campaignResultSchema);
}

export async function regenerateTweet(
  campaignId: string,
  tweetNumber: number,
  input: CampaignInput,
) {
  return request(
    `/api/campaigns/${encodeURIComponent(campaignId)}/tweets/${tweetNumber}/regenerate`,
    { ...campaignInputSchema.parse(input), tweetNumber },
    tweetSchema,
  );
}

export async function regenerateCampaign(campaignId: string, input: CampaignInput) {
  const regenerated = await request(
    `/api/campaigns/${encodeURIComponent(campaignId)}/regenerate`,
    campaignInputSchema.parse(input),
    z.object({ tweets: campaignResultSchema.shape.tweets }),
  );
  return regenerated.tweets;
}

export async function saveCampaignToNotion(
  campaignId: string,
  result: CampaignResult,
  input?: CampaignInput,
) {
  const schema = z.object({
    saved: z.literal(true),
    url: z
      .string()
      .url()
      .nullish()
      .transform((v) => v || undefined),
    id: z
      .string()
      .nullish()
      .transform((v) => v || undefined),
    alreadySaved: z.boolean().optional(),
  });
  const payload = {
    ...result,
    ...(input || {}),
    result,
    input,
  };
  return request(`/api/campaigns/${encodeURIComponent(campaignId)}/notion-save`, payload, schema);
}

export async function transferGuestCampaign(
  campaignId: string,
  result: CampaignResult,
  input?: CampaignInput,
) {
  const schema = z.object({
    transferred: z.literal(true),
    alreadyOwned: z.boolean().optional(),
    campaignId: z.string(),
  });
  const payload = {
    campaignId,
    brandName: input?.brandName,
    industry: input?.industry,
    objective: input?.objective,
    details: input?.details,
    brandVoiceProfile: result.profile,
    tweets: result.tweets,
  };
  return request("/api/campaigns/transfer-guest", payload, schema);
}


export async function getCampaignHistory(): Promise<CampaignHistoryItem[]> {
  try {
    const response = await fetch(apiUrl("/api/campaigns/history"), {
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!response.ok) {
      if (response.status === 401) {
        return []; // Unauthenticated user has an empty history until signed in
      }
      const detail = await response.text();
      throw new Error(extractErrorMessage(detail, response.status));
    }
    const payload: unknown = await response.json();
    return campaignHistorySchema.parse(payload);
  } catch (reason) {
    if (reason instanceof AuthRequiredError) {
      return [];
    }
    if (
      reason instanceof TypeError &&
      (reason.message.includes("fetch") ||
        reason.message.includes("NetworkError") ||
        reason.message.includes("Failed"))
    ) {
      throw new Error(
        "Unable to connect to the campaign API. Make sure the backend server is running on port 3001.",
      );
    }
    throw reason;
  }
}
