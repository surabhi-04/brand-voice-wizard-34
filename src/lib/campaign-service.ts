import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export const campaignInputSchema = z.object({
  brandName: z.string().trim().min(1, "Add a brand name to continue.").max(100),
  industry: text(100),
  objective: z.enum([
    "Brand awareness",
    "Product launch",
    "Engagement",
    "Community building",
    "Education",
    "Traffic",
  ]),
  details: text(1500),
  audience: text(160),
  tones: z.array(z.enum(["Witty", "Friendly", "Bold", "Professional", "Playful", "Informative", "Empathetic"])).max(7),
  instructions: text(1000),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const tweetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(40),
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
    url: z.string().url().optional(),
  }),
);
export type CampaignHistoryItem = z.infer<typeof campaignHistorySchema>[number];

export function hasCampaignApi() {
  return Boolean(import.meta.env["VITE_API_BASE_URL"]?.trim());
}

export class IntegrationPendingError extends Error {
  constructor(message = "Campaign generation is not connected yet. Add the deployed Express API address to VITE_API_BASE_URL to enable it.") {
    super(message);
    this.name = "IntegrationPendingError";
  }
}

function apiUrl(path: string) {
  const base = import.meta.env["VITE_API_BASE_URL"]?.trim();
  if (!base) throw new IntegrationPendingError();
  return `${base.replace(/\/$/, "")}${path}`;
}

async function request<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `The campaign service returned an error (${response.status}).`);
  }
  const payload: unknown = await response.json();
  return schema.parse(payload);
}

export async function generateCampaign(input: CampaignInput) {
  const validated = campaignInputSchema.parse(input);
  return request("/api/campaigns/generate", validated, campaignResultSchema);
}

export async function regenerateTweet(campaignId: string, tweetNumber: number, input: CampaignInput) {
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

export async function saveCampaignToNotion(campaignId: string, result: CampaignResult) {
  const schema = z.object({ saved: z.literal(true), url: z.string().url().optional() });
  return request(`/api/campaigns/${encodeURIComponent(campaignId)}/notion-save`, result, schema);
}

export async function getCampaignHistory(): Promise<CampaignHistoryItem[]> {
  const response = await fetch(apiUrl("/api/campaigns/history"), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Campaign history could not be loaded (${response.status}).`);
  }
  const payload: unknown = await response.json();
  return campaignHistorySchema.parse(payload);
}