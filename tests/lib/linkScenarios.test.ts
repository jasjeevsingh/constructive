import { describe, it, expect } from "vitest";
import { getScenarios, getScenario } from "@/lib/linkScenarios";

describe("link scenarios bank", () => {
  it("loads and validates the bank", () => {
    const s = getScenarios();
    expect(s.length).toBeGreaterThanOrEqual(3);
  });

  it("finds a scenario by id", () => {
    expect(getScenario("ls-homework")?.claim).toContain("ban homework");
  });

  it("every scenario has a fitting evidence AND a fitting reasoning plank (win condition is achievable)", () => {
    for (const s of getScenarios()) {
      const fits = s.candidates.filter((c) => c.verdict === "fits");
      expect(fits.some((c) => c.material === "evidence")).toBe(true);
      expect(fits.some((c) => c.material === "reasoning")).toBe(true);
    }
  });

  it("every scenario includes at least one great-but-wrong trap", () => {
    for (const s of getScenarios()) {
      expect(s.candidates.some((c) => c.verdict === "great-but-wrong")).toBe(true);
    }
  });
});
