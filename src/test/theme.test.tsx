import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  getInitialTheme,
  useTheme,
} from "@/hooks/use-theme";

describe("Theme Management & Default Light Mode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  });

  it("defaults to light theme when localStorage has no saved preference", () => {
    // Even if matchMedia were to report dark mode, getInitialTheme must return light
    const theme = getInitialTheme();
    expect(theme).toBe("light");
  });

  it("respects saved 'dark' preference from localStorage", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(getInitialTheme()).toBe("dark");
  });

  it("respects saved 'light' preference from localStorage", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(getInitialTheme()).toBe("light");
  });

  it("applyThemeToDocument sets data-theme and updates dark class and meta tag for light mode", () => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }

    applyThemeToDocument("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(meta.getAttribute("content")).toBe("#F7F5EF");
  });

  it("applyThemeToDocument sets data-theme and updates dark class and meta tag for dark mode", () => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }

    applyThemeToDocument("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(meta.getAttribute("content")).toBe("#161715");
  });

  it("useTheme toggles theme and persists preference to localStorage", () => {
    let themeHook: ReturnType<typeof useTheme> | null = null;

    function TestComponent() {
      themeHook = useTheme();
      return <button onClick={themeHook.toggleTheme}>Toggle</button>;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(themeHook!.theme).toBe("light");
    expect(themeHook!.isDark).toBe(false);

    // Toggle to dark
    act(() => {
      themeHook!.toggleTheme();
    });

    expect(themeHook!.theme).toBe("dark");
    expect(themeHook!.isDark).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Toggle back to light
    act(() => {
      themeHook!.toggleTheme();
    });

    expect(themeHook!.theme).toBe("light");
    expect(themeHook!.isDark).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
