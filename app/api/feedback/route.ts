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
