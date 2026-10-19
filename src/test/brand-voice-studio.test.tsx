import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import BrandVoiceStudio from "@/components/studio/BrandVoiceStudio";
import { emojiCountOptions } from "@/lib/campaign-service";

describe("BrandVoiceStudio Component - Emoji Preferences Flow", () => {
  it("renders the Emoji preferences section before the generate button", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<BrandVoiceStudio />);
    });

    const html = container.innerHTML;
    expect(html).toContain("Emoji preferences");
    expect(html).toContain("Question 1: Do you want emojis in your tweets?");

    const emojiIndex = html.indexOf("Emoji preferences");
    const generateIndex = html.indexOf("Generate 10 tweets");
    expect(emojiIndex).toBeGreaterThan(-1);
    expect(generateIndex).toBeGreaterThan(-1);
    expect(emojiIndex).toBeLessThan(generateIndex);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("defaults Question 1 to 'No' and hides Question 2", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<BrandVoiceStudio />);
    });

    // Check Question 1 buttons
    const noBtn = container.querySelector('button[role="radio"][aria-checked="true"]');
    expect(noBtn?.textContent).toContain("No");

    // Check Question 2 is hidden
    expect(container.innerHTML).not.toContain(
      "Question 2: If Yes, how many of the 10 tweets should contain emojis?",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows Question 2 with all 10 options when Yes is selected, and allows choosing count", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<BrandVoiceStudio />);
    });

    // Find "Yes" button in Question 1
    const buttons = Array.from(container.querySelectorAll('button[role="radio"]'));
    const yesBtn = buttons.find((b) => b.textContent?.trim() === "Yes");
    expect(yesBtn).toBeDefined();

    // Click "Yes"
    act(() => {
      yesBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Question 2 should now be visible
    expect(container.innerHTML).toContain(
      "Question 2: If Yes, how many of the 10 tweets should contain emojis?",
    );

    // All 10 count options must be present
    for (const option of emojiCountOptions) {
      expect(container.innerHTML).toContain(option);
    }

    // Default count selection is "4 out of 10"
    const countButtons = Array.from(container.querySelectorAll('button[role="radio"]'));
    const fourBtn = countButtons.find((b) => b.textContent?.includes("4 out of 10"));
    expect(fourBtn?.getAttribute("aria-checked")).toBe("true");

    // Select "All 10 tweets"
    const allBtn = countButtons.find((b) => b.textContent?.includes("All 10 tweets"));
    expect(allBtn).toBeDefined();
    act(() => {
      allBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(allBtn?.getAttribute("aria-checked")).toBe("true");
    expect(fourBtn?.getAttribute("aria-checked")).toBe("false");

    // Click "No" again
    const noBtn = Array.from(container.querySelectorAll('button[role="radio"]')).find(
      (b) => b.textContent?.trim() === "No",
    );
    act(() => {
      noBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Question 2 should be hidden again
    expect(container.innerHTML).not.toContain(
      "Question 2: If Yes, how many of the 10 tweets should contain emojis?",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("BrandVoiceStudio Component - Tweet Character Count & Tone Adherence", () => {
  it("calculates tweet character count from the actual displayed text and respects selected tones", async () => {
    const { CampaignResults } = await import("@/components/studio/BrandVoiceStudio");

    const sampleTweets = Array.from({ length: 10 }, (_, index) => ({
      id: `tweet-${index + 1}`,
      label: index % 2 === 0 ? "Conversational" : "Promotional",
      angle: index % 2 === 0 ? "Conversational" : "Promotional",
      tone: index % 2 === 0 ? "Friendly" : "Bold",
      text:
        index === 0
          ? "Elevate your daily ritual 🌿✨ with tactile software & stationery ✍️"
          : `Considered brand copy tweet number ${index + 1}.`,
    }));

    const mockResult = {
      campaignId: "test-campaign-123",
      profile: {
        summary: "A considered brand voice.",
        audience: "Independent designers",
        themes: ["Simplicity", "Craft"],
        characteristics: ["Direct", "Warm"],
        inferredFields: [] as ("summary" | "audience" | "themes" | "characteristics")[],
      },
      tweets: sampleTweets,
    };

    const mockInput = {
      brandName: "Fieldwork",
      industry: "Design tools",
      objective: "Brand awareness" as const,
      details: "Tactile tools for creators.",
      audience: "Designers",
      tones: ["Friendly", "Bold"] as ("Friendly" | "Bold")[],
      instructions: "Avoid hype.",
      emojiUsage: "No" as const,
      emojiCount: "4 out of 10" as const,
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<CampaignResults result={mockResult} input={mockInput} onResult={() => {}} />);
    });

    // Verify all 10 tweet character counts match the actual displayed text length
    for (let i = 1; i <= 10; i++) {
      const charCountEl = container.querySelector(`[data-testid="tweet-${i}-char-count"]`);
      expect(charCountEl).not.toBeNull();
      const expectedText = sampleTweets[i - 1].text;
      expect(charCountEl?.textContent).toBe(`${expectedText.length} characters`);
    }

    // Verify tone labels respect the selected tones
    const toneLabels = Array.from(container.querySelectorAll(".tweet-card span")).filter((el) =>
      el.textContent?.startsWith("Tone: "),
    );
    expect(toneLabels.length).toBe(10);
    toneLabels.forEach((labelEl) => {
      const toneText = labelEl.textContent?.replace("Tone: ", "").trim();
      expect(["Friendly", "Bold"]).toContain(toneText);
      expect(toneText).not.toBe("Witty");
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("handles unselected tone replacement on TweetCard gracefully", async () => {
    const { TweetCard } = await import("@/components/studio/BrandVoiceStudio");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    // Tweet has an unselected tone "Witty" in both label and tone
    const rogueTweet = {
      id: "tweet-1",
      label: "Witty",
      angle: "Witty",
      tone: "Witty",
      text: "Sharp ideas for thoughtful builders.",
    };

    act(() => {
      root.render(
        <TweetCard
          tweet={rogueTweet}
          index={0}
          onRegenerate={() => {}}
          regenerating={false}
          selectedTones={["Friendly", "Bold"]}
        />,
      );
    });

    // Tone label must be forced to one of the selected tones
    const toneBadge = container.querySelector(".tweet-card span:nth-of-type(3)");
    expect(toneBadge?.textContent).toBe("Tone: Friendly");

    // Content angle badge must not display the unselected tone name "Witty"
    const angleBadge = container.querySelector(".tweet-card span.bg-secondary");
    expect(angleBadge?.textContent).not.toBe("Witty");
    expect(angleBadge?.textContent).toBe("Conversational");

    // Character count must match text length
    const charCount = container.querySelector('[data-testid="tweet-1-char-count"]');
    expect(charCount?.textContent).toBe(`${rogueTweet.text.length} characters`);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("handles Save to Notion button click, passes campaign data, and notifies campaign-saved", async () => {
    const { CampaignResults } = await import("@/components/studio/BrandVoiceStudio");
    const campaignService = await import("@/lib/campaign-service");

    let savedEventReceived = false;
    const eventHandler = () => {
      savedEventReceived = true;
    };
    window.addEventListener("campaign-saved", eventHandler);

    let passedCampaignId = "";
    let passedResult: InstanceType<typeof Object> | null = null;
    let passedInput: InstanceType<typeof Object> | null = null;

    const saveSpy = (await import("vitest")).vi
      .spyOn(campaignService, "saveCampaignToNotion")
      .mockImplementation(async (campaignId, result, input) => {
        passedCampaignId = campaignId;
        passedResult = result;
        passedInput = input;
        return { saved: true, url: "https://notion.so/brand-voice/test-page-123" };
      });

    const mockResult = {
      campaignId: "camp_interactive_save_123",
      profile: {
        summary: "Warm and direct.",
        audience: "Designers",
        themes: ["Simplicity"],
        characteristics: ["Crisp"],
        inferredFields: [] as ("summary" | "audience" | "themes" | "characteristics")[],
      },
      tweets: Array.from({ length: 10 }, (_, i) => ({
        id: `tweet-${i + 1}`,
        label: "Conversational",
        angle: "Conversational",
        tone: "Friendly",
        text: `Tweet content ${i + 1}`,
      })),
    };

    const mockInput = {
      brandName: "Fieldwork",
      industry: "Design tools",
      objective: "Brand awareness" as const,
      details: "Tactile tools for creators.",
      audience: "Designers",
      tones: ["Friendly", "Bold"] as ("Friendly" | "Bold")[],
      instructions: "Avoid hype.",
      emojiUsage: "No" as const,
      emojiCount: "4 out of 10" as const,
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<CampaignResults result={mockResult} input={mockInput} onResult={() => {}} />);
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const saveBtn = buttons.find((b) => b.textContent?.includes("Save to Notion"));
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn?.click();
    });

    expect(saveSpy).toHaveBeenCalled();
    expect(passedCampaignId).toBe("camp_interactive_save_123");
    expect(passedResult.campaignId).toBe("camp_interactive_save_123");
    expect(passedInput.brandName).toBe("Fieldwork");
    expect(savedEventReceived).toBe(true);

    saveSpy.mockRestore();
    window.removeEventListener("campaign-saved", eventHandler);
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("BrandVoiceStudio Component - Post-Save Reset & Multi-Campaign Flow", () => {
  function createSampleCampaign(id: string, brandName: string) {
    return {
      campaignId: id,
      profile: {
        summary: `Considered voice for ${brandName}.`,
        audience: "Target audience",
        themes: ["Craft", "Design"],
        characteristics: ["Warm", "Concise"],
        inferredFields: [] as ("summary" | "audience" | "themes" | "characteristics")[],
      },
      tweets: Array.from({ length: 10 }, (_, i) => ({
        id: `${id}-tweet-${i + 1}`,
        label: "Conversational",
        angle: "Conversational",
        tone: "Friendly",
        text: `${brandName} tweet idea ${i + 1}`,
      })),
    };
  }

  function setInputValue(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    value: string,
  ) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("resets form inputs, restores default emoji preference, clears campaign results, and displays success feedback after confirmed save", async () => {
    const { vi } = await import("vitest");
    const BrandVoiceStudio = (await import("@/components/studio/BrandVoiceStudio")).default;
    const campaignService = await import("@/lib/campaign-service");
    const { toast } = await import("sonner");

    const sample1 = createSampleCampaign("camp-1", "Autumn Glow");

    const genSpy = vi.spyOn(campaignService, "generateCampaign").mockResolvedValue(sample1);
    const saveSpy = vi.spyOn(campaignService, "saveCampaignToNotion").mockResolvedValue({
      saved: true,
      url: "https://notion.so/p/Autumn-Glow-123",
      id: "page-123",
    });
    const toastSuccessSpy = vi.spyOn(toast, "success");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<BrandVoiceStudio />);
    });

    // 1. Fill in the form
    const brandInput = container.querySelector("#brand-name") as HTMLInputElement;
    const industryInput = container.querySelector("#industry") as HTMLInputElement;
    const objectiveSelect = container.querySelector("#objective") as HTMLSelectElement;
    const detailsInput = container.querySelector("#brand-details") as HTMLTextAreaElement;
    const audienceInput = container.querySelector("#audience") as HTMLInputElement;
    const instructionsInput = container.querySelector("#instructions") as HTMLTextAreaElement;

    act(() => {
      setInputValue(brandInput, "Autumn Glow");
      setInputValue(industryInput, "Skincare");
      setInputValue(objectiveSelect, "Product launch");
      setInputValue(detailsInput, "Botanical face oils");
      setInputValue(audienceInput, "Wellness enthusiasts");
      setInputValue(instructionsInput, "Keep it grounding");
    });

    // Select a tone
    const boldBtn = Array.from(container.querySelectorAll("button.tone-chip")).find((b) =>
      b.textContent?.includes("Bold"),
    );
    act(() => {
      boldBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Change emoji preference to Yes and All 10
    const yesEmojiBtn = Array.from(container.querySelectorAll('button[role="radio"]')).find(
      (b) => b.textContent?.trim() === "Yes",
    );
    act(() => {
      yesEmojiBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const all10Btn = Array.from(container.querySelectorAll('button[role="radio"]')).find((b) =>
      b.textContent?.includes("All 10 tweets"),
    );
    act(() => {
      all10Btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Submit form to generate
    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(genSpy).toHaveBeenCalledTimes(1);

    // Verify results appeared
    const resultsSection = container.querySelector("#results");
    expect(resultsSection).not.toBeNull();
    expect(resultsSection?.textContent).toContain("Autumn Glow");
    expect(resultsSection?.textContent).toContain("Autumn Glow tweet idea 1");
    expect(resultsSection?.textContent).toContain("Autumn Glow tweet idea 10");

    // Click "Save to Notion"
    const saveBtn = Array.from(resultsSection!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save to Notion"),
    );
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn?.click();
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(
      "camp-1",
      sample1,
      expect.objectContaining({ brandName: "Autumn Glow" }),
    );

    // Verify success toast
    expect(toastSuccessSpy).toHaveBeenCalledWith(
      "Campaign saved to Notion. Ready for your next campaign.",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Open in Notion",
        }),
      }),
    );

    // Verify inline banner appeared
    const banner = container.querySelector('[data-testid="save-success-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain(
      "Campaign saved to Notion. Ready for your next campaign.",
    );
    expect(banner?.innerHTML).toContain("https://notion.so/p/Autumn-Glow-123");

    // Verify results section is unmounted / cleared!
    expect(container.querySelector("#results")).toBeNull();

    // Verify form inputs are reset back to defaults
    const resetBrandInput = container.querySelector("#brand-name") as HTMLInputElement;
    expect(resetBrandInput.value).toBe("");

    const resetIndustryInput = container.querySelector("#industry") as HTMLInputElement;
    expect(resetIndustryInput.value).toBe("");

    const resetObjectiveSelect = container.querySelector("#objective") as HTMLSelectElement;
    expect(resetObjectiveSelect.value).toBe("Brand awareness");

    const resetDetailsInput = container.querySelector("#brand-details") as HTMLTextAreaElement;
    expect(resetDetailsInput.value).toBe("");

    const resetAudienceInput = container.querySelector("#audience") as HTMLInputElement;
    expect(resetAudienceInput.value).toBe("");

    const resetInstructionsInput = container.querySelector("#instructions") as HTMLTextAreaElement;
    expect(resetInstructionsInput.value).toBe("");

    // Verify emoji preferences are restored to default ("No", and Question 2 hidden)
    const resetNoEmojiBtn = container.querySelector('button[role="radio"][aria-checked="true"]');
    expect(resetNoEmojiBtn?.textContent).toContain("No");
    expect(container.innerHTML).not.toContain(
      "Question 2: If Yes, how many of the 10 tweets should contain emojis?",
    );

    // Verify tone chips are unselected
    const pressedToneChips = container.querySelectorAll('.tone-chip[aria-pressed="true"]');
    expect(pressedToneChips.length).toBe(0);

    genSpy.mockRestore();
    saveSpy.mockRestore();
    toastSuccessSpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("preserves form inputs and generated campaign when save to Notion fails, allowing user to retry", async () => {
    const { vi } = await import("vitest");
    const BrandVoiceStudio = (await import("@/components/studio/BrandVoiceStudio")).default;
    const campaignService = await import("@/lib/campaign-service");
    const { toast } = await import("sonner");

    const sample = createSampleCampaign("camp-fail-1", "Nordic Roast");

    const genSpy = vi.spyOn(campaignService, "generateCampaign").mockResolvedValue(sample);
    const saveSpy = vi
      .spyOn(campaignService, "saveCampaignToNotion")
      .mockRejectedValue(new Error("n8n workflow error (500): Notion database timeout"));
    const toastErrorSpy = vi.spyOn(toast, "error");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<BrandVoiceStudio />);
    });

    const brandInput = container.querySelector("#brand-name") as HTMLInputElement;
    act(() => {
      setInputValue(brandInput, "Nordic Roast");
    });

    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const resultsSection = container.querySelector("#results");
    expect(resultsSection).not.toBeNull();

    const saveBtn = Array.from(resultsSection!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save to Notion"),
    );

    await act(async () => {
      saveBtn?.click();
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Verify error toast
    expect(toastErrorSpy).toHaveBeenCalledWith(
      "n8n workflow error (500): Notion database timeout",
      expect.anything(),
    );

    // Form inputs MUST be preserved
    expect((container.querySelector("#brand-name") as HTMLInputElement).value).toBe("Nordic Roast");

    // Results section MUST be preserved with all 10 tweets
    expect(container.querySelector("#results")).not.toBeNull();
    expect(container.querySelector("#results")?.textContent).toContain("Nordic Roast tweet idea 1");
    expect(container.querySelector("#results")?.textContent).toContain(
      "Nordic Roast tweet idea 10",
    );

    // The inline error alert should be visible
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "n8n workflow error (500): Notion database timeout",
    );

    // The save button should be re-enabled for retrying
    const retrySaveBtn = Array.from(
      container.querySelector("#results")!.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Save to Notion"));
    expect(retrySaveBtn).toBeDefined();
    expect(retrySaveBtn?.hasAttribute("disabled")).toBe(false);

    genSpy.mockRestore();
    saveSpy.mockRestore();
    toastErrorSpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("prevents duplicate submissions while save to Notion is in progress", async () => {
    const { vi } = await import("vitest");
    const { CampaignResults } = await import("@/components/studio/BrandVoiceStudio");
    const campaignService = await import("@/lib/campaign-service");

    let resolveSavePromise!: (val: { saved: true; url: string }) => void;
    const savePromise = new Promise<{ saved: true; url: string }>((resolve) => {
      resolveSavePromise = resolve;
    });

    const saveSpy = vi
      .spyOn(campaignService, "saveCampaignToNotion")
      .mockImplementation(() => savePromise);

    const sample = createSampleCampaign("camp-dup-1", "Studio Atelier");
    const mockInput = {
      brandName: "Studio Atelier",
      industry: "Design",
      objective: "Brand awareness" as const,
      details: "",
      audience: "",
      tones: [],
      instructions: "",
      emojiUsage: "No" as const,
      emojiCount: "4 out of 10" as const,
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<CampaignResults result={sample} input={mockInput} onResult={() => {}} />);
    });

    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save to Notion"),
    );
    expect(saveBtn).toBeDefined();

    // First click initiates save
    act(() => {
      saveBtn?.click();
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Second click while in progress
    act(() => {
      saveBtn?.click();
    });

    // saveSpy should NOT be called a second time
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Resolve the promise
    await act(async () => {
      resolveSavePromise({ saved: true, url: "https://notion.so/studio-atelier" });
    });

    saveSpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("allows generating and saving a second distinct campaign immediately without refreshing the page", async () => {
    const { vi } = await import("vitest");
    const BrandVoiceStudio = (await import("@/components/studio/BrandVoiceStudio")).default;
    const campaignService = await import("@/lib/campaign-service");

    const sample1 = createSampleCampaign("camp-seq-1", "First Brand");
    const sample2 = createSampleCampaign("camp-seq-2", "Second Brand");

    const genSpy = vi
      .spyOn(campaignService, "generateCampaign")
      .mockResolvedValueOnce(sample1)
      .mockResolvedValueOnce(sample2);

    const saveSpy = vi.spyOn(campaignService, "saveCampaignToNotion").mockResolvedValue({
      saved: true,
      url: "https://notion.so/first-brand",
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<BrandVoiceStudio />);
    });

    // --- Campaign 1 ---
    const brandInput = container.querySelector("#brand-name") as HTMLInputElement;
    act(() => {
      setInputValue(brandInput, "First Brand");
    });

    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector("#results")?.textContent).toContain("First Brand tweet idea 1");

    // Save Campaign 1
    const saveBtn1 = Array.from(
      container.querySelector("#results")!.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("Save to Notion"));
    await act(async () => {
      saveBtn1?.click();
    });

    // Confirm Campaign 1 is saved and results are cleared
    expect(container.querySelector("#results")).toBeNull();
    expect((container.querySelector("#brand-name") as HTMLInputElement).value).toBe("");

    // --- Campaign 2 on same mounted instance without refreshing ---
    act(() => {
      setInputValue(brandInput, "Second Brand");
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(genSpy).toHaveBeenCalledTimes(2);

    // Results for Campaign 2 must be rendered and have NO trace of First Brand
    const results2 = container.querySelector("#results");
    expect(results2).not.toBeNull();
    expect(results2?.textContent).toContain("Second Brand tweet idea 1");
    expect(results2?.textContent).toContain("Second Brand tweet idea 10");
    expect(results2?.textContent).not.toContain("First Brand");

    genSpy.mockRestore();
    saveSpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("BrandVoiceStudio Component - Campaign Library Flow", () => {
  it("renders loading indicator while fetching saved campaigns", async () => {
    const { vi } = await import("vitest");
    const { CampaignLibrary } = await import("@/components/studio/BrandVoiceStudio");
    const campaignService = await import("@/lib/campaign-service");

    let resolveFetch!: (
      items: (typeof campaignService)["getCampaignHistory"] extends () => Promise<infer R>
        ? R
        : never,
    ) => void;
    const fetchPromise = new Promise<
      (typeof campaignService)["getCampaignHistory"] extends () => Promise<infer R> ? R : never
    >((resolve) => {
      resolveFetch = resolve;
    });

    const historySpy = vi
      .spyOn(campaignService, "getCampaignHistory")
      .mockImplementation(() => fetchPromise);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<CampaignLibrary connected={true} />);
    });

    // Loading indicator must be displayed
    const loadingEl = container.querySelector('[role="status"]');
    expect(loadingEl).not.toBeNull();
    expect(loadingEl?.textContent).toContain("Loading saved campaigns…");

    // Resolve promise with empty list
    await act(async () => {
      resolveFetch([]);
    });

    // Loading indicator disappears
    expect(container.querySelector('[role="status"]')).toBeNull();

    historySpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("displays error alert and allows retrying when fetching history fails", async () => {
    const { vi } = await import("vitest");
    const { CampaignLibrary } = await import("@/components/studio/BrandVoiceStudio");
    const campaignService = await import("@/lib/campaign-service");

    const historySpy = vi
      .spyOn(campaignService, "getCampaignHistory")
      .mockRejectedValueOnce(
        new Error(
          "Unable to connect to the campaign API. Make sure the backend server is running on port 3001.",
        ),
      )
      .mockResolvedValueOnce([
        {
          id: "camp-recovered",
          brandName: "Recovered Brand",
          objective: "Brand awareness",
          createdAt: "2026-10-18T18:00:00.000Z",
          url: "https://notion.so/recovered-brand",
        },
      ]);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CampaignLibrary connected={true} />);
    });

    // Error alert must be shown
    const errorAlert = container.querySelector('[role="alert"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert?.textContent).toContain("Unable to connect to the campaign API");

    // "Try again" button must be present
    const retryBtn = Array.from(errorAlert!.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Try again"),
    );
    expect(retryBtn).toBeDefined();

    // Click "Try again"
    await act(async () => {
      retryBtn?.click();
    });

    expect(historySpy).toHaveBeenCalledTimes(2);

    // After successful retry, the recovered campaign must be displayed
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("Recovered Brand");
    expect(container.textContent).toContain("Brand awareness");

    historySpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders honest empty state when no campaigns are saved yet", async () => {
    const { vi } = await import("vitest");
    const { CampaignLibrary } = await import("@/components/studio/BrandVoiceStudio");
    const campaignService = await import("@/lib/campaign-service");

    const historySpy = vi.spyOn(campaignService, "getCampaignHistory").mockResolvedValue([]);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CampaignLibrary connected={true} />);
    });

    expect(container.textContent).toContain("Nothing saved here yet.");
    expect(container.textContent).toContain(
      "Campaigns will appear here after they are successfully saved to your connected workspace.",
    );
    expect(container.textContent).toContain("Connected");

    historySpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders saved campaigns with Notion links and refreshes on campaign-saved event", async () => {
    const { vi } = await import("vitest");
    const { CampaignLibrary } = await import("@/components/studio/BrandVoiceStudio");
    const campaignService = await import("@/lib/campaign-service");

    const initialCampaigns = [
      {
        id: "camp-init-1",
        brandName: "Chinese Wok",
        objective: "Engagement",
        createdAt: "2026-10-18T18:02:14.348Z",
        url: "https://app.notion.com/p/Chinese-Wok-Engagement-3fd81fd95654814b8069f01ca9e25175",
      },
    ];

    const updatedCampaigns = [
      {
        id: "camp-init-2",
        brandName: "Autumn Glow Studio",
        objective: "Product launch",
        createdAt: "2026-10-18T18:30:00.000Z",
        url: "https://app.notion.com/p/Autumn-Glow-Studio-123",
      },
      ...initialCampaigns,
    ];

    const historySpy = vi
      .spyOn(campaignService, "getCampaignHistory")
      .mockResolvedValueOnce(initialCampaigns)
      .mockResolvedValueOnce(updatedCampaigns);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CampaignLibrary connected={true} />);
    });

    // Initial render has Chinese Wok
    expect(container.textContent).toContain("Chinese Wok");
    expect(container.textContent).toContain("Engagement");
    const linkEl = container.querySelector(
      'a[href="https://app.notion.com/p/Chinese-Wok-Engagement-3fd81fd95654814b8069f01ca9e25175"]',
    );
    expect(linkEl).not.toBeNull();
    expect(linkEl?.textContent).toContain("Open campaign");

    // Fire campaign-saved event
    await act(async () => {
      window.dispatchEvent(new CustomEvent("campaign-saved", { detail: { id: "camp-init-2" } }));
    });

    expect(historySpy).toHaveBeenCalledTimes(2);

    // Both campaigns are now displayed
    expect(container.textContent).toContain("Autumn Glow Studio");
    expect(container.textContent).toContain("Chinese Wok");

    historySpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("BrandVoiceStudio Component - Hero Illustration Enhancements", () => {
  it("removes the oversized decorative '10' and renders the tasteful botanical editorial stamp", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<BrandVoiceStudio />);
    });

    // The oversized .hero-ten must NOT exist
    const heroTen = container.querySelector(".hero-ten");
    expect(heroTen).toBeNull();

    // The replacement .hero-editorial-stamp must exist
    const stamp = container.querySelector(".hero-editorial-stamp");
    expect(stamp).not.toBeNull();
    expect(stamp?.getAttribute("aria-hidden")).toBe("true");

    // Must contain botanical SVG and editorial caption
    const svg = stamp?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(stamp?.textContent).toContain("Ideas with");
    expect(stamp?.textContent).toContain("intent");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("BrandVoiceStudio Component - Theme Toggle and Dark/Light Modes", () => {
  it("renders the theme toggle button and switches themes smoothly", async () => {
    localStorage.removeItem("brand_voice_theme");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<BrandVoiceStudio />);
    });

    const toggleBtn = container.querySelector<HTMLButtonElement>(
      'button[data-testid="theme-toggle"]',
    );
    expect(toggleBtn).not.toBeNull();

    const initialAria = toggleBtn?.getAttribute("aria-label");
    expect(initialAria).toBeDefined();

    // Toggle theme
    await act(async () => {
      toggleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const themeAfterFirstClick = document.documentElement.getAttribute("data-theme");
    expect(themeAfterFirstClick).toMatch(/^(dark|light)$/);
    expect(localStorage.getItem("brand_voice_theme")).toBe(themeAfterFirstClick);

    // Toggle theme back
    await act(async () => {
      toggleBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const themeAfterSecondClick = document.documentElement.getAttribute("data-theme");
    expect(themeAfterSecondClick).not.toBe(themeAfterFirstClick);
    expect(localStorage.getItem("brand_voice_theme")).toBe(themeAfterSecondClick);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("persists and initializes theme from localStorage", async () => {
    localStorage.setItem("brand_voice_theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<BrandVoiceStudio />);
    });

    const toggleBtn = container.querySelector<HTMLButtonElement>(
      'button[data-testid="theme-toggle"]',
    );
    expect(toggleBtn?.getAttribute("aria-label")).toContain("light theme");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
