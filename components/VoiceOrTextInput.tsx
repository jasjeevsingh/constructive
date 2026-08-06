"use client";
import { useState } from "react";

function voiceSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function VoiceOrTextInput({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);

  async function record() {
    // Minimal batch capture: record one clip, POST to /api/transcribe, fill the textarea.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error(err);
      return;
    }
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      try {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "content-type": "audio/webm" },
          body: blob,
        });
        if (res.ok) {
          const { text: t } = await res.json();
          setText((prev) => (prev ? `${prev} ${t}` : t));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setRecording(false);
      }
    };
    rec.start();
    setRecording(true);
    // Stop after a short window; a fuller UI would use press-and-hold.
    setTimeout(() => rec.stop(), 6000);
  }

  return (
    <div>
      <label style={{ display: "block", marginBottom: 8, color: "var(--dim)" }}>{label}</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={{ width: "100%", background: "var(--navy-mid)", color: "var(--text)", border: "1px solid #24344f", borderRadius: 10, padding: 10 }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        {voiceSupported() && (
          <button type="button" onClick={record} disabled={recording}>
            {recording ? "Listening…" : "🎤 Hold to talk"}
          </button>
        )}
        <button type="button" onClick={() => onSubmit(text)}>
          Submit
        </button>
      </div>
    </div>
  );
}
