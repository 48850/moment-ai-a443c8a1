import type { Task, MomentState } from "@/lib/types";

export interface ScoredTask extends Task {
  score: number;
}

const PRIORITY_WEIGHTS: Record<string, number> = { high: 10, medium: 6, low: 3 };
const CATEGORY_WEIGHTS: Record<string, number> = {
  goal_direct: 2.5, bottleneck_removal: 2.0, discovery: 1.5, maintenance: 1.0,
};

function computeGoalAlignment(task: Task, state: MomentState): number {
  if (task.goal_id === "primary" && state.active_goal.status !== "forming") return 10;
  if (task.goal_id) return 6;
  return 3;
}
function computeEnergyFit(task: Task, energy: string): number {
  const d = task.estimated_minutes || 30;
  const isHeavy = d > 60, isMedium = d > 30;
  switch (energy) {
    case "high": return 10;
    case "medium": return isHeavy ? 5 : isMedium ? 7 : 9;
    case "low": return isHeavy ? 2 : isMedium ? 4 : 7;
    default: return isHeavy ? 4 : isMedium ? 6 : 8;
  }
}
function computeAgeDays(task: Task): number {
  if (!task.created_at) return 0;
  const created = new Date(task.created_at).getTime();
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}
function computeDueDateUrgency(task: Task): number {
  if (!task.due_date) return 0;
  const due = new Date(task.due_date).getTime();
  const days = (due - Date.now()) / 86400000;
  if (days < 0) return 10;
  if (days < 1) return 8;
  if (days < 3) return 5;
  if (days < 7) return 3;
  return 1;
}
function scoreTask(task: Task, state: MomentState): number {
  const priority = PRIORITY_WEIGHTS[task.priority] || 5;
  const category = CATEGORY_WEIGHTS[task.category] || 1.0;
  const goalAlignment = computeGoalAlignment(task, state);
  const energy = state.today_state?.energy || "unknown";
  const energyFit = computeEnergyFit(task, energy);
  const ageBonus = Math.min(computeAgeDays(task) * 0.5, 5);
  const dueUrg = computeDueDateUrgency(task);
  const continuity = task.status === "in_progress" ? 8 : 0;
  return priority * 1.5 + goalAlignment * category + energyFit + dueUrg * 2 + ageBonus + continuity;
}

export function selectNextBestTask(state: MomentState) {
  const today = getTodayString();
  const tasks = (state.tasks || []).filter(
    (t) =>
      (t.status === "pending" || t.status === "in_progress") &&
      (!t.due_date || t.due_date === today),
  );
  if (tasks.length === 0) return { best: null as ScoredTask | null, ranked: [] as ScoredTask[] };
  const scored: ScoredTask[] = tasks
    .map((t) => ({ ...t, score: scoreTask(t, state) }))
    .sort((a, b) => b.score - a.score);
  return { best: scored[0], ranked: scored };
}

export function computeGoalProgress(state: MomentState): number {
  const linkedTasks = (state.tasks || []).filter((t) => t.goal_id === "primary");
  const linkedBlocks = (state.schedule_state.day_plan || []).filter((b) => b.goal_link === "primary" || b.type === "goal_work");
  const total = linkedTasks.length + linkedBlocks.length;
  if (total === 0) return 0;
  const done = linkedTasks.filter((t) => t.status === "done").length + linkedBlocks.filter((b) => b.status === "completed").length;
  return Math.round((done / total) * 100);
}

export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isToday(dateString: string | undefined): boolean {
  if (!dateString) return false;
  if (dateString.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString === getTodayString();
  try {
    const d = new Date(dateString);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  } catch { return false; }
}

export function hasReflectionForToday(state: MomentState): boolean {
  const today = getTodayString();
  return (state.reflections || []).some((r) => r.date === today);
}
