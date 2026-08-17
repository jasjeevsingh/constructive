import { describe, it, expect } from "vitest";
import { runCoach } from "@/lib/ai/coach";
import type { ChatClient } from "@/lib/ai/claude";

function fake(reply: string): ChatClient & { calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  return { calls, async complete(a) { calls.push(a); return reply; } };
}

const claimReq = {
  step: "claim" as const,
  motion: "THW let kids vote.",
  payload: { side: "for", studentClaim: "kids live with laws longest", authoredClaims: [{ id: "c-stake", claim: "Kids deserve a say." }] },
};

describe("runCoach claim + impact", () => {
  it("returns a claim mapping when the id is in the authored set", async () => {
    const res = await runCoach(
      claimReq,
      fake(
        JSON.stringify({
          kind: "claim",
          reaction: "Good instinct!",
          verdict: "good-enough",
          question: null,
          mappedClaimId: "c-stake",
        })
      )
    );
    expect(res).toMatchObject({ kind: "claim", mappedClaimId: "c-stake" });
  });
  it("throws when the coach maps to an id NOT in the authored set", async () => {
    await expect(
      runCoach(
        claimReq,
        fake(
          JSON.stringify({
            kind: "claim",
            reaction: "x",
            verdict: "good-enough",
            question: null,
            mappedClaimId: "c-nope",
          })
        )
      )
    ).rejects.toThrow(/authored set/);
  });
  it("parses an impact response", async () => {
    const res = await runCoach(
      { step: "impact", motion: "m", payload: { claim: "c", authoredImpact: "a", studentImpact: "s" } },
      fake(JSON.stringify({ kind: "impact", reaction: "Nice — push it further." }))
    );
    expect(res).toMatchObject({ kind: "impact" });
  });

  it("does not throw mid-loop when the claim is not yet mapped", async () => {
    const client = fake(
      JSON.stringify({
        kind: "claim",
        reaction: "Good start.",
        verdict: "keep-going",
        question: "Can you make that concrete?",
        mappedClaimId: null,
      })
    );
    const res = await runCoach(
      { step: "claim", motion: "m", payload: { authoredClaims: [{ id: "c1", claim: "x" }] } },
      client
    );
    expect(res.kind).toBe("claim");
  });

  it("throws when it says good-enough without mapping a claim", async () => {
    const client = fake(
      JSON.stringify({
        kind: "claim",
        reaction: "Great.",
        verdict: "good-enough",
        question: null,
        mappedClaimId: null,
      })
    );
    await expect(
      runCoach(
        { step: "claim", motion: "m", payload: { authoredClaims: [{ id: "c1", claim: "x" }] } },
        client
      )
    ).rejects.toThrow();
  });

  it("forwards prior turns to the client as user/assistant turns", async () => {
    let seen: unknown;
    const client = {
      async complete(args: { system: string; user: string; history?: unknown }) {
        seen = args.history;
        return JSON.stringify({
          kind: "claim",
          reaction: "ok",
          verdict: "good-enough",
          question: null,
          mappedClaimId: "c1",
        });
      },
    };
    await runCoach(
      {
        step: "claim",
        motion: "m",
        payload: { authoredClaims: [{ id: "c1", claim: "x" }] },
        history: [
          { role: "student", text: "s1" },
          { role: "coach", text: "c1" },
        ],
      },
      client
    );
    expect(seen).toEqual([
      { role: "user", content: "s1" },
      { role: "assistant", content: "c1" },
    ]);
  });
});
