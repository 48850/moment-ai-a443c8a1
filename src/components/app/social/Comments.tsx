import { useEffect, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { addComment, deleteComment, fetchComments, type CommentRow } from "@/lib/social/api";

function rel(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString();
}

export function Comments({ uid, eventId }: { uid: string | null; eventId: string }) {
  const [items, setItems] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setItems(await fetchComments(eventId));
  }
  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !body.trim()) return;
    setBusy(true);
    try {
      await addComment(uid, eventId, body.trim().slice(0, 500));
      setBody("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Be the first to leave a kind word.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {c.author?.display_name ?? "Someone"}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    {rel(c.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 break-words text-[13px] text-foreground/90">{c.body}</p>
              </div>
              {c.user_id === uid && (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteComment(c.id);
                    refresh();
                  }}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {uid ? (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            type="text"
            value={body}
            maxLength={500}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Say something supportive…"
            className="flex-1 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : (
        <p className="text-[11px] text-muted-foreground">Sign in to leave a comment.</p>
      )}
    </div>
  );
}
