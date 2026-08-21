import { describe, it, expect } from "vitest";
import { claimPrompt } from "@/lib/prompts/claim";
import { impactPrompt } from "@/lib/prompts/impact";

describe("flow prompts", () => {
  it("gives the coach the rubric, the turn number, and a no-rewriting rule", () => {
    const p = claimPrompt({
      motion: "This House would ban homework.",
      side: "for",
      studentClaim: "homework is bad",
      authoredClaims: [{ id: "c1", claim: "Homework crowds out family time." }],
      history: [],
      attempt: 1,
    });
    for (const name of ["One idea", "Takes a side", "Concrete", "Contestable"]) {
      expect(p.system).toContain(name);
    }
    expect(p.system.toLowerCase()).toContain("do not rewrite");
    expect(p.system).toContain("one question");
    expect(p.user).toContain("homework is bad");
    expect(p.user).toContain("c1");
    expect(p.user).toContain("1 of 3");
  });

  it("forbids asking for evidence or reasoning — that belongs to the Link stage", () => {
    const p = claimPrompt({
      motion: "m",
      side: "for",
      studentClaim: "x",
      authoredClaims: [{ id: "c1", claim: "y" }],
      history: [],
      attempt: 1,
    });
    expect(p.system.toLowerCase()).toContain("do not ask for evidence");
  });

  it("lets the claim through once it is specific and contestable, without demanding polish on every criterion", () => {
    const p = claimPrompt({
      motion: "m",
      side: "for",
      studentClaim: "x",
      authoredClaims: [{ id: "c1", claim: "y" }],
      history: [],
      attempt: 1,
    });
    expect(p.system.toLowerCase()).toContain("specific and contestable");
    expect(p.system.toLowerCase()).not.toContain("meets all four criteria");
  });

  it("tells the coach to map on the final turn", () => {
    const p = claimPrompt({
      motion: "m",
      side: "for",
      studentClaim: "x",
      authoredClaims: [{ id: "c1", claim: "y" }],
      history: [
        { role: "student", text: "a" },
        { role: "coach", text: "b" },
        { role: "student", text: "c" },
        { role: "coach", text: "d" },
      ],
      attempt: 3,
    });
    expect(p.user).toContain("3 of 3");
    expect(p.system).toContain("final turn");
  });
  it("impact prompt embeds claim + authored impact + student impact", () => {
    const p = impactPrompt({
      motion: "THW ban homework.",
      claim: "Homework harms wellbeing.",
      authoredImpact: "Better-rested kids.",
      studentImpact: "kids sleep more",
    });
    expect(p.user).toContain("Homework harms wellbeing.");
    expect(p.user).toContain("kids sleep more");
    expect(p.system).toContain('"kind":"impact"');
  });
});
