"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { collectFeedbackContext } from "@/lib/feedback/context";

export type FeedbackStatus = "idle" | "sending" | "sent" | "error";

// Auto-close delay after a successful send, so the tester sees the
// confirmation before the panel disappears.
const SENT_CLOSE_DELAY_MS = 1500;

/** Pure presentation — no fetch, no localStorage, no window. This is what
 *  tests drive directly. */
export function FeedbackPanelView({
  open,
  status,
  onOpen,
  onClose,
  onSubmit,
}: {
  open: boolean;
  status: FeedbackStatus;
  onOpen: () => void;
  onClose: () => void;
  onSubmit: (message: string) => void;
}) {
  const [text, setText] = useState("");

  // Clear the draft once a send has actually gone through. A failed send
  // must never land here — that's the one case where losing what someone
  // typed is worst.
  useEffect(() => {
    if (status === "sent") setText("");
  }, [status]);

  if (!open) {
    return (
      <div className="fixed bottom-4 left-4 z-40">
        <Button variant="outline" onClick={onOpen}>
          User feedback
        </Button>
      </div>
    );
  }

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-96">
      <Card className="border-border">
        <CardContent className="flex flex-col gap-3 p-4">
          <p className="text-xs text-muted-foreground">
            Something wrong, or an idea to share? Your current screen is attached automatically.
          </p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What happened?"
            rows={4}
            className="w-full resize-none rounded-lg border border-input bg-background p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {status === "sending" && "Sending…"}
              {status === "sent" && "Thanks — we got it."}
              {status === "error" && "Couldn't send. Try again?"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button size="sm" onClick={handleSend} disabled={status === "sending"}>
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Live wiring: reads the enable flag, owns fetch and localStorage, renders
 *  the view. */
export function FeedbackPanel() {
  // Inlined at build time — must stay a full static expression.
  const feedbackEnabled = process.env.NEXT_PUBLIC_FEEDBACK_ENABLED === "1";

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!feedbackEnabled) return null;

  const handleOpen = () => {
    setStatus("idle");
    setOpen(true);
  };

  const handleClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(false);
    setStatus("idle");
  };

  const handleSubmit = async (message: string) => {
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          path: window.location.pathname,
          context: collectFeedbackContext(window.localStorage, window.location.pathname),
        }),
      });
      if (res.ok) {
        setStatus("sent");
        closeTimerRef.current = setTimeout(() => {
          setOpen(false);
          setStatus("idle");
        }, SENT_CLOSE_DELAY_MS);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <FeedbackPanelView
      open={open}
      status={status}
      onOpen={handleOpen}
      onClose={handleClose}
      onSubmit={handleSubmit}
    />
  );
}
