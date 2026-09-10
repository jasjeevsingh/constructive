import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CLI_DEFINITIONS, CLI_PARTS } from "@/lib/cli";

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
      <div className="mt-4 max-w-2xl rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <div className="font-medium text-foreground">How to use this tool</div>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li><span className="font-medium text-foreground">Read the lesson below</span> — walk through Claim, Link, and Impact with a worked example.</li>
          <li><span className="font-medium text-foreground">Pick a motion</span> and argue both sides to build your core skills.</li>
          <li><span className="font-medium text-foreground">Bring your own universe</span> (optional) — practice with stories you already know.</li>
          <li><span className="font-medium text-foreground">Spar with the Debate Avatar</span> — argue against an AI opponent.</li>
        </ol>
      </div>
      <Button type="button" variant="outline" className="mt-4" onClick={onOpenLesson}>
        Read the lesson: Claim → Link → Impact →
      </Button>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {CLI_PARTS.map((part, i) => {
          const d = CLI_DEFINITIONS[part];
          return (
            <Card key={part}>
              <CardContent className="p-5">
                <div className="font-display text-xs font-semibold uppercase tracking-wide text-primary">
                  Step {i + 1}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <div className="font-display text-xl font-semibold text-foreground">{d.label}</div>
                  <div className="text-sm text-muted-foreground">{d.tag}</div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{d.definition}</p>
                {part === "link" && (
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
          );
        })}
      </div>
    </section>
  );
}
