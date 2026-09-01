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

  if (!client.completeStream) {
    const text = await client.complete({ system, user, history });
    return Response.json({ text }, { status: 200 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of client.completeStream!({ system, user, history })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("turn-stream error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify("[ERROR]")}\n\n`));
      }
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
}
