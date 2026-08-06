"use client";
import { useState } from "react";
import type { CoachResponse, RefineVerdict } from "@/lib/schemas";

const EMPTY = ["", "", ""];

export function ArgumentsStep({
  motion,
  onDone,
}: {
  motion: string;
  onDone: (args: { argsFor: string[]; argsAgainst: string[] }) => void;
}) {
  const [argsFor, setFor] = useState<string[]>([...EMPTY]);
  const [argsAgainst, setAgainst] = useState<string[]>([...EMPTY]);
  const [verdicts, setVerdicts] = useState<RefineVerdict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const allFilled = [...argsFor, ...argsAgainst].every((a) => a.trim().length > 0);

  function verdictFor(id: string) {
    return verdicts.find((v) => v.argumentId === id);
  }

  async function refine() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "refine", motion, payload: { argsFor, argsAgainst } }),
      });
      if (!res.ok) {
        setError("The coach is unavailable right now — you can keep going.");
        return;
      }
      const data: CoachResponse = await res.json();
      if (data.kind === "refine") setVerdicts(data.verdicts);
    } catch {
      setError("The coach is unavailable right now — you can keep going.");
    } finally {
      setLoading(false);
      setAttempted(true);
    }
  }

  function column(side: "for" | "against", values: string[], set: (v: string[]) => void) {
    return (
      <div>
        <h3 className="accent">{side === "for" ? "FOR" : "AGAINST"}</h3>
        {values.map((val, i) => {
          const v = verdictFor(`${side}-${i}`);
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              <textarea
                aria-label={`${side} argument ${i + 1}`}
                value={val}
                rows={2}
                onChange={(e) => {
                  const copy = [...values];
                  copy[i] = e.target.value;
                  set(copy);
                }}
                style={{ width: "100%" }}
              />
              {v && v.verdict !== "distinct" && v.question && (
                <p style={{ color: "var(--orange-light)", fontSize: 13 }}>💬 {v.question}</p>
              )}
              {v && v.verdict === "distinct" && (
                <p style={{ color: "#4fd08a", fontSize: 12 }}>✓ Distinct.</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {column("for", argsFor, setFor)}
        {column("against", argsAgainst, setAgainst)}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button type="button" onClick={refine} disabled={!allFilled || loading}>
          {loading ? "Refining…" : "Refine all six"}
        </button>
        {(verdicts.length > 0 || attempted) && (
          <button type="button" onClick={() => onDone({ argsFor, argsAgainst })}>
            Done
          </button>
        )}
      </div>
      {error && <p style={{ color: "var(--orange-light)", fontSize: 13, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
