import { describe, it, expect, vi } from "vitest";
import { createAudioQueue } from "@/lib/helper/audioQueue";

function fakeCtx() {
  const stopped: number[] = [];
  const started: number[] = [];
  let id = 0;
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    createBuffer: (_ch: number, len: number, _sr: number) => ({
      length: len,
      getChannelData: () => new Float32Array(len),
    }),
    createBufferSource: () => {
      const myId = ++id;
      return {
        buffer: null as unknown,
        connect: () => {},
        start: () => started.push(myId),
        stop: () => stopped.push(myId),
        onended: null,
      };
    },
    close: vi.fn(),
  };
  return { ctx: ctx as unknown as AudioContext, started, stopped };
}

const chunk = () => new Int16Array([1, 2, 3, 4]).buffer;

describe("audioQueue", () => {
  it("schedules pushed chunks", () => {
    const { ctx, started } = fakeCtx();
    const q = createAudioQueue(ctx);
    q.push(chunk());
    q.push(chunk());
    expect(started).toHaveLength(2);
  });

  it("stops everything queued when dropped", () => {
    const { ctx, started, stopped } = fakeCtx();
    const q = createAudioQueue(ctx);
    q.push(chunk());
    q.push(chunk());
    q.drop();
    expect(stopped).toHaveLength(started.length);
  });

  it("can queue again after a drop", () => {
    const { ctx, started } = fakeCtx();
    const q = createAudioQueue(ctx);
    q.push(chunk());
    q.drop();
    q.push(chunk());
    expect(started).toHaveLength(2);
  });

  it("ignores empty chunks", () => {
    const { ctx, started } = fakeCtx();
    const q = createAudioQueue(ctx);
    q.push(new ArrayBuffer(0));
    expect(started).toHaveLength(0);
  });

  it("tolerates an odd-length chunk instead of throwing", () => {
    const { ctx, started } = fakeCtx();
    const q = createAudioQueue(ctx);
    expect(() => q.push(new ArrayBuffer(5))).not.toThrow();
    expect(started).toHaveLength(1);
  });
});
