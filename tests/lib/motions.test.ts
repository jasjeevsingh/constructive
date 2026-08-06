import { describe, it, expect } from "vitest";
import { getMotions, getMotion } from "@/lib/motions";

describe("motions loader", () => {
  it("loads and validates the bank", () => {
    const motions = getMotions();
    expect(motions.length).toBeGreaterThanOrEqual(3);
    expect(motions[0]).toHaveProperty("motion");
  });

  it("finds a motion by id", () => {
    expect(getMotion("m-kids-vote")?.motion).toBe("This House would let kids vote.");
  });

  it("returns undefined for an unknown id", () => {
    expect(getMotion("nope")).toBeUndefined();
  });
});
