# Constructive — Standalone Per-Part Practice Design

**Date:** 2026-08-15
**Status:** Approved for planning
**Scope:** Let a student drill a single CLI-framework skill in isolation — Claim, Link (the bridge), or Impact — as random reps from the seeded motion bank, without doing the full per-motion journey. Reuses the existing stage components, coach, and design system unchanged.

## Background

Today the only way to practice is the full integrated journey (Read → Claim → Link → Impact, both sides) rendered by `FlowShell` over a `FlowMotion`. Each stage component is already self-contained: it takes content props plus an `onComplete` callback and calls the coach (`/api/coach`) itself. Their exact contracts:

- `ClaimStage({ motion: string, side: "for"|"against", claims: {id,claim}[], onComplete: (mappedClaimId: string) => void })`
- `LinkCard({ scenario: LinkScenario, onExit?: () => void, onComplete?: () => void })` — uses `useLinkProgress(scenario.id)`.
- `ImpactStage({ motion: string, claim: string, authoredImpact: string, onComplete: (impact: string) => void })`

Because each stage is self-contained, a standalone drill only needs to render one stage component with content drawn from a motion and swap `onComplete` to "finish the rep" instead of advancing a journey. No stage-component internals change.

## Decisions (from brainstorming)

- **Drillable parts:** Claim, Link, Impact (the three CLI skills). Read (restate/keywords) stays journey-only.
- **Content model:** random reps drawn from the seeded bank; "Next rep" serves a fresh item.
- **Progress:** a persisted lifetime rep count per part.
- **Source (v1):** the seeded flow-motions bank only (generated universes as a drill source is a later follow-up).
- **Isolation:** Link drills namespace their scenario id so drill progress never collides with journey Link progress.

## Goals

- A low-friction "drill one skill" experience with varied reps across motions.
- Reuse the existing stage components with zero duplication and zero changes to their internals.
- Keep drills fully isolated from the full journey and from the generated-universe store.
- Track a light, motivating per-part rep count.

## Non-goals

- No generated-universe content as a drill source (v1 = seeded bank only).
- No difficulty selection, per-item history, or streaks beyond the rep count.
- No changes to the full journey (`FlowShell`), the universe generator, the coach, or any stage component's internals.

## Entry point

`FlowDeck` gains a **"Practice a skill"** section, rendered in the deck view below "Pick a motion" and the universe generator. Three cards — **Practice Claims**, **Practice the Link (bridge)**, **Practice Impacts** — each showing its lifetime rep count once hydrated. `FlowDeck` holds a `practicePart: PracticePart | null` state alongside its existing `active: FlowMotion | null`; when `practicePart` is set it renders `<PracticeShell part={practicePart} onExit={() => setPracticePart(null)} />` (and `active` takes precedence for the journey). Only one view shows at a time. All existing deck behavior (Landing, seeded grid, generator, badges) is unchanged.

## Drill content — `lib/practice.ts` (pure)

- `type PracticePart = "claim" | "link" | "impact"`.
- A discriminated `PracticeItem`:
  - `{ part: "claim"; motion: string; side: Side; claims: { id: string; claim: string }[] }`
  - `{ part: "link"; scenario: LinkScenario }`
  - `{ part: "impact"; motion: string; claim: string; authoredImpact: string }`
- `drawItem(part: PracticePart, motions: FlowMotion[], rand?: () => number): PracticeItem` — picks a random motion, a random side, and (for link/impact) a random claim from that side's claims. `rand` defaults to `Math.random` and is injected in tests for determinism. Only motions with at least one claim on the chosen side are eligible for link/impact (all seeded motions qualify; the draw filters defensively and falls back across sides/motions).
- **Link isolation:** the link item's scenario id is `practice:{motionId}:{claimId}` (a practice-namespaced variant of `claimToScenario`), so `LinkCard`'s `useLinkProgress(scenario.id)` writes to a key distinct from the journey's `{motionId}:{claimId}`. Drilling a bridge neither reads from nor writes to journey Link progress.

## PracticeShell — `components/PracticeShell.tsx`

Given `{ part, onExit }`:
- Holds the current drawn `item` (drawn on mount and on "Next rep") and a `done` boolean; reads/increments the rep count via the practice store.
- Chrome: `AppShell` wrapping a light `Card` with a **"← Practice"** back button (calls `onExit`), a title (**"Practice: Claims" / "Practice: the Link" / "Practice: Impacts"**), and a rep-count `Badge`. Simpler than `FlowShell` — no rail, no side pills.
- Body renders exactly one stage component for `item`, with `onComplete` rewired to `finishRep` (increment the persisted count for `part`, set `done = true`):
  - claim → `<ClaimStage motion={item.motion} side={item.side} claims={item.claims} onComplete={finishRep} />`
  - link → `<LinkCard scenario={item.scenario} onComplete={finishRep} />`
  - impact → `<ImpactStage motion={item.motion} claim={item.claim} authoredImpact={item.authoredImpact} onComplete={finishRep} />`
- When `done`: a centered **"Nice rep!"** panel with **"Next rep →"** (draw a fresh item, reset `done`) and **"← Back"** (calls `onExit`).
- No stage component is modified; each still calls the coach and shows its own in-stage feedback/fallbacks.

## Progress — `lib/state/practiceProgress.ts`

A corruption-tolerant localStorage store, key `constructive:practice:v1`, shape `{ claim: number; link: number; impact: number }`:
- `loadPracticeCounts(storage: Storage): PracticeCounts` — missing/invalid JSON or malformed shape → `{ claim: 0, link: 0, impact: 0 }`.
- `incrementPracticeCount(storage: Storage, part: PracticePart): PracticeCounts` — reads, bumps the part, saves, returns the new counts.
- Read hydration-safely in components (`useEffect`), matching the existing store patterns. Entirely separate from `flowProgress`.

## Coexistence & error handling

- Drills reuse the same stage components and `/api/coach`; they touch **neither** `flowProgress` nor the generated-universe store. Link drills are id-namespaced (`practice:…`), so they are isolated from journey Link progress.
- No new network paths. Coach failures keep each stage's existing fallback behavior. Corrupt practice-count storage → counts default to 0. The seeded bank is non-empty, so the Practice section always has content; `drawItem` is defensive if a motion/side lacks claims.

## Testing

- **Pure `lib/practice.ts`:** `drawItem` with an injected deterministic `rand` — each part yields the correct discriminated item shape; the link item's scenario id is `practice:`-namespaced; link/impact draws only from motions/sides that have claims.
- **`practiceProgress` store:** round-trip, `incrementPracticeCount` bumps the right part, corruption tolerance (bad JSON / bad shape → zeros).
- **`PracticeShell`:** renders the correct stage per part (claim → the claim prompt; link → "Test the bridge"; impact → the impact prompt); completing a rep (stubbed coach `fetch`) shows the "Next rep" panel and increments the displayed count; "Next rep" draws a fresh item and returns to the stage.
- **`FlowDeck`:** the "Practice a skill" section renders three cards; clicking one opens `PracticeShell` (the part's stage renders); the existing deck behavior (hero, "Pick a motion", seeded cards, generator) is unchanged.
- **Gates:** full suite green, `npx tsc --noEmit` clean, `npm run build` succeeds; accessible names preserved.

## Architecture / files

- Create: `lib/practice.ts`, `lib/state/practiceProgress.ts`, `components/PracticeShell.tsx`, and `components/PracticeDeck.tsx` — the three-card "Practice a skill" section, extracted for `FlowDeck` readability (mirroring how `UniverseGenerator` was split out). `PracticeDeck` takes an `onPick(part: PracticePart)` prop and renders the rep counts.
- Modify: `components/FlowDeck.tsx` (add the `practicePart` state; render `<PracticeDeck onPick={setPracticePart} />` in the deck view; render `<PracticeShell part={practicePart} onExit={…} />` when set).
- Untouched: all stage components, `FlowShell`, `useFlowProgress`/`flowProgress`, `useLinkProgress` (consumed as-is via the namespaced id), the universe generator, coach, voice, content, routing.

## Open questions

None blocking. Using generated-universe motions as an additional drill source, and richer practice stats (streaks, per-motion history), are deferred to later iterations; the seeded-bank design does not preclude adding them.
