import type { MomentState } from "@/lib/types";

export type ProgressEventKind =
  | "task_completed"
  | "review_saved"
  | "lesson_learned"
  | "plan_repaired"
  | "streak_milestone"
  | "weekly_recap";

export interface ProgressEvent {
  id: string;
  kind: ProgressEventKind;
  actor: { name: string; username?: string; isYou: boolean; isDemo?: boolean };
  title: string;       // headline e.g. "completed 'Read Chapter 4'"
  context?: string;    // optional 1-line context
  timestamp: string;   // ISO
}

const STREAK_THRESHOLDS = [3, 7, 14, 30, 100];

function streakFromTasks(tasks: MomentState["tasks"] = []): number {
  const days = new Set<string>();
  for (const t of tasks) {
    if (t.status === "done" && t.completed_at) {
      days.add(String(t.completed_at).slice(0, 10));
    }
  }
  let streak = 0;
  const cur = new Date();
  for (let i = 0; i < 400; i++) {
    const k = cur.toISOString().slice(0, 10);
    if (days.has(k)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function selectProgressEvents(state: MomentState | null): ProgressEvent[] {
  if (!state) return [];
  const me = state.profile?.display_name?.trim() || "You";
  const events: ProgressEvent[] = [];

  const completed = (state.tasks ?? [])
    .filter((t) => t.status === "done" && t.completed_at)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    .slice(0, 15);

  for (const t of completed) {
    events.push({
      id: `task_${t.id}`,
      kind: "task_completed",
      actor: { name: me, isYou: true },
      title: `completed “${t.title}”`,
      context: t.why_now || undefined,
      timestamp: t.completed_at as string,
    });
    const notes: any[] = (t as any).notes ?? [];
    const review = notes.find((n) => n?.kind === "review" || n?.type === "review");
    if (review) {
      events.push({
        id: `review_${t.id}`,
        kind: "review_saved",
        actor: { name: me, isYou: true },
        title: `saved a review on “${t.title}”`,
        context: typeof review.content === "string" ? review.content.slice(0, 120) : undefined,
        timestamp: review.created_at || (t.completed_at as string),
      });
    }
  }

  // Lessons from chat or learning portfolio (lightweight: chat messages w/ lesson tag)
  const lessons = (state.chat_messages ?? [])
    .filter((m: any) => m.role === "assistant" && /lesson|learned/i.test(m.content ?? ""))
    .slice(-3);
  for (const l of lessons) {
    events.push({
      id: `lesson_${l.id}`,
      kind: "lesson_learned",
      actor: { name: me, isYou: true },
      title: `learned something new`,
      context: (l.content ?? "").split("\n")[0].slice(0, 140),
      timestamp: l.created_at || new Date().toISOString(),
    });
  }

  // Plan repaired
  if ((state.schedule_state as any)?.reform_note) {
    events.push({
      id: `repair_${(state.schedule_state as any).week_plan_generated_at ?? "now"}`,
      kind: "plan_repaired",
      actor: { name: me, isYou: true },
      title: `repaired today's plan`,
      context: (state.schedule_state as any).reform_note,
      timestamp: (state.schedule_state as any).week_plan_generated_at || new Date().toISOString(),
    });
  }

  // Streak milestone
  const streak = streakFromTasks(state.tasks ?? []);
  const hit = STREAK_THRESHOLDS.filter((n) => n <= streak).pop();
  if (hit) {
    events.push({
      id: `streak_${hit}`,
      kind: "streak_milestone",
      actor: { name: me, isYou: true },
      title: `hit a ${hit}-day streak`,
      timestamp: new Date().toISOString(),
    });
  }

  // Weekly recap (once per ISO week)
  const weekKey = (() => {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  })();
  const doneThisWeek = completed.filter((t) => {
    const d = new Date(t.completed_at as string);
    const diff = (Date.now() - d.getTime()) / 86400000;
    return diff <= 7;
  }).length;
  if (doneThisWeek > 0) {
    events.push({
      id: `recap_${weekKey}`,
      kind: "weekly_recap",
      actor: { name: me, isYou: true },
      title: `wrapped the week with ${doneThisWeek} task${doneThisWeek === 1 ? "" : "s"} done`,
      timestamp: new Date().toISOString(),
    });
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
