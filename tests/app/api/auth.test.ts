import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/route";

beforeEach(() => {
  process.env.APP_PASSWORD = "letmein";
});

function post(body: unknown): Request {
  return new Request("http://test/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth", () => {
  it("sets a cookie on the right password", async () => {
    const res = await POST(post({ password: "letmein" }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("constructive_auth=");
    // Local/dev must not set Secure or the browser drops the cookie on http://
    expect(cookie).not.toMatch(/;\s*Secure/i);
  });

  it("401s on a wrong password", async () => {
    const res = await POST(post({ password: "wrong" }));
    expect(res.status).toBe(401);
  });
});
