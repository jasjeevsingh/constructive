# Constructive — Standalone Per-Part Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student drill a single CLI skill (Claim, Link, or Impact) as random reps from the seeded bank, reusing the existing stage components unchanged, with a persisted per-part rep count — surfaced as a "Practice a skill" section on the deck.

**Architecture:** A pure `drawItem` (`lib/practice.ts`) serves a random discriminated `PracticeItem` from the seeded motions. A `PracticeShell` renders exactly one existing stage component for the item and rewires its `onComplete` to "finish the rep" (increment a separate `constructive:practice:v1` count, show a "Next rep" panel). Link drills namespace their scenario id (`practice:{motionId}:{claimId}`) so drill Link progress never collides with the journey. A `PracticeDeck` three-card section in `FlowDeck` launches drills.

**Tech Stack:** Next.js 14 (App Router, TS strict), React 18, Zod, Tailwind + owned shadcn primitives, Vitest + RTL + jsdom.

## Global Constraints

- **Reuse stage components unchanged:** `ClaimStage`, `LinkCard`, `ImpactStage` internals are NOT modified; drills render them with drawn content and a rewired `onComplete`.
- **Drillable parts:** `claim`, `link`, `impact` only (Read stays journey-only).
- **Content source:** the seeded bank via `getFlowMotions()` (v1); no generated-universe content.
- **Link isolation:** a Link drill's scenario id is `practice:{motionId}:{claimId}` — reuse `claimToScenario` with a `"practice:"`-prefixed motion id (`claimToScenario(`practice:${motion.id}`, claim)`), so `useLinkProgress` for a drill is keyed separately from the journey's `{motionId}:{claimId}`.
- **Separate store:** rep counts live in `constructive:practice:v1` (`{ claim, link, impact }`), never in `flowProgress`.
- **Untouched:** all stage components, `FlowShell`, `useFlowProgress`/`flowProgress`, `useLinkProgress` (consumed as-is), the universe generator, coach, voice, content, routing.
- Each task ends green: `npm test`, `npx tsc --noEmit`, and (Tasks 3–4) `npm run build`.

## File Structure

```
lib/practice.ts                          # Create — PracticePart, PracticeItem, drawItem (Task 1)
tests/lib/practice.test.ts               # Create (Task 1)
lib/state/practiceProgress.ts            # Create — counts store (Task 2)
tests/lib/practiceProgress.test.ts       # Create (Task 2)
components/PracticeShell.tsx             # Create — reuses stage components (Task 3)
tests/components/PracticeShell.test.tsx  # Create (Task 3)
components/PracticeDeck.tsx              # Create — 3-card section (Task 4)
components/FlowDeck.tsx                  # Modify — practicePart state + section + shell (Task 4)
tests/components/PracticeDeck.test.tsx   # Create (Task 4)
tests/components/FlowDeck.test.tsx       # Modify — add one integration assertion (Task 4)
```

---

### Task 1: Practice content — `lib/practice.ts`

**Files:**
- Create: `lib/practice.ts`
- Test: `tests/lib/practice.test.ts`

**Interfaces:**
- Consumes: `FlowMotion`, `LinkScenario` (`@/lib/schemas`); `Side` (`@/lib/state/flowMachine`); `claimToScenario` (`@/lib/flowMotions`).
- Produces: `type PracticePart = "claim" | "link" | "impact"`; discriminated `type PracticeItem`; `drawItem(part: PracticePart, motions: FlowMotion[], rand?: () => number): PracticeItem`.

- [ ] **Step 1: Write the failing test** — `tests/lib/practice.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { drawItem } from "@/lib/practice";
import type { FlowMotion } from "@/lib/schemas";

const motions: FlowMotion[] = [
  {
    id: "m1",
    motion: "Motion one.",
    keywords: [],
    sides: {
      for: {
        claims: [
          {
            id: "c1",
            claim: "Claim one.",
            impact: "Impact one.",
            candidates: [
              { id: "e1", text: "ev", material: "evidence", verdict: "fits", explanation: "e" },
              { id: "r1", text: "re", material: "reasoning", verdict: "fits", explanation: "e" },
            ],
          },
        ],
      },
      against: { claims: [] },
    },
  },
];

describe("drawItem", () => {
  it("draws a claim item with the side's authored claims", () => {
    const item = drawItem("claim", motions, () => 0);
    expect(item).toEqual({
      part: "claim",
      motion: "Motion one.",
      side: "for",
      claims: [{ id: "c1", claim: "Claim one." }],
    });
  });

  it("draws a link item with a practice-namespaced scenario id", () => {
    const item = drawItem("link", motions, () => 0);
    if (item.part !== "link") throw new Error("wrong part");
    expect(item.scenario.id).toBe("practice:m1:c1");
    expect(item.scenario.candidates).toHaveLength(2);
  });

  it("draws an impact item with the claim + authored impact", () => {
    const item = drawItem("impact", motions, () => 0);
    expect(item).toEqual({
      part: "impact",
      motion: "Motion one.",
      claim: "Claim one.",
      authoredImpact: "Impact one.",
    });
  });

  it("throws when no motion has any claims", () => {
    const empty: FlowMotion[] = [
      { id: "x", motion: "m", keywords: [], sides: { for: { claims: [] }, against: { claims: [] } } },
    ];
    expect(() => drawItem("claim", empty, () => 0)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/practice.test.ts`
Expected: FAIL — `@/lib/practice` does not exist.

- [ ] **Step 3: Create `lib/practice.ts`**

```ts
import type { FlowMotion, LinkScenario } from "@/lib/schemas";
import type { Side } from "@/lib/state/flowMachine";
import { claimToScenario } from "@/lib/flowMotions";

export type PracticePart = "claim" | "link" | "impact";

export type PracticeItem =
  | { part: "claim"; motion: string; side: Side; claims: { id: string; claim: string }[] }
  | { part: "link"; scenario: LinkScenario }
  | { part: "impact"; motion: string; claim: string; authoredImpact: string };

const SIDES: Side[] = ["for", "against"];

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Draw a random practice item of the given part from the seeded bank.
 * `rand` is injected for deterministic tests (defaults to Math.random).
 * Only motions/sides that actually have claims are eligible.
 */
export function drawItem(
  part: PracticePart,
  motions: FlowMotion[],
  rand: () => number = Math.random
): PracticeItem {
  const usable = motions.filter((m) => SIDES.some((s) => m.sides[s].claims.length > 0));
  if (usable.length === 0) throw new Error("no practice content available");

  const motion = pick(usable, rand);
  const sidesWithClaims = SIDES.filter((s) => motion.sides[s].claims.length > 0);
  const side = pick(sidesWithClaims, rand);
  const claims = motion.sides[side].claims;

  if (part === "claim") {
    return {
      part: "claim",
      motion: motion.motion,
      side,
      claims: claims.map((c) => ({ id: c.id, claim: c.claim })),
    };
  }

  const claim = pick(claims, rand);
  if (part === "link") {
    // Practice-namespaced id keeps drill Link progress isolated from the journey.
    return { part: "link", scenario: claimToScenario(`practice:${motion.id}`, claim) };
  }
  return { part: "impact", motion: motion.motion, claim: claim.claim, authoredImpact: claim.impact };
}
```

- [ ] **Step 4: Run test + tsc**

Run: `npm test -- tests/lib/practice.test.ts && npx tsc --noEmit`
Expected: PASS (claim/link/impact shapes; `practice:m1:c1` id; throws on empty); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lib/practice.ts tests/lib/practice.test.ts
git commit -m "feat: practice drill content draw (random reps, namespaced link ids)"
```

---

### Task 2: Practice progress store — `lib/state/practiceProgress.ts`

**Files:**
- Create: `lib/state/practiceProgress.ts`
- Test: `tests/lib/practiceProgress.test.ts`

**Interfaces:**
- Consumes: `PracticePart` (`@/lib/practice`).
- Produces: `PRACTICE_STORAGE_KEY`, type `PracticeCounts` (`{ claim: number; link: number; impact: number }`), `loadPracticeCounts(storage: Storage): PracticeCounts`, `incrementPracticeCount(storage: Storage, part: PracticePart): PracticeCounts`.

- [ ] **Step 1: Write the failing test** — `tests/lib/practiceProgress.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  PRACTICE_STORAGE_KEY,
  loadPracticeCounts,
  incrementPracticeCount,
} from "@/lib/state/practiceProgress";

beforeEach(() => localStorage.clear());

describe("practiceProgress", () => {
  it("defaults to zeros when empty", () => {
    expect(loadPracticeCounts(localStorage)).toEqual({ claim: 0, link: 0, impact: 0 });
  });
  it("increments the right part and round-trips", () => {
    expect(incrementPracticeCount(localStorage, "link")).toEqual({ claim: 0, link: 1, impact: 0 });
    expect(incrementPracticeCount(localStorage, "link")).toEqual({ claim: 0, link: 2, impact: 0 });
    expect(loadPracticeCounts(localStorage)).toEqual({ claim: 0, link: 2, impact: 0 });
  });
  it("returns zeros on corrupt or malformed storage", () => {
    localStorage.setItem(PRACTICE_STORAGE_KEY, "not json");
    expect(loadPracticeCounts(localStorage)).toEqual({ claim: 0, link: 0, impact: 0 });
    localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({ claim: "x" }));
    expect(loadPracticeCounts(localStorage)).toEqual({ claim: 0, link: 0, impact: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/practiceProgress.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `lib/state/practiceProgress.ts`**

```ts
import { z } from "zod";
import type { PracticePart } from "@/lib/practice";

export const PRACTICE_STORAGE_KEY = "constructive:practice:v1";

const PracticeCountsSchema = z.object({
  claim: z.number().int().nonnegative(),
  link: z.number().int().nonnegative(),
  impact: z.number().int().nonnegative(),
});
export type PracticeCounts = z.infer<typeof PracticeCountsSchema>;

function zero(): PracticeCounts {
  return { claim: 0, link: 0, impact: 0 };
}

export function loadPracticeCounts(storage: Storage): PracticeCounts {
  const raw = storage.getItem(PRACTICE_STORAGE_KEY);
  if (!raw) return zero();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return zero();
  }
  const r = PracticeCountsSchema.safeParse(parsed);
  return r.success ? r.data : zero();
}

export function incrementPracticeCount(storage: Storage, part: PracticePart): PracticeCounts {
  const counts = loadPracticeCounts(storage);
  const next: PracticeCounts = { ...counts, [part]: counts[part] + 1 };
  storage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(next));
  return next;
}
```

- [ ] **Step 4: Run test + tsc**

Run: `npm test -- tests/lib/practiceProgress.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add lib/state/practiceProgress.ts tests/lib/practiceProgress.test.ts
git commit -m "feat: per-part practice rep-count store"
```

---

### Task 3: PracticeShell — `components/PracticeShell.tsx`

**Files:**
- Create: `components/PracticeShell.tsx`
- Test: `tests/components/PracticeShell.test.tsx`

**Interfaces:**
- Consumes: `getFlowMotions` (`@/lib/flowMotions`); `drawItem`, `PracticePart`, `PracticeItem` (`@/lib/practice`); `loadPracticeCounts`, `incrementPracticeCount` (`@/lib/state/practiceProgress`); `ClaimStage`, `ImpactStage`, `LinkCard`; `AppShell`, `Card`, `Button`, `Badge`.
- Produces: `PracticeShell({ part, onExit }: { part: PracticePart; onExit: () => void })`.

- [ ] **Step 1: Write the failing test** — `tests/components/PracticeShell.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PracticeShell } from "@/components/PracticeShell";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ kind: "impact", reaction: "Strong impact." }), { status: 200 }))
  );
});

describe("PracticeShell", () => {
  it("renders the claim stage for the claim part", () => {
    render(<PracticeShell part="claim" onExit={() => {}} />);
    expect(screen.getByText(/strongest claim/i)).toBeInTheDocument();
  });

  it("renders the link bridge for the link part", () => {
    render(<PracticeShell part="link" onExit={() => {}} />);
    expect(screen.getByRole("button", { name: /test the bridge/i })).toBeInTheDocument();
  });

  it("completes an impact rep, increments the count, and serves a fresh rep", async () => {
    render(<PracticeShell part="impact" onExit={() => {}} />);
    expect(screen.getByText(/so what\? why does this claim matter/i)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "kids get more sleep");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await userEvent.click(await screen.findByRole("button", { name: /finish this side/i }));
    expect(await screen.findByRole("button", { name: /next rep/i })).toBeInTheDocument();
    expect(screen.getByText("1 done")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /next rep/i }));
    expect(screen.getByText(/so what\? why does this claim matter/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/PracticeShell.test.tsx`
Expected: FAIL — `@/components/PracticeShell` does not exist.

- [ ] **Step 3: Create `components/PracticeShell.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { getFlowMotions } from "@/lib/flowMotions";
import { drawItem, type PracticePart, type PracticeItem } from "@/lib/practice";
import { loadPracticeCounts, incrementPracticeCount } from "@/lib/state/practiceProgress";
import { ClaimStage } from "@/components/stages/ClaimStage";
import { ImpactStage } from "@/components/stages/ImpactStage";
import { LinkCard } from "@/components/LinkCard";
import { AppShell } from "@/components/ui/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TITLES: Record<PracticePart, string> = {
  claim: "Practice: Claims",
  link: "Practice: the Link",
  impact: "Practice: Impacts",
};

export function PracticeShell({ part, onExit }: { part: PracticePart; onExit: () => void }) {
  const [item, setItem] = useState<PracticeItem>(() => drawItem(part, getFlowMotions()));
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(loadPracticeCounts(window.localStorage)[part]);
  }, [part]);

  function finishRep() {
    setCount(incrementPracticeCount(window.localStorage, part)[part]);
    setDone(true);
  }

  function nextRep() {
    setItem(drawItem(part, getFlowMotions()));
    setDone(false);
  }

  return (
    <AppShell>
      <Card className="flex min-h-[70vh] flex-col overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div>
            <Button variant="ghost" size="sm" onClick={onExit} className="mb-1 h-8 px-2 text-muted-foreground">
              ← Practice
            </Button>
            <div className="font-display text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {TITLES[part]}
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">{count} done</Badge>
        </div>

        <div className="flex-1 p-5 sm:p-6">
          {done ? (
            <div className="mx-auto max-w-md py-8 text-center">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">Nice rep!</div>
              <p className="mt-2 font-display text-xl font-semibold text-foreground">One more?</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button onClick={nextRep}>Next rep →</Button>
                <Button variant="ghost" onClick={onExit}>← Back</Button>
              </div>
            </div>
          ) : item.part === "claim" ? (
            <ClaimStage motion={item.motion} side={item.side} claims={item.claims} onComplete={finishRep} />
          ) : item.part === "link" ? (
            <LinkCard scenario={item.scenario} onComplete={finishRep} />
          ) : (
            <ImpactStage
              motion={item.motion}
              claim={item.claim}
              authoredImpact={item.authoredImpact}
              onComplete={finishRep}
            />
          )}
        </div>
      </Card>
    </AppShell>
  );
}
```

- [ ] **Step 4: Run the new test, full suite, tsc, build**

Run: `npm test -- tests/components/PracticeShell.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: new test PASSES (claim prompt for claim; "Test the bridge" for link; impact rep completes → "Next rep" + "1 done" → fresh rep); full suite PASS; tsc clean; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/PracticeShell.tsx tests/components/PracticeShell.test.tsx
git commit -m "feat: PracticeShell — drill one stage as reps, reusing stage components"
```

---

### Task 4: PracticeDeck + FlowDeck integration

**Files:**
- Create: `components/PracticeDeck.tsx`
- Modify: `components/FlowDeck.tsx`
- Test: `tests/components/PracticeDeck.test.tsx`; add one `it(...)` to `tests/components/FlowDeck.test.tsx`

**Interfaces:**
- Consumes: `loadPracticeCounts`, `PracticeCounts` (`@/lib/state/practiceProgress`); `PracticePart` (`@/lib/practice`); `PracticeShell` (Task 3); `Badge`.
- Produces: `PracticeDeck({ onPick }: { onPick: (part: PracticePart) => void })`; `FlowDeck` now renders the practice section and opens `PracticeShell`.

- [ ] **Step 1: Write the failing test** — `tests/components/PracticeDeck.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PracticeDeck } from "@/components/PracticeDeck";

beforeEach(() => localStorage.clear());

describe("PracticeDeck", () => {
  it("renders the three drill cards", () => {
    render(<PracticeDeck onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /practice claims/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /practice the link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /practice impacts/i })).toBeInTheDocument();
  });

  it("calls onPick with the chosen part", async () => {
    const onPick = vi.fn();
    render(<PracticeDeck onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: /practice the link/i }));
    expect(onPick).toHaveBeenCalledWith("link");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/PracticeDeck.test.tsx`
Expected: FAIL — `@/components/PracticeDeck` does not exist.

- [ ] **Step 3: Create `components/PracticeDeck.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { loadPracticeCounts, type PracticeCounts } from "@/lib/state/practiceProgress";
import type { PracticePart } from "@/lib/practice";

const CARDS: { part: PracticePart; title: string; blurb: string }[] = [
  { part: "claim", title: "Practice Claims", blurb: "State a strong position in your own words." },
  { part: "link", title: "Practice the Link", blurb: "Build the bridge from claim to impact with evidence + reasoning." },
  { part: "impact", title: "Practice Impacts", blurb: "Say why it matters — the bigger consequence." },
];

export function PracticeDeck({ onPick }: { onPick: (part: PracticePart) => void }) {
  const [counts, setCounts] = useState<PracticeCounts>({ claim: 0, link: 0, impact: 0 });

  useEffect(() => {
    setCounts(loadPracticeCounts(window.localStorage));
  }, []);

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold text-foreground">Practice a skill</h2>
      <p className="mt-1 text-sm text-muted-foreground">Drill one part of the framework with quick reps.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CARDS.map((c) => (
          <button
            key={c.part}
            type="button"
            onClick={() => onPick(c.part)}
            aria-label={`${c.title} — ${counts[c.part]} done`}
            className="group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Badge variant="secondary" className="self-start">{counts[c.part]} done</Badge>
            <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">{c.title}</div>
            <div className="mt-2 text-sm text-muted-foreground">{c.blurb}</div>
            <div className="mt-auto pt-4 text-sm font-semibold text-primary">Start drilling →</div>
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Modify `components/FlowDeck.tsx`** — add the practice view + section

Apply these edits:

1. Add imports (after the `UniverseGenerator` import):

```tsx
import { PracticeDeck } from "@/components/PracticeDeck";
import { PracticeShell } from "@/components/PracticeShell";
import type { PracticePart } from "@/lib/practice";
```

2. Add practice state next to `active` (after the `const [active, ...]` line):

```tsx
  const [practicePart, setPracticePart] = useState<PracticePart | null>(null);
```

3. Add the practice-view early return immediately after the existing `if (active) return <FlowShell … />;` line:

```tsx
  if (practicePart) return <PracticeShell part={practicePart} onExit={() => setPracticePart(null)} />;
```

4. Render the section — add `<PracticeDeck onPick={setPracticePart} />` immediately after the existing `<UniverseGenerator onOpen={setActive} />`:

```tsx
      <UniverseGenerator onOpen={setActive} />
      <PracticeDeck onPick={setPracticePart} />
```

(Everything else in `FlowDeck` — Landing, seeded grid, `STATUS_META`/`motionStatus`, badges — is unchanged.)

- [ ] **Step 5: Add one integration assertion to `tests/components/FlowDeck.test.tsx`**

Append this test inside the existing top-level `describe(...)` block (keep all existing tests unchanged):

```tsx
  it("opens a practice drill when a Practice card is clicked", async () => {
    render(<FlowDeck />);
    await userEvent.click(screen.getByRole("button", { name: /practice impacts/i }));
    expect(screen.getByText(/so what\? why does this claim matter/i)).toBeInTheDocument();
  });
```

If `userEvent` / `screen` / `render` / `FlowDeck` are not already imported at the top of that file, add the missing imports (they are used by the existing tests, so they should already be present).

- [ ] **Step 6: Run the new tests, full suite, tsc, build**

Run: `npm test -- tests/components/PracticeDeck.test.tsx tests/components/FlowDeck.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: PracticeDeck tests PASS (three cards; onPick fires with the part); FlowDeck tests PASS including the new integration assertion (clicking "Practice Impacts" renders the impact prompt) and all existing ones (hero, "Pick a motion", seeded cards open FlowShell, generator, badges); full suite PASS; tsc clean; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add components/PracticeDeck.tsx components/FlowDeck.tsx tests/components/PracticeDeck.test.tsx tests/components/FlowDeck.test.tsx
git commit -m "feat: Practice a skill section wired into the deck"
```

---

## Manual verification (after Task 4)

Not automated — do once with the app running (`npm run dev`, authed):

1. On the deck, a "Practice a skill" section shows three cards (Claims / the Link / Impacts) each with a "0 done" badge.
2. Click "Practice the Link" → the bridge drill opens on a random seeded claim; build the bridge → Test → holds → the "Nice rep! / Next rep →" panel appears and the badge (and, on return to the deck, the card) shows "1 done".
3. "Next rep →" serves a fresh random claim; "← Practice" / "← Back" returns to the deck.
4. Practice a Claim and an Impact similarly; coach reactions render inside each drill.
5. Confirm isolation: a Link drill on a claim does NOT change that motion's journey progress (the seeded motion's status on the deck is unaffected), and the full journey and generated universes behave exactly as before.
6. Rep counts persist across reload.

---

## Self-Review

**Spec coverage:**
- "Practice a skill" deck section (3 cards, rep counts) → Task 4 (`PracticeDeck` + FlowDeck). ✓
- Random reps from the seeded bank (`drawItem`) → Task 1. ✓
- Reuse stage components unchanged via `PracticeShell` with rewired `onComplete` → Task 3. ✓
- Persisted per-part rep count in a separate store → Task 2. ✓
- Link isolation via `practice:{motionId}:{claimId}` → Task 1 (`claimToScenario('practice:'+id, claim)`). ✓
- Coexistence: no touch to `flowProgress`/generator/journey; stage internals unchanged → Tasks 3, 4. ✓
- Gates green each task → all tasks. ✓
- Non-goals (no generated source, no difficulty/history beyond count, no stage-internal changes) → respected. ✓

**Placeholder scan:** No TBD/TODO; every file given in full (practice lib, store, PracticeShell, PracticeDeck, FlowDeck edits) with concrete tests. ✓

**Type consistency:** `PracticePart` defined in Task 1 and consumed by Tasks 2/3/4; `PracticeItem` discriminant `part` used consistently in `drawItem` and `PracticeShell`'s render switch; `PracticeCounts` keys (`claim`/`link`/`impact`) equal `PracticePart` members so `counts[part]`/`{...counts, [part]:…}` type-check; `drawItem(part, motions, rand?)` and store signatures match their call sites; `PracticeShell`'s `onComplete={finishRep}` (a `() => void`) is assignable to each stage's `onComplete` (which accept `()`/`(string)` — fewer params is valid); `claimToScenario('practice:'+motion.id, claim)` yields id `practice:{motion.id}:{claim.id}` as asserted. ✓
