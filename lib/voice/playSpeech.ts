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
 * Fetch the avatar reply from the regular turn endpoint, split into
 * sentences, fire TTS per sentence in parallel, and play audio in order.
 * Returns the full text for transcript storage.
 * Audio playback continues in the background after the text is returned.
 */
export async function speakCoachStreaming(
  turnReqBody: object,
): Promise<string> {
  const seq = ++speakSeq;
  stopSpeech();

  const res = await fetch("/api/avatar/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(turnReqBody),
  });

  if (!res.ok) return "";

  const { text } = await res.json().catch(() => ({ text: "" }));
  if (!text || seq !== speakSeq) return text ?? "";

  const { sentences, remainder } = splitSentences(text);
  const lastChunk = remainder.trim();
  if (lastChunk) sentences.push(lastChunk);

  const audioQueue = sentences.map((s) => fetchTTS(s));
  void drainAudioQueue(audioQueue, seq);

  return text;
}
