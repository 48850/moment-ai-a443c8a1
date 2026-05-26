import { Mote } from "@/components/app/Mote";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Loader2, Compass, Sparkles, Sun, CalendarDays, CalendarRange, Telescope, ExternalLink, NotebookPen, X, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "motion/react";
import { useStateStore } from "@/stores/state-store";
import { selectPlanViewModel } from "@/lib/selectors/plan";
import { Constellation } from "@/components/app/Constellation";
import { Starfield, DEEP_SPACE_BG } from "@/components/app/constellation/Starfield";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MomentState, ScheduleBlock } from "@/lib/types";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";
import { WeeklyGrid } from "@/components/app/WeeklyGrid";
import { buildContextPacket } from "@/lib/ai/context-packet";
import { QuickReviewNotes } from "@/components/app/QuickReviewNotes";
import { HeartbeatBanner } from "@/components/app/HeartbeatBanner";

/* ----- pursuit tiles (kept) ----- */
interface PursuitTile {
  kind: "workstream" | "capability" | "evidence" | "risk";
  name: string;
  detail: string;
}
function selectPursuitPreview(state: MomentState | null): PursuitTile[] {
  const pm = state?.pursuit_model;
  if (!pm) return [];
  const tiles: PursuitTile[] = [];
  const wp = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const ws = [...pm.workstreams].sort((a, b) => (wp[a.priority] ?? 4) - (wp[b.priority] ?? 4))[0];
  if (ws) tiles.push({ kind: "workstream", name: ws.name, detail: ws.next_proof || ws.bottleneck || ws.description || "Push the next proof." });
  const cr = { not_started: 0, emerging: 1, developing: 2, solid: 3, mastered: 4 } as const;
  const cap = [...pm.capability_clusters].sort((a, b) => (cr[a.status] ?? 0) - (cr[b.status] ?? 0))[0];
  if (cap) tiles.push({ kind: "capability", name: cap.name, detail: cap.why_it_matters || cap.description || `Status: ${cap.status}.` });
  const lead = pm.evidence_signals.find((s) => s.kind === "leading");
  if (lead) {
    tiles.push({ kind: "evidence", name: lead.name, detail: lead.last_value ? `Last: ${lead.last_value}` : lead.description || "Track this signal." });
  } else {
    const sr = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const risk = [...pm.risks].sort((a, b) => (sr[a.severity] ?? 4) - (sr[b.severity] ?? 4))[0];
    if (risk) tiles.push({ kind: "risk", name: risk.name, detail: risk.mitigation || risk.description || `${risk.severity} severity.` });
  }
  return tiles.slice(0, 3);
}
const TILE_LABEL: Record<PursuitTile["kind"], string> = { workstream: "Workstream", capability: "Capability", evidence: "Signal", risk: "Risk" };
const TILE_TONE: Record<PursuitTile["kind"], string> = {
  workstream: "border-primary/40", capability: "border-accent/40",
  evidence: "border-primary/40", risk: "border-destructive/40",
};

const typeStyles: Record<string, string> = {
  study: "bg-primary/15 text-primary border-primary/30",
  goal_work: "bg-primary/15 text-primary border-primary/30",
  exercise: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  commute: "bg-secondary text-muted-foreground border-border",
  buffer: "bg-secondary text-muted-foreground border-border",
  fixed_commitment: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  meal: "bg-secondary text-muted-foreground border-border",
  recovery: "bg-secondary text-muted-foreground border-border",
  wind_down: "bg-secondary text-muted-foreground border-border",
};

/* ----- AI plan types ----- */
type Horizon = "days" | "weeks" | "months" | "years";

interface DayItem { title: string; detail: string; when: string; estimated_minutes: number }
interface WeekItem { title: string; detail: string; week_range: string; outcome: string }
interface MonthItem { title: string; detail: string; month: string; milestone: string }
interface YearItem { title: string; detail: string; year: string; identity: string }

interface AiPlan {
  days: DayItem[];
  weeks: WeekItem[];
  months: MonthItem[];
  years: YearItem[];
  guiding_principle: string;
}

const HORIZONS: { id: Horizon; label: string; sub: string; icon: typeof Sun }[] = [
  { id: "days", label: "Days", sub: "this week", icon: Sun },
  { id: "weeks", label: "Weeks", sub: "next 4-8", icon: CalendarDays },
  { id: "months", label: "Months", sub: "milestones", icon: CalendarRange },
  { id: "years", label: "Years", sub: "who you become", icon: Telescope },
];

const STORAGE_KEY = "moment.aiPlan.v1";

function loadCachedPlan(goal: string): AiPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.goal === goal && parsed.plan) return parsed.plan as AiPlan;
  } catch { /* ignore */ }
  return null;
}
function saveCachedPlan(goal: string, plan: AiPlan) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ goal, plan, at: Date.now() }));
  } catch { /* ignore */ }
}

/* ─── Week constellation — mirrors the live week_plan ────────────────────── */
function WeekConstellation({ state }: { state: MomentState }) {
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
  const todayIdx = (() => {
    const js = new Date().getDay();
    return [1, 2, 3, 4, 5, 6, 0].indexOf(js);
  })();

  const days = useMemo(() => {
    const week = (state.schedule_state?.week_plan ?? []) as Array<{
      day_index: number;
      category: string;
      is_locked?: boolean;
    }>;
    const tasks = state.tasks ?? [];
    return DAY_LABELS.map((label, i) => {
      const blocks = week.filter((b) => b.day_index === i);
      const d = new Date();
      d.setDate(d.getDate() + (i - todayIdx));
      const dateStr = d.toISOString().slice(0, 10);
      const completed = tasks.filter(
        (t) => t.status === "done" && t.completed_at?.startsWith(dateStr),
      ).length;
      return { label, blocks: blocks.length, completed, isToday: i === todayIdx };
    });
  }, [state.schedule_state?.week_plan, state.tasks]);

  const totalBlocks = days.reduce((s, d) => s + d.blocks, 0);
  const totalDone = days.reduce((s, d) => s + d.completed, 0);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-4" style={{ background: DEEP_SPACE_BG }}>
      <Starfield density={5200} nebulaHue="teal" showShootingStars={false} />
      <div className="relative z-10 mb-4 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">week pathway</div>
          <div className="mt-1 text-sm font-semibold text-white">Seven-day route</div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
          {totalBlocks} block{totalBlocks === 1 ? "" : "s"} · {totalDone} done
        </div>
      </div>
      {totalBlocks === 0 ? (
        <p className="relative z-10 text-xs text-white/50">
          No week plan yet. Use the grid below to seed one.
        </p>
      ) : (
        <div className="relative z-10 grid gap-2 sm:grid-cols-7">
          {days.map((d) => (
            <div
              key={d.label}
              className={`relative rounded-xl border p-3 transition ${
                d.isToday ? "border-amber-200/40 bg-amber-200/10" : d.blocks > 0 ? "border-blue-200/20 bg-blue-200/10" : "border-white/10 bg-white/[0.035]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">{d.label}</div>
                <span className={`h-2.5 w-2.5 rounded-full ${d.completed > 0 ? "bg-emerald-200" : d.blocks > 0 ? "bg-blue-200/70" : "bg-white/25"}`} />
              </div>
              <div className="mt-3 text-lg font-semibold text-white">{d.blocks}</div>
              <div className="mt-1 text-[11px] text-white/45">planned block{d.blocks === 1 ? "" : "s"}</div>
              {d.completed > 0 && <div className="mt-2 text-[11px] font-medium text-emerald-200">{d.completed} proof{d.completed === 1 ? "" : "s"} done</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Month constellation — calendar grid for the current month ───────────── */
function MonthConstellation({ state, milestone }: { state: MomentState; milestone?: { month: string; title: string; detail?: string; milestone?: string } }) {
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const monthLabel = now.toLocaleString(undefined, { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // Mon=0
  const todayDate = now.getDate();

  const localKey = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const { completionsByDay, maxCount, totalDone, scheduledDays } = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of state.tasks ?? []) {
      if (t.status !== "done" || !t.completed_at) continue;
      const d = new Date(t.completed_at);
      if (d.getFullYear() !== year || d.getMonth() !== monthIdx) continue;
      const key = localKey(year, monthIdx, d.getDate());
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    // scheduled days (any block category) inferred from week_plan day_index mapping to upcoming days
    const week = (state.schedule_state?.week_plan ?? []) as Array<{ day_index: number }>;
    const scheduledDow = new Set(week.map((b) => b.day_index)); // Mon=0..Sun=6
    let max = 0;
    for (const v of map.values()) if (v > max) max = v;
    let total = 0;
    for (const v of map.values()) total += v;
    return { completionsByDay: map, maxCount: max, totalDone: total, scheduledDays: scheduledDow };
  }, [state.tasks, state.schedule_state?.week_plan, year, monthIdx]);

  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, key: `d-${d}` });

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 p-5 space-y-4 shadow-[0_0_40px_-15px_rgba(99,102,241,0.4)]"
      style={{ background: DEEP_SPACE_BG }}
    >
      <Starfield density={5600} nebulaHue="indigo" showShootingStars={false} />

      <div className="relative z-10 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-white/55">Month constellation</div>
          <div className="mt-1 text-lg font-semibold text-white">{monthLabel}</div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
          {totalDone} proof{totalDone === 1 ? "" : "s"} lit
        </div>
      </div>

      {milestone && (
        <div className="relative z-10 rounded-lg border border-amber-300/25 bg-amber-300/5 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-amber-200/80">This month's pathway</div>
          <div className="mt-1 text-sm font-medium text-white">{milestone.title}</div>
          {milestone.milestone && <div className="mt-0.5 text-xs text-white/60">→ {milestone.milestone}</div>}
        </div>
      )}

      <div className="relative z-10 grid grid-cols-7 gap-1 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="relative z-10 grid grid-cols-7 gap-1.5">
        {cells.map((c) => {
          if (c.day == null) return <div key={c.key} className="aspect-square" />;
          const key = localKey(year, monthIdx, c.day);
          const count = completionsByDay.get(key) ?? 0;
          const isToday = c.day === todayDate;
          const isFuture = c.day > todayDate;
          const dow = (new Date(year, monthIdx, c.day).getDay() + 6) % 7;
          const isScheduled = scheduledDays.has(dow);
          const intensity = maxCount > 0 ? count / maxCount : 0;

          return (
            <div
              key={c.key}
              title={`${monthLabel.split(" ")[0]} ${c.day} · ${count} completed${isScheduled ? " · scheduled" : ""}`}
              className={`group relative aspect-square rounded-lg border p-1 transition-all ${
                isToday ? "border-amber-200/55 bg-amber-200/10 ring-1 ring-amber-200/45 ring-offset-1 ring-offset-[#0a0e24]" :
                count > 0 ? "border-emerald-200/30 bg-emerald-200/10" :
                isFuture && isScheduled ? "border-blue-200/20 bg-blue-200/10" : "border-white/8 bg-white/[0.025]"
              } hover:border-white/30`}
            >
              <div className="flex h-full flex-col justify-between">
                <span className={`font-mono text-[9px] ${isToday ? "text-amber-100" : count > 0 ? "text-white/80" : "text-white/30"}`}>{c.day}</span>
                <span className={`h-1.5 rounded-full ${count > 0 ? "bg-emerald-200" : isFuture && isScheduled ? "bg-blue-200/55" : "bg-white/15"}`} style={{ width: count > 0 ? `${35 + intensity * 65}%` : isFuture && isScheduled ? "45%" : "20%" }} />
                <span className="font-mono text-[8px] text-white/35">{count > 0 ? `${count} done` : isFuture && isScheduled ? "set" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative z-10 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-white/45">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-200" style={{ boxShadow: "0 0 6px rgba(255,210,138,0.6)" }} />
            lit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-300/50" style={{ boxShadow: "0 0 4px rgba(180,210,255,0.4)" }} />
            scheduled
          </span>
        </div>
        <div>resets on the 1st</div>
      </div>

    </div>
  );
}


const Plan = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [reformOpen, setReformOpen] = useState(false);
  const [reformNote, setReformNote] = useState("");
  const [reforming, setReforming] = useState(false);
  const [horizon, setHorizon] = useState<Horizon>("days");
  const [notesTaskId, setNotesTaskId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const tasksList = state?.tasks ?? [];
  const getTaskById = (id?: string) => (id ? tasksList.find((t) => t.id === id) ?? null : null);
  const getTaskForBlock = (block: { linked_task_ids?: string[] }) =>
    getTaskById(block.linked_task_ids?.[0]);
  const notesTask = useMemo(
    () => (notesTaskId ? tasksList.find((t) => t.id === notesTaskId) ?? null : null),
    [notesTaskId, tasksList],
  );

  const addNoteToTask = (taskId: string, content: string) => {
    const text = content.trim();
    if (!text) return;
    const target = tasksList.find((t) => t.id === taskId);
    if (!target) return;
    dispatch({
      type: "task/update",
      payload: {
        id: taskId,
        changes: {
          notes: [
            ...(target.notes ?? []),
            { id: crypto.randomUUID(), content: text, created_at: new Date().toISOString() },
          ],
        },
      },
    });
    setNoteDraft("");
  };

  const removeNoteFromTask = (taskId: string, noteId: string) => {
    const target = tasksList.find((t) => t.id === taskId);
    if (!target) return;
    dispatch({
      type: "task/update",
      payload: {
        id: taskId,
        changes: { notes: (target.notes ?? []).filter((n) => n.id !== noteId) },
      },
    });
  };
  const goalText = state?.active_goal?.statement ?? "";
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(() => goalText ? loadCachedPlan(goalText) : null);
  const [aiLoading, setAiLoading] = useState(false);

  const todayCompletedBlocks = useMemo((): ScheduleBlock[] => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (state?.tasks ?? [])
      .filter((t) => t.status === "done" && t.completed_at?.startsWith(todayStr))
      .map((t) => ({
        id: `completed-${t.id}`,
        title: t.title,
        type: "goal_work" as const,
        start_time: "",
        end_time: "",
        duration_minutes: t.estimated_minutes ?? 30,
        priority: 1,
        is_fixed: false,
        source: "task",
        goal_link: t.goal_id ?? "",
        fallback_version: "",
        status: "completed" as const,
        linked_task_ids: [t.id],
      }));
  }, [state?.tasks]);

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;
  const vm = selectPlanViewModel(state);

  const setActivePlan = (plan: "plan_a" | "plan_b") => dispatch({ type: "home/setPlan", payload: plan });

  const onReform = async () => {
    if (!reformNote.trim()) return;
    setReforming(true);
    try {
      // Build feedback breakdown from all execution_feedback
      const feedbackBreakdown: Record<string, number> = {};
      for (const f of state.execution_feedback ?? []) {
        feedbackBreakdown[f.feedback] = (feedbackBreakdown[f.feedback] ?? 0) + 1;
      }
      const completedTasks = (state.tasks ?? [])
        .filter((t) => t.status === "done")
        .slice(-5)
        .map((t) => ({ title: t.title }));

      // Ask AI for reform rationale and focus suggestion
      let reformExplanation = reformNote.trim();
      let focusSuggestion = "";
      try {
        const { data } = await supabase.functions.invoke("app-intelligence", {
          body: {
            intent: "plan_reform",
            snapshot: buildContextPacket(state),
            payload: {
              reform_note: reformNote.trim(),
              completed_tasks: completedTasks,
              feedback_breakdown: feedbackBreakdown,
            },
          },
        });
        if (data?.result?.explanation) {
          reformExplanation = data.result.explanation;
          focusSuggestion = data.result.focus_suggestion ?? "";
        }
      } catch { /* fall back to note text */ }

      // All task IDs that received ANY negative feedback signal
      const NEGATIVE_SIGNALS = new Set([
        "too_vague", "too_big", "not_relevant", "overwhelmed",
        "tired", "dont_understand", "wrong_time",
      ]);
      const badTaskIds = new Set(
        (state.execution_feedback ?? [])
          .filter((f) => NEGATIVE_SIGNALS.has(f.feedback))
          .map((f) => f.task_id)
          .filter(Boolean),
      );

      // Pending task ids that have NO negative feedback — candidates for the focus block
      const pendingTaskIds = (state.tasks ?? [])
        .filter((t) => t.status !== "done" && t.status !== "skipped" && !badTaskIds.has(t.id))
        .map((t) => t.id);

      const basePlan = state.schedule_state.day_plan;

      // Rebuild: keep fixed blocks as-is; shrink blocks linked to bad tasks; keep the rest
      const rebuilt: ScheduleBlock[] = basePlan.map((b) => {
        if (b.is_fixed) return b; // locked commitment — never change
        const linkedBad = (b.linked_task_ids ?? []).some((id) => badTaskIds.has(id));
        if (linkedBad) {
          // Shrink by 50%, flag as adjusted
          const halved = Math.max(15, Math.round((b.duration_minutes ?? 30) / 2));
          const [h, m] = b.start_time.split(":").map(Number);
          const endTotal = h * 60 + m + halved;
          const newEnd = `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
          return {
            ...b,
            title: b.title.startsWith("↓ ") ? b.title : `↓ ${b.title}`,
            duration_minutes: halved,
            end_time: newEnd,
            status: "upcoming" as const,
          };
        }
        return b;
      });

      // Insert a focus block for the AI-suggested priority (only if there's a pending task to fill it)
      if (focusSuggestion || pendingTaskIds.length > 0) {
        const focusTitle = focusSuggestion
          ? `Focus: ${focusSuggestion.slice(0, 50)}`
          : `Priority block`;
        rebuilt.unshift({
          id: `reform-${Date.now()}`,
          title: focusTitle,
          type: "goal_work",
          start_time: "16:00",
          end_time: "16:45",
          duration_minutes: 45,
          priority: 1,
          is_fixed: false,
          source: "reform",
          goal_link: state.active_goal?.statement ?? "",
          fallback_version: "",
          status: "upcoming",
          linked_task_ids: pendingTaskIds.slice(0, 1),
        });
      }

      // Sort chronologically
      rebuilt.sort((a, b) => a.start_time.localeCompare(b.start_time));

      dispatch({ type: "plan/reform", payload: { reformed_plan: rebuilt, reform_note: reformExplanation } });
      toast.success("Plan B ready", { description: reformExplanation });
      setReformOpen(false);
      setReformNote("");
    } finally {
      setReforming(false);
    }
  };

  const generatePlan = async () => {
    if (!goalText) {
      toast.error("Set a goal first to generate a plan.");
      return;
    }
    setAiLoading(true);
    try {
      const { buildContextPacket } = await import("@/lib/ai/context-packet");
      const snapshot = buildContextPacket(state);
      const surface = typeof window !== "undefined" && window.matchMedia?.("(max-width: 768px)").matches
        ? "mobile"
        : "desktop";
      const { data, error } = await supabase.functions.invoke("generate-plan", {
        body: {
          goal: goalText,
          why: state.active_goal?.why_it_matters ?? "",
          context: state.active_goal?.reality_gap ?? "",
          goal_horizons: (snapshot as any).active_goal,
          snapshot,
          surface,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const plan = (data as any).plan as AiPlan;
      setAiPlan(plan);
      saveCachedPlan(goalText, plan);

      // Sync the AI day-list into real Tasks and real ScheduleBlocks so Today,
      // Tasks, the Constellation, and the schedule all light up from the same source of truth.
      const existingTitles = new Set(
        (state.tasks ?? []).map((t) => t.title.trim().toLowerCase()),
      );
      const nowIso = new Date().toISOString();
      const firstWorkstreamId = state.pursuit_model?.workstreams?.[0]?.id;

      // Compute day-start cursor: school_end + 30 min buffer, or 16:00
      const schoolEnd = state.constraints?.school_end_time || "15:30";
      const [seh, sem] = schoolEnd.split(":").map(Number);
      let cursorMin = seh * 60 + sem + 30;

      const dayBlocks: ScheduleBlock[] = [];
      let addedCount = 0;

      (plan.days ?? []).slice(0, 3).forEach((d, i) => {
        const title = (d.title || "").trim();
        if (!title) return;

        const taskId = crypto.randomUUID();
        const blockId = `aiplan-${Date.now()}-${i}`;
        const dur = Math.max(15, Math.min(90, d.estimated_minutes ?? 30));
        const startHH = String(Math.floor(cursorMin / 60)).padStart(2, "0");
        const startMM = String(cursorMin % 60).padStart(2, "0");
        const endMin = cursorMin + dur;
        const endHH = String(Math.floor(endMin / 60)).padStart(2, "0");
        const endMM = String(endMin % 60).padStart(2, "0");

        dayBlocks.push({
          id: blockId,
          title,
          type: "goal_work",
          start_time: `${startHH}:${startMM}`,
          end_time: `${endHH}:${endMM}`,
          duration_minutes: dur,
          priority: i === 0 ? 1 : 2,
          is_fixed: false,
          source: "ai_plan",
          goal_link: goalText,
          fallback_version: "",
          status: "upcoming",
          linked_task_ids: [taskId],
        });
        cursorMin = endMin + 15;

        if (!existingTitles.has(title.toLowerCase())) {
          const due = new Date();
          due.setDate(due.getDate() + i);
          dispatch({
            type: "task/add",
            payload: {
              id: taskId,
              title,
              description: d.detail || "",
              status: "pending",
              priority: i === 0 ? "high" : "medium",
              goal_id: "primary",
              domain_id: "",
              estimated_minutes: dur,
              category: "goal_direct",
              created_at: nowIso,
              completed_at: "",
              due_date: due.toISOString().slice(0, 10),
              created_by: "ai",
              why_now: d.detail ?? "",
              pathway_node: d.when ?? "",
              resource_url: (d as any).resource_url ?? "",
              resource_label: (d as any).resource_label ?? "",
              ...(firstWorkstreamId ? { workstream_id: firstWorkstreamId } : {}),
            },
          });
          addedCount++;
        }
      });

      dispatch({ type: "schedule/set_day_plan", payload: dayBlocks });

      toast.success(
        addedCount
          ? `Plan generated · ${addedCount} task${addedCount === 1 ? "" : "s"} added to Today`
          : "Plan generated across all horizons",
      );
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate plan");
    } finally {
      setAiLoading(false);
    }
  };

  const tiles = selectPursuitPreview(state);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">/ plan</div>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight"><Mote size={56} bounce mood="celebrate" />Your arc, mapped</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            From today to the person you're becoming. Powered by AI from your goal.
          </p>
        </div>
        <button
          onClick={generatePlan}
          disabled={aiLoading || !goalText}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {aiPlan ? "Regenerate" : "Generate plan"}
        </button>
      </div>

      {!goalText && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Set a goal in <Link to="/app/mission" className="text-primary underline">Mission</Link> to unlock your AI-powered plan.
        </div>
      )}

      <PatternBanner />

      {/* Heartbeat — shared context pulse */}
      <HeartbeatBanner />

      {/* Guiding principle */}
      {aiPlan?.guiding_principle && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-4"
        >
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3 w-3" /> guiding principle
          </div>
          <p className="mt-2 text-sm leading-snug text-foreground">{aiPlan.guiding_principle}</p>
        </motion.div>
      )}

      {/* Horizon tabs */}
      <div className="grid grid-cols-4 gap-2">
        {HORIZONS.map((h) => {
          const Icon = h.icon;
          const active = horizon === h.id;
          return (
            <button
              key={h.id}
              onClick={() => setHorizon(h.id)}
              className={`group relative flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all ${
                active
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${active ? "text-foreground" : "text-foreground/80"}`}>
                {h.label}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                {h.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Horizon content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={horizon}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {horizon === "days" && (
            <>
              {/* Plan A/B switch */}
              {vm.hasPlanB && (
                <div className="inline-flex rounded-lg border border-border bg-card p-1">
                  <button
                    onClick={() => setActivePlan("plan_a")}
                    className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                      vm.activePlan === "plan_a" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => setActivePlan("plan_b")}
                    className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                      vm.activePlan === "plan_b" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Adjusted
                  </button>
                </div>
              )}

              {/* Why the plan changed */}
              {vm.activePlan === "plan_b" && vm.reformNote && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/80">
                    Plan adjusted ·
                  </span>{" "}
                  <span className="text-foreground">{vm.reformNote}</span>
                </div>
              )}

              {/* Today schedule */}
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border bg-secondary/30 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Today's schedule
                </div>
                {vm.scheduleBlocks.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing planned yet.</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {vm.scheduleBlocks.map((b) => {
                      const linkedTask = getTaskForBlock(b as any);
                      const noteCount = linkedTask?.notes?.length ?? 0;
                      return (
                      <li key={b.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${b.status === "completed" ? "opacity-50" : ""}`}>
                        <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                          {b.start_time}–{b.end_time}
                        </span>
                        <span className="flex-1 min-w-[8rem] text-sm">{b.title}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] lowercase ${typeStyles[b.type] ?? "bg-secondary text-muted-foreground border-border"}`}>
                          {b.type.replace("_", " ")}
                        </span>
                        {linkedTask?.resource_url && (
                          <a
                            href={linkedTask.resource_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {linkedTask.resource_label || "Open link"}
                          </a>
                        )}
                        {linkedTask && (
                          <button
                            onClick={() => setNotesTaskId(linkedTask.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <NotebookPen className="h-2.5 w-2.5" />
                            Notes{noteCount > 0 ? ` (${noteCount})` : ""}
                          </button>
                        )}
                        <FeedbackChips
                          source="schedule_block"
                          targetId={b.id}
                          taskTitle={b.title}
                          groups={["fit", "energy", "tone"]}
                          compact
                        />
                      </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* AI day-list */}
              {aiPlan?.days?.length ? (
                <HorizonList
                  title="This week's moves"
                  items={aiPlan.days.map((d, i) => ({
                    key: `day-${i}`,
                    badge: d.when,
                    title: d.title,
                    detail: d.detail,
                    meta: `${d.estimated_minutes} min`,
                  }))}
                />
              ) : null}

              {(vm.scheduleBlocks.length > 0 || todayCompletedBlocks.length > 0) && (
                <Constellation
                  blocks={[...vm.scheduleBlocks as ScheduleBlock[], ...todayCompletedBlocks]}
                  decisiveMoveTitle={vm.scheduleBlocks[0]?.title}
                />
              )}
            </>
          )}

          {horizon === "weeks" && (
            <div className="space-y-6">
              <WeekConstellation state={state} />
              <WeeklyGrid />
              {aiPlan?.weeks?.length ? (
                <HorizonList
                  title="AI weekly outcomes"
                  items={aiPlan.weeks.map((w, i) => ({
                    key: `wk-${i}`,
                    badge: w.week_range,
                    title: w.title,
                    detail: w.detail,
                    meta: `→ ${w.outcome}`,
                  }))}
                />
              ) : null}
            </div>
          )}

          {horizon === "months" && (
            <div className="space-y-6">
              <MonthConstellation state={state} milestone={aiPlan?.months?.[0]} />
              {aiPlan?.months?.length ? (
                <HorizonList
                  title="Monthly milestones"
                  items={aiPlan.months.map((m, i) => ({
                    key: `mo-${i}`,
                    badge: m.month,
                    title: m.title,
                    detail: m.detail,
                    meta: `🏁 ${m.milestone}`,
                  }))}
                />
              ) : <EmptyHorizon onGenerate={generatePlan} loading={aiLoading} hasGoal={!!goalText} label="monthly milestones" />}
            </div>
          )}

          {horizon === "years" && (
            aiPlan?.years?.length ? (
              <HorizonList
                title="Who you become"
                items={aiPlan.years.map((y, i) => ({
                  key: `yr-${i}`,
                  badge: y.year,
                  title: y.title,
                  detail: y.detail,
                  meta: `★ ${y.identity}`,
                }))}
              />
            ) : <EmptyHorizon onGenerate={generatePlan} loading={aiLoading} hasGoal={!!goalText} label="long-horizon arc" />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Pursuit tiles */}
      {tiles.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Compass className="h-3.5 w-3.5 text-primary" /> Pursuit anchors
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {tiles.map((t, i) => (
              <Link
                key={i}
                to="/app/mission"
                className={`rounded-lg border bg-background/40 p-2.5 transition-colors hover:bg-secondary/60 ${TILE_TONE[t.kind]}`}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{TILE_LABEL[t.kind]}</p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">{t.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.detail}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Reform */}
      {horizon === "days" && (
        <section className="rounded-2xl border border-border bg-card/50 p-4">
          {!reformOpen ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4" /> Day not feeling right?
              </div>
              <button onClick={() => setReformOpen(true)} className="rounded-md px-3 py-1.5 text-xs text-foreground hover:bg-secondary">
                Adjust it
              </button>
            </div>
          ) : (
            <div>
              <div className="text-sm">What's not working?</div>
              <div className="mt-1 text-xs text-muted-foreground">We'll keep your original plan so you can switch back anytime.</div>
              <input
                value={reformNote}
                onChange={(e) => setReformNote(e.target.value)}
                placeholder="e.g. I'm low energy — cut study to 30 min"
                className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setReformOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
                <button
                  onClick={onReform}
                  disabled={reforming || !reformNote.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {reforming && <Loader2 className="h-3 w-3 animate-spin" />}
                  {reforming ? "Adjusting…" : "Adjust my day"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {horizon === "days" && vm.unscheduledTasks.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Unscheduled</div>
          <ul className="space-y-2">
            {vm.unscheduledTasks.map((tVm) => {
              const t = getTaskById(tVm.id) ?? (tVm as any);
              const noteCount = t?.notes?.length ?? 0;
              return (
              <li key={tVm.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex-1 min-w-[8rem]">{tVm.title}</span>
                <div className="flex items-center gap-2">
                  {t?.resource_url && (
                    <a
                      href={t.resource_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      {t.resource_label || "Open link"}
                    </a>
                  )}
                  <button
                    onClick={() => setNotesTaskId(tVm.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <NotebookPen className="h-2.5 w-2.5" />
                    Notes{noteCount > 0 ? ` (${noteCount})` : ""}
                  </button>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{tVm.estimated_minutes}m</span>
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      )}

      <Sheet
        open={!!notesTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setNotesTaskId(null);
            setNoteDraft("");
          }
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-base">Notes</SheetTitle>
            <SheetDescription className="line-clamp-2 text-xs">
              {notesTask?.title ?? "Task notes"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {notesTask && (notesTask.notes?.length ?? 0) > 0 && (
              <QuickReviewNotes
                taskTitle={notesTask.title}
                taskContext={(notesTask as { description?: string }).description ?? ""}
                notes={notesTask.notes ?? []}
              />
            )}
            {(notesTask?.notes ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">
                No notes yet. Capture what you learned, what got in the way, or what to try next.
              </p>
            ) : (
              [...(notesTask?.notes ?? [])]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((n) => (
                  <div
                    key={n.id}
                    className="group relative rounded-md border border-border bg-card p-3 text-sm"
                  >
                    <p className="whitespace-pre-wrap pr-6 leading-relaxed">{n.content}</p>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                    <button
                      onClick={() => notesTask && removeNoteFromTask(notesTask.id, n.id)}
                      className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-secondary hover:text-destructive"
                      aria-label="Delete note"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (notesTask) addNoteToTask(notesTask.id, noteDraft);
            }}
            className="space-y-2 border-t border-border pt-3"
          >
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Write a note for this task…"
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!noteDraft.trim()}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-3 w-3" /> Add note
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ----- helpers ----- */

interface HorizonItem { key: string; badge: string; title: string; detail: string; meta?: string; source?: "plan" | "mission" | "pathway" }

const HorizonList = ({ title, items, source = "plan" }: { title: string; items: HorizonItem[]; source?: "plan" | "mission" | "pathway" }) => (
  <section className="overflow-hidden rounded-2xl border border-border bg-card">
    <div className="border-b border-border bg-secondary/30 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
      {title}
    </div>
    <ul className="divide-y divide-border">
      {items.map((it, i) => (
        <motion.li
          key={it.key}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                  {it.badge}
                </span>
                <h3 className="text-sm font-semibold leading-snug">{it.title}</h3>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{it.detail}</p>
              {it.meta && (
                <p className="mt-1.5 text-xs font-medium text-foreground/80">{it.meta}</p>
              )}
            </div>
            <FeedbackChips
              source={source === "mission" ? "mission" : source === "pathway" ? "pathway" : "plan"}
              targetId={it.key}
              taskTitle={it.title}
              groups={["fit", "value", "tone"]}
              compact
            />
          </div>
        </motion.li>
      ))}
    </ul>
  </section>
);

const EmptyHorizon = ({
  onGenerate, loading, hasGoal, label,
}: { onGenerate: () => void; loading: boolean; hasGoal: boolean; label: string }) => (
  <div className="rounded-2xl border border-dashed border-border p-8 text-center">
    <Sparkles className="mx-auto h-5 w-5 text-primary" />
    <p className="mt-3 text-sm text-muted-foreground">
      No {label} yet. {hasGoal ? "Generate to map this horizon." : "Set a goal to unlock this."}
    </p>
    {hasGoal && (
      <button
        onClick={onGenerate}
        disabled={loading}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Generate plan
      </button>
    )}
  </div>
);

export default Plan;
