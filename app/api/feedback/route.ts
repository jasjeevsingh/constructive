import { put, list, get } from "@vercel/blob";
import { z } from "zod";
import { MAX_FEEDBACK_CONTEXT_BYTES } from "@/lib/feedback/limits";

const FeedbackBodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  context: z.record(z.string(), z.unknown()).optional(),
  path: z.string().max(500).optional(),
});

export async function POST(request: Request) {
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

  if (
    parsed.data.context &&
    Buffer.byteLength(JSON.stringify(parsed.data.context), "utf8") > MAX_FEEDBACK_CONTEXT_BYTES
  ) {
    return Response.json({ error: "invalid feedback" }, { status: 400 });
  }

  const entry = {
    message: parsed.data.message,
    context: parsed.data.context ?? null,
    path: parsed.data.path ?? null,
    user_agent: request.headers.get("user-agent"),
    created_at: new Date().toISOString(),
  };

  try {
    await put(
      `feedback/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`,
      JSON.stringify(entry),
      { access: "private", contentType: "application/json", addRandomSuffix: false },
    );
  } catch (err) {
    console.error("feedback save failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "could not save feedback" }, { status: 503 });
  }

  return new Response(null, { status: 204 });
}

export async function GET() {
  try {
    const { blobs } = await list({ prefix: "feedback/" });
    const entries = await Promise.all(
      blobs.map(async (blob) => {
        const result = await get(blob.url, { access: "private" });
        const reader = result.stream.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const data = JSON.parse(Buffer.concat(chunks).toString());
        return { ...data, id: blob.pathname };
      }),
    );
    entries.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return Response.json(entries);
  } catch (err) {
    console.error("feedback list failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "could not list feedback" }, { status: 503 });
  }
}
