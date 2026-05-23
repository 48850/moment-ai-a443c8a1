import { MomentStar } from "@/components/app/Mote";
import { useNavigate } from "react-router-dom";
import { Users, Settings2, Send } from "lucide-react";

export function EmptyConnections({
  tab,
  onFindAligned,
}: {
  tab: "friends" | "aligned";
  onFindAligned?: () => void;
}) {
  const navigate = useNavigate();
  const friendly = tab === "friends" ? "No friends connected yet." : "No aligned activity yet.";
  const help =
    tab === "friends"
      ? "Find people with aligned goals or invite a friend."
      : "Turn on aligned-goal discovery so people with similar goals appear here.";

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <div className="mx-auto w-fit"><MomentStar size={48} mood="calm" /></div>
      <p className="mt-3 text-sm text-foreground">{friendly}</p>
      <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onFindAligned}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/15"
        >
          <Users className="h-3.5 w-3.5" /> Find aligned people
        </button>
        <button
          type="button"
          onClick={() => navigator.share?.({ title: "Moment", text: "Move with me on Moment.", url: window.location.origin }).catch(() => {})}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Send className="h-3.5 w-3.5" /> Invite a friend
        </button>
        <button
          type="button"
          onClick={() => navigate("/app/settings/privacy")}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" /> Discovery settings
        </button>
      </div>
    </div>
  );
}
