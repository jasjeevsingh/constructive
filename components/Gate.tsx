"use client";
import { useState } from "react";

export function Gate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  async function submit() {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        setError(true);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "18vh auto", textAlign: "center" }}>
      <h1 className="serif">Constructive</h1>
      <p style={{ color: "var(--dim)" }}>Enter the password from your retreat packet.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        style={{ width: "100%", padding: 10, borderRadius: 10, marginTop: 12 }}
      />
      {error && <p style={{ color: "var(--orange)" }}>That password didn&apos;t work.</p>}
      <button type="button" onClick={submit} style={{ marginTop: 12 }}>
        Enter
      </button>
    </main>
  );
}
