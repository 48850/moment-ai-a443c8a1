import type { MomentState, WeekBlock, WeekCategory } from "@/lib/types";

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const CATEGORY_META: Record<WeekCategory, { label: string; tone: string; ring: string; bg: string }> = {
  school:     { label: "School",     tone: "text-amber-300",   ring: "ring-amber-500/40",   bg: "bg-amber-500/15" },
  goal:       { label: "Goal",       tone: "text-primary",     ring: "ring-primary/50",     bg: "bg-primary/15" },
  commitment: { label: "Commitment", tone: "text-rose-300",    ring: "ring-rose-500/40",    bg: "bg-rose-500/15" },
  hobby:      { label: "Hobby",      tone: "text-emerald-300", ring: "ring-emerald-500/40", bg: "bg-emerald-500/15" },
  rest:       { label: "Rest",       tone: "text-muted-foreground", ring: "ring-border", bg: "bg-secondary" },
};

const uid = () => `wb_${Math.random().toString(36).slice(2, 10)}`;

function hm(h: number, m = 0) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Seed a 7-day liquid week plan from the user's constraints + active goal.
 * Weekdays carry school + goal work + hobby; weekends invert toward goal + hobby + rest.
 */
export function seedWeekPlan(state: MomentState, opts?: { variation?: number }): WeekBlock[] {
  // Variation 0-9 produces visibly different layouts every reseed.
  const variation = opts?.variation ?? Math.floor(Math.random() * 10);
  const rand = mulberry32(variation * 9301 + 49297);
  const c = state.constraints;
  const goalLabel = state.active_goal?.statement
    ? truncate(state.active_goal.statement, 32)
    : "Goal work";

  const pendingGoalTasks = (state.tasks ?? [])
    .filter((t) => t.status !== "done" && t.status !== "skipped" && (t.priority === "high" || t.category === "goal_direct"))
    .slice(0, 5);

  const schoolEnd = c?.school_end_time || "15:30";
  const studyMin = Math.max(45, c?.study_minutes_daily ?? 90);
  const exerciseMin = Math.max(20, c?.exercise_minutes_daily ?? 40);

  const blocks: WeekBlock[] = [];

  // Weekdays (Mon-Fri)
  for (let day = 0; day < 5; day++) {
    blocks.push({
      id: uid(),
      day_index: day,
      start_time: "08:00",
      end_time: schoolEnd,
      title: "School",
      category: "school",
      notes: "",
      is_locked: true,
    });
    // After-school goal work: start window shifts dramatically per reseed
    const baseDelay = 20 + Math.floor(rand() * 90); // 20..110 min after school
    const startGoal = bumpTime(schoolEnd, baseDelay + day * 5);
    const dynamicStudy = studyMin + Math.floor(rand() * 30) - 10; // ±10–20 min
    const endGoal = bumpTime(startGoal, Math.max(30, dynamicStudy));
    blocks.push({
      id: uid(),
      day_index: day,
      start_time: startGoal,
      end_time: endGoal,
      title: pendingGoalTasks.length
        ? truncate(pendingGoalTasks[(day + variation) % pendingGoalTasks.length].title, 40)
        : goalLabel,
      category: "goal",
      notes: "",
      is_locked: false,
    });
    // Hobby / movement window — sometimes before goal, sometimes after, length varies
    const hobbyGap = 15 + Math.floor(rand() * 30);
    const startHobby = bumpTime(endGoal, hobbyGap);
    const dynamicEx = exerciseMin + Math.floor(rand() * 20) - 5;
    const endHobby = bumpTime(startHobby, Math.max(15, dynamicEx));
    const hobbyNames = ["Run", "Hobby time", "Strength", "Walk + read", "Creative time"];
    blocks.push({
      id: uid(),
      day_index: day,
      start_time: startHobby,
      end_time: endHobby,
      title: hobbyNames[(day + variation) % hobbyNames.length],
      category: "hobby",
      notes: "",
      is_locked: false,
    });
  }

  // Weekend long blocks
  for (let day = 5; day < 7; day++) {
    blocks.push({
      id: uid(),
      day_index: day,
      start_time: "10:00",
      end_time: "12:00",
      title: `Deep ${goalLabel}`,
      category: "goal",
      notes: "",
      is_locked: false,
    });
    blocks.push({
      id: uid(),
      day_index: day,
      start_time: "14:00",
      end_time: "15:30",
      title: day === 5 ? "Hobby project" : "Long walk",
      category: "hobby",
      notes: "",
      is_locked: false,
    });
    if (day === 6) {
      blocks.push({
        id: uid(),
        day_index: day,
        start_time: "17:00",
        end_time: "18:00",
        title: "Week reset",
        category: "rest",
        notes: "Plan the week ahead, decompress.",
        is_locked: false,
      });
    }
  }

  // Optional fixed commitments from constraints
  for (const fc of c?.fixed_commitments ?? []) {
    const dayIdx = parseDayName(fc.day_of_week);
    if (dayIdx == null) continue;
    blocks.push({
      id: uid(),
      day_index: dayIdx,
      start_time: fc.start_time || "18:00",
      end_time: fc.end_time || "19:00",
      title: fc.title || "Commitment",
      category: "commitment",
      notes: "",
      is_locked: true,
    });
  }

  return blocks.sort(sortBlocks);
}

export function sortBlocks(a: WeekBlock, b: WeekBlock) {
  if (a.day_index !== b.day_index) return a.day_index - b.day_index;
  return a.start_time.localeCompare(b.start_time);
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function bumpTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = Math.max(0, Math.min(23 * 60 + 59, total));
  return hm(Math.floor(wrapped / 60), wrapped % 60);
}

function parseDayName(s: string): number | null {
  const map: Record<string, number> = {
    mon: 0, monday: 0, tue: 1, tues: 1, tuesday: 1,
    wed: 2, weds: 2, wednesday: 2, thu: 3, thurs: 3, thursday: 3,
    fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6,
  };
  if (!s) return null;
  return map[s.trim().toLowerCase()] ?? null;
}

/**
 * Reform the week: keep locked blocks, regenerate the rest with a new variation.
 */
export function reformWeekPlan(state: MomentState, current: WeekBlock[]): WeekBlock[] {
  const locked = current.filter((b) => b.is_locked);
  const fresh = seedWeekPlan(state, { variation: Math.floor(Math.random() * 5) });
  // Drop fresh blocks that conflict with a locked block on the same day
  const kept = fresh.filter((nb) => {
    return !locked.some(
      (lb) => lb.day_index === nb.day_index && overlap(lb, nb),
    );
  });
  return [...locked, ...kept].sort(sortBlocks);
}

function overlap(a: WeekBlock, b: WeekBlock) {
  return a.start_time < b.end_time && b.start_time < a.end_time;
}
