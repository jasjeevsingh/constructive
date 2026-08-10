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
    const res = await runCoach(claimReq, fake(JSON.stringify({ kind: "claim", reaction: "Good instinct!", mappedClaimId: "c-stake" })));
    expect(res).toMatchObject({ kind: "claim", mappedClaimId: "c-stake" });
  });
  it("throws when the coach maps to an id NOT in the authored set", async () => {
    await expect(
      runCoach(claimReq, fake(JSON.stringify({ kind: "claim", reaction: "x", mappedClaimId: "c-nope" })))
    ).rejects.toThrow(/authored set/);
  });
  it("parses an impact response", async () => {
    const res = await runCoach(
      { step: "impact", motion: "m", payload: { claim: "c", authoredImpact: "a", studentImpact: "s" } },
      fake(JSON.stringify({ kind: "impact", reaction: "Nice — push it further." }))
    );
    expect(res).toMatchObject({ kind: "impact" });
  });
});
