import { describe, it, expect, vi } from "vitest";
import { createAgentSession } from "@/lib/helper/agentSession";
import { emptyHelperContext } from "@/lib/helper/context";
import type { HelperState } from "@/lib/helper/agentMachine";

function harness(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
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

  it("tears down the previous socket and queue when start() is called again before stop()", async () => {
    const sockets: ReturnType<typeof makeSocket>[] = [];
    const queues: ReturnType<typeof makeQueue>[] = [];
    function makeSocket() {
      return {
        on: vi.fn(),
        configure: vi.fn(),
        updatePrompt: vi.fn(),
        send: vi.fn(),
        keepAlive: vi.fn(),
        requestClose: vi.fn(),
      };
    }
    function makeQueue() {
      return { push: vi.fn(), drop: vi.fn(), close: vi.fn() };
    }
    const createSocket = vi.fn(() => {
      const s = makeSocket();
      sockets.push(s);
      return s;
    });
    const createQueue = vi.fn(() => {
      const q = makeQueue();
      queues.push(q);
      return q;
    });
    const session = createAgentSession({
      fetchToken: async () => "tok",
      createSocket,
      createQueue,
      onState: () => {},
    });

    await session.start(emptyHelperContext());
    await session.start({ ...emptyHelperContext(), stage: "impact" });

    expect(createSocket).toHaveBeenCalledTimes(2);
    expect(sockets[0].requestClose).toHaveBeenCalled();
    expect(queues[0].close).toHaveBeenCalled();
    expect(sockets[1].requestClose).not.toHaveBeenCalled();
  });

  it("ignores a superseded start() whose token fetch resolves after a newer start()", async () => {
    let resolveStale: (token: string) => void = () => {};
    const fetchToken = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => void (resolveStale = resolve)))
      .mockImplementationOnce(async () => "tok-fresh");
    const createSocket = vi.fn(() => ({
      on: vi.fn(),
      configure: vi.fn(),
      updatePrompt: vi.fn(),
      send: vi.fn(),
      keepAlive: vi.fn(),
      requestClose: vi.fn(),
    }));
    const createQueue = vi.fn(() => ({ push: vi.fn(), drop: vi.fn(), close: vi.fn() }));
    const session = createAgentSession({
      fetchToken,
      createSocket,
      createQueue,
      onState: () => {},
    });

    const stale = session.start(emptyHelperContext());
    const fresh = session.start({ ...emptyHelperContext(), stage: "impact" });
    await fresh;
    resolveStale("tok-stale");
    await stale;

    // Only the newer, non-superseded start() ever stands up a socket/queue.
    expect(createSocket).toHaveBeenCalledTimes(1);
    expect(createQueue).toHaveBeenCalledTimes(1);
  });

  it("drops a trailing Audio frame that arrives after barge-in, until the next turn", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());

    h.fire("UserStartedSpeaking");
    h.fire("Audio", new Int16Array([1, 2]).buffer);
    expect(h.queue.push).not.toHaveBeenCalled();

    h.fire("ConversationText", { role: "assistant", content: "okay, let's try that again" });
    h.fire("Audio", new Int16Array([3, 4]).buffer);
    expect(h.queue.push).toHaveBeenCalledTimes(1);
  });

  it("resumes pushing Audio once AgentThinking marks a new turn", async () => {
    const h = harness();
    await h.session.start(emptyHelperContext());

    h.fire("UserStartedSpeaking");
    h.fire("AgentThinking");
    h.fire("Audio", new Int16Array([1, 2]).buffer);
    expect(h.queue.push).toHaveBeenCalledTimes(1);
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

  it("starts a call from the text transcript and tells the agent about it", async () => {
    const h = harness({ initialTurns: [{ role: "student", text: "phones are bad" }] });
    await h.session.start(emptyHelperContext());
    const cfg = JSON.stringify(h.socket.configure.mock.calls[0][0]);
    expect(cfg).toContain("phones are bad");
    expect(h.states[h.states.length - 1].turns[0]).toEqual({ role: "student", text: "phones are bad" });
  });
});
