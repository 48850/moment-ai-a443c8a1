import type { MomentState } from "@/lib/types";

export type ConstellationNodeType =
  | "NORTH_STAR"
  | "IDENTITY_STAR"
  | "WORKSTREAM_STAR"
  | "TASK_STAR"
  | "PROOF_STAR"
  | "GATE_STAR"
  | "FRICTION_STAR"
  | "TODAY_STAR"
  | "SCHEDULE_STAR";

export interface ConstellationNode {
  id: string;
  type: ConstellationNodeType;
  title: string;
  subtitle?: string;
  why_it_matters: string;
  linked_workstream_id?: string;
  linked_task_id?: string;
  stage_fit: "strong" | "okay" | "premature" | "blocked";
  status: "active" | "locked" | "completed" | "dimmed" | "suggested";
  evidence?: string[];
  unlock_condition?: string;
  next_action?: string;
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Strict evidence rule: every node must be backed by real state data.
 * Returns [] if no goal is set.
 */
export function computeConstellationNodes(state: MomentState): ConstellationNode[] {
  const goal = state.active_goal?.statement?.trim();
  if (!goal) return [];

  const nodes: ConstellationNode[] = [];
  const now = Date.now();

  // NORTH_STAR — only if goal is non-empty
  nodes.push({
    id: "node_north_star",
    type: "NORTH_STAR",
    title: goal,
    subtitle: state.active_goal.phase,
    why_it_matters: state.active_goal.why_it_matters || "Your primary goal.",
    stage_fit: "strong",
    status: "active",
    evidence: [goal],
    next_action: state.today_state?.decisive_move || undefined,
  });

  // IDENTITY_STAR — only if desired_identity is non-empty
  const desiredIdentity = state.active_goal.desired_identity?.trim();
  if (desiredIdentity) {
    nodes.push({
      id: "node_identity_star",
      type: "IDENTITY_STAR",
      title: desiredIdentity,
      why_it_matters: "Who you are becoming through this goal.",
      stage_fit: "strong",
      status: "active",
      evidence: [desiredIdentity],
    });
  }

  // TODAY_STAR — only if decisive_move or first high-priority pending task exists
  const decisiveMove = state.today_state?.decisive_move?.trim();
  const firstHighPriority = (state.tasks ?? []).find(
    (t) => t.status === "pending" && t.priority === "high" && t.user_stage_fit !== "premature",
  );
  const todaySource = decisiveMove || firstHighPriority?.title;
  if (todaySource) {
    nodes.push({
      id: "node_today_star",
      type: "TODAY_STAR",
      title: todaySource,
      why_it_matters: state.today_state?.decisive_move_reason || "This is your move today.",
      linked_task_id: firstHighPriority?.id,
      stage_fit: "strong",
      status: "active",
      evidence: [todaySource],
      next_action: todaySource,
    });
  }

  // WORKSTREAM_STARs — only if pursuit_model exists
  if (state.pursuit_model?.workstreams?.length) {
    for (const ws of state.pursuit_model.workstreams) {
      const wsStatus: ConstellationNode["status"] =
        ws.status === "stalled" ? "dimmed" :
        ws.status === "not_started" ? "suggested" :
        ws.status === "complete" ? "completed" :
        "active";

      nodes.push({
        id: `node_ws_${ws.id}`,
        type: "WORKSTREAM_STAR",
        title: ws.name,
        subtitle: ws.status,
        why_it_matters: ws.description || ws.bottleneck || "Key pathway area.",
        linked_workstream_id: ws.id,
        stage_fit: "strong",
        status: wsStatus,
        evidence: [ws.name, ws.status],
        next_action: ws.next_proof || undefined,
      });
    }
  }

  // TASK_STARs — pending tasks that are NOT premature
  const pendingNonPremature = (state.tasks ?? []).filter(
    (t) => t.status === "pending" && t.user_stage_fit !== "premature",
  );
  for (const task of pendingNonPremature) {
    // Skip if this task is already represented as TODAY_STAR
    if (task.id === firstHighPriority?.id && decisiveMove) continue;

    nodes.push({
      id: `node_task_${task.id}`,
      type: "TASK_STAR",
      title: task.title,
      subtitle: task.priority,
      why_it_matters: task.why_now || task.description || "",
      linked_task_id: task.id,
      linked_workstream_id: task.workstream_id,
      stage_fit: (task.user_stage_fit as ConstellationNode["stage_fit"]) ?? "okay",
      status: "active",
      evidence: [task.title, task.priority],
      next_action: task.title,
    });
  }

  // PROOF_STARs — tasks completed within the last 14 days
  const recentDone = (state.tasks ?? []).filter((t) => {
    if (t.status !== "done" || !t.completed_at) return false;
    const completedMs = new Date(t.completed_at).getTime();
    return now - completedMs <= FOURTEEN_DAYS_MS;
  });
  for (const task of recentDone) {
    nodes.push({
      id: `node_proof_${task.id}`,
      type: "PROOF_STAR",
      title: task.title,
      subtitle: task.completed_at?.slice(0, 10),
      why_it_matters: "You advanced the pathway.",
      linked_task_id: task.id,
      stage_fit: "strong",
      status: "completed",
      evidence: [task.title, task.completed_at ?? ""],
    });
  }

  // GATE_STARs — from feasibility.premature_recommendations (only if feasibility exists)
  const feasibility = state.active_goal?.feasibility;
  if (feasibility?.premature_recommendations?.length) {
    for (const rec of feasibility.premature_recommendations) {
      nodes.push({
        id: `node_gate_${rec.replace(/\s+/g, "_").toLowerCase().slice(0, 30)}`,
        type: "GATE_STAR",
        title: rec,
        why_it_matters: `Not yet appropriate for your current stage.`,
        stage_fit: "premature",
        status: "locked",
        evidence: [rec],
        unlock_condition: `When you reach: ${feasibility.target_stage}`,
      });
    }
  }

  // Also create GATE_STARs for explicitly-premature tasks in state
  const prematureTasks = (state.tasks ?? []).filter((t) => t.user_stage_fit === "premature");
  for (const task of prematureTasks) {
    // Skip if already captured by feasibility premature recommendations (similar text)
    const alreadyCovered = feasibility?.premature_recommendations?.some(
      (rec) => task.title.toLowerCase().includes(rec.toLowerCase().slice(0, 20)),
    );
    if (!alreadyCovered) {
      nodes.push({
        id: `node_gate_task_${task.id}`,
        type: "GATE_STAR",
        title: task.title,
        why_it_matters: task.blocked_reason || "Not yet stage-appropriate.",
        linked_task_id: task.id,
        stage_fit: "premature",
        status: "locked",
        evidence: [task.title],
        unlock_condition: feasibility?.target_stage
          ? `When you reach: ${feasibility.target_stage}`
          : "Not yet — continue building the foundation.",
      });
    }
  }

  // FRICTION_STARs — only if ≥2 of the same negative feedback signal exist for a workstream area
  const negativeFeedback = ["hard", "too_big", "too_vague", "overwhelming", "feels_unrealistic"];
  const feedbackCounts: Record<string, number> = {};
  for (const fb of (state.execution_feedback ?? [])) {
    if (negativeFeedback.includes(fb.feedback)) {
      const key = fb.feedback;
      feedbackCounts[key] = (feedbackCounts[key] ?? 0) + 1;
    }
  }
  for (const [signal, count] of Object.entries(feedbackCounts)) {
    if (count >= 2) {
      const evidenceChips = (state.execution_feedback ?? [])
        .filter((fb) => fb.feedback === signal)
        .slice(-3)
        .map((fb) => fb.task_title || fb.feedback);

      nodes.push({
        id: `node_friction_${signal}`,
        type: "FRICTION_STAR",
        title: `Recurring signal: ${signal.replace(/_/g, " ")}`,
        why_it_matters: `This signal has appeared ${count} times. Something may need shrinking or clarifying.`,
        stage_fit: "okay",
        status: "active",
        evidence: evidenceChips,
      });
    }
  }

  return nodes;
}
