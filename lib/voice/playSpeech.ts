let activeAudio: HTMLAudioElement | null = null;
let speakSeq = 0;

/** Stop any in-flight speech. */
export function stopSpeech(): void {
  speakSeq++;
  if (activeAudio) {
    activeAudio.pause();
    URL.revokeObjectURL(activeAudio.src);
    activeAudio = null;
  }
}

/** Speak coach feedback via Deepgram Aura (/api/speak). Stops any in-flight speech first. */
export async function speakCoach(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  const seq = ++speakSeq;
  if (activeAudio) {
    activeAudio.pause();
    URL.revokeObjectURL(activeAudio.src);
    activeAudio = null;
  }

  const res = await fetch("/api/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: trimmed }),
  });
  if (!res.ok || seq !== speakSeq) return;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("audio/")) return;

  const blob = await res.blob();
  if (seq !== speakSeq) return;

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  activeAudio = audio;
  audio.onended = () => {
    URL.revokeObjectURL(url);
    if (activeAudio === audio) activeAudio = null;
  };
  try {
    await audio.play();
  } catch {
    URL.revokeObjectURL(url);
    if (activeAudio === audio) activeAudio = null;
  }
}

const SENTENCE_RE = /[.!?]+[\s]+/;

function splitSentences(buffer: string): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let rest = buffer;
  for (;;) {
    const match = SENTENCE_RE.exec(rest);
    if (!match) break;
    const end = match.index + match[0].length;
    const sentence = rest.slice(0, end).trim();
    if (sentence) sentences.push(sentence);
    rest = rest.slice(end);
  }
  return { sentences, remainder: rest };
}

function playBlob(blob: Blob, seq: number): Promise<void> {
  return new Promise((resolve) => {
    if (seq !== speakSeq) { resolve(); return; }
    if (blob.size === 0) { resolve(); return; }
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    activeAudio = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (activeAudio === audio) activeAudio = null;
      resolve();
    };
    audio.play().catch(() => {
      URL.revokeObjectURL(url);
      if (activeAudio === audio) activeAudio = null;
      resolve();
    });
  });
}

async function fetchTTS(sentence: string): Promise<Blob | null> {
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: sentence }),
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Play a queue of audio blobs in order. Fire-and-forget.
 */
async function drainAudioQueue(queue: Promise<Blob | null>[], seq: number): Promise<void> {
  for (const pending of queue) {
    if (seq !== speakSeq) return;
    const blob = await pending;
    if (blob && seq === speakSeq) {
      await playBlob(blob, seq);
    }
  }
}

/**
 * Stream LLM text from the SSE turn-stream endpoint, split into sentences,
 * fire TTS per sentence, and play audio segments in order.
 * Returns the full accumulated text for transcript storage.
 * Audio playback continues in the background after the text is returned.
 */
export async function speakCoachStreaming(
  turnReqBody: object,
): Promise<string> {
  const seq = ++speakSeq;
  stopSpeech();

  const res = await fetch("/api/avatar/turn-stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(turnReqBody),
  });

  if (!res.ok || !res.body) {
    const fallback = await res.json().catch(() => ({ text: "" }));
    return fallback.text ?? "";
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const audioQueue: Promise<Blob | null>[] = [];

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (seq !== speakSeq) break;

      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]" || payload === '"[ERROR]"') continue;

        try {
          const chunk: string = JSON.parse(payload);
          fullText += chunk;
          buffer += chunk;
        } catch {
          continue;
        }

        const { sentences, remainder } = splitSentences(buffer);
        buffer = remainder;
        for (const sentence of sentences) {
          audioQueue.push(fetchTTS(sentence));
        }
      }
    }
  } catch {
    // Stream read error — work with what we have
  }

  // Flush remaining text as a final sentence
  const remaining = buffer.trim();
  if (remaining) {
    audioQueue.push(fetchTTS(remaining));
  }

  // Start audio playback in the background — don't block text return
  void drainAudioQueue(audioQueue, seq);

  return fullText;
}
