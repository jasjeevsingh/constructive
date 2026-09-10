import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const put = vi.fn();
vi.mock("@vercel/blob", () => ({
  put,
  list: vi.fn(),
  get: vi.fn(),
}));

const { POST } = await import("@/app/api/feedback/route");

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** The JSON document the route handed to blob storage on the first call. */
function storedEntry(): Record<string, unknown> {
  return JSON.parse(put.mock.calls[0][1] as string);
}

beforeEach(() => {
  put.mockReset();
  put.mockResolvedValue({ url: "https://blob.example/feedback/x.json" });
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_secret-token";
});
afterEach(() => {
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

describe("POST /api/feedback", () => {
  it("stores a report as a private JSON blob under feedback/", async () => {
    const res = await POST(req({ message: "the claim stage went blank", path: "/" }));
    expect(res.status).toBe(204);
    expect(put).toHaveBeenCalledTimes(1);
    const [pathname, , options] = put.mock.calls[0];
    expect(String(pathname)).toMatch(/^feedback\/.+\.json$/);
    expect(options).toMatchObject({ access: "private", contentType: "application/json" });
    expect(storedEntry()).toMatchObject({ message: "the claim stage went blank", path: "/" });
    expect(typeof storedEntry().created_at).toBe("string");
  });

  it("takes the user agent from the header, not the body", async () => {
    await POST(req({ message: "hi", user_agent: "SPOOFED" }, { "user-agent": "RealBrowser/1.0" }));
    const row = storedEntry();
    expect(row.user_agent).toBe("RealBrowser/1.0");
    expect(JSON.stringify(row)).not.toContain("SPOOFED");
  });

  it("rejects an empty message", async () => {
    const res = await POST(req({ message: "   " }));
    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects an over-long message", async () => {
    const res = await POST(req({ message: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects an oversized context payload", async () => {
    const res = await POST(
      req({ message: "hi", context: { blob: "x".repeat(20 * 1024) } })
    );
    expect(res.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("accepts a normal-sized context payload", async () => {
    const res = await POST(
      req({ message: "hi", context: { pathname: "/", flow: { "m-1": { side: "for" } } } })
    );
    expect(res.status).toBe(204);
    expect(put).toHaveBeenCalledTimes(1);
    expect(storedEntry().context).toEqual({ pathname: "/", flow: { "m-1": { side: "for" } } });
  });

  it("503s when blob storage is not configured", async () => {
    put.mockRejectedValue(new Error("Vercel Blob: No token found"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(503);
    spy.mockRestore();
  });

  it("503s when the upload fails", async () => {
    put.mockRejectedValue(new Error("store down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(503);
    spy.mockRestore();
  });

  it("logs only the upload error's message, never the whole error object", async () => {
    const blobError = Object.assign(new Error("store down"), {
      token: "vercel_blob_rw_supersecret",
    });
    put.mockRejectedValue(blobError);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await POST(req({ message: "hi" }));
    expect(spy).toHaveBeenCalledTimes(1);
    const loggedArgs = spy.mock.calls[0];
    const loggedText = loggedArgs.map((a) => String(a)).join(" ");
    expect(loggedText).toContain("store down");
    expect(loggedText).not.toContain("supersecret");
    for (const arg of loggedArgs) {
      expect(arg).not.toBe(blobError);
    }
    spy.mockRestore();
  });

  it("never leaks the blob token", async () => {
    put.mockRejectedValue(new Error("Vercel Blob: No token found"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ message: "hi" }));
    const body = await res.text();
    expect(body).not.toContain("secret-token");
    spy.mockRestore();
  });
});
