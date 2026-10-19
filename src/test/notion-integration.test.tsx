import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as notionService from "@/lib/notion-service";
import { NotionNotConnectedError, saveCampaignToNotion } from "@/lib/campaign-service";
import { NotionWorkspaceStatus } from "@/components/studio/NotionWorkspaceStatus";
import { NotionConnectModal } from "@/components/studio/NotionConnectModal";
import { SignInRequiredModal } from "@/components/auth/SignInRequiredModal";

describe("Per-User Notion Frontend Integration & Services", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("getNotionStatus parses connected workspace data", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connected: true,
        workspaceId: "ws_456",
        workspaceName: "Acme Design Co",
        destination: { id: "p_123", name: "Campaign Library" },
        isConfigured: true,
      }),
    });

    const status = await notionService.getNotionStatus();
    expect(status.connected).toBe(true);
    expect(status.workspaceName).toBe("Acme Design Co");
    expect(status.destination?.name).toBe("Campaign Library");
  });

  it("getNotionStatus returns connected=false when unauthorized (401)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    const status = await notionService.getNotionStatus();
    expect(status.connected).toBe(false);
  });

  it("getNotionAuthorizeUrl requests authorization URL with bound state", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://api.notion.com/v1/oauth/authorize?client_id=cid&state=csrf123",
      }),
    });

    const data = await notionService.getNotionAuthorizeUrl("http://localhost:8080/#studio");
    expect(data.url).toContain("https://api.notion.com/v1/oauth/authorize");
  });

  it("saveCampaignToNotion throws NotionNotConnectedError when backend returns NOTION_NOT_CONNECTED", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          saved: false,
          code: "NOTION_NOT_CONNECTED",
          error: "Connect your Notion workspace to save campaigns.",
        }),
    });

    await expect(
      saveCampaignToNotion(
        "camp_123",
        {
          campaignId: "camp_123",
          profile: {
            summary: "Bold voice",
            audience: "Designers",
            themes: ["Tools"],
            characteristics: ["Direct"],
            inferredFields: [],
          },
          tweets: Array.from({ length: 10 }, (_, i) => ({
            id: `t_${i + 1}`,
            label: "Hook",
            text: `Tweet content ${i + 1}`,
          })),
        },
        {
          brandName: "Acme",
          objective: "Brand awareness",
          industry: "Tech",
          details: "",
          audience: "",
          tones: [],
          instructions: "",
          emojiUsage: "No",
          emojiCount: "4 out of 10",
        },
      ),
    ).rejects.toThrow(NotionNotConnectedError);
  });

  it("renders NotionWorkspaceStatus in Guest Demo Mode", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <NotionWorkspaceStatus
          user={null}
          notionStatus={{ connected: false, isConfigured: true }}
          onConnectClick={() => {}}
          onChangeDestinationClick={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain("Guest Demo Mode");
    expect(container.textContent).toContain("Sign in to connect your Notion workspace");

    act(() => root.unmount());
    container.remove();
  });

  it("renders NotionWorkspaceStatus in Connected Mode with workspace name and actions", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const onDestClick = vi.fn();

    act(() => {
      root.render(
        <NotionWorkspaceStatus
          user={{ name: "Alice", email: "alice@fieldwork.design" }}
          notionStatus={{
            connected: true,
            workspaceName: "Fieldwork Studio",
            destination: { id: "p_1", name: "2026 Campaigns" },
            isConfigured: true,
          }}
          onConnectClick={() => {}}
          onChangeDestinationClick={onDestClick}
        />,
      );
    });

    expect(container.textContent).toContain("Fieldwork Studio");
    expect(container.textContent).toContain("2026 Campaigns");
    expect(container.textContent).toContain("Change page");
    expect(container.textContent).toContain("Disconnect");

    act(() => root.unmount());
    container.remove();
  });

  it("renders NotionWorkspaceStatus in Not Connected Mode with Connect button", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const onConnectClick = vi.fn();

    act(() => {
      root.render(
        <NotionWorkspaceStatus
          user={{ name: "Bob", email: "bob@fieldwork.design" }}
          notionStatus={{ connected: false, isConfigured: true }}
          onConnectClick={onConnectClick}
          onChangeDestinationClick={() => {}}
        />,
      );
    });

    expect(container.textContent).toContain("Notion workspace not connected");
    const connectBtn = container.querySelector(
      'button[data-testid="connect-notion-status-button"]',
    );
    expect(connectBtn).not.toBeNull();

    act(() => {
      connectBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onConnectClick).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it("renders NotionConnectModal with explanation and connect button", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<NotionConnectModal open={true} onOpenChange={() => {}} />);
    });

    expect(document.body.textContent).toContain("Connect your Notion workspace");
    expect(document.body.textContent).toContain("Private & Isolated");
    const btn = document.body.querySelector('button[data-testid="confirm-connect-notion-button"]');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain("Connect Notion Workspace");

    act(() => root.unmount());
    container.remove();
  });

  it("renders SignInRequiredModal with Google sign in button", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<SignInRequiredModal open={true} onOpenChange={() => {}} />);
    });

    expect(document.body.textContent).toContain("Sign in to save to Notion");
    expect(document.body.textContent).toContain("Authentication Required");
    const googleBtn = document.body.querySelector('button[data-testid="google-signin-button"]');
    expect(googleBtn).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
