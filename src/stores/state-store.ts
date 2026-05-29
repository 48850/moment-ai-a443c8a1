// @ts-nocheck
import { create } from "zustand";
import type { MomentState, AppMode, ExecutionFeedbackItem, ScheduleBlock, ForgeInterviewAnswer, ForgeState } from "@/lib/types";
import type { MomentAction } from "@/lib/types/actions";
import { storage } from "@/lib/storage/local";
import { createDefaultState, createEmptyUserState } from "@/lib/state/defaults";
import { resolveMode, filterPatchByMode } from "@/lib/state/modes";
import { compilePursuitModel } from "@/lib/pursuit/compiler";
import {
  buildInterviewQuestions,
  generateFeatureCandidates,
  selectTopFeatures,
  instantiateModuleManifests,
} from "@/lib/forge/compiler";
import { seedWeekPlan, reformWeekPlan, sortBlocks as weekSort } from "@/lib/engine/week-plan";
import { scheduleTaskInWeek, dayIndexFromDueDate } from "@/lib/engine/auto-schedule";
import { evaluateGoalFeasibility } from "@/lib/engine/goal-feasibility";
import { filterStageAppropriateTasks } from "@/lib/engine/task-stage-filter";
import { adaptPlanAfterFeedback } from "@/lib/exam/build-exam-plan";

interface StateStore {
  state: MomentState | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  bootstrap: (userId: string, displayName: string, timezone: string) => void;
  reset: () => void;
  applyPatch: (patch: Partial<MomentState>) => void;
  getResolvedMode: () => string;
  dispatch: (action: MomentAction) => void;
}

const now = () => new Date().toISOString();
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = () => dateKey();

function capTasksForToday(tasks: MomentState["tasks"]): MomentState["tasks"] {
  // Kept as a compatibility shim for older call sites. The hard 3-task cap is removed.
  return tasks;
}

function normaliseTitleForMerge(title = "") {
  return title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["the", "and", "for", "with", "into", "task", "review"].includes(w))
    .join(" ")
    .trim();
}

function titleSimilarity(a = "", b = "") {
  const aw = new Set(normaliseTitleForMerge(a).split(" ").filter(Boolean));
  const bw = new Set(normaliseTitleForMerge(b).split(" ").filter(Boolean));
  if (!aw.size || !bw.size) return 0;
  const overlap = [...aw].filter((w) => bw.has(w)).length;
  return overlap / Math.max(aw.size, bw.size);
}

function mergeTask(tasks: MomentState["tasks"], incoming: MomentState["tasks"][number]) {
  const duplicate = tasks.find((t) =>
    t.status !== "done" &&
    t.status !== "skipped" &&
    (titleSimilarity(t.title, incoming.title) >= 0.62 ||
      (t.resource_url && incoming.resource_url && t.resource_url === incoming.resource_url))
  );
  if (!duplicate) return { tasks: [...tasks, incoming], task: incoming, added: true };

  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  const mergedNotes = [
    ...((duplicate as any).notes ?? []),
    ...((incoming as any).notes ?? []).filter(
      (note: any) => !((duplicate as any).notes ?? []).some((n: any) => n.content?.trim() === note.content?.trim()),
    ),
  ];
  const merged = {
    ...duplicate,
    title: incoming.created_by === "ai" && incoming.title.length > duplicate.title.length ? incoming.title : duplicate.title,
    description: duplicate.description || incoming.description,
    priority: priorityRank[incoming.priority] < priorityRank[duplicate.priority] ? incoming.priority : duplicate.priority,
    estimated_minutes: Math.max(duplicate.estimated_minutes ?? 30, incoming.estimated_minutes ?? 30),
    due_date: duplicate.due_date || incoming.due_date,
    why_now: duplicate.why_now || incoming.why_now,
    proof_of_completion: duplicate.proof_of_completion || incoming.proof_of_completion,
    resource_url: duplicate.resource_url || incoming.resource_url,
    resource_label: duplicate.resource_label || incoming.resource_label,
    notes: mergedNotes,
  } as typeof duplicate;
  return { tasks: tasks.map((t) => (t.id === duplicate.id ? merged : t)), task: merged, added: false };
}

function syncActiveTasksToWeek(state: MomentState): MomentState {
  const activeTaskById = new Map(
    (state.tasks ?? [])
      .filter((t) => t.status !== "done" && t.status !== "skipped")
      .map((t) => [t.id, t]),
  );
  const normTitle = (s: string) =>
    (s ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").slice(0, 80);
  const seenTaskIds = new Set<string>();
  const seenTitleKeys = new Set<string>(); // category::normalizedTitle — hard dedupe across the week
  let week = (state.schedule_state.week_plan ?? [])
    .filter((b: any) => {
      // Drop blocks linked to inactive tasks
      if (b.task_id && (!activeTaskById.has(b.task_id) || seenTaskIds.has(b.task_id))) return false;
      if (b.task_id) seenTaskIds.add(b.task_id);
      // Hard dedupe by normalized title across the week — but EXEMPT school,
      // commitment, and locked blocks (one "School" per weekday is expected).
      if (b.category === "school" || b.category === "commitment" || b.is_locked) return true;
      const key = `${b.category}::${normTitle(b.title)}`;
      if (!key.endsWith("::")) {
        if (seenTitleKeys.has(key)) return false;
        seenTitleKeys.add(key);
      }
      return true;
    })
    .map((b: any) => {
      if (!b.task_id) return b;
      const task = activeTaskById.get(b.task_id)!;
      return {
        ...b,
        day_index: task.due_date ? dayIndexFromDueDate(task.due_date) : b.day_index,
        title: task.title,
        notes: task.why_now ?? b.notes ?? "",
      };
    })
    .sort(weekSort);

  let tasks = state.tasks ?? [];
  let synthState: MomentState = { ...state, tasks, schedule_state: { ...state.schedule_state, week_plan: week } };
  // Track normalized titles of every block currently on the week so we never
  // schedule a second block for a task whose work is already represented.
  const titlesOnWeek = new Set<string>(
    week.map((b: any) => normTitle(b.title)).filter(Boolean) as string[],
  );
  // Also track normalized titles of TASKS we've already scheduled in this pass,
  // so two same-titled tasks can't both produce a block.
  const scheduledTaskTitles = new Set<string>();

  for (const task of tasks) {
    if (task.status === "done" || task.status === "skipped") continue;
    // Already represented by an explicit task_id link?
    const existingById = week.find((b: any) => b.task_id === task.id);
    if (existingById) {
      tasks = tasks.map((t) => (t.id === task.id && t.scheduled_block_id !== existingById.id ? { ...t, scheduled_block_id: existingById.id } : t));
      continue;
    }
    const taskKey = normTitle(task.title);
    // Already represented by an identically-titled block? Adopt it instead of creating a duplicate.
    const existingByTitle = week.find((b: any) => !b.task_id && normTitle(b.title) === taskKey);
    if (existingByTitle) {
      existingByTitle.task_id = task.id;
      tasks = tasks.map((t) => (t.id === task.id ? { ...t, scheduled_block_id: existingByTitle.id } : t));
      synthState = { ...synthState, tasks, schedule_state: { ...synthState.schedule_state, week_plan: week } };
      continue;
    }
    // HARD GUARD: skip if any block on the week already has this title, OR if
    // we've already scheduled another task with the same title in this pass.
    if (taskKey && (titlesOnWeek.has(taskKey) || scheduledTaskTitles.has(taskKey))) continue;
    const block = scheduleTaskInWeek(synthState, task);
    if (!block) continue;
    week = [...week, block].sort(weekSort);
    if (taskKey) {
      titlesOnWeek.add(taskKey);
      scheduledTaskTitles.add(taskKey);
    }
    tasks = tasks.map((t) => (t.id === task.id ? { ...t, scheduled_block_id: block.id } : t));
    synthState = { ...synthState, tasks, schedule_state: { ...synthState.schedule_state, week_plan: week } };
  }

  return { ...state, tasks, schedule_state: { ...state.schedule_state, week_plan: week } };
}

function persist(state: MomentState) {
  storage.saveState(state.user_id, state);
}

function touch(state: MomentState): MomentState {
  return { ...state, profile: { ...state.profile, last_active_at: now() } };
}

export const useStateStore = create<StateStore>((set, get) => ({
  state: null,
  isHydrated: false,

  hydrate: async () => {
    let session = storage.getSession();
    if (!session) {
      const userId = `guest_${Math.random().toString(36).slice(2, 10)}`;
      session = { userId, displayName: "" };
      storage.setSession(session.userId, session.displayName);
    }
    const saved = await storage.getState(session.userId);
    if (saved) {
      // Backfill fields added after a previous schema version.
      const isDemo = typeof window !== "undefined" &&
        (new URLSearchParams(window.location.search).get("demo") === "true" ||
         import.meta.env.VITE_ENABLE_DEMO_STATE === "true");

      // Backfill onboarding for users who existed before onboarding was added
      let onboardingBackfill = (saved as any).onboarding;
      if (!onboardingBackfill) {
        const hasGoal = Boolean(saved.active_goal?.statement?.trim());
        onboardingBackfill = {
          completed: hasGoal,
          current_stage: saved.active_goal?.current_stage ?? "",
          answers: {},
          last_updated: "",
          understanding: { knowns: [], unknowns: [], assumptions: [], confidence: "low" as const },
        };
      }

      // Backfill profile extended fields
      const profileBackfill = {
        age_bracket: "unknown" as const,
        commitments: [] as string[],
        preferences: { tone: "calm" as const, strictness: "soft" as const, schedule_style: "flexible" as const, support_style: "coach" as const },
        education_system: "unknown" as const,
        ...((saved.profile as any) ?? {}),
      };
      // Clear legacy hardcoded "Alex" default — no real user set this name intentionally
      if (profileBackfill.display_name === "Alex") profileBackfill.display_name = "";

      // Backfill active_goal extended fields
      const goalBackfill = saved.active_goal
        ? {
            desired_identity: "",
            success_definition: "",
            current_stage: "",
            target_stage: "",
            ...saved.active_goal,
          }
        : saved.active_goal;

      let hydrated: MomentState = {
        ...saved,
        tasks: capTasksForToday(saved.tasks ?? []),
        profile: profileBackfill,
        active_goal: goalBackfill,
        execution_feedback: saved.execution_feedback ?? [],
        schedule_state: {
          ...saved.schedule_state,
          day_plan_a_snapshot: saved.schedule_state?.day_plan_a_snapshot ?? [],
          reform_note: saved.schedule_state?.reform_note ?? "",
          week_plan: (saved.schedule_state as any)?.week_plan ?? [],
          week_plan_generated_at: (saved.schedule_state as any)?.week_plan_generated_at ?? "",
        },
        alignment: saved.alignment ?? {
          status: "aligned",
          drift_score: 0,
          last_updated: now(),
          reasons: [],
        },
        home: saved.home ?? { active_plan: "plan_a" },
        forge_state: {
          interview_answers: [],
          candidate_features: [],
          selected_feature_ids: [],
          generated_modules: [],
          compiler_status: "idle" as const,
          ...(saved.forge_state ?? {}),
          guidebooks: (saved.forge_state as any)?.guidebooks ?? [],
          feature_runs: (saved.forge_state as any)?.feature_runs ?? [],
          forge_signals: (saved.forge_state as any)?.forge_signals ?? [],
          guidebook_build_status: ((saved.forge_state as any)?.guidebook_build_status ?? "idle") as ForgeState["guidebook_build_status"],
          draft_guidebook: (saved.forge_state as any)?.draft_guidebook ?? null,
        } as ForgeState,
        pursuit_model: "pursuit_model" in saved ? saved.pursuit_model : null,
        rescue_signals: (saved as any).rescue_signals ?? [],
        exam_emergencies: (saved as any).exam_emergencies ?? [],
        goals: (saved as any).goals ?? [],
        moment_trials: (saved as any).moment_trials ?? [],
        mistake_cards: (saved as any).mistake_cards ?? [],
        chat_preferences: (saved as any).chat_preferences ?? { tone: "default" },
        chat_state: (saved as any).chat_state ?? {
          post_onboarding_specialisation_required: false,
          specialisation_phase: "explain_goal" as const,
        },
        chat_messages: (saved as any).chat_messages ?? [],
        onboarding: onboardingBackfill,
      };
      hydrated = syncActiveTasksToWeek(hydrated);
      // In demo mode, use demo state instead of saved (only for fresh demo sessions)
      if (isDemo && !saved.active_goal?.statement?.trim()) {
        const demo = createDefaultState(session.userId, session.displayName, tz());
        persist(demo);
        set({ state: demo, isHydrated: true });
      } else {
        set({ state: hydrated, isHydrated: true });
      }
    } else {
      // New user — use empty state (no demo data); onboarding will capture their goal
      const isDemo = typeof window !== "undefined" &&
        (new URLSearchParams(window.location.search).get("demo") === "true" ||
         import.meta.env.VITE_ENABLE_DEMO_STATE === "true");
      const fresh = isDemo
        ? createDefaultState(session.userId, session.displayName, tz())
        : createEmptyUserState(session.userId, session.displayName, tz());
      persist(fresh);
      set({ state: fresh, isHydrated: true });
    }
  },

  bootstrap: (userId, displayName, timezone) => {
    storage.setSession(userId, displayName);
    const fresh = createDefaultState(userId, displayName, timezone);
    persist(fresh);
    set({ state: fresh, isHydrated: true });
  },

  reset: () => {
    storage.clearSession();
    set({ state: null, isHydrated: false });
  },

  applyPatch: (patch) => {
    const current = get().state;
    if (!current) return;
    const targetMode = (patch.system_state?.current_mode as AppMode) || resolveMode(current);
    const filtered = filterPatchByMode(patch, targetMode);
    let updated: MomentState = { ...current };
    let goalChanged = false;
    for (const [k, v] of Object.entries(filtered)) {
      if (k === "active_goal") goalChanged = true;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        (updated as any)[k] = { ...(current as any)[k], ...v };
      } else {
        (updated as any)[k] = v;
      }
    }
    if (goalChanged && updated.active_goal && updated.active_goal.statement.trim() !== "") {
      updated.pursuit_model = compilePursuitModel(updated.active_goal, updated.pursuit_model);
    } else if (goalChanged && (!updated.active_goal || !updated.active_goal.statement.trim())) {
      updated.pursuit_model = null;
    }
    updated = touch(updated);
    set({ state: updated });
    persist(updated);
  },

  getResolvedMode: () => {
    const s = get().state;
    return s ? resolveMode(s) : "lock_goal";
  },

  dispatch: (action) => {
    const s = get().state;
    if (!s) return;
    let next: MomentState = s;

    switch (action.type) {
      case "task/add": {
        let taskToAdd = action.payload;
        // Run stage filter for AI-created tasks at the state boundary
        if (taskToAdd.created_by === "ai") {
          const [filtered] = filterStageAppropriateTasks([taskToAdd], {
            age_bracket: s.profile.age_bracket ?? "unknown",
            current_stage: s.active_goal.current_stage ?? "",
            feasibility: s.active_goal.feasibility,
          });
          taskToAdd = { ...taskToAdd, ...filtered };
        }
        const merged = mergeTask(s.tasks, taskToAdd);
        next = syncActiveTasksToWeek({ ...s, tasks: merged.tasks });
        break;
      }

      case "task/bulk_add": {
        const filtered = filterStageAppropriateTasks(
          action.payload.filter((t) => t.created_by === "ai"),
          {
            age_bracket: s.profile.age_bracket ?? "unknown",
            current_stage: s.active_goal.current_stage ?? "",
            feasibility: s.active_goal.feasibility,
          },
        );
        const userTasks = action.payload.filter((t) => t.created_by !== "ai");
        const allNew = [...userTasks, ...filtered];
        const mergedTasks = allNew.reduce((acc, task) => mergeTask(acc, task).tasks, s.tasks);
        next = syncActiveTasksToWeek({ ...s, tasks: mergedTasks });
        break;
      }
      case "task/update": {
        const updatedTasks = s.tasks.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.changes } : t,
        );
        next = syncActiveTasksToWeek({ ...s, tasks: updatedTasks });
        break;
      }
      case "task/complete":
        next = syncActiveTasksToWeek({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === action.payload.id ? { ...t, status: "done", completed_at: action.payload.completed_at } : t,
          ),
        });
        // Fire global celebration (flame burst + compliment toast).
        if (typeof window !== "undefined") {
          try {
            window.dispatchEvent(new CustomEvent("streak:burst"));
            import("@/components/app/StreakFlame").then(({ COMPLIMENTS }) => {
              import("sonner").then(({ toast }) => {
                const msg = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
                toast.success(msg, { duration: 2400, icon: "🔥" });
              });
            });
          } catch { /* noop */ }
        }
        break;
      case "task/delete":
        next = syncActiveTasksToWeek({
          ...s,
          tasks: s.tasks.filter((t) => t.id !== action.payload.id),
        });
        break;
      case "schedule/addBlock":
        next = {
          ...s,
          schedule_state: { ...s.schedule_state, day_plan: [...s.schedule_state.day_plan, action.payload] },
        };
        break;
      case "schedule/updateBlock":
        next = {
          ...s,
          schedule_state: {
            ...s.schedule_state,
            day_plan: s.schedule_state.day_plan.map((b) =>
              b.id === action.payload.id ? { ...b, ...action.payload.changes } : b,
            ),
          },
        };
        break;

      case "week/set":
        next = syncActiveTasksToWeek({
          ...s,
          schedule_state: {
            ...s.schedule_state,
            week_plan: action.payload,
            week_plan_generated_at: now(),
          },
        });
        break;
      case "week/addBlock":
        next = {
          ...s,
          schedule_state: {
            ...s.schedule_state,
            week_plan: [...(s.schedule_state.week_plan ?? []), action.payload].sort(weekSort),
          },
        };
        break;
      case "week/updateBlock":
        next = {
          ...s,
          schedule_state: {
            ...s.schedule_state,
            week_plan: (s.schedule_state.week_plan ?? [])
              .map((b: any) => (b.id === action.payload.id ? { ...b, ...action.payload.changes } : b))
              .sort(weekSort),
          },
        };
        break;
      case "week/deleteBlock":
        next = {
          ...s,
          schedule_state: {
            ...s.schedule_state,
            week_plan: (s.schedule_state.week_plan ?? []).filter((b: any) => b.id !== action.payload.id),
          },
        };
        break;
      case "week/seed": {
        const seeded = seedWeekPlan(s);
        next = syncActiveTasksToWeek({
          ...s,
          schedule_state: { ...s.schedule_state, week_plan: seeded, week_plan_generated_at: now() },
        });
        break;
      }
      case "week/reform": {
        const reformed = reformWeekPlan(s, (s.schedule_state.week_plan ?? []) as any);
        next = syncActiveTasksToWeek({
          ...s,
          schedule_state: { ...s.schedule_state, week_plan: reformed, week_plan_generated_at: now() },
        });
        break;
      }

      // AUDIT FIX: typed feedback persistence.
      case "feedback/add": {
        const item: ExecutionFeedbackItem = action.payload;
        next = { ...s, execution_feedback: [...s.execution_feedback, item] };
        break;
      }

      // AUDIT FIX: real Plan A/B reform with snapshot-once-only.
      case "plan/reform": {
        const { reformed_plan, reform_note } = action.payload;
        const planAExists = (s.schedule_state.day_plan_a_snapshot ?? []).length > 0;
        const snapshot: ScheduleBlock[] = planAExists
          ? s.schedule_state.day_plan_a_snapshot
          : s.schedule_state.day_plan;
        next = {
          ...s,
          schedule_state: {
            ...s.schedule_state,
            day_plan: reformed_plan,
            day_plan_a_snapshot: snapshot,
            reform_note,
          },
          home: { ...s.home, active_plan: "plan_b" },
        };
        break;
      }

      case "reflection/add": {
        const filtered = s.reflections.filter((r) => r.date !== action.payload.date);
        const r = action.payload;
        const newFeedback: ExecutionFeedbackItem[] = [];
        if (r.energy_rating <= 2) {
          newFeedback.push({
            id: crypto.randomUUID(),
            task_id: "",
            task_title: `Reflection ${r.date}`,
            completed_at: r.created_at,
            feedback: "hard",
            note: r.struggle || "low energy reported in reflection",
            created_at: r.created_at,
            source: "reflection",
            target_id: r.id,
          });
        }
        if (r.struggle && r.struggle.length > 5) {
          newFeedback.push({
            id: crypto.randomUUID(),
            task_id: "",
            task_title: `Reflection ${r.date}`,
            completed_at: r.created_at,
            feedback: "too_big",
            note: r.struggle,
            created_at: r.created_at,
            source: "reflection",
            target_id: r.id,
          });
        }
        next = {
          ...s,
          reflections: [...filtered, r],
          execution_feedback: [...s.execution_feedback, ...newFeedback],
        };
        break;
      }
      case "alignment/set":
        next = { ...s, alignment: action.payload };
        break;
      case "home/setPlan":
        next = { ...s, home: { ...s.home, active_plan: action.payload } };
        break;

      case "goal/set": {
        const newGoal = action.payload;
        let feasibility = newGoal.feasibility;
        if (!feasibility && newGoal.statement.trim() && s.profile.age_bracket !== "unknown") {
          feasibility = evaluateGoalFeasibility({
            goal: newGoal.statement,
            age_bracket: s.profile.age_bracket ?? "unknown",
            school_year: s.profile.school_year,
            stage_of_life: s.profile.academic_context,
            pursuit_family: s.pursuit_model?.pursuit_family ?? "generic",
            current_stage: newGoal.current_stage ?? s.active_goal.current_stage ?? "",
          });
        }
        const goalWithFeasibility = feasibility
          ? {
              ...newGoal,
              feasibility,
              current_stage: feasibility.user_stage,
              target_stage: feasibility.target_stage,
              reality_gap: feasibility.reality_gap,
            }
          : newGoal;
        next = {
          ...s,
          active_goal: goalWithFeasibility,
          pursuit_model: newGoal.statement.trim()
            ? compilePursuitModel(goalWithFeasibility, s.pursuit_model)
            : null,
        };
        break;
      }
      case "goal/patch": {
        const merged = { ...s.active_goal, ...action.payload, last_updated_at: now() };
        let feasibility = merged.feasibility;
        if (action.payload.statement !== undefined && merged.statement.trim() &&
            s.profile.age_bracket !== "unknown") {
          feasibility = evaluateGoalFeasibility({
            goal: merged.statement,
            age_bracket: s.profile.age_bracket ?? "unknown",
            school_year: s.profile.school_year,
            stage_of_life: s.profile.academic_context,
            pursuit_family: s.pursuit_model?.pursuit_family ?? "generic",
            current_stage: merged.current_stage ?? "",
          });
        }
        const mergedWithFeasibility = feasibility
          ? {
              ...merged,
              feasibility,
              current_stage: feasibility.user_stage,
              target_stage: feasibility.target_stage,
              reality_gap: feasibility.reality_gap,
            }
          : merged;
        next = {
          ...s,
          active_goal: mergedWithFeasibility,
          pursuit_model: mergedWithFeasibility.statement.trim()
            ? compilePursuitModel(mergedWithFeasibility, s.pursuit_model)
            : null,
        };
        break;
      }

      // ─── Multi-goal system ────────────────────────────────────────────────────
      // Horizon ≠ priority. Primary is chosen by importance, not urgency.

      case "goal/add": {
        const existing = (s as any).goals ?? [];
        next = { ...s, goals: [...existing, action.payload] } as any;
        break;
      }

      case "goal/set_role": {
        const goals = ((s as any).goals ?? []).map((g: any) =>
          g.id === action.payload.id ? { ...g, role: action.payload.role } : g,
        );
        next = { ...s, goals } as any;
        break;
      }

      case "goal/set_primary": {
        // Only one goal can be primary — demote others to background unless they are pressure
        const goals = ((s as any).goals ?? []).map((g: any) => {
          if (g.id === action.payload.id) return { ...g, role: "primary" };
          if (g.role === "primary") return { ...g, role: "background" };
          return g;
        });
        next = { ...s, goals } as any;
        break;
      }

      case "goal/update": {
        const goals = ((s as any).goals ?? []).map((g: any) =>
          g.id === action.payload.id ? { ...g, ...action.payload.changes } : g,
        );
        next = { ...s, goals } as any;
        break;
      }

      case "profile/patch":
        next = { ...s, profile: { ...s.profile, ...action.payload } };
        break;

      case "onboarding/set_answer":
        next = {
          ...s,
          onboarding: {
            ...s.onboarding,
            answers: { ...s.onboarding.answers, [action.payload.key]: action.payload.value },
          },
        };
        break;

      case "onboarding/complete": {
        const { profile_patch, goal_patch, constraints_patch, answers, understanding, feasibility: providedFeasibility } = action.payload;
        const newGoalStatement = goal_patch.statement ?? s.active_goal.statement;
        const newAgeBracket = profile_patch.age_bracket ?? s.profile.age_bracket ?? "unknown";

        // Use provided feasibility (computed in the onboarding UI before dispatch)
        const feasibility = providedFeasibility;

        const updatedGoal = {
          ...s.active_goal,
          ...goal_patch,
          ...(feasibility ? {
            feasibility,
            current_stage: feasibility.user_stage,
            target_stage: feasibility.target_stage,
            reality_gap: feasibility.reality_gap,
          } : {}),
          last_updated_at: now(),
        };

        next = {
          ...s,
          profile: { ...s.profile, ...profile_patch },
          active_goal: updatedGoal,
          constraints: constraints_patch
            ? { ...s.constraints, ...constraints_patch }
            : s.constraints,
          onboarding: {
            completed: true,
            current_stage: feasibility?.user_stage ?? "",
            answers,
            last_updated: now(),
            understanding,
          },
          chat_state: {
            ...(s.chat_state ?? { post_onboarding_specialisation_required: false, specialisation_phase: "explain_goal" as const }),
            post_onboarding_specialisation_required: true,
            specialisation_phase: "explain_goal" as const,
          },
          pursuit_model: newGoalStatement.trim()
            ? compilePursuitModel(updatedGoal, s.pursuit_model)
            : null,
        };
        // Suppress unused variable warning
        void newAgeBracket;
        break;
      }

      case "pursuit/set_model":
        next = { ...s, pursuit_model: action.payload };
        break;
      case "pursuit/clear_model":
        next = { ...s, pursuit_model: null };
        break;
      case "pursuit/set_active_mode":
        next = s.pursuit_model
          ? { ...s, pursuit_model: { ...s.pursuit_model, active_operating_mode_id: action.payload.operatingModeId } }
          : s;
        break;
      case "pursuit/patch_workstream_status":
        if (s.pursuit_model) {
          next = {
            ...s,
            pursuit_model: {
              ...s.pursuit_model,
              workstreams: s.pursuit_model.workstreams.map((w) =>
                w.id === action.payload.id
                  ? {
                      ...w,
                      status: action.payload.status,
                      bottleneck: action.payload.bottleneck ?? w.bottleneck,
                      next_proof: action.payload.next_proof ?? w.next_proof,
                      last_updated_at: now(),
                    }
                  : w,
              ),
            },
          };
        }
        break;
      case "pursuit/patch_capability":
        if (s.pursuit_model) {
          next = {
            ...s,
            pursuit_model: {
              ...s.pursuit_model,
              capability_clusters: s.pursuit_model.capability_clusters.map((c) =>
                c.id === action.payload.id ? { ...c, ...action.payload.changes } : c,
              ),
            },
          };
        }
        break;
      case "pursuit/patch_standard":
        if (s.pursuit_model) {
          next = {
            ...s,
            pursuit_model: {
              ...s.pursuit_model,
              standards: s.pursuit_model.standards.map((x) =>
                x.id === action.payload.id ? { ...x, ...action.payload.changes } : x,
              ),
            },
          };
        }
        break;
      case "pursuit/patch_risk":
        if (s.pursuit_model) {
          next = {
            ...s,
            pursuit_model: {
              ...s.pursuit_model,
              risks: s.pursuit_model.risks.map((x) =>
                x.id === action.payload.id ? { ...x, ...action.payload.changes } : x,
              ),
            },
          };
        }
        break;
      case "pursuit/patch_evidence_signal":
        if (s.pursuit_model) {
          next = {
            ...s,
            pursuit_model: {
              ...s.pursuit_model,
              evidence_signals: s.pursuit_model.evidence_signals.map((x) =>
                x.id === action.payload.id
                  ? { ...x, last_value: action.payload.last_value, last_checked_at: action.payload.last_checked_at }
                  : x,
              ),
            },
          };
        }
        break;
      case "pursuit/recompile":
        next = {
          ...s,
          pursuit_model: s.active_goal.statement.trim()
            ? compilePursuitModel(s.active_goal, s.pursuit_model)
            : null,
        };
        break;
      case "system/set_mode":
        next = { ...s, system_state: { ...s.system_state, current_mode: action.payload } };
        break;

      case "forge/start_interview": {
        const questions = buildInterviewQuestions(s.pursuit_model);
        const seeded: ForgeInterviewAnswer[] = questions.map((q) => ({
          id: q.id,
          question_key: q.question_key,
          question_text: q.question_text,
          answer_text: "",
          source: "user",
        }));
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            interview_answers: seeded,
            compiler_status: "interviewing",
          },
        };
        break;
      }
      case "forge/answer": {
        const { question_key, question_text, answer_text } = action.payload;
        const existing = s.forge_state.interview_answers ?? [];
        const idx = existing.findIndex((a) => a.question_key === question_key);
        const answers =
          idx >= 0
            ? existing.map((a, i) => (i === idx ? { ...a, answer_text } : a))
            : [
                ...existing,
                {
                  id: crypto.randomUUID(),
                  question_key,
                  question_text,
                  answer_text,
                  source: "user" as const,
                },
              ];
        next = { ...s, forge_state: { ...s.forge_state, interview_answers: answers } };
        break;
      }
      case "forge/generate_candidates": {
        const candidates = generateFeatureCandidates(s.pursuit_model);
        const top = selectTopFeatures(candidates);
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            candidate_features: candidates,
            selected_feature_ids: top,
            compiler_status: "ranking",
          },
        };
        break;
      }
      case "forge/toggle_feature": {
        const sel = new Set(s.forge_state.selected_feature_ids ?? []);
        if (sel.has(action.payload.id)) sel.delete(action.payload.id);
        else sel.add(action.payload.id);
        next = {
          ...s,
          forge_state: { ...s.forge_state, selected_feature_ids: Array.from(sel) },
        };
        break;
      }
      case "forge/instantiate": {
        const modules = instantiateModuleManifests(
          s.forge_state.selected_feature_ids ?? [],
          s.forge_state.candidate_features ?? [],
        );
        const existing = (s.forge_state.generated_modules ?? []);
        const existingActiveNames = new Set(
          existing.filter((m: any) => m.status === "active").map((m: any) => m.name),
        );
        const fresh = modules.filter((m) => !existingActiveNames.has(m.name));
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            generated_modules: [...existing, ...fresh],
            // Clear proposal stack — modules now live as execution containers above.
            interview_answers: [],
            candidate_features: [],
            selected_feature_ids: [],
            compiler_status: "idle",
            last_generated_at: now(),
          },
        };
        break;
      }
      case "forge/set_ai_candidates": {
        const candidates = action.payload.candidates;
        const top = candidates.slice(0, 3).map((c) => c.id);
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            candidate_features: candidates,
            selected_feature_ids: top,
            compiler_status: "ranking",
          },
        };
        break;
      }
      case "forge/update_module": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            generated_modules: (s.forge_state.generated_modules ?? []).map((m: any) =>
              m.id === action.payload.id ? { ...m, ...action.payload.changes } : m,
            ),
          },
        };
        break;
      }
      case "forge/archive_module": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            generated_modules: (s.forge_state.generated_modules ?? []).map((m: any) =>
              m.id === action.payload.id ? { ...m, status: "archived" } : m,
            ),
          },
        };
        break;
      }
      case "forge/delete_module": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            generated_modules: (s.forge_state.generated_modules ?? []).filter((m: any) => m.id !== action.payload.id),
          },
        };
        break;
      }
      case "forge/log_entry": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            generated_modules: (s.forge_state.generated_modules ?? []).map((m: any) =>
              m.id === action.payload.module_id
                ? { ...m, entries: [...(m.entries ?? []), action.payload.entry] }
                : m,
            ),
          },
        };
        break;
      }
      case "forge/reset": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            interview_answers: [],
            candidate_features: [],
            selected_feature_ids: [],
            generated_modules: s.forge_state.generated_modules ?? [],
            compiler_status: "idle",
            guidebook_build_status: "idle",
            draft_guidebook: null,
          },
        };
        break;
      }

      // ─── Guidebook system ───────────────────────────────────────────────────
      case "forge/set_draft_guidebook": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            draft_guidebook: { ...(s.forge_state.draft_guidebook ?? {}), ...action.payload },
          },
        };
        break;
      }
      case "forge/clear_draft_guidebook": {
        next = {
          ...s,
          forge_state: { ...s.forge_state, draft_guidebook: null, guidebook_build_status: "idle" },
        };
        break;
      }
      case "forge/set_build_status": {
        next = {
          ...s,
          forge_state: { ...s.forge_state, guidebook_build_status: action.payload as ForgeState["guidebook_build_status"] },
        };
        break;
      }
      case "forge/create_guidebook": {
        const existing = s.forge_state.guidebooks ?? [];
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            guidebooks: [...existing, action.payload],
            draft_guidebook: null,
            guidebook_build_status: "done",
          },
        };
        break;
      }
      case "forge/update_guidebook": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            guidebooks: (s.forge_state.guidebooks ?? []).map((g) =>
              g.id === action.payload.id
                ? { ...g, ...action.payload.changes, updated_at: now() }
                : g,
            ),
          },
        };
        break;
      }
      case "forge/activate_guidebook": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            guidebooks: (s.forge_state.guidebooks ?? []).map((g) =>
              g.id === action.payload.id ? { ...g, status: "active", updated_at: now() } : g,
            ),
          },
        };
        break;
      }
      case "forge/pause_guidebook": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            guidebooks: (s.forge_state.guidebooks ?? []).map((g) =>
              g.id === action.payload.id ? { ...g, status: "paused", updated_at: now() } : g,
            ),
          },
        };
        break;
      }
      case "forge/archive_guidebook": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            guidebooks: (s.forge_state.guidebooks ?? []).map((g) =>
              g.id === action.payload.id ? { ...g, status: "archived", updated_at: now() } : g,
            ),
          },
        };
        break;
      }
      case "forge/log_feature_run": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            feature_runs: [...(s.forge_state.feature_runs ?? []), action.payload],
          },
        };
        break;
      }
      case "forge/log_signal": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            forge_signals: [...(s.forge_state.forge_signals ?? []), action.payload],
          },
        };
        break;
      }
      case "forge/touch_guidebook": {
        next = {
          ...s,
          forge_state: {
            ...s.forge_state,
            guidebooks: (s.forge_state.guidebooks ?? []).map((g) =>
              g.id === action.payload.id ? { ...g, last_used_at: now() } : g,
            ),
          },
        };
        break;
      }

      case "task/tune": {
        const { id, feedback, change, changes } = action.payload;
        next = syncActiveTasksToWeek({
          ...s,
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const tuneNote = {
              at: now(),
              feedback,
              change,
            };
            return {
              ...t,
              ...changes,
              tune_notes: [...((t as any).tune_notes ?? []), tuneNote],
            } as typeof t;
          }),
        });
        break;
      }

      case "rescue/log": {
        next = { ...s, rescue_signals: [...(s.rescue_signals ?? []), action.payload] };
        break;
      }

      case "exam/create": {
        const exams = (s as any).exam_emergencies ?? [];
        next = { ...s, exam_emergencies: [...exams, action.payload] };
        break;
      }

      case "exam/update": {
        const { id: eid, changes } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === eid ? { ...e, ...changes, updated_at: now() } : e,
          ),
        };
        break;
      }

      case "exam/add_feedback": {
        const { emergencyId, feedback } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) => {
            if (e.id !== emergencyId) return e;
            const withFeedback = { ...e, feedback: [...(e.feedback ?? []), feedback], updated_at: now() };
            return { ...withFeedback, current_plan: adaptPlanAfterFeedback(withFeedback, feedback.block_id, feedback.result) };
          }),
        };
        break;
      }

      case "exam/set_active_block": {
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === action.payload.emergencyId
              ? { ...e, active_block_id: action.payload.blockId, updated_at: now() }
              : e,
          ),
        };
        break;
      }

      case "exam/complete": {
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === action.payload.id
              ? { ...e, status: "completed", updated_at: now() }
              : e,
          ),
        };
        break;
      }

      case "exam/delete": {
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).filter(
            (e: any) => e.id !== action.payload.id,
          ),
        };
        break;
      }

      case "exam/set_task_profile": {
        const { emergencyId, profile } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === emergencyId
              ? { ...e, task_profile: { ...profile, updated_at: now() }, updated_at: now() }
              : e,
          ),
        };
        break;
      }

      case "exam/add_resource": {
        const { emergencyId, resource } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === emergencyId
              ? { ...e, resources: [...(e.resources ?? []), resource], updated_at: now() }
              : e,
          ),
        };
        break;
      }

      case "exam/update_resource": {
        const { emergencyId, resourceId, changes } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === emergencyId
              ? {
                  ...e,
                  resources: (e.resources ?? []).map((r: any) =>
                    r.id === resourceId ? { ...r, ...changes } : r,
                  ),
                  updated_at: now(),
                }
              : e,
          ),
        };
        break;
      }

      case "exam/remove_resource": {
        const { emergencyId, resourceId } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === emergencyId
              ? { ...e, resources: (e.resources ?? []).filter((r: any) => r.id !== resourceId), updated_at: now() }
              : e,
          ),
        };
        break;
      }

      case "chat/append": {
        const msgs = [...(s.chat_messages ?? []), action.payload].slice(-100);
        next = { ...s, chat_messages: msgs };
        break;
      }

      case "chat/setPreferences": {
        next = {
          ...s,
          chat_preferences: { ...(s.chat_preferences ?? { tone: "default" }), ...action.payload },
        };
        break;
      }

      case "chat/clear_messages":
        next = { ...s, chat_messages: [] };
        break;
      case "chat/replace_messages":
        next = { ...s, chat_messages: action.payload.slice(-100) };
        break;

      case "schedule/set_day_plan":
        next = {
          ...s,
          schedule_state: {
            ...s.schedule_state,
            day_plan: action.payload,
            last_plan_generated_at: now(),
          },
        };
        break;

      case "chat/begin_specialisation": {
        next = {
          ...s,
          chat_state: {
            ...(s.chat_state ?? { post_onboarding_specialisation_required: false, specialisation_phase: "explain_goal" as const }),
            post_onboarding_specialisation_required: true,
            specialisation_phase: "explain_goal" as const,
          },
        };
        break;
      }

      case "chat/set_specialisation_phase": {
        next = {
          ...s,
          chat_state: {
            ...(s.chat_state ?? { post_onboarding_specialisation_required: false, specialisation_phase: "explain_goal" as const }),
            specialisation_phase: action.payload.phase,
          },
        };
        break;
      }

      case "chat/complete_specialisation": {
        const { goal_patch, first_task } = action.payload;
        const merged = { ...s.active_goal, ...goal_patch, last_updated_at: now() };
        next = syncActiveTasksToWeek({
          ...s,
          active_goal: merged,
          tasks: mergeTask(s.tasks, first_task).tasks,
          chat_state: {
            ...(s.chat_state ?? { post_onboarding_specialisation_required: false, specialisation_phase: "explain_goal" as const }),
            post_onboarding_specialisation_required: false,
            specialisation_phase: "complete" as const,
          },
          pursuit_model: merged.statement.trim()
            ? compilePursuitModel(merged, s.pursuit_model)
            : null,
        });
        break;
      }

      // ─── Exam questions / answer hiding ──────────────────────────────────

      case "exam/add_question": {
        const { emergencyId, question } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === emergencyId
              ? { ...e, questions: [...(e.questions ?? []), question], updated_at: now() }
              : e,
          ),
        };
        break;
      }

      case "exam/submit_answer": {
        const { emergencyId, questionId, attempt } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === emergencyId
              ? {
                  ...e,
                  questions: (e.questions ?? []).map((q: any) =>
                    q.id === questionId ? { ...q, attempt } : q,
                  ),
                  updated_at: now(),
                }
              : e,
          ),
        };
        break;
      }

      case "exam/reveal_answer": {
        const { emergencyId, questionId } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === emergencyId
              ? {
                  ...e,
                  questions: (e.questions ?? []).map((q: any) =>
                    q.id === questionId ? { ...q, revealed_without_attempt: true } : q,
                  ),
                  updated_at: now(),
                }
              : e,
          ),
        };
        break;
      }

      case "exam/save_question_rating": {
        const { emergencyId, questionId, rating } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === emergencyId
              ? {
                  ...e,
                  questions: (e.questions ?? []).map((q: any) =>
                    q.id === questionId && q.attempt
                      ? { ...q, attempt: { ...q.attempt, rating } }
                      : q,
                  ),
                  updated_at: now(),
                }
              : e,
          ),
        };
        break;
      }

      case "exam/set_copilot_mode": {
        const { emergencyId, mode } = action.payload;
        next = {
          ...s,
          exam_emergencies: ((s as any).exam_emergencies ?? []).map((e: any) =>
            e.id === emergencyId ? { ...e, copilot_mode: mode, updated_at: now() } : e,
          ),
        };
        break;
      }

      // ─── Trials ──────────────────────────────────────────────────────────

      case "trial/create": {
        const trials = [...((s as any).moment_trials ?? []), action.payload];
        next = { ...s, moment_trials: trials } as any;
        break;
      }

      case "trial/save_result": {
        const { id, result } = action.payload;
        if (!result.attempt_summary?.trim()) break; // guard: never allow shell result

        const existing = ((s as any).moment_trials ?? []) as any[];
        const trial = existing.find((t: any) => t.id === id);
        if (!trial) break;

        const status = result.proof_event?.proof_text ? "proof_saved" : "rated";
        const updatedTrials = existing.map((t: any) =>
          t.id === id
            ? { ...t, result, status, completed_at: t.completed_at ?? now() }
            : t,
        );

        // Auto-create MistakeCard if rating is weak
        const cards = [...((s as any).mistake_cards ?? [])] as any[];
        const shouldCreateCard =
          (result.rating.level === "needs_work" || result.rating.level === "developing") &&
          result.rating.missing_points.length > 0;

        if (shouldCreateCard) {
          const missingPoint = result.rating.missing_points[0];
          const alreadyExists = cards.some(
            (c: any) => c.source_trial_id === id && c.mistake === missingPoint,
          );
          if (!alreadyExists) {
            const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
            cards.push({
              id: `mc_${id}_${Date.now()}`,
              source_trial_id: id,
              source: trial.source ?? "exam",
              mistake_type: "weak_explanation",
              mistake: missingPoint,
              correction: result.rating.next_fix,
              review_due_at: tomorrow,
              status: "open",
              created_at: now(),
            });
          }
        }

        next = { ...s, moment_trials: updatedTrials, mistake_cards: cards } as any;
        break;
      }

      // ─── Mistake Vault ────────────────────────────────────────────────────

      case "mistake/add": {
        const cards = [...((s as any).mistake_cards ?? []), action.payload];
        next = { ...s, mistake_cards: cards } as any;
        break;
      }

      case "mistake/mark_reviewed": {
        next = {
          ...s,
          mistake_cards: ((s as any).mistake_cards ?? []).map((c: any) =>
            c.id === action.payload.id ? { ...c, status: "reviewed" } : c,
          ),
        } as any;
        break;
      }

      case "mistake/repair": {
        next = {
          ...s,
          mistake_cards: ((s as any).mistake_cards ?? []).map((c: any) =>
            c.id === action.payload.id ? { ...c, status: "repaired" } : c,
          ),
        } as any;
        break;
      }
    }

    next = touch(next);
    set({ state: next });
    persist(next);
  },
}));