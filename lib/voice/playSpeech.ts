let activeAudio: HTMLAudioElement | null = null;
let speakSeq = 0;

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
