import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { MomentStar } from "@/components/app/Mote";
import { searchProfilesByHandle, fetchMyFollowsMap, type Profile } from "@/lib/social/api";
import { FollowButton } from "./FollowButton";

export function PeopleSearch({ uid }: { uid: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [follows, setFollows] = useState<Record<string, "pending" | "accepted">>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMyFollowsMap(uid).then(setFollows);
  }, [uid]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setBusy(true);
      try {
        setResults(await searchProfilesByHandle(q, uid));
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, uid]);

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <Search className="h-3 w-3" /> Find by @handle
      </p>
      <div className="mt-2 flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="@handle"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
      <ul className="mt-3 space-y-2">
        {busy && <li className="text-[11px] text-muted-foreground">Searching…</li>}
        {!busy && q.trim().length >= 2 && results.length === 0 && (
          <li className="text-[11px] text-muted-foreground">No matches for @{q.replace(/^@/, "")}.</li>
        )}
        {results.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <MomentStar size={28} mood="calm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{p.display_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">@{p.handle ?? "—"}</p>
            </div>
            <FollowButton
              uid={uid}
              targetId={p.id}
              initial={follows[p.id] ?? "none"}
              onChange={(s) =>
                setFollows((m) => {
                  const next = { ...m };
                  if (s === "none") delete next[p.id];
                  else next[p.id] = s;
                  return next;
                })
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
