# Constructive — Stage UIs + Link Bridge Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the four per-motion stage inner UIs (Restate/Keyword/Claim/Impact) and the LinkCard "bridge" centerpiece on the light design system, adding two shared presentational primitives (`StageHeader`, `CoachBubble`) and a structural `Bridge` visual — all behavior and asserted copy preserved.

**Architecture:** Two tiny shared primitives unify the stages: `StageHeader` (brand-blue eyebrow + optional Fraunces prompt) and `CoachBubble` (one coach-reaction bubble). The four flow stages adopt them (color/markup only). LinkCard stays the stateful orchestrator (`useLinkProgress`, grade, coach) and delegates its visual to a new presentational `Bridge` component: Claim/Impact piers, a span/deck that fills with gold/orange beams as planks are Built, and a materials tray for unplaced planks. The legacy in-card "← activities" back button is removed (redundant with the FlowShell header).

**Tech Stack:** Next.js 14 (App Router, TS strict), React 18, Tailwind + owned shadcn primitives (`Button`, `Badge`, `Card`), Vitest + RTL + jsdom.

## Global Constraints

- Design-system tokens only — no inline hex / no `var(--navy|navy-mid|navy-light|gold|orange|orange-light|dim|text)` in new/edited markup; brand-blue `primary`; `evidence` gold / `reasoning` orange kept semantic.
- **Zero behavior change:** all component signatures, state, `fetch` calls, `speakCoach` calls, handlers, and props are identical; only markup/classes change.
- **Preserve every asserted string verbatim** (from existing tests): RestateStep "Say the motion in your own words — what's the core claim?" + "Next: keywords →"; KeywordStep scope label `What's the scope of "${active.word}" here — and why?` + "Next: claim →"; ClaimStage prompt "What's your strongest claim {for|against} this motion?" + "Say or type your claim" + "Build the link →" + fallback "Coach unavailable — pick the claim closest to yours:"; ImpactStage prompt "So what? Why does this claim matter — what's the bigger consequence?" + "Say or type the impact" + "Coach unavailable — keep going." + "Finish this side ✓".
- **LinkCard preserved strings/roles:** Build/Set-aside buttons MUST keep `aria-label={`Build ${c.text}`}` / `aria-label={`Set aside ${c.text}`}` (tests match `/build .*stress/i`, `/set aside .*stress/i`, `/build .*frees evenings/i`, `/build .*harvard/i`); "Test the bridge"; "✓ The bridge holds!"; the not-held verdict "Not yet — a strong bridge needs both evidence and reasoning." / "Not yet — check the flagged planks."; per-plank "✓ Holds — good plank." / "This one actually fits — you left it out." / ("🪤 Great but wrong — " | "Doesn't fit — ") + explanation; "💬 Talk this through"; "Coach unavailable — keep going."; "Continue →".
- **Coach reaction text passes through verbatim** inside `CoachBubble` (the `💬` glyph lives in the bubble; no test asserts the glyph).
- **Untouched:** `components/VoiceOrTextInput.tsx`, `lib/state/useLinkProgress.ts`, `lib/state/useFlowProgress.ts`, `lib/linkGrade.ts`, `app/api/coach/*`, `lib/voice/*`, `lib/schemas.ts`, content, routing.
- Each task ends green: `npm test` (full suite), `npx tsc --noEmit`, and `npm run build`.

## File Structure

```
components/stages/StageHeader.tsx   # Create — eyebrow + optional prompt (Task 1)
components/CoachBubble.tsx          # Create — coach-reaction bubble (Task 1)
tests/components/StageHeader.test.tsx   # Create (Task 1)
tests/components/CoachBubble.test.tsx   # Create (Task 1)
components/steps/RestateStep.tsx    # Modify — StageHeader + motion quote + CoachBubble (Task 2)
components/steps/KeywordStep.tsx    # Modify — StageHeader + tappable keywords + hint + CoachBubble (Task 2)
tests/components/RestateStep.test.tsx   # Create (Task 2)
tests/components/KeywordStep.test.tsx   # Create (Task 2)
components/stages/ClaimStage.tsx    # Modify — StageHeader + CoachBubble + carry-forward card (Task 3)
components/stages/ImpactStage.tsx   # Modify — StageHeader + CoachBubble (Task 3)
tests/components/ImpactStage.test.tsx   # Create (Task 3)
components/stages/Bridge.tsx        # Create — piers/span/beams/tray (Task 4)
tests/components/Bridge.test.tsx    # Create (Task 4)
components/LinkCard.tsx             # Rewrite — orchestrator wiring Bridge + StageHeader (Task 5)
```

---

### Task 1: Shared primitives — StageHeader + CoachBubble

**Files:**
- Create: `components/stages/StageHeader.tsx`, `components/CoachBubble.tsx`
- Test: `tests/components/StageHeader.test.tsx`, `tests/components/CoachBubble.test.tsx`

**Interfaces:**
- Consumes: `cn` (`@/lib/utils`).
- Produces:
  - `StageHeader({ eyebrow, prompt, className }: { eyebrow: string; prompt?: string; className?: string })`
  - `CoachBubble({ children, className }: { children: React.ReactNode; className?: string })`

- [ ] **Step 1: Write the failing tests**

`tests/components/StageHeader.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageHeader } from "@/components/stages/StageHeader";

describe("StageHeader", () => {
  it("renders the eyebrow", () => {
    render(<StageHeader eyebrow="Stage 3 · Link" />);
    expect(screen.getByText("Stage 3 · Link")).toBeInTheDocument();
  });

  it("renders the optional prompt when given", () => {
    render(<StageHeader eyebrow="Stage 2 · Claim" prompt="What is your claim?" />);
    expect(screen.getByText("What is your claim?")).toBeInTheDocument();
  });
});
```

`tests/components/CoachBubble.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachBubble } from "@/components/CoachBubble";

describe("CoachBubble", () => {
  it("renders its children text", () => {
    render(<CoachBubble>Nice restate.</CoachBubble>);
    expect(screen.getByText("Nice restate.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/components/StageHeader.test.tsx tests/components/CoachBubble.test.tsx`
Expected: FAIL — modules `@/components/stages/StageHeader` and `@/components/CoachBubble` do not exist.

- [ ] **Step 3: Create `components/stages/StageHeader.tsx`**

```tsx
import { cn } from "@/lib/utils";

export function StageHeader({
  eyebrow,
  prompt,
  className,
}: {
  eyebrow: string;
  prompt?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</div>
      {prompt && (
        <p className="mt-1 font-display text-lg leading-snug text-foreground sm:text-xl">{prompt}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `components/CoachBubble.tsx`**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CoachBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground", className)}>
      <span aria-hidden className="text-base leading-none">💬</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests + tsc**

Run: `npm test -- tests/components/StageHeader.test.tsx tests/components/CoachBubble.test.tsx && npx tsc --noEmit`
Expected: PASS (both files); tsc clean.

- [ ] **Step 6: Commit**

```bash
git add components/stages/StageHeader.tsx components/CoachBubble.tsx tests/components/StageHeader.test.tsx tests/components/CoachBubble.test.tsx
git commit -m "feat: add StageHeader + CoachBubble shared stage primitives"
```

---

### Task 2: Read stage components — RestateStep + KeywordStep

**Files:**
- Modify: `components/steps/RestateStep.tsx`, `components/steps/KeywordStep.tsx`
- Test: `tests/components/RestateStep.test.tsx`, `tests/components/KeywordStep.test.tsx`

**Interfaces:**
- Consumes: `StageHeader`, `CoachBubble` (Task 1); `VoiceOrTextInput`, `Button` (existing); `segmentMotion` (`@/lib/keywordMatch`); `Motion` (`@/lib/schemas`).
- Produces: no signature changes — `RestateStep({ motion, initial, onNext })`, `KeywordStep({ motion, onNext })` unchanged.

- [ ] **Step 1: Write the failing tests**

`tests/components/RestateStep.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RestateStep } from "@/components/steps/RestateStep";

describe("RestateStep", () => {
  it("shows the motion and the restate prompt", () => {
    render(<RestateStep motion="This House would ban homework." initial="" onNext={() => {}} />);
    expect(screen.getByText("This House would ban homework.")).toBeInTheDocument();
    expect(screen.getByText(/say the motion in your own words/i)).toBeInTheDocument();
  });
});
```

`tests/components/KeywordStep.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeywordStep } from "@/components/steps/KeywordStep";
import type { Motion } from "@/lib/schemas";

const motion: Motion = {
  id: "m",
  theme: "school",
  motion: "Schools should ban homework.",
  keywords: [{ word: "homework", hint: "assigned after-school work" }],
};

describe("KeywordStep", () => {
  it("shows a keyword's hint after tapping it", async () => {
    render(<KeywordStep motion={motion} onNext={() => {}} />);
    await userEvent.click(screen.getByText("homework"));
    expect(screen.getByText(/assigned after-school work/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/components/RestateStep.test.tsx tests/components/KeywordStep.test.tsx`
Expected: FAIL — RestateStep does not yet render the motion text (only the prompt); KeywordStep does not yet render `active.hint`.

- [ ] **Step 3: Rewrite the `return` block of `components/steps/RestateStep.tsx`**

Add these imports at the top (keep all existing imports):

```tsx
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";
```

Replace the `return (…)` block with:

```tsx
  return (
    <div>
      <StageHeader eyebrow="Stage 1 · Read" />
      <figure className="mb-4 border-l-4 border-border pl-3">
        <figcaption className="text-xs font-medium uppercase tracking-wide text-muted-foreground">The motion</figcaption>
        <blockquote className="font-display text-lg leading-snug text-foreground">{motion}</blockquote>
      </figure>
      <VoiceOrTextInput label="Say the motion in your own words — what's the core claim?" onSubmit={submit} />
      {reaction && <CoachBubble className="mt-3">{reaction}</CoachBubble>}
      {error && <p className="mt-2.5 text-muted-foreground">{error}</p>}
      {(reaction || error) && (
        <Button type="button" className="mt-3" onClick={() => onNext(saved)}>
          Next: keywords →
        </Button>
      )}
    </div>
  );
```

- [ ] **Step 4: Rewrite the `return` block of `components/steps/KeywordStep.tsx`**

Add these imports at the top (keep all existing imports):

```tsx
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";
```

Replace the `return (…)` block with:

```tsx
  return (
    <div>
      <StageHeader eyebrow="Stage 1 · Read" prompt="Tap a highlighted keyword to pin down what it really means." />
      <p className="font-display text-xl leading-relaxed text-foreground">
        {segmentMotion(motion.motion, motion.keywords).map((segment, i) => {
          if (segment.keyword) {
            const kw = segment.keyword;
            return (
              <span
                key={i}
                onClick={() => {
                  setActive(kw);
                  setReaction(null);
                }}
                className="cursor-pointer rounded border-b-2 border-dashed border-evidence px-0.5 text-evidence hover:bg-evidence/10"
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
          {active.hint && <p className="mt-2 text-sm text-muted-foreground">Hint: {active.hint}</p>}
          {reaction && <CoachBubble className="mt-3">{reaction}</CoachBubble>}
          {error && <p className="mt-2.5 text-muted-foreground">{error}</p>}
        </div>
      )}
      <Button type="button" className="mt-3.5" onClick={onNext}>
        Next: claim →
      </Button>
    </div>
  );
```

- [ ] **Step 5: Run the new tests, full suite, tsc, build**

Run: `npm test -- tests/components/RestateStep.test.tsx tests/components/KeywordStep.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: new tests PASS; full suite PASS (FlowShell restate/keyword flow unaffected — prompts and "Next: …" labels preserved); tsc clean; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/steps/RestateStep.tsx components/steps/KeywordStep.tsx tests/components/RestateStep.test.tsx tests/components/KeywordStep.test.tsx
git commit -m "feat: redesign Read stage (motion quote, tappable keywords, coach bubble)"
```

---

### Task 3: Claim + Impact stages

**Files:**
- Modify: `components/stages/ClaimStage.tsx`, `components/stages/ImpactStage.tsx`
- Test: `tests/components/ImpactStage.test.tsx` (ClaimStage already has `tests/components/ClaimStage.test.tsx`)

**Interfaces:**
- Consumes: `StageHeader`, `CoachBubble` (Task 1); `VoiceOrTextInput`, `Button` (existing).
- Produces: no signature changes — `ClaimStage({ motion, side, claims, onComplete })`, `ImpactStage({ motion, claim, authoredImpact, onComplete })` unchanged.

- [ ] **Step 1: Write the failing test**

`tests/components/ImpactStage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImpactStage } from "@/components/stages/ImpactStage";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ kind: "impact", reaction: "Strong impact." }), { status: 200 }))
  );
});

describe("ImpactStage", () => {
  it("shows the prompt and reveals Finish after a coach reaction", async () => {
    const onComplete = vi.fn();
    render(<ImpactStage motion="m" claim="c" authoredImpact="a" onComplete={onComplete} />);
    expect(screen.getByText(/so what\? why does this claim matter/i)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "kids get more sleep");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/strong impact/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /finish this side/i }));
    expect(onComplete).toHaveBeenCalledWith("kids get more sleep");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/ImpactStage.test.tsx`
Expected: FAIL — assertion library aside, this passes only once ImpactStage keeps its prompt/flow after the re-skin; run it first to confirm the file is the guard (it will actually PASS against the current component since behavior is unchanged — that is expected; it locks the behavior before the edit). If it errors on import, the path/name is wrong — fix before proceeding.

- [ ] **Step 3: Rewrite the `return` block of `components/stages/ClaimStage.tsx`**

Add these imports at the top (keep all existing imports):

```tsx
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";
```

Replace the `return (…)` block with:

```tsx
  return (
    <div>
      <StageHeader
        eyebrow="Stage 2 · Claim"
        prompt={`What's your strongest claim ${side === "for" ? "for" : "against"} this motion?`}
      />
      <VoiceOrTextInput label="Say or type your claim" onSubmit={submit} />

      {reaction && mapped && (
        <div className="mt-3">
          <CoachBubble>{reaction}</CoachBubble>
          <div className="mt-3 rounded-lg border border-evidence bg-evidence/10 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              We&apos;ll carry this forward as
            </div>
            <p className="mt-0.5 font-medium text-foreground">{mapped.claim}</p>
          </div>
          <Button type="button" className="mt-3" onClick={() => onComplete(mapped.id)}>
            Build the link →
          </Button>
        </div>
      )}

      {fallback && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Coach unavailable — pick the claim closest to yours:</p>
          <div className="mt-2 flex flex-col gap-2">
            {claims.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                onClick={() => onComplete(c.id)}
              >
                {c.claim}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
```

- [ ] **Step 4: Rewrite the `return` block of `components/stages/ImpactStage.tsx`**

Add these imports at the top (keep all existing imports):

```tsx
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";
```

Replace the `return (…)` block with:

```tsx
  return (
    <div>
      <StageHeader eyebrow="Stage 4 · Impact" prompt="So what? Why does this claim matter — what's the bigger consequence?" />
      <VoiceOrTextInput label="Say or type the impact" onSubmit={submit} />
      {reaction && <CoachBubble className="mt-3">{reaction}</CoachBubble>}
      {error && <p className="mt-3 text-muted-foreground">Coach unavailable — keep going.</p>}
      {(reaction || error) && (
        <Button type="button" className="mt-3" onClick={() => onComplete(saved)}>
          Finish this side ✓
        </Button>
      )}
    </div>
  );
```

- [ ] **Step 5: Run tests, full suite, tsc, build**

Run: `npm test -- tests/components/ClaimStage.test.tsx tests/components/ImpactStage.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: ClaimStage + ImpactStage tests PASS (prompts, "Build the link →", fallback picker, "Finish this side ✓" preserved); full suite PASS (FlowShell "against this motion" assertion still matches the ClaimStage prompt); tsc clean; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/stages/ClaimStage.tsx components/stages/ImpactStage.tsx tests/components/ImpactStage.test.tsx
git commit -m "feat: redesign Claim + Impact stages (StageHeader, coach bubble, carry-forward card)"
```

---

### Task 4: Bridge component (piers / span / beams / materials tray)

**Files:**
- Create: `components/stages/Bridge.tsx`
- Test: `tests/components/Bridge.test.tsx`

**Interfaces:**
- Consumes: `LinkScenario`, `LinkCandidate` (`@/lib/schemas`); `BridgeGrade`, `PlankStatus` (`@/lib/linkGrade`); `Badge` (`@/components/ui/badge`); `Button` (`@/components/ui/button`); `CoachBubble` (Task 1); `cn` (`@/lib/utils`).
- Produces:
  ```ts
  Bridge({
    claim: string;
    impact: string;
    candidates: LinkCandidate[];
    placedIds: string[];
    grade: BridgeGrade | null;
    reactions: Record<string, string>;
    coachError: Record<string, boolean>;
    onToggle: (id: string) => void;
    onTalkThrough: (c: LinkCandidate) => void;
  })
  ```
  Renders the Claim/Impact piers, a span holding placed planks (beams) with "Set aside" controls, and a materials tray of unplaced planks with "Build" controls; per-plank feedback + "Talk this through" + coach reaction appear once `grade` is set. Build/Set-aside `aria-label`s are exactly `Build ${c.text}` / `Set aside ${c.text}`.

- [ ] **Step 1: Write the failing test**

`tests/components/Bridge.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bridge } from "@/components/stages/Bridge";
import type { LinkCandidate } from "@/lib/schemas";

const candidates: LinkCandidate[] = [
  { id: "e1", text: "Studies tie homework to stress.", material: "evidence", verdict: "fits", explanation: "x" },
  { id: "r1", text: "Frees evenings for family.", material: "reasoning", verdict: "fits", explanation: "y" },
];

function renderBridge(placedIds: string[]) {
  render(
    <Bridge
      claim="Ban homework."
      impact="More family time."
      candidates={candidates}
      placedIds={placedIds}
      grade={null}
      reactions={{}}
      coachError={{}}
      onToggle={() => {}}
      onTalkThrough={() => {}}
    />
  );
}

describe("Bridge", () => {
  it("renders the claim and impact piers", () => {
    renderBridge([]);
    expect(screen.getByText("Ban homework.")).toBeInTheDocument();
    expect(screen.getByText("More family time.")).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
  });

  it("puts unplaced planks in the materials tray with a Build control", () => {
    renderBridge([]);
    expect(screen.getByRole("button", { name: /build .*stress/i })).toBeInTheDocument();
    expect(screen.getByText(/no planks yet/i)).toBeInTheDocument();
  });

  it("shows a placed plank in the span with a Set aside control", () => {
    renderBridge(["e1"]);
    expect(screen.getByRole("button", { name: /set aside .*stress/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/Bridge.test.tsx`
Expected: FAIL — module `@/components/stages/Bridge` does not exist.

- [ ] **Step 3: Create `components/stages/Bridge.tsx`**

```tsx
"use client";
import type { LinkCandidate } from "@/lib/schemas";
import type { BridgeGrade, PlankStatus } from "@/lib/linkGrade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CoachBubble } from "@/components/CoachBubble";
import { cn } from "@/lib/utils";

export function Bridge({
  claim,
  impact,
  candidates,
  placedIds,
  grade,
  reactions,
  coachError,
  onToggle,
  onTalkThrough,
}: {
  claim: string;
  impact: string;
  candidates: LinkCandidate[];
  placedIds: string[];
  grade: BridgeGrade | null;
  reactions: Record<string, string>;
  coachError: Record<string, boolean>;
  onToggle: (id: string) => void;
  onTalkThrough: (c: LinkCandidate) => void;
}) {
  const placedSet = new Set(placedIds);
  const placed = candidates.filter((c) => placedSet.has(c.id));
  const unplaced = candidates.filter((c) => !placedSet.has(c.id));
  const statusOf = (id: string): PlankStatus | undefined =>
    grade?.perPlank.find((p) => p.id === id)?.status;
  const held = grade?.held ?? false;

  function feedback(c: LinkCandidate) {
    const status = statusOf(c.id);
    if (!grade || !status || status === "correct-omit") return null;
    return (
      <div className={cn("mt-2 text-sm", status === "correct" ? "text-success" : "text-reasoning")}>
        {status === "correct" && "✓ Holds — good plank."}
        {status === "missing" && <>This one actually fits — you left it out. {c.explanation}</>}
        {status === "wrong" && (
          <>{(c.verdict === "great-but-wrong" ? "🪤 Great but wrong — " : "Doesn't fit — ") + c.explanation}</>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => onTalkThrough(c)}>
            💬 Talk this through
          </Button>
          {coachError[c.id] && <span className="text-muted-foreground">Coach unavailable — keep going.</span>}
        </div>
        {reactions[c.id] && <CoachBubble className="mt-2">{reactions[c.id]}</CoachBubble>}
      </div>
    );
  }

  function plankRow(c: LinkCandidate, isPlaced: boolean) {
    const status = statusOf(c.id);
    const stateRing =
      status === "wrong" ? "ring-1 ring-destructive" : status === "correct" ? "ring-1 ring-success" : "";
    return (
      <div key={c.id} className={cn("rounded-lg border border-border bg-card p-3", stateRing)}>
        <div className="flex items-start gap-3">
          <Badge variant={c.material === "evidence" ? "evidence" : "reasoning"} className="mt-0.5 shrink-0 capitalize">
            {c.material}
          </Badge>
          <div className="flex-1 text-sm leading-snug text-foreground">{c.text}</div>
          <Button
            type="button"
            variant={isPlaced ? "secondary" : "default"}
            size="sm"
            aria-label={`${isPlaced ? "Set aside" : "Build"} ${c.text}`}
            onClick={() => onToggle(c.id)}
          >
            {isPlaced ? "Set aside" : "Build"}
          </Button>
        </div>
        {feedback(c)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {/* Claim pier */}
        <div className="rounded-lg border border-border bg-muted/40 p-3 md:w-48 md:shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Claim</div>
          <div className="font-display text-sm leading-snug text-foreground">{claim}</div>
        </div>

        {/* Span / deck */}
        <div
          className={cn(
            "flex-1 rounded-lg border-2 border-dashed p-3 transition-colors",
            held ? "border-success bg-success/5" : placed.length ? "border-border" : "border-border bg-muted/20"
          )}
        >
          {placed.length === 0 ? (
            <div className="flex h-full min-h-[64px] items-center justify-center text-center text-sm text-muted-foreground">
              No planks yet — build the span from the materials below.
            </div>
          ) : (
            <div className="space-y-2">{placed.map((c) => plankRow(c, true))}</div>
          )}
        </div>

        {/* Impact pier */}
        <div className="rounded-lg border border-evidence bg-evidence/10 p-3 md:w-48 md:shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-evidence">Impact</div>
          <div className="font-display text-sm leading-snug text-foreground">{impact}</div>
        </div>
      </div>

      {/* Materials tray */}
      {unplaced.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Materials</div>
          <div className="space-y-2">{unplaced.map((c) => plankRow(c, false))}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test + tsc**

Run: `npm test -- tests/components/Bridge.test.tsx && npx tsc --noEmit`
Expected: PASS (piers render "Claim"/"Impact" + text; unplaced → tray with "Build …stress" + "No planks yet"; placed → span with "Set aside …stress"); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add components/stages/Bridge.tsx tests/components/Bridge.test.tsx
git commit -m "feat: add Bridge visual (piers, span/beams, materials tray)"
```

---

### Task 5: LinkCard rewrite (orchestrator wiring Bridge)

**Files:**
- Rewrite: `components/LinkCard.tsx`

**Interfaces:**
- Consumes: `useLinkProgress`, `gradeBridge`/`BridgeGrade`, `speakCoach`, `LinkScenario`/`LinkCandidate`/`CoachResponse` (existing); `StageHeader` (Task 1); `Bridge` (Task 4); `Button` (existing).
- Produces: `LinkCard({ scenario, onExit?, onComplete? })` — same call sites (`onExit` accepted but no longer rendered; behavior preserved).

- [ ] **Step 1: Confirm the existing LinkCard tests are the guard**

The re-skin must keep `tests/components/LinkCard.test.tsx` and `tests/components/LinkCard.onComplete.test.tsx` green (build/set-aside aria-labels, "Test the bridge", "bridge holds", great-but-wrong explanation, "needs both", "talk this through" coach reaction, localStorage restore, "Continue →" firing onComplete).

Run: `npm test -- tests/components/LinkCard.test.tsx tests/components/LinkCard.onComplete.test.tsx`
Expected: PASS (baseline before the rewrite).

- [ ] **Step 2: Rewrite `components/LinkCard.tsx`**

```tsx
"use client";
import { useState } from "react";
import { gradeBridge, type BridgeGrade } from "@/lib/linkGrade";
import { useLinkProgress } from "@/lib/state/useLinkProgress";
import { speakCoach } from "@/lib/voice/playSpeech";
import type { LinkScenario, LinkCandidate, CoachResponse } from "@/lib/schemas";
import { StageHeader } from "@/components/stages/StageHeader";
import { Bridge } from "@/components/stages/Bridge";
import { Button } from "@/components/ui/button";

export function LinkCard({
  scenario,
  onComplete,
}: {
  scenario: LinkScenario;
  onExit?: () => void;
  onComplete?: () => void;
}) {
  const [progress, update] = useLinkProgress(scenario.id);
  const placed = progress.placedIds;
  const [grade, setGrade] = useState<BridgeGrade | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [coachError, setCoachError] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setGrade(null); // re-sorting invalidates the last test
    const next = placed.includes(id) ? placed.filter((x) => x !== id) : [...placed, id];
    update({ placedIds: next });
  }

  function test() {
    const g = gradeBridge(scenario, placed);
    setGrade(g);
    update({ held: g.held });
  }

  async function talkThrough(c: LinkCandidate) {
    setCoachError((e) => ({ ...e, [c.id]: false }));
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "link",
          motion: scenario.claim,
          payload: { impact: scenario.impact, candidateText: c.text, verdict: c.verdict },
        }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind === "link") {
        setReactions((r) => ({ ...r, [c.id]: data.reaction }));
        void speakCoach(data.reaction);
      }
    } catch {
      setCoachError((e) => ({ ...e, [c.id]: true }));
    }
  }

  return (
    <div>
      <StageHeader eyebrow="Stage 3 · Link" />
      <p className="mb-4 text-sm text-muted-foreground">
        Build the bridge: choose the planks that connect the claim to the impact. Strong bridges use{" "}
        <span className="font-medium text-evidence">evidence</span> and{" "}
        <span className="font-medium text-reasoning">reasoning</span> together.
      </p>

      <Bridge
        claim={scenario.claim}
        impact={scenario.impact}
        candidates={scenario.candidates}
        placedIds={placed}
        grade={grade}
        reactions={reactions}
        coachError={coachError}
        onToggle={toggle}
        onTalkThrough={talkThrough}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={test}>
          Test the bridge
        </Button>
        {grade &&
          (grade.held ? (
            <span className="font-semibold text-success">✓ The bridge holds!</span>
          ) : (
            <span className="text-reasoning">
              Not yet
              {!(grade.hasEvidence && grade.hasReasoning)
                ? " — a strong bridge needs both evidence and reasoning."
                : " — check the flagged planks."}
            </span>
          ))}
      </div>

      {onComplete && grade?.held && (
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={onComplete}>
            Continue →
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run LinkCard tests, full suite, tsc, build**

Run: `npm test -- tests/components/LinkCard.test.tsx tests/components/LinkCard.onComplete.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: LinkCard tests PASS unchanged (holds; great-but-wrong "argues the other way"; evidence-only "both"; talk-this-through coach reaction; localStorage "Set aside …stress" on mount; "Continue →" fires onComplete / absent when onComplete omitted); full suite PASS; tsc clean; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/LinkCard.tsx
git commit -m "feat: rebuild LinkCard on the light Bridge visual; drop legacy back button"
```

---

## Manual verification (after Task 5)

Not automated — do once with the app running (`npm run dev`, authed):

1. Open a motion → Restate shows a "The motion" quote + `Stage 1 · Read`; a coach reaction renders in a soft bubble; `Next: keywords →`.
2. Keywords are visibly tappable (dashed gold underline, hover tint); tapping one shows the scope question, its hint, and a coach bubble; `Next: claim →`.
3. Claim → `Stage 2 · Claim`, prompt, input; coach maps the claim into a gold "We'll carry this forward as" card; `Build the link →`.
4. Link → the bridge: Claim and Impact piers with an empty dashed span; Build planks → they move into the span as gold/orange beams; Test the bridge → the span turns success-green with "✓ The bridge holds!", or shows the flagged-plank / both-materials message; a flagged plank shows its explanation + "Talk this through" (coach bubble); Continue → advances.
5. Impact → `Stage 4 · Impact`, prompt, input, coach bubble, `Finish this side ✓`.
6. Resize to mobile → the bridge stacks Claim → span → Impact vertically; all stages stay readable and usable.

---

## Self-Review

**Spec coverage:**
- Shared `StageHeader` + `CoachBubble` → Task 1. ✓
- RestateStep (motion quote, StageHeader, coach bubble) + KeywordStep (tappable keywords, hint, coach bubble) → Task 2. ✓
- ClaimStage (StageHeader, coach bubble, carry-forward card, fallback picker) + ImpactStage (StageHeader, coach bubble) → Task 3. ✓
- Structural `Bridge` (piers, span/beams, materials tray, per-plank feedback, hold/gap) → Task 4. ✓
- LinkCard as orchestrator wiring Bridge; instruction line; Test/verdict/Continue; back button removed (`onExit` kept in type) → Task 5. ✓
- Zero behavior change; every asserted string/aria-label preserved → guarded by existing FlowShell/ClaimStage/LinkCard/VoiceOrTextInput tests + new tests. ✓
- Untouched files (VoiceOrTextInput, state hooks, linkGrade, coach API, voice, schemas) → respected. ✓
- Gates green each task → all tasks. ✓
- Non-goals (no behavior/state/coach/voice/schema/routing/content changes; no dark mode) → respected. ✓

**Placeholder scan:** No TBD/TODO; every new/edited file given as full file or full replacement `return` block + explicit added imports; all tests have concrete assertions. ✓

**Type consistency:** `StageHeader`/`CoachBubble`/`Bridge` prop shapes are defined once (Task 1/4) and consumed with matching props (Tasks 2/3/5); `Bridge` props match what LinkCard passes (`claim`, `impact`, `candidates`, `placedIds`, `grade`, `reactions`, `coachError`, `onToggle`, `onTalkThrough`); `PlankStatus`/`BridgeGrade` imported from `@/lib/linkGrade`; `LinkCandidate`/`LinkScenario` from `@/lib/schemas`; Badge variants `evidence`/`reasoning` and Button variants `default`/`secondary`/`outline`/`ghost` exist in the foundation; all preserved strings match the test assertions verbatim. ✓
