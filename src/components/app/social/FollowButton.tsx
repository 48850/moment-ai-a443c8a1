import { useState } from "react";
import { Check, Plus, Clock } from "lucide-react";
import { followUser, unfollow } from "@/lib/social/api";

export function FollowButton({
  uid,
  targetId,
  initial,
  onChange,
}: {
  uid: string;
  targetId: string;
  initial: "none" | "pending" | "accepted";
  onChange?: (s: "none" | "pending" | "accepted") => void;
}) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;
    setBusy(true);
    try {
      if (status === "none") {
        await followUser(uid, targetId);
        setStatus("pending");
        onChange?.("pending");
      } else {
        await unfollow(uid, targetId);
        setStatus("none");
        onChange?.("none");
      }
    } finally {
      setBusy(false);
    }
  }

  const label =
    status === "accepted" ? "Following" : status === "pending" ? "Requested" : "Follow";
  const Icon = status === "accepted" ? Check : status === "pending" ? Clock : Plus;

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
        status === "none"
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      } disabled:opacity-60`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
