import { useEffect, useState } from "react";
import { MomentStar } from "@/components/app/Mote";
import { fetchAlignedPeople, fetchMyFollowsMap, type Profile } from "@/lib/social/api";
import { FollowButton } from "./FollowButton";
import { Users } from "lucide-react";

export function AlignedPeople({ uid }: { uid: string }) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [follows, setFollows] = useState<Record<string, "pending" | "accepted">>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAlignedPeople(uid), fetchMyFollowsMap(uid)])
      .then(([p, f]) => {
        setPeople(p);
        setFollows(f);
      })
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) return null;
  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-4 text-xs text-muted-foreground">
        No aligned people yet. Add goal tags in Profile settings so we can match you.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <Users className="h-3 w-3" /> Aligned people
      </p>
      <ul className="mt-3 space-y-3">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <MomentStar size={32} mood="calm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{p.display_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {p.main_goal || "shared goal tag"}
              </p>
            </div>
            <FollowButton
              uid={uid}
              targetId={p.id}
              initial={follows[p.id] ?? "none"}
              onChange={(s) => setFollows((m) => ({ ...m, [p.id]: s === "none" ? undefined as any : s }))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
