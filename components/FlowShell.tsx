"use client";
import { useFlowProgress } from "@/lib/state/useFlowProgress";
import { flowMotionToMotion, claimToScenario } from "@/lib/flowMotions";
import { RestateStep } from "@/components/steps/RestateStep";
import { KeywordStep } from "@/components/steps/KeywordStep";
import { ClaimStage } from "@/components/stages/ClaimStage";
import { ImpactStage } from "@/components/stages/ImpactStage";
import { LinkCard } from "@/components/LinkCard";
import { FlowRail } from "@/components/FlowRail";
import type { FlowMotion } from "@/lib/schemas";

export function FlowShell({ motion, onExit }: { motion: FlowMotion; onExit: () => void }) {
  const [progress, update] = useFlowProgress(motion.id);
  const sideClaims = motion.sides[progress.side].claims;
  const mappedClaim = sideClaims.find((c) => c.id === progress.mappedClaimId) ?? null;

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      <div style={{ background: "var(--navy)", border: "1px solid #22324c", borderRadius: 18, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #22324c", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <div>
            <button type="button" onClick={onExit} style={{ fontSize: 12, marginBottom: 6 }}>← motions</button>
            <div className="serif" style={{ fontSize: 19, color: "#fff" }}>{motion.motion}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999, background: "rgba(200,150,46,.16)", border: "1px solid var(--gold)", color: "var(--gold)", fontWeight: 700 }}>FOR</span>
            <span style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999, border: "1px solid #24344f", color: "#4a5a6f" }}>
              🔒 AGAINST · soon
            </span>
          </div>
        </div>
        <div style={{ display: "flex", minHeight: 320 }}>
          <FlowRail stage={progress.stage} />
          <div style={{ flex: 1, padding: "20px 22px" }}>
            {progress.side === "for" && progress.forComplete ? (
              <div>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--gold)" }}>Complete</div>
                <p style={{ fontSize: 17, color: "#fff", margin: "6px 0 14px" }}>
                  You&apos;ve worked this motion all the way through the FOR side — claim, link, and impact. 🎉
                </p>
                <button type="button" onClick={onExit}>← back to motions</button>
              </div>
            ) : (
              <>
                {progress.stage === "read" && progress.readSubstep === "restate" && (
                  <RestateStep
                    motion={motion.motion}
                    initial={progress.restate}
                    onNext={(restate) => update({ restate, readSubstep: "keyword" })}
                  />
                )}
                {progress.stage === "read" && progress.readSubstep === "keyword" && (
                  <KeywordStep motion={flowMotionToMotion(motion)} onNext={() => update({ stage: "claim" })} />
                )}
                {progress.stage === "claim" && (
                  <ClaimStage
                    motion={motion.motion}
                    side={progress.side}
                    claims={sideClaims.map((c) => ({ id: c.id, claim: c.claim }))}
                    onComplete={(mappedClaimId) => update({ mappedClaimId, stage: "link" })}
                  />
                )}
                {progress.stage === "link" && mappedClaim && (
                  <LinkCard
                    scenario={claimToScenario(mappedClaim)}
                    onExit={onExit}
                    onComplete={() => update({ stage: "impact" })}
                  />
                )}
                {progress.stage === "impact" && mappedClaim && (
                  <ImpactStage
                    motion={motion.motion}
                    claim={mappedClaim.claim}
                    authoredImpact={mappedClaim.impact}
                    onComplete={(impact) => update({ impact, forComplete: progress.side === "for" ? true : progress.forComplete, againstComplete: progress.side === "against" ? true : progress.againstComplete })}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
