import { transcribeAudio } from "@/lib/ai/deepgram";
import { MAX_TRANSCRIBE_BYTES } from "@/lib/ai/limits";

export async function POST(req: Request): Promise<Response> {
  const arrayBuf = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  if (buffer.length === 0) {
    return Response.json({ error: "empty audio" }, { status: 400 });
  }
  if (buffer.length > MAX_TRANSCRIBE_BYTES) {
    return Response.json({ error: "audio too large" }, { status: 400 });
  }
  const mimetype = req.headers.get("content-type") ?? "audio/webm";
  try {
    const text = await transcribeAudio(buffer, mimetype);
    return Response.json({ text }, { status: 200 });
  } catch {
    return Response.json({ error: "transcription failed" }, { status: 500 });
  }
}
