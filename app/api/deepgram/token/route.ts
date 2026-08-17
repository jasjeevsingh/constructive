import { createClient } from "@deepgram/sdk";

/** Mints a ~30s Deepgram token so the browser can open an agent socket directly.
 *  The API key itself never leaves the server. */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "voice helper unavailable" }, { status: 503 });
  }
  try {
    const { result, error } = await createClient(apiKey).auth.grantToken();
    if (error || !result?.access_token) {
      return Response.json({ error: "voice helper unavailable" }, { status: 503 });
    }
    return Response.json({ access_token: result.access_token, expires_in: result.expires_in });
  } catch {
    return Response.json({ error: "voice helper unavailable" }, { status: 503 });
  }
}
