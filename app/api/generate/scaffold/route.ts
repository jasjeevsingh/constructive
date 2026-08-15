import { z } from "zod";
import { getGenerateClient } from "@/lib/ai/claude";
import { generateScaffold } from "@/lib/ai/generate";
import { enforceSolvableSides, ScaffoldError } from "@/lib/generatedNormalize";

const BodySchema = z.object({
  universe: z.string().min(1).max(100),
  motion: z.string().min(1).max(300),
});

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
    const result = await generateScaffold(parsed.data.universe.trim(), parsed.data.motion.trim(), getGenerateClient());
    if (result.refused) return Response.json(result, { status: 200 });
    const sides = enforceSolvableSides(result.sides);
    return Response.json({ refused: false, sides }, { status: 200 });
  } catch (err) {
    const status = err instanceof ScaffoldError ? 422 : 500;
    return Response.json({ error: "scaffold failed" }, { status });
  }
}
