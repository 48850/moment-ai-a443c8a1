import { MomentStar } from "@/components/app/Mote";
import { useNavigate } from "react-router-dom";
import { Users, Settings2, Send } from "lucide-react";
import { toast } from "sonner";
import { useSettingsStore } from "@/stores/settings-store";
import { useAuth } from "@/hooks/use-auth";

export function EmptyConnections({
  tab,
  onFindAligned,
}: {
  tab: "friends" | "aligned";
  onFindAligned?: () => void;
}) {
  const navigate = useNavigate();
  const alignedOptIn = useSettingsStore((s) => s.privacy.aligned_goal_discovery);
  const { uid } = useAuth();
  const friendly = tab === "friends" ? "No friends connected yet." : "No aligned activity yet.";
  const help =
    tab === "friends"
      ? "Find people with aligned goals or invite a friend."
      : "Turn on aligned-goal discovery so people with similar goals appear here.";

  const handleInvite = async () => {
    const url = `${window.location.origin}/auth${uid ? `?invited_by=${uid}` : ""}`;
    const shareData = {
      title: "Moment",
      text: "Move with me on Moment.",
      url,
    };
    try {
      if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // user dismissed or share failed → fall through to copy
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied", { description: url });
    } catch {
      toast.message("Share this link", { description: url });
    }
  };

  const handleFindAligned = () => {
    if (!alignedOptIn) {
      toast.message("Turn on aligned discovery", {
        description: "We'll take you to privacy settings to enable it.",
      });
      navigate("/app/settings/privacy");
      return;
    }
    onFindAligned?.();
  };

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <div className="mx-auto w-fit"><MomentStar size={48} mood="calm" /></div>
      <p className="mt-3 text-sm text-foreground">{friendly}</p>
      <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleFindAligned}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/15"
        >
          <Users className="h-3.5 w-3.5" /> Find aligned people
        </button>
        <button
          type="button"
          onClick={handleInvite}
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
