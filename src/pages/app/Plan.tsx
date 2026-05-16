import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Loader2, Compass, Sparkles, Sun, CalendarDays, CalendarRange, Telescope } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useStateStore } from "@/stores/state-store";
import { selectPlanViewModel } from "@/lib/selectors/plan";
import { Constellation } from "@/components/app/Constellation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MomentState, ScheduleBlock } from "@/lib/types";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";
import { WeeklyGrid } from "@/components/app/WeeklyGrid";
import { buildContextPacket } from "@/lib/ai/context-packet";

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

const Plan = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [reformOpen, setReformOpen] = useState(false);
  const [reformNote, setReformNote] = useState("");
  const [reforming, setReforming] = useState(false);
  const [horizon, setHorizon] = useState<Horizon>("days");

  const goalText = state?.active_goal?.statement ?? "";
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(() => goalText ? loadCachedPlan(goalText) : null);
  const [aiLoading, setAiLoading] = useState(false);

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
      const { data, error } = await supabase.functions.invoke("generate-plan", {
        body: {
          goal: goalText,
          why: state.active_goal?.why_it_matters ?? "",
          context: state.active_goal?.reality_gap ?? "",
          snapshot: buildContextPacket(state),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const plan = (data as any).plan as AiPlan;
      setAiPlan(plan);
      saveCachedPlan(goalText, plan);

      // Sync the AI day-list into real Tasks so Today, Tasks, and the
      // Constellation all light up from the same source of truth.
      const existingTitles = new Set(
        (state.tasks ?? []).map((t) => t.title.trim().toLowerCase()),
      );
      const nowIso = new Date().toISOString();
      let addedCount = 0;
      (plan.days ?? []).forEach((d, i) => {
        const title = (d.title || "").trim();
        if (!title || existingTitles.has(title.toLowerCase())) return;
        const due = new Date();
        due.setDate(due.getDate() + i);
        dispatch({
          type: "task/add",
          payload: {
            id: crypto.randomUUID(),
            title,
            description: d.detail || "",
            status: "pending",
            priority: i === 0 ? "high" : "medium",
            goal_id: "primary",
            domain_id: "",
            estimated_minutes: d.estimated_minutes ?? 30,
            category: "goal_direct",
            created_at: nowIso,
            completed_at: "",
            due_date: due.toISOString().slice(0, 10),
          },
        });
        addedCount++;
      });

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
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">/ plan</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your arc, mapped</h1>
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
                    {vm.scheduleBlocks.map((b) => (
                      <li key={b.id} className={`flex items-center gap-4 px-4 py-3 ${b.status === "completed" ? "opacity-50" : ""}`}>
                        <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                          {b.start_time}–{b.end_time}
                        </span>
                        <span className="flex-1 text-sm">{b.title}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] lowercase ${typeStyles[b.type] ?? "bg-secondary text-muted-foreground border-border"}`}>
                          {b.type.replace("_", " ")}
                        </span>
                        <FeedbackChips
                          source="schedule_block"
                          targetId={b.id}
                          taskTitle={b.title}
                          groups={["fit", "energy", "tone"]}
                          compact
                        />
                      </li>
                    ))}
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

              {vm.scheduleBlocks.length > 0 && (
                <Constellation blocks={vm.scheduleBlocks as ScheduleBlock[]} decisiveMoveTitle={vm.scheduleBlocks[0]?.title} />
              )}
            </>
          )}

          {horizon === "weeks" && (
            <div className="space-y-6">
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
            aiPlan?.months?.length ? (
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
            ) : <EmptyHorizon onGenerate={generatePlan} loading={aiLoading} hasGoal={!!goalText} label="monthly milestones" />
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
            {vm.unscheduledTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.title}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{t.estimated_minutes}m</span>
              </li>
            ))}
          </ul>
        </section>
      )}
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
