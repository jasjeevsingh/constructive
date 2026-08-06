# Constructive — Layer 2 (Link Builder) Design

**Date:** 2026-08-06
**Status:** Approved for planning
**Scope:** Layer 2 (Link Builder) only. Logical-fallacy activities are deferred to their own later spec/plan/build cycle. Layer 3 (Impact + Debate Avatar) is unchanged and out of scope.

## Background

Constructive is an interactive web app for a youth debate retreat (5th–12th graders)
that teaches the **Claim → Link → Impact (CLI)** framework through structured,
activity-based modules. Layer 1 (Motion Reader) shipped: a Next.js (App Router, TS) app
on Vercel with a Claude coach (`/api/coach`), Deepgram voice (`/api/transcribe`),
`localStorage` persistence, and a cohort password gate (`/api/auth` + `middleware.ts`).

Layer 2 teaches the **Link** — the bridge between a claim and its impact. Per the CLI
framing, the link "is a bridge you can build from claim to impact… built with evidence
and with reasoning. Good bridges are both." That bridge is a **literal visual element**
here. The tool is a *helper that trains discernment*, not a teacher introducing the
concept cold; a coach explains the bridge idea live first.

**Pedagogical core (discovery, not generation):** rather than having the student invent
links, the activity gives a curated bank of candidate reasoning/evidence sentences and
asks the student to identify which ones actually connect a given claim to a given impact
— mirroring real evidence-finding (you don't force evidence to fit; you find evidence
that fits). The bank deliberately includes **"great but wrong"** candidates: strong-
sounding evidence (e.g. a Harvard study) that doesn't logically bridge to *this* impact.
Discerning those is the highest-value skill the activity trains.

## Goals

- Teach the claim→impact link through a discovery-based sorting activity built around a
  literal bridge visual.
- Make the "good bridges use both evidence and reasoning" lesson a concrete win condition.
- Train discernment via curated "great but wrong" traps.
- Reuse Layer 1's architecture and patterns; add a clean home hub as the app grows.

## Non-goals

- No logical-fallacy activities (separate later cycle).
- No student-generated links (this layer is discovery/selection, not generation).
- No voice input (the activity is click/tap based).
- No scoring, stars, or win/lose framing (mastery-oriented, per the retreat's
  dialogue-over-winning ethos).
- No changes to Layer 1's Motion Reader behavior beyond moving its route (see below).
- No new auth, no database — persistence stays `localStorage`.

## Navigation & placement

- `app/page.tsx` becomes a lightweight **home hub** listing the activities: **Motion
  Reader**, **Link Builder**, and a disabled "Avatar — coming soon" placeholder.
- The existing Motion Reader deck moves from `app/page.tsx` to **`/motions`**
  (`app/motions/page.tsx`), rendering the existing `<Deck/>` unchanged.
- Link Builder lives at **`/link`** (`app/link/page.tsx`).
- `middleware.ts` already gates every non-public path, so `/motions` and `/link` are
  protected with no auth change. (The middleware matcher already covers arbitrary paths.)

## The Link Builder activity

A **deck of link scenarios** (`LinkDeck`, mirroring the Motion Reader deck). Selecting a
scenario opens the **bridge card**:

- The **claim** sits on the left bank, the **impact** on the right bank, with the bridge
  span between them. Below is a tray of candidate **planks**.
- **Materials are visually distinct:** evidence planks render gold, reasoning planks
  render orange (matching the brand tokens and Layer 1's "needs work"/accent usage).
- **Interaction — sort, then test:** the student sorts every candidate into **Build** or
  **Set aside**, then taps **Test the bridge**. (Chosen over tap-to-place and
  one-at-a-time; deliberate commit-then-reveal, consistent with Layer 1's refine step,
  and it discourages guess-until-it-sticks.)
- **Reveal + free retry:** on test, fitting planks lock into the bridge; wrong ones
  visibly crack/fall, each showing its authored explanation, with a distinct callout for
  a `great-but-wrong` plank. The student may fix the sort and re-test as many times as
  they like. No score is kept.
- **Win condition ("the bridge holds"):** all `fits` planks are in **Build**, no
  non-`fits` planks are in **Build**, **and** the placed set includes at least one
  `evidence` and one `reasoning` plank. The both-materials requirement is what teaches
  "good bridges are both."

## Content model

`content/link-scenarios.json`, hand-editable by coaches like `content/motions.json`.
Per scenario:

```json
{
  "id": "ls-homework",
  "claim": "This House would ban homework.",
  "impact": "Kids get more time for family, sleep, and play.",
  "candidates": [
    {
      "id": "c1",
      "text": "Without homework, evenings are freed for rest and family.",
      "material": "reasoning",
      "verdict": "fits",
      "explanation": "Directly connects the ban to the impact."
    },
    {
      "id": "c2",
      "text": "Research links heavy homework to student stress and burnout.",
      "material": "evidence",
      "verdict": "fits",
      "explanation": "Evidence that removing homework improves wellbeing."
    },
    {
      "id": "c3",
      "text": "A Harvard study found homework raises standardized-test scores.",
      "material": "evidence",
      "verdict": "great-but-wrong",
      "explanation": "Authoritative but supports the opposite side — it does not bridge to THIS impact."
    }
  ]
}
```

- `material` ∈ `evidence | reasoning`.
- `verdict` ∈ `fits | doesnt-fit | great-but-wrong`. Only `fits` planks hold the bridge;
  `great-but-wrong` is treated as not-fitting for grading but gets a distinct explanation
  callout on reveal.
- **Bank invariant (enforced by a test):** every scenario contains at least one `fits`
  candidate with `material: "evidence"` and at least one with `material: "reasoning"`, so
  the both-materials win condition is always achievable.
- Starter bank: ~6–8 scenarios, all reusing motions/impacts in the spirit of the existing
  motion bank. Coaches swap in real content later.

## AI coach integration (optional path)

The default experience is fully deterministic (no live AI needed). The coach is a
stuck-student affordance only:

- Extend the existing coach contract rather than adding an endpoint:
  - Add `"link"` to `CoachStepSchema`.
  - Add `LinkResponseSchema { kind: "link", reaction: string }` to the
    `CoachResponseSchema` discriminated union.
  - Add a `linkPrompt({ claim, impact, candidateText, verdict })` builder in
    `lib/prompts/link.ts`, and a `case "link"` in `runCoach`'s prompt selector.
- A **"talk this through"** button appears on a candidate after reveal; it POSTs to
  `/api/coach` with `step: "link"` and returns a short conversational explanation for why
  that candidate does or doesn't bridge. Everything else remains client-side + bank.

## State & persistence

- New `lib/state/linkProgress.ts` (mirrors `progressStore.ts`): pure, `Storage`-injected
  functions storing per-scenario progress (`placedIds: string[]`, `held: boolean`) under
  key `constructive:link:v1`, tolerant of corrupt/missing storage.
- A thin `useLinkProgress(scenarioId)` hook wraps it for the client card.

## Grading logic

- `lib/linkGrade.ts` exports a pure `gradeBridge(scenario, placedIds)` returning:
  - `perPlank`: for each candidate, whether it was placed and whether that placement was
    correct (a `fits` plank placed = correct; a non-`fits` plank placed = wrong; a `fits`
    plank not placed = missing).
  - `hasEvidence` / `hasReasoning`: whether the placed set satisfies the both-materials
    rule.
  - `held`: the overall win condition (all `fits` placed, no non-`fits` placed, both
    materials present).
- This function is the single source of truth for the reveal UI and completion; it is
  pure and fully unit-tested independent of React.

## Error handling

- **Coach call failure** ("talk this through"): show a short inline message; never block
  the activity — the deterministic reveal already stands on its own. (Mirrors the Layer 1
  fix that step components handle non-ok/thrown coach fetches.)
- **Empty/partial sort:** "Test the bridge" is enabled once the student has made any
  placement decision; testing an incomplete sort simply reveals misses (a `fits` plank
  left in "Set aside" shows as missing) rather than being blocked.
- **Malformed bank:** `link-scenarios.json` is validated against its schema at import
  time (fails loudly), plus the bank-invariant test.

## Reused Layer 1 patterns

- JSON content bank + Zod schema + import-time-validated loader (as `lib/motions.ts`).
- The `/api/coach` route and `runCoach`/`ChatClient` seam — extended, not duplicated.
- `localStorage` progress store shape and hook.
- Brand tokens (`app/globals.css`), the gated shell, and the deck→card component shape.
- Tests: pure logic mocked-free; `/api/coach` `link` step tested with the mocked Claude
  client; components tested with stubbed `fetch`.

## Testing

- `gradeBridge` unit tests: bridge holds; a wrong plank placed breaks it; a missing `fits`
  plank breaks it; a `great-but-wrong` plank placed breaks it and is flagged distinctly;
  both-materials rule (evidence-only or reasoning-only sets do not hold).
- Schema tests: valid/invalid scenario shapes; the discriminated union accepts the `link`
  response.
- Bank-invariant test: every scenario has ≥1 fitting evidence and ≥1 fitting reasoning.
- `linkProgress` store tests: empty default, round-trip under `constructive:link:v1`,
  independence across scenarios, corrupt-storage fallback.
- `linkPrompt` builder test: embeds claim/impact/candidate and instructs JSON-only output
  matching `LinkResponseSchema`.
- `/api/coach` `link` step test with the mocked client.
- Component tests (stubbed `fetch`/bank): sort → test → reveal shows holds/cracks and the
  both-materials gate; the "talk this through" button surfaces a coach reaction.

## Open questions (deferred, do not block Layer 2)

- Whether the bridge visual gets richer animation (planks physically settling/cracking) —
  start with a clear static reveal; enhance later.
- Whether link scenarios should be linked to the same motions used in Motion Reader for
  continuity — nice-to-have, not required; the bank is independent for now.
- Logical-fallacy activity design — its own future cycle.
