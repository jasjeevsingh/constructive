"use client";
import { useState } from "react";
import { getFlowMotions } from "@/lib/flowMotions";
import { FlowShell } from "@/components/FlowShell";

export function FlowDeck() {
  const motions = getFlowMotions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = motions.find((m) => m.id === activeId);

  if (active) return <FlowShell motion={active} onExit={() => setActiveId(null)} />;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 className="serif">Constructive</h1>
      <p style={{ color: "var(--dim)" }}>Pick a motion and work it through: Read → Claim → Link → Impact.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
        {motions.map((m) => (
          <button key={m.id} type="button" onClick={() => setActiveId(m.id)} style={{ width: 220, textAlign: "left", background: "var(--navy-mid)", color: "var(--text)", border: "1px solid #24344f", borderRadius: 12, padding: 16 }}>
            <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>{m.id}</span>
            <div style={{ marginTop: 6 }}>{m.motion}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
