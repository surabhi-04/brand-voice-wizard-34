import { describe, expect, it } from "vitest";
import { campaignInputSchema, campaignResultSchema } from "@/lib/campaign-service";

const campaignInput = {
  brandName: "Fieldwork",
  industry: "Design",
  objective: "Brand awareness" as const,
  details: "Thoughtful tools for everyday work.",
  audience: "Independent creatives",
  tones: ["Friendly", "Witty"] as const,
  instructions: "Avoid hype.",
};

const makeResult = (count: number) => ({
  campaignId: "campaign-001",
  profile: {
    summary: "Warm and direct.",
    audience: "Design-minded teams.",
    themes: ["Craft"],
    characteristics: ["Conversational"],
    inferredFields: ["summary", "audience", "themes", "characteristics"] as const,
  },
  tweets: Array.from({ length: count }, (_, index) => ({
    id: `tweet-${index + 1}`,
    label: "Conversational",
    text: `A considered idea ${index + 1}.`,
  })),
});

describe("campaign service contracts", () => {
  it("requires a non-empty brand name", () => {
    expect(campaignInputSchema.safeParse({ ...campaignInput, brandName: " " }).success).toBe(false);
  });

  it("accepts exactly ten tweets in a generation response", () => {
    expect(campaignResultSchema.safeParse(makeResult(10)).success).toBe(true);
    expect(campaignResultSchema.safeParse(makeResult(9)).success).toBe(false);
    expect(campaignResultSchema.safeParse(makeResult(11)).success).toBe(false);
  });
});