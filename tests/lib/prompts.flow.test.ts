import { describe, it, expect } from "vitest";
import { claimPrompt } from "@/lib/prompts/claim";
import { impactPrompt } from "@/lib/prompts/impact";

describe("flow prompts", () => {
  it("claim prompt lists authored claim ids and asks for mappedClaimId JSON", () => {
    const p = claimPrompt({
      motion: "THW let kids vote.",
      side: "for",
      studentClaim: "kids live with laws longest",
      authoredClaims: [{ id: "c-stake", claim: "Kids deserve a say." }, { id: "c-habit", claim: "Voting builds a habit." }],
    });
    expect(p.user).toContain("kids live with laws longest");
    expect(p.user).toContain("c-stake");
    expect(p.user).toContain("c-habit");
    expect(p.system.toLowerCase()).toContain("json");
    expect(p.system).toContain('"mappedClaimId"');
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
