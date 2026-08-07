# Constructive — Integrated Per-Motion Flow Design

**Date:** 2026-08-06
**Status:** Approved for planning
**Scope:** Sub-project 1 of the "unified flow" pivot: the integrated per-motion journey only. Standalone practice mode, competency/readiness gating, the fictional-universe example library, combination scenarios, and LLM-generated motions are each their own later spec/plan/build cycle.

## Background

Constructive teaches the **Claim → Link → Impact (CLI)** debate framework to 5th–12th
graders. Two modules shipped as separate pages: Motion Reader (`/motions`) and Link
Builder (`/link`), on a Next.js/Vercel app with a Claude coach (`/api/coach`), Deepgram
voice + an Anthropic→OpenAI fallback client, `localStorage` persistence, and a cohort
password gate.

Per the owner's direction, the product pivots from separate modules to a **single
integrated journey per motion**: reading the motion is built *into* the CLI flow rather
than siloed, and the student sees how Claim, Link, and Impact connect for one motion —
with a progress rail showing where they are. The separate modules fold into this flow
(and will resurface later as optional standalone practice).

## Goals

- One coherent journey per motion — **Read → Claim → Link → Impact** — so the student
  experiences how the parts connect, not four disconnected exercises.
- Reuse the shipped step activities as flow stages; add the two missing pieces (a Claim
  stage and an Impact stage).
- A left **progress rail** showing stages, sub-steps, and the active side.
- Keep the pedagogy that works: generative where it teaches (restate, claim, impact),
  discovery where it teaches (the Link plank bank, including "great but wrong" traps).

## Non-goals

- No standalone/per-part practice mode yet (later sub-project).
- No competency gating, example library, combination scenarios, or LLM-generated motions.
- No AGAINST content authored in the first build beyond the schema supporting it (FOR
  side ships first; AGAINST is a later authoring pass).
- No new database or auth; persistence stays `localStorage`; the gate is unchanged.
- No new AI provider work (the fallback client stays as-is).

## The flow (validated with the owner)

Per motion, **one side at a time**. FOR runs end-to-end first; **AGAINST is locked until
FOR is completed**, then becomes a second pass. Four stages, rendered in a flow shell
(header with the pinned motion + FOR/AGAINST toggle; a left progress rail; the active
stage in the main panel):

1. **Read the motion** (one stage, two sub-steps):
   - **Restate** — student restates the motion in their own words; coach reacts.
   - **Keywords** — clickable keywords; each opens a scope/meaning prompt; coach reacts.
   - *(reuses the existing `RestateStep` and `KeywordStep`.)*
2. **Claim** — the student states their own strongest claim for the active side (voice or
   text). A new `claim` coach step **maps the student's claim to the closest authored
   claim** for that side and carries that authored claim forward (so the Link stage's
   curated bank applies). The coach's reaction explains the mapping.
3. **Link** — the discovery bridge for the mapped claim → its authored impact, using that
   claim's curated candidate ("plank") bank. Win condition and reveal are unchanged from
   the Link Builder: all fitting planks placed, no wrong ones, and both an evidence and a
   reasoning plank present; "great but wrong" traps flagged distinctly.
   *(reuses `LinkCard` + `gradeBridge`.)*
4. **Impact** — the student states the "so what" for the mapped claim (voice or text); a
   new `impact` coach step reacts against the authored impact, closing the CLI loop.

Completing all four stages for a side marks that side complete; finishing FOR unlocks
AGAINST.

## Unified content model

A single per-motion object replaces the separate `motions.json` and `link-scenarios.json`
for the main flow, so one motion drives the whole journey. New
`content/flow-motions.json`, hand-editable by coaches, Zod-validated at import:

```json
{
  "id": "m-kids-vote",
  "motion": "This House would let kids vote.",
  "keywords": [
    { "word": "kids", "hint": "Age 5 or 17? Scope is the fight." },
    { "word": "vote", "hint": null }
  ],
  "sides": {
    "for": {
      "claims": [
        {
          "id": "c-stake",
          "claim": "Kids deserve a say in decisions that affect their future.",
          "impact": "A government that must answer to young people invests more in their long-term future.",
          "candidates": [
            { "id": "c1", "text": "…", "material": "reasoning", "verdict": "fits", "explanation": "…" },
            { "id": "c2", "text": "…", "material": "evidence", "verdict": "fits", "explanation": "…" },
            { "id": "c3", "text": "…", "material": "evidence", "verdict": "great-but-wrong", "explanation": "…" }
          ]
        }
        // exactly 3 authored claims per side
      ]
    },
    "against": { "claims": [] }
  }
}
```

- **3 authored claims per side** (matching the framework's "three arguments"). FOR ships
  with 3; AGAINST may ship empty in the first build (schema allows an empty `against`).
- `keywords`, `material`, `verdict` reuse the existing Layer 1/2 enums and shapes.
- **Bank invariant (enforced by a test):** every authored claim's `candidates` set has at
  least one `fits` `evidence` candidate and one `fits` `reasoning` candidate (so its Link
  bridge is always winnable), and at least one `great-but-wrong` trap.
- Starter bank: ~4–6 motions, FOR side fully authored (3 claims each).
- **Migration:** existing `content/motions.json` + `content/link-scenarios.json` content
  is consolidated into this shape; the old loaders (`lib/motions.ts`, `lib/linkScenarios.ts`)
  are retired for the main flow (they may linger only if still referenced by code slated
  for removal — see Routing).

## Coach integration

Two new steps on the existing `/api/coach` route (extend the contract, no new endpoint):

- **`claim`**: the motion text goes in the existing `motion` field (consistent with the
  other steps); the payload carries `{ side, studentClaim, authoredClaims: [{id, claim}] }`.
  Response `{ kind: "claim", reaction: string, mappedClaimId: string }`, Zod-validated;
  after parsing, `runCoach` (or the caller) validates that `mappedClaimId` is one of the
  provided authored claim ids and treats an out-of-set id as a mapping failure.
- **`impact`**: request payload `{ claim, authoredImpact, studentImpact }`. Response
  `{ kind: "impact", reaction: string }`.

`restate`, `keyword`, `refine`, and `link` steps are unchanged. New prompt builders
`lib/prompts/claim.ts` and `lib/prompts/impact.ts`; `runCoach` gains the two cases.

## State, progress & routing

- New `lib/state/flowMachine.ts` — pure stage/sub-step/side model: stages
  `["read", "claim", "link", "impact"]`, read sub-steps `["restate", "keyword"]`, sides
  `["for", "against"]`; helpers for next/prev, whether a side is complete, and whether
  AGAINST is unlocked (FOR complete).
- New `lib/state/flowProgress.ts` (pure, Storage-injected, mirrors the existing progress
  stores) + `useFlowProgress(motionId)` hook, under key `constructive:flow:v1`. Stored
  per motion: active side, per-side stage/sub-step position, and each stage's saved work
  (restate text, keyword answers, mapped claim id, placed plank ids, impact text, and
  per-side completion). Reuses the same corrupt-storage-tolerant + per-entry-validation
  patterns established in Layer 2.
- **Routing:** `/` becomes the motion picker (a deck of `flow-motions`); selecting a
  motion renders the flow shell. `/motions` and `/link` are **removed and redirect to
  `/`** (Next.js redirects). Their step components are reused by the flow; the standalone
  pages/decks (`MotionCard`, `Deck`, `LinkDeck`) are deleted or retired as part of this
  work, since standalone practice is a later sub-project.

## Components

- New: `FlowShell` (header + rail + active-stage panel), `FlowRail` (progress rail),
  `ClaimStage`, `ImpactStage`, `FlowDeck` (motion picker on `/`).
- Reused as stages: `RestateStep`, `KeywordStep` (Read), `LinkCard`/`gradeBridge` (Link),
  `VoiceOrTextInput` for all generative inputs.
- The stages report completion up to the shell, which advances `flowMachine` and persists
  via `useFlowProgress`.

## Error handling

- Coach call failure at any generative stage (restate/claim/impact): inline "coach
  unavailable — keep going" message, never blocks advancing (mirrors the Layer 1 fix).
- Claim mapping: if the coach returns a `mappedClaimId` not in the authored set, treat it
  as a mapping failure — fall back to letting the student pick an authored claim directly
  rather than blocking.
- Link stage: unchanged deterministic grading (no AI needed).
- Malformed `flow-motions.json`: fails loudly at import; bank-invariant test guards
  winnability.

## Testing

- Pure: `flowMachine` (stage/sub-step/side transitions, FOR-gates-AGAINST, side
  completion); unified content schema (valid/invalid); bank invariant (per claim: ≥1
  fitting evidence + ≥1 fitting reasoning + ≥1 great-but-wrong; exactly 3 claims per
  authored side); `flowProgress` store (empty default, round-trip under
  `constructive:flow:v1`, independence, corrupt-storage + malformed-entry fallback); reuse
  existing `gradeBridge` tests.
- Coach: `claim` step (maps to an authored id, validates the id is in-set, structured
  output) and `impact` step, both with the mocked Claude client.
- Component: `FlowShell` drives Read→Claim→Link→Impact with stubbed `fetch` and a test
  content fixture — the Claim stage surfaces the mapped claim and carries it into Link;
  AGAINST is locked until FOR completes; a `mappedClaimId` outside the set falls back to
  manual pick.

## Open questions (deferred, do not block this sub-project)

- Exact "great but wrong" authoring per new motion — reuse/adapt the existing Layer 2
  bank content where motions overlap.
- Whether AGAINST is authored in this build or a fast-follow — schema supports empty; FOR
  ships first.
- Standalone practice, gating, example library, combination scenarios, LLM motions — later
  sub-projects.
