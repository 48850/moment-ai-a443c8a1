import { useEffect, useState } from "react";
import { Inbox, Check, X } from "lucide-react";
import { MomentStar } from "@/components/app/Mote";
import {
  fetchIncomingRequests,
  acceptFollow,
  declineFollow,
  type Profile,
} from "@/lib/social/api";

export function FollowRequests({ uid }: { uid: string }) {
  const [requests, setRequests] = useState<Profile[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setRequests(await fetchIncomingRequests(uid));
  }
  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function accept(p: Profile) {
    setBusyId(p.id);
    await acceptFollow(uid, p.id);
    await refresh();
    setBusyId(null);
  }
  async function decline(p: Profile) {
    setBusyId(p.id);
    await declineFollow(uid, p.id);
    await refresh();
    setBusyId(null);
  }

  if (loading || requests.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] p-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300/80">
        <Inbox className="h-3 w-3" /> Friend requests · {requests.length}
      </p>
      <ul className="mt-3 space-y-3">
        {requests.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <MomentStar size={32} mood="calm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{p.display_name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                @{p.handle ?? "—"}{p.main_goal ? ` · ${p.main_goal}` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={busyId === p.id}
              onClick={() => accept(p)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200 hover:bg-emerald-400/15 disabled:opacity-60"
              aria-label="Accept"
            >
              <Check className="h-3.5 w-3.5" /> Accept
            </button>
            <button
              type="button"
              disabled={busyId === p.id}
              onClick={() => decline(p)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-60"
              aria-label="Decline"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
