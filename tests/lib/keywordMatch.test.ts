import { describe, it, expect } from "vitest";
import { segmentMotion } from "@/lib/keywordMatch";
import type { Keyword } from "@/lib/schemas";

function concatenated(segments: { text: string; keyword: Keyword | null }[]): string {
  return segments.map((s) => s.text).join("");
}

describe("segmentMotion", () => {
  it("matches a multi-word keyword as a single segment", () => {
    const motion = "This House would ban social media for under-16s.";
    const keywords: Keyword[] = [
      { word: "social media", hint: null },
      { word: "under-16s", hint: null },
    ];

    const segments = segmentMotion(motion, keywords);

    expect(concatenated(segments)).toBe(motion);

    const socialMediaSegment = segments.find((s) => s.text === "social media");
    expect(socialMediaSegment).toBeDefined();
    expect(socialMediaSegment?.keyword).toEqual(keywords[0]);

    const under16sSegment = segments.find((s) => s.text === "under-16s");
    expect(under16sSegment).toBeDefined();
    expect(under16sSegment?.keyword).toEqual(keywords[1]);
  });

  it("still matches a single-word keyword, excluding trailing punctuation", () => {
    const motion = "This House would let kids vote.";
    const keywords: Keyword[] = [{ word: "vote", hint: null }];

    const segments = segmentMotion(motion, keywords);

    expect(concatenated(segments)).toBe(motion);

    const voteSegment = segments.find((s) => s.keyword !== null);
    expect(voteSegment?.text).toBe("vote");
  });

  it("matches case-insensitively but preserves original casing in text", () => {
    const motion = "This House would ban Social Media for under-16s.";
    const keywords: Keyword[] = [{ word: "social media", hint: null }];

    const segments = segmentMotion(motion, keywords);

    expect(concatenated(segments)).toBe(motion);

    const match = segments.find((s) => s.keyword !== null);
    expect(match?.text).toBe("Social Media");
    expect(match?.keyword).toEqual(keywords[0]);
  });

  it("does not match a keyword that only appears as a substring of a larger word", () => {
    const motion = "The voter turned out to vote.";
    const keywords: Keyword[] = [{ word: "vote", hint: null }];

    const segments = segmentMotion(motion, keywords);

    expect(concatenated(segments)).toBe(motion);

    const matches = segments.filter((s) => s.keyword !== null);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("vote");
  });

  it("prefers the longest matching keyword when keywords overlap", () => {
    const motion = "This House would ban social media for under-16s.";
    const keywords: Keyword[] = [
      { word: "social", hint: null },
      { word: "social media", hint: null },
    ];

    const segments = segmentMotion(motion, keywords);

    expect(concatenated(segments)).toBe(motion);

    const matches = segments.filter((s) => s.keyword !== null);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("social media");
    expect(matches[0].keyword).toEqual(keywords[1]);
  });

  it("returns the whole motion as a single null-keyword segment when there are no keywords", () => {
    const motion = "This House would ban nothing.";
    const segments = segmentMotion(motion, []);

    expect(concatenated(segments)).toBe(motion);
    expect(segments.every((s) => s.keyword === null)).toBe(true);
  });
});
