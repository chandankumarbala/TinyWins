import { useEffect, useRef, useState } from "react";
import { breakdownSchema, type Breakdown } from "../shared/ai";

export function AiComposer({
  goal,
  onAdd,
  onCancel,
}: {
  goal: string;
  onAdd: (batch: Breakdown) => boolean;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    onAddRef = useRef(onAdd),
    onCancelRef = useRef(onCancel);

  useEffect(() => {
    onAddRef.current = onAdd;
    onCancelRef.current = onCancel;
  }, [onAdd, onCancel]);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    async function generate() {
      if (!goal.trim()) return;
      setBusy(true);
      setError("");
      try {
        const available = await checkAvailable(controller.signal);
        if (!available) return;
        const response = await fetch("/api/ai/breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Tiny-Wins": "1" },
          body: JSON.stringify({ goal: goal.trim() }),
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error?.message ?? "Generation failed. Try again.",
          );
        const batch = breakdownSchema.parse(body);
        if (alive.current && !controller.signal.aborted) {
          if (onAddRef.current(batch)) onCancelRef.current();
          else
            setError(
              "Tasks could not be saved. Resolve the storage error, then retry adding tasks.",
            );
        }
      } catch (e) {
        if (alive.current && !controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Generation failed. Try again.",
          );
      } finally {
        if (alive.current) setBusy(false);
      }
    }
    async function checkAvailable(signal: AbortSignal) {
      try {
        const response = await fetch("/api/ai/status", { signal });
        if (!response.ok) throw new Error("status unavailable");
        const status = await response.json();
        const next = status.available === true;
        if (alive.current && !signal.aborted && !next)
          setError("Configure OPENAI_API_KEY on the local helper, then retry.");
        return next;
      } catch {
        if (alive.current && !signal.aborted)
          setError("Start the local AI helper with npm run dev, then retry.");
        return false;
      }
    }
    void generate();
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [goal]);

  return (
    <section className="ai-composer" aria-label="AI task breakdown">
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Breaking work into small steps...</p>}
    </section>
  );
}
