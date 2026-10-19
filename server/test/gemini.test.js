import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createApp, formatN8nNotionPayload } from "../src/app.js";
import { validateEnvironment } from "../src/config.js";
import { countEmojisInText, parseEmojiCountTarget, sanitizeCampaignTweets } from "../src/gemini.js";
import { closeDatabasePool } from "../src/db.js";

// Helper to make mock HTTP requests to the Express app
async function request(app, method, path, body = null, headers = {}) {
  const server = app.listen(0);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}${path}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : null,
    });
    const status = res.status;
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status, data };
  } finally {
    server.close();
  }
}

const sampleBrief = {
  brandName: "Fieldwork",
  industry: "Independent design tools",
  objective: "Brand awareness",
  details: "Thoughtful tactile stationery and software for creators.",
  audience: "Independent designers and architects",
  tones: ["Witty", "Friendly"],
  instructions: "Avoid tech buzzwords and hype.",
};

describe("Backend Environment & Gemini API Integration", () => {
  it("validates environment variables at startup without revealing secret values", () => {
    const result = validateEnvironment();
    assert.ok(typeof result.isGeminiConfigured === "boolean");
    assert.ok(typeof result.port === "number");
    assert.ok(typeof result.geminiModel === "string");
  });

  it("GET /api/health returns server status and configuration flags", async () => {
    const app = createApp({ mock: true });
    const { status, data } = await request(app, "GET", "/api/health");
    assert.equal(status, 200);
    assert.equal(data.status, "ok");
    assert.ok("geminiConfigured" in data);
    assert.ok("geminiModel" in data);
  });

  it("POST /api/campaigns/generate validates input and rejects missing brand name", async () => {
    const app = createApp({ mock: true });
    const { status, data } = await request(app, "POST", "/api/campaigns/generate", {
      ...sampleBrief,
      brandName: "",
    });
    assert.equal(status, 400);
    assert.ok(data.error.includes("Validation error"));
  });

  it("POST /api/campaigns/generate returns 503 when API key is unconfigured (without mock)", async () => {
    // When live mode is used without valid GEMINI_API_KEY, must return 503 configuration error
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const app = createApp({ mock: false });
      const { status, data } = await request(app, "POST", "/api/campaigns/generate", sampleBrief);
      assert.equal(status, 503);
      assert.ok(data.error.includes("Gemini API key is not configured"));
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it("POST /api/campaigns/generate produces exactly 10 tweets and brand profile with mock provider", async () => {
    const app = createApp({ mock: true });
    const { status, data } = await request(app, "POST", "/api/campaigns/generate", sampleBrief);
    assert.equal(status, 200);

    // Profile verification
    assert.ok(data.campaignId);
    assert.ok(data.profile.summary.length > 0);
    assert.ok(data.profile.audience.length > 0);
    assert.ok(Array.isArray(data.profile.themes));
    assert.ok(Array.isArray(data.profile.characteristics));
    assert.ok(Array.isArray(data.profile.inferredFields));

    // Exactly 10 tweets
    assert.equal(data.tweets.length, 10, "Must return exactly 10 tweets");

    // Each tweet must have id, label, and text
    const labels = new Set();
    data.tweets.forEach((tweet, index) => {
      assert.ok(tweet.id, `Tweet ${index + 1} must have an id`);
      assert.ok(tweet.label, `Tweet ${index + 1} must have a label`);
      assert.ok(tweet.text, `Tweet ${index + 1} must have text`);
      assert.ok(tweet.text.length <= 280, `Tweet ${index + 1} text should be under 280 characters`);
      labels.add(tweet.label);
    });

    // Diverse styling angles
    assert.ok(labels.size >= 3, "Tweets should feature diverse content angles");
  });

  it("POST /api/campaigns/:id/tweets/:tweetNumber/regenerate replaces a single tweet", async () => {
    const app = createApp({ mock: true });
    const { status, data } = await request(
      app,
      "POST",
      "/api/campaigns/camp_123/tweets/3/regenerate",
      sampleBrief,
    );
    assert.equal(status, 200);
    assert.equal(data.id, "tweet-3");
    assert.ok(data.label);
    assert.ok(data.text);
  });

  it("POST /api/campaigns/:id/regenerate returns 10 fresh tweets", async () => {
    const app = createApp({ mock: true });
    const { status, data } = await request(
      app,
      "POST",
      "/api/campaigns/camp_123/regenerate",
      sampleBrief,
    );
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.tweets));
    assert.equal(data.tweets.length, 10);
  });

  it("GET /api/campaigns/history returns truthful empty array", async () => {
    const app = createApp({ mock: true });
    const { status, data } = await request(app, "GET", "/api/campaigns/history");
    assert.equal(status, 200);
    assert.deepEqual(data, []);
  });

  it("adheres strictly to user preferred tones and never labels with unselected tones", async () => {
    const app = createApp({ mock: true });
    const briefWithTones = {
      ...sampleBrief,
      tones: ["Friendly", "Bold"],
    };
    const { status, data } = await request(app, "POST", "/api/campaigns/generate", briefWithTones);
    assert.equal(status, 200);

    data.tweets.forEach((tweet, i) => {
      assert.ok(
        ["Friendly", "Bold"].includes(tweet.tone),
        `Tweet ${i + 1} tone must be Friendly or Bold, got: ${tweet.tone}`,
      );
      assert.notEqual(
        tweet.label,
        "Witty",
        `Tweet ${i + 1} label must not be unselected tone Witty`,
      );
      assert.notEqual(tweet.tone, "Witty", `Tweet ${i + 1} tone must not be unselected tone Witty`);
      assert.ok(tweet.angle, `Tweet ${i + 1} must have a content angle`);
    });
  });

  it("generates exactly 0 emojis when user selects 'No emojis'", async () => {
    const app = createApp({ mock: true });
    const briefNoEmojis = {
      ...sampleBrief,
      emojiUsage: "No emojis",
      emojiCount: "None (0 of 10)",
    };
    const { status, data } = await request(app, "POST", "/api/campaigns/generate", briefNoEmojis);
    assert.equal(status, 200);
    const emojiRegex =
      /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F926}-\u{1F939}\u{1F1E6}-\u{1F1FF}]/u;
    data.tweets.forEach((tweet, i) => {
      assert.equal(emojiRegex.test(tweet.text), false, `Tweet ${i + 1} should have no emojis`);
    });
  });

  it("respects emoji distribution count (e.g. 4 of 10 tweets)", async () => {
    const app = createApp({ mock: true });
    const briefWithEmojis = {
      ...sampleBrief,
      emojiUsage: "Use emojis naturally",
      emojiCount: "4 of 10",
    };
    const { status, data } = await request(app, "POST", "/api/campaigns/generate", briefWithEmojis);
    assert.equal(status, 200);
    const emojiRegex =
      /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F926}-\u{1F939}\u{1F1E6}-\u{1F1FF}]/u;
    const tweetsWithEmoji = data.tweets.filter((t) => emojiRegex.test(t.text));
    assert.equal(
      tweetsWithEmoji.length,
      4,
      `Expected exactly 4 of 10 tweets to contain emojis, got ${tweetsWithEmoji.length}`,
    );
  });

  it("regenerates a single tweet without emojis when requested count is zero and respects tones", async () => {
    const app = createApp({ mock: true });
    const briefNoEmojis = {
      ...sampleBrief,
      tones: ["Friendly", "Bold"],
      emojiUsage: "No emojis",
      emojiCount: "None (0 of 10)",
    };
    const { status, data } = await request(
      app,
      "POST",
      "/api/campaigns/camp_123/tweets/2/regenerate",
      briefNoEmojis,
    );
    assert.equal(status, 200);
    const emojiRegex =
      /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F926}-\u{1F939}\u{1F1E6}-\u{1F1FF}]/u;
    assert.equal(
      emojiRegex.test(data.text),
      false,
      "Regenerated tweet must not contain emojis when No emojis selected",
    );
    assert.ok(
      ["Friendly", "Bold"].includes(data.tone),
      "Regenerated tweet must obey selected tones",
    );
    assert.notEqual(data.label, "Witty", "Regenerated tweet label must not be an unselected tone");
  });

  it("handles exact frontend contract options: emojiUsage='No' produces 0 emojis, emojiUsage='Yes' with '3 out of 10' produces 3 emojis", async () => {
    const app = createApp({ mock: true });

    // Test No emojis with exact UI value "No"
    const { status: statusNo, data: dataNo } = await request(
      app,
      "POST",
      "/api/campaigns/generate",
      {
        ...sampleBrief,
        emojiUsage: "No",
        emojiCount: "4 out of 10",
      },
    );
    assert.equal(statusNo, 200);
    const emojiRegex =
      /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F926}-\u{1F939}\u{1F1E6}-\u{1F1FF}]/u;
    dataNo.tweets.forEach((tweet, i) => {
      assert.equal(
        emojiRegex.test(tweet.text),
        false,
        `Tweet ${i + 1} should have no emojis when emojiUsage is No`,
      );
    });

    // Test Yes with "3 out of 10"
    const { status: statusYes, data: dataYes } = await request(
      app,
      "POST",
      "/api/campaigns/generate",
      {
        ...sampleBrief,
        emojiUsage: "Yes",
        emojiCount: "3 out of 10",
      },
    );
    assert.equal(statusYes, 200);
    const countWithEmojis = dataYes.tweets.filter((t) => emojiRegex.test(t.text)).length;
    assert.equal(
      countWithEmojis,
      3,
      `Expected exactly 3 tweets with emojis, got ${countWithEmojis}`,
    );

    // Test full regeneration endpoint with emojiUsage: "No"
    const { status: statusRegen, data: dataRegen } = await request(
      app,
      "POST",
      `/api/campaigns/${dataNo.campaignId}/regenerate`,
      {
        ...sampleBrief,
        emojiUsage: "No",
        emojiCount: "4 out of 10",
      },
    );
    assert.equal(statusRegen, 200);
    dataRegen.tweets.forEach((tweet, i) => {
      assert.equal(
        emojiRegex.test(tweet.text),
        false,
        `Regenerated tweet ${i + 1} should have no emojis when emojiUsage is No`,
      );
    });
  });
});

describe("Save to Notion & n8n Webhook Integration", () => {
  const sampleCampaignResult = {
    campaignId: "camp_notion_test_123",
    profile: {
      summary: "Understated, sharp voice for creative leaders.",
      audience: "Independent designers and architects",
      themes: ["Focus", "Tactile tools"],
      characteristics: ["Crisp", "Conversational"],
      inferredFields: ["summary", "audience"],
    },
    tweets: Array.from({ length: 10 }, (_, i) => ({
      id: `tweet-${i + 1}`,
      label: "Conversational",
      angle: "Conversational",
      tone: "Friendly",
      text: `Tactile tools for everyday focus number ${i + 1}.`,
    })),
  };

  it("formatN8nNotionPayload maps all campaign fields into the payload structure expected by n8n", () => {
    const payload = formatN8nNotionPayload(
      {
        ...sampleBrief,
        ...sampleCampaignResult,
        emojiUsage: "Yes",
        emojiCount: "3 out of 10",
      },
      "camp_notion_test_123",
    );

    // Minimum required fields
    assert.equal(payload.campaignId, "camp_notion_test_123");
    assert.equal(payload.brand, "Fieldwork");
    assert.equal(payload.brandName, "Fieldwork");
    assert.equal(payload.industry, "Independent design tools");
    assert.equal(payload.campaignObjective, "Brand awareness");
    assert.equal(payload.audience, "Independent designers and architects");
    assert.deepEqual(payload.preferredTones, ["Witty", "Friendly"]);
    assert.equal(payload.includeEmojis, true);
    assert.equal(payload.emojiCount, 3);
    assert.ok(payload.createdAt);

    // Product, offer & additional context
    assert.equal(payload.productInfo, "Thoughtful tactile stationery and software for creators.");
    assert.equal(payload.product, "Thoughtful tactile stationery and software for creators.");
    assert.equal(payload.details, "Thoughtful tactile stationery and software for creators.");
    assert.equal(payload.instructions, "Avoid tech buzzwords and hype.");
    assert.equal(payload.additionalContext, "Avoid tech buzzwords and hype.");
  });

  it("POST /api/campaigns/:id/notion-save returns 503 when N8N_NOTION_WEBHOOK_URL is missing and mock is disabled", async () => {
    const prevUrl = process.env.N8N_NOTION_WEBHOOK_URL;
    delete process.env.N8N_NOTION_WEBHOOK_URL;

    try {
      const app = createApp({ mock: false });
      const { status, data } = await request(app, "POST", "/api/campaigns/camp_123/notion-save", {
        ...sampleBrief,
        ...sampleCampaignResult,
      });
      assert.equal(status, 503);
      assert.equal(data.saved, false);
      assert.ok(data.error.includes("n8n Notion webhook is not configured"));
    } finally {
      if (prevUrl) process.env.N8N_NOTION_WEBHOOK_URL = prevUrl;
    }
  });

  it("POST /api/campaigns/:id/notion-save successfully saves in mock mode and records to campaign history", async () => {
    const app = createApp({ mock: true });

    // Initial history must be empty
    const { status: histStatusBefore, data: histBefore } = await request(
      app,
      "GET",
      "/api/campaigns/history",
    );
    assert.equal(histStatusBefore, 200);
    assert.deepEqual(histBefore, []);

    // Save campaign
    const { status, data } = await request(
      app,
      "POST",
      "/api/campaigns/camp_test_save/notion-save",
      {
        ...sampleBrief,
        ...sampleCampaignResult,
      },
    );
    assert.equal(status, 200);
    assert.equal(data.saved, true);
    assert.ok(data.url);

    // History must now contain the saved campaign
    const { status: histStatusAfter, data: histAfter } = await request(
      app,
      "GET",
      "/api/campaigns/history",
    );
    assert.equal(histStatusAfter, 200);
    assert.equal(histAfter.length, 1);
    assert.equal(histAfter[0].brandName, "Fieldwork");
    assert.equal(histAfter[0].objective, "Brand awareness");
    assert.equal(histAfter[0].url, data.url);
  });

  it("POST /api/campaigns/:id/notion-save succeeds when n8n returns created Notion page ID and URL", async () => {
    const originalFetch = globalThis.fetch;
    const testWebhookUrl = "https://example.com/test-webhook-success";
    const prevUrl = process.env.N8N_NOTION_WEBHOOK_URL;
    process.env.N8N_NOTION_WEBHOOK_URL = testWebhookUrl;

    try {
      globalThis.fetch = async (url, opts) => {
        if (url === testWebhookUrl) {
          return new Response(
            JSON.stringify({
              id: "page-abc-123",
              url: "https://app.notion.com/p/Test-Page-123",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return originalFetch(url, opts);
      };

      const app = createApp({ mock: false });
      const { status, data } = await request(
        app,
        "POST",
        "/api/campaigns/camp_real_success/notion-save",
        {
          ...sampleBrief,
          ...sampleCampaignResult,
        },
      );

      assert.equal(status, 200);
      assert.equal(data.saved, true);
      assert.equal(data.url, "https://app.notion.com/p/Test-Page-123");
      assert.equal(data.id, "page-abc-123");
    } finally {
      globalThis.fetch = originalFetch;
      if (prevUrl) process.env.N8N_NOTION_WEBHOOK_URL = prevUrl;
      else delete process.env.N8N_NOTION_WEBHOOK_URL;
    }
  });

  it("POST /api/campaigns/:id/notion-save handles n8n HTTP error responses gracefully without leaking secrets", async () => {
    const originalFetch = globalThis.fetch;
    const testWebhookUrl = "https://example.com/test-webhook-secret-token";
    const prevUrl = process.env.N8N_NOTION_WEBHOOK_URL;
    process.env.N8N_NOTION_WEBHOOK_URL = testWebhookUrl;

    try {
      // Mock fetch to simulate n8n server error
      globalThis.fetch = async (url, opts) => {
        if (url === testWebhookUrl) {
          return new Response(JSON.stringify({ message: "Error in workflow" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return originalFetch(url, opts);
      };

      const app = createApp({ mock: false });
      const { status, data } = await request(app, "POST", "/api/campaigns/camp_123/notion-save", {
        ...sampleBrief,
        ...sampleCampaignResult,
      });

      assert.equal(status, 502);
      assert.equal(data.saved, false);
      assert.ok(data.error.includes("n8n workflow error (500): Error in workflow"));
      // Ensure the secret webhook token is NEVER leaked into the error string
      assert.equal(data.error.includes("test-webhook-secret-token"), false);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevUrl) process.env.N8N_NOTION_WEBHOOK_URL = prevUrl;
      else delete process.env.N8N_NOTION_WEBHOOK_URL;
    }
  });

  it("POST /api/campaigns/:id/notion-save returns 502 when n8n returns malformed non-JSON", async () => {
    const originalFetch = globalThis.fetch;
    const testWebhookUrl = "https://example.com/test-webhook-malformed";
    const prevUrl = process.env.N8N_NOTION_WEBHOOK_URL;
    process.env.N8N_NOTION_WEBHOOK_URL = testWebhookUrl;

    try {
      globalThis.fetch = async (url, opts) => {
        if (url === testWebhookUrl) {
          return new Response("<html>Bad Gateway</html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        }
        return originalFetch(url, opts);
      };

      const app = createApp({ mock: false });
      const { status, data } = await request(app, "POST", "/api/campaigns/camp_123/notion-save", {
        ...sampleBrief,
        ...sampleCampaignResult,
      });

      assert.equal(status, 502);
      assert.equal(data.saved, false);
      assert.ok(data.error.includes("n8n webhook returned invalid JSON"));
    } finally {
      globalThis.fetch = originalFetch;
      if (prevUrl) process.env.N8N_NOTION_WEBHOOK_URL = prevUrl;
      else delete process.env.N8N_NOTION_WEBHOOK_URL;
    }
  });

  it("POST /api/campaigns/:id/notion-save rejects response when n8n does not confirm created Notion URL or ID", async () => {
    const originalFetch = globalThis.fetch;
    const testWebhookUrl = "https://example.com/test-webhook-empty-obj";
    const prevUrl = process.env.N8N_NOTION_WEBHOOK_URL;
    process.env.N8N_NOTION_WEBHOOK_URL = testWebhookUrl;

    try {
      globalThis.fetch = async (url, opts) => {
        if (url === testWebhookUrl) {
          return new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return originalFetch(url, opts);
      };

      const app = createApp({ mock: false });
      const { status, data } = await request(app, "POST", "/api/campaigns/camp_123/notion-save", {
        ...sampleBrief,
        ...sampleCampaignResult,
      });

      assert.equal(status, 502);
      assert.equal(data.saved, false);
      assert.ok(data.error.includes("did not confirm page creation"));
    } finally {
      globalThis.fetch = originalFetch;
      if (prevUrl) process.env.N8N_NOTION_WEBHOOK_URL = prevUrl;
      else delete process.env.N8N_NOTION_WEBHOOK_URL;
    }
  });

  after(async () => {
    await closeDatabasePool();
  });
});
