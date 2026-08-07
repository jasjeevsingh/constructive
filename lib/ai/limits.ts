/** Shared input caps for paid voice routes — bounds TTS/STT cost and payload memory. */
export const MAX_SPEAK_TEXT_LENGTH = 4000;
export const MAX_TRANSCRIBE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_LIVE_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB
