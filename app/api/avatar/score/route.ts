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
