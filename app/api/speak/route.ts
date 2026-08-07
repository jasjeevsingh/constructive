import { speakText } from "@/lib/ai/deepgram";
import { MAX_SPEAK_TEXT_LENGTH } from "@/lib/ai/limits";

export async function POST(req: Request): Promise<Response> {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return Response.json({ error: "empty text" }, { status: 400 });
  }
  if (text.length > MAX_SPEAK_TEXT_LENGTH) {
    return Response.json({ error: "text too long" }, { status: 400 });
  }

  try {
    const { audio, contentType } = await speakText(text);
    // Buffer.concat yields Buffer<ArrayBufferLike>, which TS won't accept as BodyInit;
    // a freshly-constructed Uint8Array is backed by a concrete ArrayBuffer.
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: { "content-type": contentType, "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ error: "speech failed" }, { status: 500 });
  }
}
