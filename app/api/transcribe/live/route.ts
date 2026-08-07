import { startLiveSession, sendLiveAudio, finishLiveSession } from "@/lib/ai/deepgramLiveSession";
import { MAX_LIVE_CHUNK_BYTES } from "@/lib/ai/limits";

function apiKey(): string {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set");
  return key;
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "start") {
      const sessionId = await startLiveSession(apiKey());
      return Response.json({ sessionId }, { status: 200 });
    }

    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      return Response.json({ error: "sessionId required" }, { status: 400 });
    }

    if (action === "stop") {
      const { text } = await finishLiveSession(sessionId);
      return Response.json({ text }, { status: 200 });
    }

    const chunk = Buffer.from(await req.arrayBuffer());
    if (chunk.length === 0) {
      return Response.json({ error: "empty audio chunk" }, { status: 400 });
    }
    if (chunk.length > MAX_LIVE_CHUNK_BYTES) {
      return Response.json({ error: "audio chunk too large" }, { status: 400 });
    }
    const { text } = await sendLiveAudio(sessionId, chunk);
    return Response.json({ text }, { status: 200 });
  } catch {
    return Response.json({ error: "live transcription failed" }, { status: 500 });
  }
}
