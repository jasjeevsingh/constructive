import { CoachRequestSchema } from "@/lib/schemas";
import { getChatClient } from "@/lib/ai/claude";
import { runCoach } from "@/lib/ai/coach";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = CoachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await runCoach(parsed.data, getChatClient());
    return Response.json(result, { status: 200 });
  } catch (err) {
    return Response.json({ error: "coach failed" }, { status: 500 });
  }
}
