import { useEffect, useState } from "react";
import { toggleReaction } from "@/lib/social/api";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const PRESETS: { kind: string; label: string }[] = [
  { kind: "nice", label: "Nice" },
  { kind: "still_moving", label: "Still moving" },
  { kind: "good_reset", label: "Good reset" },
  { kind: "big_brain", label: "Big brain" },
  { kind: "review_saved", label: "Review saved" },
  { kind: "keep_going", label: "Keep going" },
];

export function ReactionBar({ eventId }: { eventId: string }) {
  const { uid } = useAuth();
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data } = await supabase.from("reactions").select("kind,user_id").eq("event_id", eventId);
      if (!alive) return;
      const m = new Set<string>();
      const c: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        c[r.kind] = (c[r.kind] ?? 0) + 1;
        if (uid && r.user_id === uid) m.add(r.kind);
      });
      setMine(m);
      setCounts(c);
    }
    load();
    return () => {
      alive = false;
    };
  }, [eventId, uid]);

  async function toggle(kind: string) {
    if (!uid) return;
    const had = mine.has(kind);
    // optimistic
    setMine((s) => {
      const n = new Set(s);
      had ? n.delete(kind) : n.add(kind);
      return n;
    });
    setCounts((c) => ({ ...c, [kind]: Math.max(0, (c[kind] ?? 0) + (had ? -1 : 1)) }));
    await toggleReaction(uid, eventId, kind);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => {
        const active = mine.has(p.kind);
        const n = counts[p.kind] ?? 0;
        return (
          <button
            key={p.kind}
            type="button"
            disabled={!uid}
            onClick={() => toggle(p.kind)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              active
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
            } disabled:opacity-50`}
          >
            {p.label}
            {n > 0 && <span className="ml-1 font-mono text-[10px] opacity-70">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
