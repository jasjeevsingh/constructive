# Constructive — Motion Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `motion` animation toolkit, motion tokens, a reusable `Rise`/`Pressable` primitive, and an app-wide `prefers-reduced-motion` policy — then prove it on the deck (card grids + the shared `CoachBubble`) — with zero behavior/copy change and the suite staying green.

**Architecture:** `lib/motion.ts` holds motion tokens (transitions + the `riseIn` variant). `components/ui/motion.tsx` wraps `motion` (`motion/react`) into two thin client primitives: `Rise` (an animated `motion.div` entrance) and `Pressable` (an animated `motion.button` = entrance + hover/tap scale). `app/layout.tsx` wraps the app in `<MotionConfig reducedMotion="user">` so every animation honors the OS reduced-motion setting. The deck's three card grids and `CoachBubble` adopt the primitives.

**Tech Stack:** Next.js 14 (App Router, TS strict), React 18, `motion` (Framer Motion), Tailwind + owned shadcn primitives, Vitest + RTL + jsdom.

## Global Constraints

- Library: **`motion`**, imported from **`motion/react`** (Framer Motion's current package).
- **Reduced motion honored app-wide** via `<MotionConfig reducedMotion="user">` in `app/layout.tsx`.
- Motion tokens live in `lib/motion.ts` (single source of durations/easings/variants); components reference them, never inline magic numbers.
- Entrances use **transform/opacity only** and stay ≤ ~0.4s (GPU-friendly, no layout thrash).
- **Zero behavior/state/coach/grading/content/copy change.** Motion wrappers preserve every element's text, role, `aria-label`, `onClick`, `disabled`, and layout. The only markup change permitted is swapping a plain `<button>`/`<div>` for the motion primitive and (for the seeded deck card) moving the `data-complete` ring into a conditional `className`.
- **Tests assert end-state/presence, never tween frames.** A `window.matchMedia` stub is added to `vitest.setup.ts` so `motion`'s reduced-motion detection works in jsdom and the existing 185 tests stay green.
- Untouched this cycle: stage components' internals, `LinkCard`/`Bridge`, `FlowShell`, `PracticeShell`, state stores, coach, grading, routing, content. (The shared `CoachBubble` gains an entrance — intended, since it's a reused primitive.)
- Each task ends green: `npm test`, `npx tsc --noEmit`, and `npm run build`.

## File Structure

```
package.json                     # Modify — add `motion` dep (Task 1, via npm install)
lib/motion.ts                    # Create — tokens (transitions + riseIn) (Task 1)
components/ui/motion.tsx          # Create — Rise, Pressable (Task 1)
app/layout.tsx                   # Modify — wrap children in MotionConfig (Task 1)
vitest.setup.ts                  # Modify — matchMedia stub (Task 1)
tests/components/motion.test.tsx  # Create (Task 1)
components/FlowDeck.tsx           # Modify — seeded card → Pressable (Task 2)
components/UniverseGenerator.tsx  # Modify — generated card → Pressable (Task 2)
components/PracticeDeck.tsx       # Modify — practice card → Pressable (Task 2)
components/CoachBubble.tsx        # Modify — root → Rise (Task 2)
```

---

### Task 1: Motion toolkit (library, tokens, primitives, reduced-motion, test stub)

**Files:**
- Modify: `package.json` (via `npm install`), `app/layout.tsx`, `vitest.setup.ts`
- Create: `lib/motion.ts`, `components/ui/motion.tsx`
- Test: `tests/components/motion.test.tsx`

**Interfaces:**
- Consumes: `motion`, `MotionConfig`, `HTMLMotionProps`, types `Transition`/`Variants` (`motion/react`).
- Produces: `transitions` (`{ gentle, snappy, spring }`) + `riseIn` (`Variants`) from `@/lib/motion`; `Rise({ children, index?, className? })` and `Pressable(props: HTMLMotionProps<"button"> & { index?: number })` from `@/components/ui/motion`.

- [ ] **Step 1: Install the library**

Run: `npm install motion`
Expected: `motion` added to `package.json` dependencies and `package-lock.json`; no peer-dep errors (works with React 18.3).

- [ ] **Step 2: Add the `matchMedia` stub to `vitest.setup.ts`**

Append to the existing `vitest.setup.ts` (keep the existing `jest-dom` import and `next/font/google` mock):

```ts
// motion's reduced-motion detection calls window.matchMedia, which jsdom lacks.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
```

- [ ] **Step 3: Write the failing test** — `tests/components/motion.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rise, Pressable } from "@/components/ui/motion";

describe("motion primitives", () => {
  it("Rise renders its children", () => {
    render(<Rise>hello rise</Rise>);
    expect(screen.getByText("hello rise")).toBeInTheDocument();
  });

  it("Pressable renders a button that fires onClick", async () => {
    const onClick = vi.fn();
    render(<Pressable onClick={onClick}>press me</Pressable>);
    await userEvent.click(screen.getByRole("button", { name: /press me/i }));
    expect(onClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- tests/components/motion.test.tsx`
Expected: FAIL — `@/components/ui/motion` does not exist.

- [ ] **Step 5: Create `lib/motion.ts`**

```ts
import type { Transition, Variants } from "motion/react";

export const transitions: Record<"gentle" | "snappy" | "spring", Transition> = {
  gentle: { duration: 0.4, ease: "easeOut" },
  snappy: { duration: 0.18, ease: "easeOut" },
  spring: { type: "spring", stiffness: 320, damping: 26 },
};

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};
```

- [ ] **Step 6: Create `components/ui/motion.tsx`**

```tsx
"use client";
import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { riseIn, transitions } from "@/lib/motion";

/** Fade+rise entrance for standalone/div content. `index` staggers grids/lists. */
export function Rise({
  children,
  index = 0,
  className,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={riseIn}
      initial="hidden"
      animate="show"
      transition={{ ...transitions.gentle, delay: index * 0.05 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * An animated button: the same fade+rise entrance (staggered by `index`) plus a
 * subtle hover/tap scale. Drop-in for an existing <button> — forwards all button
 * props (className, onClick, aria-label, disabled, type, children).
 */
export function Pressable({ index = 0, ...props }: HTMLMotionProps<"button"> & { index?: number }) {
  return (
    <motion.button
      variants={riseIn}
      initial="hidden"
      animate="show"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ ...transitions.gentle, delay: index * 0.05 }}
      {...props}
    />
  );
}
```

- [ ] **Step 7: Wrap the app in `MotionConfig`** — edit `app/layout.tsx`

Add the import (after the existing imports):

```tsx
import { MotionConfig } from "motion/react";
```

Replace `<body>{children}</body>` with:

```tsx
      <body>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
```

(`MotionConfig` is a client component rendered from the server layout — standard provider pattern; server-rendered `children` pass through unchanged.)

- [ ] **Step 8: Run the new test, full suite, tsc, build**

Run: `npm test -- tests/components/motion.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: motion test PASSES (Rise renders children; Pressable is a clickable button); full suite PASS (the `matchMedia` stub keeps everything green; `MotionConfig` wrapping changes no visible output); tsc clean; `next build` succeeds.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json lib/motion.ts components/ui/motion.tsx app/layout.tsx vitest.setup.ts tests/components/motion.test.tsx
git commit -m "feat: motion foundation — motion lib, tokens, Rise/Pressable, reduced-motion"
```

---

### Task 2: Deck proof — adopt the primitives on the deck + CoachBubble

**Files:**
- Modify: `components/FlowDeck.tsx`, `components/UniverseGenerator.tsx`, `components/PracticeDeck.tsx`, `components/CoachBubble.tsx`

**Interfaces:**
- Consumes: `Rise`, `Pressable` (`@/components/ui/motion`); `cn` (`@/lib/utils`).
- Produces: no signature changes — the deck's card buttons and the coach bubble are motion-wrapped; all text/roles/handlers/labels preserved.

- [ ] **Step 1: Confirm the existing deck/coach tests are the guard**

These edits must keep `tests/components/FlowDeck.test.tsx`, `tests/components/PracticeDeck.test.tsx`, `tests/components/UniverseGenerator.test.tsx`, `tests/components/PracticeShell.test.tsx`, and `tests/components/CoachBubble.test.tsx` green (they assert text/roles/labels/handlers, which the motion wrappers preserve).

Run: `npm test -- tests/components/FlowDeck.test.tsx tests/components/PracticeDeck.test.tsx tests/components/UniverseGenerator.test.tsx tests/components/CoachBubble.test.tsx`
Expected: PASS (baseline before the edits).

- [ ] **Step 2: `components/CoachBubble.tsx`** — make the root a `Rise`

Replace the whole file with:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Rise } from "@/components/ui/motion";

export function CoachBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Rise className={cn("flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground", className)}>
      <span aria-hidden className="text-base leading-none">💬</span>
      <div className="flex-1">{children}</div>
    </Rise>
  );
}
```

- [ ] **Step 3: `components/PracticeDeck.tsx`** — card `<button>` → `<Pressable index={i}>`

Add the import (after the existing `Badge` import):

```tsx
import { Pressable } from "@/components/ui/motion";
```

In the `CARDS.map(...)`, add the index param and swap the element. Change `{CARDS.map((c) => (` to `{CARDS.map((c, i) => (`, then replace the opening `<button` tag with `<Pressable index={i}` and the closing `</button>` with `</Pressable>`. The full card becomes:

```tsx
        {CARDS.map((c, i) => (
          <Pressable
            key={c.part}
            index={i}
            type="button"
            onClick={() => onPick(c.part)}
            aria-label={`${c.title} — ${counts[c.part]} done`}
            className="group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Badge variant="secondary" className="self-start">{counts[c.part]} done</Badge>
            <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">{c.title}</div>
            <div className="mt-2 text-sm text-muted-foreground">{c.blurb}</div>
            <div className="mt-auto pt-4 text-sm font-semibold text-primary">Start drilling →</div>
          </Pressable>
        ))}
```

- [ ] **Step 4: `components/UniverseGenerator.tsx`** — generated card `<button>` → `<Pressable index={i}>`

Add the import (after the existing `Input` import):

```tsx
import { Pressable } from "@/components/ui/motion";
```

In the generated-cards map, add the index param and swap the element. Change `{u.motions.map((card) => (` to `{u.motions.map((card, i) => (`, then replace the opening `<button` with `<Pressable index={i}` and the closing `</button>` with `</Pressable>`. The card becomes:

```tsx
            {u.motions.map((card, i) => (
              <Pressable
                key={card.id}
                index={i}
                type="button"
                onClick={() => void openCard(key, card)}
                disabled={openingId === card.id}
                aria-label={`${card.motion} — ${card.sides ? "resume" : "start"}`}
                className="group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
              >
                <Badge variant="secondary" className="self-start">✨ Generated</Badge>
                <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">{card.motion}</div>
                <div className="mt-2 text-sm text-muted-foreground">{card.hook}</div>
                <div className="mt-3 text-sm font-medium text-primary">
                  {openingId === card.id ? "Building…" : card.sides ? "Resume →" : "Start →"}
                </div>
              </Pressable>
            ))}
```

- [ ] **Step 5: `components/FlowDeck.tsx`** — seeded card `<button>` → `<Pressable index={i}>` (move `data-complete` into `className`)

Add imports (after the existing `type { FlowMotion }` import):

```tsx
import { cn } from "@/lib/utils";
import { Pressable } from "@/components/ui/motion";
```

In the seeded-cards map, add the index param and swap the element, replacing the `data-complete` attribute + its `data-[complete=true]:*` classes with a conditional `className`. Change `{motions.map((m) => {` to `{motions.map((m, i) => {`, then the returned card becomes:

```tsx
            return (
              <Pressable
                key={m.id}
                index={i}
                type="button"
                onClick={() => setActive(m)}
                aria-label={`${m.motion} — ${meta.label}`}
                className={cn(
                  "group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  status === "complete" && "ring-1 ring-success"
                )}
              >
                <Badge variant={meta.variant} className="self-start">
                  {meta.badge}
                </Badge>
                <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">
                  {m.motion}
                </div>
                <div className="mt-auto pt-4 text-sm font-semibold text-primary">{meta.cta} →</div>
              </Pressable>
            );
```

- [ ] **Step 6: Run the deck/coach suites, full suite, tsc, build**

Run: `npm test -- tests/components/FlowDeck.test.tsx tests/components/PracticeDeck.test.tsx tests/components/UniverseGenerator.test.tsx tests/components/PracticeShell.test.tsx tests/components/CoachBubble.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: all named suites PASS (cards are still buttons with the same accessible names + handlers; clicking a seeded card still opens FlowShell; the completed card still shows the ring via the conditional class; CoachBubble still renders its reaction text); full suite PASS; tsc clean; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add components/FlowDeck.tsx components/UniverseGenerator.tsx components/PracticeDeck.tsx components/CoachBubble.tsx
git commit -m "feat: animate the deck — staggered card entrances + press, coach bubble entrance"
```

---

## Manual verification (after Task 2)

Not automated — do once with the app running (`npm run dev`, authed):

1. Load the deck → the seeded motion cards, generated-universe cards, and practice cards each **rise in with a subtle stagger** on mount.
2. Hover/press a card → a gentle scale response; clicking still opens the motion / practice drill exactly as before.
3. Trigger a coach reaction in any stage → the coach bubble **eases in** rather than snapping.
4. Turn on the OS "Reduce Motion" setting and reload → entrances are **instant** (no movement), everything still fully usable.
5. Completed seeded motions still show the success ring; all badges/labels/copy are unchanged.

---

## Self-Review

**Spec coverage:**
- `motion` library added; imports from `motion/react` → Task 1. ✓
- Motion tokens (`transitions`, `riseIn`) in `lib/motion.ts` → Task 1. ✓
- `Rise` + `Pressable` primitive → Task 1. ✓
- Reduced motion app-wide via `<MotionConfig reducedMotion="user">` → Task 1. ✓
- `matchMedia` test stub; tests assert end-state → Task 1. ✓
- Proof on the deck (three card grids + `CoachBubble`) → Task 2. ✓
- Zero behavior/copy change; text/roles/labels/handlers preserved → Tasks 1–2 (guarded by existing suites). ✓
- Non-goals (no bridge/mascot/gamification, no scroll/route transitions, no stage-internal changes) → respected. ✓
- Gates green each task → all tasks. ✓

**Placeholder scan:** No TBD/TODO; every file given in full or as an exact edit with the complete resulting card markup; tests concrete. ✓

**Type consistency:** `transitions`/`riseIn` defined in Task 1 and consumed by the primitives; `Rise({children,index?,className?})` and `Pressable(HTMLMotionProps<"button"> & {index?})` signatures match every call site (deck cards pass `index`, `type`, `onClick`, `aria-label`, `className`, and — generator — `disabled`, all within `HTMLMotionProps<"button">`; no `data-*` is passed to `Pressable` because the seeded card's `data-complete` is replaced by a `cn(...)` conditional class); `CoachBubble` passing `className` to `Rise` matches `Rise`'s prop; `MotionConfig`/`useReducedMotion` come from `motion/react`. The seeded card's completed-ring behavior is preserved (`status === "complete" && "ring-1 ring-success"` reproduces the old `data-[complete=true]:ring-1 data-[complete=true]:ring-success`). ✓
