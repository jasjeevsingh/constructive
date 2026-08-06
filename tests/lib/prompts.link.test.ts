import { describe, it, expect } from "vitest";
import { linkPrompt } from "@/lib/prompts/link";

describe("linkPrompt", () => {
  it("embeds claim, impact, candidate and asks for link JSON", () => {
    const p = linkPrompt({
      claim: "THW ban homework.",
      impact: "More family time.",
      candidateText: "A Harvard study raised test scores.",
      verdict: "great-but-wrong",
    });
    expect(p.user).toContain("THW ban homework.");
    expect(p.user).toContain("More family time.");
    expect(p.user).toContain("A Harvard study raised test scores.");
    expect(p.system.toLowerCase()).toContain("json");
    expect(p.system).toContain('"kind":"link"');
  });
});
