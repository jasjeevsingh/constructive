# In-App Beta Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the outbound feedback link with an in-app form that writes to Supabase, auto-attaching the tester's page state.

**Architecture:** Four tasks. A pure context collector and a server insert route are independent; the panel consumes both; the shell swap comes last. The Supabase client is created only server-side, inside the handler, so the service-role key never reaches the browser and a missing env var cannot crash the build.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, React 18, Tailwind + owned shadcn primitives, Vitest + React Testing Library, Zod, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-08-17-constructive-in-app-feedback-design.md`

## Global Constraints

- Baseline to preserve: **309 tests / 67 files green**. Never finish a task with a red suite.
- `npx tsc --noEmit` must stay clean; `npm run build` must succeed.
- Run a single file with `npx vitest run <path>`; the suite with `npm test`.
- Import via the `@/` path alias. Test style: flat `describe`/`it`, `render`/`screen` from `@testing-library/react`, `userEvent`. No snapshot tests.
- **`SUPABASE_SERVICE_ROLE_KEY` must never reach the browser.** It may be referenced only inside `app/api/**`. Never import `@supabase/supabase-js` from a `"use client"` file.
- **Never construct a Supabase client at module scope.** Next evaluates top-level module code at build time; a missing env var there crashes `next build`. Create it lazily inside the request handler.
- The `NEXT_PUBLIC_SUPABASE_*` vars the integration injected are deliberately unused — do not wire them up.
- Do NOT change any activity component, the voice helper, `lib/helper/**`, `lib/state/**` (read-only), `content/**`, `middleware.ts`, `components/VoiceOrTextInput.tsx`, `lib/voice/**`, `lib/ai/**`, or `app/api/coach/route.ts`.
- Commit messages use `feat:` / `fix:` prefixes, imperative mood.

### Already done on this branch (do not redo)

- `supabase/migrations/0001_feedback.sql` is **applied to the live database**. Table `public.feedback` with `id, created_at, message, context jsonb, path, user_agent`. RLS enabled, **zero policies** — verified live, so anon/authenticated cannot read or write; only `service_role` can.
- `scripts/apply-sql.mjs` — migration runner.
- `.gitignore` hardened so `.env.local` (which holds real credentials) is ignored.

---

## Task 1: Page-state collector

**Files:**
- Create: `lib/feedback/context.ts`
- Test: `tests/lib/feedback/context.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces — Task 3 depends on these exactly:
  - `type FeedbackContext = { pathname: string; flow?: Record<string, unknown>; practice?: unknown }`
  - `collectFeedbackContext(storage: Storage, pathname: string): FeedbackContext`

**This must never throw.** A tester is most likely to file feedback precisely when their stored state is broken, so corrupt JSON must degrade to an omitted field, mirroring `lib/state/flowProgress.ts`'s corruption tolerance.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { collectFeedbackContext } from "@/lib/feedback/context";

beforeEach(() => localStorage.clear());

describe("collectFeedbackContext", () => {
  it("always records the pathname", () => {
    expect(collectFeedbackContext(localStorage, "/").pathname).toBe("/");
  });

  it("includes flow progress when present", () => {
    localStorage.setItem(
      "constructive:flow:v1",
      JSON.stringify({ "m-kids-vote": { side: "against", stage: "claim", mappedClaimId: "a1" } })
    );
    const ctx = collectFeedbackContext(localStorage, "/");
    expect(ctx.flow).toEqual({
      "m-kids-vote": { side: "against", stage: "claim", mappedClaimId: "a1" },
    });
  });

  it("includes practice counts when present", () => {
    localStorage.setItem("constructive:practice:v1", JSON.stringify({ claim: 3, link: 1, impact: 0 }));
    expect(collectFeedbackContext(localStorage, "/").practice).toEqual({ claim: 3, link: 1, impact: 0 });
  });

  it("omits a corrupt entry instead of throwing", () => {
    localStorage.setItem("constructive:flow:v1", "{not json");
    let ctx!: ReturnType<typeof collectFeedbackContext>;
    expect(() => { ctx = collectFeedbackContext(localStorage, "/motions"); }).not.toThrow();
    expect(ctx.flow).toBeUndefined();
    expect(ctx.pathname).toBe("/motions");
  });

  it("omits absent stores", () => {
    const ctx = collectFeedbackContext(localStorage, "/");
    expect(ctx.flow).toBeUndefined();
    expect(ctx.practice).toBeUndefined();
  });

  it("survives a storage that throws on read", () => {
    const hostile = { getItem() { throw new Error("denied"); } } as unknown as Storage;
    expect(() => collectFeedbackContext(hostile, "/")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/feedback/context.test.ts`
Expected: FAIL — cannot resolve `@/lib/feedback/context`.

- [ ] **Step 3: Implement**

```ts
import { FLOW_STORAGE_KEY } from "@/lib/state/flowProgress";

const PRACTICE_STORAGE_KEY = "constructive:practice:v1";

export type FeedbackContext = {
  pathname: string;
  flow?: Record<string, unknown>;
  practice?: unknown;
};

/** Reads one JSON store, returning undefined for absent, unreadable, or malformed values. */
function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Snapshot of where the tester is, attached to every report. Never throws — a
 * broken store is exactly when someone is most likely to file feedback.
 */
export function collectFeedbackContext(storage: Storage, pathname: string): FeedbackContext {
  const ctx: FeedbackContext = { pathname };
  const flow = readJson(storage, FLOW_STORAGE_KEY);
  if (flow) ctx.flow = flow as Record<string, unknown>;
  const practice = readJson(storage, PRACTICE_STORAGE_KEY);
  if (practice) ctx.practice = practice;
  return ctx;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/feedback/context.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/feedback/context.ts tests/lib/feedback/context.test.ts
git commit -m "feat: collect the tester's page state for a feedback report"
```

---

## Task 2: Insert route

**Files:**
- Create: `app/api/feedback/route.ts`
- Modify: `package.json` (add `@supabase/supabase-js`)
- Test: `tests/app/api/feedback.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces — Task 3 depends on this: `POST /api/feedback` with `{ message, context?, path? }` → `204` / `400` / `503`.

- [ ] **Step 1: Install the client**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const insert = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({ insert }) }),
}));

const { POST } = await import("@/app/api/feedback/route");

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
});
afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("POST /api/feedback", () => {
  it("stores a report", async () => {
    const res = await POST(req({ message: "the claim stage went blank", path: "/" }));
    expect(res.status).toBe(204);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({ message: "the claim stage went blank" });
  });

  it("takes the user agent from the header, not the body", async () => {
    await POST(req({ message: "hi", user_agent: "SPOOFED" }, { "user-agent": "RealBrowser/1.0" }));
    const row = insert.mock.calls[0][0];
    expect(row.user_agent).toBe("RealBrowser/1.0");
    expect(JSON.stringify(row)).not.toContain("SPOOFED");
  });

  it("rejects an empty message", async () => {
    const res = await POST(req({ message: "   " }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an over-long message", async () => {
    const res = await POST(req({ message: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("503s when supabase is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(503);
    expect(insert).not.toHaveBeenCalled();
  });

  it("503s when the insert fails", async () => {
    insert.mockResolvedValue({ error: new Error("db down") });
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(503);
  });

  it("never leaks the service role key", async () => {
    const res = await POST(req({ message: "hi" }));
    const body = await res.text();
    expect(body).not.toContain("service-role-secret");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/app/api/feedback.test.ts`
Expected: FAIL — cannot resolve `@/app/api/feedback/route`.

- [ ] **Step 4: Implement**

```ts
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const FeedbackBodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  context: z.record(z.string(), z.unknown()).optional(),
  path: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  // Created per-request, never at module scope: a top-level client would be
  // constructed at build time and crash `next build` when env is absent.
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return Response.json({ error: "feedback is unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const parsed = FeedbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid feedback" }, { status: 400 });
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { error } = await supabase.from("feedback").insert({
    message: parsed.data.message,
    context: parsed.data.context ?? null,
    path: parsed.data.path ?? null,
    // Trusted from the request, never from the body.
    user_agent: request.headers.get("user-agent"),
  });

  if (error) {
    return Response.json({ error: "could not save feedback" }, { status: 503 });
  }
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/app/api/feedback.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add app/api/feedback/route.ts tests/app/api/feedback.test.ts package.json package-lock.json
git commit -m "feat: server route storing beta feedback in Supabase"
```

---

## Task 3: Feedback panel

**Files:**
- Create: `components/feedback/FeedbackPanel.tsx`
- Test: `tests/components/feedback/FeedbackPanel.test.tsx`

**Interfaces:**
- Consumes (Task 1): `collectFeedbackContext`. Consumes (Task 2): `POST /api/feedback`.
- Produces (for Task 4): `<FeedbackPanel />` (no props) and `FeedbackPanelView` (pure).

Split exactly as the voice helper is, for the same reason — the pure half is what gets tested:

- `export function FeedbackPanelView({ open, status, onOpen, onClose, onSubmit })` — no `fetch`, no `localStorage`. `status` is `"idle" | "sending" | "sent" | "error"`.
- `export function FeedbackPanel()` — reads `NEXT_PUBLIC_FEEDBACK_ENABLED`, owns `fetch` and `localStorage`, renders the view. Returns `null` when the flag is not `"1"`.

Styling matches the codebase: `Button`/`Card` primitives, `text-xs text-muted-foreground`, `border-t border-border`. No `underline` (used nowhere in this repo).

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackPanelView } from "@/components/feedback/FeedbackPanel";

const noop = () => {};

describe("FeedbackPanelView", () => {
  it("shows a collapsed trigger when closed", () => {
    render(<FeedbackPanelView open={false} status="idle" onOpen={noop} onClose={noop} onSubmit={noop} />);
    expect(screen.getByRole("button", { name: /user feedback/i })).toBeInTheDocument();
  });

  it("opens on click", async () => {
    const onOpen = vi.fn();
    render(<FeedbackPanelView open={false} status="idle" onOpen={onOpen} onClose={noop} onSubmit={noop} />);
    await userEvent.click(screen.getByRole("button", { name: /user feedback/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("cannot submit an empty report", async () => {
    const onSubmit = vi.fn();
    render(<FeedbackPanelView open status="idle" onOpen={noop} onClose={noop} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits what was typed", async () => {
    const onSubmit = vi.fn();
    render(<FeedbackPanelView open status="idle" onOpen={noop} onClose={noop} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("textbox"), "the bridge never held");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSubmit).toHaveBeenCalledWith("the bridge never held");
  });

  it("tells the tester their screen is attached", () => {
    render(<FeedbackPanelView open status="idle" onOpen={noop} onClose={noop} onSubmit={noop} />);
    expect(screen.getByText(/screen/i)).toBeInTheDocument();
  });

  it("shows each status", () => {
    for (const [status, pattern] of [
      ["sending", /sending/i],
      ["sent", /thank/i],
      ["error", /couldn't send/i],
    ] as const) {
      const { unmount } = render(
        <FeedbackPanelView open status={status} onOpen={noop} onClose={noop} onSubmit={noop} />
      );
      expect(screen.getByText(pattern)).toBeInTheDocument();
      unmount();
    }
  });

  it("keeps the typed text when sending failed", async () => {
    render(<FeedbackPanelView open status="error" onOpen={noop} onClose={noop} onSubmit={noop} />);
    await userEvent.type(screen.getByRole("textbox"), "still here");
    expect(screen.getByRole("textbox")).toHaveValue("still here");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/feedback/FeedbackPanel.test.tsx`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement the view, then the wiring**

`FeedbackPanelView` holds the textarea's own state and calls `onSubmit(text)` only when the trimmed text is non-empty. The Send button is disabled while `status === "sending"`.

`FeedbackPanel` reads `process.env.NEXT_PUBLIC_FEEDBACK_ENABLED` as a **full static expression** (never destructured — Next inlines it at build time), returns `null` unless it is `"1"`, and on submit POSTs:

```ts
await fetch("/api/feedback", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    message,
    path: window.location.pathname,
    context: collectFeedbackContext(window.localStorage, window.location.pathname),
  }),
});
```

Set `status` to `"sending"`, then `"sent"` on `res.ok` (auto-closing after a short delay) or `"error"` otherwise. Wrap the whole call in try/catch so a network failure lands in `"error"`, never an unhandled rejection.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/components/feedback/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/feedback/FeedbackPanel.tsx tests/components/feedback/FeedbackPanel.test.tsx
git commit -m "feat: in-app feedback panel"
```

---

## Task 4: Swap the outbound link for the panel

**Files:**
- Modify: `components/ui/app-shell.tsx`
- Modify: `.env.example`
- Test: `tests/components/ui/app-shell.test.tsx`

**Interfaces:**
- Consumes (Task 3): `<FeedbackPanel />`.

`AppShell` currently renders a `<footer>` gated on `NEXT_PUBLIC_FEEDBACK_URL` containing an outbound link (lines 4-5 and 15-29). Replace the whole gated block with `<FeedbackPanel />`, and delete the `feedbackUrl` constant. `AppShell` stays a server component rendering a client child — that is fine and needs no `"use client"`.

**Depends on Task 3.**

- [ ] **Step 1: Write the failing test**

Replace the two feedback-link tests in `tests/components/ui/app-shell.test.tsx` with:

```tsx
it("offers the feedback panel when enabled", () => {
  vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", "1");
  render(<AppShell><p>page body</p></AppShell>);
  expect(screen.getByRole("button", { name: /user feedback/i })).toBeInTheDocument();
});

it("renders no feedback affordance when the flag is unset", () => {
  vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", "");
  render(<AppShell><p>page body</p></AppShell>);
  expect(screen.queryByRole("button", { name: /user feedback/i })).toBeNull();
});
```

Keep the existing wordmark-and-children test unchanged, and keep the `afterEach(() => vi.unstubAllEnvs())`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/ui/app-shell.test.tsx`
Expected: FAIL — the old link is gated on a different variable, so no button exists.

- [ ] **Step 3: Make the swap**

Delete the `feedbackUrl` constant and the entire `{feedbackUrl && (<footer>…</footer>)}` block; render `<FeedbackPanel />` in its place, after `<main>`.

- [ ] **Step 4: Update `.env.example`**

Replace the `NEXT_PUBLIC_FEEDBACK_URL` entry with:

```
# Set to 1 to show the internal beta-feedback panel. Unset it to remove the
# affordance everywhere (e.g. before a session with students).
# Reports go to the Supabase `feedback` table; SUPABASE_URL and
# SUPABASE_SERVICE_ROLE_KEY come from the Vercel Supabase integration.
NEXT_PUBLIC_FEEDBACK_ENABLED=
```

- [ ] **Step 5: Confirm the old variable is gone**

```bash
grep -rn "NEXT_PUBLIC_FEEDBACK_URL" app components lib .env.example
```

Expected: no output.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/components/`
Expected: PASS. Every shell and activity test must still pass — `AppShell` wraps all of them.

- [ ] **Step 7: Commit**

```bash
git add components/ui/app-shell.tsx .env.example tests/components/ui/app-shell.test.tsx
git commit -m "feat: replace the outbound feedback link with the in-app panel"
```

---

## Task 5: Full verification

- [ ] **Step 1: Suite** — `npm test`; expected ≥ 309 plus the new tests, all passing.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`; expected no output.
- [ ] **Step 3: Build** — `npm run build`; expected success. This specifically proves the Supabase client is not constructed at module scope.
- [ ] **Step 4: Confirm the key cannot reach the browser**

```bash
grep -rn "SUPABASE_SERVICE_ROLE_KEY" app components lib
grep -rln "use client" components/feedback | xargs grep -l "supabase" || echo "no supabase import in a client file"
```

Expected: the key appears only in `app/api/feedback/route.ts`; no client file imports Supabase.

- [ ] **Step 5: Confirm the build output has no secret**

```bash
grep -rl "service_role" .next/static 2>/dev/null || echo "no service_role string in client bundles"
```

Expected: the fallback message.

- [ ] **Step 6: Commit any fixes**

Stage explicit paths — **do not use `git add -A`**; the tree carries stray untracked `" 2"`-suffixed duplicate files from an earlier branch that must not be committed.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Insert path, validation, 503 degradation, header-sourced user agent | 2 |
| Context capture from localStorage, corruption tolerance | 1 |
| Panel UI, pure/impure split, status states | 3 |
| `AppShell` swap, `NEXT_PUBLIC_FEEDBACK_ENABLED` kill switch | 4 |
| Key never reaching the browser | 2 + 5 |
| Testing gates | 5 |

Table, migration, and `.gitignore` hardening already landed on the branch before planning.

**Type consistency:** `FeedbackContext`/`collectFeedbackContext` (Task 1) are consumed by Task 3. The route contract (Task 2) is consumed by Task 3. `FeedbackPanel`/`FeedbackPanelView` (Task 3) are consumed by Task 4.

**Execution order.** Tasks 1 and 2 are independent and may be batched. Task 3 depends on both. Task 4 depends on 3. Task 5 last.
