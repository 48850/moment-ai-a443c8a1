import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Target, Activity, Flame, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStateStore } from "@/stores/state-store";
import { buildCoachContext, type CoachSurface } from "@/lib/coach/build-coach-context";
import { selectSeedActions } from "@/lib/coach/select-coach-actions";
import { parseCoachResponse } from "@/lib/coach/coach-response-schema";
import type { CoachAction, CoachResponse } from "@/lib/coach/coach-action-types";
import type { ChatMessage } from "@/lib/types";
import { CoachMessage } from "./CoachMessage";
import { CoachActionChip } from "./CoachActionChip";
import { Mote } from "@/components/app/Mote";

interface Props {
  surface?: CoachSurface;
  compact?: boolean;
}

interface RichMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  response?: CoachResponse;
}

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

export function CoachPanel({ surface = "coach", compact = false }: Props) {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);

  const persisted = state?.chat_messages ?? [];
  const [messages, setMessages] = useState<RichMessage[]>(() =>
    persisted.length
      ? persisted
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id ?? crypto.randomUUID(),
            role: m.role as "user" | "assistant",
            content: m.content ?? "",
            created_at: m.created_at ?? new Date().toISOString(),
          }))
      : [],
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const ctx = useMemo(
    () => buildCoachContext(state, { surface }),
    [state, surface],
  );

  const seedActions = useMemo(
    () => selectSeedActions(state, surface, ctx.inferred.state),
    [state, surface, ctx.inferred.state],
  );

  const goalSnippet = state?.active_goal?.statement?.slice(0, 60) ?? "";
  const nextProof = ctx.packet && "moment_memory" in ctx.packet
    ? (ctx.packet as any).moment_memory?.goal_profile?.next_proof
    : "";
  const pressure = ctx.packet && "plan_pressure" in ctx.packet
    ? (ctx.packet as any).plan_pressure
    : null;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !state || inFlight.current) return;
    inFlight.current = true;

    const userMsg: RichMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((m) => [...m, userMsg]);
    dispatch({
      type: "chat/append",
      payload: { id: userMsg.id, role: "user", content: trimmed, created_at: userMsg.created_at } as ChatMessage,
    });
    setInput("");
    setIsTyping(true);

    try {
      const coachCtx = buildCoachContext(state, { surface, latestUserText: trimmed });
      const apiMessages = [...messages, userMsg].slice(-16).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("chat-coach", {
        body: {
          kernel: true,
          messages: apiMessages,
          coach_context: coachCtx,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const parsed = parseCoachResponse(
        (data as any).response,
        (data as any).reply ?? "",
      );

      const assistantMsg: RichMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: parsed.reply || "…",
        created_at: new Date().toISOString(),
        response: parsed,
      };

      setMessages((m) => [...m, assistantMsg]);
      dispatch({
        type: "chat/append",
        payload: {
          id: assistantMsg.id,
          role: "assistant",
          content: assistantMsg.content,
          created_at: assistantMsg.created_at,
        } as ChatMessage,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Coach is offline.";
      toast.error(msg);
      const errMsg: RichMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I can't reach you right now — try once more in a moment.",
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, errMsg]);
    } finally {
      setIsTyping(false);
      inFlight.current = false;
    }
  };

  const handleConversational = (action: CoachAction) => {
    const prompts: Record<string, string> = {
      "explain.why_this_matters": "Remind me why this actually matters.",
      "path.show_proof": "What's my next real proof on the path?",
      "forge.create_artifact": "Turn this into something I can revise from.",
    };
    const text = prompts[action.type] ?? action.label;
    void send(text);
  };

  return (
    <div className={`flex flex-col ${compact ? "h-[70vh]" : "h-[calc(100vh-9rem)] md:h-[calc(100vh-7rem)]"}`}>
      {/* Coach knows — context header */}
      <section className="mb-3 rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Target className="h-3 w-3 text-primary" /> coach knows
          </div>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <Activity className="h-2.5 w-2.5" />
            {ctx.inferred.state.replace(/_/g, " ")}
          </div>
        </div>
        {goalSnippet && (
          <p className="mb-1 text-xs text-foreground leading-snug">
            <span className="text-muted-foreground">Goal · </span>
            {goalSnippet}
            {state?.active_goal?.statement && state.active_goal.statement.length > 60 ? "…" : ""}
          </p>
        )}
        {nextProof && (
          <p className="mb-1 text-xs text-muted-foreground leading-snug">
            <span className="text-muted-foreground/60">Next proof · </span>
            <span className="text-foreground">{nextProof}</span>
          </p>
        )}
        {pressure?.pressure_detected && (
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-600">
            <Flame className="h-3 w-3" />
            {pressure.pressure_message}
          </p>
        )}
      </section>

      {/* Seed actions */}
      {seedActions.length > 0 && messages.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {seedActions.map((a, i) => (
            <CoachActionChip
              key={`${a.type}-${i}`}
              action={a}
              onConversational={handleConversational}
            />
          ))}
        </div>
      )}

      {/* Thread */}
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
        {messages.length === 0 && (
          <div className="flex items-start gap-3 py-6">
            <Mote size={40} mood="calm" />
            <div className="space-y-1.5">
              <p className="text-sm text-foreground">
                I'm here. Tell me what's happening, or pick one of the chips above.
              </p>
              <p className="text-xs text-muted-foreground">
                I'll use what Moment already knows — no recap needed.
              </p>
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div className="max-w-[90%]">
                {m.response ? (
                  <CoachMessage
                    response={m.response}
                    onConversationalAction={handleConversational}
                  />
                ) : (
                  <div className="whitespace-pre-wrap rounded-2xl bg-secondary px-3.5 py-2 text-sm text-foreground">
                    {m.content}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {isTyping && (
          <div className="flex justify-start">
            <TypingDots />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isTyping) void send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isTyping ? "Coach is thinking…" : "Tell Moment what's going on…"}
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          disabled={isTyping}
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
}
