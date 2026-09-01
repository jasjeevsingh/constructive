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

  const { system, user } = buildAvatarPrompt(body);
  const history = transcriptToHistory(body.transcript ?? []);
  const client = getChatClient({ json: false });

  try {
    const text = await client.complete({ system, user, history });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send the full text as one SSE chunk — the client splits into
        // sentences for parallel TTS, which is where the latency win lives.
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  } catch {
    return Response.json({ error: "avatar turn failed" }, { status: 500 });
  }
}
