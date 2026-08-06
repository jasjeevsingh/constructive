import type { Keyword } from "@/lib/schemas";

export type MotionSegment = {
  text: string;
  keyword: Keyword | null;
};

function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  return /[a-z0-9]/i.test(ch);
}

/**
 * Splits a motion string into an ordered list of segments, marking spans that
 * match a keyword (case-insensitively, on word boundaries, preferring the
 * longest match) with that keyword. Concatenating all `.text` values
 * reproduces the original motion string exactly.
 */
export function segmentMotion(motion: string, keywords: Keyword[]): MotionSegment[] {
  const candidates = keywords
    .filter((k) => k.word.trim().length > 0)
    .map((k) => ({ keyword: k, lower: k.word.toLowerCase() }))
    .sort((a, b) => b.lower.length - a.lower.length);

  const lowerMotion = motion.toLowerCase();
  const segments: MotionSegment[] = [];
  let runStart = 0;
  let i = 0;

  while (i < motion.length) {
    let matched: { keyword: Keyword; length: number } | null = null;

    for (const { keyword, lower } of candidates) {
      if (lower.length === 0) continue;
      if (lowerMotion.startsWith(lower, i)) {
        const before = i > 0 ? motion[i - 1] : undefined;
        const after = motion[i + lower.length];
        if (!isWordChar(before) && !isWordChar(after)) {
          matched = { keyword, length: lower.length };
          break; // candidates sorted longest-first
        }
      }
    }

    if (matched) {
      if (runStart < i) {
        segments.push({ text: motion.slice(runStart, i), keyword: null });
      }
      segments.push({ text: motion.slice(i, i + matched.length), keyword: matched.keyword });
      i += matched.length;
      runStart = i;
    } else {
      i += 1;
    }
  }

  if (runStart < motion.length) {
    segments.push({ text: motion.slice(runStart), keyword: null });
  }

  return segments;
}
