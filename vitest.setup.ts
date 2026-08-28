import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-display", className: "font-display", style: { fontFamily: "Fraunces" } }),
  DM_Sans: () => ({ variable: "font-sans", className: "font-sans", style: { fontFamily: "DM Sans" } }),
}));

// jsdom doesn't implement scrollIntoView (used by auto-scrolling panes like TranscriptPane).
if (typeof window !== "undefined" && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

// motion's reduced-motion detection calls window.matchMedia, which jsdom lacks.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
