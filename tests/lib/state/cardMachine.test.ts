import { describe, it, expect } from "vitest";
import { STEPS, nextStep, prevStep, stepIndex, isLastStep } from "@/lib/state/cardMachine";

describe("cardMachine", () => {
  it("has the three steps in order", () => {
    expect(STEPS).toEqual(["restate", "keyword", "arguments"]);
  });
  it("advances forward and clamps at the end", () => {
    expect(nextStep("restate")).toBe("keyword");
    expect(nextStep("keyword")).toBe("arguments");
    expect(nextStep("arguments")).toBe("arguments");
  });
  it("goes back and clamps at the start", () => {
    expect(prevStep("arguments")).toBe("keyword");
    expect(prevStep("restate")).toBe("restate");
  });
  it("reports index and last-step", () => {
    expect(stepIndex("keyword")).toBe(1);
    expect(isLastStep("arguments")).toBe(true);
    expect(isLastStep("restate")).toBe(false);
  });
});
