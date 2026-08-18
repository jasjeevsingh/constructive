import { createClient } from "@deepgram/sdk";

/** Cheap availability check: an env-var presence check only, no Deepgram call
 *  and no token minted. Lets the client show a disabled affordance up front
 *  on a key-less deploy instead of failing a real connect attempt. */
export async function GET() {
  const available = Boolean(process.env.DEEPGRAM_API_KEY);
  return Response.json({ available }, { status: available ? 200 : 503 });
}

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
