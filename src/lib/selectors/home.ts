import type { MomentState, Task } from "@/lib/types";

export interface DecisiveMoveVM {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
}

export interface WhyThisMatteredVM {
  populated: boolean;
  taskTitle: string;
  workstreamName: string;
  rationale: string;
  nextProof: string;
}

export interface HomeViewModel {
  greeting: string;
  goalSnippet: string;
  decisiveMove: DecisiveMoveVM | null;
  whyThisMattered: WhyThisMatteredVM;
  tasks: Task[];
}

function todayLabel(): string {
  const d = new Date();
  return `Today, ${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isTodayTask(task: Task): boolean {
  const today = todayKey();
  if (task.status === "done") return task.completed_at?.slice(0, 10) === today;
  if (task.status === "skipped") return false;
  return !task.due_date || task.due_date === today;
}

function selectThreeTodayTasks(tasks: Task[]): Task[] {
  const priority = { high: 0, medium: 1, low: 2 } as const;
  return tasks
    .filter(isTodayTask)
    .sort((a, b) => priority[a.priority] - priority[b.priority] || a.created_at.localeCompare(b.created_at))
    .slice(0, 3);
}

/**
 * Connects the most recently completed task to the active goal and matching
 * workstream. Returns populated=false when insufficient data exists.
 */
export function selectWhyThisMattered(state: MomentState): WhyThisMatteredVM {
  const empty: WhyThisMatteredVM = {
    populated: false,
    taskTitle: "",
    workstreamName: "",
    rationale: "",
    nextProof: "",
  };
  const goalStatement = state.active_goal?.statement?.trim() ?? "";
  if (!goalStatement) return empty;

  const doneTasks = (state.tasks ?? [])
    .filter((t) => t.status === "done" && t.completed_at)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const latest = doneTasks[0];
  if (!latest) return empty;

  const pm = state.pursuit_model;
  let workstreamName = "";
  let nextProof = "";
  if (pm && latest.workstream_id) {
    const ws = pm.workstreams.find((w) => w.id === latest.workstream_id);
    if (ws) {
      workstreamName = ws.name;
      nextProof = ws.next_proof || "";
    }
  }
  if (!workstreamName && latest.domain_id) {
    const domain = (state.pathway?.domains ?? []).find((d) => d.id === latest.domain_id);
    if (domain) {
      workstreamName = domain.name;
      nextProof = domain.next_proof || "";
    }
  }

  const rationale =
    workstreamName && nextProof
      ? `"${latest.title}" advances ${workstreamName}. Next proof: ${nextProof}.`
      : workstreamName
      ? `"${latest.title}" advances ${workstreamName} toward your goal.`
      : `"${latest.title}" is a direct step toward: ${goalStatement}.`;

  return {
    populated: true,
    taskTitle: latest.title,
    workstreamName,
    rationale,
    nextProof,
  };
}

export function selectHomeViewModel(state: MomentState): HomeViewModel {
  const tasks = selectThreeTodayTasks(state.tasks ?? []);
  // Decisive move: prefer first pending high-priority goal_direct task.
  const candidates = tasks.filter((t) => t.status !== "done" && t.status !== "skipped");
  const sorted = [...candidates].sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 } as const;
    return pri[a.priority] - pri[b.priority];
  });
  const dm = sorted[0];

  return {
    greeting: todayLabel(),
    goalSnippet: state.active_goal?.statement?.trim() || "your pursuit",
    decisiveMove: dm
      ? {
          id: dm.id,
          title: dm.title,
          description: dm.description,
          estimatedMinutes: dm.estimated_minutes,
        }
      : null,
    whyThisMattered: selectWhyThisMattered(state),
    tasks,
  };
}
