import { config } from "./config.js";
import { campaignResultSchema, tweetSchema } from "./schemas.js";

export class ConfigurationError extends Error {
  constructor(message = "Gemini API key is not configured. Add GEMINI_API_KEY to server/.env.") {
    super(message);
    this.name = "ConfigurationError";
    this.status = 503;
  }
}

export class GeminiProviderError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "GeminiProviderError";
    this.status = status;
  }
}

export const EMOJI_REGEX =
  /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F926}-\u{1F939}\u{1F1E6}-\u{1F1FF}]/gu;

export function countEmojisInText(text) {
  if (typeof text !== "string") return 0;
  const matches = text.match(EMOJI_REGEX);
  return matches ? matches.length : 0;
}

export function parseEmojiCountTarget(emojiCount, emojiUsage) {
  if (emojiUsage === "No" || emojiUsage === "No emojis") {
    return 0;
  }
  if (typeof emojiCount === "number") {
    return Math.max(0, Math.min(10, Math.round(emojiCount)));
  }
  switch (emojiCount) {
    case "1 out of 10":
      return 1;
    case "2 out of 10":
    case "2 of 10":
      return 2;
    case "3 out of 10":
      return 3;
    case "4 out of 10":
    case "4 of 10":
      return 4;
    case "5 out of 10":
      return 5;
    case "6 out of 10":
    case "6 of 10":
      return 6;
    case "7 out of 10":
      return 7;
    case "8 out of 10":
    case "8 of 10":
      return 8;
    case "9 out of 10":
      return 9;
    case "All 10 tweets":
    case "All 10":
      return 10;
    case "None (0 of 10)":
      return 0;
    default: {
      const match = typeof emojiCount === "string" ? emojiCount.match(/(\d+)/) : null;
      if (match) {
        return Math.max(0, Math.min(10, parseInt(match[1], 10)));
      }
      return 4;
    }
  }
}

export function stripEmojis(text) {
  return typeof text === "string"
    ? text
        .replace(EMOJI_REGEX, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    : "";
}

const SYSTEM_PROMPT = `You are Brand Voice AI, a senior editorial brand strategist and copywriter.
Your task is to analyze a brand brief, identify its distinctive written personality, and write exactly 10 high-impact, campaign-ready tweets.

Rules:
1. You must output strictly valid JSON with no markdown wrapping, code fences, or additional text.
2. Produce a brand profile:
   - "summary": A concise, sharp voice analysis (1-2 sentences capturing tone, cadence, and attitude).
   - "audience": The target audience profile (incorporating user details or inferring thoughtful specifics).
   - "themes": An array of 3 to 5 content pillars/themes tailored to this campaign.
   - "characteristics": An array of 3 to 5 writing style characteristics (e.g. "Conversational", "Specific nouns", "Rhythmic syntax").
   - "inferredFields": An array of strings indicating which fields were inferred rather than provided as facts (subset of ["summary", "audience", "themes", "characteristics"]).
3. Produce EXACTLY 10 tweets:
   - "id": A unique identifier string like "tweet-1", "tweet-2", etc.
   - "angle": The specific content angle for each tweet. You MUST vary the content angles across the 10 tweets using angles such as: "Promotional", "Educational", "Storytelling", "Community-focused", "Conversational", "Behind-the-scenes", "Insight", "Customer-spotlight". Note: Content angles are communicative forms, NOT tone labels.
   - "tone": The specific tone applied to this tweet. If preferred tones are provided in the brief, this MUST strictly be one of the user's selected preferred tones. Under no circumstances should an unselected tone be assigned.
   - "label": The primary display tag for the tweet, which should match the content angle (e.g. "Storytelling", "Educational", "Promotional", "Community-focused", "Conversational").
   - "text": Clean, polished tweet copy under 280 characters. Avoid cliché corporate hype, spammy hashtags, or repetitive templates. Follow the brief's emoji preferences strictly.
4. Output schema structure:
{
  "campaignId": "string",
  "profile": {
    "summary": "string",
    "audience": "string",
    "themes": ["string"],
    "characteristics": ["string"],
    "inferredFields": ["summary" | "audience" | "themes" | "characteristics"]
  },
  "tweets": [
    { "id": "string", "angle": "string", "tone": "string", "label": "string", "text": "string" }
  ]
}`;

function buildPrompt(input) {
  const selectedTones = Array.isArray(input.tones) && input.tones.length > 0 ? input.tones : [];
  const toneInstructions =
    selectedTones.length > 0
      ? `PREFERRED TONES (STRICT REQUIREMENT):
The user explicitly selected: [${selectedTones.join(", ")}].
Every single tweet must strictly follow these preferred tones.
DO NOT assign or label any tweet with an unselected tone (for example, if the user selected only Friendly and Bold, DO NOT assign or label any tweet with Witty, Playful, Professional, Informative, or Empathetic). Each tweet's "tone" field MUST be one of: ${selectedTones.join(", ")}.`
      : `PREFERRED TONES:
No specific tones were selected by the user. Infer a thoughtful, cohesive tone suitable for the brand from the brief details.`;

  const targetEmojiCount =
    input.emojiUsage === "No" || input.emojiUsage === "No emojis"
      ? 0
      : parseEmojiCountTarget(input.emojiCount, input.emojiUsage);
  const emojiInstructions =
    targetEmojiCount === 0 || input.emojiUsage === "No" || input.emojiUsage === "No emojis"
      ? `EMOJI INSTRUCTION (STRICT ZERO):
The user explicitly selected NO emojis (Question 1: No).
You must NOT include ANY emojis in ANY of the 10 tweets. Every single tweet must have exactly 0 emojis.`
      : `EMOJI INSTRUCTION:
- Question 1 (Do you want emojis in your tweets?): Yes
- Question 2 (How many of the 10 tweets should contain emojis?): ${input.emojiCount || `${targetEmojiCount} out of 10`}
- EXACT TARGET: Exactly ${targetEmojiCount} of the 10 tweets should contain emojis, and the remaining ${10 - targetEmojiCount} tweets must contain ZERO emojis.
- Placement: Use natural, brand-appropriate emojis without unnecessary or repetitive icons.`;

  return `BRAND BRIEF:
Brand Name: ${input.brandName}
Industry / Category: ${input.industry || "Not specified"}
Campaign Objective: ${input.objective}
What they offer / Product details: ${input.details || "Not specified"}
Target Audience: ${input.audience || "Not specified (infer from brand and offering)"}
${toneInstructions}
${emojiInstructions}
Additional Instructions: ${input.instructions || "None"}

Please analyze this brief and return the JSON response containing the profile and exactly 10 diverse tweets matching all tone and emoji constraints.`;
}

/**
 * Call the Google Gemini REST API using process.env.GEMINI_API_KEY
 */
export async function callGeminiApi(systemPrompt, userPrompt) {
  if (!config.isGeminiConfigured) {
    throw new ConfigurationError();
  }

  const apiKey = config.geminiApiKey;
  const model = config.geminiModel;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new GeminiProviderError("Gemini API request timed out after 30 seconds.", 504);
    }
    throw new GeminiProviderError(`Network error reaching Gemini API: ${err.message}`, 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `Gemini API returned status ${response.status}.`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.message) {
        // Sanitize message so API keys are never exposed in error text
        errorMessage = parsed.error.message.replace(/key=[^&]+/g, "key=[REDACTED]");
      }
    } catch {
      // Keep default error message
    }
    throw new GeminiProviderError(errorMessage, response.status >= 500 ? 502 : response.status);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new GeminiProviderError("Gemini response was empty or blocked by safety filters.");
  }

  try {
    return JSON.parse(textContent);
  } catch (err) {
    throw new GeminiProviderError(`Failed to parse Gemini response as JSON: ${err.message}`);
  }
}

/**
 * Sanitize and enforce tone restrictions and emoji preferences
 */
export function sanitizeCampaignTweets(tweets, input = {}) {
  const allTones = [
    "Witty",
    "Friendly",
    "Bold",
    "Professional",
    "Playful",
    "Informative",
    "Empathetic",
  ];
  const userTones = Array.isArray(input.tones) && input.tones.length > 0 ? input.tones : [];
  const targetEmojiCount =
    input.emojiUsage === "No" || input.emojiUsage === "No emojis"
      ? 0
      : parseEmojiCountTarget(input.emojiCount, input.emojiUsage);
  const fallbackAngles = [
    "Conversational",
    "Promotional",
    "Storytelling",
    "Educational",
    "Community-focused",
    "Insight",
    "Behind-the-scenes",
    "Feature-spotlight",
    "Reflection",
    "Informational",
  ];

  const rawList = Array.isArray(tweets) ? tweets : [];
  const normalized = rawList.map((tweet, index) => {
    let text = typeof tweet.text === "string" ? tweet.text : "";

    // Determine tone strictly obeying user preference
    let tone = tweet.tone;
    if (userTones.length > 0) {
      if (!tone || !userTones.includes(tone)) {
        tone = userTones[index % userTones.length];
      }
    } else if (!tone) {
      tone = "Friendly";
    }

    // Determine angle and label (content angle must never be an unselected tone name)
    let angle = tweet.angle || tweet.label || fallbackAngles[index % fallbackAngles.length];
    if (userTones.length > 0) {
      const unselectedTones = allTones.filter((t) => !userTones.includes(t));
      if (unselectedTones.includes(angle)) {
        angle = fallbackAngles[index % fallbackAngles.length];
      }
    }

    return {
      id: tweet.id || `tweet-${index + 1}`,
      angle,
      tone,
      label: angle,
      text,
    };
  });

  // Zero emojis requested
  if (targetEmojiCount === 0 || input.emojiUsage === "No" || input.emojiUsage === "No emojis") {
    return normalized.map((t) => ({
      ...t,
      text: stripEmojis(t.text),
    }));
  }

  // Single tweet regeneration
  if (normalized.length === 1) {
    return normalized;
  }

  // Best-effort exact emoji count enforcement across campaign tweets
  const editorialEmojis = ["✨", "🌿", "💡", "✍️", "🛠️", "🤝", "📖", "🔍", "⚡", "💭"];
  const withEmojiIndices = [];
  const withoutEmojiIndices = [];

  normalized.forEach((t, idx) => {
    if (countEmojisInText(t.text) > 0) {
      withEmojiIndices.push(idx);
    } else {
      withoutEmojiIndices.push(idx);
    }
  });

  const currentEmojiCount = withEmojiIndices.length;

  if (currentEmojiCount > targetEmojiCount) {
    // Too many tweets contain emojis: strip emojis from excess tweets from the end
    const excess = currentEmojiCount - targetEmojiCount;
    const toStrip = withEmojiIndices.slice(-excess);
    for (const idx of toStrip) {
      normalized[idx].text = stripEmojis(normalized[idx].text);
    }
  } else if (currentEmojiCount < targetEmojiCount) {
    // Too few tweets contain emojis: add a tasteful emoji to tweets without emojis until target is met
    const needed = targetEmojiCount - currentEmojiCount;
    const toAdd = withoutEmojiIndices.slice(0, needed);
    toAdd.forEach((idx) => {
      const emoji = editorialEmojis[idx % editorialEmojis.length] || "✨";
      const cleanText = normalized[idx].text.trim();
      if (cleanText.length + emoji.length + 1 <= 280) {
        normalized[idx].text = `${cleanText} ${emoji}`;
      } else {
        normalized[idx].text = `${cleanText.slice(0, 277)} ${emoji}`;
      }
    });
  }

  return normalized;
}

/**
 * Generate full campaign result with brand voice profile and 10 tweets
 */
export async function generateCampaignResult(input, options = {}) {
  // If mock provider is explicitly passed (used in testing), use mock generator
  if (options.mock) {
    return generateMockCampaign(input);
  }

  const prompt = buildPrompt(input);
  const rawResult = await callGeminiApi(SYSTEM_PROMPT, prompt);

  // Ensure campaignId exists
  if (!rawResult.campaignId) {
    rawResult.campaignId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  rawResult.tweets = sanitizeCampaignTweets(rawResult.tweets || [], input);

  // Validate with Zod schema (ensures exactly 10 tweets and required profile shape)
  return campaignResultSchema.parse(rawResult);
}

/**
 * Regenerate a single tweet (maintaining campaign context)
 */
export async function regenerateSingleTweet(campaignId, tweetNumber, input, options = {}) {
  const userTones = Array.isArray(input.tones) && input.tones.length > 0 ? input.tones : [];
  const targetEmojiCount =
    input.emojiUsage === "No" || input.emojiUsage === "No emojis"
      ? 0
      : parseEmojiCountTarget(input.emojiCount, input.emojiUsage);

  if (options.mock) {
    const mock = generateMockCampaign(input);
    const mockTweet = mock.tweets[(tweetNumber - 1) % mock.tweets.length];
    return {
      ...mockTweet,
      id: `tweet-${tweetNumber}`,
    };
  }

  const toneRule =
    userTones.length > 0
      ? `Strict Tone Requirement: The user only wants these tones: [${userTones.join(", ")}]. You MUST assign the "tone" property to one of: ${userTones.join(", ")}. Never use an unselected tone.`
      : `Tone: Reflect a tone fitting the brief.`;

  const emojiRule =
    targetEmojiCount === 0 || input.emojiUsage === "No" || input.emojiUsage === "No emojis"
      ? `Strict Emoji Rule: The user specified NO emojis. Do NOT include any emojis in this tweet. 0 emojis.`
      : `Emoji Rule: Emojis are permitted for this campaign (${input.emojiCount || "4 out of 10"} target across campaign). Use emojis tastefully and naturally if appropriate for this tweet.`;

  const systemPrompt = `You are Brand Voice AI. Regenerate exactly ONE tweet for tweet slot #${tweetNumber} for the brand "${input.brandName}".
Return JSON only matching: { "id": "string", "angle": "string", "tone": "string", "label": "string", "text": "string" }
- "angle": The specific content angle (e.g. Conversational, Promotional, Storytelling, Educational, Community-focused, Behind-the-scenes, Insight).
- "tone": The tone of the tweet. ${toneRule}
- "label": Content angle matching "angle".
- "text": Polished tweet copy under 280 characters. ${emojiRule}`;

  const userPrompt = `Regenerate tweet #${tweetNumber}.
Brand: ${input.brandName}
Industry: ${input.industry}
Objective: ${input.objective}
Tones: ${userTones.join(", ") || "Inferred from brief"}
Emoji preference: ${input.emojiUsage === "No" || input.emojiUsage === "No emojis" ? "No emojis" : `Yes (${input.emojiCount || "4 out of 10"})`}
Instructions: ${input.instructions || "None"}`;

  const raw = await callGeminiApi(systemPrompt, userPrompt);
  const sanitized = sanitizeCampaignTweets([raw], input)[0];
  sanitized.id = `tweet-${tweetNumber}`;
  return tweetSchema.parse(sanitized);
}

/**
 * Regenerate all 10 tweets
 */
export async function regenerateAllTweets(campaignId, input, options = {}) {
  if (options.mock) {
    return generateMockCampaign(input).tweets;
  }

  const systemPrompt = `You are Brand Voice AI. Generate a fresh set of exactly 10 tweets for the brand "${input.brandName}".
Return JSON only: { "tweets": [ { "id": "string", "angle": "string", "tone": "string", "label": "string", "text": "string" } ] }
There must be exactly 10 tweets with diverse angles (Conversational, Promotional, Storytelling, Educational, Community-focused, Behind-the-scenes, Insight). Follow all tone and emoji constraints.`;

  const userPrompt = buildPrompt(input);
  const raw = await callGeminiApi(systemPrompt, userPrompt);
  const tweets = raw.tweets || raw;
  const sanitized = sanitizeCampaignTweets(tweets, input);
  return campaignResultSchema.shape.tweets.parse(sanitized);
}

/**
 * Mock generator for testing without incurring API fees or requiring live keys during tests
 */
export function generateMockCampaign(input) {
  const brand = input.brandName || "Fieldwork";
  const userTones = Array.isArray(input.tones) && input.tones.length > 0 ? input.tones : [];
  const defaultTones = ["Friendly", "Bold", "Informative"];

  // 10 distinct content angles, strictly separated from tones
  const angles = [
    "Conversational",
    "Promotional",
    "Insight",
    "Informational",
    "Storytelling",
    "Community-focused",
    "Educational",
    "Behind-the-scenes",
    "Feature-spotlight",
    "Reflection",
  ];

  const baseTexts = [
    `Most tools ask you to adapt to them. With ${brand}, we designed things to get out of your way and let your best work happen.`,
    `Introducing the next chapter of ${brand}. Thoughtful, tactile, and made for people who care about how their work feels.`,
    `Good design is invisible. Bad design is unforgettable. We aim for the kind you notice just enough to smile.`,
    `Why did we build ${brand}? Because everyday tools shouldn't feel like a compromise between beauty and utility.`,
    `We started in a small workshop with one guiding question: what if work tools had the same care as bespoke furniture?`,
    `To every founder, creator, and builder quietly perfecting their craft tonight: we built this for you.`,
    `Three things we learned while building ${brand}: simplicity takes more time, restraint is a superpower, and details matter.`,
    `What's one small ritual that transforms your workday? For us, it's starting with an uncluttered space and clear intent.`,
    `No bloated features. No endless setup. Just the considered essentials you need to move forward today.`,
    `Work is hard enough. The tools you use shouldn't feel like a negotiation. Welcome to ${brand}.`,
  ];

  const targetEmojiCount =
    input.emojiUsage === "No" || input.emojiUsage === "No emojis"
      ? 0
      : parseEmojiCountTarget(input.emojiCount, input.emojiUsage);
  const sampleEmojis = ["✍️", "✨", "🌿", "🛠️", "💡", "🤝", "📖", "🔍", "⚡", "💭"];

  // Pick which tweet indices receive emojis based on targetEmojiCount
  const emojiIndices = new Set();
  if (targetEmojiCount > 0 && input.emojiUsage !== "No" && input.emojiUsage !== "No emojis") {
    const step = 10 / targetEmojiCount;
    for (let i = 0; i < targetEmojiCount; i++) {
      emojiIndices.add(Math.min(9, Math.floor(i * step)));
    }
    for (let i = 0; emojiIndices.size < targetEmojiCount && i < 10; i++) {
      emojiIndices.add(i);
    }
  }

  const tweets = baseTexts.map((text, idx) => {
    const angle = angles[idx];
    const tone =
      userTones.length > 0
        ? userTones[idx % userTones.length]
        : defaultTones[idx % defaultTones.length];
    let finalText = text;
    if (emojiIndices.has(idx)) {
      finalText = `${text} ${sampleEmojis[idx % sampleEmojis.length]}`;
    }

    return {
      id: `tweet-${idx + 1}`,
      angle,
      tone,
      label: angle,
      text: finalText,
    };
  });

  const inferred = [];
  if (!input.details) inferred.push("summary");
  if (!input.audience) inferred.push("audience");
  inferred.push("themes", "characteristics");

  return {
    campaignId: `camp_mock_${Date.now()}`,
    profile: {
      summary: `A considered, high-craft editorial voice combining understated warmth with crisp technical confidence.`,
      audience:
        input.audience ||
        `Design-conscious creators, founders, and independent practitioners seeking deliberate tools.`,
      themes: [
        "Intentional Craft",
        "Quiet Productivity",
        "Thoughtful Rituals",
        "Modern Independence",
      ],
      characteristics: [
        "Conversational rhythm",
        "Specific imagery",
        "Understated confidence",
        "Zero buzzwords",
      ],
      inferredFields: inferred.length
        ? inferred
        : ["summary", "audience", "themes", "characteristics"],
    },
    tweets,
  };
}
