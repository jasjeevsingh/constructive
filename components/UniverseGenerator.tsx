"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pressable } from "@/components/ui/motion";
import {
  loadUniverses,
  saveUniverses,
  universeKey,
  type GeneratedStore,
  type StoredMotionCard,
} from "@/lib/state/generatedUniverses";
import { assembleFlowMotion, motionCardId, normalizeMotionText } from "@/lib/generatedNormalize";
import type { FlowMotion, GeneratedSides } from "@/lib/schemas";

export function UniverseGenerator({ onOpen }: { onOpen: (motion: FlowMotion) => void }) {
  const [input, setInput] = useState("");
  const [store, setStore] = useState<GeneratedStore>({});
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    setStore(loadUniverses(window.localStorage));
  }, []);

  function persist(next: GeneratedStore) {
    setStore(next);
    saveUniverses(window.localStorage, next);
  }

  async function generate() {
    const universe = input.trim();
    if (!universe || status === "loading") return;
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/generate/motions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ universe }),
      });
      if (!res.ok) throw new Error("generation failed");
      const data = await res.json();
      if (data.refused) {
        setMessage(data.reason);
        return;
      }
      const key = universeKey(universe);
      const motions: StoredMotionCard[] = data.motions.map((m: { motion: string; keywords: unknown; hook: string }, i: number) => ({
        id: motionCardId(universe, i),
        motion: normalizeMotionText(m.motion),
        keywords: m.keywords as StoredMotionCard["keywords"],
        hook: m.hook,
        sides: null,
      }));
      persist({ ...store, [key]: { universe, createdAt: new Date().toISOString(), motions } });
      setInput("");
    } catch {
      setMessage("Couldn't generate right now — try again.");
    } finally {
      setStatus("idle");
    }
  }

  async function openCard(key: string, card: StoredMotionCard) {
    if (openingId) return;
    if (card.sides) {
      onOpen(assembleFlowMotion(card.id, card.motion, card.keywords, card.sides));
      return;
    }
    setOpeningId(card.id);
    setMessage(null);
    try {
      const res = await fetch("/api/generate/scaffold", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ universe: store[key].universe, motion: card.motion }),
      });
      if (!res.ok) throw new Error("scaffold failed");
      const data = await res.json();
      if (data.refused) {
        setMessage(data.reason);
        return;
      }
      const sides = data.sides as GeneratedSides;
      const nextCard: StoredMotionCard = { ...card, sides };
      const next: GeneratedStore = {
        ...store,
        [key]: { ...store[key], motions: store[key].motions.map((m) => (m.id === card.id ? nextCard : m)) },
      };
      persist(next);
      onOpen(assembleFlowMotion(nextCard.id, nextCard.motion, nextCard.keywords, sides));
    } catch {
      setMessage("Couldn't build that debate — try another.");
    } finally {
      setOpeningId(null);
    }
  }

  function removeUniverse(key: string) {
    const next = { ...store };
    delete next[key];
    persist(next);
  }

  const universes = Object.entries(store);

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold text-foreground">Bring your own universe</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Name a book, show, or game you love and we&apos;ll build debates from it.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          aria-label="Fictional universe"
          placeholder="Try Harry Potter, Naruto, Lord of the Rings…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void generate(); }}
          className="max-w-xs"
          maxLength={100}
        />
        <Button type="button" onClick={() => void generate()} disabled={status === "loading" || !input.trim()}>
          {status === "loading" ? "Generating…" : "Generate"}
        </Button>
      </div>
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}

      {universes.map(([key, u]) => (
        <div key={key} className="mt-8">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-foreground">
              Your {u.universe} debates <span aria-hidden>✨</span>
            </h3>
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => removeUniverse(key)}>
              Remove
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {u.motions.map((card, i) => (
              <Pressable
                key={card.id}
                index={i}
                type="button"
                onClick={() => void openCard(key, card)}
                disabled={openingId === card.id}
                aria-label={`${card.motion} — ${card.sides ? "resume" : "start"}`}
                className="group flex flex-col rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
              >
                <Badge variant="secondary" className="self-start">✨ Generated</Badge>
                <div className="mt-3 font-display text-lg font-semibold leading-snug text-foreground">{card.motion}</div>
                <div className="mt-2 text-sm text-muted-foreground">{card.hook}</div>
                <div className="mt-3 text-sm font-medium text-primary">
                  {openingId === card.id ? "Building…" : card.sides ? "Resume →" : "Start →"}
                </div>
              </Pressable>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
