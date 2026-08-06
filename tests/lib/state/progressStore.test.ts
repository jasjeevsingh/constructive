import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  STORAGE_KEY,
} from "@/lib/state/progressStore";

describe("progressStore", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty progress when nothing is stored", () => {
    const p = loadProgress(localStorage, "m1");
    expect(p).toEqual(emptyProgress());
    expect(p.step).toBe("restate");
  });

  it("round-trips a saved motion under the versioned key", () => {
    const p = { ...emptyProgress(), restate: "kids get a say", step: "keyword" as const };
    saveProgress(localStorage, "m1", p);
    expect(loadProgress(localStorage, "m1").restate).toBe("kids get a say");
    expect(localStorage.getItem(STORAGE_KEY)).toContain("m1");
  });

  it("keeps motions independent", () => {
    saveProgress(localStorage, "m1", { ...emptyProgress(), restate: "a" });
    saveProgress(localStorage, "m2", { ...emptyProgress(), restate: "b" });
    expect(loadProgress(localStorage, "m1").restate).toBe("a");
    expect(loadProgress(localStorage, "m2").restate).toBe("b");
  });

  it("tolerates corrupt storage by falling back to empty", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadProgress(localStorage, "m1")).toEqual(emptyProgress());
  });
});
