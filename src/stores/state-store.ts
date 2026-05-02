import { create } from "zustand";
import type { MomentState, AppMode, ExecutionFeedbackItem, ScheduleBlock } from "@/lib/types";
import type { MomentAction } from "@/lib/types/actions";
import { storage } from "@/lib/storage/local";
import { createDefaultState } from "@/lib/state/defaults";
import { resolveMode, filterPatchByMode } from "@/lib/state/modes";
import { compilePursuitModel } from "@/lib/pursuit/compiler";

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
      session = { userId, displayName: "Alex" };
      storage.setSession(session.userId, session.displayName);
    }
    const saved = await storage.getState(session.userId);
    if (saved) {
      // Backfill fields added after a previous schema version.
      const hydrated: MomentState = {
        ...saved,
        execution_feedback: saved.execution_feedback ?? [],
        schedule_state: {
          ...saved.schedule_state,
          day_plan_a_snapshot: saved.schedule_state?.day_plan_a_snapshot ?? [],
          reform_note: saved.schedule_state?.reform_note ?? "",
        },
        alignment: saved.alignment ?? {
          status: "aligned",
          drift_score: 0,
          last_updated: now(),
          reasons: [],
        },
        home: saved.home ?? { active_plan: "plan_a" },
        pursuit_model: "pursuit_model" in saved ? saved.pursuit_model : null,
      };
      set({ state: hydrated, isHydrated: true });
    } else {
      const fresh = createDefaultState(session.userId, session.displayName, tz());
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
      case "task/add":
        next = { ...s, tasks: [...s.tasks, action.payload] };
        break;
      case "task/update":
        next = {
          ...s,
          tasks: s.tasks.map((t) => (t.id === action.payload.id ? { ...t, ...action.payload.changes } : t)),
        };
        break;
      case "task/complete":
        next = {
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === action.payload.id ? { ...t, status: "done", completed_at: action.payload.completed_at } : t,
          ),
        };
        break;
      case "task/delete":
        next = { ...s, tasks: s.tasks.filter((t) => t.id !== action.payload.id) };
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
        next = { ...s, reflections: [...filtered, action.payload] };
        break;
      }
      case "alignment/set":
        next = { ...s, alignment: action.payload };
        break;
      case "home/setPlan":
        next = { ...s, home: { ...s.home, active_plan: action.payload } };
        break;

      case "goal/set":
        next = {
          ...s,
          active_goal: action.payload,
          pursuit_model: action.payload.statement.trim()
            ? compilePursuitModel(action.payload, s.pursuit_model)
            : null,
        };
        break;
      case "goal/patch": {
        const merged = { ...s.active_goal, ...action.payload, last_updated_at: now() };
        next = {
          ...s,
          active_goal: merged,
          pursuit_model: merged.statement.trim() ? compilePursuitModel(merged, s.pursuit_model) : null,
        };
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
    }

    next = touch(next);
    set({ state: next });
    persist(next);
  },
}));
