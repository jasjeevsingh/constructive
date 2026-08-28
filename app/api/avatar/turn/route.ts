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
