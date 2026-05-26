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

export function HeartbeatBanner({ variant = "compact" }: Props) {
  const state = useStateStore((s) => s.state);
  const snap = useMemo(() => buildContextSnapshot(state, ""), [state]);

  if (!state) return null;

  if (variant === "full") {
    return <FullHeartbeat snap={snap} />;
  }

  return <CompactHeartbeat snap={snap} />;
}

function CompactHeartbeat({ snap }: { snap: ReturnType<typeof buildContextSnapshot> }) {
  const hasRescue = snap.is_rescue_situation;
  const hasPressure = snap.plan_pressure !== "low";

  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* Situation */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span
            className={`h-1.5 w-1.5 rounded-full ${SITUATION_DOT[snap.inferred_situation]}`}
          />
          <span className={`font-medium uppercase tracking-[0.12em] ${SITUATION_COLOR[snap.inferred_situation]}`}>
            {SITUATION_LABEL[snap.inferred_situation]}
          </span>
        </div>

        {/* Rescue alert */}
        {hasRescue && (
          <div className="flex items-center gap-1 text-[11px] text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span>rescue needed</span>
            <Link to="/app/chat" className="ml-1 text-primary underline-offset-2 hover:underline">
              Open Chat →
            </Link>
          </div>
        )}

        {/* Next task */}
        {snap.next_best_task && !hasRescue && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="text-foreground/60">next ·</span>
            <span className="font-medium text-foreground">{snap.next_best_task.title}</span>
            <span className="text-muted-foreground/60">~{snap.next_best_task.minutes}m</span>
          </div>
        )}

        {/* Overdue warning */}
        {snap.overdue_task_count > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-amber-400">
            <Clock className="h-3 w-3" />
            <span>{snap.overdue_task_count} overdue</span>
          </div>
        )}

        {/* Pressure */}
        {hasPressure && (
          <div className={`text-[11px] font-medium ${PRESSURE_COLOR[snap.plan_pressure]}`}>
            {PRESSURE_LABEL[snap.plan_pressure]}
          </div>
        )}
      </div>

      {/* Friction notice (shown when overwhelmed with friction patterns) */}
      {snap.inferred_situation === "overwhelmed" && snap.active_friction.length > 0 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Recurring pattern:{" "}
          <span className="text-foreground">
            {snap.active_friction.slice(0, 2).map((f) => f.description).join(", ")}
          </span>
          . Chat can help you work through it.
        </p>
      )}
    </div>
  );
}

function FullHeartbeat({ snap }: { snap: ReturnType<typeof buildContextSnapshot> }) {
  const today = new Date();
  const today10 = today.toISOString().slice(0, 10);

  const completedToday = snap.todays_tasks
    .filter((t) => (t as unknown as { status?: string }).status === "done")
    .length;

  const pendingCount = snap.todays_tasks.length;

  const hasBlocking =
    snap.active_friction.length > 0 ||
    snap.overdue_task_count > 0 ||
    snap.current_bottleneck;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${SITUATION_DOT[snap.inferred_situation]}`}
          />
          why today matters · {snap.current_day}
        </div>
        <div className={`text-[11px] font-medium ${SITUATION_COLOR[snap.inferred_situation]}`}>
          {SITUATION_LABEL[snap.inferred_situation]}
        </div>
      </div>

      {/* Decisive move */}
      {snap.decisive_move ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1">
            today's decisive move
          </p>
          <p className="text-base font-semibold text-foreground">{snap.decisive_move}</p>
          {snap.next_best_task && snap.next_best_task.why_now && (
            <p className="mt-1 text-sm text-muted-foreground">{snap.next_best_task.why_now}</p>
          )}
        </div>
      ) : snap.next_best_task ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1">
            next move
          </p>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground">{snap.next_best_task.title}</span>
            <span className="text-sm text-muted-foreground">~{snap.next_best_task.minutes}m</span>
          </div>
          {snap.next_best_task.why_now && (
            <p className="mt-1 text-sm text-muted-foreground">{snap.next_best_task.why_now}</p>
          )}
        </div>
      ) : null}

      {/* Stats row */}
      <div className="flex flex-wrap gap-4 text-sm">
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{pendingCount} task{pendingCount !== 1 ? "s" : ""} today</span>
          </div>
        )}
        {snap.overdue_task_count > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>{snap.overdue_task_count} overdue</span>
          </div>
        )}
        {snap.plan_pressure !== "low" && (
          <div className={`flex items-center gap-1.5 ${PRESSURE_COLOR[snap.plan_pressure]}`}>
            <Flame className="h-3.5 w-3.5 shrink-0" />
            <span>{PRESSURE_LABEL[snap.plan_pressure]}</span>
          </div>
        )}
      </div>

      {/* Blocking */}
      {hasBlocking && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-amber-400/80">
            what is blocking progress
          </p>
          {snap.current_bottleneck && (
            <p className="text-sm text-foreground">{snap.current_bottleneck}</p>
          )}
          {snap.active_friction.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Friction pattern:{" "}
              {snap.active_friction.slice(0, 2).map((f) => f.description).join(", ")}.
            </p>
          )}
          {snap.overdue_task_count > 0 && !snap.current_bottleneck && (
            <p className="text-sm text-foreground">
              {snap.overdue_task_count} overdue task{snap.overdue_task_count !== 1 ? "s" : ""} need attention.
            </p>
          )}
        </div>
      )}

      {/* Rescue alert */}
      {snap.is_rescue_situation && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Urgent deadline detected.</span>
          </div>
          <Link
            to="/app/chat"
            className="flex items-center gap-1 rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/25"
          >
            Get rescue plan <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Link to plan */}
      {(snap.plan_needs_repair || snap.overdue_task_count > 0) && !snap.is_rescue_situation && (
        <Link
          to="/app/plan"
          className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
        >
          <TrendingUp className="h-3 w-3" /> Review today's plan
        </Link>
      )}
    </section>
  );
}

/**
 * Contextual tool suggestions for Forge — powered by ContextSnapshot.
 * Shows 1-3 tool ideas based on the user's current situation, not their
 * overall goal (that's handled by detectSystemGap already).
 */
export interface ContextualSuggestion {
  title: string;
  why: string;
  feature_type: string;
  description_hint: string;
  urgency: "high" | "normal";
}

export function buildContextualForgeSuggestions(
  snap: ReturnType<typeof buildContextSnapshot>,
  existingActiveTypes: Set<string>,
): ContextualSuggestion[] {
  const suggestions: ContextualSuggestion[] = [];

  // Rescue situation → essay rescue planner
  if (snap.is_rescue_situation && !existingActiveTypes.has("control_room")) {
    suggestions.push({
      title: "Deadline Rescue Board",
      why: `You have an urgent deadline. This tool turns panic into a timed step-by-step plan.`,
      feature_type: "control_room",
      description_hint: "Help me rescue an assignment with an urgent deadline — create a timed step plan",
      urgency: "high",
    });
  }

  // Overwhelmed or high schedule pressure → triage tool
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

  // Drifting → reconnect tool
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

  // Repeated "too_big" friction → task breakdown tool
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

  // Recovering + next_best_task → momentum builder
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
