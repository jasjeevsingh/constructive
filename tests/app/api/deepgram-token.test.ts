import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const grantToken = vi.fn();
vi.mock("@deepgram/sdk", () => ({
  createClient: () => ({ auth: { grantToken } }),
}));

// Re-imported per test: the route caches a successful capability probe in
// module scope, and a cache leaking across tests would let one test pass on a
// previous test's side effect rather than on its own setup.
let GET: () => Promise<Response>;
let POST: () => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  ({ GET, POST } = await import("@/app/api/deepgram/token/route"));
  grantToken.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.DEEPGRAM_API_KEY = "secret-key";
});
afterEach(() => {
  vi.restoreAllMocks();
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
  it("reports available when the key can actually mint", async () => {
    grantToken.mockResolvedValue({ result: { access_token: "tok", expires_in: 30 }, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ available: true });
    // The probe now proves capability rather than trusting env presence.
    expect(grantToken).toHaveBeenCalled();
  });

  it("503s and reports unavailable when the key is unset", async () => {
    delete process.env.DEEPGRAM_API_KEY;
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ available: false });
  });
});

describe("diagnosability of a refused key", () => {
  // The real incident: a valid, usage-scoped key authenticates and transcribes
  // fine but is refused 403 "Insufficient permissions" when minting a browser
  // token. The route used to swallow that entirely.
  const forbidden = {
    result: null,
    error: Object.assign(new Error('{"err_code":"FORBIDDEN","err_msg":"Insufficient permissions."}'), {
      status: 403,
    }),
  };

  it("logs why Deepgram refused, server-side", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    grantToken.mockResolvedValue(forbidden);
    await POST();
    const logged = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("Insufficient permissions");
  });

  it("never puts the refusal reason or the key in the response body", async () => {
    grantToken.mockResolvedValue(forbidden);
    const body = await (await POST()).text();
    expect(body).not.toContain("Insufficient permissions");
    expect(body).not.toContain("secret-key");
  });

  it("reports the voice helper unavailable when the key cannot mint", async () => {
    grantToken.mockResolvedValue(forbidden);
    // This is the case an env-presence probe got wrong: key set, but unusable.
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ available: false });
  });

  it("a later refusal invalidates a cached available result", async () => {
    grantToken.mockResolvedValue({ result: { access_token: "tok", expires_in: 30 }, error: null });
    expect((await GET()).status).toBe(200);

    grantToken.mockResolvedValue(forbidden);
    expect((await POST()).status).toBe(503);

    // The cache must not keep claiming the helper is available after a refusal.
    expect((await GET()).status).toBe(503);
  });
});
