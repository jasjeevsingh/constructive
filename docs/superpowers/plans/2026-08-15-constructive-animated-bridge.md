# Constructive — Animated Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated, decorative bridge scene (planks drop into a deck as beams; a traveler crosses when the bridge holds, or it shudders when it doesn't) above the Link stage's existing, unchanged plank controls — using the shipped motion foundation, with zero grading/state/contract change and the suite staying green.

**Architecture:** A new `components/stages/BridgeScene.tsx` renders the animated bridge — two abstract piers, a deck of colored beams (gold=evidence, orange=reasoning) via `AnimatePresence`, and a minimal inline-SVG traveler — all `aria-hidden` decoration driven purely by derived props (`placed`, `testResult`). `Bridge.tsx` keeps its exact props contract and its current controls markup verbatim, and simply renders `<BridgeScene>` at the top, deriving `placed`/`testResult` from `placedIds`/`grade`.

**Tech Stack:** Next.js 14 (App Router, TS strict), React 18, `motion` (`motion/react`), Tailwind + owned shadcn primitives, Vitest + RTL + jsdom.

## Global Constraints

- Reuse the motion foundation: `motion`/`AnimatePresence`/`useReducedMotion` from `motion/react`; `transitions` from `lib/motion.ts`. No new dependency.
- **`BridgeScene` is `aria-hidden` decoration** — it conveys nothing the controls don't, and must render NO queryable text that would collide (never the literals `Claim`, `Impact`, `No planks yet…`, or any plank text). Screen-reader/keyboard users rely solely on the controls.
- **Zero change to behavior, grading, or the contract:** `LinkCard`, `lib/linkGrade.ts`, `useLinkProgress`, the coach, and `Bridge`'s props (`claim, impact, candidates, placedIds, grade, reactions, coachError, onToggle, onTalkThrough`) are untouched. `Bridge`'s existing controls markup (Claim card, span + placed rows / empty message, Impact card, Materials tray, `plankRow`/`feedback`) stays verbatim.
- **Preserve every asserted string/role/label** (`tests/components/Bridge.test.tsx`, `LinkCard.test.tsx`, `LinkCard.onComplete.test.tsx`): the `Claim`/`Impact` labels + claim/impact text; `No planks yet — build the span from the materials below.`; the `Build ${c.text}` / `Set aside ${c.text}` aria-labels; per-plank feedback (`✓ Holds — good plank.`, `This one actually fits — you left it out. `+explanation, (`🪤 Great but wrong — `|`Doesn't fit — `)+explanation); `💬 Talk this through`; `Coach unavailable — keep going.`
- **Reduced motion:** a `useReducedMotion()` branch in `BridgeScene` renders beams in place (no drop) and jumps the test sequence to its end-state (traveler at the Impact side for held; stopped partway for failed) with no timeline.
- Transform/opacity/`left`-only motion, small fixed node count (GPU-friendly). Scene testids: root `data-testid="bridge-scene"`, each beam `data-testid="bridge-beam"`.
- Each task ends green: `npm test`, `npx tsc --noEmit`, and `npm run build`.

## File Structure

```
components/stages/BridgeScene.tsx      # Create — animated decorative bridge (Task 1)
tests/components/BridgeScene.test.tsx   # Create (Task 1)
components/stages/Bridge.tsx            # Modify — render scene above unchanged controls (Task 2)
tests/components/Bridge.test.tsx        # Modify — one added scene-present assertion (Task 2)
```

---

### Task 1: `BridgeScene` — the animated decorative bridge

**Files:**
- Create: `components/stages/BridgeScene.tsx`
- Test: `tests/components/BridgeScene.test.tsx`

**Interfaces:**
- Consumes: `motion`, `AnimatePresence`, `useReducedMotion` (`motion/react`); `transitions` (`@/lib/motion`); `cn` (`@/lib/utils`).
- Produces: `BridgeScene({ placed, testResult })` where `placed: { id: string; material: "evidence" | "reasoning" }[]` and `testResult: "held" | "failed" | null`.

- [ ] **Step 1: Write the failing test** — `tests/components/BridgeScene.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BridgeScene } from "@/components/stages/BridgeScene";

const placed = [
  { id: "e1", material: "evidence" as const },
  { id: "r1", material: "reasoning" as const },
];

describe("BridgeScene", () => {
  it("renders one beam per placed plank", () => {
    render(<BridgeScene placed={placed} testResult={null} />);
    expect(screen.getAllByTestId("bridge-beam")).toHaveLength(2);
  });

  it("is decorative (aria-hidden) and shows no beams when empty", () => {
    render(<BridgeScene placed={[]} testResult={null} />);
    expect(screen.getByTestId("bridge-scene")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryAllByTestId("bridge-beam")).toHaveLength(0);
  });

  it("renders for held and failed results without crashing", () => {
    const { rerender } = render(<BridgeScene placed={placed} testResult="held" />);
    expect(screen.getByTestId("bridge-scene")).toBeInTheDocument();
    rerender(<BridgeScene placed={placed} testResult="failed" />);
    expect(screen.getByTestId("bridge-scene")).toBeInTheDocument();
    expect(screen.getAllByTestId("bridge-beam")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/BridgeScene.test.tsx`
Expected: FAIL — `@/components/stages/BridgeScene` does not exist.

- [ ] **Step 3: Create `components/stages/BridgeScene.tsx`**

```tsx
"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";

type SceneMaterial = "evidence" | "reasoning";

/** Minimal inline traveler — a swappable placeholder for the later mascot system. */
function Traveler() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="5" r="3" className="fill-primary" />
      <rect x="6.5" y="8" width="7" height="9" rx="2.5" className="fill-primary" />
    </svg>
  );
}

function Pier() {
  return <div className="h-16 w-7 shrink-0 self-end rounded-t bg-muted-foreground/25" />;
}

export function BridgeScene({
  placed,
  testResult,
}: {
  placed: { id: string; material: SceneMaterial }[];
  testResult: "held" | "failed" | null;
}) {
  const reduced = useReducedMotion() ?? false;

  const travelerState =
    testResult === "held" ? "crossed" : testResult === "failed" ? "stopped" : "idle";

  const travelerAnim =
    travelerState === "crossed"
      ? { left: "88%" }
      : travelerState === "stopped"
        ? { left: reduced ? "30%" : ["0%", "35%", "30%"] }
        : { left: "0%" };

  const travelerTransition = reduced
    ? { duration: 0 }
    : travelerState === "crossed"
      ? { duration: 0.9, ease: "easeInOut" }
      : travelerState === "stopped"
        ? { duration: 0.6, ease: "easeInOut" }
        : transitions.gentle;

  const deckWobble = testResult === "failed" && !reduced;

  return (
    <div
      aria-hidden
      data-testid="bridge-scene"
      className="mb-4 overflow-hidden rounded-xl border border-border bg-gradient-to-b from-primary/5 to-background p-4"
    >
      <div className="flex h-24 items-end gap-1">
        <Pier />
        <div className="relative flex-1 self-center">
          {/* traveler track, just above the deck */}
          <motion.div
            className="absolute -top-5 z-10"
            initial={false}
            animate={travelerAnim}
            transition={travelerTransition}
          >
            <Traveler />
          </motion.div>

          {/* deck */}
          <motion.div
            className={cn(
              "flex min-h-[16px] items-center justify-center gap-1 rounded-md p-1 transition-colors",
              testResult === "held" && "bg-success/10 ring-1 ring-success"
            )}
            animate={deckWobble ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
            transition={deckWobble ? { duration: 0.5, delay: 0.5 } : { duration: 0 }}
          >
            {placed.length === 0 ? (
              <div className="h-2 w-2/3 rounded border-2 border-dashed border-border/60" />
            ) : (
              <AnimatePresence initial={false}>
                {placed.map((p) => (
                  <motion.div
                    key={p.id}
                    data-testid="bridge-beam"
                    className={cn(
                      "h-3 w-8 rounded-sm",
                      p.material === "evidence" ? "bg-evidence" : "bg-reasoning"
                    )}
                    initial={reduced ? false : { y: -24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={reduced ? { opacity: 0 } : { y: 24, opacity: 0 }}
                    transition={reduced ? { duration: 0 } : transitions.spring}
                  />
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        </div>
        <Pier />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test + tsc**

Run: `npm test -- tests/components/BridgeScene.test.tsx && npx tsc --noEmit`
Expected: PASS (2 beams for 2 placed; empty → aria-hidden root + 0 beams; held/failed render fine). tsc clean. If tsc objects to a `transition`/`animate` inline object shape, keep the values but satisfy the type minimally (e.g. annotate the `ease` as `"easeInOut"`); do not change the animation values or the token usage.

- [ ] **Step 5: Commit**

```bash
git add components/stages/BridgeScene.tsx tests/components/BridgeScene.test.tsx
git commit -m "feat: BridgeScene — animated decorative bridge (beams + traveler)"
```

---

### Task 2: Wire `BridgeScene` into `Bridge` above the unchanged controls

**Files:**
- Modify: `components/stages/Bridge.tsx`
- Test: `tests/components/Bridge.test.tsx`

**Interfaces:**
- Consumes: `BridgeScene` (Task 1).
- Produces: no contract change — `Bridge` renders the decorative scene above its existing controls, deriving `placed`/`testResult` internally.

- [ ] **Step 1: Confirm the existing Bridge/LinkCard tests are the guard**

The controls register is unchanged, so `tests/components/Bridge.test.tsx`, `LinkCard.test.tsx`, and `LinkCard.onComplete.test.tsx` must stay green.

Run: `npm test -- tests/components/Bridge.test.tsx tests/components/LinkCard.test.tsx tests/components/LinkCard.onComplete.test.tsx`
Expected: PASS (baseline before the edit).

- [ ] **Step 2: Edit `components/stages/Bridge.tsx`** — add the import, derive values, render the scene

Add the import (after the existing `cn` import):

```tsx
import { BridgeScene } from "@/components/stages/BridgeScene";
```

Immediately after the existing line `const held = grade?.held ?? false;`, add:

```tsx
  const testResult: "held" | "failed" | null = grade == null ? null : grade.held ? "held" : "failed";
  const sceneBeams = placed.map((c) => ({ id: c.id, material: c.material }));
```

Then, in the returned JSX, insert the scene as the first child of the outer `<div>` — change:

```tsx
  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
```

to:

```tsx
  return (
    <div>
      <BridgeScene placed={sceneBeams} testResult={testResult} />
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
```

Everything else in `Bridge.tsx` (the piers, span, `plankRow`, `feedback`, Materials tray, all strings/labels) stays exactly as-is. `placed` and `c.material` already exist in scope (`placed = candidates.filter(...)`; `material` is `"evidence"|"reasoning"`).

- [ ] **Step 3: Add one scene-present assertion to `tests/components/Bridge.test.tsx`**

In the existing test that renders the piers (the one asserting `getByText("Claim")`), append:

```tsx
    expect(screen.getByTestId("bridge-scene")).toBeInTheDocument();
```

(Keep every existing assertion in that file unchanged.)

- [ ] **Step 4: Run the guard suites, full suite, tsc, build**

Run: `npm test -- tests/components/Bridge.test.tsx tests/components/LinkCard.test.tsx tests/components/LinkCard.onComplete.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: Bridge/LinkCard suites PASS (all existing assertions hold — `Claim`/`Impact`/claim/impact text still unique because the scene has no such text; `No planks yet`; Build/Set-aside; feedback; plus the new scene-present assertion; the two placed-plank scenarios now also render beams in the scene, which don't collide with any query); full suite PASS; tsc clean; `next build` succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/stages/Bridge.tsx tests/components/Bridge.test.tsx
git commit -m "feat: mount the animated bridge scene above the Link controls"
```

---

## Manual verification (after Task 2)

Not automated — do once with the app running (`npm run dev`, authed):

1. Open a Link stage (or Practice the Link) → above the readable controls, an animated bridge scene shows two piers, an empty dashed deck, and a traveler parked at the left.
2. Build an evidence plank → a **gold** beam drops into the deck; build a reasoning plank → an **orange** beam drops in. Set aside → the beam drops out.
3. Test the bridge with a holding combo → the deck glows and the **traveler crosses** to the right pier; the verdict text still reads "✓ The bridge holds!".
4. Test with a non-holding combo → the deck **shudders** and the traveler stops partway; the verdict + per-plank feedback explain why (unchanged).
5. Turn on OS "Reduce Motion" and reload → beams appear instantly, and Test jumps straight to the end-state (traveler at the right for held; stopped for failed); everything still fully usable.
6. Screen-reader/keyboard: the scene is skipped (aria-hidden); the plank buttons and feedback read exactly as before.

---

## Self-Review

**Spec coverage:**
- Animated bridge scene (piers + deck beams + traveler) as `aria-hidden` decoration → Task 1. ✓
- Beams gold=evidence / orange=reasoning; drop-in on Build, drop-out on Set aside (`AnimatePresence`) → Task 1. ✓
- Test sequence: held → traveler crosses + deck glow; failed → shudder + traveler stops; driven by `testResult` from `grade` → Tasks 1–2. ✓
- Minimal swappable traveler (inline SVG) → Task 1. ✓
- Reduced-motion branch (instant beams + end-state) → Task 1. ✓
- Scene mounted above unchanged controls; `placed`/`testResult` derived; contract preserved → Task 2. ✓
- All asserted strings/roles/labels preserved; no colliding scene text → Tasks 1–2 (scene is text-free/aria-hidden; controls verbatim). ✓
- Non-goals (no mascot system, no gamification, no grading/state/contract change) → respected. ✓
- Gates green each task → all tasks. ✓

**Placeholder scan:** No TBD/TODO; `BridgeScene` given in full; the `Bridge` edit is an exact import + 2 derived lines + 1 inserted element; tests concrete. ✓

**Type consistency:** `BridgeScene({ placed: {id,material:"evidence"|"reasoning"}[], testResult: "held"|"failed"|null })` matches what `Bridge` passes (`sceneBeams` = `placed.map(c => ({id:c.id, material:c.material}))` where `c.material` is `"evidence"|"reasoning"`; `testResult` derived as the same union). `transitions.spring`/`transitions.gentle` exist in `lib/motion.ts`. Testids (`bridge-scene`, `bridge-beam`) match between the component and both test files. The scene renders no `Claim`/`Impact`/`No planks yet`/plank text, preserving `getByText` uniqueness. ✓
