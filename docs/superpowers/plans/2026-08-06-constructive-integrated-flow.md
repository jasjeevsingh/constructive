# Constructive — Integrated Per-Motion Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Constructive's two separate modules into one integrated per-motion journey — Read → Claim → Link → Impact, one side at a time (FOR first, AGAINST locked) — with a left progress rail, reusing the shipped step activities and adding a Claim stage, an Impact stage, a unified content model, and a flow shell.

**Architecture:** A new flow shell drives four stages using a pure flow state machine and a localStorage flow-progress store. It reuses `RestateStep`/`KeywordStep` (Read), `LinkCard`+`gradeBridge` (Link), and `VoiceOrTextInput`. Two new coach steps (`claim`, `impact`) extend the existing `/api/coach`. A single per-motion content object drives the whole journey; the standalone `/motions` and `/link` pages are removed (redirect to `/`).

**Tech Stack:** Next.js 14 (App Router, TS strict), React 18, Zod, existing Claude coach + Deepgram voice + OpenAI fallback, Vitest + React Testing Library + jsdom. All already installed.

## Global Constraints

- Reuse shipped infrastructure; do not duplicate the coach endpoint, voice, fallback client, gate, or the `VoiceOrTextInput`/`RestateStep`/`KeywordStep`/`LinkCard`/`gradeBridge` components.
- TypeScript `strict`; App Router only; `@/` → repo root. Keep the project **type-clean and build-clean**: before committing, `npx tsc --noEmit` (0 errors) and, for tasks touching pages/routes/components, `npm run build` must succeed.
- No new DB/auth. New persistence is `localStorage` only, under key exactly `constructive:flow:v1`.
- **One side at a time:** FOR runs end-to-end; AGAINST is locked until FOR completes.
- **Hybrid:** generate at Read/Claim/Impact (open input + coach), discover at Link (the curated plank bank, unchanged grading).
- **Claim mapping:** the student's own claim is mapped by the `claim` coach step to one of the authored claims for that side; the returned `mappedClaimId` MUST be one of the provided authored ids (validated in-set; out-of-set = mapping failure → client falls back to manual pick).
- Coach calls at generative stages are **non-blocking** on failure (inline message; never trap the student).
- **Content:** each authored side has **exactly 3 claims**; each claim's candidate bank has ≥1 `fits` `evidence`, ≥1 `fits` `reasoning`, and ≥1 `great-but-wrong` (so its bridge is winnable). FOR ships authored; AGAINST may ship empty.
- Link win condition unchanged: all fitting planks placed, no wrong ones, both an evidence and a reasoning plank present.
- Deterministic `gradeBridge` remains the sole grader for the Link stage.
- Brand tokens (CSS vars in `app/globals.css`): `--navy`, `--navy-mid`, `--navy-light`, `--gold`, `--orange`, `--orange-light`, `--dim`, `--text`. Evidence=gold, reasoning=orange.

## File Structure

```
constructive/
  content/flow-motions.json          # Create — unified per-motion bank (Task 1)
  lib/
    schemas.ts                       # Modify — FlowMotion schemas (Task 1) + claim/impact coach (Task 4)
    flowMotions.ts                   # Create — loader + adapters (Task 1)
    state/flowMachine.ts             # Create — pure stage/side model (Task 2)
    state/flowProgress.ts            # Create — pure localStorage store (Task 3)
    state/useFlowProgress.ts         # Create — thin hook (Task 3)
    prompts/claim.ts                 # Create — claim prompt (Task 4)
    prompts/impact.ts                # Create — impact prompt (Task 4)
    ai/coach.ts                      # Modify — claim/impact cases + mappedClaimId check (Task 4)
  components/
    stages/ClaimStage.tsx            # Create (Task 5)
    stages/ImpactStage.tsx           # Create (Task 5)
    LinkCard.tsx                     # Modify — optional onComplete (Task 6)
    FlowRail.tsx                     # Create (Task 7)
    FlowShell.tsx                    # Create (Task 7)
    FlowDeck.tsx                     # Create (Task 7)
  app/
    page.tsx                         # Modify — render FlowDeck (Task 7)
    motions/page.tsx                 # Modify — redirect("/") (Task 7)
    link/page.tsx                    # Modify — redirect("/") (Task 7)
  # Deleted in Task 7 (now unreachable): components/Deck.tsx, MotionCard.tsx, LinkDeck.tsx,
  #   components/steps/ArgumentsStep.tsx, tests/components/MotionCard.test.tsx,
  #   tests/components/ArgumentsStep.test.tsx, tests/app/home.test.tsx
```

**Deliberate deferral (documented, not silent dead code):** the pure legacy loaders/banks `lib/motions.ts`, `lib/linkScenarios.ts`, `content/motions.json`, `content/link-scenarios.json` and their unit tests are LEFT in place. They become unreferenced by app routes after Task 7 but stay green; they are retired in the future "standalone practice" sub-project, which may reuse that content. Do not delete them here (avoids unrelated churn and keeps this sub-project focused).

---

### Task 1: Unified content model — schemas, bank, loader, adapters

**Files:**
- Modify: `lib/schemas.ts` (append; do not alter existing exports)
- Create: `content/flow-motions.json`, `lib/flowMotions.ts`
- Test: `tests/lib/flowSchemas.test.ts`, `tests/lib/flowMotions.test.ts`

**Interfaces:**
- Consumes: existing `KeywordSchema`, `LinkCandidateSchema`, `Motion`, `LinkScenario` from `lib/schemas.ts`.
- Produces:
  - Schemas/types `FlowClaimSchema`/`FlowClaim`, `FlowSideSchema`, `FlowMotionSchema`/`FlowMotion`, `FlowMotionsFileSchema`.
  - `getFlowMotions(): FlowMotion[]`, `getFlowMotion(id): FlowMotion | undefined`.
  - `flowMotionToMotion(fm: FlowMotion): Motion`, `claimToScenario(claim: FlowClaim): LinkScenario`.

- [ ] **Step 1: Write the failing schema test** — `tests/lib/flowSchemas.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { FlowMotionSchema, FlowMotionsFileSchema } from "@/lib/schemas";

const claim = (id: string) => ({
  id,
  claim: "Kids deserve a say in decisions that affect their future.",
  impact: "Government invests more in young people's long-term future.",
  candidates: [
    { id: "c1", text: "Frees future voters to shape policy.", material: "reasoning", verdict: "fits", explanation: "Bridges claim to impact." },
    { id: "c2", text: "Turnout studies tie early voting to lifelong engagement.", material: "evidence", verdict: "fits", explanation: "Evidence for the impact." },
    { id: "c3", text: "A Nobel economist studied voting systems.", material: "evidence", verdict: "great-but-wrong", explanation: "Impressive but irrelevant." },
  ],
});
const good = {
  id: "m-x",
  motion: "This House would let kids vote.",
  keywords: [{ word: "kids", hint: null }],
  sides: { for: { claims: [claim("a"), claim("b"), claim("c")] }, against: { claims: [] } },
};

describe("FlowMotionSchema", () => {
  it("accepts a well-formed flow motion", () => {
    expect(FlowMotionSchema.parse(good)).toEqual(good);
  });
  it("rejects a claim with an unknown verdict", () => {
    const bad = JSON.parse(JSON.stringify(good));
    bad.sides.for.claims[0].candidates[0].verdict = "nope";
    expect(() => FlowMotionSchema.parse(bad)).toThrow();
  });
  it("validates an array file", () => {
    expect(() => FlowMotionsFileSchema.parse([good])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/flowSchemas.test.ts`
Expected: FAIL — `FlowMotionSchema` not exported.

- [ ] **Step 3: Append schemas to `lib/schemas.ts`** (add at end; reuse `KeywordSchema` and `LinkCandidateSchema` already defined above in the file)

```ts
export const FlowClaimSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  impact: z.string().min(1),
  candidates: z.array(LinkCandidateSchema).min(2),
});
export type FlowClaim = z.infer<typeof FlowClaimSchema>;

export const FlowSideSchema = z.object({
  claims: z.array(FlowClaimSchema),
});

export const FlowMotionSchema = z.object({
  id: z.string().min(1),
  motion: z.string().min(1),
  keywords: z.array(KeywordSchema),
  sides: z.object({ for: FlowSideSchema, against: FlowSideSchema }),
});
export type FlowMotion = z.infer<typeof FlowMotionSchema>;

export const FlowMotionsFileSchema = z.array(FlowMotionSchema);
```

- [ ] **Step 4: Create `content/flow-motions.json`** (starter bank — author the FOR side of 4 motions; 2 shown fully, add 2 more of the same shape. Every FOR side has exactly 3 claims; every claim has ≥1 fits/evidence, ≥1 fits/reasoning, ≥1 great-but-wrong. `against.claims` is `[]`.)

```json
[
  {
    "id": "m-kids-vote",
    "motion": "This House would let kids vote.",
    "keywords": [
      { "word": "kids", "hint": "Age 5 or 17? Scope is the real fight." },
      { "word": "vote", "hint": null }
    ],
    "sides": {
      "for": {
        "claims": [
          {
            "id": "c-stake",
            "claim": "Kids deserve a say in decisions that affect their future.",
            "impact": "A government answerable to young people invests more in their long-term future.",
            "candidates": [
              { "id": "c1", "text": "Politicians chase the votes they need, so youth issues rise up the agenda.", "material": "reasoning", "verdict": "fits", "explanation": "Links enfranchising kids to what politicians prioritize." },
              { "id": "c2", "text": "Places that lowered the voting age saw more youth-focused budget measures.", "material": "evidence", "verdict": "fits", "explanation": "Evidence tying the vote to the investment impact." },
              { "id": "c3", "text": "A Nobel Prize was awarded for research on voting systems.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "Authoritative but says nothing about whether kids voting shifts investment." },
              { "id": "c4", "text": "Kids can already hold part-time jobs in many places.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "A maturity analogy that doesn't bridge to the investment impact." }
            ]
          },
          {
            "id": "c-habit",
            "claim": "Voting young builds a lifelong habit of participation.",
            "impact": "A generation of engaged, lifelong voters strengthens democracy.",
            "candidates": [
              { "id": "c1", "text": "Casting a first vote while still in school builds a routine that carries into adulthood.", "material": "reasoning", "verdict": "fits", "explanation": "Links early voting to the lifelong-habit impact." },
              { "id": "c2", "text": "Turnout studies show first voting at 16-17 predicts higher lifelong turnout.", "material": "evidence", "verdict": "fits", "explanation": "Direct evidence for the impact." },
              { "id": "c3", "text": "Social media use among teens is at an all-time high.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "A striking stat that doesn't connect to voting habits." },
              { "id": "c4", "text": "Adults sometimes forget to register.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "About adults, not about kids building a habit." }
            ]
          },
          {
            "id": "c-knowledge",
            "claim": "Teens learn civics in school right when they could use it.",
            "impact": "Voting reinforces classroom civics with real practice, producing better-informed citizens.",
            "candidates": [
              { "id": "c1", "text": "Applying civics lessons to a real ballot cements the learning.", "material": "reasoning", "verdict": "fits", "explanation": "Links school civics + voting to informed citizens." },
              { "id": "c2", "text": "Schools with mock-then-real voting programs report higher civic knowledge scores.", "material": "evidence", "verdict": "fits", "explanation": "Evidence for the informed-citizen impact." },
              { "id": "c3", "text": "Most teenagers own a smartphone.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "True and modern-sounding, but unrelated to civic knowledge." },
              { "id": "c4", "text": "Some adults can't name their representatives.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "A point about adults, not about teens' classroom civics." }
            ]
          }
        ]
      },
      "against": { "claims": [] }
    }
  },
  {
    "id": "m-homework",
    "motion": "This House would ban homework.",
    "keywords": [
      { "word": "ban", "hint": "A total ban, or limits? The strength of the wording matters." },
      { "word": "homework", "hint": "Reading? Projects? What counts?" }
    ],
    "sides": {
      "for": {
        "claims": [
          {
            "id": "c-rest",
            "claim": "Banning homework gives kids time to rest and be with family.",
            "impact": "Better-rested kids have stronger wellbeing and family relationships.",
            "candidates": [
              { "id": "c1", "text": "Free evenings mean more sleep and family time.", "material": "reasoning", "verdict": "fits", "explanation": "Bridges the ban to the wellbeing impact." },
              { "id": "c2", "text": "Studies link heavy homework loads to student stress and lost sleep.", "material": "evidence", "verdict": "fits", "explanation": "Evidence for the wellbeing impact." },
              { "id": "c3", "text": "A Harvard study found homework raises standardized-test scores.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "Impressive, but it argues FOR homework — wrong direction for this impact." },
              { "id": "c4", "text": "Homework teaches time management.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "A different impact; doesn't connect to rest/family." }
            ]
          },
          {
            "id": "c-equity",
            "claim": "Homework punishes kids who lack a quiet home or help.",
            "impact": "Removing homework narrows the gap between rich and poor students.",
            "candidates": [
              { "id": "c1", "text": "Kids without a desk or help fall behind on homework they can't do at home.", "material": "reasoning", "verdict": "fits", "explanation": "Links homework to the equity gap." },
              { "id": "c2", "text": "Achievement-gap research ties homework burden to home resources.", "material": "evidence", "verdict": "fits", "explanation": "Evidence for the equity impact." },
              { "id": "c3", "text": "The best universities assign heavy reading loads.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "Prestigious-sounding but irrelevant to K-12 equity." },
              { "id": "c4", "text": "Some kids enjoy homework.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "Preference, not the equity bridge." }
            ]
          },
          {
            "id": "c-focus",
            "claim": "Without homework, class time can be used for real learning.",
            "impact": "Learning concentrated in school leads to deeper understanding.",
            "candidates": [
              { "id": "c1", "text": "Teachers can guide practice in class instead of sending it home to struggle alone.", "material": "reasoning", "verdict": "fits", "explanation": "Links no-homework to in-class depth." },
              { "id": "c2", "text": "Some no-homework schools report equal or better comprehension.", "material": "evidence", "verdict": "fits", "explanation": "Evidence for the understanding impact." },
              { "id": "c3", "text": "The school day is six hours long on average.", "material": "evidence", "verdict": "great-but-wrong", "explanation": "A neutral fact that doesn't bridge to deeper learning." },
              { "id": "c4", "text": "Homework can be graded for credit.", "material": "reasoning", "verdict": "doesnt-fit", "explanation": "About grading, not about in-class depth." }
            ]
          }
        ]
      },
      "against": { "claims": [] }
    }
  }
]
```

- [ ] **Step 5: Write the failing loader/adapter test** — `tests/lib/flowMotions.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { getFlowMotions, getFlowMotion, flowMotionToMotion, claimToScenario } from "@/lib/flowMotions";

describe("flow motions bank", () => {
  it("loads and validates the bank", () => {
    expect(getFlowMotions().length).toBeGreaterThanOrEqual(2);
  });
  it("finds a motion by id", () => {
    expect(getFlowMotion("m-kids-vote")?.motion).toContain("let kids vote");
  });
  it("every authored FOR side has exactly 3 claims", () => {
    for (const m of getFlowMotions()) {
      if (m.sides.for.claims.length > 0) expect(m.sides.for.claims.length).toBe(3);
    }
  });
  it("every claim's bank is winnable and has a great-but-wrong trap", () => {
    for (const m of getFlowMotions()) {
      for (const c of m.sides.for.claims) {
        const fits = c.candidates.filter((x) => x.verdict === "fits");
        expect(fits.some((x) => x.material === "evidence")).toBe(true);
        expect(fits.some((x) => x.material === "reasoning")).toBe(true);
        expect(c.candidates.some((x) => x.verdict === "great-but-wrong")).toBe(true);
      }
    }
  });
  it("adapts a flow motion to a Motion (for KeywordStep)", () => {
    const m = getFlowMotion("m-kids-vote")!;
    const motion = flowMotionToMotion(m);
    expect(motion).toEqual({ id: m.id, motion: m.motion, keywords: m.keywords, theme: "general" });
  });
  it("adapts a claim to a LinkScenario (for LinkCard)", () => {
    const c = getFlowMotion("m-kids-vote")!.sides.for.claims[0];
    const s = claimToScenario(c);
    expect(s).toEqual({ id: c.id, claim: c.claim, impact: c.impact, candidates: c.candidates });
  });
});
```

- [ ] **Step 6: Create `lib/flowMotions.ts`**

```ts
import raw from "@/content/flow-motions.json";
import {
  FlowMotionsFileSchema,
  type FlowMotion,
  type FlowClaim,
  type Motion,
  type LinkScenario,
} from "@/lib/schemas";

// Validated once at import; a malformed bank throws loudly here.
const motions: FlowMotion[] = FlowMotionsFileSchema.parse(raw);

export function getFlowMotions(): FlowMotion[] {
  return motions;
}

export function getFlowMotion(id: string): FlowMotion | undefined {
  return motions.find((m) => m.id === id);
}

/** KeywordStep expects a Motion; flow motions carry the same fields plus a fixed theme. */
export function flowMotionToMotion(fm: FlowMotion): Motion {
  return { id: fm.id, motion: fm.motion, keywords: fm.keywords, theme: "general" };
}

/** LinkCard expects a LinkScenario; an authored claim already carries that shape. */
export function claimToScenario(claim: FlowClaim): LinkScenario {
  return { id: claim.id, claim: claim.claim, impact: claim.impact, candidates: claim.candidates };
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `npm test -- tests/lib/flowSchemas.test.ts tests/lib/flowMotions.test.ts && npx tsc --noEmit`
Expected: PASS (all cases); tsc clean.

- [ ] **Step 8: Commit**

```bash
git add lib/schemas.ts lib/flowMotions.ts content/flow-motions.json tests/lib/flowSchemas.test.ts tests/lib/flowMotions.test.ts
git commit -m "feat: unified flow-motion content model, bank, loader + adapters"
```

---

### Task 2: Flow state machine

**Files:**
- Create: `lib/state/flowMachine.ts`
- Test: `tests/lib/state/flowMachine.test.ts`

**Interfaces:**
- Produces: `type FlowStage`, `type ReadSubstep`, `type Side`; `STAGES`, `READ_SUBSTEPS`, `SIDES`; `nextStage(s)`, `prevStage(s)`, `stageIndex(s)`, `isLastStage(s)`, `againstUnlocked(forComplete)`.

- [ ] **Step 1: Write the failing test** — `tests/lib/state/flowMachine.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  STAGES, READ_SUBSTEPS, SIDES, nextStage, prevStage, stageIndex, isLastStage, againstUnlocked,
} from "@/lib/state/flowMachine";

describe("flowMachine", () => {
  it("declares stages, read substeps, and sides in order", () => {
    expect(STAGES).toEqual(["read", "claim", "link", "impact"]);
    expect(READ_SUBSTEPS).toEqual(["restate", "keyword"]);
    expect(SIDES).toEqual(["for", "against"]);
  });
  it("advances and clamps at the end", () => {
    expect(nextStage("read")).toBe("claim");
    expect(nextStage("impact")).toBe("impact");
  });
  it("goes back and clamps at the start", () => {
    expect(prevStage("claim")).toBe("read");
    expect(prevStage("read")).toBe("read");
  });
  it("reports index and last-stage", () => {
    expect(stageIndex("link")).toBe(2);
    expect(isLastStage("impact")).toBe(true);
    expect(isLastStage("read")).toBe(false);
  });
  it("unlocks AGAINST only once FOR is complete", () => {
    expect(againstUnlocked(false)).toBe(false);
    expect(againstUnlocked(true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/state/flowMachine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/state/flowMachine.ts`**

```ts
export type FlowStage = "read" | "claim" | "link" | "impact";
export type ReadSubstep = "restate" | "keyword";
export type Side = "for" | "against";

export const STAGES: FlowStage[] = ["read", "claim", "link", "impact"];
export const READ_SUBSTEPS: ReadSubstep[] = ["restate", "keyword"];
export const SIDES: Side[] = ["for", "against"];

export function stageIndex(s: FlowStage): number {
  return STAGES.indexOf(s);
}
export function nextStage(s: FlowStage): FlowStage {
  return STAGES[Math.min(stageIndex(s) + 1, STAGES.length - 1)];
}
export function prevStage(s: FlowStage): FlowStage {
  return STAGES[Math.max(stageIndex(s) - 1, 0)];
}
export function isLastStage(s: FlowStage): boolean {
  return stageIndex(s) === STAGES.length - 1;
}
export function againstUnlocked(forComplete: boolean): boolean {
  return forComplete;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/state/flowMachine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/state/flowMachine.ts tests/lib/state/flowMachine.test.ts
git commit -m "feat: flow state machine (stages, read substeps, sides, gating)"
```

---

### Task 3: Flow progress store + hook

**Files:**
- Create: `lib/state/flowProgress.ts`, `lib/state/useFlowProgress.ts`
- Test: `tests/lib/state/flowProgress.test.ts`

**Interfaces:**
- Consumes: `FlowStage`, `ReadSubstep`, `Side` (Task 2).
- Produces:
  - `FLOW_STORAGE_KEY = "constructive:flow:v1"`
  - `interface FlowProgress { side: Side; stage: FlowStage; readSubstep: ReadSubstep; restate: string; keywordAnswers: Record<string,string>; mappedClaimId: string | null; impact: string; forComplete: boolean; againstComplete: boolean }`
  - `emptyFlowProgress()`, `loadFlowProgress(storage, motionId)`, `saveFlowProgress(storage, motionId, p)`
  - Hook `useFlowProgress(motionId): [FlowProgress, (patch: Partial<FlowProgress>) => void]`

- [ ] **Step 1: Write the failing test** — `tests/lib/state/flowProgress.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyFlowProgress, loadFlowProgress, saveFlowProgress, FLOW_STORAGE_KEY,
} from "@/lib/state/flowProgress";

describe("flowProgress store", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty progress when nothing stored (defaults to FOR/read/restate)", () => {
    const p = loadFlowProgress(localStorage, "m1");
    expect(p).toEqual(emptyFlowProgress());
    expect(p.side).toBe("for");
    expect(p.stage).toBe("read");
    expect(p.readSubstep).toBe("restate");
  });
  it("round-trips under the versioned key", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), stage: "claim", mappedClaimId: "c-stake" });
    const p = loadFlowProgress(localStorage, "m1");
    expect(p.stage).toBe("claim");
    expect(p.mappedClaimId).toBe("c-stake");
    expect(localStorage.getItem(FLOW_STORAGE_KEY)).toContain("m1");
  });
  it("keeps motions independent", () => {
    saveFlowProgress(localStorage, "m1", { ...emptyFlowProgress(), forComplete: true });
    saveFlowProgress(localStorage, "m2", { ...emptyFlowProgress(), stage: "link" });
    expect(loadFlowProgress(localStorage, "m1").forComplete).toBe(true);
    expect(loadFlowProgress(localStorage, "m2").stage).toBe("link");
  });
  it("falls back to empty on corrupt storage", () => {
    localStorage.setItem(FLOW_STORAGE_KEY, "{nope");
    expect(loadFlowProgress(localStorage, "m1")).toEqual(emptyFlowProgress());
  });
  it("drops a malformed entry (missing fields) and returns empty for it", () => {
    localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({ m1: { stage: "claim" } }));
    expect(loadFlowProgress(localStorage, "m1")).toEqual(emptyFlowProgress());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/state/flowProgress.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/state/flowProgress.ts`**

```ts
import type { FlowStage, ReadSubstep, Side } from "@/lib/state/flowMachine";

export const FLOW_STORAGE_KEY = "constructive:flow:v1";

export interface FlowProgress {
  side: Side;
  stage: FlowStage;
  readSubstep: ReadSubstep;
  restate: string;
  keywordAnswers: Record<string, string>;
  mappedClaimId: string | null;
  impact: string;
  forComplete: boolean;
  againstComplete: boolean;
}

export function emptyFlowProgress(): FlowProgress {
  return {
    side: "for",
    stage: "read",
    readSubstep: "restate",
    restate: "",
    keywordAnswers: {},
    mappedClaimId: null,
    impact: "",
    forComplete: false,
    againstComplete: false,
  };
}

function isValidEntry(v: unknown): v is FlowProgress {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.side === "string" &&
    typeof e.stage === "string" &&
    typeof e.readSubstep === "string" &&
    typeof e.restate === "string" &&
    typeof e.impact === "string" &&
    typeof e.forComplete === "boolean" &&
    typeof e.againstComplete === "boolean" &&
    (e.mappedClaimId === null || typeof e.mappedClaimId === "string") &&
    !!e.keywordAnswers && typeof e.keywordAnswers === "object"
  );
}

function readAll(storage: Storage): Record<string, FlowProgress> {
  const raw = storage.getItem(FLOW_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, FlowProgress> = {};
    for (const [k, v] of Object.entries(parsed)) if (isValidEntry(v)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export function loadFlowProgress(storage: Storage, motionId: string): FlowProgress {
  return readAll(storage)[motionId] ?? emptyFlowProgress();
}

export function saveFlowProgress(storage: Storage, motionId: string, p: FlowProgress): void {
  const all = readAll(storage);
  all[motionId] = p;
  storage.setItem(FLOW_STORAGE_KEY, JSON.stringify(all));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/state/flowProgress.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the hook `lib/state/useFlowProgress.ts`** (thin wrapper; exercised via component tests in Task 7)

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import {
  emptyFlowProgress, loadFlowProgress, saveFlowProgress, type FlowProgress,
} from "@/lib/state/flowProgress";

export function useFlowProgress(
  motionId: string
): [FlowProgress, (patch: Partial<FlowProgress>) => void] {
  const [progress, setProgress] = useState<FlowProgress>(emptyFlowProgress());

  useEffect(() => {
    setProgress(loadFlowProgress(window.localStorage, motionId));
  }, [motionId]);

  const update = useCallback(
    (patch: Partial<FlowProgress>) => {
      setProgress((prev) => {
        const next = { ...prev, ...patch };
        saveFlowProgress(window.localStorage, motionId, next);
        return next;
      });
    },
    [motionId]
  );

  return [progress, update];
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/state/flowProgress.ts lib/state/useFlowProgress.ts tests/lib/state/flowProgress.test.ts
git commit -m "feat: flow progress store + hook (localStorage)"
```

---

### Task 4: Coach `claim` + `impact` steps

**Files:**
- Modify: `lib/schemas.ts` (add `"claim"`,`"impact"` to `CoachStepSchema`; add two response schemas to the union)
- Create: `lib/prompts/claim.ts`, `lib/prompts/impact.ts`
- Modify: `lib/ai/coach.ts` (two `buildPrompt` cases + in-set `mappedClaimId` check)
- Test: `tests/lib/prompts.flow.test.ts`, `tests/lib/ai/coach.flow.test.ts`

**Interfaces:**
- Consumes: existing `CoachResponseSchema`/`CoachRequest`/`CoachResponse`, `ChatClient`, `runCoach`.
- Produces:
  - `claimPrompt(input: { motion: string; side: string; studentClaim: string; authoredClaims: { id: string; claim: string }[] }): { system: string; user: string }`
  - `impactPrompt(input: { motion: string; claim: string; authoredImpact: string; studentImpact: string }): { system: string; user: string }`
  - `runCoach` handles `step: "claim"` (returns `{ kind:"claim", reaction, mappedClaimId }`, throws if `mappedClaimId` not among `payload.authoredClaims`) and `step: "impact"` (returns `{ kind:"impact", reaction }`).

- [ ] **Step 1: Write the failing prompt test** — `tests/lib/prompts.flow.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { claimPrompt } from "@/lib/prompts/claim";
import { impactPrompt } from "@/lib/prompts/impact";

describe("flow prompts", () => {
  it("claim prompt lists authored claim ids and asks for mappedClaimId JSON", () => {
    const p = claimPrompt({
      motion: "THW let kids vote.",
      side: "for",
      studentClaim: "kids live with laws longest",
      authoredClaims: [{ id: "c-stake", claim: "Kids deserve a say." }, { id: "c-habit", claim: "Voting builds a habit." }],
    });
    expect(p.user).toContain("kids live with laws longest");
    expect(p.user).toContain("c-stake");
    expect(p.user).toContain("c-habit");
    expect(p.system.toLowerCase()).toContain("json");
    expect(p.system).toContain('"mappedClaimId"');
  });
  it("impact prompt embeds claim + authored impact + student impact", () => {
    const p = impactPrompt({
      motion: "THW ban homework.",
      claim: "Homework harms wellbeing.",
      authoredImpact: "Better-rested kids.",
      studentImpact: "kids sleep more",
    });
    expect(p.user).toContain("Homework harms wellbeing.");
    expect(p.user).toContain("kids sleep more");
    expect(p.system).toContain('"kind":"impact"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/prompts.flow.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `lib/prompts/claim.ts`**

```ts
export function claimPrompt(input: {
  motion: string;
  side: string;
  studentClaim: string;
  authoredClaims: { id: string; claim: string }[];
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student proposed their own claim for one side of a motion.",
    "React encouragingly in 1-2 sentences, then choose which of the provided authored claims is the closest match.",
    "You MUST set mappedClaimId to exactly one of the provided claim ids — never invent an id.",
    'Respond ONLY as JSON: {"kind":"claim","reaction":string,"mappedClaimId":string}.',
  ].join(" ");
  const list = input.authoredClaims.map((c) => `${c.id}: ${c.claim}`).join("\n");
  const user = [
    `Motion: "${input.motion}"`,
    `Side: ${input.side}`,
    `Student's claim: "${input.studentClaim}"`,
    "Authored claims to choose from:",
    list,
  ].join("\n");
  return { system, user };
}
```

- [ ] **Step 4: Create `lib/prompts/impact.ts`**

```ts
export function impactPrompt(input: {
  motion: string;
  claim: string;
  authoredImpact: string;
  studentImpact: string;
}): { system: string; user: string } {
  const system = [
    "You are a warm debate coach for a student aged 10-18.",
    "The student is stating the impact — the 'so what' — that follows from their claim.",
    "React in 2-3 sentences: affirm what connects, and nudge once toward a broader or deeper consequence.",
    "Do not give the answer away; help them see it.",
    'Respond ONLY as JSON: {"kind":"impact","reaction":string}.',
  ].join(" ");
  const user = [
    `Motion: "${input.motion}"`,
    `Their claim: "${input.claim}"`,
    `A strong impact for reference (do not quote verbatim): "${input.authoredImpact}"`,
    `Student's impact: "${input.studentImpact}"`,
  ].join("\n");
  return { system, user };
}
```

- [ ] **Step 5: Update `lib/schemas.ts`** — two edits, leave the rest unchanged.

Replace the `CoachStepSchema` line:

```ts
export const CoachStepSchema = z.enum(["restate", "keyword", "refine", "link", "claim", "impact"]);
```

Add the two response schemas immediately before `CoachResponseSchema` and include them in the union:

```ts
export const ClaimResponseSchema = z.object({
  kind: z.literal("claim"),
  reaction: z.string(),
  mappedClaimId: z.string(),
});
export const ImpactResponseSchema = z.object({
  kind: z.literal("impact"),
  reaction: z.string(),
});
export const CoachResponseSchema = z.discriminatedUnion("kind", [
  RestateResponseSchema,
  KeywordResponseSchema,
  RefineResponseSchema,
  LinkResponseSchema,
  ClaimResponseSchema,
  ImpactResponseSchema,
]);
```

- [ ] **Step 6: Update `lib/ai/coach.ts`** — add imports, the two cases, and the in-set check.

Add imports near the other prompt imports:

```ts
import { claimPrompt } from "@/lib/prompts/claim";
import { impactPrompt } from "@/lib/prompts/impact";
```

Add these two cases inside `buildPrompt`'s `switch (req.step)`:

```ts
    case "claim":
      return claimPrompt({
        motion: req.motion,
        side: String(p.side ?? ""),
        studentClaim: String(p.studentClaim ?? ""),
        authoredClaims: (p.authoredClaims as { id: string; claim: string }[]) ?? [],
      });
    case "impact":
      return impactPrompt({
        motion: req.motion,
        claim: String(p.claim ?? ""),
        authoredImpact: String(p.authoredImpact ?? ""),
        studentImpact: String(p.studentImpact ?? ""),
      });
```

Replace the final `return CoachResponseSchema.parse(parsed);` in `runCoach` with a version that validates the claim mapping in-set:

```ts
  const result = CoachResponseSchema.parse(parsed);
  if (result.kind === "claim") {
    const ids = ((req.payload.authoredClaims as { id: string }[] | undefined) ?? []).map((c) => c.id);
    if (!ids.includes(result.mappedClaimId)) {
      throw new Error("coach mapped claim to an id outside the authored set");
    }
  }
  return result;
```

- [ ] **Step 7: Write the failing coach test** — `tests/lib/ai/coach.flow.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { runCoach } from "@/lib/ai/coach";
import type { ChatClient } from "@/lib/ai/claude";

function fake(reply: string): ChatClient & { calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  return { calls, async complete(a) { calls.push(a); return reply; } };
}

const claimReq = {
  step: "claim" as const,
  motion: "THW let kids vote.",
  payload: { side: "for", studentClaim: "kids live with laws longest", authoredClaims: [{ id: "c-stake", claim: "Kids deserve a say." }] },
};

describe("runCoach claim + impact", () => {
  it("returns a claim mapping when the id is in the authored set", async () => {
    const res = await runCoach(claimReq, fake(JSON.stringify({ kind: "claim", reaction: "Good instinct!", mappedClaimId: "c-stake" })));
    expect(res).toMatchObject({ kind: "claim", mappedClaimId: "c-stake" });
  });
  it("throws when the coach maps to an id NOT in the authored set", async () => {
    await expect(
      runCoach(claimReq, fake(JSON.stringify({ kind: "claim", reaction: "x", mappedClaimId: "c-nope" })))
    ).rejects.toThrow(/authored set/);
  });
  it("parses an impact response", async () => {
    const res = await runCoach(
      { step: "impact", motion: "m", payload: { claim: "c", authoredImpact: "a", studentImpact: "s" } },
      fake(JSON.stringify({ kind: "impact", reaction: "Nice — push it further." }))
    );
    expect(res).toMatchObject({ kind: "impact" });
  });
});
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- tests/lib/prompts.flow.test.ts tests/lib/ai/coach.flow.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean. (The `/api/coach` route validates generically and needs no change.)

- [ ] **Step 9: Commit**

```bash
git add lib/schemas.ts lib/prompts/claim.ts lib/prompts/impact.ts lib/ai/coach.ts tests/lib/prompts.flow.test.ts tests/lib/ai/coach.flow.test.ts
git commit -m "feat: add claim + impact coach steps with in-set mapping check"
```

---

### Task 5: Claim + Impact stage components

**Files:**
- Create: `components/stages/ClaimStage.tsx`, `components/stages/ImpactStage.tsx`
- Test: `tests/components/ClaimStage.test.tsx`

**Interfaces:**
- Consumes: `VoiceOrTextInput`, `/api/coach` (stubbed in tests), `FlowClaim` type.
- Produces:
  - `ClaimStage({ motion, side, claims, onComplete }: { motion: string; side: "for"|"against"; claims: { id: string; claim: string }[]; onComplete: (mappedClaimId: string) => void })`
  - `ImpactStage({ motion, claim, authoredImpact, onComplete }: { motion: string; claim: string; authoredImpact: string; onComplete: (impact: string) => void })`

- [ ] **Step 1: Write the failing test** — `tests/components/ClaimStage.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClaimStage } from "@/components/stages/ClaimStage";

const claims = [{ id: "c-stake", claim: "Kids deserve a say." }, { id: "c-habit", claim: "Voting builds a habit." }];

describe("ClaimStage", () => {
  beforeEach(() => localStorage.clear());

  it("maps a spoken claim to an authored claim and lets the student continue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ kind: "claim", reaction: "Good instinct!", mappedClaimId: "c-stake" }), { status: 200 })
    ));
    const onComplete = vi.fn();
    render(<ClaimStage motion="THW let kids vote." side="for" claims={claims} onComplete={onComplete} />);
    await userEvent.type(screen.getByRole("textbox"), "kids live with laws longest");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText(/good instinct/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /build the link/i }));
    expect(onComplete).toHaveBeenCalledWith("c-stake");
  });

  it("falls back to manual pick when the coach call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    const onComplete = vi.fn();
    render(<ClaimStage motion="THW let kids vote." side="for" claims={claims} onComplete={onComplete} />);
    await userEvent.type(screen.getByRole("textbox"), "something");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    // On failure, the authored claims are offered as pick buttons.
    await userEvent.click(await screen.findByRole("button", { name: /kids deserve a say/i }));
    expect(onComplete).toHaveBeenCalledWith("c-stake");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/ClaimStage.test.tsx`
Expected: FAIL — `@/components/stages/ClaimStage` not found.

- [ ] **Step 3: Create `components/stages/ClaimStage.tsx`**

```tsx
"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import type { CoachResponse } from "@/lib/schemas";

export function ClaimStage({
  motion,
  side,
  claims,
  onComplete,
}: {
  motion: string;
  side: "for" | "against";
  claims: { id: string; claim: string }[];
  onComplete: (mappedClaimId: string) => void;
}) {
  const [reaction, setReaction] = useState<string | null>(null);
  const [mappedId, setMappedId] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);

  async function submit(text: string) {
    if (!text.trim()) return;
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "claim",
          motion,
          payload: { side, studentClaim: text, authoredClaims: claims },
        }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind === "claim") {
        setReaction(data.reaction);
        setMappedId(data.mappedClaimId);
      }
    } catch {
      setFallback(true);
    }
  }

  const mapped = claims.find((c) => c.id === mappedId);

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--gold)" }}>Stage 2 · Claim</div>
      <p style={{ fontSize: 17, color: "#fff", margin: "6px 0 14px" }}>
        What&apos;s your strongest claim {side === "for" ? "for" : "against"} this motion?
      </p>
      <VoiceOrTextInput label="Say or type your claim" onSubmit={submit} />

      {reaction && mapped && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "var(--orange-light)" }}>💬 {reaction}</p>
          <p style={{ color: "var(--dim)", fontSize: 13 }}>
            We&apos;ll carry this forward as: <b style={{ color: "var(--gold)" }}>{mapped.claim}</b>
          </p>
          <button type="button" onClick={() => onComplete(mapped.id)} style={{ marginTop: 8 }}>
            Build the link →
          </button>
        </div>
      )}

      {fallback && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "var(--orange-light)", fontSize: 13 }}>Coach unavailable — pick the claim closest to yours:</p>
          {claims.map((c) => (
            <button key={c.id} type="button" onClick={() => onComplete(c.id)} style={{ display: "block", textAlign: "left", margin: "6px 0", width: "100%" }}>
              {c.claim}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/ClaimStage.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 5: Create `components/stages/ImpactStage.tsx`** (no separate unit test — exercised via the FlowShell test in Task 7; thin, same pattern as ClaimStage)

```tsx
"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import type { CoachResponse } from "@/lib/schemas";

export function ImpactStage({
  motion,
  claim,
  authoredImpact,
  onComplete,
}: {
  motion: string;
  claim: string;
  authoredImpact: string;
  onComplete: (impact: string) => void;
}) {
  const [reaction, setReaction] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState("");

  async function submit(text: string) {
    if (!text.trim()) return;
    setSaved(text);
    setError(false);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "impact", motion, payload: { claim, authoredImpact, studentImpact: text } }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind === "impact") setReaction(data.reaction);
    } catch {
      setError(true);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "var(--gold)" }}>Stage 4 · Impact</div>
      <p style={{ fontSize: 17, color: "#fff", margin: "6px 0 14px" }}>So what? Why does this claim matter — what&apos;s the bigger consequence?</p>
      <VoiceOrTextInput label="Say or type the impact" onSubmit={submit} />
      {reaction && <p style={{ color: "var(--orange-light)", marginTop: 12 }}>💬 {reaction}</p>}
      {error && <p style={{ color: "var(--orange-light)", marginTop: 12 }}>Coach unavailable — keep going.</p>}
      {(reaction || error) && (
        <button type="button" onClick={() => onComplete(saved)} style={{ marginTop: 10 }}>
          Finish this side ✓
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add components/stages/ClaimStage.tsx components/stages/ImpactStage.tsx tests/components/ClaimStage.test.tsx
git commit -m "feat: Claim and Impact flow stages"
```

---

### Task 6: LinkCard `onComplete` adaptation

**Files:**
- Modify: `components/LinkCard.tsx`
- Test: `tests/components/LinkCard.onComplete.test.tsx`

**Interfaces:**
- Consumes: existing `LinkCard` (`{ scenario, onExit }`), `gradeBridge`.
- Produces: `LinkCard({ scenario, onExit, onComplete? }: { scenario: LinkScenario; onExit: () => void; onComplete?: () => void })` — when `onComplete` is provided and the bridge holds after a test, a "Continue →" button appears that calls `onComplete`. Existing behavior (no `onComplete`) is unchanged.

- [ ] **Step 1: Write the failing test** — `tests/components/LinkCard.onComplete.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkCard } from "@/components/LinkCard";
import type { LinkScenario } from "@/lib/schemas";

const scenario: LinkScenario = {
  id: "s",
  claim: "Kids deserve a say.",
  impact: "Better future.",
  candidates: [
    { id: "e1", text: "Studies tie voting to engagement.", material: "evidence", verdict: "fits", explanation: "x" },
    { id: "r1", text: "Politicians chase youth votes.", material: "reasoning", verdict: "fits", explanation: "x" },
    { id: "gbw", text: "A Nobel was won on voting theory.", material: "evidence", verdict: "great-but-wrong", explanation: "x" },
  ],
};

beforeEach(() => localStorage.clear());

describe("LinkCard onComplete", () => {
  it("shows a Continue button that fires onComplete once the bridge holds", async () => {
    const onComplete = vi.fn();
    render(<LinkCard scenario={scenario} onExit={() => {}} onComplete={onComplete} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*studies tie voting/i }));
    await userEvent.click(screen.getByRole("button", { name: /build .*politicians chase/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    const cont = await screen.findByRole("button", { name: /continue/i });
    await userEvent.click(cont);
    expect(onComplete).toHaveBeenCalled();
  });

  it("does not render Continue when onComplete is omitted", async () => {
    render(<LinkCard scenario={scenario} onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /build .*studies tie voting/i }));
    await userEvent.click(screen.getByRole("button", { name: /build .*politicians chase/i }));
    await userEvent.click(screen.getByRole("button", { name: /test the bridge/i }));
    expect(screen.queryByRole("button", { name: /continue/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/LinkCard.onComplete.test.tsx`
Expected: FAIL — `onComplete` prop not supported; no Continue button.

- [ ] **Step 3: Modify `components/LinkCard.tsx`** — add the optional prop and the Continue button.

Change the component signature:

```tsx
export function LinkCard({ scenario, onExit, onComplete }: { scenario: LinkScenario; onExit: () => void; onComplete?: () => void }) {
```

At the end of the component's returned JSX, immediately after the block that renders the "Test the bridge" button and the holds/not-yet message (i.e. as the last child inside the outer container `<div>`, before it closes), add:

```tsx
      {onComplete && grade?.held && (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={onComplete}>Continue →</button>
        </div>
      )}
```

(`grade` is the existing state holding the last `gradeBridge` result; `grade?.held` is already used for the holds message, so this reuses it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/LinkCard.onComplete.test.tsx && npx tsc --noEmit`
Expected: PASS (both cases); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add components/LinkCard.tsx tests/components/LinkCard.onComplete.test.tsx
git commit -m "feat: LinkCard optional onComplete for flow integration"
```

---

### Task 7: Flow shell, rail, deck, routing + legacy removal

**Files:**
- Create: `components/FlowRail.tsx`, `components/FlowShell.tsx`, `components/FlowDeck.tsx`
- Modify: `app/page.tsx`, `app/motions/page.tsx`, `app/link/page.tsx`
- Delete: `components/Deck.tsx`, `components/MotionCard.tsx`, `components/LinkDeck.tsx`, `components/steps/ArgumentsStep.tsx`, `tests/components/MotionCard.test.tsx`, `tests/components/ArgumentsStep.test.tsx`, `tests/app/home.test.tsx`
- Test: `tests/components/FlowShell.test.tsx`

**Interfaces:**
- Consumes: `useFlowProgress` (Task 3), `flowMachine` (Task 2), `getFlowMotions`/`getFlowMotion`/`flowMotionToMotion`/`claimToScenario` (Task 1), `RestateStep`, `KeywordStep`, `ClaimStage`/`ImpactStage` (Task 5), `LinkCard` (Task 6), `FlowMotion` type.
- Produces: the integrated flow at `/`; `/motions` and `/link` redirect to `/`.

- [ ] **Step 1: Write the failing test** — `tests/components/FlowShell.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowShell } from "@/components/FlowShell";
import type { FlowMotion } from "@/lib/schemas";

const motion: FlowMotion = {
  id: "m-kids-vote",
  motion: "This House would let kids vote.",
  keywords: [{ word: "kids", hint: null }],
  sides: {
    for: {
      claims: [
        { id: "c-stake", claim: "Kids deserve a say.", impact: "Better future.", candidates: [
          { id: "e1", text: "Studies tie voting to engagement.", material: "evidence", verdict: "fits", explanation: "x" },
          { id: "r1", text: "Politicians chase youth votes.", material: "reasoning", verdict: "fits", explanation: "x" },
          { id: "gbw", text: "A Nobel was won on voting theory.", material: "evidence", verdict: "great-but-wrong", explanation: "x" },
        ] },
      ],
    },
    against: { claims: [] },
  },
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({ kind: "restate", reaction: "Good.", capturedCore: true }), { status: 200 })
  ));
});

describe("FlowShell", () => {
  it("pins the motion, starts on Read/Restate, and locks AGAINST", () => {
    render(<FlowShell motion={motion} onExit={() => {}} />);
    expect(screen.getAllByText(/let kids vote/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/your own words/i)).toBeInTheDocument();
    // AGAINST shown locked.
    expect(screen.getByText(/against/i)).toBeInTheDocument();
    expect(screen.getByText(/🔒/)).toBeInTheDocument();
  });

  it("advances Restate → Keywords within the Read stage", async () => {
    render(<FlowShell motion={motion} onExit={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "kids should get a say");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await userEvent.click(await screen.findByRole("button", { name: /next: keywords/i }));
    // Keyword stage renders the clickable motion (the gold keyword "kids").
    expect(await screen.findByText("kids")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/FlowShell.test.tsx`
Expected: FAIL — `@/components/FlowShell` not found.

- [ ] **Step 3: Create `components/FlowRail.tsx`**

```tsx
"use client";
import { STAGES, stageIndex, type FlowStage } from "@/lib/state/flowMachine";

const LABELS: Record<FlowStage, string> = { read: "Read the motion", claim: "Claim", link: "Link", impact: "Impact" };

export function FlowRail({ stage }: { stage: FlowStage }) {
  const cur = stageIndex(stage);
  return (
    <div style={{ width: 200, borderRight: "1px solid #22324c", padding: "16px 14px", background: "#0c1a2e" }}>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 6 }}>Your progress</div>
      <div style={{ height: 5, background: "#22324c", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${(cur / (STAGES.length - 1)) * 100}%`, background: "var(--gold)" }} />
      </div>
      {STAGES.map((s, i) => (
        <div key={s} style={{ display: "flex", gap: 9, alignItems: "center", padding: "7px 0" }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, border: `2px solid ${i < cur ? "#3fae6b" : i === cur ? "var(--gold)" : "#2a3a52"}`, background: i < cur ? "#3fae6b" : "transparent", color: i < cur ? "#06210f" : i === cur ? "var(--gold)" : "var(--dim)" }}>
            {i < cur ? "✓" : i + 1}
          </span>
          <span style={{ color: i === cur ? "#fff" : i < cur ? "var(--text)" : "#5c6a7c", fontWeight: i === cur ? 700 : 400, fontSize: 14 }}>{LABELS[s]}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `components/FlowShell.tsx`**

```tsx
"use client";
import { useFlowProgress } from "@/lib/state/useFlowProgress";
import { nextStage, againstUnlocked } from "@/lib/state/flowMachine";
import { flowMotionToMotion, claimToScenario } from "@/lib/flowMotions";
import { RestateStep } from "@/components/steps/RestateStep";
import { KeywordStep } from "@/components/steps/KeywordStep";
import { ClaimStage } from "@/components/stages/ClaimStage";
import { ImpactStage } from "@/components/stages/ImpactStage";
import { LinkCard } from "@/components/LinkCard";
import { FlowRail } from "@/components/FlowRail";
import type { FlowMotion } from "@/lib/schemas";

export function FlowShell({ motion, onExit }: { motion: FlowMotion; onExit: () => void }) {
  const [progress, update] = useFlowProgress(motion.id);
  const sideClaims = motion.sides[progress.side].claims;
  const mappedClaim = sideClaims.find((c) => c.id === progress.mappedClaimId) ?? null;

  return (
    <div style={{ maxWidth: 840, margin: "0 auto" }}>
      <div style={{ background: "var(--navy)", border: "1px solid #22324c", borderRadius: 18, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #22324c", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <div>
            <button type="button" onClick={onExit} style={{ fontSize: 12, marginBottom: 6 }}>← motions</button>
            <div className="serif" style={{ fontSize: 19, color: "#fff" }}>{motion.motion}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999, background: "rgba(200,150,46,.16)", border: "1px solid var(--gold)", color: "var(--gold)", fontWeight: 700 }}>FOR</span>
            <span style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999, border: "1px solid #24344f", color: "#4a5a6f" }}>
              {againstUnlocked(progress.forComplete) ? "AGAINST" : "🔒 AGAINST"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", minHeight: 320 }}>
          <FlowRail stage={progress.stage} />
          <div style={{ flex: 1, padding: "20px 22px" }}>
            {progress.stage === "read" && progress.readSubstep === "restate" && (
              <RestateStep
                motion={motion.motion}
                initial={progress.restate}
                onNext={(restate) => update({ restate, readSubstep: "keyword" })}
              />
            )}
            {progress.stage === "read" && progress.readSubstep === "keyword" && (
              <KeywordStep motion={flowMotionToMotion(motion)} onNext={() => update({ stage: "claim" })} />
            )}
            {progress.stage === "claim" && (
              <ClaimStage
                motion={motion.motion}
                side={progress.side}
                claims={sideClaims.map((c) => ({ id: c.id, claim: c.claim }))}
                onComplete={(mappedClaimId) => update({ mappedClaimId, stage: "link" })}
              />
            )}
            {progress.stage === "link" && mappedClaim && (
              <LinkCard
                scenario={claimToScenario(mappedClaim)}
                onExit={onExit}
                onComplete={() => update({ stage: "impact" })}
              />
            )}
            {progress.stage === "impact" && mappedClaim && (
              <ImpactStage
                motion={motion.motion}
                claim={mappedClaim.claim}
                authoredImpact={mappedClaim.impact}
                onComplete={(impact) => update({ impact, forComplete: progress.side === "for" ? true : progress.forComplete, againstComplete: progress.side === "against" ? true : progress.againstComplete })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `components/FlowDeck.tsx`**

```tsx
"use client";
import { useState } from "react";
import { getFlowMotions } from "@/lib/flowMotions";
import { FlowShell } from "@/components/FlowShell";

export function FlowDeck() {
  const motions = getFlowMotions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = motions.find((m) => m.id === activeId);

  if (active) return <FlowShell motion={active} onExit={() => setActiveId(null)} />;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 className="serif">Constructive</h1>
      <p style={{ color: "var(--dim)" }}>Pick a motion and work it through: Read → Claim → Link → Impact.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
        {motions.map((m) => (
          <button key={m.id} type="button" onClick={() => setActiveId(m.id)} style={{ width: 220, textAlign: "left", background: "var(--navy-mid)", color: "var(--text)", border: "1px solid #24344f", borderRadius: 12, padding: 16 }}>
            <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>{m.id}</span>
            <div style={{ marginTop: 6 }}>{m.motion}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Repoint `/` and redirect the old routes**

Replace `app/page.tsx` with:

```tsx
import { FlowDeck } from "@/components/FlowDeck";

export default function Home() {
  return <FlowDeck />;
}
```

Replace `app/motions/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function MotionsPage() {
  redirect("/");
}
```

Replace `app/link/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function LinkPage() {
  redirect("/");
}
```

- [ ] **Step 7: Delete the now-unreachable standalone modules and their tests**

Run:

```bash
git rm components/Deck.tsx components/MotionCard.tsx components/LinkDeck.tsx components/steps/ArgumentsStep.tsx tests/components/MotionCard.test.tsx tests/components/ArgumentsStep.test.tsx tests/app/home.test.tsx
```

(`RestateStep`, `KeywordStep`, `LinkCard` are kept — the flow reuses them. The pure legacy loaders/banks `lib/motions.ts`, `lib/linkScenarios.ts` and their content/tests are intentionally left in place per the plan's documented deferral.)

- [ ] **Step 8: Run the FlowShell test, full suite, tsc, and build**

Run: `npm test -- tests/components/FlowShell.test.tsx && npm test && npx tsc --noEmit && npm run build`
Expected: FlowShell test PASSES; full suite PASSES (no references remain to the deleted files — the deleted tests are gone and nothing imports `Deck`/`MotionCard`/`LinkDeck`/`ArgumentsStep`); tsc clean; `next build` succeeds with routes `/`, `/motions` (redirect), `/link` (redirect), `/gate`, and the api routes.

- [ ] **Step 9: Commit**

```bash
git add components/FlowRail.tsx components/FlowShell.tsx components/FlowDeck.tsx app/page.tsx app/motions/page.tsx app/link/page.tsx tests/components/FlowShell.test.tsx
git commit -m "feat: integrated flow shell, rail, deck; retire standalone /motions and /link"
```

---

## Manual verification (after Task 7)

Not automated — do once with the app running (`npm run dev`, authed via the gate, real `ANTHROPIC_API_KEY`/`DEEPGRAM_API_KEY`):

1. `/` shows the motion picker; `/motions` and `/link` redirect to `/`.
2. Open a motion → Restate (voice or text) → coach reacts → Next → Keywords → click a gold keyword → answer → Next.
3. Claim stage: speak a claim → coach maps it to an authored claim → "Build the link →".
4. Link stage: sort the planks → Test → bridge holds → Continue →.
5. Impact stage: state the "so what" → coach reacts → "Finish this side ✓"; confirm AGAINST unlocks (shows without 🔒) after FOR completes.
6. Reload mid-journey → the rail and saved work restore from `localStorage`.
7. With the coach key unset, confirm the Claim stage falls back to manual pick and other stages show the inline "coach unavailable" message rather than blocking.

---

## Self-Review

**Spec coverage:**
- Integrated Read→Claim→Link→Impact, one side at a time, FOR-first/AGAINST-locked → Tasks 2, 7. ✓
- Reuse RestateStep/KeywordStep (Read), LinkCard+gradeBridge (Link) → Tasks 6, 7. ✓
- New Claim stage (generate → AI maps to authored, in-set validated) + Impact stage → Tasks 4, 5, 7. ✓
- Unified per-motion content (3 authored claims/side, each with link scenario + impact), Zod-validated at import, bank invariant → Task 1. ✓
- Adapters flowMotion→Motion, claim→LinkScenario → Task 1. ✓
- New claim/impact coach steps on existing endpoint; mappedClaimId in-set → Task 4. ✓
- Flow shell + left rail + progress bar → Task 7. ✓
- flowMachine + flowProgress localStorage `constructive:flow:v1` (corrupt + malformed-entry tolerant) → Tasks 2, 3. ✓
- Routing: `/` = picker; `/motions` & `/link` redirect; retire standalone decks → Task 7. ✓
- Non-blocking coach failures; Claim manual-pick fallback → Tasks 5, 7. ✓
- Deterministic Link grading unchanged → Task 6 (LinkCard unchanged except additive onComplete). ✓
- Testing: pure (machine, schema+invariant, store), coach steps mocked, component flow with stubbed fetch → all tasks. ✓
- Non-goals (no standalone practice, gating, library, LLM motions) → not implemented. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The starter bank ships 2 fully-authored motions and instructs 2 more of the identical, invariant-guarded shape. ✓

**Type consistency:** `FlowMotion`/`FlowClaim`, `FlowStage`/`ReadSubstep`/`Side`, `FlowProgress`/`FLOW_STORAGE_KEY`, the coach `claim`/`impact` steps and `ClaimResponseSchema`/`ImpactResponseSchema`, and the reused `Motion`/`LinkScenario` adapter outputs are defined once and consumed consistently. `ClaimStage`/`ImpactStage`/`LinkCard`(+onComplete) prop shapes match their `FlowShell` call sites. `RestateStep({motion,initial,onNext})` and `KeywordStep({motion:Motion,onNext})` match the shipped signatures. ✓
