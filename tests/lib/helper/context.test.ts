import { describe, it, expect } from "vitest";
import { emptyHelperContext, renderHelperContext, type HelperContext } from "@/lib/helper/context";

const full: HelperContext = {
  activity: "journey",
  motion: "This House would ban homework.",
  side: "for",
  stage: "claim",
  claimDraft: "homework stops families eating together",
  transcript: [
    { role: "student", text: "homework is bad" },
    { role: "coach", text: "Can you ground that in a situation?" },
  ],
};

describe("renderHelperContext", () => {
  it("names the motion, side and stage", () => {
    const t = renderHelperContext(full);
    expect(t).toContain("This House would ban homework.");
    expect(t).toContain("for");
    expect(t).toContain("claim");
  });

  it("includes the student's working claim and the coach exchange", () => {
    const t = renderHelperContext(full);
    expect(t).toContain("homework stops families eating together");
    expect(t).toContain("Can you ground that in a situation?");
  });

  it("omits empty sections rather than printing blanks", () => {
    const t = renderHelperContext({ ...full, claimDraft: null, transcript: [] });
    expect(t).not.toMatch(/claim so far/i);
    expect(t).not.toMatch(/coach said/i);
  });

  it("handles a bare context without throwing", () => {
    expect(() => renderHelperContext(emptyHelperContext())).not.toThrow();
  });

  it("defaults to an empty journey context", () => {
    const e = emptyHelperContext();
    expect(e.transcript).toEqual([]);
    expect(e.claimDraft).toBeNull();
  });
});
