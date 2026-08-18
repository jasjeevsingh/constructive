# Helper Chat + Interaction Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the side helper a text chat with voice as an escalation inside it, and give the app real interaction feel — starting with button hover, which today does not exist.

**Architecture:** Part 1 threads one transcript through two input modes: the prompt gains a mode, a new text route answers in prose, and the voice session is seeded with whatever was already typed. Part 2 lands hover on the shared `Button` primitive in CSS so every button improves at once, then adds targeted motion at the moments that earn it.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, React 18, Tailwind + owned shadcn primitives, `motion` (framer) v13, Vitest + React Testing Library, Zod.

**Spec:** `docs/superpowers/specs/2026-08-17-constructive-helper-chat-and-polish-design.md`

## Global Constraints

- Baseline to preserve: **334 tests / 70 files green**. Never finish a task with a red suite.
- `npx tsc --noEmit` must stay clean; `npm run build` must succeed.
- Run a single file with `npx vitest run <path>`; the suite with `npm test`.
- Import via the `@/` path alias. Test style: flat `describe`/`it`, `render`/`screen`, `userEvent`. No snapshot tests.
- `app/layout.tsx` already wraps the tree in `<MotionConfig reducedMotion="user">`, so framer animations honour the OS setting **globally — do not re-implement that**. CSS-only animation needs explicit `motion-reduce:` guards.
- `HelperPanelView` and `FeedbackPanelView` must stay PURE — no `fetch`, `localStorage`, `window`, `AudioContext`, or timers. All wiring lives in their non-`View` siblings.
- **`SUPABASE_SERVICE_ROLE_KEY` and `DEEPGRAM_API_KEY` must never reach the browser.** Do not import `@supabase/supabase-js` or `@deepgram/sdk` into any `"use client"` file.
- Do NOT change `components/VoiceOrTextInput.tsx`, `lib/voice/**`, `app/api/speak/**`, `app/api/transcribe/**`, `app/api/coach/**`, `app/api/feedback/**`, `app/api/deepgram/**`, `lib/ai/**` (consume only), `lib/claimRubric.ts`, `content/**`, `lib/state/**`, `middleware.ts`, `lib/feedback/**`.
- Commit messages use `feat:` / `fix:` prefixes, imperative mood.

### Naming, to avoid a real collision

Two different turn types already exist and must not be conflated:

- `HelperTurn` (`lib/helper/context.ts`) = `{ role: "student" | "coach" }` — the **on-page stage coach** exchange, part of page context.
- The helper's **own** conversation turns are `{ role: "student" | "helper" }`, currently inline in `HelperState.turns`.

Task 1 exports the second as **`HelperReplyTurn`** from `lib/helper/agentMachine.ts`. Every later task uses that name.

---

## Task 1: Prompt gains a mode and prior turns

**Files:**
- Modify: `lib/helper/agentMachine.ts` (export `HelperReplyTurn`)
- Modify: `lib/helper/helperPrompt.ts`
- Test: `tests/lib/helper/helperPrompt.test.ts`

**Interfaces — Tasks 2, 3, 4 depend on these exactly:**
- `export type HelperReplyTurn = { role: "student" | "helper"; text: string }` from `@/lib/helper/agentMachine`; `HelperState.turns` becomes `HelperReplyTurn[]`.
- `helperPrompt(ctx: HelperContext, mode?: "voice" | "text", priorTurns?: HelperReplyTurn[]): string`, defaulting to `"voice"` and `[]` so every existing caller keeps working unchanged.

- [ ] **Step 1: Write the failing test**

Add to `tests/lib/helper/helperPrompt.test.ts` (keep every existing test — they assert the rubric, the never-write-it rule, the on-task carve-out, and the distress guidance, and all of those must survive in BOTH modes):

```ts
const ctx = { ...emptyHelperContext(), motion: "This House would ban homework.", side: "for" as const, stage: "claim" };

it("keeps the speech instruction in voice mode", () => {
  expect(helperPrompt(ctx, "voice").toLowerCase()).toContain("speech");
});

it("drops the speech instruction in text mode and forbids markdown", () => {
  const p = helperPrompt(ctx, "text").toLowerCase();
  expect(p).not.toContain("this is speech");
  expect(p).toContain("plain sentences");
});

it("still carries every hard rule in text mode", () => {
  const p = helperPrompt(ctx, "text");
  for (const name of ["One idea", "Takes a side", "Concrete", "Contestable"]) expect(p).toContain(name);
  expect(p.toLowerCase()).toContain("never write");
  expect(p.toLowerCase()).toContain("politely decline");
  expect(p.toLowerCase()).toContain("trusted adult");
});

it("renders prior turns so a voice call continues the text thread", () => {
  const p = helperPrompt(ctx, "voice", [
    { role: "student", text: "i think phones are bad" },
    { role: "helper", text: "what happens because of that?" },
  ]);
  expect(p).toContain("i think phones are bad");
  expect(p).toContain("what happens because of that?");
});

it("omits the transcript section when there are no prior turns", () => {
  expect(helperPrompt(ctx, "text")).not.toMatch(/so far in this conversation/i);
});

it("defaults to voice mode with no prior turns", () => {
  expect(helperPrompt(ctx)).toBe(helperPrompt(ctx, "voice", []));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/helper/helperPrompt.test.ts`
Expected: FAIL — `helperPrompt` takes one argument and always emits the speech line.

- [ ] **Step 3: Export the turn type**

In `lib/helper/agentMachine.ts`, add the exported type and use it in `HelperState`:

```ts
export type HelperReplyTurn = { role: "student" | "helper"; text: string };

export type HelperState = {
  phase: HelperPhase;
  turns: HelperReplyTurn[];
  error: string | null;
};
```

- [ ] **Step 4: Parameterize the prompt**

In `lib/helper/helperPrompt.ts`, swap only the "How to talk" opening line by mode, and append the transcript when supplied. Everything else — the rubric block, the hard rules, the distress guidance, the page context — is shared and must not be duplicated per mode.

```ts
import type { HelperReplyTurn } from "@/lib/helper/agentMachine";

const HOW_TO_TALK: Record<"voice" | "text", string[]> = {
  voice: [
    "- This is speech, not writing. Keep every turn short — a sentence or two.",
    "- Ask one question at a time, then stop and let them answer.",
  ],
  text: [
    "- Keep replies short: two or three sentences.",
    "- Write plain sentences. No headings, bullet lists, or markdown.",
    "- Ask one question at a time, then stop and let them answer.",
  ],
};

function renderPriorTurns(turns: HelperReplyTurn[]): string[] {
  if (turns.length === 0) return [];
  return [
    "",
    "So far in this conversation:",
    ...turns.map((t) => `${t.role === "student" ? "Student" : "You"}: ${t.text}`),
  ];
}
```

Then build the prompt with `...HOW_TO_TALK[mode]` where the two hard-coded talk lines are today, and `...renderPriorTurns(priorTurns)` immediately before the page-context block. Keep `"- Never read a list of criteria aloud at them."` in voice mode; in text mode make it `"- Never paste the list of criteria at them."`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/helper/`
Expected: PASS. Existing `agentMachine`, `agentSession`, and `helperPrompt` tests all still green.

- [ ] **Step 6: Commit**

```bash
git add lib/helper/agentMachine.ts lib/helper/helperPrompt.ts tests/lib/helper/helperPrompt.test.ts
git commit -m "feat: helper prompt supports text mode and prior turns"
```

---

## Task 2: Text route

**Files:**
- Create: `app/api/helper/route.ts`
- Create: `lib/helper/limits.ts`
- Test: `tests/app/api/helper.test.ts`

**Interfaces — Task 4 depends on this:** `POST /api/helper` with `{ messages: HelperReplyTurn[], context: HelperContext }` → `200 { reply: string }`, `400`, or `503`.

**Depends on Task 1.**

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const complete = vi.fn();
vi.mock("@/lib/ai/claude", () => ({ getChatClient: () => ({ complete }) }));

const { POST } = await import("@/app/api/helper/route");

function req(body: unknown) {
  return new Request("http://localhost/api/helper", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { activity: "journey", motion: "This House would ban homework.", side: "for", stage: "claim", claimDraft: null, transcript: [] };

beforeEach(() => {
  complete.mockReset();
  complete.mockResolvedValue("What happens because of that?");
  process.env.ANTHROPIC_API_KEY = "k";
});
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

describe("POST /api/helper", () => {
  it("replies to the newest message", async () => {
    const res = await POST(req({ messages: [{ role: "student", text: "phones are bad" }], context: ctx }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ reply: "What happens because of that?" });
  });

  it("sends the page context in the system prompt", async () => {
    await POST(req({ messages: [{ role: "student", text: "hi" }], context: ctx }));
    expect(complete.mock.calls[0][0].system).toContain("This House would ban homework.");
  });

  it("passes earlier turns as history, newest as user", async () => {
    await POST(req({ messages: [
      { role: "student", text: "first" },
      { role: "helper", text: "why?" },
      { role: "student", text: "second" },
    ], context: ctx }));
    const args = complete.mock.calls[0][0];
    expect(args.user).toBe("second");
    expect(args.history).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "why?" },
    ]);
  });

  it("400s when the newest message is not from the student", async () => {
    const res = await POST(req({ messages: [{ role: "helper", text: "hi" }], context: ctx }));
    expect(res.status).toBe(400);
  });

  it("400s on an empty message, too many turns, and an over-long turn", async () => {
    expect((await POST(req({ messages: [{ role: "student", text: "  " }], context: ctx }))).status).toBe(400);
    const many = Array.from({ length: 41 }, () => ({ role: "student" as const, text: "x" }));
    expect((await POST(req({ messages: many, context: ctx }))).status).toBe(400);
    expect((await POST(req({ messages: [{ role: "student", text: "x".repeat(2001) }], context: ctx }))).status).toBe(400);
  });

  it("503s when no AI key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    complete.mockRejectedValue(new Error("no key"));
    const res = await POST(req({ messages: [{ role: "student", text: "hi" }], context: ctx }));
    expect(res.status).toBe(503);
  });

  it("never leaks an internal error message", async () => {
    complete.mockRejectedValue(new Error("ANTHROPIC_API_KEY=sk-secret"));
    const res = await POST(req({ messages: [{ role: "student", text: "hi" }], context: ctx }));
    expect(await res.text()).not.toContain("sk-secret");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app/api/helper.test.ts`
Expected: FAIL — cannot resolve `@/app/api/helper/route`.

- [ ] **Step 3: Add the limits**

Create `lib/helper/limits.ts`:

```ts
/** Bounds on a helper chat request — keeps prompt cost and payload memory in check. */
export const MAX_HELPER_TURNS = 40;
export const MAX_HELPER_TURN_LENGTH = 2000;
```

- [ ] **Step 4: Implement the route**

```ts
import { z } from "zod";
import { getChatClient } from "@/lib/ai/claude";
import { helperPrompt } from "@/lib/helper/helperPrompt";
import { MAX_HELPER_TURNS, MAX_HELPER_TURN_LENGTH } from "@/lib/helper/limits";
import type { HelperContext } from "@/lib/helper/context";

const TurnSchema = z.object({
  role: z.enum(["student", "helper"]),
  text: z.string().trim().min(1).max(MAX_HELPER_TURN_LENGTH),
});

const BodySchema = z.object({
  messages: z.array(TurnSchema).min(1).max(MAX_HELPER_TURNS),
  context: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });

  const messages = parsed.data.messages;
  const latest = messages[messages.length - 1];
  // The newest turn must be the student's — otherwise there is nothing to answer.
  if (latest.role !== "student") return Response.json({ error: "invalid request" }, { status: 400 });

  const prior = messages.slice(0, -1);
  const system = helperPrompt(parsed.data.context as unknown as HelperContext, "text");
  const history = prior.map((t) => ({
    role: t.role === "student" ? ("user" as const) : ("assistant" as const),
    content: t.text,
  }));

  try {
    const reply = await getChatClient().complete({ system, user: latest.text, history });
    return Response.json({ reply: reply.trim() });
  } catch {
    // Static string: an upstream error can carry key material.
    return Response.json({ error: "helper unavailable" }, { status: 503 });
  }
}
```

Note the prompt is built with `"text"` mode and **no** `priorTurns` — the turns travel as real `history` messages here, which is strictly better than embedding them in the system prompt. `priorTurns` exists for the voice path, which has no other way to carry them.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/app/api/helper.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add app/api/helper/route.ts lib/helper/limits.ts tests/app/api/helper.test.ts
git commit -m "feat: text chat route for the side helper"
```

---

## Task 3: One transcript across both modes

**Files:**
- Modify: `lib/helper/agentMachine.ts` (`initialHelperState(turns?)`)
- Modify: `lib/helper/agentSession.ts` (`initialTurns`, prompt carries prior turns)
- Test: `tests/lib/helper/agentMachine.test.ts`, `tests/lib/helper/agentSession.test.ts`

**Interfaces — Task 4 depends on these:**
- `initialHelperState(turns?: HelperReplyTurn[]): HelperState`
- `SessionDeps` gains optional `initialTurns?: HelperReplyTurn[]`

**Depends on Task 1.** Do NOT disturb the re-entry guard, the `dropAudio` wiring, or the configure-before-audio ordering — all three were verified across six interleavings in the voice-helper branch.

- [ ] **Step 1: Write the failing tests**

Add to `tests/lib/helper/agentMachine.test.ts`:

```ts
it("can start from an existing transcript", () => {
  const seeded = initialHelperState([{ role: "student", text: "typed earlier" }]);
  expect(seeded.turns).toEqual([{ role: "student", text: "typed earlier" }]);
  expect(seeded.phase).toBe("idle");
});

it("appends spoken turns after the seeded ones", () => {
  let s = initialHelperState([{ role: "student", text: "typed earlier" }]);
  s = reduceHelper(s, { type: "conversationText", role: "assistant", content: "spoken reply" }).state;
  expect(s.turns.map((t) => t.text)).toEqual(["typed earlier", "spoken reply"]);
});

it("defaults to an empty transcript", () => {
  expect(initialHelperState().turns).toEqual([]);
});
```

Add to `tests/lib/helper/agentSession.test.ts` (reuse the file's existing fake-socket harness):

```ts
it("starts a call from the text transcript and tells the agent about it", async () => {
  const h = harness({ initialTurns: [{ role: "student", text: "phones are bad" }] });
  await h.session.start(emptyHelperContext());
  const cfg = JSON.stringify(h.socket.configure.mock.calls[0][0]);
  expect(cfg).toContain("phones are bad");
  expect(h.states[h.states.length - 1].turns[0]).toEqual({ role: "student", text: "phones are bad" });
});
```

Extend the file's `harness()` helper to accept an optional overrides object it spreads into `createAgentSession`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/helper/`
Expected: FAIL — `initialHelperState` takes no argument and `initialTurns` is not a dep.

- [ ] **Step 3: Seed the reducer**

```ts
export function initialHelperState(turns: HelperReplyTurn[] = []): HelperState {
  return { phase: "idle", turns, error: null };
}
```

- [ ] **Step 4: Seed the session and its prompt**

In `lib/helper/agentSession.ts`: add `initialTurns?: HelperReplyTurn[]` to `SessionDeps`; initialise `let state = initialHelperState(deps.initialTurns ?? [])`; and build the configure prompt with the transcript so the agent knows what was already typed:

```ts
socket.configure(agentConfig(helperPrompt(ctx, "voice", deps.initialTurns ?? [])));
```

`updateContext` should keep passing the same prior turns, so a context change mid-call does not erase the agent's memory of the text thread.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/helper/`
Expected: PASS, including every pre-existing re-entry-guard and barge-in test.

- [ ] **Step 6: Commit**

```bash
git add lib/helper/agentMachine.ts lib/helper/agentSession.ts tests/lib/helper/
git commit -m "feat: a voice call continues the helper's text conversation"
```

---

## Task 4: Text-first helper panel

**Files:**
- Modify: `components/helper/HelperPanel.tsx`
- Test: `tests/components/helper/HelperPanel.test.tsx`

**Depends on Tasks 1, 2, 3.**

`HelperPanelView` stays pure and gains text-mode props. `HelperPanel` keeps all wiring. The collapsed trigger becomes **`💬 Talk it through`**.

New view props, on top of what exists:

```
inCall: boolean
sending: boolean
onSend: (text: string) => void
onStartCall: () => void
```

Behaviour:
- **Closed** → collapsed trigger only.
- **Open, `!inCall`** → thread + textarea + `Send` + `Start voice call`. Send disabled while empty/whitespace or `sending`. A typing indicator shows while `sending`.
- **Open, `inCall`** → thread + phase label + `End call`. Composer hidden.
- A failed send **preserves the typed text** — same rule the feedback panel follows.

`HelperPanel` holds `turns: HelperReplyTurn[]` as the single source of truth. Text send POSTs to `/api/helper` with `{messages: [...turns, {role:"student", text}], context}` and appends the reply. `Start voice call` creates the session with `initialTurns: turns`; while the call is live, session state drives the thread; on end, the panel keeps the final turns. **Nothing touches the microphone or opens a socket until `Start voice call` is pressed.**

- [ ] **Step 1: Write the failing tests**

Drive `HelperPanelView` only. Cover: collapsed trigger reads "Talk it through"; open shows a textbox and both `Send` and `Start voice call`; Send disabled when empty and when `sending`; typing indicator while `sending`; `onSend` called with the typed text; during `inCall` the composer is gone but the thread and `End call` are present; a thread with student and helper turns renders both.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/helper/HelperPanel.test.tsx`
Expected: FAIL — there is no composer and the trigger still reads 🎙.

- [ ] **Step 3: Implement the view, then the wiring**

Keep the existing error and idle/Resume branches working — they are covered by tests that must keep passing.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/components/helper/ tests/components/FlowShell.test.tsx tests/components/PracticeShell.test.tsx`
Expected: PASS. The shells mount `HelperPanel`; they must need no edits.

- [ ] **Step 5: Commit**

```bash
git add components/helper/HelperPanel.tsx tests/components/helper/HelperPanel.test.tsx
git commit -m "feat: helper opens as a chat with voice as an escalation"
```

---

## Task 5: Button hover, and one motion family

**Files:**
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/motion.tsx`
- Test: `tests/components/ui/button.test.tsx`, `tests/components/motion.test.tsx`

Independent of Tasks 1-4.

`Button` is rendered inside server components across the app, so this is **CSS on the primitive** — converting it to a framer component would force `"use client"` app-wide. Add to the `cva` base, replacing the bare `transition-colors`:

```
transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out
hover:-translate-y-px hover:shadow-sm
active:translate-y-0 active:shadow-none
motion-reduce:transform-none motion-reduce:transition-none
```

`disabled:pointer-events-none` is already present, so disabled buttons cannot hover.

In `components/ui/motion.tsx`, retune `Pressable`'s hover so cards and buttons read as one family — a small lift alongside the existing scale, using `transitions.snappy`, which is already the 180ms token.

- [ ] **Step 1: Write the failing test**

jsdom cannot evaluate `:hover`, so assert the classes are on the element — a rendering assertion, and say so in a comment.

```tsx
it("gives every button a hover lift that respects reduced motion", () => {
  render(<Button>Go</Button>);
  const cls = screen.getByRole("button").className;
  // jsdom can't evaluate :hover; assert the primitive carries the classes.
  expect(cls).toContain("hover:-translate-y-px");
  expect(cls).toContain("active:translate-y-0");
  expect(cls).toContain("motion-reduce:transform-none");
});
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run tests/components/ui/button.test.tsx`
- [ ] **Step 3: Implement** both changes.
- [ ] **Step 4: Run** `npx vitest run tests/components/` — every button in the app renders through this primitive, so the whole tree is the regression surface.
- [ ] **Step 5: Commit**

```bash
git add components/ui/button.tsx components/ui/motion.tsx tests/components/ui/button.test.tsx tests/components/motion.test.tsx
git commit -m "feat: hover lift on every button, harmonised with card press"
```

---

## Task 6: Deck card hover and stage cross-fade

**Files:**
- Modify: `components/FlowDeck.tsx` (card hover)
- Modify: `components/FlowShell.tsx` (stage cross-fade)
- Test: `tests/components/FlowDeck.test.tsx`, `tests/components/FlowShell.test.tsx`

**Depends on Task 5** (same motion family).

Cards: add a hover border/shadow lift to the motion-card className so a card telegraphs clickability. The existing `hover:border-primary` stays.

Stages: wrap the active stage in `AnimatePresence mode="wait"` with a short fade (`transitions.snappy`), keyed by `progress.stage` + `progress.readSubstep`.

**Every existing `FlowShell` test must keep passing.** Swapping a `getBy*` for a `findBy*` is acceptable; changing what a test asserts is not — that would mean the animation broke the flow.

- [ ] **Step 1: Write the failing test** — assert the deck card carries the hover classes, and that after advancing a stage the new stage's content appears (an async assertion tolerating the fade).
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/components/FlowShell.test.tsx tests/components/FlowDeck.test.tsx tests/components/PracticeShell.test.tsx`
- [ ] **Step 5: Commit** — `feat: deck card hover and cross-faded stage transitions`

---

## Task 7: Celebration beats

**Files:**
- Modify: `components/LinkCard.tsx` (the bridge holds)
- Modify: `components/FlowShell.tsx` (both sides done)
- Test: `tests/components/LinkCard.test.tsx`, `tests/components/FlowShell.test.tsx`

**Depends on Task 6** (also edits `FlowShell.tsx`). Run after it, never concurrently.

Two moments earn a beat: `grade.held` becoming true, and `forComplete && againstComplete`. Give each a spring entrance and a brief flourish that does not block continuing. Fire once per achievement — a re-render must not replay it. Middle register: satisfying, not childish.

**Do not change `lib/linkGrade.ts`**, and do not alter the existing copy assertions' meaning — `LinkCard`'s summary text is covered by tests that were rewritten once already to assert behaviour rather than literal strings.

- [ ] **Step 1: Write the failing test** — the celebration element appears when the bridge holds and is absent before; the both-sides-complete panel carries it.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/components/LinkCard.test.tsx tests/components/LinkCard.onComplete.test.tsx tests/components/FlowShell.test.tsx tests/lib/linkGrade.test.ts`
- [ ] **Step 5: Commit** — `feat: celebrate the bridge holding and finishing both sides`

---

## Task 8: Panel and message entrances

**Files:**
- Modify: `components/helper/HelperPanel.tsx`
- Modify: `components/feedback/FeedbackPanel.tsx`
- Test: `tests/components/helper/HelperPanel.test.tsx`, `tests/components/feedback/FeedbackPanel.test.tsx`

**Depends on Tasks 4 and 5.**

Both panels slide up on a spring (`transitions.spring`) rather than appearing. Helper messages rise in as they arrive. Keep both `*View` components pure — `motion` components are fine in a pure view; timers and effects are not.

The feedback panel's mobile offset (`top-4 sm:top-auto`, added to stop it covering the helper sheet) must be preserved.

- [ ] **Step 1: Write the failing test** — messages render inside an animated wrapper; both panels still satisfy every existing assertion.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run tests/components/helper/ tests/components/feedback/`
- [ ] **Step 5: Commit** — `feat: spring entrances for the helper and feedback panels`

---

## Task 9: Full verification

- [ ] **Step 1: Suite** — `npm test`; expected ≥ 334 plus new tests, all green.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`; expected no output.
- [ ] **Step 3: Build** — `npm run build`; expected success.
- [ ] **Step 4: Confirm no secret reached the client**

```bash
grep -rn "DEEPGRAM_API_KEY\|SUPABASE_SERVICE_ROLE_KEY" app components lib
grep -rl "use client" components | xargs grep -l "@deepgram/sdk\|@supabase/supabase-js" || echo "no server SDK in a client file"
```

Expected: keys only in `app/api/**`; the fallback message from the second command.

- [ ] **Step 5: Confirm the helper no longer opens a mic on open**

```bash
grep -n "getUserMedia" components/helper/HelperPanel.tsx
```

Expected: it appears only inside the voice-call path, never in the open handler.

- [ ] **Step 6: Confirm reduced motion is honoured** — `grep -n "reducedMotion" app/layout.tsx` still shows `"user"`, and `grep -c "motion-reduce" components/ui/button.tsx` is non-zero.

- [ ] **Step 7: Commit any fixes.** Stage explicit paths; do not use `git add -A`.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| 1.1 prompt mode + prior turns | 1 |
| 1.2 text route | 2 |
| 1.3 one transcript across modes | 3 |
| 1.4 panel shape | 4 |
| 2.1 buttons | 5 |
| 2.2 deck cards | 6 |
| 2.3 stage transitions | 6 |
| 2.4 celebration beats | 7 |
| 2.5 panel and message entrances | 8 |
| Testing gates, secret checks | 9 |

**Type consistency:** `HelperReplyTurn` is exported in Task 1 and consumed by 2, 3, and 4. `helperPrompt(ctx, mode?, priorTurns?)` is defined in 1 and called by 2 (`"text"`, no prior turns — they travel as real history) and 3 (`"voice"` with prior turns, the only way that path can carry them). `initialHelperState(turns?)` and `SessionDeps.initialTurns` are defined in 3 and consumed by 4.

**Execution order.** Tasks 1 and 5 are independent and may be batched. 2 and 3 both depend on 1 and may be batched with each other. 4 depends on 1-3. 6 depends on 5. 7 depends on 6 (shared file). 8 depends on 4 and 5. 9 last. Tasks 6 and 7 both edit `FlowShell.tsx` and must not run concurrently.
