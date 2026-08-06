import { describe, it, expect } from "vitest";
import { checkPassword, sessionToken } from "@/lib/auth";

describe("checkPassword", () => {
  it("matches the configured password", () => {
    expect(checkPassword("letmein", "letmein")).toBe(true);
  });
  it("rejects a wrong password", () => {
    expect(checkPassword("nope", "letmein")).toBe(false);
  });
  it("rejects when no password is configured", () => {
    expect(checkPassword("anything", undefined)).toBe(false);
  });
  it("rejects an empty attempt", () => {
    expect(checkPassword("", "letmein")).toBe(false);
  });
});

describe("sessionToken", () => {
  it("is deterministic for the same input", async () => {
    const a = await sessionToken("letmein");
    const b = await sessionToken("letmein");
    expect(a).toBe(b);
  });

  it("differs for different inputs", async () => {
    const a = await sessionToken("letmein");
    const b = await sessionToken("somethingelse");
    expect(a).not.toBe(b);
  });

  it("returns 64 hex characters (SHA-256 digest)", async () => {
    const token = await sessionToken("letmein");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is not the literal 'ok'", async () => {
    const token = await sessionToken("letmein");
    expect(token).not.toBe("ok");
  });
});
