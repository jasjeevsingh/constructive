import { describe, it, expect } from "vitest";
import { helperSendGuard, MAX_HELPER_TURNS, MAX_HELPER_TURN_LENGTH } from "@/lib/helper/limits";

describe("helperSendGuard", () => {
  it("allows a normal send well under both caps", () => {
    expect(helperSendGuard(2, "what makes a claim good")).toBeNull();
  });

  it("blocks a message longer than the per-turn cap, with an actionable message", () => {
    const tooLong = "x".repeat(MAX_HELPER_TURN_LENGTH + 1);
    const message = helperSendGuard(0, tooLong);
    expect(message).not.toBeNull();
    expect(message!.toLowerCase()).toContain("too long");
  });

  it("allows a message exactly at the per-turn length cap", () => {
    const atCap = "x".repeat(MAX_HELPER_TURN_LENGTH);
    expect(helperSendGuard(0, atCap)).toBeNull();
  });

  it("blocks a send once the prior turn count would push past the conversation cap", () => {
    // MAX_HELPER_TURNS counts the whole message array sent to the server,
    // i.e. prior turns + this new one.
    const message = helperSendGuard(MAX_HELPER_TURNS, "one more thing");
    expect(message).not.toBeNull();
    expect(message!.toLowerCase()).toContain("start a new");
  });

  it("allows the send that lands exactly on the conversation cap", () => {
    expect(helperSendGuard(MAX_HELPER_TURNS - 1, "last one that fits")).toBeNull();
  });
});
