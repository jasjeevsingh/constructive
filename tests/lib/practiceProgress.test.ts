import { describe, it, expect, beforeEach } from "vitest";
import {
  PRACTICE_STORAGE_KEY,
  loadPracticeCounts,
  incrementPracticeCount,
} from "@/lib/state/practiceProgress";

beforeEach(() => localStorage.clear());

describe("practiceProgress", () => {
  it("defaults to zeros when empty", () => {
    expect(loadPracticeCounts(localStorage)).toEqual({ claim: 0, link: 0, impact: 0 });
  });
  it("increments the right part and round-trips", () => {
    expect(incrementPracticeCount(localStorage, "link")).toEqual({ claim: 0, link: 1, impact: 0 });
    expect(incrementPracticeCount(localStorage, "link")).toEqual({ claim: 0, link: 2, impact: 0 });
    expect(loadPracticeCounts(localStorage)).toEqual({ claim: 0, link: 2, impact: 0 });
  });
  it("returns zeros on corrupt or malformed storage", () => {
    localStorage.setItem(PRACTICE_STORAGE_KEY, "not json");
    expect(loadPracticeCounts(localStorage)).toEqual({ claim: 0, link: 0, impact: 0 });
    localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({ claim: "x" }));
    expect(loadPracticeCounts(localStorage)).toEqual({ claim: 0, link: 0, impact: 0 });
  });
});
