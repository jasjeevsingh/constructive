import { describe, it, expect } from "vitest";
import { restatePrompt } from "@/lib/prompts/restate";
import { keywordPrompt } from "@/lib/prompts/keyword";
import { refinePrompt } from "@/lib/prompts/refine";
import { generateMotionsPrompt } from "@/lib/prompts/generateMotions";

describe("prompt builders", () => {
  it("restate prompt embeds motion + answer and asks for JSON", () => {
    const p = restatePrompt({ motion: "THW ban homework.", restate: "no more homework" });
    expect(p.user).toContain("THW ban homework.");
    expect(p.user).toContain("no more homework");
    expect(p.system.toLowerCase()).toContain("json");
  });

  it("keyword prompt includes the coach hint when present", () => {
    const p = keywordPrompt({ motion: "THW let kids vote.", word: "kids", hint: "scope!", answer: "ages 10+" });
    expect(p.user).toContain("kids");
    expect(p.user).toContain("scope!");
    expect(p.user).toContain("ages 10+");
  });

  it("refine prompt lists all six arguments and forbids rewriting", () => {
    const p = refinePrompt({
      motion: "THW let kids vote.",
      argsFor: ["a", "b", "c"],
      argsAgainst: ["d", "e", "f"],
    });
    ["a", "b", "c", "d", "e", "f"].forEach((x) => expect(p.user).toContain(x));
    expect(p.system.toLowerCase()).toContain("do not rewrite");
    expect(p.system).toContain("for-0");
  });

  it("tells the motion generator to capitalize House", () => {
    const p = generateMotionsPrompt("Naruto");
    expect(p.system).toContain("This House");
    expect(p.system).not.toContain("This house");
  });
});
