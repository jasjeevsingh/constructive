# Debate Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-mode AI sparring partner (structured sparring, pushback coach, collaborative build + debate) that lets students practice debate against an avatar, with content-only scoring against EJ's rubric.

**Architecture:** Shared infrastructure (types, prompts, scoring, voice I/O, session persistence) with mode-specific orchestrators. Each orchestrator is pure logic (no I/O) that manages turn sequencing and scoring triggers. The UI shell handles voice, API calls, and rendering. Hold-to-talk + TTS for voice; text fallback always available.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Zod, Anthropic Claude (via existing ChatClient), Deepgram STT/TTS (via existing endpoints), Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-08-27-constructive-debate-avatar-design.md`

## Global Constraints

- No new npm dependencies — all features build on existing Anthropic, Deepgram, and Zod integrations
- Prompts use the `(input) => { system, user }` builder pattern from `lib/prompts/*.ts`
- AI responses are Zod-validated before use (same pattern as `CoachResponseSchema` in `lib/schemas.ts`)
- Voice uses the existing hold-to-talk STT (`/api/transcribe/live`) and TTS (`/api/speak`) endpoints
- ChatClient interface: `complete({ system, user, history? })` from `lib/ai/claude.ts`
- `ChatTurn` type: `{ role: "user" | "assistant"; content: string }` from `lib/ai/claude.ts`
- localStorage persistence follows `lib/state/flowProgress.ts` pattern (typed read/write helpers, manual validation)
- Tests use Vitest + `@testing-library/react` with mocked `fetch` for AI/voice responses
- All content targeting youth debaters aged 10-18 — no inappropriate content in prompts or avatar responses

## File Map

```
lib/avatar/
  types.ts              — Types + Zod schemas for scoring responses
  cohortAdapter.ts      — Per-cohort config (word limits, scaffolding, vocabulary)
  avatarPrompt.ts       — Prompt builders for all modes (system + user)
  avatarScoring.ts      — Scoring logic: transcript → ChatClient → validated scores
  orchestrators/
    sparringOrch.ts     — Mode A: round/turn management, post-round scoring trigger
    pushbackOrch.ts     — Mode B: challenge cycle, inline scoring trigger
    collaborativeOrch.ts — Mode C: brainstorm phase → debate phase transitions

lib/state/
  avatarSession.ts      — localStorage persistence for AvatarSession

app/api/avatar/
  turn/route.ts         — POST: generate avatar response text
  score/route.ts        — POST: score a transcript segment

components/avatar/
  AvatarShell.tsx       — Top-level: mode picker → session → summary
  ModeCard.tsx          — Mode selection card (sparring / pushback / collaborative)
  TranscriptPane.tsx    — Scrolling conversation transcript
  AvatarVoiceBar.tsx    — Hold-to-talk + text input + TTS playback + timer
  ScoreCard.tsx         — Post-round overlay (Mode A) + inline badges (B/C)

tests/lib/avatar/
  types.test.ts
  cohortAdapter.test.ts
  avatarPrompt.test.ts
  avatarScoring.test.ts
  sparringOrch.test.ts
  pushbackOrch.test.ts
  collaborativeOrch.test.ts

tests/lib/state/
  avatarSession.test.ts

tests/components/
  AvatarShell.test.tsx
  TranscriptPane.test.tsx
  ScoreCard.test.tsx
```

---

### Task 1: Types, Zod Schemas, and Cohort Adapter

**Files:**
- Create: `lib/avatar/types.ts`
- Create: `lib/avatar/cohortAdapter.ts`
- Create: `tests/lib/avatar/types.test.ts`
- Create: `tests/lib/avatar/cohortAdapter.test.ts`

**Interfaces:**
- Consumes: nothing (foundation)
- Produces:
  - `AvatarMode`, `Cohort`, `Side` (reuses from `lib/state/flowMachine`), `Speaker` type literals
  - `AvatarTurn`, `InlineScore`, `RoundScore`, `AvatarSession`, `ModeConfig` interfaces
  - `InlineScoreSchema`, `RoundScoreSchema` Zod schemas for AI response validation
  - `getModeConfig(mode: AvatarMode, cohort: Cohort): ModeConfig`
  - `getCohortPromptModifiers(cohort: Cohort): { vocabulary: string; signposting: string; pushbackIntensity: string; scaffolding: string }`

- [ ] **Step 1: Write failing tests for types and Zod schemas**

```typescript
// tests/lib/avatar/types.test.ts
import { describe, it, expect } from "vitest";
import { InlineScoreSchema, RoundScoreSchema } from "@/lib/avatar/types";

describe("InlineScoreSchema", () => {
  it("accepts a valid inline score", () => {
    const result = InlineScoreSchema.safeParse({
      criterion: "Link",
      score: 2,
      rationale: "Evidence present but reasoning gap remains.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects score outside 0-3", () => {
    const result = InlineScoreSchema.safeParse({
      criterion: "Link",
      score: 4,
      rationale: "Too high.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing criterion", () => {
    const result = InlineScoreSchema.safeParse({
      score: 2,
      rationale: "Missing field.",
    });
    expect(result.success).toBe(false);
  });
});

describe("RoundScoreSchema", () => {
  it("accepts a valid round score", () => {
    const result = RoundScoreSchema.safeParse({
      argumentation: { claim: 2, link: 1, impact: 3, weighing: 1 },
      engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
      rationales: {
        claim: "Clear and specific.",
        link: "Evidence missing.",
        impact: "Strong real-world connection.",
        weighing: "No comparison made.",
        breadth: "Two angles covered.",
        depth: "Developed one point well.",
        responsive: "Directly addressed opponent.",
        crystallizing: "No synthesis attempted.",
      },
      focusArea: "weighing",
      focusTip: "Try painting a picture of what the world looks like if your side wins.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when a sub-criterion score exceeds 3", () => {
    const result = RoundScoreSchema.safeParse({
      argumentation: { claim: 5, link: 1, impact: 3, weighing: 1 },
      engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
      rationales: {},
      focusArea: "claim",
      focusTip: "Tip.",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/avatar/types.test.ts
```

Expected: FAIL — module `@/lib/avatar/types` does not exist.

- [ ] **Step 3: Write types and Zod schemas**

```typescript
// lib/avatar/types.ts
import { z } from "zod";
import type { ChatTurn } from "@/lib/ai/claude";

export type AvatarMode = "sparring" | "pushback" | "collaborative";
export type Cohort = "surat" | "darshan" | "pyaas";
export type Speaker = "student" | "avatar";

export interface AvatarTurn {
  speaker: Speaker;
  text: string;
  timestampMs: number;
  durationMs: number;
}

export interface InlineScore {
  criterion: string;
  score: number;
  rationale: string;
  turnIndex: number;
}

export interface RoundScore {
  round: number;
  argumentation: { claim: number; link: number; impact: number; weighing: number };
  engagement: { breadth: number; depth: number; responsive: number; crystallizing: number };
  rationales: Record<string, string>;
  focusArea: string;
  focusTip: string;
}

export interface AvatarSession {
  id: string;
  mode: AvatarMode;
  motionId: string;
  motionText: string;
  cohort: Cohort;
  studentSide: "for" | "against";
  avatarSide: "for" | "against";
  transcript: AvatarTurn[];
  inlineScores: InlineScore[];
  roundScores: RoundScore[];
  phase: "collaborative" | "debate" | "review";
  currentRound: number;
  totalRounds: number;
  startedAt: number;
  endedAt: number | null;
}

export interface ModeConfig {
  turnDurationSec: number;
  wordLimit: number;
  rounds: number;
  prepPauseSec: number;
  scaffoldingLevel: "high" | "medium" | "low";
}

export interface TurnResult {
  avatarShouldRespond: boolean;
  shouldScore: boolean;
  scoreCriteria?: ("argumentation" | "engagement")[];
  scoreSlice?: [number, number];
  roundComplete?: boolean;
  phaseTransition?: AvatarSession["phase"];
  sessionComplete?: boolean;
}

const scoreField = z.number().int().min(0).max(3);

export const InlineScoreSchema = z.object({
  criterion: z.string().min(1),
  score: scoreField,
  rationale: z.string().min(1),
});

export const RoundScoreSchema = z.object({
  argumentation: z.object({
    claim: scoreField,
    link: scoreField,
    impact: scoreField,
    weighing: scoreField,
  }),
  engagement: z.object({
    breadth: scoreField,
    depth: scoreField,
    responsive: scoreField,
    crystallizing: scoreField,
  }),
  rationales: z.record(z.string(), z.string()),
  focusArea: z.string().min(1),
  focusTip: z.string().min(1),
});

export type AvatarTurnRequest = {
  mode: AvatarMode;
  phase: AvatarSession["phase"];
  motion: string;
  cohort: Cohort;
  avatarSide: "for" | "against";
  studentSide: "for" | "against";
  transcript: AvatarTurn[];
  collaborativeArgs?: string[];
};

export type AvatarScoreRequest = {
  mode: AvatarMode;
  transcript: AvatarTurn[];
  criteria: ("argumentation" | "engagement")[];
  cohort: Cohort;
};

export function transcriptToHistory(transcript: AvatarTurn[]): ChatTurn[] {
  return transcript.map((t) => ({
    role: t.speaker === "student" ? ("user" as const) : ("assistant" as const),
    content: t.text,
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/avatar/types.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing tests for cohort adapter**

```typescript
// tests/lib/avatar/cohortAdapter.test.ts
import { describe, it, expect } from "vitest";
import { getModeConfig, getCohortPromptModifiers } from "@/lib/avatar/cohortAdapter";

describe("getModeConfig", () => {
  it("returns shorter turns and higher scaffolding for Surat", () => {
    const config = getModeConfig("sparring", "surat");
    expect(config.wordLimit).toBe(80);
    expect(config.scaffoldingLevel).toBe("high");
    expect(config.turnDurationSec).toBe(60);
    expect(config.rounds).toBe(3);
  });

  it("returns longer turns and low scaffolding for Pyaas", () => {
    const config = getModeConfig("sparring", "pyaas");
    expect(config.wordLimit).toBe(150);
    expect(config.scaffoldingLevel).toBe("low");
  });

  it("returns medium scaffolding for Darshan", () => {
    const config = getModeConfig("pushback", "darshan");
    expect(config.scaffoldingLevel).toBe("medium");
  });

  it("uses shorter turns and fewer rounds for collaborative debate phase", () => {
    const config = getModeConfig("collaborative", "darshan");
    expect(config.turnDurationSec).toBe(45);
    expect(config.rounds).toBe(2);
  });
});

describe("getCohortPromptModifiers", () => {
  it("returns explicit signposting for Surat", () => {
    const mods = getCohortPromptModifiers("surat");
    expect(mods.signposting).toContain("explicit");
    expect(mods.pushbackIntensity).toContain("gentle");
  });

  it("returns sharp pushback for Pyaas", () => {
    const mods = getCohortPromptModifiers("pyaas");
    expect(mods.pushbackIntensity).toContain("sharp");
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

```bash
npx vitest run tests/lib/avatar/cohortAdapter.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 7: Implement cohort adapter**

```typescript
// lib/avatar/cohortAdapter.ts
import type { AvatarMode, Cohort, ModeConfig } from "@/lib/avatar/types";

const BASE_CONFIG: Record<AvatarMode, Omit<ModeConfig, "wordLimit" | "scaffoldingLevel">> = {
  sparring: { turnDurationSec: 60, rounds: 3, prepPauseSec: 15 },
  pushback: { turnDurationSec: 90, rounds: 1, prepPauseSec: 0 },
  collaborative: { turnDurationSec: 45, rounds: 2, prepPauseSec: 10 },
};

const COHORT_OVERRIDES: Record<Cohort, { wordLimit: number; scaffoldingLevel: ModeConfig["scaffoldingLevel"] }> = {
  surat: { wordLimit: 80, scaffoldingLevel: "high" },
  darshan: { wordLimit: 120, scaffoldingLevel: "medium" },
  pyaas: { wordLimit: 150, scaffoldingLevel: "low" },
};

export function getModeConfig(mode: AvatarMode, cohort: Cohort): ModeConfig {
  return { ...BASE_CONFIG[mode], ...COHORT_OVERRIDES[cohort] };
}

export interface CohortPromptModifiers {
  vocabulary: string;
  signposting: string;
  pushbackIntensity: string;
  scaffolding: string;
}

const MODIFIERS: Record<Cohort, CohortPromptModifiers> = {
  surat: {
    vocabulary: "Use simple, concrete language appropriate for 5th-7th graders (ages 10-12). Avoid abstract terms without explaining them.",
    signposting: "Use explicit signposting: 'My first point is...', 'The reason this matters is...', 'To sum up...'",
    pushbackIntensity: "Be gentle with challenges. Offer hints when pushing back: 'Can you tell me *why* that evidence supports your claim?'",
    scaffolding: "Use fill-in-the-blank prompts to guide brainstorming: 'My claim is that ___ because ___.'",
  },
  darshan: {
    vocabulary: "Use standard vocabulary appropriate for 8th-10th graders (ages 13-15). Define debate-specific terms briefly when first used.",
    signposting: "Use moderate signposting. Label your main points but don't over-scaffold.",
    pushbackIntensity: "Be direct with challenges. Ask pointed questions: 'What evidence supports that claim?'",
    scaffolding: "Use guided questions to shape brainstorming: 'What's the strongest reason someone would agree with this side?'",
  },
  pyaas: {
    vocabulary: "Use advanced, nuanced vocabulary appropriate for 11th-12th graders (ages 16-18). Engage as a peer.",
    signposting: "Use minimal signposting. Make arguments flow naturally without explicit labels.",
    pushbackIntensity: "Be sharp with challenges. Expect evidence and reasoning: 'That's an assertion, not evidence — what's the mechanism?'",
    scaffolding: "Brainstorm as peers: 'What angle hasn't been explored yet?' or 'How would you preempt the strongest counter?'",
  },
};

export function getCohortPromptModifiers(cohort: Cohort): CohortPromptModifiers {
  return MODIFIERS[cohort];
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run tests/lib/avatar/cohortAdapter.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/avatar/types.ts lib/avatar/cohortAdapter.ts tests/lib/avatar/types.test.ts tests/lib/avatar/cohortAdapter.test.ts
git commit -m "feat(avatar): add types, Zod schemas, and cohort adapter"
```

---

### Task 2: Prompt Builders

**Files:**
- Create: `lib/avatar/avatarPrompt.ts`
- Create: `tests/lib/avatar/avatarPrompt.test.ts`

**Interfaces:**
- Consumes: `AvatarTurnRequest`, `AvatarMode`, `Cohort` from `lib/avatar/types.ts`; `getCohortPromptModifiers` from `lib/avatar/cohortAdapter.ts`
- Produces: `buildAvatarPrompt(req: AvatarTurnRequest): { system: string; user: string }` — used by the `/api/avatar/turn` route (Task 4)

- [ ] **Step 1: Write failing tests for prompt builders**

```typescript
// tests/lib/avatar/avatarPrompt.test.ts
import { describe, it, expect } from "vitest";
import { buildAvatarPrompt } from "@/lib/avatar/avatarPrompt";
import type { AvatarTurnRequest } from "@/lib/avatar/types";

const BASE_REQ: AvatarTurnRequest = {
  mode: "sparring",
  phase: "debate",
  motion: "This House would ban homework",
  cohort: "darshan",
  avatarSide: "against",
  studentSide: "for",
  transcript: [],
};

describe("buildAvatarPrompt", () => {
  it("includes the motion and side assignment in the system prompt", () => {
    const { system } = buildAvatarPrompt(BASE_REQ);
    expect(system).toContain("This House would ban homework");
    expect(system).toContain("AGAINST");
  });

  it("includes CLI framework reminder", () => {
    const { system } = buildAvatarPrompt(BASE_REQ);
    expect(system).toContain("Claim");
    expect(system).toContain("Link");
    expect(system).toContain("Impact");
  });

  it("includes cohort-appropriate vocabulary guidance", () => {
    const { system } = buildAvatarPrompt({ ...BASE_REQ, cohort: "surat" });
    expect(system).toContain("simple, concrete");
  });

  it("uses sparring-specific instructions for Mode A", () => {
    const { system } = buildAvatarPrompt(BASE_REQ);
    expect(system).toContain("structured debate");
    expect(system).not.toContain("Socratic");
  });

  it("uses pushback-specific instructions for Mode B", () => {
    const { system } = buildAvatarPrompt({ ...BASE_REQ, mode: "pushback" });
    expect(system).toContain("Socratic");
  });

  it("uses collaborative instructions for Mode C Phase 1", () => {
    const { system } = buildAvatarPrompt({
      ...BASE_REQ,
      mode: "collaborative",
      phase: "collaborative",
    });
    expect(system).toContain("same side");
    expect(system).toContain("brainstorm");
  });

  it("uses adversarial instructions for Mode C Phase 2", () => {
    const { system } = buildAvatarPrompt({
      ...BASE_REQ,
      mode: "collaborative",
      phase: "debate",
      collaborativeArgs: ["Homework causes stress"],
    });
    expect(system).toContain("argue against");
    expect(system).toContain("Homework causes stress");
  });

  it("includes transcript in user prompt", () => {
    const req: AvatarTurnRequest = {
      ...BASE_REQ,
      transcript: [
        { speaker: "student", text: "Homework builds discipline.", timestampMs: 0, durationMs: 5000 },
      ],
    };
    const { user } = buildAvatarPrompt(req);
    expect(user).toContain("Homework builds discipline.");
  });

  it("includes word limit from cohort config", () => {
    const { system } = buildAvatarPrompt({ ...BASE_REQ, cohort: "pyaas" });
    expect(system).toContain("150");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/avatar/avatarPrompt.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement prompt builders**

```typescript
// lib/avatar/avatarPrompt.ts
import type { AvatarTurnRequest } from "@/lib/avatar/types";
import { getCohortPromptModifiers } from "@/lib/avatar/cohortAdapter";
import { getModeConfig } from "@/lib/avatar/cohortAdapter";

const MODE_INSTRUCTIONS: Record<string, string> = {
  sparring: [
    "This is a structured debate. You and the student take alternating turns.",
    "Make real arguments using the Claim → Link → Impact framework. Model good argument structure.",
    "Do not deliberately lose or weaken your arguments.",
    "Reference and rebut the student's previous points when possible.",
  ].join("\n"),
  pushback: [
    "You are a Socratic coach stress-testing the student's argument.",
    "Challenge the weakest part of their Claim, Link, or Impact.",
    "Name which CLI step you are probing (e.g., 'Your claim is clear, but the link is missing').",
    "If they strengthen it, acknowledge the improvement and move to the next weak point.",
    "If they don't, escalate with a sharper question.",
  ].join("\n"),
  "collaborative:collaborative": [
    "You and the student are on the same side, brainstorming arguments together.",
    "Guide them through building complete arguments: strongest claim → supporting evidence → link → impact.",
    "Be warm and collaborative. Build on their ideas rather than replacing them.",
    "Help them develop 2-3 complete Claim → Link → Impact arguments before transitioning to the debate phase.",
  ].join("\n"),
  "collaborative:debate": [
    "You now argue against the student. Switch to the opposing side.",
    "Use your knowledge of their case from the brainstorm phase to mount targeted counter-arguments.",
    "Target the specific weaknesses you noticed during collaboration.",
  ].join("\n"),
};

function getModeKey(mode: string, phase: string): string {
  if (mode === "collaborative") return `collaborative:${phase}`;
  return mode;
}

export function buildAvatarPrompt(req: AvatarTurnRequest): { system: string; user: string } {
  const mods = getCohortPromptModifiers(req.cohort);
  const config = getModeConfig(req.mode, req.cohort);
  const modeKey = getModeKey(req.mode, req.phase);
  const instructions = MODE_INSTRUCTIONS[modeKey] ?? MODE_INSTRUCTIONS[req.mode];

  const systemLines: string[] = [
    `You are a debate training partner for youth debaters.`,
    `The motion is: "${req.motion}"`,
    `You are arguing ${req.avatarSide.toUpperCase()}.`,
    `The student is arguing ${req.studentSide.toUpperCase()}.`,
    "",
    instructions,
    "",
    `Keep your responses under ${config.wordLimit} words.`,
    "",
    mods.vocabulary,
    mods.signposting,
    req.mode === "pushback" ? mods.pushbackIntensity : "",
    req.mode === "collaborative" && req.phase === "collaborative" ? mods.scaffolding : "",
    "",
    "Framework: arguments follow Claim → Link → Impact.",
    "- Claim: an argument in favor of your side",
    "- Link: evidence + reasoning connecting claim to impact",
    "- Impact: why the argument matters beyond the debate",
  ];

  if (req.mode === "collaborative" && req.phase === "debate" && req.collaborativeArgs?.length) {
    systemLines.push(
      "",
      "Arguments the student built during collaboration (target these weaknesses):",
      ...req.collaborativeArgs.map((a, i) => `${i + 1}. ${a}`),
    );
  }

  const userLines: string[] = [];
  if (req.transcript.length > 0) {
    const last = req.transcript[req.transcript.length - 1];
    userLines.push(`The student said: "${last.text}"`);
    userLines.push("");
    userLines.push("Respond in character. Do not include any JSON or metadata — just your spoken response.");
  } else {
    userLines.push("You are opening the debate. Make your first argument.");
    userLines.push("");
    userLines.push("Respond in character. Do not include any JSON or metadata — just your spoken response.");
  }

  return {
    system: systemLines.filter((l) => l !== undefined).join("\n"),
    user: userLines.join("\n"),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/avatar/avatarPrompt.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/avatar/avatarPrompt.ts tests/lib/avatar/avatarPrompt.test.ts
git commit -m "feat(avatar): add prompt builders for all modes and cohorts"
```

---

### Task 3: Scoring Engine

**Files:**
- Create: `lib/avatar/avatarScoring.ts`
- Create: `tests/lib/avatar/avatarScoring.test.ts`

**Interfaces:**
- Consumes: `AvatarScoreRequest`, `AvatarTurn`, `InlineScoreSchema`, `RoundScoreSchema`, `InlineScore`, `RoundScore` from `lib/avatar/types.ts`; `ChatClient` from `lib/ai/claude.ts`
- Produces:
  - `scoreRound(req: AvatarScoreRequest, client: ChatClient): Promise<RoundScore>` — used by `/api/avatar/score` (Task 4) for Mode A
  - `scoreInline(req: AvatarScoreRequest, client: ChatClient): Promise<InlineScore>` — used by `/api/avatar/score` (Task 4) for Modes B/C
  - `pickFocusArea(score: RoundScore): { focusArea: string; focusTip: string }` — selects the lowest sub-criterion

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/avatar/avatarScoring.test.ts
import { describe, it, expect, vi } from "vitest";
import { scoreRound, scoreInline, pickFocusArea } from "@/lib/avatar/avatarScoring";
import type { ChatClient } from "@/lib/ai/claude";
import type { AvatarScoreRequest, AvatarTurn, RoundScore } from "@/lib/avatar/types";

function mockClient(response: string): ChatClient {
  return { complete: vi.fn(async () => response) };
}

const SAMPLE_TRANSCRIPT: AvatarTurn[] = [
  { speaker: "student", text: "Homework should be banned because it causes stress.", timestampMs: 0, durationMs: 5000 },
  { speaker: "avatar", text: "But doesn't practice reinforce learning?", timestampMs: 5000, durationMs: 4000 },
  { speaker: "student", text: "Studies show diminishing returns after 30 minutes.", timestampMs: 9000, durationMs: 6000 },
];

const VALID_ROUND_RESPONSE = JSON.stringify({
  argumentation: { claim: 2, link: 1, impact: 2, weighing: 1 },
  engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
  rationales: {
    claim: "Clear position stated.",
    link: "Evidence mentioned but not connected.",
    impact: "Some real-world relevance.",
    weighing: "No comparison attempted.",
    breadth: "Two angles covered.",
    depth: "One point developed.",
    responsive: "Directly addressed the challenge.",
    crystallizing: "No synthesis.",
  },
  focusArea: "weighing",
  focusTip: "Paint a picture of what happens if your side wins vs. loses.",
});

const VALID_INLINE_RESPONSE = JSON.stringify({
  criterion: "Link",
  score: 1,
  rationale: "Evidence mentioned but reasoning gap remains.",
});

describe("scoreRound", () => {
  it("returns a validated RoundScore from the AI response", async () => {
    const client = mockClient(VALID_ROUND_RESPONSE);
    const req: AvatarScoreRequest = {
      mode: "sparring",
      transcript: SAMPLE_TRANSCRIPT,
      criteria: ["argumentation", "engagement"],
      cohort: "darshan",
    };
    const result = await scoreRound(req, client);
    expect(result.argumentation.claim).toBe(2);
    expect(result.focusArea).toBe("weighing");
    expect(client.complete).toHaveBeenCalledOnce();
  });

  it("throws on invalid AI response", async () => {
    const client = mockClient('{"bad": "data"}');
    const req: AvatarScoreRequest = {
      mode: "sparring",
      transcript: SAMPLE_TRANSCRIPT,
      criteria: ["argumentation", "engagement"],
      cohort: "darshan",
    };
    await expect(scoreRound(req, client)).rejects.toThrow();
  });
});

describe("scoreInline", () => {
  it("returns a validated InlineScore", async () => {
    const client = mockClient(VALID_INLINE_RESPONSE);
    const req: AvatarScoreRequest = {
      mode: "pushback",
      transcript: SAMPLE_TRANSCRIPT.slice(0, 2),
      criteria: ["argumentation"],
      cohort: "darshan",
    };
    const result = await scoreInline(req, client);
    expect(result.criterion).toBe("Link");
    expect(result.score).toBe(1);
  });
});

describe("pickFocusArea", () => {
  it("picks the sub-criterion with the lowest score", () => {
    const score: Omit<RoundScore, "round" | "focusArea" | "focusTip"> = {
      argumentation: { claim: 3, link: 2, impact: 3, weighing: 0 },
      engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
      rationales: {},
    };
    const { focusArea } = pickFocusArea(score as RoundScore);
    expect(focusArea).toBe("weighing");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/avatar/avatarScoring.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement scoring engine**

```typescript
// lib/avatar/avatarScoring.ts
import { InlineScoreSchema, RoundScoreSchema } from "@/lib/avatar/types";
import type { AvatarScoreRequest, InlineScore, RoundScore, AvatarTurn } from "@/lib/avatar/types";
import type { ChatClient } from "@/lib/ai/claude";

function renderTranscript(transcript: AvatarTurn[]): string {
  return transcript
    .map((t) => `${t.speaker === "student" ? "Student" : "Avatar"}: ${t.text}`)
    .join("\n");
}

const ROUND_SYSTEM = [
  "You are a debate scoring system. Score the STUDENT's performance only (not the avatar's).",
  "",
  "Argumentation sub-criteria (each /3):",
  "- claim: Is the argument clear, specific, and arguable?",
  "- link: Does evidence + reasoning connect claim to impact?",
  "- impact: Does the argument explain why it matters beyond the debate?",
  "- weighing: Does the student paint a picture of what the world looks like if their side wins?",
  "",
  "Engagement sub-criteria (each /3):",
  "- breadth: Does the student address multiple angles?",
  "- depth: Does the student develop points beyond surface level?",
  "- responsive: Does the student engage with the opponent's arguments?",
  "- crystallizing: Does the student synthesize and clarify the core clash?",
  "",
  "Scoring guide: 0 = absent, 1 = attempted, 2 = competent, 3 = strong.",
  "",
  "Respond ONLY as JSON matching this structure:",
  '{"argumentation":{"claim":N,"link":N,"impact":N,"weighing":N},',
  '"engagement":{"breadth":N,"depth":N,"responsive":N,"crystallizing":N},',
  '"rationales":{"claim":"...","link":"...","impact":"...","weighing":"...","breadth":"...","depth":"...","responsive":"...","crystallizing":"..."},',
  '"focusArea":"<key of lowest score>",',
  '"focusTip":"<one concrete sentence of advice>"}',
].join("\n");

const INLINE_SYSTEM = [
  "You are a debate scoring system. Evaluate the student's most recent response.",
  "Identify the single most relevant Argumentation criterion (claim, link, impact, or weighing) and score it /3.",
  "Scoring guide: 0 = absent, 1 = attempted, 2 = competent, 3 = strong.",
  "",
  'Respond ONLY as JSON: {"criterion":"<name>","score":N,"rationale":"<one sentence>"}',
].join("\n");

export async function scoreRound(req: AvatarScoreRequest, client: ChatClient): Promise<RoundScore> {
  const user = `Score this student's debate performance:\n\n${renderTranscript(req.transcript)}`;
  const raw = await client.complete({ system: ROUND_SYSTEM, user });
  const parsed = JSON.parse(raw);
  return RoundScoreSchema.parse(parsed);
}

export async function scoreInline(req: AvatarScoreRequest, client: ChatClient): Promise<InlineScore> {
  const user = `Score the student's response in this exchange:\n\n${renderTranscript(req.transcript)}`;
  const raw = await client.complete({ system: INLINE_SYSTEM, user });
  const parsed = JSON.parse(raw);
  const validated = InlineScoreSchema.parse(parsed);
  return { ...validated, turnIndex: req.transcript.length - 1 };
}

export function pickFocusArea(score: RoundScore): { focusArea: string; focusTip: string } {
  const all: [string, number][] = [
    ...Object.entries(score.argumentation),
    ...Object.entries(score.engagement),
  ];
  all.sort((a, b) => a[1] - b[1]);
  const focusArea = all[0][0];
  return { focusArea, focusTip: score.focusTip ?? "" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/avatar/avatarScoring.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/avatar/avatarScoring.ts tests/lib/avatar/avatarScoring.test.ts
git commit -m "feat(avatar): add scoring engine with round and inline modes"
```

---

### Task 4: API Routes

**Files:**
- Create: `app/api/avatar/turn/route.ts`
- Create: `app/api/avatar/score/route.ts`
- Create: `tests/app/avatar/turn.test.ts`
- Create: `tests/app/avatar/score.test.ts`

**Interfaces:**
- Consumes: `buildAvatarPrompt` from `lib/avatar/avatarPrompt.ts`; `scoreRound`, `scoreInline` from `lib/avatar/avatarScoring.ts`; `getChatClient` from `lib/ai/claude.ts`; `AvatarTurnRequest`, `AvatarScoreRequest` from `lib/avatar/types.ts`
- Produces:
  - `POST /api/avatar/turn` — receives `AvatarTurnRequest`, returns `{ text: string }`
  - `POST /api/avatar/score` — receives `AvatarScoreRequest & { scoreType: "round" | "inline" }`, returns `RoundScore | InlineScore`

- [ ] **Step 1: Write failing tests for turn route**

```typescript
// tests/app/avatar/turn.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/claude", () => ({
  getChatClient: () => ({
    complete: vi.fn(async () => "Homework reinforces learning through repetition."),
  }),
}));

import { POST } from "@/app/api/avatar/turn/route";

describe("POST /api/avatar/turn", () => {
  it("returns avatar response text", async () => {
    const body = {
      mode: "sparring",
      phase: "debate",
      motion: "This House would ban homework",
      cohort: "darshan",
      avatarSide: "against",
      studentSide: "for",
      transcript: [],
    };
    const res = await POST(new Request("http://localhost/api/avatar/turn", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.text).toBe("Homework reinforces learning through repetition.");
  });

  it("returns 400 for invalid body", async () => {
    const res = await POST(new Request("http://localhost/api/avatar/turn", {
      method: "POST",
      body: "not json",
    }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/app/avatar/turn.test.ts
```

Expected: FAIL — route does not exist.

- [ ] **Step 3: Implement turn route**

```typescript
// app/api/avatar/turn/route.ts
import { getChatClient } from "@/lib/ai/claude";
import { buildAvatarPrompt } from "@/lib/avatar/avatarPrompt";
import { transcriptToHistory } from "@/lib/avatar/types";
import type { AvatarTurnRequest } from "@/lib/avatar/types";

export async function POST(req: Request): Promise<Response> {
  let body: AvatarTurnRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.mode || !body.motion || !body.cohort) {
    return Response.json({ error: "missing required fields" }, { status: 400 });
  }

  try {
    const { system, user } = buildAvatarPrompt(body);
    const history = transcriptToHistory(body.transcript ?? []);
    const client = getChatClient({ json: false });
    const text = await client.complete({ system, user, history });
    return Response.json({ text }, { status: 200 });
  } catch {
    return Response.json({ error: "avatar turn failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/app/avatar/turn.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing test for score route**

```typescript
// tests/app/avatar/score.test.ts
import { describe, it, expect, vi } from "vitest";

const ROUND_RESPONSE = JSON.stringify({
  argumentation: { claim: 2, link: 1, impact: 2, weighing: 1 },
  engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
  rationales: { claim: "ok", link: "ok", impact: "ok", weighing: "ok", breadth: "ok", depth: "ok", responsive: "ok", crystallizing: "ok" },
  focusArea: "weighing",
  focusTip: "Compare worlds.",
});

vi.mock("@/lib/ai/claude", () => ({
  getChatClient: () => ({
    complete: vi.fn(async () => ROUND_RESPONSE),
  }),
}));

import { POST } from "@/app/api/avatar/score/route";

describe("POST /api/avatar/score", () => {
  it("returns a round score", async () => {
    const body = {
      scoreType: "round",
      mode: "sparring",
      transcript: [
        { speaker: "student", text: "Ban homework.", timestampMs: 0, durationMs: 3000 },
      ],
      criteria: ["argumentation", "engagement"],
      cohort: "darshan",
    };
    const res = await POST(new Request("http://localhost/api/avatar/score", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.argumentation.claim).toBe(2);
    expect(data.focusArea).toBe("weighing");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx vitest run tests/app/avatar/score.test.ts
```

Expected: FAIL — route does not exist.

- [ ] **Step 7: Implement score route**

```typescript
// app/api/avatar/score/route.ts
import { getChatClient } from "@/lib/ai/claude";
import { scoreRound, scoreInline } from "@/lib/avatar/avatarScoring";
import type { AvatarScoreRequest } from "@/lib/avatar/types";

export async function POST(req: Request): Promise<Response> {
  let body: AvatarScoreRequest & { scoreType: "round" | "inline" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.scoreType || !body.transcript?.length) {
    return Response.json({ error: "missing required fields" }, { status: 400 });
  }

  try {
    const client = getChatClient();
    if (body.scoreType === "round") {
      const result = await scoreRound(body, client);
      return Response.json(result, { status: 200 });
    }
    const result = await scoreInline(body, client);
    return Response.json(result, { status: 200 });
  } catch {
    return Response.json({ error: "scoring failed" }, { status: 500 });
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npx vitest run tests/app/avatar/turn.test.ts tests/app/avatar/score.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add app/api/avatar/turn/route.ts app/api/avatar/score/route.ts tests/app/avatar/turn.test.ts tests/app/avatar/score.test.ts
git commit -m "feat(avatar): add turn and score API routes"
```

---

### Task 5: Sparring Orchestrator (Mode A)

**Files:**
- Create: `lib/avatar/orchestrators/sparringOrch.ts`
- Create: `tests/lib/avatar/sparringOrch.test.ts`

**Interfaces:**
- Consumes: `AvatarSession`, `AvatarTurn`, `TurnResult`, `ModeConfig` from `lib/avatar/types.ts`; `getModeConfig` from `lib/avatar/cohortAdapter.ts`
- Produces:
  - `initSparring(motion: string, motionId: string, cohort: Cohort, studentSide: "for" | "against"): AvatarSession`
  - `sparringNextTurn(session: AvatarSession): TurnResult` — called after each student turn to determine what happens next
  - `sparringAdvanceRound(session: AvatarSession): AvatarSession` — advances to next round after scoring
  - Used by `AvatarShell.tsx` (Task 9)

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/avatar/sparringOrch.test.ts
import { describe, it, expect } from "vitest";
import { initSparring, sparringNextTurn, sparringAdvanceRound } from "@/lib/avatar/orchestrators/sparringOrch";

describe("initSparring", () => {
  it("creates a session with correct initial state", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    expect(session.mode).toBe("sparring");
    expect(session.studentSide).toBe("for");
    expect(session.avatarSide).toBe("against");
    expect(session.currentRound).toBe(1);
    expect(session.totalRounds).toBe(3);
    expect(session.phase).toBe("debate");
    expect(session.transcript).toHaveLength(0);
  });
});

describe("sparringNextTurn", () => {
  it("avatar responds after the first student turn", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Homework causes stress.", timestampMs: 0, durationMs: 5000 },
    );
    const result = sparringNextTurn(session);
    expect(result.avatarShouldRespond).toBe(true);
    expect(result.shouldScore).toBe(false);
  });

  it("triggers round scoring after 3 exchange pairs", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    for (let i = 0; i < 6; i++) {
      session.transcript.push({
        speaker: i % 2 === 0 ? "student" : "avatar",
        text: `Turn ${i + 1}`,
        timestampMs: i * 5000,
        durationMs: 5000,
      });
    }
    const result = sparringNextTurn(session);
    expect(result.roundComplete).toBe(true);
    expect(result.shouldScore).toBe(true);
    expect(result.scoreCriteria).toContain("argumentation");
    expect(result.scoreCriteria).toContain("engagement");
  });

  it("signals session complete after final round", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    session.currentRound = 3;
    for (let i = 0; i < 6; i++) {
      session.transcript.push({
        speaker: i % 2 === 0 ? "student" : "avatar",
        text: `Turn ${i + 1}`,
        timestampMs: i * 5000,
        durationMs: 5000,
      });
    }
    const result = sparringNextTurn(session);
    expect(result.roundComplete).toBe(true);
    expect(result.sessionComplete).toBe(true);
  });
});

describe("sparringAdvanceRound", () => {
  it("increments the round counter", () => {
    const session = initSparring("Ban homework", "m-homework", "darshan", "for");
    const advanced = sparringAdvanceRound(session);
    expect(advanced.currentRound).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/avatar/sparringOrch.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement sparring orchestrator**

```typescript
// lib/avatar/orchestrators/sparringOrch.ts
import type { AvatarSession, TurnResult, Cohort } from "@/lib/avatar/types";
import { getModeConfig } from "@/lib/avatar/cohortAdapter";

const EXCHANGES_PER_ROUND = 3;

export function initSparring(
  motion: string,
  motionId: string,
  cohort: Cohort,
  studentSide: "for" | "against",
): AvatarSession & { avatarOpens: boolean } {
  const config = getModeConfig("sparring", cohort);
  return {
    id: "",
    mode: "sparring",
    motionId,
    motionText: motion,
    cohort,
    studentSide,
    avatarSide: studentSide === "for" ? "against" : "for",
    transcript: [],
    inlineScores: [],
    roundScores: [],
    phase: "debate",
    currentRound: 1,
    totalRounds: config.rounds,
    startedAt: 0,
    endedAt: null,
    avatarOpens: Math.random() < 0.5,
  };
}

function countRoundExchanges(session: AvatarSession): number {
  const roundStart = roundStartIndex(session);
  const roundTurns = session.transcript.slice(roundStart);
  return Math.floor(roundTurns.length / 2);
}

function roundStartIndex(session: AvatarSession): number {
  const turnsPerRound = EXCHANGES_PER_ROUND * 2;
  return (session.currentRound - 1) * turnsPerRound;
}

export function sparringNextTurn(session: AvatarSession): TurnResult {
  const exchanges = countRoundExchanges(session);
  const roundDone = exchanges >= EXCHANGES_PER_ROUND;

  if (roundDone) {
    const start = roundStartIndex(session);
    return {
      avatarShouldRespond: false,
      shouldScore: true,
      scoreCriteria: ["argumentation", "engagement"],
      scoreSlice: [start, session.transcript.length],
      roundComplete: true,
      sessionComplete: session.currentRound >= session.totalRounds,
    };
  }

  return {
    avatarShouldRespond: true,
    shouldScore: false,
  };
}

export function sparringAdvanceRound(session: AvatarSession): AvatarSession {
  return { ...session, currentRound: session.currentRound + 1 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/avatar/sparringOrch.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/avatar/orchestrators/sparringOrch.ts tests/lib/avatar/sparringOrch.test.ts
git commit -m "feat(avatar): add sparring orchestrator (Mode A)"
```

---

### Task 6: Pushback Orchestrator (Mode B)

**Files:**
- Create: `lib/avatar/orchestrators/pushbackOrch.ts`
- Create: `tests/lib/avatar/pushbackOrch.test.ts`

**Interfaces:**
- Consumes: `AvatarSession`, `TurnResult`, `Cohort` from `lib/avatar/types.ts`
- Produces:
  - `initPushback(motion: string, motionId: string, cohort: Cohort, studentSide: "for" | "against"): AvatarSession`
  - `pushbackNextTurn(session: AvatarSession): TurnResult` — always avatar responds + inline score after each exchange pair
  - Used by `AvatarShell.tsx` (Task 9)

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/avatar/pushbackOrch.test.ts
import { describe, it, expect } from "vitest";
import { initPushback, pushbackNextTurn } from "@/lib/avatar/orchestrators/pushbackOrch";

describe("initPushback", () => {
  it("creates a pushback session", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    expect(session.mode).toBe("pushback");
    expect(session.phase).toBe("debate");
    expect(session.totalRounds).toBe(1);
  });
});

describe("pushbackNextTurn", () => {
  it("avatar responds and scores after first student turn", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Homework causes stress.", timestampMs: 0, durationMs: 5000 },
    );
    const result = pushbackNextTurn(session);
    expect(result.avatarShouldRespond).toBe(true);
    expect(result.shouldScore).toBe(true);
    expect(result.scoreCriteria).toContain("argumentation");
    expect(result.scoreCriteria).not.toContain("engagement");
  });

  it("scores after each student response to a challenge", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Homework causes stress.", timestampMs: 0, durationMs: 5000 },
      { speaker: "avatar", text: "What evidence?", timestampMs: 5000, durationMs: 3000 },
      { speaker: "student", text: "A study found 56% report stress.", timestampMs: 8000, durationMs: 6000 },
    );
    const result = pushbackNextTurn(session);
    expect(result.shouldScore).toBe(true);
    expect(result.avatarShouldRespond).toBe(true);
  });

  it("never signals session complete on its own — student exits manually", () => {
    const session = initPushback("Ban homework", "m-homework", "darshan", "for");
    for (let i = 0; i < 20; i++) {
      session.transcript.push({
        speaker: i % 2 === 0 ? "student" : "avatar",
        text: `Turn ${i}`,
        timestampMs: i * 3000,
        durationMs: 3000,
      });
    }
    const result = pushbackNextTurn(session);
    expect(result.sessionComplete).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/avatar/pushbackOrch.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement pushback orchestrator**

```typescript
// lib/avatar/orchestrators/pushbackOrch.ts
import type { AvatarSession, TurnResult, Cohort } from "@/lib/avatar/types";

export function initPushback(
  motion: string,
  motionId: string,
  cohort: Cohort,
  studentSide: "for" | "against",
): AvatarSession {
  return {
    id: "",
    mode: "pushback",
    motionId,
    motionText: motion,
    cohort,
    studentSide,
    avatarSide: studentSide === "for" ? "against" : "for",
    transcript: [],
    inlineScores: [],
    roundScores: [],
    phase: "debate",
    currentRound: 1,
    totalRounds: 1,
    startedAt: 0,
    endedAt: null,
  };
}

export function pushbackNextTurn(session: AvatarSession): TurnResult {
  const lastTurn = session.transcript[session.transcript.length - 1];
  const studentJustSpoke = lastTurn?.speaker === "student";

  if (!studentJustSpoke) {
    return { avatarShouldRespond: false, shouldScore: false };
  }

  const lastTwoStudentTurns = session.transcript
    .filter((t) => t.speaker === "student")
    .slice(-1);

  return {
    avatarShouldRespond: true,
    shouldScore: true,
    scoreCriteria: ["argumentation"],
    scoreSlice: [Math.max(0, session.transcript.length - 3), session.transcript.length],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/avatar/pushbackOrch.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/avatar/orchestrators/pushbackOrch.ts tests/lib/avatar/pushbackOrch.test.ts
git commit -m "feat(avatar): add pushback orchestrator (Mode B)"
```

---

### Task 7: Collaborative Orchestrator (Mode C)

**Files:**
- Create: `lib/avatar/orchestrators/collaborativeOrch.ts`
- Create: `tests/lib/avatar/collaborativeOrch.test.ts`

**Interfaces:**
- Consumes: `AvatarSession`, `TurnResult`, `Cohort` from `lib/avatar/types.ts`; `getModeConfig` from `lib/avatar/cohortAdapter.ts`
- Produces:
  - `initCollaborative(motion: string, motionId: string, cohort: Cohort, studentSide: "for" | "against"): AvatarSession`
  - `collaborativeNextTurn(session: AvatarSession): TurnResult` — manages Phase 1 → Phase 2 transition + scoring
  - `collaborativeTransition(session: AvatarSession): AvatarSession` — transitions from Phase 1 to Phase 2
  - `getCollaborativeArgs(session: AvatarSession): string[]` — extracts the arguments built during Phase 1
  - Used by `AvatarShell.tsx` (Task 9)

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/avatar/collaborativeOrch.test.ts
import { describe, it, expect } from "vitest";
import {
  initCollaborative,
  collaborativeNextTurn,
  collaborativeTransition,
  getCollaborativeArgs,
} from "@/lib/avatar/orchestrators/collaborativeOrch";

describe("initCollaborative", () => {
  it("starts in the collaborative phase", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    expect(session.mode).toBe("collaborative");
    expect(session.phase).toBe("collaborative");
    expect(session.avatarSide).toBe("for");
  });
});

describe("collaborativeNextTurn — Phase 1", () => {
  it("avatar responds but does not score in collaborative phase", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Kids need rest.", timestampMs: 0, durationMs: 4000 },
    );
    const result = collaborativeNextTurn(session);
    expect(result.avatarShouldRespond).toBe(true);
    expect(result.shouldScore).toBe(false);
  });
});

describe("collaborativeTransition", () => {
  it("switches to debate phase and flips avatar side", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Kids need rest.", timestampMs: 0, durationMs: 4000 },
      { speaker: "avatar", text: "Great claim! What evidence?", timestampMs: 4000, durationMs: 3000 },
    );
    const transitioned = collaborativeTransition(session);
    expect(transitioned.phase).toBe("debate");
    expect(transitioned.avatarSide).toBe("against");
    expect(transitioned.currentRound).toBe(1);
  });
});

describe("collaborativeNextTurn — Phase 2 (debate)", () => {
  it("scores engagement after each exchange in debate phase", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    const debateSession = collaborativeTransition(session);
    debateSession.transcript.push(
      { speaker: "student", text: "Kids need rest.", timestampMs: 0, durationMs: 4000 },
      { speaker: "avatar", text: "But practice matters.", timestampMs: 4000, durationMs: 3000 },
      { speaker: "student", text: "Studies show burnout.", timestampMs: 7000, durationMs: 5000 },
    );
    const result = collaborativeNextTurn(debateSession);
    expect(result.shouldScore).toBe(true);
    expect(result.scoreCriteria).toContain("engagement");
  });

  it("signals session complete after 2 rounds of debate", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    const debateSession = collaborativeTransition(session);
    debateSession.currentRound = 2;
    for (let i = 0; i < 4; i++) {
      debateSession.transcript.push({
        speaker: i % 2 === 0 ? "student" : "avatar",
        text: `Turn ${i}`,
        timestampMs: i * 4000,
        durationMs: 4000,
      });
    }
    const result = collaborativeNextTurn(debateSession);
    expect(result.roundComplete).toBe(true);
    expect(result.sessionComplete).toBe(true);
  });
});

describe("getCollaborativeArgs", () => {
  it("extracts student turns from Phase 1 as argument summaries", () => {
    const session = initCollaborative("Ban homework", "m-homework", "darshan", "for");
    session.transcript.push(
      { speaker: "student", text: "Kids need rest.", timestampMs: 0, durationMs: 4000 },
      { speaker: "avatar", text: "Good! Evidence?", timestampMs: 4000, durationMs: 3000 },
      { speaker: "student", text: "Studies show burnout after 2 hours.", timestampMs: 7000, durationMs: 5000 },
    );
    const args = getCollaborativeArgs(session);
    expect(args).toContain("Kids need rest.");
    expect(args).toContain("Studies show burnout after 2 hours.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/avatar/collaborativeOrch.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement collaborative orchestrator**

```typescript
// lib/avatar/orchestrators/collaborativeOrch.ts
import type { AvatarSession, TurnResult, Cohort } from "@/lib/avatar/types";
import { getModeConfig } from "@/lib/avatar/cohortAdapter";

const DEBATE_EXCHANGES_PER_ROUND = 2;

export function initCollaborative(
  motion: string,
  motionId: string,
  cohort: Cohort,
  studentSide: "for" | "against",
): AvatarSession {
  const config = getModeConfig("collaborative", cohort);
  return {
    id: "",
    mode: "collaborative",
    motionId,
    motionText: motion,
    cohort,
    studentSide,
    avatarSide: studentSide,
    transcript: [],
    inlineScores: [],
    roundScores: [],
    phase: "collaborative",
    currentRound: 1,
    totalRounds: config.rounds,
    startedAt: 0,
    endedAt: null,
  };
}

export function collaborativeTransition(session: AvatarSession): AvatarSession {
  return {
    ...session,
    phase: "debate",
    avatarSide: session.studentSide === "for" ? "against" : "for",
    currentRound: 1,
  };
}

export function getCollaborativeArgs(session: AvatarSession): string[] {
  return session.transcript
    .filter((t) => t.speaker === "student")
    .map((t) => t.text);
}

export function collaborativeNextTurn(session: AvatarSession): TurnResult {
  if (session.phase === "collaborative") {
    return {
      avatarShouldRespond: true,
      shouldScore: false,
    };
  }

  const lastTurn = session.transcript[session.transcript.length - 1];
  if (lastTurn?.speaker !== "student") {
    return { avatarShouldRespond: false, shouldScore: false };
  }

  const debateTurns = session.transcript.filter(
    (t) => session.phase === "debate"
  );
  const exchanges = Math.floor(debateTurns.length / 2);
  const roundDone = exchanges >= DEBATE_EXCHANGES_PER_ROUND;

  if (roundDone) {
    return {
      avatarShouldRespond: false,
      shouldScore: true,
      scoreCriteria: ["engagement"],
      scoreSlice: [Math.max(0, session.transcript.length - DEBATE_EXCHANGES_PER_ROUND * 2), session.transcript.length],
      roundComplete: true,
      sessionComplete: session.currentRound >= session.totalRounds,
    };
  }

  return {
    avatarShouldRespond: true,
    shouldScore: true,
    scoreCriteria: ["engagement"],
    scoreSlice: [Math.max(0, session.transcript.length - 2), session.transcript.length],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/avatar/collaborativeOrch.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/avatar/orchestrators/collaborativeOrch.ts tests/lib/avatar/collaborativeOrch.test.ts
git commit -m "feat(avatar): add collaborative orchestrator (Mode C)"
```

---

### Task 8: Session Persistence

**Files:**
- Create: `lib/state/avatarSession.ts`
- Create: `tests/lib/state/avatarSession.test.ts`

**Interfaces:**
- Consumes: `AvatarSession` from `lib/avatar/types.ts`
- Produces:
  - `AVATAR_STORAGE_KEY = "constructive:avatar:v1"`
  - `saveAvatarSession(storage: Storage, session: AvatarSession): void`
  - `loadAvatarSession(storage: Storage, id: string): AvatarSession | null`
  - `listAvatarSessions(storage: Storage): Array<{ id: string; mode: AvatarMode; motionText: string; startedAt: number }>`
  - Used by `AvatarShell.tsx` (Task 9) for persisting and resuming sessions

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/state/avatarSession.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  AVATAR_STORAGE_KEY,
  saveAvatarSession,
  loadAvatarSession,
  listAvatarSessions,
} from "@/lib/state/avatarSession";
import type { AvatarSession } from "@/lib/avatar/types";

const SAMPLE_SESSION: AvatarSession = {
  id: "test-1",
  mode: "sparring",
  motionId: "m-homework",
  motionText: "Ban homework",
  cohort: "darshan",
  studentSide: "for",
  avatarSide: "against",
  transcript: [],
  inlineScores: [],
  roundScores: [],
  phase: "debate",
  currentRound: 1,
  totalRounds: 3,
  startedAt: 1000,
  endedAt: null,
};

beforeEach(() => localStorage.clear());

describe("saveAvatarSession / loadAvatarSession", () => {
  it("round-trips a session through localStorage", () => {
    saveAvatarSession(localStorage, SAMPLE_SESSION);
    const loaded = loadAvatarSession(localStorage, "test-1");
    expect(loaded).toEqual(SAMPLE_SESSION);
  });

  it("returns null for a missing session", () => {
    expect(loadAvatarSession(localStorage, "nonexistent")).toBeNull();
  });

  it("overwrites an existing session with the same id", () => {
    saveAvatarSession(localStorage, SAMPLE_SESSION);
    const updated = { ...SAMPLE_SESSION, currentRound: 2 };
    saveAvatarSession(localStorage, updated);
    const loaded = loadAvatarSession(localStorage, "test-1");
    expect(loaded?.currentRound).toBe(2);
  });
});

describe("listAvatarSessions", () => {
  it("returns summaries sorted by startedAt descending", () => {
    saveAvatarSession(localStorage, { ...SAMPLE_SESSION, id: "a", startedAt: 100 });
    saveAvatarSession(localStorage, { ...SAMPLE_SESSION, id: "b", startedAt: 200 });
    const list = listAvatarSessions(localStorage);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("b");
    expect(list[1].id).toBe("a");
  });

  it("returns empty array when nothing is saved", () => {
    expect(listAvatarSessions(localStorage)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/state/avatarSession.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement session persistence**

```typescript
// lib/state/avatarSession.ts
import type { AvatarSession, AvatarMode } from "@/lib/avatar/types";

export const AVATAR_STORAGE_KEY = "constructive:avatar:v1";

function readAll(storage: Storage): Record<string, AvatarSession> {
  const raw = storage.getItem(AVATAR_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, AvatarSession>;
  } catch {
    return {};
  }
}

export function saveAvatarSession(storage: Storage, session: AvatarSession): void {
  const all = readAll(storage);
  all[session.id] = session;
  storage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(all));
}

export function loadAvatarSession(storage: Storage, id: string): AvatarSession | null {
  return readAll(storage)[id] ?? null;
}

export function listAvatarSessions(
  storage: Storage,
): Array<{ id: string; mode: AvatarMode; motionText: string; startedAt: number }> {
  const all = readAll(storage);
  return Object.values(all)
    .map((s) => ({ id: s.id, mode: s.mode, motionText: s.motionText, startedAt: s.startedAt }))
    .sort((a, b) => b.startedAt - a.startedAt);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/state/avatarSession.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/state/avatarSession.ts tests/lib/state/avatarSession.test.ts
git commit -m "feat(avatar): add session persistence to localStorage"
```

---

### Task 9: UI — AvatarShell and Mode Selection

**Files:**
- Create: `components/avatar/ModeCard.tsx`
- Create: `components/avatar/AvatarShell.tsx`
- Create: `tests/components/AvatarShell.test.tsx`

**Interfaces:**
- Consumes: `AvatarMode`, `Cohort`, `AvatarSession` from `lib/avatar/types.ts`; `getFlowMotions` from `lib/flowMotions.ts`; `initSparring` from `lib/avatar/orchestrators/sparringOrch.ts`; `initPushback` from `lib/avatar/orchestrators/pushbackOrch.ts`; `initCollaborative` from `lib/avatar/orchestrators/collaborativeOrch.ts`; `saveAvatarSession` from `lib/state/avatarSession.ts`
- Produces: `AvatarShell` component (used by `FlowDeck.tsx` in Task 12); `ModeCard` presentational component

- [ ] **Step 1: Write failing tests**

```typescript
// tests/components/AvatarShell.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarShell } from "@/components/avatar/AvatarShell";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ text: "Avatar response." }), { status: 200 })));
});

describe("AvatarShell", () => {
  it("renders the three mode cards", () => {
    render(<AvatarShell onExit={() => {}} />);
    expect(screen.getByRole("button", { name: /sparring/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pushback/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /build.*debate/i })).toBeInTheDocument();
  });

  it("shows motion picker after selecting a mode", async () => {
    render(<AvatarShell onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /sparring/i }));
    expect(screen.getByText(/pick a motion/i)).toBeInTheDocument();
  });

  it("shows side picker after selecting a motion in sparring mode", async () => {
    render(<AvatarShell onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /sparring/i }));
    const motionButtons = screen.getAllByRole("button", { name: /This House/ });
    await userEvent.click(motionButtons[0]);
    expect(screen.getByText(/which side/i)).toBeInTheDocument();
  });

  it("calls onExit when exit button is clicked from mode selection", async () => {
    const onExit = vi.fn();
    render(<AvatarShell onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: /exit|back/i }));
    expect(onExit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/AvatarShell.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create ModeCard component**

```tsx
// components/avatar/ModeCard.tsx
"use client";
import { cn } from "@/lib/utils";
import { Pressable } from "@/components/ui/motion";

interface ModeCardProps {
  title: string;
  description: string;
  index: number;
  onClick: () => void;
}

export function ModeCard({ title, description, index, onClick }: ModeCardProps) {
  return (
    <Pressable
      index={index}
      type="button"
      onClick={onClick}
      aria-label={title}
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm",
        "transition-[border-color,box-shadow] hover:border-primary hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div className="font-display text-lg font-semibold text-foreground">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-auto pt-4 text-sm font-semibold text-primary">Start →</div>
    </Pressable>
  );
}
```

- [ ] **Step 4: Create AvatarShell component**

```tsx
// components/avatar/AvatarShell.tsx
"use client";
import { useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { Button } from "@/components/ui/button";
import { ModeCard } from "@/components/avatar/ModeCard";
import { getFlowMotions } from "@/lib/flowMotions";
import { initSparring } from "@/lib/avatar/orchestrators/sparringOrch";
import { initPushback } from "@/lib/avatar/orchestrators/pushbackOrch";
import { initCollaborative } from "@/lib/avatar/orchestrators/collaborativeOrch";
import { saveAvatarSession } from "@/lib/state/avatarSession";
import type { AvatarMode, AvatarSession } from "@/lib/avatar/types";
import type { FlowMotion } from "@/lib/schemas";
import type { Side } from "@/lib/state/flowMachine";
import { TranscriptPane } from "@/components/avatar/TranscriptPane";
import { AvatarVoiceBar } from "@/components/avatar/AvatarVoiceBar";
import { ScoreCard } from "@/components/avatar/ScoreCard";

const MODES: { mode: AvatarMode; title: string; description: string }[] = [
  { mode: "sparring", title: "Sparring", description: "Debate an opponent. Get scored after each round." },
  { mode: "pushback", title: "Pushback Coach", description: "Stress-test your argument claim by claim." },
  { mode: "collaborative", title: "Build + Debate", description: "Brainstorm together, then face off." },
];

type Step = "mode" | "motion" | "side" | "session" | "transition" | "review";

export function AvatarShell({ onExit }: { onExit: () => void }) {
  const motions = getFlowMotions();
  const [step, setStep] = useState<Step>("mode");
  const [selectedMode, setSelectedMode] = useState<AvatarMode | null>(null);
  const [selectedMotion, setSelectedMotion] = useState<FlowMotion | null>(null);
  const [session, setSession] = useState<AvatarSession | null>(null);

  function selectMode(mode: AvatarMode) {
    setSelectedMode(mode);
    setStep("motion");
  }

  function selectMotion(m: FlowMotion) {
    setSelectedMotion(m);
    if (selectedMode === "collaborative") {
      startSession(m, "for");
    } else {
      setStep("side");
    }
  }

  function startSession(m: FlowMotion, side: Side) {
    const cohort = "darshan"; // TODO: read from user settings
    const id = crypto.randomUUID();
    let sess: AvatarSession;
    switch (selectedMode) {
      case "sparring":
        sess = initSparring(m.motion, m.id, cohort, side);
        break;
      case "pushback":
        sess = initPushback(m.motion, m.id, cohort, side);
        break;
      case "collaborative":
        sess = initCollaborative(m.motion, m.id, cohort, side);
        break;
      default:
        return;
    }
    sess.id = id;
    sess.startedAt = Date.now();
    saveAvatarSession(window.localStorage, sess);
    setSession(sess);
    setStep("session");
  }

  if (step === "mode") {
    return (
      <AppShell>
        <Button variant="ghost" className="mb-4 text-muted-foreground" onClick={onExit}>← Back</Button>
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">Debate Avatar</div>
        <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">Choose your mode</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {MODES.map((m, i) => (
            <ModeCard key={m.mode} title={m.title} description={m.description} index={i} onClick={() => selectMode(m.mode)} />
          ))}
        </div>
      </AppShell>
    );
  }

  if (step === "motion") {
    return (
      <AppShell>
        <Button variant="ghost" className="mb-4 text-muted-foreground" onClick={() => setStep("mode")}>← Back</Button>
        <h2 className="font-display text-2xl font-semibold text-foreground">Pick a motion</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {motions.map((m) => (
            <Button key={m.id} variant="outline" className="h-auto whitespace-normal p-4 text-left" onClick={() => selectMotion(m)}>
              {m.motion}
            </Button>
          ))}
        </div>
      </AppShell>
    );
  }

  if (step === "side" && selectedMotion) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-10 text-center">
          <h2 className="font-display text-2xl font-semibold text-foreground">{selectedMotion.motion}</h2>
          <p className="mt-3 text-sm text-muted-foreground">Which side do you want to argue?</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => startSession(selectedMotion, "for")}>Argue FOR</Button>
            <Button onClick={() => startSession(selectedMotion, "against")}>Argue AGAINST</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (step === "transition" && session?.mode === "collaborative") {
    // Mode C phase transition interstitial
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-16 text-center">
          <h2 className="font-display text-2xl font-semibold text-foreground">Ready to debate?</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            The avatar will now argue against you using what you built together.
          </p>
          <Button className="mt-6" onClick={() => {
            const transitioned = collaborativeTransition(session);
            setSession(transitioned);
            saveAvatarSession(window.localStorage, transitioned);
            setStep("session");
          }}>
            Let's go →
          </Button>
        </div>
      </AppShell>
    );
  }

  if (step === "session" && session) {
    return (
      <AppShell>
        <div className="flex items-center justify-between border-b border-border pb-3">
          <Button variant="ghost" size="sm" onClick={() => { setSession(null); setStep("mode"); }}>← Exit</Button>
          <div className="text-sm font-medium text-foreground">
            {MODES.find((m) => m.mode === session.mode)?.title}
            {session.mode === "sparring" && ` · R${session.currentRound}/${session.totalRounds}`}
            {session.mode === "collaborative" && ` · ${session.phase === "collaborative" ? "Building" : "Debating"}`}
          </div>
          <div />
        </div>
        <TranscriptPane transcript={session.transcript} inlineScores={session.inlineScores} />
        <AvatarVoiceBar
          session={session}
          onStudentTurn={(text) => {
            // Wired in Task 12 integration
          }}
        />
      </AppShell>
    );
  }

  return null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/components/AvatarShell.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/avatar/ModeCard.tsx components/avatar/AvatarShell.tsx tests/components/AvatarShell.test.tsx
git commit -m "feat(avatar): add AvatarShell with mode and motion selection"
```

---

### Task 10: UI — TranscriptPane and AvatarVoiceBar

**Files:**
- Create: `components/avatar/TranscriptPane.tsx`
- Create: `components/avatar/AvatarVoiceBar.tsx`
- Create: `tests/components/TranscriptPane.test.tsx`

**Interfaces:**
- Consumes: `AvatarTurn`, `InlineScore`, `AvatarSession` from `lib/avatar/types.ts`; `/api/transcribe/live` and `/api/speak` existing endpoints for STT/TTS
- Produces:
  - `TranscriptPane({ transcript, inlineScores })` — renders the scrolling conversation view with inline score badges
  - `AvatarVoiceBar({ session, onStudentTurn, disabled })` — hold-to-talk + text input + TTS playback; calls `onStudentTurn(text)` when the student finishes speaking

- [ ] **Step 1: Write failing tests for TranscriptPane**

```typescript
// tests/components/TranscriptPane.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptPane } from "@/components/avatar/TranscriptPane";
import type { AvatarTurn, InlineScore } from "@/lib/avatar/types";

const TRANSCRIPT: AvatarTurn[] = [
  { speaker: "student", text: "Homework should be banned.", timestampMs: 0, durationMs: 5000 },
  { speaker: "avatar", text: "But practice is important.", timestampMs: 5000, durationMs: 4000 },
];

describe("TranscriptPane", () => {
  it("renders each turn with speaker label", () => {
    render(<TranscriptPane transcript={TRANSCRIPT} inlineScores={[]} />);
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Avatar")).toBeInTheDocument();
    expect(screen.getByText("Homework should be banned.")).toBeInTheDocument();
    expect(screen.getByText("But practice is important.")).toBeInTheDocument();
  });

  it("renders inline score badges", () => {
    const scores: InlineScore[] = [
      { criterion: "Link", score: 2, rationale: "Solid connection.", turnIndex: 0 },
    ];
    render(<TranscriptPane transcript={TRANSCRIPT} inlineScores={scores} />);
    expect(screen.getByText(/Link.*2/)).toBeInTheDocument();
  });

  it("renders empty state when no transcript", () => {
    render(<TranscriptPane transcript={[]} inlineScores={[]} />);
    expect(screen.getByText(/start speaking/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/TranscriptPane.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement TranscriptPane**

```tsx
// components/avatar/TranscriptPane.tsx
"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { AvatarTurn, InlineScore } from "@/lib/avatar/types";

export function TranscriptPane({
  transcript,
  inlineScores,
}: {
  transcript: AvatarTurn[];
  inlineScores: InlineScore[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript.length]);

  if (transcript.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
        Start speaking to begin the debate.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto py-4">
      {transcript.map((turn, i) => {
        const isStudent = turn.speaker === "student";
        const badge = inlineScores.find((s) => s.turnIndex === i);
        return (
          <div key={i}>
            <div
              className={cn(
                "rounded-lg px-4 py-3",
                isStudent ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-blue-50 dark:bg-blue-950/30",
              )}
            >
              <div className="text-xs font-semibold text-muted-foreground">
                {isStudent ? "You" : "Avatar"}
              </div>
              <p className="mt-1 text-sm text-foreground">{turn.text}</p>
            </div>
            {badge && (
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {badge.criterion} {badge.score}/3
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 4: Implement AvatarVoiceBar**

The voice bar follows the same hold-to-talk pattern as `components/VoiceOrTextInput.tsx` but adds: a countdown timer display, avatar speaking state (TTS in progress → mic disabled), and a text fallback input. The implementation reuses the same `/api/transcribe/live` and `/api/speak` endpoints.

```tsx
// components/avatar/AvatarVoiceBar.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { pickRecorderMimeType } from "@/lib/voice/deepgramLive";
import { speakCoach } from "@/lib/voice/playSpeech";
import type { AvatarSession } from "@/lib/avatar/types";
import { getModeConfig } from "@/lib/avatar/cohortAdapter";

type BarStatus = "idle" | "listening" | "transcribing" | "avatar-speaking";

function voiceSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function AvatarVoiceBar({
  session,
  onStudentTurn,
  disabled = false,
}: {
  session: AvatarSession;
  onStudentTurn: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<BarStatus>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [timerSec, setTimerSec] = useState<number | null>(null);

  const config = getModeConfig(session.mode, session.cohort);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const holdingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    let remaining = config.turnDurationSec;
    setTimerSec(remaining);
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimerSec(remaining);
      if (remaining <= 0) stopListening();
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerSec(null);
  }

  async function startListening() {
    if (holdingRef.current || disabled || status !== "idle") return;
    holdingRef.current = true;
    setVoiceError(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      holdingRef.current = false;
      setVoiceError("Microphone access blocked — type your answer instead.");
      return;
    }
    if (!holdingRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const startRes = await fetch("/api/transcribe/live?action=start", { method: "POST" }).catch(() => null);
    if (startRes?.ok) {
      const { sessionId } = await startRes.json();
      sessionIdRef.current = sessionId ?? null;
    }

    const mimeType = pickRecorderMimeType();
    const rec = new MediaRecorder(stream, { mimeType });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size <= 0) return;
      chunksRef.current.push(e.data);
      const sid = sessionIdRef.current;
      if (sid) {
        void fetch(`/api/transcribe/live?sessionId=${encodeURIComponent(sid)}`, {
          method: "POST",
          headers: { "content-type": e.data.type || "audio/webm" },
          body: e.data,
        }).then(async (res) => {
          if (!res.ok) return;
          const { text: liveText } = await res.json();
          if (liveText) setText(liveText);
        }).catch(() => {});
      }
    };
    rec.start(150);
    setStatus("listening");
    startTimer();
  }

  async function stopListening() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    stopTimer();
    setStatus("transcribing");

    const rec = recorderRef.current;
    const stream = streamRef.current;
    recorderRef.current = null;
    streamRef.current = null;

    await new Promise<void>((resolve) => {
      if (!rec || rec.state === "inactive") { resolve(); return; }
      rec.onstop = () => resolve();
      rec.stop();
    });
    stream?.getTracks().forEach((t) => t.stop());

    let finalText = text.trim();
    const sid = sessionIdRef.current;
    sessionIdRef.current = null;
    if (sid) {
      try {
        const res = await fetch(`/api/transcribe/live?action=stop&sessionId=${encodeURIComponent(sid)}`, { method: "POST" });
        if (res.ok) {
          const { text: live } = await res.json();
          if (live?.trim()) finalText = live.trim();
        }
      } catch {}
    }

    if (!finalText && chunksRef.current.length > 0) {
      try {
        const blob = new Blob(chunksRef.current, { type: pickRecorderMimeType() });
        const res = await fetch("/api/transcribe", { method: "POST", headers: { "content-type": blob.type }, body: blob });
        if (res.ok) {
          const { text: t } = await res.json();
          if (t?.trim()) finalText = t.trim();
        }
      } catch {}
    }

    if (finalText) {
      setText("");
      setStatus("idle");
      onStudentTurn(finalText);
    } else {
      setVoiceError("Didn't catch that — hold the mic and speak again.");
      setStatus("idle");
    }
  }

  function handleTextSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    onStudentTurn(trimmed);
  }

  const micDisabled = disabled || status === "transcribing" || status === "avatar-speaking";

  return (
    <div className="border-t border-border pt-3">
      {timerSec !== null && (
        <div className="mb-2 text-center text-xs text-muted-foreground">
          {Math.floor(timerSec / 60)}:{String(timerSec % 60).padStart(2, "0")}
        </div>
      )}
      <div className="flex items-center gap-2.5">
        {voiceSupported() && (
          <Button
            type="button"
            variant="secondary"
            disabled={micDisabled}
            aria-pressed={status === "listening"}
            onPointerDown={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
              void startListening();
            }}
            onPointerUp={() => void stopListening()}
            onPointerCancel={() => { if (holdingRef.current) void stopListening(); }}
            style={{ touchAction: "none" }}
          >
            🎤 {status === "listening" ? "Listening…" : status === "transcribing" ? "Transcribing…" : "Hold to speak"}
          </Button>
        )}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
          placeholder="or type your response…"
          disabled={disabled || status === "avatar-speaking"}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <Button type="button" disabled={!text.trim() || disabled} onClick={handleTextSubmit}>
          Send
        </Button>
      </div>
      {voiceError && <p className="mt-2 text-sm text-muted-foreground">{voiceError}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/components/TranscriptPane.test.tsx
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/avatar/TranscriptPane.tsx components/avatar/AvatarVoiceBar.tsx tests/components/TranscriptPane.test.tsx
git commit -m "feat(avatar): add TranscriptPane and AvatarVoiceBar components"
```

---

### Task 11: UI — ScoreCard

**Files:**
- Create: `components/avatar/ScoreCard.tsx`
- Create: `tests/components/ScoreCard.test.tsx`

**Interfaces:**
- Consumes: `RoundScore`, `InlineScore` from `lib/avatar/types.ts`
- Produces: `ScoreCard({ mode, roundScores, onContinue, onEnd })` component — renders post-round overlay for Mode A, and is also the end-of-session summary view for all modes

- [ ] **Step 1: Write failing tests**

```typescript
// tests/components/ScoreCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreCard } from "@/components/avatar/ScoreCard";
import type { RoundScore } from "@/lib/avatar/types";

const SAMPLE_SCORE: RoundScore = {
  round: 1,
  argumentation: { claim: 2, link: 1, impact: 3, weighing: 0 },
  engagement: { breadth: 2, depth: 2, responsive: 3, crystallizing: 1 },
  rationales: {
    claim: "Clear.", link: "Weak.", impact: "Strong.", weighing: "Missing.",
    breadth: "Good range.", depth: "OK.", responsive: "Engaged.", crystallizing: "Absent.",
  },
  focusArea: "weighing",
  focusTip: "Paint a picture of what the world looks like if your side wins.",
};

describe("ScoreCard", () => {
  it("renders the rubric grid with scores", () => {
    render(<ScoreCard mode="sparring" roundScores={[SAMPLE_SCORE]} onContinue={() => {}} onEnd={() => {}} />);
    expect(screen.getByText("Claim")).toBeInTheDocument();
    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("Weighing")).toBeInTheDocument();
  });

  it("highlights the focus area", () => {
    render(<ScoreCard mode="sparring" roundScores={[SAMPLE_SCORE]} onContinue={() => {}} onEnd={() => {}} />);
    expect(screen.getByText(/weighing/i)).toBeInTheDocument();
    expect(screen.getByText(/paint a picture/i)).toBeInTheDocument();
  });

  it("shows Continue button when there are more rounds", async () => {
    const onContinue = vi.fn();
    render(<ScoreCard mode="sparring" roundScores={[SAMPLE_SCORE]} onContinue={onContinue} onEnd={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /next round/i }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("shows End button", async () => {
    const onEnd = vi.fn();
    render(<ScoreCard mode="sparring" roundScores={[SAMPLE_SCORE]} onContinue={() => {}} onEnd={onEnd} />);
    await userEvent.click(screen.getByRole("button", { name: /end session/i }));
    expect(onEnd).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/components/ScoreCard.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement ScoreCard**

```tsx
// components/avatar/ScoreCard.tsx
"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AvatarMode, RoundScore } from "@/lib/avatar/types";

const CRITERIA_LABELS: Record<string, string> = {
  claim: "Claim",
  link: "Link",
  impact: "Impact",
  weighing: "Weighing",
  breadth: "Breadth",
  depth: "Depth",
  responsive: "Responsive",
  crystallizing: "Crystallizing",
};

function ScoreCell({ label, score, isFocus, rationale }: { label: string; score: number; isFocus: boolean; rationale?: string }) {
  return (
    <div className={cn("rounded-lg border p-3", isFocus ? "border-primary bg-primary/5" : "border-border")}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={cn("text-sm font-semibold", score >= 2 ? "text-emerald-600" : score === 1 ? "text-amber-600" : "text-red-500")}>
          {score}/3
        </span>
      </div>
      {rationale && <p className="mt-1 text-xs text-muted-foreground">{rationale}</p>}
    </div>
  );
}

export function ScoreCard({
  mode,
  roundScores,
  onContinue,
  onEnd,
}: {
  mode: AvatarMode;
  roundScores: RoundScore[];
  onContinue: () => void;
  onEnd: () => void;
}) {
  const latest = roundScores[roundScores.length - 1];
  if (!latest) return null;

  const argEntries = Object.entries(latest.argumentation) as [string, number][];
  const engEntries = Object.entries(latest.engagement) as [string, number][];

  return (
    <div className="space-y-6 py-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Round {latest.round} Score
        </h3>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">Argumentation</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {argEntries.map(([key, score]) => (
            <ScoreCell
              key={key}
              label={CRITERIA_LABELS[key] ?? key}
              score={score}
              isFocus={key === latest.focusArea}
              rationale={latest.rationales[key]}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">Engagement</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {engEntries.map(([key, score]) => (
            <ScoreCell
              key={key}
              label={CRITERIA_LABELS[key] ?? key}
              score={score}
              isFocus={key === latest.focusArea}
              rationale={latest.rationales[key]}
            />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-primary bg-primary/5 p-4">
        <div className="text-sm font-semibold text-foreground">Focus for next time: {CRITERIA_LABELS[latest.focusArea] ?? latest.focusArea}</div>
        <p className="mt-1 text-sm text-muted-foreground">{latest.focusTip}</p>
      </div>

      <div className="flex gap-3">
        <Button onClick={onContinue}>Next round →</Button>
        <Button variant="outline" onClick={onEnd}>End session</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/components/ScoreCard.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/avatar/ScoreCard.tsx tests/components/ScoreCard.test.tsx
git commit -m "feat(avatar): add ScoreCard component with rubric grid"
```

---

### Task 12: FlowDeck Integration and Session Wiring

**Files:**
- Modify: `components/FlowDeck.tsx` — add Avatar entry card that opens `AvatarShell`
- Modify: `components/avatar/AvatarShell.tsx` — wire orchestrator turn loop (student input → API → scoring → state update → TTS)
- Modify: `tests/components/FlowDeck.test.tsx` — add test for Avatar entry card
- Create: `tests/components/AvatarSession.integration.test.tsx` — end-to-end test for one mode with mocked AI

**Interfaces:**
- Consumes: everything from Tasks 1-11
- Produces: complete working feature accessible from the home page

- [ ] **Step 1: Write failing test for Avatar entry on FlowDeck**

Add to the existing `tests/components/FlowDeck.test.tsx`:

```typescript
it("renders a Debate Avatar entry card", () => {
  render(<FlowDeck />);
  expect(screen.getByRole("button", { name: /debate avatar/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/components/FlowDeck.test.tsx -t "renders a Debate Avatar"
```

Expected: FAIL — no such button exists.

- [ ] **Step 3: Add Avatar entry card to FlowDeck**

In `components/FlowDeck.tsx`, add a new state and render condition. After the import block, add:

```typescript
import { AvatarShell } from "@/components/avatar/AvatarShell";
```

Add state in the `FlowDeck` component:

```typescript
const [showAvatar, setShowAvatar] = useState(false);
```

Add render branch after the `showLesson` check:

```typescript
if (showAvatar) return <AvatarShell onExit={() => setShowAvatar(false)} />;
```

Add the entry card in the home page JSX, between `<UniverseGenerator>` and `<PracticeDeck>`:

```tsx
<section className="mt-12">
  <div className="text-xs font-semibold uppercase tracking-wide text-primary">Step 3 · Spar with an AI</div>
  <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">Debate Avatar</h2>
  <p className="mt-2 text-sm text-muted-foreground">
    Practice debating against an AI opponent. Choose your mode: structured sparring, pushback coaching, or collaborative build + debate.
  </p>
  <Button type="button" variant="outline" className="mt-3" onClick={() => setShowAvatar(true)}>
    Debate Avatar →
  </Button>
</section>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/components/FlowDeck.test.tsx -t "renders a Debate Avatar"
```

Expected: PASS

- [ ] **Step 5: Wire the session turn loop in AvatarShell**

Update `AvatarShell.tsx` to handle the full turn cycle. When `onStudentTurn` is called from `AvatarVoiceBar`:

1. Add student turn to transcript
2. Call orchestrator's `nextTurn` to get `TurnResult`
3. If `avatarShouldRespond`: call `POST /api/avatar/turn` for avatar response, add to transcript, play via `speakCoach`
4. If `shouldScore`: call `POST /api/avatar/score`, add score to session
5. If `roundComplete` or `sessionComplete`: show ScoreCard
6. Save session to localStorage after each state change

Replace the placeholder `onStudentTurn` callback in the session render branch with the full implementation. This involves adding async handlers that call `fetch('/api/avatar/turn', ...)` and `fetch('/api/avatar/score', ...)`, update the session state via `setSession`, and call `saveAvatarSession`.

The key function to add:

```typescript
async function handleStudentTurn(studentText: string) {
  if (!session) return;

  const studentTurn: AvatarTurn = {
    speaker: "student",
    text: studentText,
    timestampMs: Date.now() - session.startedAt,
    durationMs: 0,
  };

  const updated = { ...session, transcript: [...session.transcript, studentTurn] };
  setSession(updated);
  saveAvatarSession(window.localStorage, updated);

  // Get orchestrator decision
  let result: TurnResult;
  switch (session.mode) {
    case "sparring": result = sparringNextTurn(updated); break;
    case "pushback": result = pushbackNextTurn(updated); break;
    case "collaborative": result = collaborativeNextTurn(updated); break;
  }

  // Avatar responds
  if (result.avatarShouldRespond) {
    const turnReq: AvatarTurnRequest = {
      mode: updated.mode,
      phase: updated.phase,
      motion: updated.motionText,
      cohort: updated.cohort,
      avatarSide: updated.avatarSide,
      studentSide: updated.studentSide,
      transcript: updated.transcript,
      collaborativeArgs: updated.mode === "collaborative" ? getCollaborativeArgs(updated) : undefined,
    };
    const res = await fetch("/api/avatar/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(turnReq),
    });
    if (res.ok) {
      const { text: avatarText } = await res.json();
      const avatarTurn: AvatarTurn = {
        speaker: "avatar",
        text: avatarText,
        timestampMs: Date.now() - session.startedAt,
        durationMs: 0,
      };
      updated.transcript = [...updated.transcript, avatarTurn];
      setSession({ ...updated });
      saveAvatarSession(window.localStorage, { ...updated });
      void speakCoach(avatarText);
    }
  }

  // Score
  if (result.shouldScore && result.scoreSlice) {
    const scoreReq = {
      scoreType: result.scoreCriteria?.includes("engagement") && !result.scoreCriteria?.includes("argumentation")
        ? "inline" : result.roundComplete ? "round" : "inline",
      mode: updated.mode,
      transcript: updated.transcript.slice(result.scoreSlice[0], result.scoreSlice[1]),
      criteria: result.scoreCriteria ?? [],
      cohort: updated.cohort,
    };
    const res = await fetch("/api/avatar/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(scoreReq),
    });
    if (res.ok) {
      const scoreData = await res.json();
      if (scoreReq.scoreType === "round") {
        updated.roundScores = [...updated.roundScores, { ...scoreData, round: updated.currentRound }];
      } else {
        updated.inlineScores = [...updated.inlineScores, { ...scoreData, turnIndex: updated.transcript.length - 1 }];
      }
      setSession({ ...updated });
      saveAvatarSession(window.localStorage, { ...updated });
    }
  }

  // State transitions
  if (result.roundComplete) {
    setStep("review");
  }
  if (result.sessionComplete) {
    updated.endedAt = Date.now();
    setSession({ ...updated });
    saveAvatarSession(window.localStorage, { ...updated });
  }
}
```

- [ ] **Step 6: Write integration test for sparring mode**

```typescript
// tests/components/AvatarSession.integration.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarShell } from "@/components/avatar/AvatarShell";

beforeEach(() => {
  localStorage.clear();
  let callCount = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (typeof url === "string" && url.includes("/api/avatar/turn")) {
      callCount++;
      return new Response(JSON.stringify({ text: `Avatar response ${callCount}.` }), { status: 200 });
    }
    if (typeof url === "string" && url.includes("/api/avatar/score")) {
      return new Response(JSON.stringify({
        argumentation: { claim: 2, link: 2, impact: 2, weighing: 1 },
        engagement: { breadth: 2, depth: 2, responsive: 2, crystallizing: 1 },
        rationales: { claim: "ok", link: "ok", impact: "ok", weighing: "ok", breadth: "ok", depth: "ok", responsive: "ok", crystallizing: "ok" },
        focusArea: "weighing",
        focusTip: "Compare worlds.",
      }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }));
});

describe("Avatar sparring integration", () => {
  it("navigates from mode selection to a debate session", async () => {
    render(<AvatarShell onExit={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /sparring/i }));
    expect(screen.getByText(/pick a motion/i)).toBeInTheDocument();
    const motionButtons = screen.getAllByRole("button", { name: /This House/ });
    await userEvent.click(motionButtons[0]);
    expect(screen.getByText(/which side/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /argue for/i }));
    expect(screen.getByText(/start speaking/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run all tests**

```bash
npx vitest run tests/components/AvatarShell.test.tsx tests/components/AvatarSession.integration.test.tsx tests/components/FlowDeck.test.tsx
```

Expected: PASS

- [ ] **Step 8: Run the dev server and verify in the browser**

```bash
npm run dev -- -p 3005
```

Open `http://localhost:3005`. Verify:
1. The "Debate Avatar" button appears on the home page
2. Clicking it opens mode selection with three cards
3. Selecting Sparring → picking a motion → choosing a side → lands on the session view
4. The transcript pane and voice bar render correctly
5. Text input works (type a response, press Send)

- [ ] **Step 9: Commit**

```bash
git add components/FlowDeck.tsx components/avatar/AvatarShell.tsx tests/components/FlowDeck.test.tsx tests/components/AvatarSession.integration.test.tsx
git commit -m "feat(avatar): wire FlowDeck entry and session turn loop"
```

- [ ] **Step 10: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass, no regressions.

- [ ] **Step 11: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix(avatar): test fixups from full suite run"
```
