import { describe, it, expect, vi } from "vitest";
import { createAgentSession } from "@/lib/helper/agentSession";
import { emptyHelperContext } from "@/lib/helper/context";
import type { HelperState } from "@/lib/helper/agentMachine";

function harness() {
  const handlers = new Map<string, (p: unknown) => void>();
  const socket = {
    on: (e: string, h: (p: unknown) => void) => void handlers.set(e, h),
    configure: vi.fn(),
    updatePrompt: vi.fn(),
    send: vi.fn(),
    keepAlive: vi.fn(),
    requestClose: vi.fn(),
  };
  const queue = { push: vi.fn(), drop: vi.fn(), close: vi.fn() };
  const states: HelperState[] = [];
  const session = createAgentSession({
    fetchToken: async () => "tok",
    createSocket: () => socket,
    createQueue: () => queue,
    onState: (s) => states.push(s),
  });
  return { session, socket, queue, states, fire: (e: string, p?: unknown) => handlers.get(e)?.(p) };
}

describe("agentSession", () => {
  it("configures the socket before any audio and includes the prompt", async () => {
    const h = harness();
    await h.session.start({ ...emptyHelperContext(), motion: "This House would ban homework." });
    expect(h.socket.configure).toHaveBeenCalledTimes(1);
    const cfg = JSON.stringify(h.socket.configure.mock.calls[0][0]);
    expect(cfg).toContain("This House would ban homework.");
    expect(cfg).toContain("anthropic");
  });

  it("drops queued audio when the student interrupts", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.fire("Audio", new Int16Array([1, 2]).buffer);
    h.fire("UserStartedSpeaking");
    expect(h.queue.drop).toHaveBeenCalled();
  });

  it("pushes agent audio into the queue", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.fire("Audio", new Int16Array([1, 2]).buffer);
    expect(h.queue.push).toHaveBeenCalled();
  });

  it("reports state changes as conversation happens", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.fire("SettingsApplied");
    h.fire("ConversationText", { role: "user", content: "hi" });
    const last = h.states[h.states.length - 1];
    expect(last.turns).toEqual([{ role: "student", text: "hi" }]);
  });

  it("pushes a new prompt when the page context changes", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.session.updateContext({ ...emptyHelperContext(), stage: "impact" });
    expect(h.socket.updatePrompt).toHaveBeenCalled();
    expect(String(h.socket.updatePrompt.mock.calls[0][0])).toContain("impact");
  });

  it("closes the socket and the queue on stop", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());
    h.session.stop();
    expect(h.socket.requestClose).toHaveBeenCalled();
    expect(h.queue.close).toHaveBeenCalled();
  });

  it("surfaces a token failure as an error state", async () => {
    const states: HelperState[] = [];
    const session = createAgentSession({
      fetchToken: async () => {
        throw new Error("503");
      },
      createSocket: () => {
        throw new Error("should not be reached");
      },
      createQueue: () => ({ push: vi.fn(), drop: vi.fn(), close: vi.fn() }),
      onState: (s) => states.push(s),
    });
    await session.start(emptyHelperContext());
    expect(states[states.length - 1].phase).toBe("error");
  });
});
