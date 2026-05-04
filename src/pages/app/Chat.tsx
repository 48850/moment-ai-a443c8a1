import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Sparkles, CheckCircle2 } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { selectChatSnapshot } from "@/lib/selectors/chat";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SCHEDULE_FIELDS: { key: string; label: string }[] = [
  { key: "school_end_time", label: "School end time" },
  { key: "commute_minutes", label: "Commute time" },
  { key: "sleep_floor_time", label: "Latest bedtime" },
  { key: "sleep_target_time", label: "Target sleep time" },
  { key: "study_minutes_daily", label: "Daily study time" },
  { key: "exercise_minutes_daily", label: "Daily exercise" },
  { key: "fixed_commitments", label: "Fixed commitments" },
];

const TypingDots = () => (
  <div className="inline-flex items-center gap-1 rounded-2xl bg-secondary px-3 py-2">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
        style={{ animationDelay: `${i * 120}ms` }}
      />
    ))}
  </div>
);

const Chat = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const applyPatch = useStateStore((s) => s.applyPatch);

  const greeting = useMemo<ChatMessage>(
    () => ({
      id: "greet",
      role: "assistant",
      content: state?.active_goal?.statement
        ? `Hey ${state?.profile.display_name ?? "there"} — let's clear the first three: what time does school end, how long is your commute home, and what's your target bedtime?`
        : `Hey ${state?.profile.display_name ?? "there"} — what's the one goal you want this app pointed at right now?`,
    }),
    [state?.profile.display_name, state?.active_goal?.statement],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Reset greeting only on first mount with state
  useEffect(() => {
    setMessages((prev) => (prev.length <= 1 ? [greeting] : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.user_id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Compute which schedule fields are still unknown
  const filled = useMemo(() => {
    const c = state?.constraints;
    return {
      school_end_time: !!c?.school_end_time,
      commute_minutes: !!c?.commute_minutes,
      sleep_floor_time: !!c?.sleep_floor_time,
      sleep_target_time: !!c?.sleep_target_time,
      study_minutes_daily: !!c?.study_minutes_daily,
      exercise_minutes_daily: !!c?.exercise_minutes_daily,
      fixed_commitments: !!(c?.fixed_commitments && c.fixed_commitments.length > 0),
    } as Record<string, boolean>;
  }, [state?.constraints]);

  const missing = SCHEDULE_FIELDS.filter((f) => !filled[f.key]).map((f) => f.label);

  const applyToolPatches = (
    patches: Array<{ tool: string; args: Record<string, any> }>,
  ) => {
    if (!state) return;

    let constraintsUpdate: Record<string, any> = {};
    let newCommitments: any[] = [];
    let goalUpdate: { statement: string; why_it_matters?: string } | null = null;

    for (const p of patches) {
      if (p.tool === "update_constraints") {
        constraintsUpdate = { ...constraintsUpdate, ...p.args };
      } else if (p.tool === "add_fixed_commitment") {
        newCommitments.push({
          id: crypto.randomUUID(),
          title: p.args.title || "Untitled",
          day_of_week: p.args.day_of_week || "",
          start_time: p.args.start_time || "",
          end_time: p.args.end_time || "",
          recurrence_type: "weekly",
          importance: p.args.importance || "important",
        });
      } else if (p.tool === "set_goal" && p.args.statement) {
        goalUpdate = { statement: p.args.statement, why_it_matters: p.args.why_it_matters };
      }
    }

    if (Object.keys(constraintsUpdate).length || newCommitments.length) {
      const merged = {
        ...state.constraints,
        ...constraintsUpdate,
        ...(newCommitments.length
          ? { fixed_commitments: [...state.constraints.fixed_commitments, ...newCommitments] }
          : {}),
        fixed_commitments_checked:
          state.constraints.fixed_commitments_checked ||
          newCommitments.length > 0,
        missing_fields: SCHEDULE_FIELDS.filter((f) => {
          const next: any = { ...state.constraints, ...constraintsUpdate };
          if (f.key === "fixed_commitments") {
            return (next.fixed_commitments?.length ?? 0) === 0 && newCommitments.length === 0;
          }
          return !next[f.key];
        }).map((f) => f.key),
      };
      applyPatch({ constraints: merged });
    }

    if (goalUpdate) {
      dispatch({
        type: "goal/patch",
        payload: {
          statement: goalUpdate.statement,
          why_it_matters: goalUpdate.why_it_matters ?? state.active_goal.why_it_matters,
        },
      });
    }

    if (patches.length) {
      const summary = patches
        .map((p) => {
          if (p.tool === "update_constraints") {
            return Object.keys(p.args).join(", ");
          }
          if (p.tool === "add_fixed_commitment") return `commitment: ${p.args.title}`;
          if (p.tool === "set_goal") return "goal";
          return p.tool;
        })
        .join(" · ");
      toast.success(`Saved across the app: ${summary}`);
    }
  };

  const onSendMessage = async (text: string) => {
    if (!text.trim() || !state) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const snapshot = selectChatSnapshot(state);

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("chat-coach", {
        body: { messages: apiMessages, snapshot },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const reply = ((data as any).reply as string) || "";
      const patches = ((data as any).patches ?? []) as Array<{
        tool: string;
        args: Record<string, any>;
      }>;

      applyToolPatches(patches);

      // Never surface "(no reply)" — synthesize a contextual fallback so the
      // chat always feels alive, even when the model only emits tool calls.
      let display = reply.trim();
      if (!display) {
        if (patches.length) {
          display = "Got it — pulled that into your plan. What else?";
        } else if (snapshot.next_move) {
          display = `Your next move is "${snapshot.next_move.title}" (${snapshot.next_move.estimated_minutes}m). Want help shrinking it?`;
        } else if (snapshot.missing_schedule_info.length) {
          display = `Quickly — what's your ${snapshot.missing_schedule_info[0].replace(/_/g, " ")}?`;
        } else {
          display = "Tell me where you're stuck or what just happened.";
        }
      }

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: display,
        },
      ]);
    } catch (e: any) {
      toast.error(e?.message || "Chat failed");
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry — I couldn't reach the coach. Try again in a moment.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-2xl flex-col md:h-[calc(100vh-7rem)]">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">/ chat</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Talk it out with Moment</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            What you share here flows into your plan, schedule, and goal.
          </p>
        </div>
      </div>

      {/* Schedule Info status — what chat is filling in for the rest of the app */}
      <section className="mb-3 rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" /> schedule info
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          {SCHEDULE_FIELDS.map((f) => {
            const done = filled[f.key];
            return (
              <li key={f.key} className="flex items-center gap-2 text-xs">
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
                )}
                <span className={done ? "text-foreground" : "text-muted-foreground"}>
                  {f.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%] space-y-1.5">
              <div
                className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.id !== "greet" && (
                <FeedbackChips
                  source="chat"
                  targetId={m.id}
                  groups={["value", "tone", "fit"]}
                  compact
                />
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <TypingDots />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSendMessage(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={missing.length ? `Tell Moment your ${missing[0].toLowerCase()}…` : "Message Moment…"}
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={isTyping || !input.trim()}
          className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export default Chat;
