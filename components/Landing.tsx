import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const STEPS = [
  { label: "Claim", blurb: "Your position — what you believe and why." },
  { label: "Link", blurb: "The bridge from your claim to why it matters." },
  { label: "Impact", blurb: "So what? The bigger consequence." },
];

export function Landing({ onOpenLesson }: { onOpenLesson: () => void }) {
  return (
    <section>
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">Step 1 · Get oriented</div>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Build an argument, one idea at a time.
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Debate is a search for what&apos;s true, not a fight to win. Make a claim, build the
        bridge to why it matters, and see the impact.
      </p>
      <Button type="button" variant="outline" className="mt-4" onClick={onOpenLesson}>
        Read the lesson: Claim → Link → Impact →
      </Button>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="font-display text-xs font-semibold uppercase tracking-wide text-primary">
                Step {i + 1}
              </div>
              <div className="mt-1 font-display text-xl font-semibold text-foreground">{s.label}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
              {s.label === "Link" && (
                <div className="mt-3 flex gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-evidence" aria-hidden="true" />
                    evidence
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-reasoning" aria-hidden="true" />
                    reasoning
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
