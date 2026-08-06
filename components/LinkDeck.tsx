"use client";
import { useState } from "react";
import { getScenarios } from "@/lib/linkScenarios";
import { LinkCard } from "@/components/LinkCard";

export function LinkDeck() {
  const scenarios = getScenarios();
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = scenarios.find((s) => s.id === activeId);

  if (active) return <LinkCard scenario={active} onExit={() => setActiveId(null)} />;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 className="serif">Link Builder</h1>
      <p style={{ color: "var(--dim)" }}>Pick a scenario and build the bridge from claim to impact.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            style={{ width: 220, textAlign: "left", background: "var(--navy-mid)", color: "var(--text)", border: "1px solid #24344f", borderRadius: 12, padding: 16 }}
          >
            <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>{s.id}</span>
            <div style={{ marginTop: 6 }}>{s.claim}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
