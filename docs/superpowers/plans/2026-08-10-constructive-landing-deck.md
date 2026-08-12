# Constructive — Landing + Motion Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the app entry (`/`) on the design system — a welcoming hero + a mini Claim→Link→Impact strip and the motion picker as responsive cards with per-motion progress — plus the reusable AppShell/header, while preserving the exact select→journey behavior.

**Architecture:** Add two pure helpers to the progress store (`loadAllFlowProgress` + `motionStatus`), build a reusable `AppShell` (header + max-width container) and a presentational `Landing` (hero + CLI strip), then re-skin `FlowDeck` to compose them plus a grid of accessible motion Cards that surface progress read hydration-safely from localStorage. The flow shell and stages are untouched.

**Tech Stack:** Next.js 14 (App Router, TS strict), React 18, Tailwind + the owned shadcn primitives (`Card`, `Badge`), `useState`/`useEffect`, Vitest + React Testing Library + jsdom.

## Global Constraints

- Design-system only: use the theme tokens and `components/ui/*` primitives; no inline hex.
- Light-first; brand-blue primary; `evidence` gold / `reasoning` orange accents.
- `AppShell`: a `sticky top-0` header with the "Constructive" Fraunces wordmark on `bg-background/80` + `border-b border-border`; a centered `max-w-5xl` `main` with responsive padding.
- Landing: a Fraunces hero headline + one subline; a 3-tile **Claim → Link → Impact** strip (the Link tile hints `evidence`/`reasoning`), responsive (stacks on mobile).
- Motion cards: each is a **single `<button>`** styled with card classes, containing only non-interactive content (motion text, status `Badge` div, Start/Resume text); `aria-label` = motion text + status; clicking runs the current `setActiveId(m.id)` → render `FlowShell`. Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- `motionStatus(entry)`: `undefined`→`not-started`; both flags→`complete`; `forComplete` only→`for-done`; else→`in-progress`. Badge/CTA per status; `complete` uses the `success` Badge variant.
- Progress read hydration-safely: initial render all `not-started`, then a `useEffect` loads `loadAllFlowProgress(window.localStorage)` (no SSR mismatch).
- No content/schema/coach/voice/routing/API changes; the flow shell + stages keep their current look.
- Each task ends green: `npm test` (full suite), `npx tsc --noEmit`, and (Task 3) `npm run build`.

## File Structure

```
lib/state/flowProgress.ts        # Modify — add loadAllFlowProgress + motionStatus + MotionStatus type (Task 1)
tests/lib/state/flowStatus.test.ts  # Create (Task 1)
components/ui/app-shell.tsx       # Create — header + container (Task 2)
components/Landing.tsx            # Create — hero + CLI strip (Task 2)
tests/components/ui/app-shell.test.tsx  # Create (Task 2)
tests/components/Landing.test.tsx       # Create (Task 2)
components/FlowDeck.tsx           # Modify — compose AppShell + Landing + card grid w/ progress (Task 3)
tests/components/FlowDeck.test.tsx       # Create (Task 3)
```

---

### Task 1: Progress helpers — `loadAllFlowProgress` + `motionStatus`

**Files:**
- Modify: `lib/state/flowProgress.ts` (append exports; do not change existing behavior)
- Test: `tests/lib/state/flowStatus.test.ts`

**Interfaces:**
- Consumes: the existing private `readAll(storage)` and `FlowProgress`/`emptyFlowProgress`/`saveFlowProgress` in `lib/state/flowProgress.ts`.
- Produces:
  - `type MotionStatus = "not-started" | "in-progress" | "for-done" | "complete"`
  - `loadAllFlowProgress(storage: Storage): Record<string, FlowProgress>`
  - `motionStatus(entry: FlowProgress | undefined): MotionStatus`

- [ ] **Step 1: Write the failing test** — `tests/lib/state/flowStatus.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  motionStatus,
  loadAllFlowProgress,
  saveFlowProgress,
  emptyFlowProgress,
} from "@/lib/state/flowProgress";

describe("motionStatus", () => {
  it("is not-started for an absent entry", () => {
    expect(motionStatus(undefined)).toBe("not-started");
  });
  it("is complete when both sides are done", () => {
    expect(motionStatus({ ...emptyFlowProgress(), forComplete: true, againstComplete: true })).toBe("complete");
  });
  it("is for-done when only FOR is done", () => {
    expect(motionStatus({ ...emptyFlowProgress(), forComplete: true })).toBe("for-done");
  });
  it("is in-progress for a started-but-unfinished entry", () => {
    expect(motionStatus({ ...emptyFlowProgress(), stage: "claim" })).toBe("in-progress");
  });
});

describe("loadAllFlowProgress", () => {
  beforeEach(() => localStorage.clear());
  it("returns every saved motion's progress", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), forComplete: true });
    saveFlowProgress(localStorage, "m2", { ...emptyFlowProgress(), stage: "link" });
    const all = loadAllFlowProgress(localStorage);
    expect(Object.keys(all).sort()).toEqual(["m1", "m2"]);
    expect(all.m1.forComplete).toBe(true);
  });
  it("tolerates corrupt storage", () => {
    localStorage.setItem("constructive:flow:v1", "{nope");
    expect(loadAllFlowProgress(localStorage)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/state/flowStatus.test.ts`
Expected: FAIL — `motionStatus` / `loadAllFlowProgress` not exported.

- [ ] **Step 3: Append to `lib/state/flowProgress.ts`** (at the end of the file; leave existing exports and the private `readAll` unchanged)

```ts
export type MotionStatus = "not-started" | "in-progress" | "for-done" | "complete";

export function loadAllFlowProgress(storage: Storage): Record<string, FlowProgress> {
  return readAll(storage);
}

export function motionStatus(entry: FlowProgress | undefined): MotionStatus {
  if (!entry) return "not-started";
  if (entry.forComplete && entry.againstComplete) return "complete";
  if (entry.forComplete) return "for-done";
  return "in-progress";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/state/flowStatus.test.ts && npx tsc --noEmit`
Expected: PASS (all cases); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lib/state/flowProgress.ts tests/lib/state/flowStatus.test.ts
git commit -m "feat: loadAllFlowProgress + motionStatus for deck progress"
```

---

### Task 2: AppShell + Landing

**Files:**
- Create: `components/ui/app-shell.tsx`, `components/Landing.tsx`
- Test: `tests/components/ui/app-shell.test.tsx`, `tests/components/Landing.test.tsx`

**Interfaces:**
- Consumes: `Card`, `CardContent` from `@/components/ui/card` (foundation); theme classes.
- Produces:
  - `AppShell({ children }: { children: React.ReactNode })`
  - `Landing()` — presentational, no props.

- [ ] **Step 1: Write the failing tests**

`tests/components/ui/app-shell.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/ui/app-shell";

describe("AppShell", () => {
  it("renders the wordmark header and its children", () => {
    render(<AppShell><p>page body</p></AppShell>);
    expect(screen.getByText("Constructive")).toBeInTheDocument();
    expect(screen.getByText("page body")).toBeInTheDocument();
  });
});
```

`tests/components/Landing.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Landing } from "@/components/Landing";

describe("Landing", () => {
  it("renders the hero and the Claim → Link → Impact strip", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { name: /build an argument/i })).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("evidence")).toBeInTheDocument();
    expect(screen.getByText("reasoning")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/components/ui/app-shell.test.tsx tests/components/Landing.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `components/ui/app-shell.tsx`**

```tsx
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
          <span className="font-display text-xl font-semibold text-foreground">Constructive</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/Landing.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  { label: "Claim", blurb: "Your position — what you believe and why." },
  { label: "Link", blurb: "The bridge from your claim to why it matters." },
  { label: "Impact", blurb: "So what? The bigger consequence." },
];

export function Landing() {
  return (
    <section>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Build an argument, one idea at a time.
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Debate is a search for what&apos;s true, not a fight to win. Make a claim, build the
        bridge to why it matters, and see the impact.
      </p>
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/components/ui/app-shell.test.tsx tests/components/Landing.test.tsx && npx tsc --noEmit`
Expected: PASS (both files); tsc clean.

- [ ] **Step 6: Commit**

```bash
git add components/ui/app-shell.tsx components/Landing.tsx tests/components/ui/app-shell.test.tsx tests/components/Landing.test.tsx
git commit -m "feat: AppShell (header + container) and Landing (hero + CLI strip)"
```

---

### Task 3: Re-skin FlowDeck with progress-aware cards

**Files:**
- Modify: `components/FlowDeck.tsx`
- Test: `tests/components/FlowDeck.test.tsx`

**Interfaces:**
- Consumes: `getFlowMotions` (unchanged), `FlowShell` (unchanged), `AppShell` (Task 2), `Landing` (Task 2), `Badge` (foundation), `loadAllFlowProgress`/`motionStatus`/`MotionStatus`/`FlowProgress` (Task 1 + store).
- Produces: the re-skinned `/` entry; select→FlowShell behavior preserved.

- [ ] **Step 1: Write the failing test** — `tests/components/FlowDeck.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowDeck } from "@/components/FlowDeck";
import { FLOW_STORAGE_KEY } from "@/lib/state/flowProgress";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ kind: "restate", reaction: "ok", capturedCore: true }), { status: 200 })));
});

describe("FlowDeck", () => {
  it("renders the landing, the CLI strip, and a card per motion", () => {
    render(<FlowDeck />);
    expect(screen.getByRole("heading", { name: /build an argument/i })).toBeInTheDocument();
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /pick a motion/i })).toBeInTheDocument();
    // The kids-vote motion is in the real bank; its card is an accessible button.
    expect(screen.getByRole("button", { name: /let kids vote/i })).toBeInTheDocument();
  });

  it("opens the journey when a motion card is clicked", async () => {
    render(<FlowDeck />);
    await userEvent.click(screen.getByRole("button", { name: /let kids vote/i }));
    // FlowShell → RestateStep prompt.
    expect(await screen.findByText(/your own words/i)).toBeInTheDocument();
  });

  it("shows the completed badge for a finished motion (hydrated from localStorage)", async () => {
    localStorage.setItem(
      FLOW_STORAGE_KEY,
      JSON.stringify({
        "m-kids-vote": {
          side: "against", stage: "impact", readSubstep: "restate", restate: "x",
          keywordAnswers: {}, mappedClaimId: "a-maturity", impact: "y",
          forComplete: true, againstComplete: true,
        },
      })
    );
    render(<FlowDeck />);
    expect(await screen.findByText(/both sides/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/FlowDeck.test.tsx`
Expected: FAIL — the current FlowDeck has no "Build an argument" hero, no "Pick a motion" heading, and no completed badge.

- [ ] **Step 3: Rewrite `components/FlowDeck.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { getFlowMotions } from "@/lib/flowMotions";
import { FlowShell } from "@/components/FlowShell";
import { AppShell } from "@/components/ui/app-shell";
import { Landing } from "@/components/Landing";
import { Badge } from "@/components/ui/badge";
import {
  loadAllFlowProgress,
  motionStatus,
  type MotionStatus,
  type FlowProgress,
} from "@/lib/state/flowProgress";

const STATUS_META: Record<
  MotionStatus,
  { label: string; badge: string; variant: "secondary" | "default" | "success"; cta: string }
> = {
  "not-started": { label: "Not started", badge: "New", variant: "secondary", cta: "Start" },
  "in-progress": { label: "In progress", badge: "In progress", variant: "default", cta: "Resume" },
  "for-done": { label: "FOR side done", badge: "FOR done", variant: "default", cta: "Resume" },
  complete: { label: "Both sides done", badge: "✓ Both sides", variant: "success", cta: "Review" },
};

export function FlowDeck() {
  const motions = getFlowMotions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, FlowProgress>>({});

  useEffect(() => {
    setProgress(loadAllFlowProgress(window.localStorage));
  }, []);

  const active = motions.find((m) => m.id === activeId);
  if (active) return <FlowShell motion={active} onExit={() => setActiveId(null)} />;

  return (
    <AppShell>
      <Landing />
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold text-foreground">Pick a motion</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {motions.map((m) => {
            const status = motionStatus(progress[m.id]);
            const meta = STATUS_META[status];
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveId(m.id)}
                aria-label={`${m.motion} — ${meta.label}`}
                data-complete={status === "complete"}
                className="group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[complete=true]:ring-1 data-[complete=true]:ring-success"
              >
                <Badge variant={meta.variant} className="self-start">
                  {meta.badge}
                </Badge>
                <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">
                  {m.motion}
                </div>
                <div className="mt-auto pt-4 text-sm font-semibold text-primary">{meta.cta} →</div>
              </button>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
```

- [ ] **Step 4: Run the FlowDeck test, full suite, tsc, and build**

Run: `npm test -- tests/components/FlowDeck.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: FlowDeck test PASSES (hero + strip + "Pick a motion" + a card per motion; clicking a card opens the journey; a pre-seeded completed motion shows "✓ Both sides" after hydration); full suite PASSES; tsc clean; `next build` succeeds (routes unchanged).

- [ ] **Step 5: Commit**

```bash
git add components/FlowDeck.tsx tests/components/FlowDeck.test.tsx
git commit -m "feat: re-skin the deck — landing + progress-aware motion cards"
```

---

## Manual verification (after Task 3)

Not automated — do once with the app running (`npm run dev`, authed):

1. `/` shows the AppShell header (Constructive wordmark), a Fraunces hero, the Claim → Link → Impact strip (evidence gold / reasoning orange dots on Link), then "Pick a motion" and a responsive card grid.
2. Cards are keyboard-focusable with visible rings; each opens its journey; the flow shell still renders (its current dark look — expected until re-skinned later).
3. Complete a motion's FOR (or both) sides, return to `/` (← motions) → that card's badge updates to "FOR done" / "✓ Both sides" and the CTA reads "Resume"/"Review".
4. Resize to mobile → hero, strip, and grid stack to a single column; header stays put.

---

## Self-Review

**Spec coverage:**
- AppShell (sticky header + wordmark + max-w-5xl container) → Task 2. ✓
- Landing hero + Claim/Link/Impact strip (evidence/reasoning hint) → Task 2. ✓
- Motion cards: single `<button>`, motion + status Badge + Start/Resume, aria-label, grid, select→FlowShell preserved → Task 3. ✓
- `motionStatus` derivation + `loadAllFlowProgress` → Task 1. ✓
- Hydration-safe progress read (default → useEffect) → Task 3. ✓
- `complete` uses `success` Badge variant → Task 3 (STATUS_META). ✓
- No content/coach/routing changes; flow shell/stages untouched → confirmed (only these files change). ✓
- Testing: motionStatus/loadAll units, AppShell + Landing renders, FlowDeck render + click-opens-journey + completed badge → Tasks 1–3. ✓
- Non-goals respected. ✓

**Placeholder scan:** No TBD/TODO; every file's full contents are given; hero/strip copy is concrete. ✓

**Type consistency:** `MotionStatus`, `loadAllFlowProgress`, `motionStatus`, `FlowProgress` defined once (Task 1) and consumed in Task 3; `STATUS_META` keys are exactly the four `MotionStatus` values; `Badge` `variant` values (`secondary`/`default`/`success`) exist in the foundation badge; `AppShell`/`Landing` signatures match their FlowDeck import sites; `FLOW_STORAGE_KEY` reused in the test. ✓
