import { createClient } from "@deepgram/sdk";

export async function transcribeAudio(buffer: Buffer, mimetype: string): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not set");
  const dg = createClient(apiKey);
  const { result, error } = await dg.listen.prerecorded.transcribeFile(buffer, {
    model: "nova-2",
    smart_format: true,
    mimetype,
  });
  if (error) throw error;
  return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}
