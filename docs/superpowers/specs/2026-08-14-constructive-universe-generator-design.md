# Constructive — Fictional-Universe Motion Generator Design

**Date:** 2026-08-14
**Status:** Approved for planning
**Scope:** A user-driven feature: the student enters ANY fictional universe (Harry Potter, Naruto, Jujutsu Kaisen, Lord of the Rings, any show/book/game) and a capable model generates tailored debate content that flows straight into the existing per-motion journey (Read → Claim → Link → Impact, both sides). Replaces the never-built static "example library" and "LLM-generated motions" roadmap items with one dynamic feature.

## Background

Constructive's per-motion journey runs on `FlowMotion` objects — a deep nested shape validated by Zod: `{ id, motion, keywords[], sides: { for: { claims[] }, against: { claims[] } } }`, where each `FlowClaim` is `{ id, claim, impact, candidates[] }` and each `LinkCandidate` is `{ id, text, material: "evidence"|"reasoning", verdict: "fits"|"doesnt-fit"|"great-but-wrong", explanation }`. Today these come only from a static `content/flow-motions.json`, validated once at import (`lib/flowMotions.ts`), surfaced as cards by `FlowDeck`, and played through `FlowShell`. All user state is `localStorage`; there is no database. The LLM client (`lib/ai/claude.ts` → `getChatClient()`) is Anthropic (`COACH_MODEL`, default `claude-sonnet-5`) with an OpenAI fallback, exposing `ChatClient.complete({ system, user }): Promise<string>`; `runCoach` parses the returned text as JSON and validates it with a Zod discriminated union.

This feature lets students generate their own motions for a universe they love, grounded in that universe's characters and conflicts, without any authored content — while producing objects that satisfy the exact same schemas and gameplay invariants the journey depends on.

## Goals

- Let a student enter any fictional universe and get tailored, age-appropriate debate motions grounded in it.
- Generate content that fits `FlowMotionSchema` exactly, so generated motions play through the unchanged journey (Read→Claim→Link→Impact, both sides).
- Guarantee the Link "bridge" is solvable for every generated claim.
- Keep it safe and age-appropriate for grades 5–12, and robust against prompt injection and malformed model output.
- Persist generated universes per-device so they reappear on return; coexist with the seeded static bank.

## Non-goals

- No database or shared server cache (localStorage only, v1). A shared cache keyed by universe is a possible later optimization.
- No streaming of generated content; a good loading state instead.
- No editing of generated content; no media/images.
- No changes to the coach, voice, existing journey behavior, routing, or the auth model (reuse the cohort gate + session cookie).

## Decisions (from brainstorming)

- **Two-phase generation** (fast suggestions, then scaffold-on-open).
- **Per-device persistence** (localStorage).
- **Default generation model `claude-sonnet-5`**, env-configurable via `GENERATE_MODEL`.

## Two-phase generation

### Phase 1 — Suggest motions (fast)
`POST /api/generate/motions` with `{ universe: string }`. The model returns ~4 lightweight motion cards, each `{ motion, keywords, hook }`:
- `motion` — a debatable statement grounded in the universe (e.g. "This house believes the Hidden Villages do more harm than good").
- `keywords` — the same `Keyword[]` shape the Read/Keyword stage uses (`{ word, hint }`), 2–4 per motion.
- `hook` — one friendly sentence framing why it's fun to argue.

No scaffolding in phase 1 (bounded, fast). Or, if the input is unsuitable, the model returns a **refusal** (see Safety).

### Phase 2 — Scaffold a motion (on demand)
`POST /api/generate/scaffold` with `{ universe, motion, keywords }` (the chosen card). The model returns the `sides` object — `{ for: { claims[] }, against: { claims[] } }` — where each claim carries `claim`, `impact`, and `candidates[]`. The server normalizes ids and enforces the solvability invariant (below), then assembles a complete `FlowMotion = { id, motion, keywords, sides }`. This plays through `FlowShell` exactly like a seeded motion. Only motions the student opens are scaffolded.

## Correctness normalization (server-side, after generation)

The model is not trusted for ids or gameplay invariants; the server fixes both before the content is used.

- **ID assignment (deterministic):** motion id `gen:{slug(universe)}:{index}`; claim ids `c1, c2, …`; candidate ids by material `e1, e2, …` / `r1, r2, …`. This keeps `claimToScenario(motionId, claim)` namespacing intact so per-motion Link progress in localStorage never collides.
- **Bridge solvability invariant (per claim):** each claim's `candidates` must include at least one `{ material: "evidence", verdict: "fits" }`, at least one `{ material: "reasoning", verdict: "fits" }`, and at least one candidate with `verdict !== "fits"` (a distractor). This is exactly what `gradeBridge` needs for a buildable, non-trivial bridge. Enforced after parse; a claim that fails triggers one repair retry (feed the specific failure back to the model); if it still fails, that claim is dropped. A side must retain at least one valid claim, and a motion must retain at least one valid claim per side, or the scaffold is rejected with a graceful error.

## Schema-constrained generation + validation/repair

Mirror the existing `runCoach` pattern for consistency and to keep the OpenAI fallback path symmetric (so no Anthropic-only tool-use):

1. Build a `{ system, user }` prompt that specifies the exact JSON shape and rules; embed the untrusted `universe` (and chosen `motion`) as clearly delimited data.
2. `client.complete(...)` → `JSON.parse` → Zod validate against the phase's schema.
3. On parse/validation failure, **one repair retry**: re-prompt with the raw output and the specific error, asking for corrected JSON only.
4. On repeated failure, throw; the route returns a graceful error and the UI offers retry.

New Zod schemas (in `lib/schemas.ts`):
- `GeneratedMotionCardSchema` — `{ motion: string, keywords: Keyword[], hook: string }`.
- `GeneratedMotionsResponseSchema` — a discriminated union on a `kind`/`refused` flag: either `{ motions: GeneratedMotionCard[] (1..6) }` or `{ refused: true, reason: string }`.
- `GeneratedSidesSchema` — an **id-less variant** of `FlowMotion`'s `sides`: `{ for: { claims: GeneratedClaim[] }, against: { claims: GeneratedClaim[] } }` where `GeneratedClaim = { claim, impact, candidates: GeneratedCandidate[] }` and `GeneratedCandidate = { text, material, verdict, explanation }` (same fields as `FlowClaim`/`LinkCandidate` minus `id`). The model produces these; the normalizer adds ids to yield the id-bearing `FlowMotion` that `FlowMotionSchema` accepts.
- `GeneratedScaffoldResponseSchema` — either `{ sides: GeneratedSides }` or `{ refused, reason }`.

Ids in generated JSON are never required from the model — the server assigns them during normalization. The discriminant that distinguishes a success payload from a `{ refused, reason }` payload (a `kind` literal vs a `refused` boolean) is fixed by the implementation plan; both phase responses carry the same refusal branch.

## Safety & age-appropriateness

- **Untrusted input:** the `universe` (and chosen `motion`) strings are embedded as delimited data with an explicit instruction to treat them only as a fictional-universe name / motion text, never as instructions — standard prompt-injection mitigation.
- **Age gate:** prompts require G/PG, school-safe content (no graphic violence, romance, or mature themes; debates about ideas, not fandom flame wars). If the input is not a recognizable fictional universe, or is inappropriate for a school setting, the model returns `{ refused: true, reason }`; the UI shows a friendly nudge to pick a school-friendly book/show/game. The refusal branch is a first-class part of both phase schemas.
- **Cost containment:** requests are behind the cohort gate; generated content is cached in localStorage (regeneration only on an explicit action); two-phase means only opened motions are scaffolded; `max_tokens` caps bound each call.

## Model configuration

- Extend the client factory so a model can be supplied (e.g. `createAnthropicClient(apiKey, model)` / `createOpenAIClient(apiKey, model)`), and add `getGenerateClient()` that uses `GENERATE_MODEL` (default `claude-sonnet-5`) with the same OpenAI fallback. `getChatClient()` (coach) is unchanged.

## Persistence (localStorage)

- `lib/state/generatedUniverses.ts` — a hydration-safe, corruption-tolerant store under key `constructive:universes:v1`, shaped `Record<universeKey, GeneratedUniverse>` where `GeneratedUniverse = { universe: string, createdAt: string, motions: StoredMotionCard[] }` and `StoredMotionCard = { id, motion, keywords, hook, sides: GeneratedSides | null }` (`sides` filled lazily on phase 2). `universeKey = slug(universe)`.
- Read tolerates corrupt/malformed JSON (drops bad entries, returns `{}`), matching the existing stores.
- Progress on generated motions reuses the existing `flowProgress` store keyed by the (stable, namespaced) generated motion id — no new progress mechanism.

## UI (deck integration)

- `components/FlowDeck.tsx` gains a **"Bring your own universe"** panel (extracted into a small `components/UniverseGenerator.tsx` for focus) above the "Pick a motion" section: an input ("Try Harry Potter, Naruto, Lord of the Rings…") + a Generate `Button`.
- On Generate → a phase-1 loading state → generated cards render in a distinct **"Your {universe} debates ✨"** section (a generated `Badge`), coexisting with the seeded bank below.
- Clicking a generated card → if not yet scaffolded, a phase-2 loading state, then open `FlowShell` with the assembled `FlowMotion`; if cached, open immediately.
- Previously generated universes persist and reappear on return (hydration-safe), each with **remove** and **regenerate** controls.
- The seeded static bank and its progress behavior are unchanged.

## Error handling

- Phase 1/2 failures (model error, non-JSON, invalid after repair): a friendly inline error with a retry button; the deck never crashes.
- Refusals: the friendly "school-friendly universe" nudge.
- Empty/whitespace or duplicate universe input: client-side validation before calling.
- Corrupt localStorage: tolerant read yields an empty set — never blocks the deck.

## Testing

- **Pure/unit:** the id-normalizer and solvability enforcer (given raw model output → a normalized `FlowMotion`; a failing claim is repaired or dropped; an all-invalid scaffold is rejected); refusal parsing; the `generatedUniverses` store round-trip + corruption tolerance; `slug`.
- **`lib/ai/generate.ts` with a stub `ChatClient`** (as the coach tests do): phase-1 and phase-2 happy paths, the repair path, the refusal path, and the invalid-after-repair error.
- **Routes:** valid body → 200 with the validated shape (stub client); invalid body → 400; model failure → graceful 500.
- **Deck UI:** entering a universe + Generate triggers phase 1 (stubbed) → cards render; clicking a card triggers phase 2 → `FlowShell` opens (the restate prompt appears); generated section coexists with the seeded bank; the gate/existing behavior is preserved.
- **Gates:** full suite green, `npx tsc --noEmit` clean, `npm run build` succeeds; accessible names preserved.

## Open questions

None blocking. A shared server-side cache keyed by universe (cost/latency savings for repeated universes across the cohort) is deferred to a later iteration; the localStorage design does not preclude adding it behind the same routes.
