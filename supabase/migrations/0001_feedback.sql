-- Beta feedback submissions.
--
-- Written ONLY by the server route /api/feedback, using SUPABASE_SERVICE_ROLE_KEY.
-- The browser never talks to Supabase: there is no anon-key client anywhere in
-- the app, and RLS is enabled below with NO policies, so the anon and
-- authenticated roles can neither read nor write this table. Only the
-- service_role key (which bypasses RLS) can, and that key is server-only.

create table if not exists public.feedback (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- What the tester typed.
  message     text        not null,
  -- Where they were and what state they were in, read from localStorage at
  -- submit time: per motion, only its id, side, stage, mapped claim, and
  -- completion flags (never the student's own writing), plus practice
  -- counts.
  context     jsonb,
  -- Coarse environment, for reproducing a bug.
  path        text,
  user_agent  text
);

-- Newest-first browsing in the Supabase table editor.
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

-- Deny-by-default. No policies are created, so anon/authenticated get nothing.
alter table public.feedback enable row level security;
