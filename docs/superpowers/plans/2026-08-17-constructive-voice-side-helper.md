# Voice Side Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live, interruptible voice helper the student can talk to alongside an activity, aware of what is on the page.

**Architecture:** The browser connects straight to Deepgram's Voice Agent API with a short-lived token, so no audio passes through Next routes. Everything except the socket itself is pure and unit-tested: context serialization, prompt assembly, an event reducer (including barge-in), and an audio queue. The socket wrapper takes an injectable factory so tests drive it with a fake.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, React 18, Tailwind + owned shadcn primitives, Vitest + React Testing Library, `@deepgram/sdk@3.13.0`, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-08-17-constructive-voice-side-helper-design.md`

## Global Constraints

- Baseline to preserve: **247 tests / 59 files green**. Never finish a task with a red suite.
- `npx tsc --noEmit` must stay clean; `npm run build` must succeed.
- Run a single file with `npx vitest run <path>`; the suite with `npm test`.
- Import via the `@/` path alias. Test style: flat `describe`/`it`, `render`/`screen` from `@testing-library/react`, `userEvent`. No snapshot tests.
- **`DEEPGRAM_API_KEY` must never reach the browser.** Only the short-lived `access_token` from `deepgram.auth.grantToken()` may be sent to the client. No `NEXT_PUBLIC_DEEPGRAM_*` variable may be introduced.
- **`ClaimStage`'s props must stay `{ motion, side, claims, onComplete }`** — it publishes context through a hook, never through new props. `FlowShell` and `PracticeShell` must need no prop changes.
- Do NOT change `components/VoiceOrTextInput.tsx`, `lib/voice/**`, `app/api/speak/route.ts`, `app/api/transcribe/**`, `lib/ai/**`, `app/api/coach/route.ts`, `lib/claimRubric.ts`, `content/**`, `components/FlowDeck.tsx`, `components/ui/app-shell.tsx`, `lib/linkGrade.ts`, `lib/practice.ts`.
- The helper is strictly additive: every failure path must leave the student able to finish the activity.
- Commit messages use `feat:` / `fix:` prefixes, imperative mood.

### Verified SDK facts (do not re-derive)

- `deepgram.agent(endpoint?)` returns `AgentLiveClient` (marked `@beta`), which extends the SDK's live-client base — subscribe with `.on(AgentEvents.X, handler)` and send audio with `.send(data)`.
- `configure(options: AgentLiveSchema)` MUST be called before any audio is sent.
- `updatePrompt(prompt: string)` replaces the system prompt mid-session.
- `keepAlive()` must be sent at least every 8 seconds when not transmitting audio.
- `AgentEvents` members used here: `Open`, `Close`, `Error`, `Audio`, `Welcome`, `SettingsApplied`, `ConversationText` (`{role, content}`), `UserStartedSpeaking`, `AgentThinking`, `AgentAudioDone`.
- **There is no `clear()` on `AgentLiveClient`.** Dropping queued/playing audio on interruption is our job.
- `deepgram.auth.grantToken()` → `Promise<DeepgramResponse<{ access_token: string; expires_in: number }>>`.
- `agent.think.provider.type` accepts `"anthropic"`; the system prompt goes in `agent.think.prompt`.

---

## Task 1: Ephemeral token route

**Files:**
- Create: `app/api/deepgram/token/route.ts` (the directory `app/api/deepgram/token/` already exists and is empty)
- Test: `tests/app/api/deepgram-token.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `POST /api/deepgram/token` → `200 {access_token, expires_in}` or `503 {error}`. Task 6 fetches it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const grantToken = vi.fn();
vi.mock("@deepgram/sdk", () => ({
  createClient: () => ({ auth: { grantToken } }),
}));

const { POST } = await import("@/app/api/deepgram/token/route");

beforeEach(() => {
  grantToken.mockReset();
  process.env.DEEPGRAM_API_KEY = "secret-key";
});
afterEach(() => {
  delete process.env.DEEPGRAM_API_KEY;
});

describe("POST /api/deepgram/token", () => {
  it("returns a short-lived token", async () => {
    grantToken.mockResolvedValue({ result: { access_token: "tok", expires_in: 30 }, error: null });
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ access_token: "tok", expires_in: 30 });
  });

  it("never leaks the api key", async () => {
    grantToken.mockResolvedValue({ result: { access_token: "tok", expires_in: 30 }, error: null });
    const res = await POST();
    expect(JSON.stringify(await res.json())).not.toContain("secret-key");
  });

  it("503s when the key is unset so the UI can degrade", async () => {
    delete process.env.DEEPGRAM_API_KEY;
    const res = await POST();
    expect(res.status).toBe(503);
  });

  it("503s when deepgram returns an error", async () => {
    grantToken.mockResolvedValue({ result: null, error: new Error("nope") });
    const res = await POST();
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app/api/deepgram-token.test.ts`
Expected: FAIL — cannot resolve `@/app/api/deepgram/token/route`.

- [ ] **Step 3: Implement the route**

```ts
import { createClient } from "@deepgram/sdk";

/** Mints a ~30s Deepgram token so the browser can open an agent socket directly.
 *  The API key itself never leaves the server. */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "voice helper unavailable" }, { status: 503 });
  }
  try {
    const { result, error } = await createClient(apiKey).auth.grantToken();
    if (error || !result?.access_token) {
      return Response.json({ error: "voice helper unavailable" }, { status: 503 });
    }
    return Response.json({ access_token: result.access_token, expires_in: result.expires_in });
  } catch {
    return Response.json({ error: "voice helper unavailable" }, { status: 503 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/app/api/deepgram-token.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/deepgram/token/route.ts tests/app/api/deepgram-token.test.ts
git commit -m "feat: ephemeral Deepgram token route for browser agent sockets"
```

---

## Task 2: Helper page-context model

**Files:**
- Create: `lib/helper/context.ts`
- Test: `tests/lib/helper/context.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces — Tasks 3, 7, 9 depend on these exactly:
  - `type HelperTurn = { role: "student" | "coach"; text: string }`
  - `type HelperContext = { activity: "journey" | "practice"; motion: string; side: "for" | "against" | null; stage: string; claimDraft: string | null; transcript: HelperTurn[] }`
  - `emptyHelperContext(): HelperContext`
  - `renderHelperContext(ctx: HelperContext): string`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { emptyHelperContext, renderHelperContext, type HelperContext } from "@/lib/helper/context";

const full: HelperContext = {
  activity: "journey",
  motion: "This House would ban homework.",
  side: "for",
  stage: "claim",
  claimDraft: "homework stops families eating together",
  transcript: [
    { role: "student", text: "homework is bad" },
    { role: "coach", text: "Can you ground that in a situation?" },
  ],
};

describe("renderHelperContext", () => {
  it("names the motion, side and stage", () => {
    const t = renderHelperContext(full);
    expect(t).toContain("This House would ban homework.");
    expect(t).toContain("for");
    expect(t).toContain("claim");
  });

  it("includes the student's working claim and the coach exchange", () => {
    const t = renderHelperContext(full);
    expect(t).toContain("homework stops families eating together");
    expect(t).toContain("Can you ground that in a situation?");
  });

  it("omits empty sections rather than printing blanks", () => {
    const t = renderHelperContext({ ...full, claimDraft: null, transcript: [] });
    expect(t).not.toMatch(/claim so far/i);
    expect(t).not.toMatch(/coach said/i);
  });

  it("handles a bare context without throwing", () => {
    expect(() => renderHelperContext(emptyHelperContext())).not.toThrow();
  });

  it("defaults to an empty journey context", () => {
    const e = emptyHelperContext();
    expect(e.transcript).toEqual([]);
    expect(e.claimDraft).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/helper/context.test.ts`
Expected: FAIL — cannot resolve `@/lib/helper/context`.

- [ ] **Step 3: Implement**

```ts
export type HelperTurn = { role: "student" | "coach"; text: string };

export type HelperContext = {
  activity: "journey" | "practice";
  motion: string;
  side: "for" | "against" | null;
  stage: string;
  claimDraft: string | null;
  transcript: HelperTurn[];
};

export function emptyHelperContext(): HelperContext {
  return { activity: "journey", motion: "", side: null, stage: "", claimDraft: null, transcript: [] };
}

/** The page-context block spliced into the helper's system prompt. Empty
 *  sections are omitted so the model is never handed blank headings. */
export function renderHelperContext(ctx: HelperContext): string {
  const lines: string[] = ["What the student is working on right now:"];
  if (ctx.motion) lines.push(`- Motion: "${ctx.motion}"`);
  if (ctx.side) lines.push(`- They are arguing: ${ctx.side}`);
  if (ctx.stage) lines.push(`- Current step: ${ctx.stage}`);
  lines.push(`- Activity: ${ctx.activity === "journey" ? "the full motion journey" : "a practice drill"}`);
  if (ctx.claimDraft) lines.push(`- Their claim so far: "${ctx.claimDraft}"`);
  if (ctx.transcript.length > 0) {
    lines.push("- Recent exchange with the on-page coach:");
    for (const t of ctx.transcript) {
      lines.push(`  ${t.role === "student" ? "Student" : "Coach said"}: ${t.text}`);
    }
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/helper/context.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/helper/context.ts tests/lib/helper/context.test.ts
git commit -m "feat: serializable page context for the voice helper"
```

---

## Task 3: Agent event reducer (barge-in as pure logic)

**Files:**
- Create: `lib/helper/agentMachine.ts`
- Test: `tests/lib/helper/agentMachine.test.ts`

**Interfaces:**
- Consumes: nothing (deliberately does not import the SDK, so it stays pure and fast to test).
- Produces — Tasks 6 and 8 depend on these exactly:
  - `type HelperPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error"`
  - `type HelperState = { phase: HelperPhase; turns: { role: "student" | "helper"; text: string }[]; error: string | null }`
  - `type HelperEvent = { type: "connecting" } | { type: "open" } | { type: "ready" } | { type: "conversationText"; role: string; content: string } | { type: "userStartedSpeaking" } | { type: "thinking" } | { type: "audio" } | { type: "audioDone" } | { type: "closed" } | { type: "error"; message: string }`
  - `type HelperEffect = "dropAudio" | null`
  - `initialHelperState(): HelperState`
  - `reduceHelper(state, event): { state: HelperState; effect: HelperEffect }`

**This is where the barge-in guarantee lives.** `userStartedSpeaking` must return the `dropAudio` effect; the session performs it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { initialHelperState, reduceHelper } from "@/lib/helper/agentMachine";

const s0 = initialHelperState();
const run = (events: Parameters<typeof reduceHelper>[1][]) =>
  events.reduce((acc, e) => reduceHelper(acc, e).state, s0);

describe("reduceHelper", () => {
  it("starts idle with no turns", () => {
    expect(s0.phase).toBe("idle");
    expect(s0.turns).toEqual([]);
  });

  it("moves to listening once the agent is ready", () => {
    expect(run([{ type: "connecting" }, { type: "open" }, { type: "ready" }]).phase).toBe("listening");
  });

  it("records both student and helper turns", () => {
    const s = run([
      { type: "ready" },
      { type: "conversationText", role: "user", content: "what is a claim" },
      { type: "conversationText", role: "assistant", content: "what do you think it means?" },
    ]);
    expect(s.turns).toEqual([
      { role: "student", text: "what is a claim" },
      { role: "helper", text: "what do you think it means?" },
    ]);
  });

  it("tracks thinking and speaking", () => {
    expect(run([{ type: "ready" }, { type: "thinking" }]).phase).toBe("thinking");
    expect(run([{ type: "ready" }, { type: "audio" }]).phase).toBe("speaking");
    expect(run([{ type: "ready" }, { type: "audio" }, { type: "audioDone" }]).phase).toBe("listening");
  });

  it("drops queued audio the moment the student interrupts", () => {
    const speaking = run([{ type: "ready" }, { type: "audio" }]);
    const { state, effect } = reduceHelper(speaking, { type: "userStartedSpeaking" });
    expect(effect).toBe("dropAudio");
    expect(state.phase).toBe("listening");
  });

  it("keeps the transcript when the socket closes", () => {
    const s = run([
      { type: "ready" },
      { type: "conversationText", role: "user", content: "hi" },
      { type: "closed" },
    ]);
    expect(s.phase).toBe("idle");
    expect(s.turns).toHaveLength(1);
  });

  it("surfaces errors", () => {
    const s = reduceHelper(s0, { type: "error", message: "socket died" }).state;
    expect(s.phase).toBe("error");
    expect(s.error).toBe("socket died");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/helper/agentMachine.test.ts`
Expected: FAIL — cannot resolve `@/lib/helper/agentMachine`.

- [ ] **Step 3: Implement**

```ts
export type HelperPhase = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export type HelperState = {
  phase: HelperPhase;
  turns: { role: "student" | "helper"; text: string }[];
  error: string | null;
};

export type HelperEvent =
  | { type: "connecting" }
  | { type: "open" }
  | { type: "ready" }
  | { type: "conversationText"; role: string; content: string }
  | { type: "userStartedSpeaking" }
  | { type: "thinking" }
  | { type: "audio" }
  | { type: "audioDone" }
  | { type: "closed" }
  | { type: "error"; message: string };

/** The session performs effects the reducer asks for. Keeping barge-in as an
 *  effect keeps it testable without a socket or an AudioContext. */
export type HelperEffect = "dropAudio" | null;

export function initialHelperState(): HelperState {
  return { phase: "idle", turns: [], error: null };
}

export function reduceHelper(
  state: HelperState,
  event: HelperEvent
): { state: HelperState; effect: HelperEffect } {
  switch (event.type) {
    case "connecting":
      return { state: { ...state, phase: "connecting", error: null }, effect: null };
    case "open":
      return { state: { ...state, phase: "connecting" }, effect: null };
    case "ready":
      return { state: { ...state, phase: "listening", error: null }, effect: null };
    case "conversationText": {
      const role = event.role === "user" ? ("student" as const) : ("helper" as const);
      if (!event.content.trim()) return { state, effect: null };
      return { state: { ...state, turns: [...state.turns, { role, text: event.content }] }, effect: null };
    }
    case "userStartedSpeaking":
      // Deepgram stops generating on its side; dropping our queued audio is our job.
      return { state: { ...state, phase: "listening" }, effect: "dropAudio" };
    case "thinking":
      return { state: { ...state, phase: "thinking" }, effect: null };
    case "audio":
      return { state: { ...state, phase: "speaking" }, effect: null };
    case "audioDone":
      return { state: { ...state, phase: "listening" }, effect: null };
    case "closed":
      return { state: { ...state, phase: "idle" }, effect: null };
    case "error":
      return { state: { ...state, phase: "error", error: event.message }, effect: null };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/helper/agentMachine.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/helper/agentMachine.ts tests/lib/helper/agentMachine.test.ts
git commit -m "feat: pure agent event reducer with barge-in effect"
```

---

## Task 4: Audio queue with immediate drop

**Files:**
- Create: `lib/helper/audioQueue.ts`
- Test: `tests/lib/helper/audioQueue.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces — Task 6 depends on this exactly:
  - `createAudioQueue(ctx: AudioContext, sampleRate?: number): { push(pcm: ArrayBuffer): void; drop(): void; close(): void }`

The agent sends linear16 (Int16) PCM. We convert to Float32, schedule each chunk back-to-back, and keep handles so `drop()` can stop everything instantly.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createAudioQueue } from "@/lib/helper/audioQueue";

function fakeCtx() {
  const stopped: number[] = [];
  const started: number[] = [];
  let id = 0;
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createBuffer: (_ch: number, len: number, _sr: number) => ({
      length: len,
      getChannelData: () => new Float32Array(len),
    }),
    createBufferSource: () => {
      const myId = ++id;
      return {
        buffer: null as unknown,
        connect: () => {},
        start: () => started.push(myId),
        stop: () => stopped.push(myId),
        onended: null,
      };
    },
    close: vi.fn(),
  };
  return { ctx: ctx as unknown as AudioContext, started, stopped };
}

const chunk = () => new Int16Array([1, 2, 3, 4]).buffer;

describe("audioQueue", () => {
  it("schedules pushed chunks", () => {
    const { ctx, started } = fakeCtx();
    const q = createAudioQueue(ctx);
    q.push(chunk());
    q.push(chunk());
    expect(started).toHaveLength(2);
  });

  it("stops everything queued when dropped", () => {
    const { ctx, started, stopped } = fakeCtx();
    const q = createAudioQueue(ctx);
    q.push(chunk());
    q.push(chunk());
    q.drop();
    expect(stopped).toHaveLength(started.length);
  });

  it("can queue again after a drop", () => {
    const { ctx, started } = fakeCtx();
    const q = createAudioQueue(ctx);
    q.push(chunk());
    q.drop();
    q.push(chunk());
    expect(started).toHaveLength(2);
  });

  it("ignores empty chunks", () => {
    const { ctx, started } = fakeCtx();
    const q = createAudioQueue(ctx);
    q.push(new ArrayBuffer(0));
    expect(started).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/helper/audioQueue.test.ts`
Expected: FAIL — cannot resolve `@/lib/helper/audioQueue`.

- [ ] **Step 3: Implement**

```ts
/**
 * Plays linear16 PCM chunks streamed from the agent, back-to-back.
 * `drop()` exists because AgentLiveClient has no clear() — when the student
 * interrupts, stopping our own queued audio is the only thing that actually
 * makes the helper stop talking.
 */
export function createAudioQueue(ctx: AudioContext, sampleRate = 24000) {
  let sources: { stop(): void }[] = [];
  let cursor = 0;

  function push(pcm: ArrayBuffer): void {
    if (pcm.byteLength < 2) return;
    const ints = new Int16Array(pcm);
    const buffer = ctx.createBuffer(1, ints.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < ints.length; i++) channel[i] = ints[i] / 32768;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, cursor);
    source.start(startAt);
    cursor = startAt + ints.length / sampleRate;
    sources.push(source);
    source.onended = () => {
      sources = sources.filter((s) => s !== source);
    };
  }

  function drop(): void {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // already finished
      }
    }
    sources = [];
    cursor = 0;
  }

  function close(): void {
    drop();
    void ctx.close?.();
  }

  return { push, drop, close };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/helper/audioQueue.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/helper/audioQueue.ts tests/lib/helper/audioQueue.test.ts
git commit -m "feat: PCM audio queue with instant drop for barge-in"
```

---

## Task 5: Helper system prompt

**Files:**
- Create: `lib/helper/helperPrompt.ts`
- Test: `tests/lib/helper/helperPrompt.test.ts`

**Interfaces:**
- Consumes (Task 2): `HelperContext`, `renderHelperContext`. Also `renderRubric()` from `@/lib/claimRubric` — **imported, never copied**, so the helper holds the same standard as the stage coach and the claim generator.
- Produces — Task 6 depends on this exactly: `helperPrompt(ctx: HelperContext): string`.

**Depends on Task 2.**

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { helperPrompt } from "@/lib/helper/helperPrompt";
import { emptyHelperContext } from "@/lib/helper/context";

const ctx = { ...emptyHelperContext(), motion: "This House would ban homework.", side: "for" as const, stage: "claim" };

describe("helperPrompt", () => {
  it("carries the shared claim rubric", () => {
    const p = helperPrompt(ctx);
    for (const name of ["One idea", "Takes a side", "Concrete", "Contestable"]) {
      expect(p).toContain(name);
    }
  });

  it("forbids writing the student's argument for them", () => {
    expect(helperPrompt(ctx).toLowerCase()).toContain("never write");
  });

  it("keeps the helper on the debate task", () => {
    expect(helperPrompt(ctx).toLowerCase()).toContain("politely decline");
  });

  it("tells it to keep spoken turns short and ask one question", () => {
    const p = helperPrompt(ctx).toLowerCase();
    expect(p).toContain("one question");
    expect(p).toContain("short");
  });

  it("includes the page context", () => {
    expect(helperPrompt(ctx)).toContain("This House would ban homework.");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/helper/helperPrompt.test.ts`
Expected: FAIL — cannot resolve `@/lib/helper/helperPrompt`.

- [ ] **Step 3: Implement**

```ts
import { renderRubric } from "@/lib/claimRubric";
import { renderHelperContext, type HelperContext } from "@/lib/helper/context";

/** The helper's system prompt. It reuses the SAME rubric as the on-page claim
 *  coach and the claim generator, so a student cannot get a softer standard by
 *  switching to voice. */
export function helperPrompt(ctx: HelperContext): string {
  return [
    "You are a warm debate coach talking out loud with a student aged 10-18.",
    "You are a side helper: they came to you to think out loud, not to be given answers.",
    "",
    "How to talk:",
    "- This is speech, not writing. Keep every turn to a sentence or two.",
    "- Ask one question at a time, then stop and let them answer.",
    "- Never read a list of criteria aloud at them.",
    "",
    "Hard rules:",
    "- NEVER write their claim, link, or impact for them, even if they ask directly.",
    "  Ask a question that helps them find it themselves.",
    "- If they ask you to just give them the answer, say warmly that it has to be theirs,",
    "  and ask them something that gets them closer.",
    "- Stay on this debate activity. If they want to talk about something else,",
    "  politely decline and bring them back to the motion.",
    "",
    "This is what makes a claim good — use it to guide your questions, never recite it:",
    renderRubric(),
    "",
    renderHelperContext(ctx),
  ].join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/helper/helperPrompt.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/helper/helperPrompt.ts tests/lib/helper/helperPrompt.test.ts
git commit -m "feat: helper system prompt sharing the claim rubric"
```

---

## Task 6: Helper context provider

**Files:**
- Create: `components/helper/HelperContextProvider.tsx`
- Test: `tests/components/helper/HelperContextProvider.test.tsx`

**Interfaces:**
- Consumes (Task 2): `HelperContext`, `emptyHelperContext`.
- Produces — Tasks 8 and 9 depend on these exactly:
  - `<HelperContextProvider>{children}</HelperContextProvider>`
  - `usePublishHelperContext(patch: Partial<HelperContext>): void` — effect-based; safe to call from any descendant, including one mounted under two different hosts.
  - `useHelperContext(): HelperContext`

**Depends on Task 2.** Must be a client component (`"use client"`).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  HelperContextProvider,
  usePublishHelperContext,
  useHelperContext,
} from "@/components/helper/HelperContextProvider";

function Publisher({ motion }: { motion: string }) {
  usePublishHelperContext({ motion, stage: "claim" });
  return null;
}
function Reader() {
  const ctx = useHelperContext();
  return <div data-testid="ctx">{`${ctx.motion}|${ctx.stage}`}</div>;
}

describe("HelperContextProvider", () => {
  it("makes a child's published context visible to a reader", async () => {
    render(
      <HelperContextProvider>
        <Publisher motion="This House would ban homework." />
        <Reader />
      </HelperContextProvider>
    );
    expect(await screen.findByTestId("ctx")).toHaveTextContent(
      "This House would ban homework.|claim"
    );
  });

  it("merges patches from more than one publisher", async () => {
    function Second() {
      usePublishHelperContext({ side: "against" });
      return null;
    }
    function SideReader() {
      return <div data-testid="side">{String(useHelperContext().side)}</div>;
    }
    render(
      <HelperContextProvider>
        <Publisher motion="m" />
        <Second />
        <SideReader />
      </HelperContextProvider>
    );
    expect(await screen.findByTestId("side")).toHaveTextContent("against");
  });

  it("returns an empty context outside a provider rather than throwing", () => {
    render(<Reader />);
    expect(screen.getByTestId("ctx")).toHaveTextContent("|");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/helper/HelperContextProvider.test.tsx`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement**

```tsx
"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { emptyHelperContext, type HelperContext } from "@/lib/helper/context";

type Store = { ctx: HelperContext; publish: (patch: Partial<HelperContext>) => void };

const Ctx = createContext<Store | null>(null);

export function HelperContextProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<HelperContext>(emptyHelperContext);
  const value = useMemo<Store>(
    () => ({
      ctx,
      publish: (patch) =>
        setCtx((prev) => {
          // Skip no-op updates so publishers can call this on every render.
          const next = { ...prev, ...patch };
          for (const k of Object.keys(patch) as (keyof HelperContext)[]) {
            if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) return next;
          }
          return prev;
        }),
    }),
    [ctx]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Publish a slice of page context. Safe outside a provider (no-op), so a
 *  component mounted under two different hosts needs no special casing. */
export function usePublishHelperContext(patch: Partial<HelperContext>): void {
  const store = useContext(Ctx);
  const key = JSON.stringify(patch);
  useEffect(() => {
    store?.publish(JSON.parse(key) as Partial<HelperContext>);
  }, [store, key]);
}

export function useHelperContext(): HelperContext {
  return useContext(Ctx)?.ctx ?? emptyHelperContext();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/helper/HelperContextProvider.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/helper/HelperContextProvider.tsx tests/components/helper/HelperContextProvider.test.tsx
git commit -m "feat: client context so the helper can see the page"
```

---

## Task 7: Agent session wrapper

**Files:**
- Create: `lib/helper/agentSession.ts`
- Test: `tests/lib/helper/agentSession.test.ts`

**Interfaces:**
- Consumes: Task 1's route, Task 3's reducer, Task 4's queue, Task 5's prompt, Task 2's context.
- Produces — Task 8 depends on this exactly:

```ts
type AgentSocket = {
  on(event: string, handler: (payload: unknown) => void): void;
  configure(options: unknown): void;
  updatePrompt(prompt: string): void;
  send(data: ArrayBuffer): void;
  keepAlive(): void;
  requestClose(): void;
};
type SessionDeps = {
  fetchToken: () => Promise<string>;
  createSocket: (token: string) => AgentSocket;
  createQueue: () => { push(pcm: ArrayBuffer): void; drop(): void; close(): void };
  onState: (s: HelperState) => void;
};
createAgentSession(deps: SessionDeps): {
  start(ctx: HelperContext): Promise<void>;
  updateContext(ctx: HelperContext): void;
  stop(): void;
};
```

**Every dependency is injected**, so tests drive it with a fake socket and never open a real one. The production wiring (real `fetch`, `deepgram.agent()`, real `AudioContext`, mic capture) lives in Task 8's component, which is the untestable seam by design.

**Depends on Tasks 2, 3, 4, 5.**

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createAgentSession } from "@/lib/helper/agentSession";
import { emptyHelperContext } from "@/lib/helper/context";
import type { HelperState } from "@/lib/helper/agentMachine";

function harness() {
  const handlers = new Map<string, (p: unknown) => void>();
  const socket = {
    on: (e: string, h: (p: unknown) => void) => void handlers.set(e, h),
    configure: vi.fn(),
    updatePrompt: vi.fn(),
    send: vi.fn(),
    keepAlive: vi.fn(),
    requestClose: vi.fn(),
  };
  const queue = { push: vi.fn(), drop: vi.fn(), close: vi.fn() };
  const states: HelperState[] = [];
  const session = createAgentSession({
    fetchToken: async () => "tok",
    createSocket: () => socket,
    createQueue: () => queue,
    onState: (s) => states.push(s),
  });
  return { session, socket, queue, states, fire: (e: string, p?: unknown) => handlers.get(e)?.(p) };
}

describe("agentSession", () => {
  it("configures the socket before any audio and includes the prompt", async () => {
    const h = harness();
    await h.session.start({ ...emptyHelperContext(), motion: "This House would ban homework." });
    expect(h.socket.configure).toHaveBeenCalledTimes(1);
    const cfg = JSON.stringify(h.socket.configure.mock.calls[0][0]);
    expect(cfg).toContain("This House would ban homework.");
    expect(cfg).toContain("anthropic");
  });

  it("drops queued audio when the student interrupts", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.fire("Audio", new Int16Array([1, 2]).buffer);
    h.fire("UserStartedSpeaking");
    expect(h.queue.drop).toHaveBeenCalled();
  });

  it("pushes agent audio into the queue", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.fire("Audio", new Int16Array([1, 2]).buffer);
    expect(h.queue.push).toHaveBeenCalled();
  });

  it("reports state changes as conversation happens", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.fire("SettingsApplied");
    h.fire("ConversationText", { role: "user", content: "hi" });
    const last = h.states[h.states.length - 1];
    expect(last.turns).toEqual([{ role: "student", text: "hi" }]);
  });

  it("pushes a new prompt when the page context changes", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.session.updateContext({ ...emptyHelperContext(), stage: "impact" });
    expect(h.socket.updatePrompt).toHaveBeenCalled();
    expect(String(h.socket.updatePrompt.mock.calls[0][0])).toContain("impact");
  });

  it("closes the socket and the queue on stop", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.session.stop();
    expect(h.socket.requestClose).toHaveBeenCalled();
    expect(h.queue.close).toHaveBeenCalled();
  });

  it("surfaces a token failure as an error state", async () => {
    const states: HelperState[] = [];
    const session = createAgentSession({
      fetchToken: async () => {
        throw new Error("503");
      },
      createSocket: () => {
        throw new Error("should not be reached");
      },
      createQueue: () => ({ push: vi.fn(), drop: vi.fn(), close: vi.fn() }),
      onState: (s) => states.push(s),
    });
    await session.start(emptyHelperContext());
    expect(states[states.length - 1].phase).toBe("error");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/helper/agentSession.test.ts`
Expected: FAIL — cannot resolve `@/lib/helper/agentSession`.

- [ ] **Step 3: Implement**

```ts
import { helperPrompt } from "@/lib/helper/helperPrompt";
import { initialHelperState, reduceHelper, type HelperEvent, type HelperState } from "@/lib/helper/agentMachine";
import type { HelperContext } from "@/lib/helper/context";

export type AgentSocket = {
  on(event: string, handler: (payload: unknown) => void): void;
  configure(options: unknown): void;
  updatePrompt(prompt: string): void;
  send(data: ArrayBuffer): void;
  keepAlive(): void;
  requestClose(): void;
};

export type AgentQueue = { push(pcm: ArrayBuffer): void; drop(): void; close(): void };

export type SessionDeps = {
  fetchToken: () => Promise<string>;
  createSocket: (token: string) => AgentSocket;
  createQueue: () => AgentQueue;
  onState: (s: HelperState) => void;
};

// Hardcoded, not env-driven: agentConfig runs in the browser, where server-only
// env vars are unreadable. Matches the repo's COACH_MODEL default and the Aura
// voice already used by /api/speak.
const LISTEN_MODEL = "nova-3";
const SPEAK_MODEL = "aura-2-thalia-en";
const THINK_MODEL = "claude-sonnet-5";

export function agentConfig(prompt: string) {
  return {
    audio: {
      input: { encoding: "linear16", sample_rate: 16000 },
      output: { encoding: "linear16", sample_rate: 24000, container: "none" },
    },
    agent: {
      language: { type: "en" },
      listen: { provider: { type: "deepgram", model: LISTEN_MODEL } },
      think: { provider: { type: "anthropic", model: THINK_MODEL }, prompt },
      speak: { provider: { type: "deepgram", model: SPEAK_MODEL } },
    },
  };
}

export function createAgentSession(deps: SessionDeps) {
  let socket: AgentSocket | null = null;
  let queue: AgentQueue | null = null;
  let state = initialHelperState();

  function dispatch(event: HelperEvent) {
    const { state: next, effect } = reduceHelper(state, event);
    state = next;
    if (effect === "dropAudio") queue?.drop();
    deps.onState(state);
  }

  async function start(ctx: HelperContext): Promise<void> {
    dispatch({ type: "connecting" });
    let token: string;
    try {
      token = await deps.fetchToken();
    } catch {
      dispatch({ type: "error", message: "Voice helper is unavailable right now." });
      return;
    }
    try {
      queue = deps.createQueue();
      socket = deps.createSocket(token);
    } catch {
      dispatch({ type: "error", message: "Couldn't start the voice helper." });
      return;
    }

    socket.on("Open", () => dispatch({ type: "open" }));
    socket.on("Welcome", () => dispatch({ type: "ready" }));
    socket.on("SettingsApplied", () => dispatch({ type: "ready" }));
    socket.on("ConversationText", (p) => {
      const t = p as { role?: string; content?: string };
      dispatch({ type: "conversationText", role: t.role ?? "assistant", content: t.content ?? "" });
    });
    socket.on("UserStartedSpeaking", () => dispatch({ type: "userStartedSpeaking" }));
    socket.on("AgentThinking", () => dispatch({ type: "thinking" }));
    socket.on("AgentAudioDone", () => dispatch({ type: "audioDone" }));
    socket.on("Audio", (p) => {
      const buf = p as ArrayBuffer;
      queue?.push(buf);
      dispatch({ type: "audio" });
    });
    socket.on("Close", () => dispatch({ type: "closed" }));
    socket.on("Error", (p) => {
      const e = p as { message?: string };
      dispatch({ type: "error", message: e?.message ?? "The voice helper hit a problem." });
    });

    // configure() MUST precede any audio.
    socket.configure(agentConfig(helperPrompt(ctx)));
  }

  function updateContext(ctx: HelperContext): void {
    socket?.updatePrompt(helperPrompt(ctx));
  }

  function stop(): void {
    socket?.requestClose();
    queue?.close();
    socket = null;
    queue = null;
    dispatch({ type: "closed" });
  }

  return { start, updateContext, stop, send: (d: ArrayBuffer) => socket?.send(d), keepAlive: () => socket?.keepAlive() };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/helper/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/helper/agentSession.ts tests/lib/helper/agentSession.test.ts
git commit -m "feat: agent session wrapper with injectable socket"
```

---

## Task 8: Helper panel UI

**Files:**
- Create: `components/helper/HelperPanel.tsx`
- Test: `tests/components/helper/HelperPanel.test.tsx`

**Interfaces:**
- Consumes: Task 3's `HelperState`, Task 6's `useHelperContext`, Task 7's `createAgentSession`.
- Produces (for Task 9): `<HelperPanel />` — takes no props; reads context from the provider.

**Depends on Tasks 3, 6, 7.**

This component owns the **untestable seam**: real `fetch("/api/deepgram/token")`, `createClient(token).agent()`, a real `AudioContext`, and mic capture. Keep that wiring in one small `connect()` function so everything else stays testable. Export the presentational shell separately so tests can drive states directly:

`export function HelperPanelView({ state, open, onOpen, onClose }: {...})` — pure, no sockets.
`export function HelperPanel()` — wires the real session to `HelperPanelView`.

- [ ] **Step 1: Write the failing test**

Test `HelperPanelView` only. Do not attempt to test the socket wiring.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelperPanelView } from "@/components/helper/HelperPanel";
import { initialHelperState } from "@/lib/helper/agentMachine";

const base = initialHelperState();

describe("HelperPanelView", () => {
  it("shows a collapsed affordance when closed", () => {
    render(<HelperPanelView state={base} open={false} onOpen={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /talk it through/i })).toBeInTheDocument();
  });

  it("opens on click", async () => {
    const onOpen = vi.fn();
    render(<HelperPanelView state={base} open={false} onOpen={onOpen} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /talk it through/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("names each phase while open", () => {
    for (const [phase, label] of [
      ["listening", /listening/i],
      ["thinking", /thinking/i],
      ["speaking", /speaking/i],
      ["connecting", /connecting/i],
    ] as const) {
      const { unmount } = render(
        <HelperPanelView state={{ ...base, phase }} open onOpen={() => {}} onClose={() => {}} />
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders the conversation", () => {
    render(
      <HelperPanelView
        state={{ ...base, phase: "listening", turns: [
          { role: "student", text: "what makes a claim good" },
          { role: "helper", text: "what do you think it needs?" },
        ] }}
        open
        onOpen={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("what makes a claim good")).toBeInTheDocument();
    expect(screen.getByText("what do you think it needs?")).toBeInTheDocument();
  });

  it("explains itself instead of failing when the helper is unavailable", () => {
    render(
      <HelperPanelView
        state={{ ...base, phase: "error", error: "Voice helper is unavailable right now." }}
        open
        onOpen={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it("offers a stop control while open", async () => {
    const onClose = vi.fn();
    render(<HelperPanelView state={{ ...base, phase: "listening" }} open onOpen={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /stop|close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/helper/HelperPanel.test.tsx`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement the view**

Presentational only, styled to match the codebase (muted small text like `Landing.tsx:30`, `Card`/`Button` primitives, `border-border`). Collapsed: a `Button` labelled "🎙 Talk it through". Open: a `Card` fixed to the bottom-right on desktop and full-width on mobile, containing a phase line (`Connecting…` / `Listening…` / `Thinking…` / `Speaking…`), the turn list (student turns muted, helper turns in a `CoachBubble`), any `state.error`, and a "Stop" `Button` calling `onClose`.

- [ ] **Step 4: Implement the live wiring**

`HelperPanel()` holds `open` and `state`, reads `useHelperContext()`, and on open creates the session:

```tsx
const session = createAgentSession({
  fetchToken: async () => {
    const res = await fetch("/api/deepgram/token", { method: "POST" });
    if (!res.ok) throw new Error("no token");
    return (await res.json()).access_token as string;
  },
  createSocket: (token) => createClient(token).agent() as unknown as AgentSocket,
  createQueue: () => createAudioQueue(new AudioContext()),
  onState: setState,
});
```

Mic capture: `getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}})` → `new AudioContext({ sampleRate: 16000 })` → `createMediaStreamSource` → `createScriptProcessor(4096, 1, 1)` → in `onaudioprocess`, convert Float32 to Int16 and `session.send(int16.buffer)`. Keep a `setInterval(session.keepAlive, 5000)` while idle. Tear all of it down in the effect cleanup and on `onClose`.

Idle guard: if no `ConversationText` arrives for 90 seconds, call `onClose` and show a one-tap "Resume" — the cost guard from the spec.

**Note honestly in the report that the wiring in this step is not covered by tests.**

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/components/helper/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/helper/HelperPanel.tsx tests/components/helper/HelperPanel.test.tsx
git commit -m "feat: voice helper panel"
```

---

## Task 9: Mount the helper and publish page context

**Files:**
- Modify: `components/FlowShell.tsx`
- Modify: `components/PracticeShell.tsx`
- Modify: `components/stages/ClaimStage.tsx`
- Test: `tests/components/FlowShell.test.tsx`, `tests/components/PracticeShell.test.tsx` (extend; existing assertions must keep passing)

**Interfaces:**
- Consumes: Tasks 6 and 8.
- Produces: nothing further.

**Depends on Tasks 6 and 8.** **`ClaimStage`'s props must not change.**

- [ ] **Step 1: Write the failing tests**

Add to `tests/components/FlowShell.test.tsx`:

```tsx
it("offers the voice helper inside the journey", () => {
  render(<FlowShell motion={motion} onExit={() => {}} />);
  expect(screen.getByRole("button", { name: /talk it through/i })).toBeInTheDocument();
});
```

Add the equivalent to `tests/components/PracticeShell.test.tsx`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/FlowShell.test.tsx tests/components/PracticeShell.test.tsx`
Expected: FAIL — no such button.

- [ ] **Step 3: Wrap and mount**

In `components/FlowShell.tsx`, wrap the existing `AppShell` subtree in `<HelperContextProvider>`, render `<HelperPanel />` inside it, and publish:

```tsx
usePublishHelperContext({
  activity: "journey",
  motion: motion.motion,
  side: progress.side,
  stage: progress.stage,
});
```

Because `usePublishHelperContext` must run **inside** the provider, extract the existing body into an inner component (e.g. `FlowShellInner`) that the provider wraps — do not call the hook in the same component that renders the provider.

Do the same in `components/PracticeShell.tsx` with `activity: "practice"`, `stage: part`, and `motion: item.part === "link" ? "" : item.motion`.

- [ ] **Step 4: Publish the claim draft and coach transcript**

In `components/stages/ClaimStage.tsx`, add — **props unchanged**:

```tsx
usePublishHelperContext({ claimDraft: lastStudentClaim || null, transcript: turns });
```

`turns` is already `{role: "student"|"coach"; text: string}[]`, matching `HelperTurn`. Since `ClaimStage` also renders under `PracticeShell`, and `usePublishHelperContext` is a no-op outside a provider, both hosts work with no special casing.

- [ ] **Step 5: Note the env situation**

**No new env var.** The helper's models are hardcoded in `lib/helper/agentSession.ts` because `agentConfig` runs in the browser, where server-only env vars are unreadable, and this repo has a firm no-`NEXT_PUBLIC_DEEPGRAM_*` rule. `.env.example` needs no change — `DEEPGRAM_API_KEY` is already documented and is all the server needs. Do not add one.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/components/`
Expected: PASS. `ClaimStage`, `FlowShell`, and `PracticeShell` tests must all still pass; if `ClaimStage`'s own tests fail, its props changed and that is a bug in this task.

- [ ] **Step 7: Commit**

```bash
git add components/FlowShell.tsx components/PracticeShell.tsx components/stages/ClaimStage.tsx tests/components/
git commit -m "feat: mount the voice helper and publish page context"
```

---

## Task 10: Full verification

**Files:** none modified unless a gate fails.

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: all pass, count ≥ 247 plus the new tests.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Confirm the key never reaches the client**

```bash
grep -rn "DEEPGRAM_API_KEY" app components lib
grep -rn "NEXT_PUBLIC_DEEPGRAM" . --exclude-dir=node_modules --exclude-dir=.git
```

Expected: the first shows `DEEPGRAM_API_KEY` **only** in server files (`app/api/**`, `lib/ai/**`) and never in a `"use client"` component; the second prints nothing.

- [ ] **Step 5: Confirm branch-1 voice behavior is untouched**

```bash
git diff main --stat -- components/VoiceOrTextInput.tsx lib/voice app/api/speak app/api/transcribe
```

Expected: empty.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: verification pass for the voice helper branch"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Ephemeral token route | 1 |
| Page context model + `renderHelperContext` | 2 |
| Agent event handling + barge-in effect | 3 |
| Audio queue with `drop()` | 4 |
| Helper prompt reusing `renderRubric()` | 5 |
| `HelperContextProvider` + publish hook | 6 |
| Agent session lifecycle, injectable socket | 7 |
| Panel UI, phases, disabled/error state, idle guard | 8 |
| Mounting in both shells; publishing from all three sources | 9 |
| Testing gates + key-safety checks | 10 |

**Type consistency:** `HelperContext`/`HelperTurn` (Task 2) are consumed by Tasks 5, 6, 7, 9. `HelperState`/`HelperEvent`/`HelperEffect` (Task 3) by Tasks 7, 8. `AgentSocket`/`AgentQueue`/`SessionDeps` (Task 7) by Task 8. `usePublishHelperContext`/`useHelperContext` (Task 6) by Tasks 8, 9. `ClaimStage`'s props are unchanged throughout.

**Known untestable surface, stated plainly:** Task 8 Step 4 — the real socket, real `AudioContext`, and mic capture. Everything around it is injected and tested. The report must say this rather than implying end-to-end verification.

**Execution order.** Tasks 1, 2, 3, 4 are independent and may be batched. Task 5 depends on 2; Task 6 depends on 2 (5 and 6 may be batched). Task 7 depends on 2, 3, 4, 5. Task 8 depends on 3, 6, 7. Task 9 depends on 6, 8. Task 10 last.
