import { useEffect, useRef, useState } from "react";
import {
  Play, Pause, RotateCcw, Check, Plus, Flame, Timer, Target, Shield,
  AlertTriangle, Brain, Zap, Loader2, Send,
} from "lucide-react";
import type { GeneratedModuleManifest, ModuleEntry, MomentState, Task } from "@/lib/types";
import type { MomentAction } from "@/lib/types/actions";
import { computeStallPattern, type StallPattern } from "@/lib/selectors/audit";
import { useAI } from "@/lib/ai/useAI";

/* ===========================================================
   Shared engine contract
   =========================================================== */

export interface EngineProps {
  module: GeneratedModuleManifest;
  logEntry: (data: Record<string, unknown>, note?: string) => void;
  state?: MomentState;
  dispatch?: (action: MomentAction) => void;
}

export function ModuleEngine({ module: m, logEntry, state, dispatch }: EngineProps) {
  switch (m.module_type) {
    case "practice_system":
      return <PracticeSystemEngine module={m} logEntry={logEntry} state={state} dispatch={dispatch} />;
    case "rescue_protocol":
      return <RescueProtocolEngine module={m} logEntry={logEntry} state={state} dispatch={dispatch} />;
    case "tracker":
    case "evidence_log":
      return <TrackerEngine module={m} logEntry={logEntry} />;
    case "planner":
      return <PlannerEngine module={m} logEntry={logEntry} />;
    case "review_engine":
    case "simulator":
    case "coach_loop":
    default:
      return <GenericRunEngine module={m} logEntry={logEntry} />;
  }
}

/* ===========================================================
   Shared write approval panel
   =========================================================== */

interface PendingWrite {
  action: string;
  label: string;
  execute: () => void;
}

function EngineWritePanel({
  pending,
  onApprove,
  onDismiss,
}: {
  pending: PendingWrite[];
  onApprove: (pw: PendingWrite) => void;
  onDismiss: (pw: PendingWrite) => void;
}) {
  if (pending.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
        <AlertTriangle className="h-3 w-3" /> Actions ready — approve to apply
      </div>
      {pending.map((pw, i) => (
        <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-background px-3 py-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-amber-500">{pw.action}</div>
            <div className="truncate text-xs text-foreground">{pw.label}</div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => onDismiss(pw)} className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
              Skip
            </button>
            <button onClick={() => onApprove(pw)} className="rounded bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-500/25">
              Apply
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===========================================================
   PRACTICE SYSTEM — Focus Lab (4-layer cognitive training room)
   =========================================================== */

type FocusPhase = "idle" | "planning" | "running" | "post_run";

interface SprintStep {
  step: string;
  minutes: number;
  type: string;
}

interface SprintPlan {
  sprint_plan: SprintStep[];
  target_proof: string;
  success_criteria: string;
  post_run_task: string;
}

interface PostRunDiagnosis {
  what_improved: string;
  what_broke: string;
  pattern_diagnosis: string;
  next_move: string;
}

function PracticeSystemEngine({ module: m, logEntry, state, dispatch }: EngineProps) {
  const [phase, setPhase] = useState<FocusPhase>("idle");
  const [subject, setSubject] = useState("");
  const [sprintType, setSprintType] = useState("focused_work");
  const [timeAvailable, setTimeAvailable] = useState("25");
  const [proofTarget, setProofTarget] = useState("");
  const [sprintPlan, setSprintPlan] = useState<SprintPlan | null>(null);
  const [stepsDone, setStepsDone] = useState<number[]>([]);
  const [whatBroke, setWhatBroke] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [midRunResult, setMidRunResult] = useState<Record<string, unknown> | null>(null);
  const [postRunDiagnosis, setPostRunDiagnosis] = useState<PostRunDiagnosis | null>(null);
  const [pendingWrites, setPendingWrites] = useState<PendingWrite[]>([]);
  const intervalRef = useRef<number | null>(null);

  const preflightAI = useAI<SprintPlan>("forge_feature_ai");
  const midRunAI = useAI<Record<string, unknown>>("forge_feature_ai");
  const postRunAI = useAI<PostRunDiagnosis>("forge_feature_ai");

  // Pre-fill subject from first pending task
  useEffect(() => {
    if (!subject && state) {
      const first = (state.tasks ?? []).find((t) => t.status === "pending");
      if (first) setSubject(first.title);
    }
  }, [state, subject]);

  // Timer tick
  useEffect(() => {
    if (timerRunning && phase === "running") {
      intervalRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            window.clearInterval(intervalRef.current!);
            setTimerRunning(false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
  }, [timerRunning, phase]);

  // Stage pending writes when post-run diagnosis arrives
  useEffect(() => {
    if (!postRunDiagnosis || !dispatch) return;
    const writes: PendingWrite[] = [];
    if (postRunDiagnosis.next_move) {
      const taskTitle = postRunDiagnosis.next_move;
      writes.push({
        action: "task/add",
        label: `Add to Today: "${taskTitle}"`,
        execute: () => dispatch({
          type: "task/add",
          payload: {
            id: crypto.randomUUID(),
            title: taskTitle,
            description: `Generated by Focus Lab: ${m.title}`,
            status: "pending",
            priority: "medium",
            estimated_minutes: 30,
            category: "goal_direct",
            created_at: new Date().toISOString(),
          } as Task,
        }),
      });
    }
    writes.push({
      action: "forge/log_signal",
      label: `Log sprint signal: ${stepsDone.length} steps complete`,
      execute: () => dispatch({
        type: "forge/log_signal",
        payload: {
          id: crypto.randomUUID(),
          feature_id: m.id,
          feature_title: m.title,
          signal_key: "sprint_complete",
          value: JSON.stringify({ steps_done: stepsDone.length, subject }),
          created_at: new Date().toISOString(),
        },
      }),
    });
    setPendingWrites(writes);
  }, [postRunDiagnosis]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGeneratePlan() {
    setPhase("planning");
    const result = await preflightAI.run({
      function_type: "generate_plan",
      prompt_contract:
        "Design a focused understanding sprint. Return JSON: { sprint_plan:[{step,minutes,type}], target_proof, success_criteria, post_run_task }",
      inputs: {
        subject,
        sprint_type: sprintType,
        time_available: timeAvailable,
        proof_target: proofTarget,
      },
    });
    if (result && result.sprint_plan) {
      setSprintPlan(result);
      const totalSec = result.sprint_plan.reduce((a: number, s: SprintStep) => a + (s.minutes ?? 0) * 60, 0);
      setSecondsLeft(totalSec || parseInt(timeAvailable) * 60);
      setCurrentStepIdx(0);
      setStepsDone([]);
    }
  }

  function startRun() {
    setPhase("running");
    setTimerRunning(true);
  }

  function pauseTimer() { setTimerRunning(false); }
  function resumeTimer() { setTimerRunning(true); }

  function markStepDone(i: number) {
    setStepsDone((prev) => prev.includes(i) ? prev : [...prev, i]);
    if (sprintPlan && i === currentStepIdx && i < sprintPlan.sprint_plan.length - 1) {
      setCurrentStepIdx(i + 1);
    }
  }

  async function handleMidRun(intent: "stuck" | "challenge" | "score") {
    const contractMap = {
      stuck: { function_type: "split_tasks", prompt_contract: "Return JSON: { smaller_drill, first_move, diagnosis }" },
      challenge: { function_type: "challenge", prompt_contract: "Return JSON: { harder_question, why }" },
      score: { function_type: "score_quality", prompt_contract: "Return JSON: { score, feedback, next_improvement }" },
    };
    const { function_type, prompt_contract } = contractMap[intent];
    const result = await midRunAI.run({
      function_type,
      prompt_contract,
      inputs: { subject, steps_done: stepsDone.length, what_broke: whatBroke },
    });
    if (result) setMidRunResult(result);
  }

  async function handlePostRun() {
    setTimerRunning(false);
    setPhase("post_run");
    const totalMin = sprintPlan
      ? sprintPlan.sprint_plan.reduce((a, s) => a + (s.minutes ?? 0), 0)
      : parseInt(timeAvailable);
    logEntry({
      phase: "post_run",
      subject,
      steps_completed: stepsDone.length,
      what_broke: whatBroke,
      time_used: totalMin,
    });
    const result = await postRunAI.run({
      function_type: "analyze",
      prompt_contract:
        "Post-sprint diagnosis. Return JSON: { what_improved, what_broke, pattern_diagnosis, next_move }",
      inputs: {
        subject,
        steps_completed: stepsDone.length,
        what_broke: whatBroke,
        time_used: totalMin,
      },
    });
    if (result) setPostRunDiagnosis(result);
  }

  function handleApprove(pw: PendingWrite) {
    pw.execute();
    setPendingWrites((prev) => prev.filter((w) => w !== pw));
  }
  function handleDismiss(pw: PendingWrite) {
    setPendingWrites((prev) => prev.filter((w) => w !== pw));
  }

  function reset() {
    setPhase("idle");
    setSprintPlan(null);
    setStepsDone([]);
    setWhatBroke("");
    setMidRunResult(null);
    setPostRunDiagnosis(null);
    setPendingWrites([]);
    setTimerRunning(false);
    setSecondsLeft(0);
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  // ── Layer 1: Context awareness banner ───────────────────────────────────────
  const stallPattern: StallPattern | null = state ? computeStallPattern(state) : null;
  const stuckTask = state ? (state.tasks ?? []).find((t) => t.status === "pending" && t.priority === "high") ??
    (state.tasks ?? []).find((t) => t.status === "pending") : null;
  const recentFeedback = state ? (state.execution_feedback ?? []).slice(-5).map((f) => f.feedback) : [];
  const hasSignal = stallPattern && (stallPattern.stall_type !== "unclear" || stuckTask || recentFeedback.length > 0);

  return (
    <div className="space-y-4">
      {/* Layer 1: Why this sprint exists right now */}
      {hasSignal && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-primary">
            <Brain className="h-3 w-3" /> Why this sprint exists right now
          </div>
          {stallPattern && stallPattern.stall_type !== "unclear" && (
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary font-medium">
                {stallPattern.label}
              </span>
              {stallPattern.evidence_chips.map((chip, i) => (
                <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {chip}
                </span>
              ))}
            </div>
          )}
          {stuckTask && (
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Target task: </span>
              {stuckTask.title}
              {stuckTask.estimated_minutes && (
                <span className="ml-1 text-muted-foreground">· {stuckTask.estimated_minutes}m</span>
              )}
            </div>
          )}
          {recentFeedback.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recentFeedback.slice(-3).map((fb, i) => (
                <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {fb.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending writes */}
      <EngineWritePanel pending={pendingWrites} onApprove={handleApprove} onDismiss={handleDismiss} />

      {/* Idle phase: sprint setup form */}
      {phase === "idle" && (
        <div className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Timer className="h-4 w-4 text-primary" /> Configure Sprint
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What are you working on?"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sprint type</label>
              <select value={sprintType} onChange={(e) => setSprintType(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                <option value="focused_work">Focused work</option>
                <option value="understanding">Understanding</option>
                <option value="practice">Practice</option>
                <option value="review">Review</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Minutes</label>
              <input type="number" value={timeAvailable} onChange={(e) => setTimeAvailable(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Proof target (optional)</label>
            <input
              value={proofTarget}
              onChange={(e) => setProofTarget(e.target.value)}
              placeholder="What will you be able to do after this sprint?"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleGeneratePlan}
            disabled={!subject.trim() || preflightAI.loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {preflightAI.loading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating plan…</>
            ) : (
              <><Zap className="h-3.5 w-3.5" /> Generate sprint plan</>
            )}
          </button>
          {preflightAI.error && <p className="text-xs text-destructive">{preflightAI.error}</p>}
        </div>
      )}

      {/* Planning phase: show generated plan */}
      {phase === "planning" && sprintPlan && (
        <div className="rounded-xl border border-border bg-background p-4 space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-primary">Sprint plan</div>
          {sprintPlan.target_proof && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Proof target: </span>{sprintPlan.target_proof}
            </p>
          )}
          {sprintPlan.success_criteria && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Success: </span>{sprintPlan.success_criteria}
            </p>
          )}
          <ol className="space-y-1.5">
            {sprintPlan.sprint_plan.map((step, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs bg-background/50">
                <span>{i + 1}. {step.step}</span>
                <span className="text-muted-foreground">{step.minutes}m</span>
              </li>
            ))}
          </ol>
          <button
            onClick={startRun}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Play className="h-3.5 w-3.5" /> Start sprint
          </button>
        </div>
      )}

      {/* Running phase */}
      {phase === "running" && sprintPlan && (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background p-4 text-center">
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">Sprint in progress</div>
            <div className="mt-2 text-xs text-muted-foreground">{subject}</div>
            <div className="mt-2 text-4xl font-light tabular-nums">{mm}:{ss}</div>
            <div className="mt-3 flex justify-center gap-2">
              {timerRunning ? (
                <button onClick={pauseTimer} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs">
                  <Pause className="h-3 w-3" /> Pause
                </button>
              ) : (
                <button onClick={resumeTimer} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                  <Play className="h-3 w-3" /> Resume
                </button>
              )}
              <button onClick={handlePostRun} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs">
                <Check className="h-3 w-3" /> End sprint
              </button>
            </div>
          </div>

          {/* Step checklist */}
          <ol className="space-y-1">
            {sprintPlan.sprint_plan.map((step, i) => (
              <li
                key={i}
                className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-xs ${
                  stepsDone.includes(i)
                    ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground line-through"
                    : i === currentStepIdx
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background/50"
                }`}
                onClick={() => markStepDone(i)}
              >
                <span>{i + 1}. {step.step}</span>
                <span className="text-muted-foreground">{step.minutes}m</span>
              </li>
            ))}
          </ol>

          {/* Mid-run AI buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleMidRun("stuck")}
              disabled={midRunAI.loading}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] hover:border-primary/40 disabled:opacity-50"
            >
              {midRunAI.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null} I'm stuck
            </button>
            <button
              onClick={() => handleMidRun("challenge")}
              disabled={midRunAI.loading}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] hover:border-primary/40 disabled:opacity-50"
            >
              Challenge me
            </button>
            <button
              onClick={() => handleMidRun("score")}
              disabled={midRunAI.loading}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[11px] hover:border-primary/40 disabled:opacity-50"
            >
              Score my attempt
            </button>
          </div>
          {midRunAI.error && <p className="text-xs text-destructive">{midRunAI.error}</p>}
          {midRunResult && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-2">
              {Object.entries(midRunResult).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{k.replace(/_/g, " ")}</div>
                  <p className="text-xs text-foreground">{String(v)}</p>
                </div>
              ))}
            </div>
          )}

          {/* What broke capture */}
          <textarea
            value={whatBroke}
            onChange={(e) => setWhatBroke(e.target.value)}
            rows={2}
            placeholder="What's breaking? What's confusing? (for post-run diagnosis)"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs"
          />
        </div>
      )}

      {/* Post-run phase */}
      {phase === "post_run" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
            <Check className="mx-auto h-4 w-4 text-emerald-500" />
            <div className="mt-1 text-sm font-medium">Sprint complete — {stepsDone.length} step{stepsDone.length !== 1 ? "s" : ""} done</div>
          </div>

          {postRunAI.loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running post-sprint diagnosis…
            </div>
          )}
          {postRunAI.error && <p className="text-xs text-destructive">{postRunAI.error}</p>}

          {postRunDiagnosis && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-primary">Post-sprint diagnosis</div>
              {postRunDiagnosis.what_improved && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">What improved</div>
                  <p className="text-xs text-foreground">{postRunDiagnosis.what_improved}</p>
                </div>
              )}
              {postRunDiagnosis.what_broke && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">What broke</div>
                  <p className="text-xs text-foreground">{postRunDiagnosis.what_broke}</p>
                </div>
              )}
              {postRunDiagnosis.pattern_diagnosis && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Pattern</div>
                  <p className="text-xs text-foreground">{postRunDiagnosis.pattern_diagnosis}</p>
                </div>
              )}
              {postRunDiagnosis.next_move && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-primary">Next move</div>
                  <p className="text-xs font-medium text-foreground">{postRunDiagnosis.next_move}</p>
                </div>
              )}
            </div>
          )}

          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3 w-3" /> New sprint
          </button>
        </div>
      )}

      <SessionLog entries={m.entries ?? []} />
    </div>
  );
}

/* ===========================================================
   RESCUE PROTOCOL — Stall Recovery Control Room (4-layer)
   =========================================================== */

type RescuePhase = "idle" | "ai_running" | "result";

interface RescueDiagnosis {
  rewritten_task: string;
  first_action: string;
  diagnosis: string;
  next_10min: string;
  protocol_steps: string[];
  plan_adjustment: string;
  should_switch_plan_b: boolean;
}

const STALL_TO_RESCUE_REASON: Record<string, "overwhelmed" | "tired" | "stuck" | "anxious"> = {
  capacity_threshold: "overwhelmed",
  low_energy: "tired",
  fear_of_failure: "anxious",
};

function RescueProtocolEngine({ module: m, logEntry, state, dispatch }: EngineProps) {
  const [phase, setPhase] = useState<RescuePhase>("idle");
  const [diagnosis, setDiagnosis] = useState<RescueDiagnosis | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [pendingWrites, setPendingWrites] = useState<PendingWrite[]>([]);

  const rescueAI = useAI<RescueDiagnosis>("forge_feature_ai");

  const stall: StallPattern | null = state ? computeStallPattern(state) : null;
  const stuckTask: Task | null = state
    ? ((state.tasks ?? []).find((t) => t.status === "pending" && t.priority === "high") ??
       (state.tasks ?? []).find((t) => t.status === "pending") ??
       null)
    : null;
  const energy = state?.today_state?.energy ?? "unknown";

  // Stage writes when diagnosis arrives
  useEffect(() => {
    if (!diagnosis || !dispatch) return;
    const writes: PendingWrite[] = [];

    if (stuckTask && diagnosis.rewritten_task) {
      const newTitle = diagnosis.rewritten_task;
      writes.push({
        action: "task/tune",
        label: `Rewrite task: "${newTitle}"`,
        execute: () => dispatch({
          type: "task/tune",
          payload: {
            id: stuckTask.id,
            feedback: "too_big",
            change: "rewritten_by_rescue",
            changes: {
              title: newTitle,
              estimated_minutes: Math.max(10, Math.round((stuckTask.estimated_minutes ?? 30) / 2)),
            },
          },
        }),
      });
    }

    if (stall) {
      const rescueReason: "overwhelmed" | "tired" | "stuck" | "anxious" =
        STALL_TO_RESCUE_REASON[stall.stall_type] ?? "stuck";
      writes.push({
        action: "rescue/log",
        label: `Log rescue signal: ${rescueReason}`,
        execute: () => dispatch({
          type: "rescue/log",
          payload: {
            id: crypto.randomUUID(),
            reason: rescueReason,
            created_at: new Date().toISOString(),
          },
        }),
      });
    }

    writes.push({
      action: "forge/log_signal",
      label: "Log stall recovery signal",
      execute: () => dispatch({
        type: "forge/log_signal",
        payload: {
          id: crypto.randomUUID(),
          feature_id: m.id,
          feature_title: m.title,
          signal_key: "stall_recovery",
          value: JSON.stringify({ stall_type: stall?.stall_type ?? "unclear", task: stuckTask?.title }),
          created_at: new Date().toISOString(),
        },
      }),
    });

    if (diagnosis.should_switch_plan_b) {
      writes.push({
        action: "home/setPlan",
        label: "Switch to Plan B",
        execute: () => dispatch({ type: "home/setPlan", payload: "plan_b" }),
      });
    }

    setPendingWrites(writes);
  }, [diagnosis]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFullDiagnosis() {
    setPhase("ai_running");
    const recentFeedback = state ? (state.execution_feedback ?? []).slice(-3).map((f) => f.feedback) : [];
    const result = await rescueAI.run({
      function_type: "analyze",
      prompt_contract:
        "You are a stall recovery specialist. Return JSON: { rewritten_task, first_action, diagnosis, next_10min, protocol_steps, plan_adjustment, should_switch_plan_b }",
      inputs: {
        stall_type: stall?.stall_type ?? "unclear",
        stuck_task_title: stuckTask?.title ?? "unknown",
        stuck_task_minutes: stuckTask?.estimated_minutes ?? 30,
        energy,
        recent_feedback: recentFeedback,
      },
    });
    if (result) {
      setDiagnosis(result);
      logEntry({
        phase: "result",
        stall_type: stall?.stall_type,
        stuck_task: stuckTask?.title,
        diagnosis: result.diagnosis,
      });
    }
    setPhase("result");
  }

  function stageQuickWrite(writes: PendingWrite[]) {
    setPendingWrites((prev) => [...prev, ...writes]);
  }

  function handleApprove(pw: PendingWrite) {
    pw.execute();
    setPendingWrites((prev) => prev.filter((w) => w !== pw));
  }
  function handleDismiss(pw: PendingWrite) {
    setPendingWrites((prev) => prev.filter((w) => w !== pw));
  }

  return (
    <div className="space-y-4">
      {/* Layer 1: Stall detection card */}
      {stall && (
        <div className="rounded-xl border border-border bg-background p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <div className="text-xs font-medium text-foreground">{stall.label}</div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              stall.confidence === "high" ? "bg-red-500/10 text-red-500" :
              stall.confidence === "medium" ? "bg-amber-500/10 text-amber-500" :
              "bg-secondary text-muted-foreground"
            }`}>
              {stall.confidence} confidence
            </span>
          </div>
          {stall.evidence_chips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {stall.evidence_chips.map((chip, i) => (
                <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {chip}
                </span>
              ))}
            </div>
          )}
          {stuckTask && (
            <div className="rounded-lg bg-secondary/50 px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground">Stuck task: </span>
              <span className="text-foreground font-medium">{stuckTask.title}</span>
              {stuckTask.estimated_minutes && (
                <span className="ml-1 text-muted-foreground">· {stuckTask.estimated_minutes}m</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pending writes */}
      <EngineWritePanel pending={pendingWrites} onApprove={handleApprove} onDismiss={handleDismiss} />

      {/* Idle phase: quick interventions */}
      {phase === "idle" && (
        <div className="space-y-3">
          {/* Quick intervention buttons (instant, no AI) */}
          {dispatch && stuckTask && (
            <div className="rounded-xl border border-border bg-background p-3 space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Quick interventions (no AI needed)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => stageQuickWrite([{
                    action: "task/tune",
                    label: `Shrink "${stuckTask.title}" (halve time)`,
                    execute: () => dispatch({
                      type: "task/tune",
                      payload: {
                        id: stuckTask.id,
                        feedback: "too_big",
                        change: "halved_estimate",
                        changes: { estimated_minutes: Math.max(10, Math.round((stuckTask.estimated_minutes ?? 30) / 2)) },
                      },
                    }),
                  }])}
                  className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:border-primary/40"
                >
                  <div className="font-medium">Shrink task</div>
                  <div className="text-muted-foreground">Halve the estimate</div>
                </button>
                <button
                  onClick={() => stageQuickWrite([{
                    action: "task/tune",
                    label: `First step only: "${stuckTask.title}"`,
                    execute: () => dispatch({
                      type: "task/tune",
                      payload: {
                        id: stuckTask.id,
                        feedback: "too_big",
                        change: "first_step_only",
                        changes: { title: `First 10 min: ${stuckTask.title}`, estimated_minutes: 10 },
                      },
                    }),
                  }])}
                  className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:border-primary/40"
                >
                  <div className="font-medium">First step only</div>
                  <div className="text-muted-foreground">10 min version</div>
                </button>
                <button
                  onClick={() => stageQuickWrite([{
                    action: "task/add",
                    label: `7-min ugly draft: "${stuckTask.title}"`,
                    execute: () => dispatch({
                      type: "task/add",
                      payload: {
                        id: crypto.randomUUID(),
                        title: `7-min ugly draft: ${stuckTask.title}`,
                        description: "Low-friction version. Done beats perfect.",
                        status: "pending",
                        priority: "high",
                        estimated_minutes: 7,
                        category: "goal_direct",
                        created_at: new Date().toISOString(),
                      } as Task,
                    }),
                  }])}
                  className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:border-primary/40"
                >
                  <div className="font-medium">7-min ugly draft</div>
                  <div className="text-muted-foreground">Low-friction start</div>
                </button>
                <button
                  onClick={() => stageQuickWrite([{
                    action: "home/setPlan",
                    label: "Switch to Plan B",
                    execute: () => dispatch({ type: "home/setPlan", payload: "plan_b" }),
                  }])}
                  className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:border-primary/40"
                >
                  <div className="font-medium">Switch to Plan B</div>
                  <div className="text-muted-foreground">Lower-friction plan</div>
                </button>
              </div>
            </div>
          )}

          {/* Full AI diagnosis button */}
          <div className="rounded-xl border border-border bg-background p-4 text-center space-y-2">
            <Shield className="mx-auto h-5 w-5 text-primary" />
            <div className="text-sm font-medium">Run full AI diagnosis</div>
            <p className="text-xs text-muted-foreground">
              AI will analyze your stall, rewrite your stuck task, generate recovery steps, and stage Moment-wide actions.
            </p>
            <button
              onClick={handleFullDiagnosis}
              disabled={rescueAI.loading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {rescueAI.loading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Diagnosing…</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Run diagnosis</>
              )}
            </button>
          </div>
          {rescueAI.error && <p className="text-xs text-destructive">{rescueAI.error}</p>}
        </div>
      )}

      {/* AI running phase */}
      {phase === "ai_running" && (
        <div className="flex flex-col items-center gap-2 py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Running stall diagnosis…</p>
        </div>
      )}

      {/* Result phase */}
      {phase === "result" && diagnosis && (
        <div className="space-y-3">
          {/* Rewritten task + first action */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-primary">Recovery path</div>
            {diagnosis.rewritten_task && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Rewritten task</div>
                <p className="text-xs font-medium text-foreground">{diagnosis.rewritten_task}</p>
              </div>
            )}
            {diagnosis.first_action && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">First action right now</div>
                <p className="text-xs text-foreground">{diagnosis.first_action}</p>
              </div>
            )}
            {diagnosis.diagnosis && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Why you stalled</div>
                <p className="text-xs text-muted-foreground">{diagnosis.diagnosis}</p>
              </div>
            )}
          </div>

          {/* Next 10 minutes highlight */}
          {diagnosis.next_10min && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-emerald-500">Next 10 minutes</div>
              <p className="text-xs font-medium text-foreground">{diagnosis.next_10min}</p>
            </div>
          )}

          {/* AI-generated protocol steps */}
          {diagnosis.protocol_steps && diagnosis.protocol_steps.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Recovery protocol</div>
              {diagnosis.protocol_steps.map((step, i) => (
                <div
                  key={i}
                  onClick={() => setCheckedSteps((prev) => prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i])}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-xs ${
                    checkedSteps.includes(i)
                      ? "border-emerald-500/30 bg-emerald-500/5 line-through text-muted-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                    {checkedSteps.includes(i) ? <Check className="h-3 w-3 text-emerald-500" /> : i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}

          {diagnosis.plan_adjustment && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Plan adjustment</div>
              <p className="text-xs text-muted-foreground">{diagnosis.plan_adjustment}</p>
            </div>
          )}

          <button
            onClick={() => { setPhase("idle"); setDiagnosis(null); setCheckedSteps([]); setPendingWrites([]); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
      )}

      {phase === "result" && !diagnosis && !rescueAI.loading && (
        <div className="rounded-md border border-dashed border-border bg-background/50 p-4 text-center text-xs text-muted-foreground">
          Diagnosis unavailable. Try again.
        </div>
      )}

      <SessionLog entries={m.entries ?? []} />
    </div>
  );
}

/* ===========================================================
   TRACKER / EVIDENCE LOG
   =========================================================== */

function TrackerEngine({ module: m, logEntry }: EngineProps) {
  const fields: Array<{ key: string; label: string; kind: "number" | "text" | "rating" }> =
    m.config?.fields ?? [{ key: "value", label: "Value", kind: "number" }, { key: "note", label: "Note", kind: "text" }];
  const [data, setData] = useState<Record<string, string | number>>({});
  const [open, setOpen] = useState(false);

  function submit() {
    const filled = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "" && v !== undefined));
    if (Object.keys(filled).length === 0) return;
    logEntry(filled);
    setData({}); setOpen(false);
  }

  const entries = m.entries ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <div className="text-sm font-medium">Log a signal</div>
          </div>
          <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
            <Plus className="h-3 w-3" /> {open ? "Close" : "New entry"}
          </button>
        </div>
        {open && (
          <div className="mt-3 space-y-2">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{f.label}</label>
                {f.kind === "rating" ? (
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setData((d) => ({ ...d, [f.key]: n }))}
                        className={`h-8 w-8 rounded-md border text-xs ${data[f.key] === n ? "border-primary bg-primary/10" : "border-border"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type={f.kind === "number" ? "number" : "text"}
                    value={(data[f.key] as string | number) ?? ""}
                    onChange={(e) => setData((d) => ({ ...d, [f.key]: f.kind === "number" ? Number(e.target.value) : e.target.value }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <button onClick={submit} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Save entry</button>
            </div>
          </div>
        )}
      </div>

      <TrackerHistory entries={entries} fields={fields} />
    </div>
  );
}

function TrackerHistory({ entries, fields }: { entries: ModuleEntry[]; fields: Array<{ key: string; label: string; kind: string }> }) {
  if (entries.length === 0) return <Empty label="No entries yet." />;
  const numericKey = fields.find((f) => f.kind === "number" || f.kind === "rating")?.key;
  const series = numericKey ? entries.map((e) => Number(e.data[numericKey] ?? 0)).filter((n) => !isNaN(n)) : [];
  const max = Math.max(1, ...series);
  return (
    <div className="space-y-3">
      {series.length > 1 && (
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">trend · {numericKey}</div>
          <div className="mt-2 flex h-16 items-end gap-1">
            {series.slice(-20).map((v, i) => (
              <div key={i} className="flex-1 rounded-t bg-primary/60" style={{ height: `${(v / max) * 100}%` }} title={String(v)} />
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">recent · {entries.length}</div>
        <ul className="mt-2 space-y-1.5">
          {entries.slice(-6).reverse().map((e) => (
            <li key={e.id} className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs">
              <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
              <div>{Object.entries(e.data).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ===========================================================
   PLANNER
   =========================================================== */

function PlannerEngine({ module: m, logEntry }: EngineProps) {
  const slots: Array<{ label: string; cadence: string }> = m.config?.slots ?? [];
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [note, setNote] = useState("");

  if (slots.length === 0) return <Empty label="No slots configured." />;

  function checkIn(i: number) {
    logEntry({ slot: slots[i].label, cadence: slots[i].cadence, status: "done" }, note || undefined);
    setActiveSlot(null); setNote("");
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {slots.map((s, i) => {
          const recentForSlot = (m.entries ?? []).filter((e) => e.data.slot === s.label).length;
          return (
            <li key={i} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground">{s.cadence} · {recentForSlot} check-ins</div>
                </div>
                <button onClick={() => setActiveSlot(activeSlot === i ? null : i)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                  <Check className="h-3 w-3" /> Check in
                </button>
              </div>
              {activeSlot === i && (
                <div className="mt-3 space-y-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One sentence on how it went…"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setActiveSlot(null)} className="rounded-md px-2 py-1 text-xs text-muted-foreground">Cancel</button>
                    <button onClick={() => checkIn(i)} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Save</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <SessionLog entries={m.entries ?? []} />
    </div>
  );
}

/* ===========================================================
   GENERIC RUN
   =========================================================== */

function GenericRunEngine({ module: m, logEntry }: EngineProps) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background p-5 text-center">
        <Flame className="mx-auto h-5 w-5 text-primary" />
        <div className="mt-2 text-sm">{m.title}</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="What did you do this round?"
          className="mt-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs" />
        <button onClick={() => { logEntry({ ran: true }, note || undefined); setNote(""); }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Play className="h-3.5 w-3.5" /> Log run
        </button>
      </div>
      <SessionLog entries={m.entries ?? []} />
    </div>
  );
}

/* ===========================================================
   Shared bits
   =========================================================== */

function Empty({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed border-border bg-background/50 p-4 text-center text-xs text-muted-foreground">{label}</div>;
}

function SessionLog({ entries }: { entries: ModuleEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">history · {entries.length}</div>
      <ul className="mt-2 space-y-1.5">
        {entries.slice(-5).reverse().map((e) => (
          <li key={e.id} className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              {e.note && <span className="ml-2 truncate text-muted-foreground/80">"{e.note}"</span>}
            </div>
            <div className="mt-0.5">{Object.entries(e.data).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

