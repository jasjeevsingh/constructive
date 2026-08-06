"use client";
import { useState } from "react";
import { getMotions } from "@/lib/motions";
import { MotionCard } from "@/components/MotionCard";

export function Deck() {
  const motions = getMotions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = motions.find((m) => m.id === activeId);

  if (active) return <MotionCard motion={active} onExit={() => setActiveId(null)} />;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 className="serif">Motion Reader</h1>
      <p style={{ color: "var(--dim)" }}>Pick a motion to work through.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
        {motions.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveId(m.id)}
            style={{ width: 200, textAlign: "left", background: "var(--navy-mid)", color: "var(--text)", border: "1px solid #24344f", borderRadius: 12, padding: 16 }}
          >
            <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>{m.id}</span>
            <div style={{ marginTop: 6 }}>{m.motion}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
