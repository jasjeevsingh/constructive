import { z } from "zod";
import { getGenerateClient } from "@/lib/ai/claude";
import { generateMotions } from "@/lib/ai/generate";

const BodySchema = z.object({ universe: z.string().min(1).max(100) });

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });
  try {
    const result = await generateMotions(parsed.data.universe.trim(), getGenerateClient());
    return Response.json(result, { status: 200 });
  } catch {
    return Response.json({ error: "generation failed" }, { status: 500 });
  }
}
