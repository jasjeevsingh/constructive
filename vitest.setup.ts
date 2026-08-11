import "@testing-library/jest-dom/vitest";

import { vi } from "vitest";

vi.mock("next/font/google", () => ({
  Fraunces: () => ({ variable: "font-display", className: "font-display", style: { fontFamily: "Fraunces" } }),
  DM_Sans: () => ({ variable: "font-sans", className: "font-sans", style: { fontFamily: "DM Sans" } }),
}));
