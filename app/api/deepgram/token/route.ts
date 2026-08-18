import { createClient } from "@deepgram/sdk";

/** How long a successful capability probe is trusted before re-checking.
 *  Module scope, so this is per serverless instance — a cache, never a source
 *  of truth. Worst case an instance re-probes. */
const CAPABILITY_TTL_MS = 5 * 60 * 1000;
let capableUntil = 0;

/** Logs why Deepgram refused, server-side only.
 *  The message can name a scope or an account problem, which is exactly the
 *  detail that made a 403 here cost an evening to diagnose. It must never
 *  reach a response body — see the static strings below. */
function logRefusal(where: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[deepgram/token] ${where}: ${message}`);
}

type Minted = { access_token: string; expires_in: number };

async function mintToken(apiKey: string): Promise<Minted | null> {
  const { result, error } = await createClient(apiKey).auth.grantToken();
  if (error) {
    logRefusal("grantToken refused", error);
    return null;
  }
  if (!result?.access_token) {
    logRefusal("grantToken returned no access_token", new Error("empty result"));
    return null;
  }
  return { access_token: result.access_token, expires_in: result.expires_in };
}

/**
 * Availability check for the voice affordance.
 *
 * This actually attempts a grant rather than checking that the env var exists.
 * A key can be present and still be unable to mint browser tokens — a
 * usage-scoped key authenticates, transcribes, and speaks fine, but is refused
 * with 403 "Insufficient permissions" here. An env-presence check reports that
 * key as available, so the student sees an enabled button that fails on click.
 *
 * A success is cached briefly so a panel mount does not mint a token every time.
 */
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error("[deepgram/token] DEEPGRAM_API_KEY is not set");
    return Response.json({ available: false }, { status: 503 });
  }

  if (Date.now() < capableUntil) return Response.json({ available: true });

  try {
    if (!(await mintToken(apiKey))) return Response.json({ available: false }, { status: 503 });
    capableUntil = Date.now() + CAPABILITY_TTL_MS;
    return Response.json({ available: true });
  } catch (err) {
    logRefusal("capability probe threw", err);
    return Response.json({ available: false }, { status: 503 });
  }
}

/** Mints a ~30s Deepgram token so the browser can open an agent socket directly.
 *  The API key itself never leaves the server. */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error("[deepgram/token] DEEPGRAM_API_KEY is not set");
    return Response.json({ error: "voice helper unavailable" }, { status: 503 });
  }
  try {
    const minted = await mintToken(apiKey);
    if (!minted) {
      capableUntil = 0; // a refusal invalidates any cached "available"
      return Response.json({ error: "voice helper unavailable" }, { status: 503 });
    }
    return Response.json(minted);
  } catch (err) {
    capableUntil = 0;
    logRefusal("mint threw", err);
    return Response.json({ error: "voice helper unavailable" }, { status: 503 });
  }
}
