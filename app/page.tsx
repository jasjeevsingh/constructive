import type { CSSProperties } from "react";

const card: CSSProperties = {
  width: 220,
  textAlign: "left",
  display: "block",
  textDecoration: "none",
  background: "var(--navy-mid)",
  color: "var(--text)",
  border: "1px solid #24344f",
  borderRadius: 12,
  padding: 16,
};

export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 24 }}>
      <h1 className="serif">Constructive</h1>
      <p style={{ color: "var(--dim)" }}>Pick an activity.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 18 }}>
        <a href="/motions" style={card}>
          <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>ACTIVITY 01</span>
          <div style={{ marginTop: 6, fontWeight: 700 }}>Motion Reader</div>
          <div style={{ color: "var(--dim)", fontSize: 13 }}>Learn to read a debate motion.</div>
        </a>
        <a href="/link" style={card}>
          <span className="accent" style={{ color: "var(--gold)", fontSize: 12 }}>ACTIVITY 02</span>
          <div style={{ marginTop: 6, fontWeight: 700 }}>Link Builder</div>
          <div style={{ color: "var(--dim)", fontSize: 13 }}>Build the bridge from claim to impact.</div>
        </a>
        <div style={{ ...card, opacity: 0.5 }} aria-disabled="true">
          <span className="accent" style={{ color: "var(--dim)", fontSize: 12 }}>ACTIVITY 03</span>
          <div style={{ marginTop: 6, fontWeight: 700 }}>Debate Avatar</div>
          <div style={{ color: "var(--dim)", fontSize: 13 }}>Coming soon.</div>
        </div>
      </div>
    </main>
  );
}
