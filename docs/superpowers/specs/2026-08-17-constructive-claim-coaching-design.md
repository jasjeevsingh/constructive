# Constructive — Claim Coaching Loop + Rubric Design

**Date:** 2026-08-17
**Status:** Approved for planning
**Scope:** Branch 2 of 3 in the beta-feedback series. Replaces the single-shot claim step with a
multi-turn coaching loop governed by an editable claim-quality rubric, and applies that same rubric
to the AI that authors claims. The Deepgram conversational side helper (branch 3) is **not** in scope.

## Background

A beta user reported that the claim generator "takes whatever the user writes in one block and refines
it into a claim in a single shot — too passive; the user doesn't arrive at the claim themselves." They
also reported claims that were too vague (one claim covering cheating, distraction, and texting at
once) and the same reasoning repeated across attempts.

Verification confirmed all of it, and found the cause is structural rather than a prompt tweak:

- `lib/prompts/claim.ts:7-13` does not refine anything. It **classifies** the student's text onto a
  pre-authored claim. Its only behavioral instruction is "React encouragingly in 1-2 sentences."
  It encodes **zero** quality standard, never asks a question, and has no way to say "not yet."
- `lib/schemas.ts:22-26` — `CoachRequestSchema` is `{step, motion, payload}`. There is no history field.
- `lib/ai/claude.ts:21-27` — `complete()` sends `messages: [{role:"user", content:user}]`, a single
  message. Nothing carries prior turns. Resubmitting sends an identical, independent request, which is
  exactly why the coach repeats itself.
- The vague multi-topic claims come from `lib/prompts/generateScaffold.ts:12` — `"Give 1-2 claims per
  side"` with no specificity constraint anywhere.
- A repo-wide search for `rubric|criteri|scorecard|good enough|too vague|one idea` found **no rubric of
  any kind**. The only near-miss is a motion-reader spec line explicitly deferring scoring as out of scope.

The closest existing model for the right behavior is `lib/prompts/refine.ts:11`: *"For each
weak/duplicate argument ask ONE sharpening question. DO NOT rewrite their arguments for them."* That
instinct is already in the codebase; it has simply never been applied to claims.

## Decisions (from brainstorming)

- **Rubric criteria:** four — one idea, takes a side, concrete, contestable.
- **Turn cap:** soft cap at 3. The coach never blocks a student; at the cap it closes warmly and lets
  them through.
- **Rubric reach:** one rubric, used by both the coaching loop and the scaffold generator.
- **Branch scope:** the Claim stage only. Impact coaching is a later follow-up.

## Goals

- The student arrives at a sharper claim by answering guiding questions, rather than receiving a
  finished answer.
- The AI has an explicit, external standard for when a claim is good enough, so it knows when to stop.
- Generated claims meet the same bar the coach holds students to.
- The rubric is editable by a non-programmer without touching code.

## Non-goals

- No Impact-stage coaching, and no second rubric.
- No redesign of the Link stage (see the constraint below).
- No per-criterion pass/fail array in the coach response — the guiding question already tells the
  student what to fix, and every extra required field is another parse failure mode.
- No change to the Read, Link, or Impact stages, to the practice drills, or to voice.
- No scorecard. The rubric is designed to feed one later, but building it is out of scope.

## Binding structural constraint

The Link stage renders from an **authored** claim's bridge candidates —
`FlowShell` calls `claimToScenario(motion.id, mappedClaim)`, and `mappedClaim` is looked up by
`progress.mappedClaimId` among `motion.sides[side].claims`. A free-text student claim has no
candidates, so the coaching loop **must still terminate in a mapping onto an authored claim**.

The student therefore arrives at their own sharper claim through the questions, then sees which
authored claim it is closest to. This is a real improvement over one-shot classification, but it is
explicitly not "carry the student's exact words forward" — that would require redesigning Link.

## The rubric — `content/claim-rubric.json`

Stored as JSON rather than prose, matching how this repo already stores content
(`content/flow-motions.json` is parsed through a Zod schema at import, so a malformed bank throws
loudly at startup). JSON bundles reliably, is schema-validated, is trivially editable by a
non-programmer, and can be rendered to students later without re-parsing prose.

Shape:

```
{
  "version": 1,
  "intro": string,
  "criteria": [
    { "id": string, "name": string, "test": string, "bad": string, "good": string }
  ]
}
```

Four criteria, ids `one-idea`, `takes-a-side`, `concrete`, `contestable`. Every criterion carries a
one-line `test` plus a contrasting `bad`/`good` example pair — the examples do most of the work in the
prompt, and they are the part a coach is most likely to want to edit.

- `ClaimRubricSchema` is added to `lib/schemas.ts`, requiring at least one criterion and non-empty
  strings throughout.
- `lib/claimRubric.ts` parses it once at import and exposes `getClaimRubric()`, mirroring
  `lib/flowMotions.ts:11`. It also exposes `renderRubric(): string` — the single shared text block
  embedded in both prompts, so the two consumers can never drift apart.
- `CLAIM_TURN_CAP = 3` is exported from `lib/claimRubric.ts` so the prompt and the UI read the same
  constant.

## Transport — `ChatClient` gains history

`lib/ai/claude.ts` currently hard-codes a single user message. Add an optional `history`:

```
export type ChatTurn = { role: "user" | "assistant"; content: string };
complete(args: { system: string; user: string; history?: ChatTurn[] }): Promise<string>
```

- Anthropic: `messages: [...(history ?? []), { role: "user", content: user }]`
- OpenAI: `[{role:"system", content:system}, ...(history ?? []), {role:"user", content:user}]`
- `createFallbackClient` already forwards `args` opaquely and needs no change.

Optional and additive, so all five other prompt builders and both generate clients keep working
untouched.

## Coach contract

`lib/schemas.ts`:

```
CoachTurnSchema      = { role: "student" | "coach", text: string }
CoachRequestSchema   = { step, motion, payload, history?: CoachTurn[] }     // history added
ClaimResponseSchema  = { kind: "claim", reaction: string,
                         verdict: "keep-going" | "good-enough",
                         question: string | null,
                         mappedClaimId: string | null }                     // was a required string
```

`lib/ai/coach.ts`:

- `runCoach` converts `req.history` (`student`/`coach`) into `ChatTurn[]` (`user`/`assistant`) and
  passes it to `client.complete`.
- The existing mapped-id guard becomes **two** conditional checks, and both must be kept — this guard
  is what stops a hallucinated claim id from reaching the Link stage:
  1. a **non-null** `mappedClaimId` that is not in the authored set → throw (today's behavior).
  2. `verdict === "good-enough"` with a **null** `mappedClaimId` → throw.
  A null id with `verdict: "keep-going"` is the normal mid-loop case and must NOT throw.

## The claim prompt — `lib/prompts/claim.ts`

Rewritten around `refine.ts`'s posture. It receives the motion, side, the student's latest text, the
authored claims, the rendered rubric, the prior turns, and the turn number. It must:

- React warmly in one sentence, name the single most important thing to sharpen, and ask **exactly one**
  guiding question. Never rewrite the claim for the student.
- Set `verdict: "good-enough"` only when the claim meets all four criteria; otherwise `"keep-going"`.
- Set `mappedClaimId` when — and only when — the verdict is `good-enough` **or** this is the final turn
  (`CLAIM_TURN_CAP`). On the final turn it must map regardless of verdict, so a stuck student is never
  left without a way forward.
- Never invent a claim id.

## UI — `components/stages/ClaimStage.tsx`

State gains `turns: CoachTurn[]` (the running transcript) alongside the existing `mappedId`/`fallback`.
`attempt` is derived as the count of `student` turns.

- Each submit posts the student's text plus `history: turns`, then appends both the student turn and
  the coach's reaction to the transcript.
- The prior exchanges stay visible, so the student can see how their thinking sharpened.
- The input stays live while the verdict is `keep-going`.
- **Advance rule:** the mapped-claim card and the "Build the link →" button appear when
  `verdict === "good-enough" || attempt >= CLAIM_TURN_CAP`.
- If the loop ends at the cap with a null `mappedClaimId` (possible only if the model ignores the
  final-turn instruction), fall through to the existing manual claim-pick list rather than stranding
  the student. The list is already built for the coach-unavailable case.
- The existing coach-failure fallback is unchanged.

## Scaffold generator — `lib/prompts/generateScaffold.ts`

Embed the same `renderRubric()` block and require every authored claim to satisfy all four criteria.
This is what fixes the reported "one claim covering cheating, distraction, and texting at once": the
generator currently has no specificity constraint at all (`generateScaffold.ts:12`). Claim counts,
candidate rules, and the safety/refusal branch are unchanged.

## Error handling

- Malformed `content/claim-rubric.json` → throws loudly at import, exactly like the motion bank.
- Coach non-JSON or schema-invalid → unchanged, surfaces as the existing coach-unavailable fallback.
- Hallucinated or missing claim id → the two guards above.
- Cap reached with no mapping → manual pick list, never a dead end.
- History is optional everywhere, so a first turn behaves exactly like today's single request.

## Testing

Baseline to preserve: **217 tests / 57 files green**, `npx tsc --noEmit` clean, `npm run build` succeeds.

- **Rubric:** schema rejects an empty criteria list and blank fields; every criterion carries both a
  `bad` and a `good` example; `renderRubric()` contains all four criterion names.
- **Transport:** `complete()` with history places prior turns before the final user message, in order,
  for both the Anthropic and OpenAI clients; omitting history reproduces today's single-message shape.
- **Guards:** non-null id outside the authored set throws; `good-enough` with a null id throws;
  `keep-going` with a null id does **not** throw.
- **Prompt:** the claim prompt contains all four criterion names, the turn number, and the
  "do not rewrite" instruction; it renders prior turns when given them.
- **`ClaimStage`:** a `keep-going` response shows the question and does **not** reveal the
  "Build the link →" button; a `good-enough` response reveals it and calls `onComplete` with the mapped
  id; three `keep-going` responses in a row still advance at the cap; a cap-with-null-id response shows
  the manual pick list.
- **Scaffold:** `generateScaffoldPrompt` contains the rubric criteria.
- Existing claim tests (`tests/lib/prompts.flow.test.ts`, `tests/lib/ai/coach.flow.test.ts`,
  `tests/components/ClaimStage.test.tsx`, `tests/lib/schemas.test.ts`) are updated to the new contract —
  they currently encode the one-shot flow and a required `mappedClaimId`.

## Architecture / files

**Create:** `content/claim-rubric.json`, `lib/claimRubric.ts`, plus test files.

**Modify:** `lib/schemas.ts` · `lib/ai/claude.ts` · `lib/ai/coach.ts` · `lib/prompts/claim.ts` ·
`lib/prompts/generateScaffold.ts` · `components/stages/ClaimStage.tsx`

**Untouched:** `app/api/coach/route.ts` (it parses through `CoachRequestSchema`, which stays
backward-compatible), every other prompt builder, all other stages, the practice drills, voice, the
Link grading, and all content banks.

## Open questions

None blocking. A visible per-criterion checklist for the student, Impact-stage coaching, and feeding
the rubric into a scorecard are all deliberate follow-ups that this design leaves room for.
