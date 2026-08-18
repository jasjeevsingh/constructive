/**
 * Shared input caps for the feedback route. Kept out of `lib/ai/limits.ts`,
 * which is scoped to paid voice routes (TTS/STT) — this cap bounds an
 * unauthenticated JSON POST, not AI spend, so it gets its own module.
 */
export const MAX_FEEDBACK_CONTEXT_BYTES = 16 * 1024; // 16 KB
