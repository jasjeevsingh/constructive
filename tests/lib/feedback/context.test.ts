import { describe, it, expect, beforeEach } from "vitest";
import { collectFeedbackContext } from "@/lib/feedback/context";

beforeEach(() => localStorage.clear());

describe("collectFeedbackContext", () => {
  it("always records the pathname", () => {
    expect(collectFeedbackContext(localStorage, "/").pathname).toBe("/");
  });

  it("includes flow progress when present", () => {
    localStorage.setItem(
      "constructive:flow:v1",
      JSON.stringify({ "m-kids-vote": { side: "against", stage: "claim", mappedClaimId: "a1" } })
    );
    const ctx = collectFeedbackContext(localStorage, "/");
    expect(ctx.flow).toEqual({
      "m-kids-vote": { side: "against", stage: "claim", mappedClaimId: "a1" },
    });
  });

  it("drops the student's free text from every motion, keeping only the documented fields", () => {
    localStorage.setItem(
      "constructive:flow:v1",
      JSON.stringify({
        "m-kids-vote": {
          side: "against",
          stage: "claim",
          readSubstep: "restate",
          restate: "kids should get to vote because they live here too",
          keywordAnswers: { fairness: "everyone affected should have a say" },
          mappedClaimId: "a1",
          impact: "my little brother would finally feel like his opinion counts",
          forComplete: true,
          againstComplete: false,
        },
        "m-other-motion": {
          side: "for",
          stage: "read",
          readSubstep: "impact",
          restate: "some other private restate",
          keywordAnswers: { x: "some other private answer" },
          mappedClaimId: null,
          impact: "some other private impact paragraph",
          forComplete: false,
          againstComplete: false,
        },
      })
    );
    const ctx = collectFeedbackContext(localStorage, "/");
    expect(ctx.flow).toEqual({
      "m-kids-vote": {
        side: "against",
        stage: "claim",
        mappedClaimId: "a1",
        forComplete: true,
        againstComplete: false,
      },
      "m-other-motion": {
        side: "for",
        stage: "read",
        mappedClaimId: null,
        forComplete: false,
        againstComplete: false,
      },
    });
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain("kids should get to vote");
    expect(serialized).not.toContain("everyone affected should have a say");
    expect(serialized).not.toContain("my little brother");
    expect(serialized).not.toContain("private restate");
    expect(serialized).not.toContain("private answer");
    expect(serialized).not.toContain("private impact");
    for (const entry of Object.values(ctx.flow!) as Record<string, unknown>[]) {
      expect(entry).not.toHaveProperty("restate");
      expect(entry).not.toHaveProperty("keywordAnswers");
      expect(entry).not.toHaveProperty("impact");
      expect(entry).not.toHaveProperty("readSubstep");
    }
  });

  it("includes practice counts when present", () => {
    localStorage.setItem("constructive:practice:v1", JSON.stringify({ claim: 3, link: 1, impact: 0 }));
    expect(collectFeedbackContext(localStorage, "/").practice).toEqual({ claim: 3, link: 1, impact: 0 });
  });

  it("omits a corrupt entry instead of throwing", () => {
    localStorage.setItem("constructive:flow:v1", "{not json");
    let ctx!: ReturnType<typeof collectFeedbackContext>;
    expect(() => { ctx = collectFeedbackContext(localStorage, "/motions"); }).not.toThrow();
    expect(ctx.flow).toBeUndefined();
    expect(ctx.pathname).toBe("/motions");
  });

  it("omits absent stores", () => {
    const ctx = collectFeedbackContext(localStorage, "/");
    expect(ctx.flow).toBeUndefined();
    expect(ctx.practice).toBeUndefined();
  });

  it("survives a storage that throws on read", () => {
    const hostile = { getItem() { throw new Error("denied"); } } as unknown as Storage;
    expect(() => collectFeedbackContext(hostile, "/")).not.toThrow();
  });
});
