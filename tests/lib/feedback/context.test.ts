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
