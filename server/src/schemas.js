import { z } from "zod";

const text = (max) => z.string().trim().max(max);

export const emojiUsageOptions = ["Yes", "No"];

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
];

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
  emojiUsage: z
    .enum(["Yes", "No", "No emojis", "A few emojis", "Use emojis naturally", "Use more emojis"])
    .default("No"),
  emojiCount: z
    .enum([
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
      "None (0 of 10)",
      "2 of 10",
      "4 of 10",
      "6 of 10",
      "8 of 10",
      "All 10",
    ])
    .default("4 out of 10"),
});

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

export const saveCampaignRequestSchema = z.object({
  campaignId: z.string().optional(),
  brand: z.string().optional(),
  brandName: z.string().optional(),
  industry: z.string().optional().default(""),
  campaignObjective: z.string().optional(),
  objective: z.string().optional(),
  details: z.string().optional().default(""),
  product: z.string().optional().default(""),
  productInfo: z.string().optional().default(""),
  offer: z.string().optional().default(""),
  audience: z.string().optional().default(""),
  tones: z.array(z.string()).optional().default([]),
  preferredTones: z.union([z.array(z.string()), z.string()]).optional(),
  instructions: z.string().optional().default(""),
  additionalContext: z.string().optional().default(""),
  emojiUsage: z.string().optional().default("No"),
  includeEmojis: z.union([z.boolean(), z.string()]).optional(),
  emojiCount: z.union([z.number(), z.string()]).optional().default("4 out of 10"),
  profile: campaignResultSchema.shape.profile.optional(),
  tweets: campaignResultSchema.shape.tweets.optional(),
  result: campaignResultSchema.optional(),
  input: campaignInputSchema.optional(),
});
