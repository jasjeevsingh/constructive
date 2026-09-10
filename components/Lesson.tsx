/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { motion as m } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CLI_DEFINITIONS } from "@/lib/cli";
import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";

const MOTION = "This House believes that homework should be banned.";

/** The homework example, one row per layer. Row `i` lights up once the
 *  learner reaches step `i`, so the argument builds cumulatively on the right
 *  while the teaching on the left stays short. */
const EXAMPLE: { key: string; label: string; tone: string; text: string }[] = [
  {
    key: "claim",
    label: "Claim",
    tone: "bg-foreground text-background",
    text: "Homework takes up too much student free time.",
  },
  {
    key: "reasoning",
    label: "Link · Reasoning",
    tone: "bg-reasoning text-reasoning-foreground",
    text: "When students spend hours on homework every night, they lose time for sleep, exercise, and the things outside school that shape who they become — and an exhausted student doesn't learn well anyway.",
  },
  {
    key: "evidence",
    label: "Link · Evidence",
    tone: "bg-evidence text-evidence-foreground",
    text: "A widely cited study of over 4,300 high school students found that more than three hours of nightly homework led to higher stress, more health problems, and less time for friends and family — which shows the harm isn't theoretical.",
  },
  {
    key: "impact",
    label: "Impact",
    tone: "bg-success text-success-foreground",
    text: "This is happening to millions of students right now, and the ones hit hardest have the least support at home. Homework doesn't raise standards — it widens the gap.",
  },
];

type Step = {
  eyebrow: string;
  banner: { src: string; alt: string };
  headline: string;
  body: React.ReactNode;
};

const { claim, link, impact } = CLI_DEFINITIONS;

const STEPS: Step[] = [
  {
    eyebrow: "C · Claim",
    banner: { src: "/lesson/claim.jpg", alt: `Claim — ${claim.tag}. ${claim.definition}` },
    headline: "Take a side the other team can push back on.",
    body: (
      <>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Specific</span> — says something precise, not a
            general theme.
          </li>
          <li>
            <span className="font-medium text-foreground">Contestable</span> — a reasonable person could
            disagree. If everyone agrees, it&apos;s a fact, not a claim.
          </li>
        </ul>
        <Compare
          bad={{ text: "Homework is bad for students.", why: "A feeling. Nothing to argue against." }}
          good={{ text: "Homework takes up too much student free time.", why: "Specific, and the other side can fight it." }}
        />
      </>
    ),
  },
  {
    eyebrow: "L · Link — Reasoning",
    banner: { src: "/lesson/link-reasoning.jpg", alt: `Link — ${link.tag}, Reasoning. ${link.definition}` },
    headline: "Explain why your claim is true, step by step.",
    body: (
      <>
        <p className="mt-3 text-sm text-muted-foreground">
          Don&apos;t repeat the claim. Walk through the chain of cause and effect. No sources yet — just clear
          thinking.
        </p>
        <Callout label="One-sentence test">
          &ldquo;[Your Claim] <span className="font-semibold text-foreground">because</span> [your reasoning].&rdquo;
          If it sounds circular, keep pushing.
        </Callout>
      </>
    ),
  },
  {
    eyebrow: "L · Link — Evidence",
    banner: { src: "/lesson/link-evidence.jpg", alt: `Link — ${link.tag}, Evidence. ${link.definition}` },
    headline: "Back your reasoning with something real.",
    body: (
      <>
        <p className="mt-3 text-sm text-muted-foreground">
          A fact, study, or example that proves your reasoning isn&apos;t just opinion. Evidence strengthens
          the bridge — it doesn&apos;t replace it.
        </p>
        <Callout label="Frame it">
          &ldquo;According to [source], [finding] —{" "}
          <span className="font-semibold text-foreground">which shows that</span> [your reasoning].&rdquo;
        </Callout>
      </>
    ),
  },
  {
    eyebrow: "I · Impact",
    banner: { src: "/lesson/impact.jpg", alt: `Impact — ${impact.tag}. ${impact.definition}` },
    headline: "Show what changes in the world if you're right.",
    body: (
      <>
        <p className="mt-3 text-sm text-muted-foreground">
          Who is affected, and how many? Pick one or two of these — not all three every time.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li><span className="font-medium text-foreground">Magnitude</span> — how many people?</li>
          <li><span className="font-medium text-foreground">Probability</span> — how likely?</li>
          <li><span className="font-medium text-foreground">Timeframe</span> — how soon?</li>
        </ul>
      </>
    ),
  },
];

function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</div>
      <p className="mt-1">{children}</p>
    </div>
  );
}

function Compare({ bad, good }: { bad: { text: string; why: string }; good: { text: string; why: string } }) {
  return (
    <div className="mt-3 space-y-2 text-sm">
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
        <div className="text-xs font-semibold text-destructive">✗ Too broad</div>
        <p className="mt-0.5 font-medium text-foreground">&ldquo;{bad.text}&rdquo;</p>
        <p className="text-xs text-muted-foreground">{bad.why}</p>
      </div>
      <div className="rounded-md border border-success/30 bg-success/5 p-2.5">
        <div className="text-xs font-semibold text-success">✓ Specific and contestable</div>
        <p className="mt-0.5 font-medium text-foreground">&ldquo;{good.text}&rdquo;</p>
        <p className="text-xs text-muted-foreground">{good.why}</p>
      </div>
    </div>
  );
}

/** The right-hand column: the homework argument, built up one layer per step. */
function SeeItInAction({ litCount }: { litCount: number }) {
  return (
    <aside data-testid="see-it-in-action" aria-label="See it in action" className="md:sticky md:top-20">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        See it in action — building up
      </div>
      <p className="mt-1 text-xs text-muted-foreground">&ldquo;{MOTION}&rdquo;</p>
      <ol className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        {EXAMPLE.map((row, i) => {
          const lit = i < litCount;
          return (
            <li
              key={row.key}
              data-testid={lit ? "action-row-lit" : "action-row-dim"}
              className={cn(
                "flex border-b border-border last:border-b-0 transition-opacity",
                !lit && "opacity-40"
              )}
            >
              <div
                className={cn(
                  "w-24 shrink-0 px-2.5 py-3 text-[11px] font-semibold uppercase leading-tight tracking-wide sm:w-28",
                  lit ? row.tone : "bg-muted text-muted-foreground"
                )}
              >
                {row.label}
              </div>
              <div className="flex-1 px-3 py-3 text-sm leading-snug">
                {lit ? (
                  <m.p
                    key="lit"
                    className="text-foreground"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={transitions.gentle}
                  >
                    {row.text}
                  </m.p>
                ) : (
                  <p className="italic text-muted-foreground">Coming next →</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

export function Lesson({ onBack }: { onBack: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const pct = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 h-8 px-2 text-muted-foreground">
        ← Back to motions
      </Button>

      <div className="text-xs font-semibold uppercase tracking-wide text-primary">The lesson</div>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Claim → Link → Impact
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Three parts, built in order. A claim on one side, the impact on the other, and the link is the
        bridge between them.
      </p>

      <img
        src="/lesson/cli-bridge.jpg"
        alt={`The bridge: Claim — ${claim.tag}: ${claim.definition} Link — ${link.tag}: ${link.definition} Impact — ${impact.tag}: ${impact.definition}`}
        className="mt-5 w-full rounded-xl border border-border"
        width={1600}
        height={1194}
      />

      <div className="mt-6">
        <div className="text-xs font-medium text-muted-foreground">
          Step {stepIndex + 1} of {STEPS.length} · {step.eyebrow}
        </div>
        <Progress value={pct} className="mt-2" />
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-2 md:items-start">
        <m.div
          key={stepIndex}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={transitions.snappy}
        >
            <Card className="overflow-hidden">
              <img
                src={step.banner.src}
                alt={step.banner.alt}
                className="w-full border-b border-border"
                width={1600}
                height={496}
              />
              <CardContent className="p-5">
                <div className="font-display text-xs font-semibold uppercase tracking-wide text-primary">
                  {step.eyebrow}
                </div>
                <h2 className="mt-1 font-display text-xl font-semibold text-foreground">{step.headline}</h2>
                {step.body}
              </CardContent>
            </Card>
        </m.div>

        <SeeItInAction litCount={stepIndex + 1} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={isFirst}
        >
          ← Previous
        </Button>
        {isLast ? (
          <Button type="button" onClick={onBack}>
            Try it yourself — pick a motion →
          </Button>
        ) : (
          <Button type="button" onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}>
            Next →
          </Button>
        )}
      </div>
    </div>
  );
}
