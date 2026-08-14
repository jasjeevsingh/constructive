"use client";
import { useFlowProgress } from "@/lib/state/useFlowProgress";
import { flowMotionToMotion, claimToScenario } from "@/lib/flowMotions";
import { RestateStep } from "@/components/steps/RestateStep";
import { KeywordStep } from "@/components/steps/KeywordStep";
import { ClaimStage } from "@/components/stages/ClaimStage";
import { ImpactStage } from "@/components/stages/ImpactStage";
import { LinkCard } from "@/components/LinkCard";
import { FlowRail } from "@/components/FlowRail";
import { AppShell } from "@/components/ui/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FlowMotion } from "@/lib/schemas";

export function FlowShell({ motion, onExit }: { motion: FlowMotion; onExit: () => void }) {
  const [progress, update] = useFlowProgress(motion.id);
  const sideClaims = motion.sides[progress.side].claims;
  const mappedClaim = sideClaims.find((c) => c.id === progress.mappedClaimId) ?? null;

  const forPill = progress.forComplete ? (
    <Badge variant="success">✓ FOR</Badge>
  ) : (
    <Badge variant={progress.side === "for" ? "default" : "secondary"}>FOR</Badge>
  );

  const againstPill = progress.againstComplete ? (
    <Badge variant="success">✓ AGAINST</Badge>
  ) : progress.side === "against" ? (
    <Badge variant="default">AGAINST</Badge>
  ) : progress.forComplete ? (
    <Badge variant="secondary">AGAINST</Badge>
  ) : (
    <Badge variant="outline">🔒 AGAINST · soon</Badge>
  );

  const bothComplete = progress.forComplete && progress.againstComplete;
  const forDone = progress.side === "for" && progress.forComplete && !progress.againstComplete;

  return (
    <AppShell>
      <Card className="flex min-h-[70vh] flex-col overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div>
            <Button variant="ghost" size="sm" onClick={onExit} className="mb-1 h-8 px-2 text-muted-foreground">
              ← Motions
            </Button>
            <div className="font-display text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {motion.motion}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {forPill}
            {againstPill}
          </div>
        </div>

        <div className="flex flex-1 flex-col md:flex-row">
          <FlowRail stage={progress.stage} />
          <div className="flex-1 p-5 sm:p-6">
            {bothComplete ? (
              <div className="mx-auto max-w-md py-8 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">Complete</div>
                <p className="mt-2 font-display text-xl font-semibold text-foreground">
                  You&apos;ve argued both sides of this motion — FOR and AGAINST. 🎉
                </p>
                <Button variant="secondary" className="mt-4" onClick={onExit}>
                  ← back to motions
                </Button>
              </div>
            ) : forDone ? (
              <div className="mx-auto max-w-md py-8 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">FOR side complete</div>
                <p className="mt-2 text-lg text-foreground">
                  Nice — you built the FOR case: claim, link, and impact. Now flip it and argue the other side.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => update({ side: "against", stage: "claim", mappedClaimId: null, impact: "" })}>
                    Now argue the other side →
                  </Button>
                  <Button variant="ghost" onClick={onExit}>
                    ← back to motions
                  </Button>
                </div>
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
                    scenario={claimToScenario(motion.id, mappedClaim)}
                    onComplete={() => update({ stage: "impact" })}
                  />
                )}
                {progress.stage === "impact" && mappedClaim && (
                  <ImpactStage
                    motion={motion.motion}
                    claim={mappedClaim.claim}
                    authoredImpact={mappedClaim.impact}
                    onComplete={(impact) =>
                      update({
                        impact,
                        forComplete: progress.side === "for" ? true : progress.forComplete,
                        againstComplete: progress.side === "against" ? true : progress.againstComplete,
                      })
                    }
                  />
                )}
              </>
            )}
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
