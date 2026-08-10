# Constructive — AGAINST Second Pass Design

**Date:** 2026-08-10
**Status:** Approved for planning
**Scope:** Complete the integrated per-motion flow's second side. Adds AGAINST content and the FOR→AGAINST side-switch. No other roadmap sub-projects (standalone practice, gating, example library, LLM motions) are in scope.

## Background

The integrated per-motion flow shipped FOR-only. A student picks a motion and works
**Read → Claim → Link → Impact** for the FOR side; finishing FOR shows a completion panel,
and AGAINST is a locked `🔒 AGAINST · soon` pill with no content (`sides.against.claims: []`
in `content/flow-motions.json`). The flow already has everything needed for a second side —
`flowMachine` (stages + `SIDES` + `againstUnlocked`), `useFlowProgress` (`constructive:flow:v1`,
with `side`/`forComplete`/`againstComplete`), `FlowShell`, and side-agnostic `ClaimStage`/
`LinkCard`/`ImpactStage` + the `claim`/`impact` coach steps. This sub-project authors the
AGAINST content and wires the switch so the "both sides" journey is real.

## Goals

- Author AGAINST claims so a student can argue the other side of each motion.
- Let the student move from a completed FOR side into a fresh AGAINST pass, and reach a
  clear finish when both sides are done.
- Reuse the existing stages, coach steps, and progress model with no schema changes.

## Non-goals

- No new coach steps, no new content schema, no new persistence key.
- No standalone practice, competency gating, example library, or LLM-generated motions.
- No per-side storage of the working fields (`mappedClaimId`/`impact`) — completion is
  tracked by the existing boolean flags; the working fields reset on switch.
- No change to the deterministic Link grading or the reused stage components.

## Content

- Author **exactly 3 AGAINST claims per motion** for all 4 motions in
  `content/flow-motions.json`, populating `sides.against.claims` (currently `[]`).
- Each claim uses the same shape and winnability invariant as FOR: fields `id`, `claim`,
  `impact`, `candidates[]`; each `candidates` set has at least one `{material:"evidence",
  verdict:"fits"}`, one `{material:"reasoning",verdict:"fits"}`, and one
  `{verdict:"great-but-wrong"}` (plus, per the established pattern, a `doesnt-fit`
  distractor). Claim ids are unique within the motion (the Link scenario id is already
  namespaced by motion id, so cross-motion id reuse is fine, but keep them distinct from
  the FOR claim ids for clarity).
- The `FlowMotionSchema` already supports this (it validates `sides.against` as a
  `FlowSideSchema`); no schema change.

## Data model (reuse `FlowProgress`, no change)

`FlowProgress` already has `side`, `mappedClaimId`, `impact`, `forComplete`,
`againstComplete`. The switch to AGAINST is a single update:

```
update({ side: "against", stage: "claim", mappedClaimId: null, impact: "" })
```

- Starts the AGAINST pass at **Claim** (Read is side-agnostic and already done; not
  repeated). `restate`/`keywordAnswers` are left intact.
- The working fields reset for the fresh pass; FOR completion is preserved via
  `forComplete`. No per-side history is kept (out of scope / YAGNI).

## FlowShell changes (the only real code change)

Generalize the current single completion short-circuit (`side === "for" && forComplete`)
into three cases evaluated before rendering the active stage:

1. **`forComplete && againstComplete`** → **final closure panel**: "You've argued both
   sides! 🎉" + a "← back to motions" button (`onExit`).
2. **`side === "for" && forComplete`** (AGAINST not yet complete) → the existing FOR-done
   completion panel, now with a **"Now argue the other side →"** button that runs the
   switch update above.
3. **otherwise** → render the active stage exactly as today.

On the AGAINST pass, `progress.stage` starts at `"claim"`, so `FlowRail` already shows
Read as complete (it marks stages before the current index done) — **no `FlowRail`
change**. `ClaimStage`/`LinkCard`/`ImpactStage` already read `motion.sides[progress.side]`
and take `side`, so they render AGAINST content unchanged. The `ImpactStage` `onComplete`
already sets `againstComplete` when `side === "against"`.

**Pills:** update the header so both the FOR and AGAINST pills reflect `progress.side`
(active side styled gold) and completion (a ✓ when that side's flag is set); the AGAINST
pill drops the `🔒 · soon` lock once `forComplete` is true. The FOR pill is no longer
hardcoded active.

## Error handling

- Unchanged from the flow: coach failures at Claim/Impact are non-blocking (inline
  message / manual-pick fallback); Link grading is deterministic.
- A student can only reach AGAINST via the completion-panel button, which only renders
  when `forComplete` — so the AGAINST Claim stage always has authored claims to show.

## Testing

- **Content invariant (extended):** the bank test now checks **every authored side**
  (FOR and AGAINST): a side with claims has exactly 3, and each claim's candidate set has
  ≥1 fitting evidence, ≥1 fitting reasoning, and ≥1 great-but-wrong. (Today it only checks
  FOR.)
- **FlowShell (pre-seeded progress):**
  - `side:"for", forComplete:true, againstComplete:false` → the FOR-done panel shows the
    "Now argue the other side →" button; clicking it renders the AGAINST **Claim** stage
    showing the motion's AGAINST claims (and persists `side:"against"`, `stage:"claim"`).
  - `forComplete:true, againstComplete:true` → the final closure panel renders (not a
    stage) and "← back to motions" calls `onExit`.
- Existing flow tests remain green (the FOR-only completion path still works when
  `againstComplete` is false).

## Open questions

None blocking. (Reviewing/revisiting a completed side is deliberately out of scope; if
desired later it would need per-side storage of `mappedClaimId`/`impact`.)
