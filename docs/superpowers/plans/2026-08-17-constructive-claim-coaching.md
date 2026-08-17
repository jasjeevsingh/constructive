# Claim Coaching Loop + Rubric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-shot claim step with a multi-turn coaching loop governed by an editable rubric, and hold the scaffold generator to that same rubric.

**Architecture:** Seven tasks. A rubric content file plus loader comes first because two prompts consume it; the `ChatClient` history change is independent; the coach contract depends on the transport; the prompt and UI depend on the contract. Every task is TDD: failing test, minimal implementation, green, commit.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, React 18, Tailwind + owned shadcn primitives, Vitest + React Testing Library, Zod, Anthropic + OpenAI SDKs.

**Spec:** `docs/superpowers/specs/2026-08-17-constructive-claim-coaching-design.md`

## Global Constraints

- Baseline to preserve: **217 tests / 57 files green**. Never finish a task with a red suite.
- `npx tsc --noEmit` must stay clean; `npm run build` must succeed.
- Run a single file with `npx vitest run <path>`; the suite with `npm test`.
- Import via the `@/` path alias, matching every existing file.
- Test style: flat `describe`/`it`, `render`/`screen` from `@testing-library/react`, `userEvent` for interaction. No snapshot tests.
- The four rubric criterion ids are exactly `one-idea`, `takes-a-side`, `concrete`, `contestable`.
- `CLAIM_TURN_CAP` is `3`, exported from `lib/claimRubric.ts`, and is the single source of truth for both the prompt and the UI.
- The coach must never rewrite the student's claim for them, and must ask exactly ONE question per turn.
- Do NOT change `lib/linkGrade.ts`, `lib/practice.ts`, `lib/voice/**`, `app/api/speak/route.ts`, `app/api/transcribe/**`, `components/FlowShell.tsx`, `components/FlowDeck.tsx`, or any file under `content/` other than the new `claim-rubric.json`.
- Commit messages use `feat:` / `fix:` prefixes, imperative mood.

---

## Task 1: The claim rubric — content, schema, loader

**Files:**
- Create: `content/claim-rubric.json`
- Create: `lib/claimRubric.ts`
- Modify: `lib/schemas.ts` (add `ClaimRubricSchema`)
- Test: `tests/lib/claimRubric.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces — Tasks 4 and 6 depend on these exact names:
  - `getClaimRubric(): ClaimRubric`
  - `renderRubric(): string`
  - `CLAIM_TURN_CAP: number` (value `3`)
  - `ClaimRubricSchema`, `type ClaimRubric` from `@/lib/schemas`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/claimRubric.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getClaimRubric, renderRubric, CLAIM_TURN_CAP } from "@/lib/claimRubric";
import { ClaimRubricSchema } from "@/lib/schemas";

describe("claim rubric", () => {
  it("has exactly the four agreed criteria, in order", () => {
    expect(getClaimRubric().criteria.map((c) => c.id)).toEqual([
      "one-idea",
      "takes-a-side",
      "concrete",
      "contestable",
    ]);
  });

  it("gives every criterion a contrasting bad/good example pair", () => {
    for (const c of getClaimRubric().criteria) {
      expect(c.bad.length).toBeGreaterThan(0);
      expect(c.good.length).toBeGreaterThan(0);
      expect(c.bad).not.toBe(c.good);
    }
  });

  it("renders every criterion name and both examples into the prompt block", () => {
    const text = renderRubric();
    for (const c of getClaimRubric().criteria) {
      expect(text).toContain(c.name);
      expect(text).toContain(c.bad);
      expect(text).toContain(c.good);
    }
  });

  it("caps the coaching loop at three turns", () => {
    expect(CLAIM_TURN_CAP).toBe(3);
  });

  it("rejects a rubric with no criteria", () => {
    expect(() => ClaimRubricSchema.parse({ version: 1, intro: "x", criteria: [] })).toThrow();
  });

  it("rejects a criterion with a blank field", () => {
    expect(() =>
      ClaimRubricSchema.parse({
        version: 1,
        intro: "x",
        criteria: [{ id: "one-idea", name: "One idea", test: "", bad: "b", good: "g" }],
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/claimRubric.test.ts`
Expected: FAIL — cannot resolve `@/lib/claimRubric`.

- [ ] **Step 3: Author the rubric content**

Create `content/claim-rubric.json`. This file is meant to be edited by a coach, not a programmer — keep it readable:

```json
{
  "version": 1,
  "intro": "A good claim is one clear, arguable point that a debater can actually defend.",
  "criteria": [
    {
      "id": "one-idea",
      "name": "One idea",
      "test": "Makes a single point, not a bundle of points.",
      "bad": "Phones cause cheating, distraction, and texting in class.",
      "good": "Phones let students cheat on tests."
    },
    {
      "id": "takes-a-side",
      "name": "Takes a side",
      "test": "Clearly argues for or against the motion, rather than describing the topic neutrally.",
      "bad": "Lots of students bring phones to school these days.",
      "good": "Schools should ban phones because they make cheating easy."
    },
    {
      "id": "concrete",
      "name": "Concrete",
      "test": "Names a real situation, person, or mechanism instead of staying abstract.",
      "bad": "Phones affect learning.",
      "good": "Students look up answers on their phones in the middle of a test."
    },
    {
      "id": "contestable",
      "name": "Contestable",
      "test": "A reasonable person could disagree. Not a truism, and not the motion restated in different words.",
      "bad": "Cheating is bad.",
      "good": "Banning phones cuts cheating enough to be worth the hassle of enforcing it."
    }
  ]
}
```

- [ ] **Step 4: Add the schema**

In `lib/schemas.ts`, append:

```ts
export const ClaimCriterionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  test: z.string().min(1),
  bad: z.string().min(1),
  good: z.string().min(1),
});
export const ClaimRubricSchema = z.object({
  version: z.number(),
  intro: z.string().min(1),
  criteria: z.array(ClaimCriterionSchema).min(1),
});
export type ClaimCriterion = z.infer<typeof ClaimCriterionSchema>;
export type ClaimRubric = z.infer<typeof ClaimRubricSchema>;
```

- [ ] **Step 5: Add the loader**

Create `lib/claimRubric.ts`, mirroring how `lib/flowMotions.ts:11` validates once at import so a malformed edit throws loudly:

```ts
import raw from "@/content/claim-rubric.json";
import { ClaimRubricSchema, type ClaimRubric } from "@/lib/schemas";

// Validated once at import; a malformed rubric throws loudly here.
const rubric: ClaimRubric = ClaimRubricSchema.parse(raw);

/** How many coaching turns a student gets before the loop lets them through. */
export const CLAIM_TURN_CAP = 3;

export function getClaimRubric(): ClaimRubric {
  return rubric;
}

/** The shared prompt block. Both the coach and the scaffold generator embed this, so they cannot drift. */
export function renderRubric(): string {
  const lines = rubric.criteria.map(
    (c) => `- ${c.name}: ${c.test}\n  Weak: "${c.bad}"\n  Strong: "${c.good}"`
  );
  return [rubric.intro, "", ...lines].join("\n");
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/lib/claimRubric.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add content/claim-rubric.json lib/claimRubric.ts lib/schemas.ts tests/lib/claimRubric.test.ts
git commit -m "feat: editable claim-quality rubric with schema and shared prompt block"
```

---

## Task 2: `ChatClient` carries conversation history

**Files:**
- Modify: `lib/ai/claude.ts`
- Test: `tests/lib/ai/claude.history.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces — Task 3 depends on these exactly:
  - `export type ChatTurn = { role: "user" | "assistant"; content: string }`
  - `complete(args: { system: string; user: string; history?: ChatTurn[] }): Promise<string>`

`history` is OPTIONAL and additive. Every existing caller passes `{system, user}` and must keep working with no edit.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/ai/claude.history.test.ts`. Both SDK clients are constructed inside the factories, so intercept at the SDK level with `vi.mock`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const anthropicCreate = vi.fn(async () => ({ content: [{ type: "text", text: "{}" }] }));
const openaiCreate = vi.fn(async () => ({ choices: [{ message: { content: "{}" } }] }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropicCreate };
  },
}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: openaiCreate } };
  },
}));

const { createAnthropicClient, createOpenAIClient } = await import("@/lib/ai/claude");

beforeEach(() => {
  anthropicCreate.mockClear();
  openaiCreate.mockClear();
});

describe("ChatClient history", () => {
  it("sends a single user message when no history is given (anthropic)", async () => {
    await createAnthropicClient("k").complete({ system: "s", user: "u" });
    expect(anthropicCreate.mock.calls[0][0].messages).toEqual([{ role: "user", content: "u" }]);
  });

  it("places prior turns before the final user message, in order (anthropic)", async () => {
    await createAnthropicClient("k").complete({
      system: "s",
      user: "u2",
      history: [
        { role: "user", content: "u1" },
        { role: "assistant", content: "a1" },
      ],
    });
    expect(anthropicCreate.mock.calls[0][0].messages).toEqual([
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
    ]);
  });

  it("places prior turns after system and before the final user message (openai)", async () => {
    await createOpenAIClient("k").complete({
      system: "s",
      user: "u2",
      history: [{ role: "user", content: "u1" }],
    });
    expect(openaiCreate.mock.calls[0][0].messages).toEqual([
      { role: "system", content: "s" },
      { role: "user", content: "u1" },
      { role: "user", content: "u2" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/ai/claude.history.test.ts`
Expected: FAIL — the history cases produce only `[{role:"user", content:"u2"}]`, because `complete` ignores the extra argument.

- [ ] **Step 3: Add history to the interface and both clients**

In `lib/ai/claude.ts`, replace the interface (lines 4-6):

```ts
export type ChatTurn = { role: "user" | "assistant"; content: string };

export interface ChatClient {
  complete(args: { system: string; user: string; history?: ChatTurn[] }): Promise<string>;
}
```

In `createAnthropicClient`, change the call:

```ts
    async complete({ system, user, history }) {
      const msg = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [...(history ?? []), { role: "user", content: user }],
      });
```

In `createOpenAIClient`:

```ts
    async complete({ system, user, history }) {
      const msg = await openai.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          ...(history ?? []),
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });
```

`createFallbackClient` forwards `args` opaquely already — leave it alone.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/ai/`
Expected: PASS, including the pre-existing coach tests that call `complete({system, user})` with no history.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/claude.ts tests/lib/ai/claude.history.test.ts
git commit -m "feat: ChatClient carries optional conversation history"
```

---

## Task 3: Coach contract — history plumbing and the two guards

**Files:**
- Modify: `lib/schemas.ts`
- Modify: `lib/ai/coach.ts`
- Test: `tests/lib/schemas.test.ts`, `tests/lib/ai/coach.flow.test.ts`

**Interfaces:**
- Consumes (Task 2): `ChatTurn`, `complete({system, user, history?})`.
- Produces — Tasks 4 and 5 depend on these exactly:
  - `CoachTurnSchema` = `{ role: "student" | "coach", text: string }`, `type CoachTurn`
  - `CoachRequestSchema` gains optional `history: CoachTurn[]`
  - `ClaimResponseSchema` = `{ kind:"claim", reaction: string, verdict: "keep-going"|"good-enough", question: string|null, mappedClaimId: string|null }`

**Depends on Task 2.**

- [ ] **Step 1: Write the failing tests**

Add to `tests/lib/schemas.test.ts`:

```ts
it("accepts a mid-loop claim response with a null mapped id", () => {
  const parsed = CoachResponseSchema.parse({
    kind: "claim",
    reaction: "Nice start.",
    verdict: "keep-going",
    question: "Which one of those is the real problem?",
    mappedClaimId: null,
  });
  expect(parsed.kind).toBe("claim");
});

it("rejects a claim response missing the verdict", () => {
  expect(() =>
    CoachResponseSchema.parse({ kind: "claim", reaction: "x", question: null, mappedClaimId: null })
  ).toThrow();
});

it("accepts a request carrying prior turns", () => {
  const parsed = CoachRequestSchema.parse({
    step: "claim",
    motion: "m",
    payload: {},
    history: [{ role: "student", text: "hi" }],
  });
  expect(parsed.history?.[0].role).toBe("student");
});
```

Add to `tests/lib/ai/coach.flow.test.ts` (follow the file's existing stub-client style):

```ts
it("does not throw mid-loop when the claim is not yet mapped", async () => {
  const client = stubClient(
    JSON.stringify({
      kind: "claim",
      reaction: "Good start.",
      verdict: "keep-going",
      question: "Can you make that concrete?",
      mappedClaimId: null,
    })
  );
  const res = await runCoach(
    { step: "claim", motion: "m", payload: { authoredClaims: [{ id: "c1", claim: "x" }] } },
    client
  );
  expect(res.kind).toBe("claim");
});

it("throws when it says good-enough without mapping a claim", async () => {
  const client = stubClient(
    JSON.stringify({
      kind: "claim",
      reaction: "Great.",
      verdict: "good-enough",
      question: null,
      mappedClaimId: null,
    })
  );
  await expect(
    runCoach(
      { step: "claim", motion: "m", payload: { authoredClaims: [{ id: "c1", claim: "x" }] } },
      client
    )
  ).rejects.toThrow();
});

it("forwards prior turns to the client as user/assistant turns", async () => {
  let seen: unknown;
  const client = {
    async complete(args: { system: string; user: string; history?: unknown }) {
      seen = args.history;
      return JSON.stringify({
        kind: "claim",
        reaction: "ok",
        verdict: "good-enough",
        question: null,
        mappedClaimId: "c1",
      });
    },
  };
  await runCoach(
    {
      step: "claim",
      motion: "m",
      payload: { authoredClaims: [{ id: "c1", claim: "x" }] },
      history: [
        { role: "student", text: "s1" },
        { role: "coach", text: "c1" },
      ],
    },
    client
  );
  expect(seen).toEqual([
    { role: "user", content: "s1" },
    { role: "assistant", content: "c1" },
  ]);
});
```

The existing test asserting a mapped id outside the authored set still throws must remain and stay green.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/schemas.test.ts tests/lib/ai/coach.flow.test.ts`
Expected: FAIL — `verdict`/`question` are not in the schema, `mappedClaimId` is a required string, and history is neither accepted nor forwarded.

- [ ] **Step 3: Update the schemas**

In `lib/schemas.ts`, add the turn schema and extend the request (near `CoachRequestSchema`, lines 22-27):

```ts
export const CoachTurnSchema = z.object({
  role: z.enum(["student", "coach"]),
  text: z.string(),
});
export type CoachTurn = z.infer<typeof CoachTurnSchema>;

export const CoachRequestSchema = z.object({
  step: CoachStepSchema,
  motion: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  history: z.array(CoachTurnSchema).optional(),
});
```

Replace `ClaimResponseSchema` (lines 52-56):

```ts
export const ClaimResponseSchema = z.object({
  kind: z.literal("claim"),
  reaction: z.string(),
  verdict: z.enum(["keep-going", "good-enough"]),
  question: z.string().nullable(),
  mappedClaimId: z.string().nullable(),
});
```

- [ ] **Step 4: Plumb history and split the guard**

In `lib/ai/coach.ts`, change `runCoach` (lines 52-69):

```ts
export async function runCoach(req: CoachRequest, client: ChatClient): Promise<CoachResponse> {
  const { system, user } = buildPrompt(req);
  const history = (req.history ?? []).map((t) => ({
    role: t.role === "student" ? ("user" as const) : ("assistant" as const),
    content: t.text,
  }));
  const raw = await client.complete({ system, user, history });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Coach returned non-JSON output");
  }
  const result = CoachResponseSchema.parse(parsed);
  if (result.kind === "claim") {
    const ids = ((req.payload.authoredClaims as { id: string }[] | undefined) ?? []).map((c) => c.id);
    // A hallucinated id must never reach the Link stage.
    if (result.mappedClaimId !== null && !ids.includes(result.mappedClaimId)) {
      throw new Error("coach mapped claim to an id outside the authored set");
    }
    // "Good enough" is the signal to advance, so it must carry a claim to advance to.
    if (result.verdict === "good-enough" && result.mappedClaimId === null) {
      throw new Error("coach said good-enough without mapping a claim");
    }
  }
  return result;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/schemas.test.ts tests/lib/ai/ tests/app/api/coach.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/schemas.ts lib/ai/coach.ts tests/lib/schemas.test.ts tests/lib/ai/coach.flow.test.ts
git commit -m "feat: coach contract carries history and a claim verdict"
```

---

## Task 4: Rewrite the claim prompt as a coaching prompt

**Files:**
- Modify: `lib/prompts/claim.ts`
- Modify: `lib/ai/coach.ts` (pass history + attempt into `claimPrompt`)
- Test: `tests/lib/prompts.flow.test.ts`

**Interfaces:**
- Consumes (Task 1): `renderRubric()`, `CLAIM_TURN_CAP`. Consumes (Task 3): `CoachTurn`.
- Produces: `claimPrompt(input: { motion, side, studentClaim, authoredClaims, history, attempt })`.

**Depends on Tasks 1 and 3.**

- [ ] **Step 1: Write the failing test**

Replace the existing claim-prompt test in `tests/lib/prompts.flow.test.ts` and add:

```ts
it("gives the coach the rubric, the turn number, and a no-rewriting rule", () => {
  const p = claimPrompt({
    motion: "This House would ban homework.",
    side: "for",
    studentClaim: "homework is bad",
    authoredClaims: [{ id: "c1", claim: "Homework crowds out family time." }],
    history: [],
    attempt: 1,
  });
  for (const name of ["One idea", "Takes a side", "Concrete", "Contestable"]) {
    expect(p.system).toContain(name);
  }
  expect(p.system.toLowerCase()).toContain("do not rewrite");
  expect(p.system).toContain("one question");
  expect(p.user).toContain("homework is bad");
  expect(p.user).toContain("c1");
  expect(p.user).toContain("1 of 3");
});

it("tells the coach to map on the final turn", () => {
  const p = claimPrompt({
    motion: "m",
    side: "for",
    studentClaim: "x",
    authoredClaims: [{ id: "c1", claim: "y" }],
    history: [
      { role: "student", text: "a" },
      { role: "coach", text: "b" },
      { role: "student", text: "c" },
      { role: "coach", text: "d" },
    ],
    attempt: 3,
  });
  expect(p.user).toContain("3 of 3");
  expect(p.system).toContain("final turn");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/prompts.flow.test.ts`
Expected: FAIL — `claimPrompt` takes no `history`/`attempt`, and its system text contains none of the rubric names.

- [ ] **Step 3: Rewrite the prompt**

Replace `lib/prompts/claim.ts` entirely:

```ts
import { renderRubric, CLAIM_TURN_CAP } from "@/lib/claimRubric";
import type { CoachTurn } from "@/lib/schemas";

export function claimPrompt(input: {
  motion: string;
  side: string;
  studentClaim: string;
  authoredClaims: { id: string; claim: string }[];
  history?: CoachTurn[];
  attempt?: number;
}): { system: string; user: string } {
  const attempt = input.attempt ?? 1;
  const isFinal = attempt >= CLAIM_TURN_CAP;

  const system = [
    "You are a warm debate coach for a student aged 10-18. You are coaching them toward a sharper claim.",
    "",
    "This is what a good claim looks like:",
    renderRubric(),
    "",
    "How to coach:",
    "- React warmly in ONE sentence, naming what is working.",
    "- Then name the SINGLE most important thing to sharpen and ask exactly one question about it.",
    "- DO NOT rewrite the claim for them. The student must arrive at it themselves.",
    "- Ask about one criterion at a time. Never list all four at the student.",
    "",
    "Deciding when to stop:",
    '- Set "verdict" to "good-enough" ONLY when the claim meets all four criteria above; otherwise "keep-going".',
    '- When the verdict is "keep-going", put your single question in "question".',
    '- When the verdict is "good-enough", set "question" to null.',
    `- Set "mappedClaimId" to the authored claim closest to the student's claim when the verdict is "good-enough"${
      isFinal ? ", and ALSO on this final turn even if the claim is still rough" : ""
    }. Otherwise set it to null.`,
    isFinal
      ? "- This is the final turn. Close warmly, do not ask another question, and you MUST set mappedClaimId so the student can move on."
      : "",
    "- Never invent a claim id. Use only the ids provided.",
    "",
    'Respond ONLY as JSON: {"kind":"claim","reaction":string,"verdict":"keep-going"|"good-enough","question":string|null,"mappedClaimId":string|null}.',
  ]
    .filter(Boolean)
    .join("\n");

  const list = input.authoredClaims.map((c) => `${c.id}: ${c.claim}`).join("\n");
  const user = [
    `Motion: "${input.motion}"`,
    `Side: ${input.side}`,
    `Coaching turn ${attempt} of ${CLAIM_TURN_CAP}`,
    `Student's latest claim: "${input.studentClaim}"`,
    "Authored claims to map onto:",
    list,
  ].join("\n");

  return { system, user };
}
```

Prior turns reach the model through `ChatClient.history` (Task 3), so they are deliberately not re-serialized into `user`.

- [ ] **Step 4: Pass history and attempt through**

In `lib/ai/coach.ts`, change the `"claim"` case of `buildPrompt` (lines 35-41):

```ts
    case "claim":
      return claimPrompt({
        motion: req.motion,
        side: String(p.side ?? ""),
        studentClaim: String(p.studentClaim ?? ""),
        authoredClaims: (p.authoredClaims as { id: string; claim: string }[]) ?? [],
        history: req.history ?? [],
        attempt: (req.history ?? []).filter((t) => t.role === "student").length + 1,
      });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/prompts.flow.test.ts tests/lib/ai/ tests/lib/claimRubric.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/prompts/claim.ts lib/ai/coach.ts tests/lib/prompts.flow.test.ts
git commit -m "feat: claim prompt coaches with the rubric instead of classifying"
```

---

## Task 5: `ClaimStage` becomes a multi-turn conversation

**Files:**
- Modify: `components/stages/ClaimStage.tsx`
- Test: `tests/components/ClaimStage.test.tsx`

**Interfaces:**
- Consumes (Task 1): `CLAIM_TURN_CAP`. Consumes (Task 3): the new `ClaimResponse` shape and `CoachTurn`.
- Produces: `ClaimStage`'s props are UNCHANGED — `{ motion, side, claims, onComplete }`. `FlowShell` and `PracticeShell` must keep working untouched.

**Depends on Tasks 1 and 3.**

- [ ] **Step 1: Write the failing tests**

Rewrite `tests/components/ClaimStage.test.tsx`. The existing first test encodes the one-shot flow and must be replaced; keep the coach-failure fallback test as-is.

```tsx
function coachReply(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ kind: "claim", ...body }), { status: 200 });
}

const claims = [{ id: "c-stake", claim: "Kids deserve a say." }];

it("asks a guiding question and does not let the student advance yet", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      coachReply({
        reaction: "Good start.",
        verdict: "keep-going",
        question: "Can you ground that in a situation?",
        mappedClaimId: null,
      })
    )
  );
  render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
  await userEvent.type(screen.getByRole("textbox"), "kids matter");
  await userEvent.click(screen.getByRole("button", { name: /submit/i }));

  expect(await screen.findByText(/ground that in a situation/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /build the link/i })).toBeNull();
});

it("advances once the coach says the claim is good enough", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      coachReply({
        reaction: "That's sharp.",
        verdict: "good-enough",
        question: null,
        mappedClaimId: "c-stake",
      })
    )
  );
  const onComplete = vi.fn();
  render(<ClaimStage motion="m" side="for" claims={claims} onComplete={onComplete} />);
  await userEvent.type(screen.getByRole("textbox"), "16-year-olds pay tax but cannot vote");
  await userEvent.click(screen.getByRole("button", { name: /submit/i }));

  await userEvent.click(await screen.findByRole("button", { name: /build the link/i }));
  expect(onComplete).toHaveBeenCalledWith("c-stake");
});

it("lets the student through at the turn cap even while still keep-going", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      coachReply({
        reaction: "Getting closer.",
        verdict: "keep-going",
        question: "What changes if that is true?",
        mappedClaimId: "c-stake",
      })
    )
  );
  render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
  for (let i = 0; i < 3; i++) {
    await userEvent.type(screen.getByRole("textbox"), `try ${i}`);
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    await screen.findByText(/getting closer/i);
  }
  expect(await screen.findByRole("button", { name: /build the link/i })).toBeInTheDocument();
});

it("sends the running transcript back to the coach", async () => {
  const fetchMock = vi.fn(async () =>
    coachReply({ reaction: "Hm.", verdict: "keep-going", question: "Why?", mappedClaimId: null })
  );
  vi.stubGlobal("fetch", fetchMock);
  render(<ClaimStage motion="m" side="for" claims={claims} onComplete={() => {}} />);
  await userEvent.type(screen.getByRole("textbox"), "first");
  await userEvent.click(screen.getByRole("button", { name: /submit/i }));
  await screen.findByText(/why\?/i);
  await userEvent.type(screen.getByRole("textbox"), "second");
  await userEvent.click(screen.getByRole("button", { name: /submit/i }));

  const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1].body));
  expect(secondBody.history).toEqual([
    { role: "student", text: "first" },
    { role: "coach", text: "Hm. Why?" },
  ]);
});
```

Note: `VoiceOrTextInput` keeps its own `text` state and does not clear on submit, so the second `userEvent.type` appends. If that makes an assertion awkward, assert on `history` length and roles rather than exact strings — do not change `VoiceOrTextInput`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/ClaimStage.test.tsx`
Expected: FAIL — the component advances after one turn, renders no question, and sends no history.

- [ ] **Step 3: Rewrite the component**

Replace the body of `components/stages/ClaimStage.tsx`, keeping the same props and the existing fallback block:

```tsx
"use client";
import { useState } from "react";
import { VoiceOrTextInput } from "@/components/VoiceOrTextInput";
import { Button } from "@/components/ui/button";
import { StageHeader } from "@/components/stages/StageHeader";
import { CoachBubble } from "@/components/CoachBubble";
import { CLAIM_TURN_CAP } from "@/lib/claimRubric";
import type { CoachResponse, CoachTurn } from "@/lib/schemas";

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
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [mappedId, setMappedId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fallback, setFallback] = useState(false);

  const attempt = turns.filter((t) => t.role === "student").length;

  async function submit(text: string) {
    if (!text.trim() || done) return;
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: "claim",
          motion,
          payload: { side, studentClaim: text, authoredClaims: claims },
          history: turns,
        }),
      });
      if (!res.ok) throw new Error("coach failed");
      const data: CoachResponse = await res.json();
      if (data.kind !== "claim") return;

      const coachText = [data.reaction, data.question].filter(Boolean).join(" ");
      const nextTurns: CoachTurn[] = [
        ...turns,
        { role: "student", text },
        { role: "coach", text: coachText },
      ];
      setTurns(nextTurns);
      setMappedId(data.mappedClaimId);

      const studentTurns = nextTurns.filter((t) => t.role === "student").length;
      setDone(data.verdict === "good-enough" || studentTurns >= CLAIM_TURN_CAP);
    } catch {
      setFallback(true);
    }
  }

  const mapped = claims.find((c) => c.id === mappedId);

  return (
    <div>
      <StageHeader
        eyebrow="Stage 2 · Claim"
        prompt={`What's your strongest claim ${side === "for" ? "for" : "against"} this motion?`}
      />

      {turns.length > 0 && (
        <div className="mb-4 space-y-3">
          {turns.map((t, i) =>
            t.role === "student" ? (
              <p key={i} className="text-sm text-muted-foreground">
                You said: {t.text}
              </p>
            ) : (
              <CoachBubble key={i}>{t.text}</CoachBubble>
            )
          )}
        </div>
      )}

      {!done && (
        <VoiceOrTextInput
          label={attempt === 0 ? "Say or type your claim" : "Answer the coach, or sharpen your claim"}
          onSubmit={submit}
        />
      )}

      {done && mapped && (
        <div className="mt-3">
          <div className="mt-3 rounded-lg border border-evidence bg-evidence/10 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              We&apos;ll carry this forward as
            </div>
            <p className="mt-0.5 font-medium text-foreground">{mapped.claim}</p>
          </div>
          <Button type="button" className="mt-3" onClick={() => onComplete(mapped.id)}>
            Build the link →
          </Button>
        </div>
      )}

      {((done && !mapped) || fallback) && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Pick the claim closest to yours:</p>
          <div className="mt-2 flex flex-col gap-2">
            {claims.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                onClick={() => onComplete(c.id)}
              >
                {c.claim}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/ClaimStage.test.tsx tests/components/FlowShell.test.tsx tests/components/PracticeShell.test.tsx`
Expected: PASS. `FlowShell` and `PracticeShell` exercise `ClaimStage` and must not need edits — if either fails, the props changed and that is a bug in this task.

- [ ] **Step 5: Commit**

```bash
git add components/stages/ClaimStage.tsx tests/components/ClaimStage.test.tsx
git commit -m "feat: ClaimStage coaches across turns instead of one shot"
```

---

## Task 6: Hold the scaffold generator to the rubric

**Files:**
- Modify: `lib/prompts/generateScaffold.ts`
- Test: `tests/lib/prompts.test.ts`

**Interfaces:**
- Consumes (Task 1): `renderRubric()`.
- Produces: nothing other tasks depend on.

**Depends on Task 1.** This is what fixes the reported vague claim covering cheating, distraction, and texting at once — `generateScaffold.ts:12` currently says only "Give 1-2 claims per side" with no specificity constraint.

- [ ] **Step 1: Write the failing test**

Add to `tests/lib/prompts.test.ts` (extend the import list with `generateScaffoldPrompt`):

```ts
it("holds generated claims to the claim rubric", () => {
  const p = generateScaffoldPrompt("Naruto", "This House would ban the Chunin Exams.");
  for (const name of ["One idea", "Takes a side", "Concrete", "Contestable"]) {
    expect(p.system).toContain(name);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/prompts.test.ts`
Expected: FAIL — none of the criterion names appear in the scaffold prompt.

- [ ] **Step 3: Embed the rubric**

In `lib/prompts/generateScaffold.ts`, add `import { renderRubric } from "@/lib/claimRubric";` and replace the claims rule (line 12) with:

```
- Give 1-2 claims per side. Each claim needs an "impact": why it matters, the bigger consequence.
- EVERY claim you write must itself meet this standard:
${renderRubric()}
  In particular: one claim = ONE idea. Never bundle several complaints into a single claim.
```

Leave the candidate rules, the safety line, the untrusted-input line, and the refusal branch unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/prompts.test.ts tests/lib/generate.test.ts tests/app/generate-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/prompts/generateScaffold.ts tests/lib/prompts.test.ts
git commit -m "fix: hold generated claims to the claim rubric"
```

---

## Task 7: Full verification

**Files:** none modified unless a gate fails.

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all pass, count ≥ 217 plus the new tests. A red test is a real regression — fix it, do not delete the assertion.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Confirm the old one-shot contract is gone**

```bash
grep -rn "React encouragingly" lib
grep -rn "verdict" lib/prompts/claim.ts
grep -rn "renderRubric" lib
```

Expected: the first prints nothing; the second confirms the verdict contract is in the prompt; the third shows `renderRubric` defined in `lib/claimRubric.ts` and consumed by BOTH `lib/prompts/claim.ts` and `lib/prompts/generateScaffold.ts`.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: verification pass for the claim coaching branch"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Rubric file, schema, loader, `renderRubric`, `CLAIM_TURN_CAP` | 1 |
| Transport — `ChatClient` history | 2 |
| Coach contract — `CoachTurn`, request history, claim response shape, two guards | 3 |
| Claim prompt rewrite | 4 |
| `ClaimStage` multi-turn UI, advance rule, cap-with-null fallback | 5 |
| Scaffold generator held to the rubric | 6 |
| Binding constraint (loop still ends in a mapping) | 3 (guards) + 4 (prompt) + 5 (advance rule) |
| Testing gates | 7 |

No spec requirement is unassigned.

**Type consistency:** `ChatTurn` and `complete({system, user, history?})` are defined in Task 2 and consumed in Task 3. `CoachTurn`, the request `history` field, and the `verdict`/`question`/nullable-`mappedClaimId` response shape are defined in Task 3 and consumed in Tasks 4 and 5. `renderRubric()` and `CLAIM_TURN_CAP` are defined in Task 1 and consumed in Tasks 4, 5, and 6. `ClaimStage`'s props are unchanged throughout, so `FlowShell` and `PracticeShell` need no edits.

**Execution order.** Tasks 1 and 2 are independent and may be batched. Task 3 depends on 2. Tasks 4 and 6 depend on 1 and 3 (Task 6 only on 1). Task 5 depends on 1 and 3. Task 7 runs last. Only Task 3 and Task 4 both touch `lib/ai/coach.ts`, so they must not run concurrently.
