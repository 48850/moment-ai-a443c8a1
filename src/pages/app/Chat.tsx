import { Mote } from "@/components/app/Mote";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Sparkles, CheckCircle2, Target } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { selectChatSnapshot } from "@/lib/selectors/chat";
import { buildContextPacket } from "@/lib/ai/context-packet";
import { ChatContextBanner } from "@/components/app/chat/ChatContextBanner";
import type { ChatMessage } from "@/lib/types";

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
  const [searchParams] = useSearchParams();

  const specialisationComplete =
    state?.chat_state?.specialisation_phase === "complete" ||
    (Boolean(state?.active_goal?.current_stage?.trim()) && (state?.tasks?.length ?? 0) > 0);
  const isSpecialisation =
    !specialisationComplete &&
    (searchParams.get("mode") === "goal_specialisation" ||
      state?.chat_state?.post_onboarding_specialisation_required === true);

  const specialisationGreeting = useMemo<ChatMessage>(
    () => ({
      id: "spec-greet",
      role: "assistant" as const,
      content: state?.active_goal?.statement
        ? `Let's map out your path to "${state.active_goal.statement}". I'll ask you one question at a time to understand where you're starting from — that way I can give you the right first move, not a generic one. What's your current level in the area your goal requires?`
        : `You're all set. Let's figure out your first real move.`,
      created_at: new Date().toISOString(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state?.user_id],
  );

  const defaultGreeting = useMemo<ChatMessage>(() => {
    const name = state?.profile.display_name ? `Hey ${state.profile.display_name}` : "Hey";
    const hasGoal = Boolean(state?.active_goal?.statement?.trim());
    const missingCount = Object.values(state?.constraints ?? {}).filter(
      (v) => v === null || v === undefined || v === "" || v === 0,
    ).length;
    let content: string;
    if (!hasGoal) {
      content = `${name} — what's the one goal you want this app pointed at right now?`;
    } else if (missingCount > 4) {
      content = `${name} — what time does school finish, and how long is your commute home?`;
    } else {
      content = `${name} — what's on your mind? I can help with your goal, plan, or schedule.`;
    }
    return { id: "greet", role: "assistant" as const, content, created_at: new Date().toISOString() };
  }, [state?.profile.display_name, state?.active_goal?.statement, state?.constraints]);

  const initialGreeting = isSpecialisation ? specialisationGreeting : defaultGreeting;
  const persisted = state?.chat_messages;
  const [messages, setMessages] = useState<ChatMessage[]>(
    persisted && persisted.length ? persisted : [initialGreeting],
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [specialisationDone, setSpecialisationDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);

  // When mode switches or user changes, rehydrate or reset to correct greeting.
  // If there's no stored history, persist the greeting so the AI context is never empty.
  useEffect(() => {
    const stored = state?.chat_messages;
    const greeting = isSpecialisation ? specialisationGreeting : defaultGreeting;
    if (stored && stored.length) {
      setMessages(stored);
    } else {
      setMessages([greeting]);
      dispatch({ type: "chat/append", payload: greeting });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.user_id, isSpecialisation]);

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

    // ── Specialisation tools ────────────────────────────────────────────────
    let goalModelPatch: Record<string, any> | null = null;
    let firstTaskArgs: Record<string, any> | null = null;
    let shouldComplete = false;

    // ── Default constraint tools ────────────────────────────────────────────
    let constraintsUpdate: Record<string, any> = {};
    let newCommitments: any[] = [];
    let goalUpdate: { statement: string; why_it_matters?: string } | null = null;

    for (const p of patches) {
      if (p.tool === "patch_goal_model") {
        goalModelPatch = p.args;
      } else if (p.tool === "create_first_task") {
        firstTaskArgs = p.args;
      } else if (p.tool === "complete_specialisation") {
        shouldComplete = true;
      } else if (p.tool === "update_constraints") {
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

    // Apply goal model patch
    if (goalModelPatch) {
      const patch: Record<string, any> = {};
      if (goalModelPatch.current_stage) patch.current_stage = goalModelPatch.current_stage;
      if (goalModelPatch.target_stage) patch.target_stage = goalModelPatch.target_stage;
      if (goalModelPatch.reality_gap) patch.reality_gap = goalModelPatch.reality_gap;
      dispatch({ type: "goal/patch", payload: patch });
      if (goalModelPatch.knowns || goalModelPatch.unknowns) {
        const existingUnderstanding = state.onboarding.understanding;
        applyPatch({
          onboarding: {
            ...state.onboarding,
            understanding: {
              ...existingUnderstanding,
              knowns: goalModelPatch.knowns ?? existingUnderstanding.knowns,
              unknowns: goalModelPatch.unknowns ?? existingUnderstanding.unknowns,
            },
          },
        });
      }
    }

    // Apply first task + complete
    const seedNotesFromArgs = (args: Record<string, any> | null) => {
      const list = args?.elaborated_notes;
      if (!Array.isArray(list)) return [];
      const nowIso = new Date().toISOString();
      return list
        .filter((n: unknown): n is string => typeof n === "string" && n.trim().length > 0)
        .map((content: string) => ({
          id: crypto.randomUUID(),
          content: content.trim(),
          created_at: nowIso,
        }));
    };

    if (firstTaskArgs && shouldComplete) {
      const firstTask = {
        id: crypto.randomUUID(),
        title: firstTaskArgs.title ?? "First step",
        description: firstTaskArgs.description ?? "",
        status: "pending" as const,
        priority: "high" as const,
        goal_id: "",
        domain_id: "",
        estimated_minutes: firstTaskArgs.estimated_minutes ?? 30,
        category: (firstTaskArgs.category ?? "discovery") as any,
        created_at: new Date().toISOString(),
        completed_at: "",
        due_date: "",
        created_by: "ai" as const,
        user_stage_fit: "strong" as const,
        why_now: firstTaskArgs.why_now ?? "",
        difficulty: (firstTaskArgs.difficulty ?? "easy") as any,
        resource_url: firstTaskArgs.resource_url ?? "",
        resource_label: firstTaskArgs.resource_label ?? "",
        notes: seedNotesFromArgs(firstTaskArgs),
      };

      const latestGoalPatch: Record<string, any> = {};
      if (goalModelPatch?.current_stage) latestGoalPatch.current_stage = goalModelPatch.current_stage;
      if (goalModelPatch?.target_stage) latestGoalPatch.target_stage = goalModelPatch.target_stage;
      if (goalModelPatch?.reality_gap) latestGoalPatch.reality_gap = goalModelPatch.reality_gap;

      dispatch({
        type: "chat/complete_specialisation",
        payload: {
          goal_patch: latestGoalPatch,
          first_task: firstTask,
        },
      });
      setSpecialisationDone(true);
      toast.success("Your first move is ready — check your task list.");
    } else if (firstTaskArgs && !shouldComplete) {
      const firstTask = {
        id: crypto.randomUUID(),
        title: firstTaskArgs.title ?? "First step",
        description: firstTaskArgs.description ?? "",
        status: "pending" as const,
        priority: "high" as const,
        goal_id: "",
        domain_id: "",
        estimated_minutes: firstTaskArgs.estimated_minutes ?? 30,
        category: (firstTaskArgs.category ?? "discovery") as any,
        created_at: new Date().toISOString(),
        completed_at: "",
        due_date: "",
        created_by: "ai" as const,
        user_stage_fit: "strong" as const,
        why_now: firstTaskArgs.why_now ?? "",
        difficulty: (firstTaskArgs.difficulty ?? "easy") as any,
        resource_url: firstTaskArgs.resource_url ?? "",
        resource_label: firstTaskArgs.resource_label ?? "",
        notes: seedNotesFromArgs(firstTaskArgs),
      };
      dispatch({ type: "task/add", payload: firstTask });
    }

    // Apply default constraint patches
    if (Object.keys(constraintsUpdate).length || newCommitments.length) {
      const merged = {
        ...state.constraints,
        ...constraintsUpdate,
        ...(newCommitments.length
          ? { fixed_commitments: [...state.constraints.fixed_commitments, ...newCommitments] }
          : {}),
        fixed_commitments_checked:
          state.constraints.fixed_commitments_checked ||
          newCommitments.length > 0 ||
          constraintsUpdate.fixed_commitments_checked === true,
        missing_fields: SCHEDULE_FIELDS.filter((f) => {
          const next: any = { ...state.constraints, ...constraintsUpdate };
          if (f.key === "fixed_commitments") {
            const checked =
              state.constraints.fixed_commitments_checked ||
              newCommitments.length > 0 ||
              constraintsUpdate.fixed_commitments_checked === true;
            return !checked && (next.fixed_commitments?.length ?? 0) === 0;
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

    // ── Omnipotent: tasks, week, profile, tone ────────────────────────────
    for (const p of patches) {
      if (p.tool === "add_task") {
        const id = crypto.randomUUID();
        const nowIso = new Date().toISOString();
        const seededNotes = Array.isArray(p.args.elaborated_notes)
          ? (p.args.elaborated_notes as unknown[])
              .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
              .map((content) => ({
                id: crypto.randomUUID(),
                content: content.trim(),
                created_at: nowIso,
              }))
          : [];
        dispatch({
          type: "task/add",
          payload: {
            id,
            title: p.args.title ?? "New task",
            description: "",
            status: "pending",
            priority: (p.args.priority ?? "medium") as "high" | "medium" | "low",
            goal_id: state.active_goal?.id ?? "",
            domain_id: "",
            estimated_minutes: p.args.estimated_minutes ?? 30,
            category: (p.args.category ?? "goal_direct") as any,
            created_at: nowIso,
            completed_at: "",
            due_date: "",
            created_by: "ai",
            why_now: p.args.why_now ?? "",
            proof_of_completion: p.args.proof_of_completion ?? "",
            resource_url: p.args.resource_url ?? "",
            resource_label: p.args.resource_label ?? "",
            notes: seededNotes,
          } as any,
        });
        if (p.args.schedule_for?.day_index !== undefined && p.args.schedule_for?.start_time) {
          const start: string = p.args.schedule_for.start_time;
          const [h, m] = start.split(":").map(Number);
          const totalEnd = h * 60 + m + Math.min(120, p.args.estimated_minutes ?? 30);
          const eh = Math.min(22, Math.floor(totalEnd / 60));
          const em = totalEnd % 60;
          dispatch({
            type: "week/addBlock",
            payload: {
              id: `wb_${Math.random().toString(36).slice(2, 10)}`,
              day_index: p.args.schedule_for.day_index,
              start_time: start,
              end_time: `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`,
              title: p.args.title ?? "Task",
              category: "goal",
              notes: "",
              is_locked: false,
            },
          });
        }
      } else if (p.tool === "update_task" && p.args.id) {
        const { id, ...changes } = p.args;
        dispatch({ type: "task/update", payload: { id, changes } });
      } else if (p.tool === "complete_task" && p.args.id) {
        dispatch({ type: "task/complete", payload: { id: p.args.id, completed_at: new Date().toISOString() } });
      } else if (p.tool === "delete_task" && p.args.id) {
        dispatch({ type: "task/delete", payload: { id: p.args.id } });
      } else if (p.tool === "add_week_block") {
        dispatch({
          type: "week/addBlock",
          payload: {
            id: `wb_${Math.random().toString(36).slice(2, 10)}`,
            day_index: p.args.day_index,
            start_time: p.args.start_time,
            end_time: p.args.end_time,
            title: p.args.title,
            category: p.args.category,
            notes: "",
            is_locked: Boolean(p.args.is_locked),
          },
        });
      } else if (p.tool === "update_week_block" && p.args.id) {
        const { id, ...changes } = p.args;
        dispatch({ type: "week/updateBlock", payload: { id, changes } });
      } else if (p.tool === "delete_week_block" && p.args.id) {
        dispatch({ type: "week/deleteBlock", payload: { id: p.args.id } });
      } else if (p.tool === "regenerate_week") {
        dispatch({ type: "week/reform" });
      } else if (p.tool === "update_profile") {
        applyPatch({ profile: { ...state.profile, ...p.args } });
      } else if (p.tool === "set_tone" && p.args.tone) {
        dispatch({ type: "chat/setPreferences", payload: { tone: p.args.tone } });
      }
    }

    const significantPatches = patches.filter(
      (p) => !["patch_goal_model", "complete_specialisation"].includes(p.tool),
    );
    if (significantPatches.length && !isSpecialisation) {
      const summary = significantPatches
        .map((p) => {
          if (p.tool === "update_constraints") return Object.keys(p.args).join(", ");
          if (p.tool === "add_fixed_commitment") return `commitment: ${p.args.title}`;
          if (p.tool === "set_goal") return "goal";
          if (p.tool === "add_task") return `task: ${p.args.title}`;
          if (p.tool === "update_task") return "task updated";
          if (p.tool === "complete_task") return "task completed";
          if (p.tool === "delete_task") return "task removed";
          if (p.tool === "add_week_block") return `block: ${p.args.title}`;
          if (p.tool === "update_week_block") return "block updated";
          if (p.tool === "delete_week_block") return "block removed";
          if (p.tool === "regenerate_week") return "week regenerated";
          if (p.tool === "update_profile") return "profile";
          if (p.tool === "set_tone") return `tone: ${p.args.tone}`;
          return p.tool;
        })
        .join(" · ");
      toast.success(`Saved: ${summary}`);
    }
  };

  const onSendMessage = async (text: string) => {
    if (!text.trim() || !state || inFlightRef.current) return;
    inFlightRef.current = true;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user" as const, content: text, created_at: new Date().toISOString() };
    const stateWithLatestMessage = {
      ...state,
      chat_messages: [...(state.chat_messages ?? []), userMsg],
    };
    setMessages((m) => [...m, userMsg]);
    dispatch({ type: "chat/append", payload: userMsg });
    setInput("");
    setIsTyping(true);

    try {
      const snapshot = selectChatSnapshot(stateWithLatestMessage);

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("chat-coach", {
        body: {
          messages: apiMessages,
          snapshot,
          context_packet: buildContextPacket(stateWithLatestMessage),
          mode: isSpecialisation ? "goal_specialisation" : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const reply = ((data as any).reply as string) || "";
      const patches = ((data as any).patches ?? []) as Array<{
        tool: string;
        args: Record<string, any>;
      }>;

      applyToolPatches(patches);

      // Compute which fields were patched in this turn so the client fallback
      // doesn't repeat the field the user just answered (snapshot is stale at this point).
      const justPatched = new Set<string>(
        patches.flatMap((p) => {
          if (p.tool === "update_constraints") {
            const keys = Object.keys(p.args);
            // If fixed_commitments_checked was patched, treat fixed_commitments as answered too
            if (p.args.fixed_commitments_checked === true) keys.push("fixed_commitments");
            return keys;
          }
          if (p.tool === "add_fixed_commitment") return ["fixed_commitments"];
          return [];
        }),
      );
      const remainingMissing = snapshot.missing_schedule_info.filter(
        (f) => !justPatched.has(f),
      );

      const display = reply.trim();
      if (!display) {
        // Server is self-deterministic — if it returned no reply, surface nothing
        // rather than inventing a hardcoded one. Skip appending the message.
        return;
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: display,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistantMsg]);
      dispatch({ type: "chat/append", payload: assistantMsg });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Chat failed";
      toast.error(msg);
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        content: "Sorry — I couldn't reach the coach. Try again in a moment.",
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, errMsg]);
      dispatch({ type: "chat/append", payload: errMsg });
    } finally {
      setIsTyping(false);
      inFlightRef.current = false;
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-2xl flex-col md:h-[calc(100vh-7rem)]">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">/ chat</div>
          {isSpecialisation ? (
            <>
              <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight"><Mote size={56} bounce mood="focused" />Goal calibration</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                One conversation to map where you are and activate your first move.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight"><Mote size={56} bounce mood="calm" />Talk it out with Moment</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                What you share here flows into your plan, schedule, and goal.
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            const greeting = isSpecialisation ? specialisationGreeting : defaultGreeting;
            setMessages([greeting]);
            dispatch({ type: "chat/clear_messages" });
          }}
          className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>

      {/* Specialisation status banner */}
      {isSpecialisation && (
        <section className="mb-3 rounded-xl border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Target className="h-3 w-3 text-primary" /> goal pathway calibration
          </div>
          {specialisationDone ? (
            <p className="text-xs text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              Calibration complete — your first task is live. Head to Home or Tasks to start.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Moment will ask you a few short questions, then add your first move to your task list.
            </p>
          )}
        </section>
      )}

      {/* Default mode: show portfolio context banner when schedule is complete, schedule-info checklist while still missing fields */}
      {!isSpecialisation && state && missing.length === 0 && (
        <ChatContextBanner snapshot={selectChatSnapshot(state)} />
      )}

      {!isSpecialisation && missing.length > 0 && (
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
      )}

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
            if (isTyping) return;
          onSendMessage(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isTyping
              ? "Moment is thinking…"
              : isSpecialisation
              ? "Reply to Moment…"
              : missing.length
              ? `Tell Moment your ${missing[0].toLowerCase()}…`
              : "Message Moment…"
          }
          className="flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          disabled={isTyping || (isSpecialisation && specialisationDone)}
        />
        <button
          type="submit"
          disabled={isTyping || !input.trim() || (isSpecialisation && specialisationDone)}
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