import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const MOTION = "This House believes that homework should be banned.";

function WatchOut({ title, items }: { title: string; items: { name: string; body: string }[] }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        ⚠ Watch out — {title}
      </div>
      <div className="mt-2 space-y-2">
        {items.map((it) => (
          <p key={it.name} className="text-muted-foreground">
            <span className="font-medium text-foreground">{it.name}.</span> {it.body}
          </p>
        ))}
      </div>
    </div>
  );
}

function BuiltUpBox({ lines }: { lines: { label: string; text: string }[] }) {
  return (
    <div className="mt-3 rounded-lg border border-evidence bg-evidence/10 p-3 text-sm">
      {lines.map((l) => (
        <p key={l.label} className="mt-1.5 first:mt-0">
          <span className="font-semibold text-foreground">{l.label}</span>{" "}
          <span className="text-foreground">{l.text}</span>
        </p>
      ))}
    </div>
  );
}

// One step at a time, not the whole lesson at once — a student reads Claim,
// then Link/Reasoning, then Link/Evidence, then Impact, each building on the
// last (mirrors the progressive reveal the source guide itself specs).
const STEPS: { eyebrow: string; render: () => React.ReactNode }[] = [
  {
    eyebrow: "C · Claim",
    render: () => (
      <>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">An argument in favor of your side</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Not a question, not a fact — a stance the other side could disagree with and have something
          real to argue back.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Specific</span> — does it say something
            precise, not just a general theme?
          </li>
          <li>
            <span className="font-medium text-foreground">Contestable</span> — could a reasonable
            person disagree? If everyone would agree, it&apos;s a fact, not a claim.
          </li>
        </ul>
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-destructive">✗ Too broad:</span> &ldquo;Homework is bad
            for students.&rdquo; A feeling, not a claim — nothing for the other side to grab onto.
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">✓ Specific and contestable:</span>{" "}
            &ldquo;Homework takes up too much student free time.&rdquo;
          </p>
        </div>
        <BuiltUpBox lines={[{ label: "Claim —", text: "Homework takes up too much student free time." }]} />
      </>
    ),
  },
  {
    eyebrow: "L · Link — Reasoning",
    render: () => (
      <>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">The bridge between your Claim and your Impact</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Don&apos;t repeat the Claim — explain the chain of cause and effect that makes it true. No
          sources needed yet, just clear thinking.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          One-sentence test: complete <span className="font-medium text-foreground">&ldquo;[Your Claim] because [your reasoning].&rdquo;</span>{" "}
          If it sounds circular, keep pushing.
        </p>
        <BuiltUpBox
          lines={[
            { label: "Claim —", text: "Homework takes up too much student free time." },
            {
              label: "Reasoning —",
              text: "When students spend hours on homework every night, they lose time for sleep, exercise, and the things outside school that shape who they become — and an exhausted student doesn't learn well anyway.",
            },
          ]}
        />
        <WatchOut
          title="weak bridges"
          items={[
            { name: "Slippery Slope", body: "Claiming one thing automatically leads to an extreme, without proving the steps in between." },
            { name: "False Dilemma", body: "Pretending there are only two options when more exist." },
            { name: "False Cause", body: "Assuming one thing caused another just because they happened together." },
          ]}
        />
      </>
    ),
  },
  {
    eyebrow: "L · Link — Evidence",
    render: () => (
      <>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">Proof that your Reasoning isn&apos;t just opinion</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Evidence should never come without the Reasoning it supports — Evidence strengthens the bridge, it doesn&apos;t replace it. Frame
          it: <span className="font-medium text-foreground">&ldquo;According to [source], [finding] — which shows that [connection back to your Reasoning].&rdquo;</span>
        </p>
        <BuiltUpBox
          lines={[
            { label: "Claim —", text: "Homework takes up too much student free time." },
            {
              label: "Reasoning —",
              text: "When students spend hours on homework every night, they lose time for sleep, exercise, and the things that shape who they become.",
            },
            {
              label: "Evidence —",
              text: "A widely cited study of over 4,300 high school students found that more than three hours of nightly homework led to higher stress, more health problems, and less time for friends and family — which shows the harm isn't theoretical.",
            },
          ]}
        />
        <WatchOut
          title="evidence traps"
          items={[
            { name: "Appeal to Authority", body: "Citing a source because it sounds impressive, without saying what it found or why it applies." },
            { name: "Generalization", body: "Evidence that doesn't actually apply to your motion's age group or context." },
          ]}
        />
      </>
    ),
  },
  {
    eyebrow: "I · Impact",
    render: () => (
      <>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">Why your argument matters beyond the debate</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Who is affected, and how many? What actually changes if your side is right? Use one or more of
          these tools — not all three every time.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <li><span className="font-medium text-foreground">Magnitude</span> — how many people are affected?</li>
          <li><span className="font-medium text-foreground">Probability</span> — how likely is this outcome?</li>
          <li><span className="font-medium text-foreground">Timeframe</span> — how soon does this happen?</li>
        </ul>
        <BuiltUpBox
          lines={[
            { label: "Claim —", text: "Homework takes up too much student free time." },
            { label: "Reasoning —", text: "Long nights of homework cut into sleep, exercise, and family time." },
            { label: "Evidence —", text: "A widely cited study found over 3 hours of nightly homework raised stress and health problems, even for motivated students." },
            {
              label: "Impact —",
              text: "This isn't one school's problem — it's happening to millions of students right now. The ones hit hardest are often the ones with the least support at home. Piling on homework doesn't raise standards — it widens the gap between kids who can absorb the pressure and kids who can't.",
            },
          ]}
        />
        <WatchOut
          title="Impact without a bridge"
          items={[
            {
              name: "Skipping the Link",
              body: "Jumping straight from Claim to Impact is the most common structural error. Without the Reasoning and Evidence underneath, the other side can dismiss it in one sentence: \"They haven't shown why that would actually happen.\"",
            },
          ]}
        />
      </>
    ),
  },
];

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
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every strong argument has three parts, built in order. Here&apos;s each one, worked through with
        one motion: <span className="font-medium text-foreground">&ldquo;{MOTION}&rdquo;</span>
      </p>

      <div className="mt-6">
        <div className="text-xs font-medium text-muted-foreground">
          Step {stepIndex + 1} of {STEPS.length} · {step.eyebrow}
        </div>
        <Progress value={pct} className="mt-2" />
      </div>

      <Card className="mt-4">
        <CardContent className="p-5">
          <div className="font-display text-xs font-semibold uppercase tracking-wide text-primary">
            {step.eyebrow}
          </div>
          {step.render()}
        </CardContent>
      </Card>

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
