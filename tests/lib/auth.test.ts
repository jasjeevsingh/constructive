import { describe, it, expect } from "vitest";
import { checkPassword } from "@/lib/auth";

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
