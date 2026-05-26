/**
 * Coach action executor — turns a CoachAction into a real state-store mutation.
 * Returns a short toast string for the UI to show after success.
 */
import { useStateStore } from "@/stores/state-store";
import type { CoachAction } from "./coach-action-types";
import type { MomentState, Task } from "@/lib/types";

function findTask(state: MomentState | null, id?: string): Task | undefined {
  if (!state || !id) return undefined;
  return (state.tasks ?? []).find((t) => t.id === id);
}

export function executeCoachAction(action: CoachAction): { ok: boolean; message: string } {
  const store = useStateStore.getState();
  const state = store.state;
  const dispatch = store.dispatch;
  if (!state) return { ok: false, message: "No state available." };

  switch (action.type) {
    case "task.shrink": {
      const t = findTask(state, action.task_id);
      if (!t) return { ok: false, message: "Couldn't find that task." };
      const current = t.estimated_minutes ?? 30;
      const next = Math.max(7, Math.round(current * 0.4));
      dispatch({
        type: "task/update",
        payload: {
          id: t.id,
          changes: { estimated_minutes: next, difficulty: "easy" as Task["difficulty"] },
        },
      });
      return { ok: true, message: `Shrunk "${t.title}" to ${next} min` };
    }

    case "task.split": {
      const t = findTask(state, action.task_id);
      if (!t) return { ok: false, message: "Couldn't find that task." };
      const half = Math.max(10, Math.round((t.estimated_minutes ?? 30) / 2));
      const partA: Task = {
        ...t,
        id: crypto.randomUUID(),
        title: `${t.title} — part 1`,
        estimated_minutes: half,
        created_at: new Date().toISOString(),
        status: "pending",
      };
      const partB: Task = {
        ...t,
        id: crypto.randomUUID(),
        title: `${t.title} — part 2`,
        estimated_minutes: half,
        created_at: new Date().toISOString(),
        status: "pending",
      };
      dispatch({ type: "task/delete", payload: { id: t.id } });
      dispatch({ type: "task/bulk_add", payload: [partA, partB] });
      return { ok: true, message: `Split "${t.title}" into two steps` };
    }

    case "task.mark_done": {
      const t = findTask(state, action.task_id);
      if (!t) return { ok: false, message: "Couldn't find that task." };
      dispatch({
        type: "task/complete",
        payload: { id: t.id, completed_at: new Date().toISOString() },
      });
      return { ok: true, message: `Marked "${t.title}" done` };
    }

    case "task.reject": {
      const t = findTask(state, action.task_id);
      if (!t) return { ok: false, message: "Couldn't find that task." };
      dispatch({
        type: "task/update",
        payload: { id: t.id, changes: { status: "skipped" as Task["status"] } },
      });
      return { ok: true, message: `Skipped "${t.title}"` };
    }

    case "task.create_proof": {
      const label = (action.payload?.title as string) || "Next proof step";
      const minutes = (action.payload?.estimated_minutes as number) || 15;
      const task: Task = {
        id: crypto.randomUUID(),
        title: label,
        description: (action.payload?.description as string) || "",
        status: "pending",
        priority: "high",
        goal_id: state.active_goal?.id ?? "",
        domain_id: "",
        estimated_minutes: minutes,
        category: "goal_direct" as Task["category"],
        created_at: new Date().toISOString(),
        completed_at: "",
        due_date: "",
        created_by: "ai",
        why_now: (action.payload?.why_now as string) || "Coach-proposed proof step.",
        difficulty: "easy",
        resource_url: "",
        resource_label: "",
        notes: [],
      } as Task;
      dispatch({ type: "task/add", payload: task });
      return { ok: true, message: `Added "${label}"` };
    }

    case "plan.repair_today": {
      dispatch({ type: "week/reform" });
      return { ok: true, message: "Repaired today's plan" };
    }

    case "plan.make_lighter": {
      // Drop the lowest-priority pending task from today's plan
      const pending = (state.tasks ?? []).filter((t) => t.status === "pending");
      const droppable = [...pending].sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
        return (rank[b.priority] ?? 1) - (rank[a.priority] ?? 1);
      })[0];
      if (!droppable) return { ok: false, message: "Nothing safe to drop." };
      dispatch({
        type: "task/update",
        payload: { id: droppable.id, changes: { due_date: "" } },
      });
      return { ok: true, message: `Eased load — moved "${droppable.title}" off today` };
    }

    case "plan.move_one_task": {
      const t = findTask(state, action.task_id);
      if (!t) return { ok: false, message: "Couldn't find that task." };
      dispatch({
        type: "task/update",
        payload: { id: t.id, changes: { due_date: "" } },
      });
      return { ok: true, message: `Moved "${t.title}" off today` };
    }

    case "review.save_memory": {
      const t = findTask(state, action.task_id);
      const content =
        (action.payload?.content as string) ||
        (t ? `Saved learning memory for "${t.title}".` : "Saved learning memory.");
      // Append to reflections so it appears in portfolio
      dispatch({
        type: "reflection/add",
        payload: {
          id: crypto.randomUUID(),
          date: new Date().toISOString().slice(0, 10),
          energy_rating: 3,
          accomplishment: content,
          struggle: "",
          created_at: new Date().toISOString(),
        } as any,
      });
      return { ok: true, message: "Saved to your portfolio" };
    }

    case "rescue.trigger": {
      const reason = (action.payload?.reason as string) || "Coach-triggered rescue";
      dispatch({
        type: "rescue/log",
        payload: {
          id: crypto.randomUUID(),
          reason,
          created_at: new Date().toISOString(),
        } as any,
      });
      return { ok: true, message: "Rescue logged" };
    }

    case "forge.create_artifact":
    case "path.show_proof":
    case "explain.why_this_matters":
    case "exam.start_intake": {
      return { ok: true, message: "" };
    }

    case "exam.mark_block_done": {
      const blockId = action.payload?.block_id as string | undefined;
      if (!blockId) return { ok: false, message: "No block specified." };
      const emergencies = (state as any).exam_emergencies ?? [];
      const activeEmergency = emergencies.find(
        (e: any) => e.status === "active" || e.status === "intake",
      );
      if (!activeEmergency) return { ok: false, message: "No active exam emergency." };
      dispatch({
        type: "exam/add_feedback",
        payload: {
          emergencyId: activeEmergency.id,
          feedback: {
            block_id: blockId,
            result: "completed",
            created_at: new Date().toISOString(),
          },
        },
      } as any);
      return { ok: true, message: "Block marked done" };
    }

    case "exam.add_feedback": {
      const { emergencyId, blockId, result } = (action.payload ?? {}) as Record<string, string>;
      if (!emergencyId || !blockId) return { ok: false, message: "Missing exam feedback payload." };
      dispatch({
        type: "exam/add_feedback",
        payload: {
          emergencyId,
          feedback: {
            block_id: blockId,
            result: result as any,
            created_at: new Date().toISOString(),
          },
        },
      } as any);
      return { ok: true, message: "Feedback recorded" };
    }

    default:
      return { ok: false, message: "Unknown action." };
  }
}
