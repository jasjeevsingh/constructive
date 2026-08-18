import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const grantToken = vi.fn();
vi.mock("@deepgram/sdk", () => ({
  createClient: () => ({ auth: { grantToken } }),
}));

const { GET, POST } = await import("@/app/api/deepgram/token/route");

beforeEach(() => {
  grantToken.mockReset();
  process.env.DEEPGRAM_API_KEY = "secret-key";
});
afterEach(() => {
  delete process.env.DEEPGRAM_API_KEY;
});

describe("POST /api/deepgram/token", () => {
  it("returns a short-lived token", async () => {
    grantToken.mockResolvedValue({ result: { access_token: "tok", expires_in: 30 }, error: null });
    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ access_token: "tok", expires_in: 30 });
  });

  it("never leaks the api key", async () => {
    grantToken.mockResolvedValue({ result: { access_token: "tok", expires_in: 30 }, error: null });
    const res = await POST();
    expect(JSON.stringify(await res.json())).not.toContain("secret-key");
  });

  it("503s when the key is unset so the UI can degrade", async () => {
    delete process.env.DEEPGRAM_API_KEY;
    const res = await POST();
    expect(res.status).toBe(503);
  });

  it("503s when deepgram returns an error", async () => {
    grantToken.mockResolvedValue({ result: null, error: new Error("nope") });
    const res = await POST();
    expect(res.status).toBe(503);
  });
});

describe("GET /api/deepgram/token", () => {
  it("reports available, without minting a token, when the key is set", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: true });
    expect(grantToken).not.toHaveBeenCalled();
  });

  it("503s and reports unavailable when the key is unset", async () => {
    delete process.env.DEEPGRAM_API_KEY;
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ available: false });
  });
});
