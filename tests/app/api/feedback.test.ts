import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const insert = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({ insert }) }),
}));

const { POST } = await import("@/app/api/feedback/route");

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
});
afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("POST /api/feedback", () => {
  it("stores a report", async () => {
    const res = await POST(req({ message: "the claim stage went blank", path: "/" }));
    expect(res.status).toBe(204);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({ message: "the claim stage went blank" });
  });

  it("takes the user agent from the header, not the body", async () => {
    await POST(req({ message: "hi", user_agent: "SPOOFED" }, { "user-agent": "RealBrowser/1.0" }));
    const row = insert.mock.calls[0][0];
    expect(row.user_agent).toBe("RealBrowser/1.0");
    expect(JSON.stringify(row)).not.toContain("SPOOFED");
  });

  it("rejects an empty message", async () => {
    const res = await POST(req({ message: "   " }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an over-long message", async () => {
    const res = await POST(req({ message: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an oversized context payload", async () => {
    const res = await POST(
      req({ message: "hi", context: { blob: "x".repeat(20 * 1024) } })
    );
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("accepts a normal-sized context payload", async () => {
    const res = await POST(
      req({ message: "hi", context: { pathname: "/", flow: { "m-1": { side: "for" } } } })
    );
    expect(res.status).toBe(204);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("503s when supabase is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(503);
    expect(insert).not.toHaveBeenCalled();
  });

  it("503s when the insert fails", async () => {
    insert.mockResolvedValue({ error: new Error("db down") });
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(503);
  });

  it("logs only the insert error's message, never the whole error object", async () => {
    const dbError = Object.assign(new Error("db down"), {
      connectionString: "postgres://service_role:supersecret@example/db",
    });
    insert.mockResolvedValue({ error: dbError });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await POST(req({ message: "hi" }));
    expect(spy).toHaveBeenCalledTimes(1);
    const loggedArgs = spy.mock.calls[0];
    const loggedText = loggedArgs.map((a) => String(a)).join(" ");
    expect(loggedText).toContain("db down");
    expect(loggedText).not.toContain("supersecret");
    for (const arg of loggedArgs) {
      expect(arg).not.toBe(dbError);
    }
    spy.mockRestore();
  });

  it("never leaks the service role key", async () => {
    const res = await POST(req({ message: "hi" }));
    const body = await res.text();
    expect(body).not.toContain("service-role-secret");
  });
});
