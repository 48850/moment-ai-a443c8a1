import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useStateStore } from "@/stores/state-store";
import { useSettingsStore } from "@/stores/settings-store";
import { insertProgressEvent } from "@/lib/social/api";

const STREAK_THRESHOLDS = [3, 7, 14, 30, 100];

function streakFromTasks(tasks: any[] = []): number {
  const days = new Set<string>();
  for (const t of tasks) {
    if (t.status === "done" && t.completed_at) days.add(String(t.completed_at).slice(0, 10));
  }
  let streak = 0;
  const cur = new Date();
  for (let i = 0; i < 400; i++) {
    const k = cur.toISOString().slice(0, 10);
    if (days.has(k)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else break;
  }
  return streak;
}

/**
 * Watches local state and emits progress_events rows for the signed-in user.
 * Idempotent via (kind, source_key).
 */
export function useProgressEmitter() {
  const { uid } = useAuth();
  const visibility = useSettingsStore((s) => s.privacy.progress_visibility);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const unsub = useStateStore.subscribe((s) => {
      const state = s.state;
      if (!state) return;

      // task_completed
      for (const t of state.tasks ?? []) {
        if (t.status === "done" && t.completed_at) {
          const key = `task:${t.id}`;
          if (seenRef.current.has(key)) continue;
          seenRef.current.add(key);
          insertProgressEvent({
            user_id: uid,
            kind: "task_completed",
            title: `completed “${t.title}”`,
            context: t.why_now ?? null,
            visibility: visibility as any,
            source_key: t.id,
          }).catch(() => {});
        }
      }

      // streak milestones
      const streak = streakFromTasks(state.tasks ?? []);
      const hit = STREAK_THRESHOLDS.filter((n) => n <= streak).pop();
      if (hit) {
        const key = `streak:${hit}`;
        if (!seenRef.current.has(key)) {
          seenRef.current.add(key);
          insertProgressEvent({
            user_id: uid,
            kind: "streak_milestone",
            title: `hit a ${hit}-day streak`,
            visibility: visibility as any,
            source_key: String(hit),
          }).catch(() => {});
        }
      }

      // plan repaired
      const note = (state.schedule_state as any)?.reform_note;
      const stamp = (state.schedule_state as any)?.week_plan_generated_at;
      if (note && stamp) {
        const key = `repair:${stamp}`;
        if (!seenRef.current.has(key)) {
          seenRef.current.add(key);
          insertProgressEvent({
            user_id: uid,
            kind: "plan_repaired",
            title: `repaired today's plan`,
            context: String(note).slice(0, 200),
            visibility: visibility as any,
            source_key: String(stamp),
          }).catch(() => {});
        }
      }
    });
    return () => unsub();
  }, [uid, visibility]);
}
