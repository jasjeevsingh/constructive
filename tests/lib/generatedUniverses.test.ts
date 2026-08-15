import { describe, it, expect, beforeEach } from "vitest";
import {
  GENERATED_STORAGE_KEY,
  loadUniverses,
  saveUniverses,
  universeKey,
  type GeneratedStore,
} from "@/lib/state/generatedUniverses";

beforeEach(() => localStorage.clear());

const store: GeneratedStore = {
  naruto: {
    universe: "Naruto",
    createdAt: "2026-08-14T00:00:00.000Z",
    motions: [
      { id: "gen:naruto:0", motion: "M", keywords: [{ word: "villages", hint: null }], hook: "H", sides: null },
    ],
  },
};

describe("generatedUniverses store", () => {
  it("round-trips through localStorage", () => {
    saveUniverses(localStorage, store);
    expect(loadUniverses(localStorage)).toEqual(store);
  });
  it("returns {} for empty or corrupt storage", () => {
    expect(loadUniverses(localStorage)).toEqual({});
    localStorage.setItem(GENERATED_STORAGE_KEY, "not json");
    expect(loadUniverses(localStorage)).toEqual({});
  });
  it("drops malformed entries but keeps valid ones", () => {
    localStorage.setItem(
      GENERATED_STORAGE_KEY,
      JSON.stringify({ ...store, broken: { universe: 5, motions: "nope" } })
    );
    const loaded = loadUniverses(localStorage);
    expect(Object.keys(loaded)).toEqual(["naruto"]);
  });
  it("universeKey slugs the universe name", () => {
    expect(universeKey("Harry Potter")).toBe("harry-potter");
  });
});
