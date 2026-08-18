# Constructive — In-App Beta Feedback Design

**Date:** 2026-08-17
**Status:** Approved for planning
**Scope:** Replace the outbound feedback link shipped in the beta-feedback branch with an in-app
form that writes to Supabase, auto-attaching the tester's page state. Four beta testers are using
the app now; this is how they report problems.

## Background

The beta-feedback branch added a footer link driven by `NEXT_PUBLIC_FEEDBACK_URL`
(`components/ui/app-shell.tsx`). It was never switched on, because it needed an external form that
did not exist. Rather than create one, the user chose to build the form into the app so that
"all the data is collected and in an easily accessible place."

The decisive advantage over an outbound form: a report can carry the tester's actual state. Every
bug fixed across the three beta branches was diagnosable only because a report named a specific
screen — "the claim thing was broken" would not have been actionable. An in-app form attaches the
motion, side, and stage automatically, so the tester does not have to remember or describe them.

## Already provisioned

Supabase was installed through the Vercel Marketplace (Free plan) and connected to the
`constructive` project across production, preview, and development. It injected
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the `POSTGRES_*` set.

`supabase/migrations/0001_feedback.sql` is applied. The table:

```
public.feedback (
  id uuid pk default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null,
  context jsonb,
  path text,
  user_agent text
)
```

**RLS is enabled with zero policies** — verified against the live database. The anon and
authenticated roles can neither read nor write it; only `service_role`, which bypasses RLS, can.

## Decisions

- **The browser never talks to Supabase.** The form POSTs to our own route, which inserts using
  the service-role key. No Supabase client ships to the browser, so the `NEXT_PUBLIC_SUPABASE_*`
  vars the integration injected go deliberately unused. This is why the table needs no RLS policy:
  there is no client role to grant anything to.
- **Context comes from `localStorage`, not React context.** `AppShell` wraps `FlowShell` and
  `PracticeShell`, so a footer control sits *outside* `HelperContextProvider` and cannot read it.
  Reading `constructive:flow:v1` and `constructive:practice:v1` gives the motion, side, stage,
  and mapped claim on **every** page including the deck, with no provider hoisting. The in-flight
  claim draft is lost (it was never persisted) — an acceptable trade.
- **One kill switch.** `NEXT_PUBLIC_FEEDBACK_ENABLED` replaces `NEXT_PUBLIC_FEEDBACK_URL`. Unset it
  before the retreat and the affordance disappears everywhere. Same retreat-safety property as
  before, one variable instead of two, and no dead URL semantics.

## Goals

- A tester can report a problem without leaving the activity, in under fifteen seconds.
- Every report carries enough state to reproduce the bug.
- Submissions land in one browsable Supabase table.
- The service-role key never reaches the browser.

## Non-goals

- No email or push notification on submission (the user accepted having to go look; an email layer
  is a later addition if volume warrants).
- No in-app reading of submissions — the Supabase table editor is the reading surface.
- No tester identity, accounts, or auth. The app is already password-gated.
- No file or screenshot attachments.
- No change to the voice helper, the coach, or any activity behaviour.

## Architecture

### 1. Insert path — `app/api/feedback/route.ts`

`POST` accepting `{ message, context, path }`. Validated with Zod, matching the repo's convention:

- `message` — trimmed, required, `.max(4000)`. Rejects empty.
- `context` — optional arbitrary JSON object, capped by an overall body-size check.
- `path` — optional string, `.max(500)`.

`user_agent` is read from the request header server-side, not trusted from the body.

Inserts via `@supabase/supabase-js` created with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
The client is constructed **lazily inside the handler**, never at module scope — a top-level
`createClient` with a missing env var would crash `next build`.

Returns `204` on success, `400` on validation failure, `503` when Supabase is not configured (so a
key-less environment degrades instead of 500-ing).

### 2. Context capture — `lib/feedback/context.ts` (pure)

`collectFeedbackContext(storage: Storage, pathname: string): FeedbackContext`

Reads the two progress keys defensively — corrupt or absent JSON yields a context with those fields
omitted rather than throwing, mirroring `lib/state/flowProgress.ts`'s corruption tolerance. Returns
the current pathname, the per-motion flow entries (motion id, side, stage, mappedClaimId,
completion flags — each entry is projected down to exactly these fields, so the student's own
writing, `restate`/`keywordAnswers`/`impact`, never leaves the device, for the current motion or any
other one they've touched), and the practice rep counts. Pure and fully unit-testable.

### 3. UI — `components/feedback/FeedbackPanel.tsx`

Rendered from `AppShell`, so it appears on every activity page and the deck. Split for testability:

- `FeedbackPanelView` — pure. Takes `{ open, status, onOpen, onClose, onSubmit }` and renders the
  collapsed "User feedback" trigger, the open form, and the `sending` / `sent` / `error` states.
- `FeedbackPanel` — owns `fetch` and `localStorage`, renders the view.

Behaviour: collapsed trigger in the footer; opening shows a textarea plus a one-line note that the
current screen is attached; submit disabled while empty or sending; on success a brief thank-you
that auto-closes; on failure an error with the text preserved so nothing is lost.

Renders nothing at all when `NEXT_PUBLIC_FEEDBACK_ENABLED` is not `"1"`.

### 4. `AppShell` change

The `NEXT_PUBLIC_FEEDBACK_URL` link block is replaced by `<FeedbackPanel />`. `AppShell` stays a
server component rendering a client child, which is fine. The `.env.example` entry is updated.

## Error handling

- `NEXT_PUBLIC_FEEDBACK_ENABLED` unset → nothing renders. This is the retreat kill switch.
- Supabase env missing → route 503; the panel shows a plain "couldn't send" and keeps the text.
- Network failure → same, text preserved.
- Corrupt `localStorage` → context fields omitted; the report still sends. A broken progress entry
  is precisely when someone is most likely to file feedback, so this path must not throw.
- Oversized body → 400 with a clear message rather than a silent truncation.
- Nothing about the activity depends on this feature; every failure is contained to the panel.

## Testing

Baseline to preserve: **309 tests / 67 files green**, `npx tsc --noEmit` clean, `npm run build`
succeeds.

- `collectFeedbackContext` — reads both stores; tolerates absent, non-JSON, and wrong-shape values;
  includes the pathname.
- Route — 204 on a valid insert (Supabase client stubbed); 400 on empty and on over-long message;
  503 when env is absent; `user_agent` taken from the header and not from the body;
  **the service-role key never appears in any response**.
- `FeedbackPanelView` — collapsed trigger; open form; submit disabled when empty; sending, sent,
  and error states; error preserves the typed text.
- `AppShell` — renders the panel when the flag is `"1"`, renders nothing when unset. The existing
  wordmark and children assertions must keep passing.

**Not covered by tests:** the real network round trip to Supabase. The insert is verified by
stubbing the client; that the deployed route reaches the real database is confirmed by the manual
smoke check below, not by the suite.

## Manual verification (post-merge)

Set `NEXT_PUBLIC_FEEDBACK_ENABLED=1`, submit one report from a motion page, and confirm the row
appears in the Supabase table editor with its `context` populated.

## Architecture / files

**Create:** `app/api/feedback/route.ts` · `lib/feedback/context.ts` ·
`components/feedback/FeedbackPanel.tsx` · tests for each.

**Modify:** `components/ui/app-shell.tsx` (swap link for panel) · `.env.example` ·
`package.json` (add `@supabase/supabase-js`).

**Untouched:** every activity component, the voice helper, the coach, `lib/helper/**`,
`lib/state/**` (read only, never written), `content/**`, `middleware.ts`.

**Already landed on this branch:** `supabase/migrations/0001_feedback.sql`,
`scripts/apply-sql.mjs`, and the `.gitignore` hardening that keeps `.env.local` out of git.

## Open questions

None blocking. Email-on-submission, an in-app admin view, and screenshot attachments are deliberate
follow-ups this design leaves room for.
