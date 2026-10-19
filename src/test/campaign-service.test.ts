import { describe, expect, it } from "vitest";
import {
  campaignInputSchema,
  campaignResultSchema,
  emojiCountOptions,
  emojiUsageOptions,
  getCampaignHistory,
  getTweetCharacterCount,
  saveCampaignToNotion,
  tweetSchema,
} from "@/lib/campaign-service";

const campaignInput = {
  brandName: "Fieldwork",
  industry: "Design",
  objective: "Brand awareness" as const,
  details: "Thoughtful tools for everyday work.",
  audience: "Independent creatives",
  tones: ["Friendly", "Bold"] as const,
  instructions: "Avoid hype.",
  emojiUsage: "No" as const,
  emojiCount: "4 out of 10" as const,
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
    angle: "Conversational",
    tone: "Friendly",
    text: `A considered idea ${index + 1}.`,
  })),
});

describe("campaign service contracts and validations", () => {
  it("requires a non-empty brand name", () => {
    expect(campaignInputSchema.safeParse({ ...campaignInput, brandName: " " }).success).toBe(false);
  });

  it("accepts exactly ten tweets in a generation response", () => {
    expect(campaignResultSchema.safeParse(makeResult(10)).success).toBe(true);
    expect(campaignResultSchema.safeParse(makeResult(9)).success).toBe(false);
    expect(campaignResultSchema.safeParse(makeResult(11)).success).toBe(false);
  });

  it("validates tweet schema with separate angle, tone, and label", () => {
    const validTweet = {
      id: "tweet-1",
      label: "Storytelling",
      angle: "Storytelling",
      tone: "Friendly",
      text: "Crafted tools for creators who value touch and tactile detail.",
    };
    expect(tweetSchema.safeParse(validTweet).success).toBe(true);

    const legacyTweet = {
      id: "tweet-2",
      label: "Promotional",
      text: "Discover our stationery chapter today.",
    };
    expect(tweetSchema.safeParse(legacyTweet).success).toBe(true);
  });
});

describe("tweet character count calculation", () => {
  it("calculates exact length for plain text, spaces, and punctuation", () => {
    const sample = "Thoughtful tools, designed for focused craft.";
    expect(getTweetCharacterCount(sample)).toBe(sample.length);
    expect(getTweetCharacterCount(sample)).toBe(45);
  });

  it("accurately counts hashtags, punctuation, and whitespace", () => {
    const hashtagText = "#BrandVoice #Design: Simple tools -> better focus!";
    expect(getTweetCharacterCount(hashtagText)).toBe(hashtagText.length);
    expect(getTweetCharacterCount(hashtagText)).toBe(50);
  });

  it("accurately counts texts containing emojis", () => {
    const emojiText = "Elevate your daily ritual 🌿✨ with tactile software & stationery ✍️";
    expect(getTweetCharacterCount(emojiText)).toBe(emojiText.length);
    expect(getTweetCharacterCount(emojiText)).toBe(67);
  });

  it("returns 0 for empty or non-string inputs", () => {
    expect(getTweetCharacterCount("")).toBe(0);
    expect(getTweetCharacterCount(null as unknown as string)).toBe(0);
    expect(getTweetCharacterCount(undefined as unknown as string)).toBe(0);
  });

  it("maintains synchronized counts when tweet text changes after regeneration", () => {
    let tweet = {
      id: "tweet-1",
      label: "Conversational",
      text: "Initial tweet copy before regeneration.",
    };
    expect(getTweetCharacterCount(tweet.text)).toBe(39);

    // Simulate single-tweet regeneration
    tweet = {
      ...tweet,
      text: "A refreshed, much sharper perspective on independent design tools. 💡",
    };
    expect(getTweetCharacterCount(tweet.text)).toBe(tweet.text.length);
    expect(getTweetCharacterCount(tweet.text)).toBe(69);
  });
});

describe("emoji preferences schema and defaults", () => {
  it("defaults to 'No' and '4 out of 10' when not explicitly provided", () => {
    const parsed = campaignInputSchema.parse({
      brandName: "Acme",
      objective: "Brand awareness",
    });
    expect(parsed.emojiUsage).toBe("No");
    expect(parsed.emojiCount).toBe("4 out of 10");
  });

  it("accepts all valid emoji usage options ('Yes', 'No')", () => {
    for (const option of emojiUsageOptions) {
      const parsed = campaignInputSchema.safeParse({
        brandName: "Acme",
        objective: "Brand awareness",
        emojiUsage: option,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("accepts all valid emoji count options ('1 out of 10' through 'All 10 tweets')", () => {
    for (const option of emojiCountOptions) {
      const parsed = campaignInputSchema.safeParse({
        brandName: "Acme",
        objective: "Brand awareness",
        emojiCount: option,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("rejects invalid emoji usage or count values", () => {
    expect(
      campaignInputSchema.safeParse({
        brandName: "Acme",
        objective: "Brand awareness",
        emojiUsage: "Random invalid",
      }).success,
    ).toBe(false);

    expect(
      campaignInputSchema.safeParse({
        brandName: "Acme",
        objective: "Brand awareness",
        emojiCount: "5 of 10",
      }).success,
    ).toBe(false);

    expect(
      campaignInputSchema.safeParse({
        brandName: "Acme",
        objective: "Brand awareness",
        emojiCount: "11 out of 10",
      }).success,
    ).toBe(false);
  });
});

describe("tone adherence contracts", () => {
  it("accepts up to 7 valid brand tones", () => {
    const allTones = [
      "Witty",
      "Friendly",
      "Bold",
      "Professional",
      "Playful",
      "Informative",
      "Empathetic",
    ] as const;
    const parsed = campaignInputSchema.safeParse({
      brandName: "Acme",
      objective: "Brand awareness",
      tones: [...allTones],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid tone options", () => {
    const parsed = campaignInputSchema.safeParse({
      brandName: "Acme",
      objective: "Brand awareness",
      tones: ["Sarcastic" as unknown as "Witty"],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("Save to Notion and history service contracts", () => {
  it("saveCampaignToNotion sends structured payload and parses valid Notion save response", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    let requestOptions: RequestInit | undefined;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = input.toString();
      requestOptions = init;
      return new Response(
        JSON.stringify({
          saved: true,
          url: "https://notion.so/brand-voice/test-campaign-page",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    };

    try {
      const sampleResult = makeResult(10);
      const res = await saveCampaignToNotion("camp-test-456", sampleResult, campaignInput);
      expect(res.saved).toBe(true);
      expect(res.url).toBe("https://notion.so/brand-voice/test-campaign-page");
      expect(requestedUrl).toContain("/api/campaigns/camp-test-456/notion-save");
      expect(requestOptions?.method).toBe("POST");

      const body = JSON.parse(requestOptions?.body as string);
      expect(body.brandName).toBe("Fieldwork");
      expect(body.objective).toBe("Brand awareness");
      expect(body.result.tweets.length).toBe(10);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("getCampaignHistory provides clear, actionable error on backend connection failure", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    try {
      await expect(getCampaignHistory()).rejects.toThrow(
        "Unable to connect to the campaign API. Make sure the backend server is running on port 3001.",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
