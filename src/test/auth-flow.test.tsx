import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { UserMenu } from "@/components/auth/UserMenu";
import * as authService from "@/lib/auth-service";

describe("Frontend Authentication Flow & UI Components", () => {
  it("renders GoogleSignInButton with accessible label and Google icon", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<GoogleSignInButton text="Continue with Google" />);
    });

    const btn = container.querySelector('button[data-testid="google-signin-button"]');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain("Continue with Google");
    expect(btn?.querySelector("svg")).not.toBeNull();
    expect(btn?.classList.contains("google-signin-btn")).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders compact GoogleSignInButton with 'Sign in' label for header navigation", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<GoogleSignInButton variant="compact" text="Sign in" />);
    });

    const btn = container.querySelector('button[data-testid="google-signin-button"]');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain("Sign in");
    expect(btn?.getAttribute("aria-label")).toBe("Sign in");
    expect(btn?.classList.contains("google-signin-btn")).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders UserMenu with user initials and sign-out menu", async () => {
    const mockUser = {
      id: "usr_alex_123",
      name: "Alex Rivera",
      email: "alex@fieldwork.design",
      profilePicture: null,
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AuthProvider initialUser={mockUser}>
          <UserMenu />
        </AuthProvider>,
      );
    });

    const menuBtn = container.querySelector('button[data-testid="user-menu-button"]');
    expect(menuBtn).not.toBeNull();
    expect(menuBtn?.textContent).toContain("AR"); // Initials
    expect(menuBtn?.textContent).toContain("Alex");

    // Click menu button to open dropdown
    act(() => {
      menuBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Alex Rivera");
    expect(container.textContent).toContain("alex@fieldwork.design");
    const logoutBtn = container.querySelector('button[data-testid="logout-button"]');
    expect(logoutBtn).not.toBeNull();
    expect(logoutBtn?.textContent).toContain("Sign out");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("handles logout and updates state appropriately", async () => {
    const logoutSpy = vi.spyOn(authService, "logoutUser").mockResolvedValue(undefined);

    const mockUser = {
      id: "usr_sam_456",
      name: "Sam Taylor",
      email: "sam@example.com",
    };

    let authState: ReturnType<typeof useAuth> | null = null;

    function TestConsumer() {
      authState = useAuth();
      return <div>{authState.user ? `Logged in: ${authState.user.name}` : "Logged out"}</div>;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AuthProvider initialUser={mockUser}>
          <TestConsumer />
        </AuthProvider>,
      );
    });

    expect(container.textContent).toContain("Logged in: Sam Taylor");

    await act(async () => {
      await authState?.logout();
    });

    expect(logoutSpy).toHaveBeenCalled();
    expect(container.textContent).toContain("Logged out");

    logoutSpy.mockRestore();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders clear 'Try Demo' action alongside 'Sign in with Google' on landing page for unauthenticated visitors", async () => {
    const BrandVoiceStudio = (await import("@/components/studio/BrandVoiceStudio")).default;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AuthProvider initialUser={null}>
          <BrandVoiceStudio />
        </AuthProvider>,
      );
    });

    // 1. Hero Try Demo button exists and points to #studio
    const tryDemoBtn = container.querySelector('a[data-testid="hero-try-demo-button"], button[data-testid="hero-try-demo-button"] a');
    expect(tryDemoBtn).not.toBeNull();
    expect(tryDemoBtn?.textContent).toContain("Try Demo");
    expect(tryDemoBtn?.getAttribute("href")).toBe("#studio");

    // 2. Google Sign-In button exists alongside Try Demo in hero
    const heroGoogleBtn = container.querySelector('[data-testid="hero-google-signin"]');
    expect(heroGoogleBtn).not.toBeNull();
    expect(heroGoogleBtn?.textContent).toContain("Sign in with Google");

    // 3. Navigation also shows Try Demo CTA
    const navTryDemo = container.querySelector('a[data-testid="nav-cta-button"]');
    expect(navTryDemo).not.toBeNull();
    expect(navTryDemo?.textContent).toContain("Try Demo");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("transferGuestCampaign calls /api/campaigns/transfer-guest and parses response", async () => {
    const campaignService = await import("@/lib/campaign-service");
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        transferred: true,
        campaignId: "camp_transferred_123",
      }),
    });

    const result = await campaignService.transferGuestCampaign(
      "camp_transferred_123",
      {
        campaignId: "camp_transferred_123",
        profile: {
          summary: "Warm voice",
          audience: "Founders",
          themes: ["Growth"],
          characteristics: ["Clear"],
          inferredFields: [],
        },
        tweets: [],
      },
      {
        brandName: "Acme Atelier",
        industry: "Design",
        objective: "Product launch",
        details: "New tool launch",
        audience: "Designers",
        tones: ["Bold"],
        instructions: "",
        emojiUsage: "No",
        emojiCount: "4 out of 10",
      },
    );

    expect(result.transferred).toBe(true);
    expect(result.campaignId).toBe("camp_transferred_123");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/campaigns/transfer-guest"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );

    globalThis.fetch = originalFetch;
  });
});
