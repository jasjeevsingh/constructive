# Constructive — Flow Shell + Rail Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the per-motion journey chrome (`FlowRail`, then `FlowShell` with its header/pills/completion panels) onto the light design system inside AppShell, responsive (rail ↔ mobile stepper), plus a minimal color-only legibility pass on the on-panel stage components — all behavior and asserted text preserved.

**Architecture:** `FlowRail` becomes a themed, responsive component backed by the `Progress` primitive. `FlowShell` wraps the journey in `AppShell`, renders a light `Card` with a header (back `Button` + Fraunces motion title + `Badge` side pills), a two-column rail+panel body (mobile stepper), and re-skinned completion panels — identical conditionals/`update()` calls. The five on-panel stage components (Restate/Keyword/Claim/Impact/VoiceOrTextInput) get color-token edits so nothing is invisible on light; `LinkCard` (a self-contained readable dark card) is deferred to the next sub-project.

**Tech Stack:** Next.js 14 (App Router, TS strict), React 18, Tailwind + owned shadcn primitives (`Card`, `Button`, `Badge`, `Progress`, `AppShell`), Vitest + RTL + jsdom.

## Global Constraints

- Light-first; design-system tokens only (no inline hex in new/edited markup); brand-blue primary; `evidence` gold / `reasoning` orange kept semantic.
- **Zero behavior change:** `FlowShell({ motion, onExit })` and `FlowRail({ stage })` signatures unchanged; all conditionals, `update(...)` calls, the FOR→AGAINST switch (`update({ side: "against", stage: "claim", mappedClaimId: null, impact: "" })`), `useFlowProgress`, and every stage prop/onComplete are identical.
- **Preserve every asserted text string** (from `tests/components/FlowShell.test.tsx` and stage/component tests): the motion title; RestateStep "Say the motion in your own words — what's the core claim?"; "Next: keywords →"; the gold keyword text; "Submit"; ClaimStage "…claim {for|against} this motion?"; the FOR-done copy "Nice — you built the FOR case: claim, link, and impact. Now flip it and argue the other side." + "Now argue the other side →"; both-sides "You've argued both sides of this motion — FOR and AGAINST. 🎉"; "← back to motions"; and the locked AGAINST pill text containing both "🔒" and "AGAINST".
- AGAINST pill while locked renders literal **"🔒 AGAINST · soon"**. Header back button is **"← Motions"** (must NOT contain "back to motions", so it can't collide with the completion button in tests).
- Rail: `Progress`-backed bar; step states done→`success`, current→`primary`, upcoming→muted; responsive (vertical sidebar `md+`, horizontal stepper `<md`) in one component.
- Legibility pass: color-only edits to `RestateStep`, `KeywordStep`, `ClaimStage`, `ImpactStage`, `VoiceOrTextInput` — swap `#fff`/`var(--text)`→`text-foreground`, `var(--dim)`→`text-muted-foreground`, dark textarea → light (`bg-background border-input text-foreground`), unstyled `<button>` → `Button`; keep gold=evidence/orange=reasoning; **no layout/structure/behavior change**. `LinkCard` is NOT touched this cycle (readable dark card; redesigned next).
- Each task ends green: `npm test` (full suite), `npx tsc --noEmit`, and (Tasks 2–3) `npm run build`.

## File Structure

```
components/FlowRail.tsx           # Rewrite — Progress + themed responsive steps (Task 1)
tests/components/FlowRail.test.tsx # Create (Task 1)
components/FlowShell.tsx          # Rewrite — AppShell + light Card + header/pills/completion (Task 2)
components/steps/RestateStep.tsx  # Modify — color tokens + Button (Task 3)
components/steps/KeywordStep.tsx  # Modify — color tokens + Button (Task 3)
components/stages/ClaimStage.tsx  # Modify — color tokens + Button (Task 3)
components/stages/ImpactStage.tsx # Modify — color tokens + Button (Task 3)
components/VoiceOrTextInput.tsx   # Modify — light textarea/label + Button (Task 3, render block only)
```

---

### Task 1: FlowRail re-skin (Progress + responsive themed steps)

**Files:**
- Rewrite: `components/FlowRail.tsx`
- Test: `tests/components/FlowRail.test.tsx`

**Interfaces:**
- Consumes: `STAGES`, `stageIndex`, `FlowStage` (`@/lib/state/flowMachine`); `Progress` (`@/components/ui/progress`); `cn` (`@/lib/utils`).
- Produces: `FlowRail({ stage }: { stage: FlowStage })` — unchanged signature; renders a `md+` vertical sidebar and a `<md` horizontal stepper.

- [ ] **Step 1: Write the failing test** — `tests/components/FlowRail.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlowRail } from "@/components/FlowRail";

describe("FlowRail", () => {
  it("renders the four stage labels and a progress bar", () => {
    render(<FlowRail stage="claim" />);
    // Labels appear (once each in the visible variant, but both variants render in DOM).
    expect(screen.getAllByText("Read the motion").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Claim").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Link").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Impact").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("progressbar").length).toBeGreaterThanOrEqual(1);
  });

  it("marks completed stages with a check", () => {
    render(<FlowRail stage="claim" />);
    // "Read the motion" is before "claim" → done → shows a check glyph.
    expect(screen.getAllByText("✓").length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/FlowRail.test.tsx`
Expected: FAIL — the current FlowRail has no `progressbar` role (inline div bar) and no "✓" for a done stage at `stage="claim"` unless past index 0… actually "Read" is done at claim, so a check exists in the OLD one too, but there's no `role="progressbar"`. The progressbar assertion fails.

- [ ] **Step 3: Rewrite `components/FlowRail.tsx`**

```tsx
"use client";
import { STAGES, stageIndex, type FlowStage } from "@/lib/state/flowMachine";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const LABELS: Record<FlowStage, string> = {
  read: "Read the motion",
  claim: "Claim",
  link: "Link",
  impact: "Impact",
};

type StepState = "done" | "current" | "upcoming";

function dotClasses(state: StepState): string {
  return cn(
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
    state === "done" && "border-success bg-success text-success-foreground",
    state === "current" && "border-primary text-primary",
    state === "upcoming" && "border-border text-muted-foreground"
  );
}

export function FlowRail({ stage }: { stage: FlowStage }) {
  const cur = stageIndex(stage);
  const pct = (cur / (STAGES.length - 1)) * 100;
  const stateOf = (i: number): StepState => (i < cur ? "done" : i === cur ? "current" : "upcoming");

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav aria-label="Your progress" className="hidden w-56 shrink-0 border-r border-border p-5 md:block">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Your progress</div>
        <Progress value={pct} className="mb-4" />
        <ol className="space-y-3">
          {STAGES.map((s, i) => {
            const state = stateOf(i);
            return (
              <li key={s} className="flex items-center gap-3">
                <span className={dotClasses(state)}>{state === "done" ? "✓" : i + 1}</span>
                <span
                  className={cn(
                    "text-sm",
                    state === "current" ? "font-semibold text-foreground" : state === "done" ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {LABELS[s]}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Mobile: horizontal stepper */}
      <div className="border-b border-border p-4 md:hidden">
        <Progress value={pct} className="mb-3" />
        <ol className="flex items-start justify-between gap-2">
          {STAGES.map((s, i) => {
            const state = stateOf(i);
            return (
              <li key={s} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                <span className={dotClasses(state)}>{state === "done" ? "✓" : i + 1}</span>
                <span className={cn("truncate text-[10px]", state === "current" ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {LABELS[s]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/FlowRail.test.tsx && npx tsc --noEmit`
Expected: PASS (labels appear in both variants; `Progress` renders `role="progressbar"`; "Read the motion" is done at `stage="claim"` → "✓" present); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add components/FlowRail.tsx tests/components/FlowRail.test.tsx
git commit -m "feat: re-skin FlowRail (Progress bar + themed responsive steps)"
```

---

### Task 2: FlowShell re-skin (AppShell + light Card + header/pills/completion)

**Files:**
- Rewrite: `components/FlowShell.tsx`

**Interfaces:**
- Consumes: `useFlowProgress`, `flowMotionToMotion`/`claimToScenario`, the stage components, `FlowRail` (Task 1), `AppShell`, `Button`, `Badge`, `Card`, `FlowMotion`.
- Produces: the re-skinned journey; behavior + all asserted copy preserved.

- [ ] **Step 1: Confirm the existing FlowShell tests are the guard**

This is a behavior-preserving re-skin; `tests/components/FlowShell.test.tsx` already asserts the behavior/copy that must survive. Run it first to see the current green baseline:

Run: `npm test -- tests/components/FlowShell.test.tsx`
Expected: PASS (baseline before the rewrite).

- [ ] **Step 2: Rewrite `components/FlowShell.tsx`** (same logic, re-skinned markup; every visible string preserved)

```tsx
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
                    onExit={onExit}
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
```

- [ ] **Step 3: Run the FlowShell tests, full suite, tsc, build**

Run: `npm test -- tests/components/FlowShell.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: FlowShell tests PASS unchanged (motion pinned; Restate prompt; a fresh motion's AGAINST pill contains "🔒"+"AGAINST"; Restate→Keywords; FOR-done "built the for case" → "Now argue the other side" → AGAINST Claim "against this motion"; both-sides "argued both sides" + "back to motions"); full suite PASS; tsc clean; `next build` succeeds. (Stage text may be low-contrast on the light panel until Task 3 — tests assert text presence, not color, so they pass; Task 3 fixes the visuals.)

- [ ] **Step 4: Commit**

```bash
git add components/FlowShell.tsx
git commit -m "feat: re-skin FlowShell — AppShell, light Card, Badge pills, themed completion"
```

---

### Task 3: Legibility pass on the on-panel stage components (color-only)

**Files:**
- Modify: `components/steps/RestateStep.tsx`, `components/steps/KeywordStep.tsx`, `components/stages/ClaimStage.tsx`, `components/stages/ImpactStage.tsx`, `components/VoiceOrTextInput.tsx`

**Interfaces:**
- Consumes: `Button` (`@/components/ui/button`). No prop/behavior changes; all component signatures and text unchanged.
- Produces: the five components readable on the light panel.

- [ ] **Step 1: Confirm existing tests are the guard**

These are color-only edits; the existing tests (`ClaimStage.test.tsx`, `VoiceOrTextInput.test.tsx`, `FlowShell.test.tsx`, `LinkCard.*`) assert roles/text that must stay green.

Run: `npm test -- tests/components/ClaimStage.test.tsx tests/components/VoiceOrTextInput.test.tsx`
Expected: PASS (baseline).

- [ ] **Step 2: Rewrite `components/steps/RestateStep.tsx`** (only the `return` block colors change; logic identical)

Replace the `return (…)` block with:

```tsx
  return (
    <div>
      <VoiceOrTextInput label="Say the motion in your own words — what's the core claim?" onSubmit={submit} />
      {reaction && <p className="mt-2.5 text-foreground">💬 {reaction}</p>}
      {error && <p className="mt-2.5 text-muted-foreground">{error}</p>}
      {(reaction || error) && (
        <Button type="button" className="mt-3" onClick={() => onNext(saved)}>
          Next: keywords →
        </Button>
      )}
    </div>
  );
```

Add `import { Button } from "@/components/ui/button";` at the top.

- [ ] **Step 3: Rewrite `components/steps/KeywordStep.tsx`** (return block; keep the segmentMotion mapping)

Replace the `return (…)` block with:

```tsx
  return (
    <div>
      <p className="font-display text-xl leading-relaxed text-foreground">
        {segmentMotion(motion.motion, motion.keywords).map((segment, i) => {
          if (segment.keyword) {
            const kw = segment.keyword;
            return (
              <span
                key={i}
                onClick={() => { setActive(kw); setReaction(null); }}
                className="cursor-pointer border-b-2 border-dashed border-evidence text-evidence"
              >
                {segment.text}
              </span>
            );
          }
          return <span key={i}>{segment.text}</span>;
        })}
      </p>
      {active && (
        <div className="mt-3">
          <VoiceOrTextInput label={`What's the scope of "${active.word}" here — and why?`} onSubmit={submit} />
          {reaction && <p className="mt-2.5 text-foreground">💬 {reaction}</p>}
          {error && <p className="mt-2.5 text-muted-foreground">{error}</p>}
        </div>
      )}
      <Button type="button" className="mt-3.5" onClick={onNext}>
        Next: claim →
      </Button>
    </div>
  );
```

Add `import { Button } from "@/components/ui/button";`.

- [ ] **Step 4: Rewrite `components/stages/ClaimStage.tsx`** (return block)

Replace the `return (…)` block with:

```tsx
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">Stage 2 · Claim</div>
      <p className="my-2 text-lg text-foreground">
        What&apos;s your strongest claim {side === "for" ? "for" : "against"} this motion?
      </p>
      <VoiceOrTextInput label="Say or type your claim" onSubmit={submit} />

      {reaction && mapped && (
        <div className="mt-3">
          <p className="text-foreground">💬 {reaction}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ll carry this forward as: <b className="text-evidence">{mapped.claim}</b>
          </p>
          <Button type="button" className="mt-2" onClick={() => onComplete(mapped.id)}>
            Build the link →
          </Button>
        </div>
      )}

      {fallback && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Coach unavailable — pick the claim closest to yours:</p>
          <div className="mt-2 flex flex-col gap-2">
            {claims.map((c) => (
              <Button key={c.id} type="button" variant="outline" className="h-auto w-full justify-start whitespace-normal py-2 text-left" onClick={() => onComplete(c.id)}>
                {c.claim}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
```

Add `import { Button } from "@/components/ui/button";`.

- [ ] **Step 5: Rewrite `components/stages/ImpactStage.tsx`** (return block)

Replace the `return (…)` block with:

```tsx
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">Stage 4 · Impact</div>
      <p className="my-2 text-lg text-foreground">So what? Why does this claim matter — what&apos;s the bigger consequence?</p>
      <VoiceOrTextInput label="Say or type the impact" onSubmit={submit} />
      {reaction && <p className="mt-3 text-foreground">💬 {reaction}</p>}
      {error && <p className="mt-3 text-muted-foreground">Coach unavailable — keep going.</p>}
      {(reaction || error) && (
        <Button type="button" className="mt-3" onClick={() => onComplete(saved)}>
          Finish this side ✓
        </Button>
      )}
    </div>
  );
```

Add `import { Button } from "@/components/ui/button";`.

- [ ] **Step 6: Edit `components/VoiceOrTextInput.tsx`** — the `return` block only (label, textarea, buttons, error → theme tokens + `Button`). Keep all logic/refs/handlers.

Add `import { Button } from "@/components/ui/button";` at the top. Replace the `return (…)` block with:

```tsx
  return (
    <div>
      <label className="mb-2 block text-sm text-muted-foreground">{label}</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-input bg-background p-2.5 text-base text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2.5">
        {voiceSupported() && (
          <Button
            type="button"
            variant="secondary"
            disabled={status === "transcribing"}
            aria-pressed={status === "listening"}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
              void startListening();
            }}
            onPointerUp={() => void stopListening()}
            onPointerCancel={() => {
              if (holdingRef.current) void stopListening();
            }}
            style={{ touchAction: "none", opacity: status === "listening" ? 0.85 : 1 }}
          >
            🎤 {micLabel}
          </Button>
        )}
        <Button
          type="button"
          onClick={() => onSubmit(text)}
          disabled={status === "transcribing" || !text.trim()}
        >
          Submit
        </Button>
      </div>
      {voiceError && <p className="mt-2 text-sm text-muted-foreground">{voiceError}</p>}
    </div>
  );
```

- [ ] **Step 7: Run the full suite, tsc, and build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: full suite PASSES (roles/text unchanged — the mic/Submit buttons are still buttons with the same names; textareas still `role="textbox"`; all stage prompts/labels/copy identical); tsc clean; `next build` succeeds. The journey now reads cleanly on the light panel.

- [ ] **Step 8: Commit**

```bash
git add components/steps/RestateStep.tsx components/steps/KeywordStep.tsx components/stages/ClaimStage.tsx components/stages/ImpactStage.tsx components/VoiceOrTextInput.tsx
git commit -m "feat: legibility pass — stage components readable on the light theme"
```

---

## Manual verification (after Task 3)

Not automated — do once with the app running (`npm run dev`, authed):

1. Open a motion → the journey is a light card inside the Constructive header: a header row (← Motions, Fraunces motion title, FOR/AGAINST pills), a left progress rail (Progress bar + Read/Claim/Link/Impact with a green check on done, blue ring on current), and a padded stage panel — filling the viewport, not a floating chip.
2. Work through Restate → Keywords → Claim → Impact: all prompts, coach reactions, and inputs are dark-on-light and readable; the mic/Submit/Next buttons are branded.
3. The Link stage still shows its dark bridge card (expected — its light redesign is the next sub-project); it's readable.
4. Complete FOR → the "argue the other side" panel; switch → AGAINST Claim; finish → "argued both sides 🎉"; pills track the active side and show ✓ on completion; locked AGAINST shows "🔒 AGAINST · soon".
5. Resize to mobile → the left rail becomes a horizontal stepper on top; header wraps; panel is full-width.

---

## Self-Review

**Spec coverage:**
- Journey inside AppShell, light full-height Card, header (back + Fraunces title + pills), two-column rail+panel → Task 2. ✓
- FlowRail: Progress bar + themed steps + responsive (sidebar/stepper) → Task 1. ✓
- Side pills as Badges; locked "🔒 AGAINST · soon" preserved → Task 2. ✓
- Completion panels re-skinned, copy preserved → Task 2. ✓
- Legibility pass (color-only) on the 5 on-panel components; LinkCard deferred (readable dark) → Task 3. ✓
- Zero behavior change; signatures unchanged; asserted copy preserved → Tasks 2, 3 (verified by existing tests). ✓
- Gates green each task → all tasks. ✓
- Non-goals (no stage/bridge redesign, no behavior/routing changes, no dark mode) → respected. ✓

**Placeholder scan:** No TBD/TODO; FlowRail + FlowShell given as full files; the 5 legibility edits give exact replacement return-blocks + the added imports. ✓

**Type consistency:** `FlowRail({ stage })` / `FlowShell({ motion, onExit })` signatures unchanged; `Button`/`Badge`/`Card`/`AppShell`/`Progress` come from the foundation with the used variants (`success`/`secondary`/`outline`/`default`, sizes `sm`); stage component props/onComplete signatures untouched; every preserved string matches the test assertions verbatim. ✓
