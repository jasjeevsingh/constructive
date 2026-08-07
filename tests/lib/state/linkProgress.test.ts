import { describe, it, expect, beforeEach } from "vitest";
import {
  emptyLinkProgress,
  loadLinkProgress,
  saveLinkProgress,
  LINK_STORAGE_KEY,
} from "@/lib/state/linkProgress";

describe("linkProgress store", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty progress when nothing stored", () => {
    expect(loadLinkProgress(localStorage, "s1")).toEqual(emptyLinkProgress());
  });

  it("round-trips under the versioned key", () => {
    saveLinkProgress(localStorage, "s1", { placedIds: ["c1", "c2"], held: true });
    expect(loadLinkProgress(localStorage, "s1")).toEqual({ placedIds: ["c1", "c2"], held: true });
    expect(localStorage.getItem(LINK_STORAGE_KEY)).toContain("s1");
  });

  it("keeps scenarios independent", () => {
    saveLinkProgress(localStorage, "s1", { placedIds: ["a"], held: false });
    saveLinkProgress(localStorage, "s2", { placedIds: ["b"], held: true });
    expect(loadLinkProgress(localStorage, "s1").placedIds).toEqual(["a"]);
    expect(loadLinkProgress(localStorage, "s2").held).toBe(true);
  });

  it("falls back to empty on corrupt storage", () => {
    localStorage.setItem(LINK_STORAGE_KEY, "{nope");
    expect(loadLinkProgress(localStorage, "s1")).toEqual(emptyLinkProgress());
  });

  it("drops malformed per-scenario entries but keeps valid ones", () => {
    localStorage.setItem(
      LINK_STORAGE_KEY,
      JSON.stringify({
        s1: { placedIds: "nope", held: false },
        s2: { placedIds: ["c1"], held: true },
      })
    );
    expect(loadLinkProgress(localStorage, "s1")).toEqual(emptyLinkProgress());
    expect(loadLinkProgress(localStorage, "s2")).toEqual({ placedIds: ["c1"], held: true });
  });
});
