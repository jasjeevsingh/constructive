import { AUTH_COOKIE, checkPassword } from "@/lib/auth";

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

  const headers = new Headers();
  headers.append("content-type", "application/json");
  headers.append(
    "set-cookie",
    `${AUTH_COOKIE}=ok; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
  );
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
