import { describe, it, expect } from "vitest";
import { helperPrompt } from "@/lib/helper/helperPrompt";
import { emptyHelperContext } from "@/lib/helper/context";

const ctx = { ...emptyHelperContext(), motion: "This House would ban homework.", side: "for" as const, stage: "claim" };

describe("helperPrompt", () => {
  it("carries the shared claim rubric", () => {
    const p = helperPrompt(ctx);
    for (const name of ["One idea", "Takes a side", "Concrete", "Contestable"]) {
      expect(p).toContain(name);
    }
  });

  it("forbids writing the student's argument for them", () => {
    expect(helperPrompt(ctx).toLowerCase()).toContain("never write");
  });

  it("keeps the helper on the debate task", () => {
    expect(helperPrompt(ctx).toLowerCase()).toContain("politely decline");
  });

  it("tells it to keep spoken turns short and ask one question", () => {
    const p = helperPrompt(ctx).toLowerCase();
    expect(p).toContain("one question");
    expect(p).toContain("short");
  });

  it("includes the page context", () => {
    expect(helperPrompt(ctx)).toContain("This House would ban homework.");
  });
});
