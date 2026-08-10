"use client";
import { STAGES, stageIndex, type FlowStage } from "@/lib/state/flowMachine";

const LABELS: Record<FlowStage, string> = { read: "Read the motion", claim: "Claim", link: "Link", impact: "Impact" };

export function FlowRail({ stage }: { stage: FlowStage }) {
  const cur = stageIndex(stage);
  return (
    <div style={{ width: 200, borderRight: "1px solid #22324c", padding: "16px 14px", background: "#0c1a2e" }}>
      <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 6 }}>Your progress</div>
      <div style={{ height: 5, background: "#22324c", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${(cur / (STAGES.length - 1)) * 100}%`, background: "var(--gold)" }} />
      </div>
      {STAGES.map((s, i) => (
        <div key={s} style={{ display: "flex", gap: 9, alignItems: "center", padding: "7px 0" }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, border: `2px solid ${i < cur ? "#3fae6b" : i === cur ? "var(--gold)" : "#2a3a52"}`, background: i < cur ? "#3fae6b" : "transparent", color: i < cur ? "#06210f" : i === cur ? "var(--gold)" : "var(--dim)" }}>
            {i < cur ? "✓" : i + 1}
          </span>
          <span style={{ color: i === cur ? "#fff" : i < cur ? "var(--text)" : "#5c6a7c", fontWeight: i === cur ? 700 : 400, fontSize: 14 }}>{LABELS[s]}</span>
        </div>
      ))}
    </div>
  );
}
