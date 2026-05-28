/**
 * HeartbeatBanner — the shared context pulse shown across Plan, Mission, and Forge.
 *
 * Every tab reads from the same ContextSnapshot so Plan, Mission, and Forge
 * all reflect the same situational intelligence without repeating logic.
 *
 * Usage:
 *   <HeartbeatBanner />                  — compact row (Plan, Forge)
 *   <HeartbeatBanner variant="full" />   — expanded "Why today matters" (Mission)
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Flame, CheckCircle2, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { buildContextSnapshot, type UserSituation } from "@/lib/coach/context-snapshot";

interface Props {
  variant?: "compact" | "full";
}

const SITUATION_LABEL: Record<UserSituation, string> = {
  aligned: "on track",
  progressing: "in progress",
  recovering: "recovering",
  overwhelmed: "under pressure",
  drifting: "drifting",
};

const SITUATION_COLOR: Record<UserSituation, string> = {
  aligned: "text-emerald-400",
  progressing: "text-emerald-400",
  recovering: "text-sky-400",
  overwhelmed: "text-red-400",
  drifting: "text-amber-400",
};

const SITUATION_DOT: Record<UserSituation, string> = {
  aligned: "bg-emerald-500",
  progressing: "bg-emerald-500",
  recovering: "bg-sky-500",
  overwhelmed: "bg-red-500",
  drifting: "bg-amber-500",
};

const PRESSURE_LABEL: Record<string, string> = {
  low: "",
  moderate: "moderate pressure",
  high: "high pressure",
  critical: "critical — time is short",
};

const PRESSURE_COLOR: Record<string, string> = {
  low: "",
  moderate: "text-amber-400",
  high: "text-red-400",
  critical: "text-red-500",
};

type Snap = ReturnType<typeof buildContextSnapshot>;

export function HeartbeatBanner({ variant = "compact" }: Props) {
  const state = useStateStore((s) => s.state);
  const snap = useMemo(() => buildContextSnapshot(state, ""), [state]);
  if (!state) return null;
  if (variant === "full") return <FullHeartbeat snap={snap} />;
  return <CompactHeartbeat snap={snap} />;
}

function CompactHeartbeat({ snap }: { snap: Snap }) {
  const hasRescue = snap.is_rescue_situation;
  const hasPressure = snap.plan_pressure !== "low";

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {/* Situation */}
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${SITUATION_DOT[snap.inferred_situation]}`} />
          <span className={`font-medium ${SITUATION_COLOR[snap.inferred_situation]}`}>
            {SITUATION_LABEL[snap.inferred_situation]}
          </span>
        </div>

        {/* Rescue alert */}
        {hasRescue && (
          <div className="flex items-center gap-1.5 text-red-400">
            <Flame className="h-3.5 w-3.5" />
            <span className="font-medium">rescue needed</span>
            <Link to="/app/chat" className="ml-1 underline">Open Chat →</Link>
          </div>
        )}

        {/* Exam countdown */}
        {snap.active_exam_emergency && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>
              {snap.active_exam_emergency.subject} exam ·{" "}
              {snap.active_exam_emergency.hoursUntilExam < 1
                ? "< 1h"
                : `${Math.round(snap.active_exam_emergency.hoursUntilExam)}h`}
            </span>
            <Link to="/app/exam" className="ml-1 underline">Study plan →</Link>
          </div>
        )}

        {/* Next task */}
        {snap.next_best_task && !hasRescue && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>next ·</span>
            <span className="text-foreground">{snap.next_best_task.title}</span>
            <span className="text-muted-foreground/70">~{snap.next_best_task.minutes}m</span>
          </div>
        )}

        {/* Overdue warning */}
        {snap.overdue_task_count > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{snap.overdue_task_count} overdue</span>
          </div>
        )}

        {/* Pressure */}
        {hasPressure && (
          <span className={PRESSURE_COLOR[snap.plan_pressure]}>
            {PRESSURE_LABEL[snap.plan_pressure]}
          </span>
        )}
      </div>

      {/* Friction notice */}
      {snap.inferred_situation === "overwhelmed" && snap.active_friction.length > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          Recurring pattern:{" "}
          <span className="text-foreground">
            {snap.active_friction.slice(0, 2).map((f) => f.description).join(", ")}
          </span>
          . <Link to="/app/chat" className="underline">Chat can help you work through it.</Link>
        </div>
      )}
    </div>
  );
}

function FullHeartbeat({ snap }: { snap: Snap }) {
  const pendingCount = snap.todays_tasks.length;
  const hasBlocking =
    snap.active_friction.length > 0 ||
    snap.overdue_task_count > 0 ||
    Boolean(snap.current_bottleneck);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          why today matters · {snap.current_day}
        </div>
        <div className={`flex items-center gap-1.5 text-xs ${SITUATION_COLOR[snap.inferred_situation]}`}>
          <span className={`h-2 w-2 rounded-full ${SITUATION_DOT[snap.inferred_situation]}`} />
          {SITUATION_LABEL[snap.inferred_situation]}
        </div>
      </div>

      {/* Decisive move */}
      {snap.decisive_move ? (
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary mb-1">
            today's decisive move
          </div>
          <p className="text-sm font-medium text-foreground leading-snug">{snap.decisive_move}</p>
          {snap.next_best_task?.why_now && (
            <p className="mt-1 text-xs text-muted-foreground">{snap.next_best_task.why_now}</p>
          )}
        </div>
      ) : snap.next_best_task ? (
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary mb-1">next move</div>
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-medium text-foreground">{snap.next_best_task.title}</p>
            <span className="text-xs text-muted-foreground">~{snap.next_best_task.minutes}m</span>
          </div>
          {snap.next_best_task.why_now && (
            <p className="mt-1 text-xs text-muted-foreground">{snap.next_best_task.why_now}</p>
          )}
        </div>
      ) : null}

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{pendingCount} task{pendingCount !== 1 ? "s" : ""} today</span>
          </div>
        )}
        {snap.overdue_task_count > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{snap.overdue_task_count} overdue</span>
          </div>
        )}
        {snap.plan_pressure !== "low" && (
          <div className={`flex items-center gap-1.5 ${PRESSURE_COLOR[snap.plan_pressure]}`}>
            <Clock className="h-3.5 w-3.5" />
            <span>{PRESSURE_LABEL[snap.plan_pressure]}</span>
          </div>
        )}
      </div>

      {/* Blocking */}
      {hasBlocking && (
        <div className="rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-400 mb-1">
            what is blocking progress
          </div>
          {snap.current_bottleneck && (
            <p className="text-xs text-foreground">{snap.current_bottleneck}</p>
          )}
          {snap.active_friction.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Friction pattern:{" "}
              {snap.active_friction.slice(0, 2).map((f) => f.description).join(", ")}.
            </p>
          )}
          {snap.overdue_task_count > 0 && !snap.current_bottleneck && (
            <p className="mt-1 text-xs text-muted-foreground">
              {snap.overdue_task_count} overdue task{snap.overdue_task_count !== 1 ? "s" : ""} need attention.
            </p>
          )}
        </div>
      )}

      {/* Rescue alert */}
      {snap.is_rescue_situation && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/40 bg-red-500/5 p-3">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <Flame className="h-4 w-4" />
            <span className="font-medium">Urgent deadline detected.</span>
          </div>
          <Link
            to="/app/chat"
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
          >
            Get rescue plan <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Link to plan */}
      {(snap.plan_needs_repair || snap.overdue_task_count > 0) && !snap.is_rescue_situation && (
        <Link
          to="/app/plan"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <TrendingUp className="h-3.5 w-3.5" /> Review today's plan
        </Link>
      )}
    </section>
  );
}

/**
 * Contextual tool suggestions for Forge — powered by ContextSnapshot.
 * Shows 1-3 tool ideas based on the user's current situation.
 */
export interface ContextualSuggestion {
  title: string;
  why: string;
  feature_type: string;
  description_hint: string;
  urgency: "high" | "normal";
}

export function buildContextualForgeSuggestions(
  snap: Snap,
  existingActiveTypes: Set<string>,
): ContextualSuggestion[] {
  const suggestions: ContextualSuggestion[] = [];

  if (snap.is_rescue_situation && !existingActiveTypes.has("control_room")) {
    suggestions.push({
      title: "Deadline Rescue Board",
      why: "You have an urgent deadline. This tool turns panic into a timed step-by-step plan.",
      feature_type: "control_room",
      description_hint: "Help me rescue an assignment with an urgent deadline — create a timed step plan",
      urgency: "high",
    });
  }

  if (
    (snap.inferred_situation === "overwhelmed" || ["high", "critical"].includes(snap.plan_pressure)) &&
    !existingActiveTypes.has("planner")
  ) {
    suggestions.push({
      title: "Task Triage Planner",
      why: `${snap.todays_tasks.length} tasks, limited time. This tool picks what actually matters today.`,
      feature_type: "planner",
      description_hint: "Triage my pending tasks and tell me which 1-2 to actually do today given my time",
      urgency: "high",
    });
  }

  if (snap.inferred_situation === "drifting" && !existingActiveTypes.has("coach_lens")) {
    suggestions.push({
      title: "Goal Reconnect Session",
      why: "You've been drifting. This tool brings you back to why the goal matters and what to do next.",
      feature_type: "coach_lens",
      description_hint:
        "Help me reconnect with my goal after losing momentum — what should I do in the next 20 minutes?",
      urgency: "normal",
    });
  }

  // Active exam emergency → study tools
  const examSnap = (snap as any).active_exam_emergency;
  if (examSnap && !existingActiveTypes.has("drill_lab")) {
    suggestions.push({
      title: `${examSnap.subject} Study Tools`,
      why: `${Math.round(examSnap.hoursUntilExam)}h until your ${examSnap.subject} exam. Build a practice quiz now.`,
      feature_type: "drill_lab",
      description_hint: `Build a 10-question practice quiz for ${examSnap.subject} with worked answers`,
      urgency: examSnap.hoursUntilExam < 24 ? "high" : "normal",
    });
  }

  const tooBig = snap.active_friction.find((f) => f.tag === "too_big" && f.count >= 2);
  if (tooBig && !existingActiveTypes.has("protocol")) {
    suggestions.push({
      title: "Task Breakdown Protocol",
      why: `You've marked tasks "too big" ${tooBig.count} times. This tool shrinks any task into first steps.`,
      feature_type: "protocol",
      description_hint: "Break down any large task into concrete 15-30 minute first steps I can actually start",
      urgency: "normal",
    });
  }

  if (
    snap.inferred_situation === "recovering" &&
    snap.next_best_task &&
    !existingActiveTypes.has("tracker")
  ) {
    suggestions.push({
      title: "Recovery Momentum Tracker",
      why: "You're coming back from a miss. This tool protects the comeback by tracking small wins.",
      feature_type: "tracker",
      description_hint: "Track my daily small wins to rebuild momentum after missing tasks",
      urgency: "normal",
    });
  }

  return suggestions.slice(0, 3);
}
