import { AUTH_COOKIE, checkPassword, sessionToken } from "@/lib/auth";

export async function POST(req: Request): Promise<Response> {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!checkPassword(body.password ?? "", process.env.APP_PASSWORD)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const token = await sessionToken(process.env.APP_PASSWORD!);
  // Secure cookies are dropped on http://localhost; only require HTTPS in production.
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  const headers = new Headers();
  headers.append("content-type", "application/json");
  headers.append(
    "set-cookie",
    `${AUTH_COOKIE}=${token}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=2592000`
  );
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
