import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClaimStage } from "@/components/stages/ClaimStage";
import { ImpactStage } from "@/components/stages/ImpactStage";
import { ClaimResponseSchema, ImpactResponseSchema, LinkCandidateSchema, GeneratedCandidateSchema } from "@/lib/schemas";
import { assembleFlowMotion } from "@/lib/generatedNormalize";
import { claimPrompt } from "@/lib/prompts/claim";
import { impactPrompt } from "@/lib/prompts/impact";
import { generateScaffoldPrompt } from "@/lib/prompts/generateScaffold";

function stub(body: Record<string, unknown>) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

describe("coach fallacy flags in open-input stages", () => {
  it("ClaimStage shows a card under the latest coach turn when the coach flags a fallacy", async () => {
    stub({ kind: "claim", reaction: "Careful.", verdict: "keep-going", question: "Are those really the only two options?", mappedClaimId: null, fallacy: "false-dilemma" });
    render(<ClaimStage motion="m" side="for" claims={[{ id: "c1", claim: "x" }]} onComplete={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "either we ban homework or kids learn nothing");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByTestId("fallacy-card")).toHaveAttribute("data-fallacy", "false-dilemma");
  });

  it("ClaimStage ignores an unknown fallacy id", async () => {
    stub({ kind: "claim", reaction: "Ok.", verdict: "keep-going", question: "Why?", mappedClaimId: null, fallacy: "red-herring" });
    render(<ClaimStage motion="m" side="for" claims={[{ id: "c1", claim: "x" }]} onComplete={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "homework is bad");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await screen.findByText("Ok. Why?");
    expect(screen.queryByTestId("fallacy-card")).toBeNull();
  });

  it("ImpactStage shows a card when the coach flags a slippery slope", async () => {
    stub({ kind: "impact", reaction: "Big leap.", fallacy: "slippery-slope" });
    render(<ImpactStage motion="m" claim="c" authoredImpact="a" onComplete={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "nobody will ever go to college");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByTestId("fallacy-card")).toHaveAttribute("data-fallacy", "slippery-slope");
  });
});

describe("fallacy schema and prompt plumbing", () => {
  it("coach responses accept, omit, or null the fallacy field", () => {
    expect(ClaimResponseSchema.safeParse({ kind: "claim", reaction: "r", verdict: "keep-going", question: "q", mappedClaimId: null }).success).toBe(true);
    expect(ClaimResponseSchema.safeParse({ kind: "claim", reaction: "r", verdict: "keep-going", question: "q", mappedClaimId: null, fallacy: null }).success).toBe(true);
    expect(ImpactResponseSchema.safeParse({ kind: "impact", reaction: "r", fallacy: "anything" }).success).toBe(true);
  });
  it("link candidates accept only known fallacy ids", () => {
    const base = { id: "c", text: "t", material: "evidence", verdict: "great-but-wrong", explanation: "e" };
    expect(LinkCandidateSchema.safeParse({ ...base, fallacy: "bandwagon" }).success).toBe(true);
    expect(LinkCandidateSchema.safeParse({ ...base, fallacy: "red-herring" }).success).toBe(false);
    expect(GeneratedCandidateSchema.safeParse({ ...base, fallacy: null }).success).toBe(true);
  });
  it("the generator keeps a valid tag on a distractor and drops it elsewhere", () => {
    const m = assembleFlowMotion(
      "gen:x:0",
      "M",
      [{ word: "w", hint: null }],
      {
        for: { claims: [{ claim: "c", impact: "i", candidates: [
          { text: "a", material: "evidence", verdict: "fits", explanation: "e", fallacy: "bandwagon" },
          { text: "b", material: "reasoning", verdict: "fits", explanation: "e" },
          { text: "c", material: "evidence", verdict: "great-but-wrong", explanation: "e", fallacy: "appeal-to-authority" },
          { text: "d", material: "reasoning", verdict: "doesnt-fit", explanation: "e", fallacy: "nonsense" },
        ] }] },
        against: { claims: [{ claim: "c", impact: "i", candidates: [
          { text: "a", material: "evidence", verdict: "fits", explanation: "e" },
          { text: "b", material: "reasoning", verdict: "fits", explanation: "e" },
          { text: "c", material: "evidence", verdict: "doesnt-fit", explanation: "e" },
        ] }] },
      }
    );
    const cands = m.sides.for.claims[0].candidates;
    expect(cands.find((c) => c.text === "a")).not.toHaveProperty("fallacy");
    expect(cands.find((c) => c.text === "c")?.fallacy).toBe("appeal-to-authority");
    expect(cands.find((c) => c.text === "d")).not.toHaveProperty("fallacy");
  });
  it("the coach and generator prompts list the fallacy ids", () => {
    const c = claimPrompt({ motion: "m", side: "for", studentClaim: "x", authoredClaims: [{ id: "c1", claim: "y" }], history: [], attempt: 1 });
    expect(c.system).toContain("slippery-slope");
    expect(c.system).toContain('"fallacy"');
    const i = impactPrompt({ motion: "m", claim: "c", authoredImpact: "a", studentImpact: "s" });
    expect(i.system).toContain("slippery-slope");
    const g = generateScaffoldPrompt("Narnia", "M");
    expect(g.system + g.user).toContain("appeal-to-authority");
  });
});
