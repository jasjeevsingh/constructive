import { createClient } from "@deepgram/sdk";

const LISTEN_MODEL = process.env.DEEPGRAM_LISTEN_MODEL ?? "nova-2";
const AURA_MODEL = process.env.DEEPGRAM_AURA_MODEL ?? "aura-2-thalia-en";

function getClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not set");
  return createClient(apiKey);
}

/** Batch fallback when live streaming is unavailable. */
export async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  const { result, error } = await getClient().listen.prerecorded.transcribeFile(buffer, {
    model: LISTEN_MODEL,
    smart_format: true,
    punctuate: true,
    mimetype,
  });
  if (error) throw error;
  return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}

/** Aura TTS — returns MP3 bytes for coach speech playback. */
export async function speakText(text: string): Promise<{ audio: Buffer; contentType: string }> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("empty text");

  const response = await getClient().speak.request(
    { text: trimmed },
    { model: AURA_MODEL, encoding: "mp3" }
  );
  const stream = await response.getStream();
  if (!stream) throw new Error("Deepgram speak returned no audio");

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const audio = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  if (audio.length === 0) throw new Error("Deepgram speak returned empty audio");

  const headers = await response.getHeaders();
  const contentType = headers.get("content-type") ?? "audio/mpeg";
  return { audio, contentType };
}
