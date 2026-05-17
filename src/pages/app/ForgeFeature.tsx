import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Zap, CheckCircle2, Clock, Target, Loader2, ChevronDown, ChevronRight,
  Plus, RotateCcw, BookOpen, AlertTriangle, Sparkles, Send, BarChart2,
  ClipboardList, ListChecks, Activity, Brain, RefreshCw,
} from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { getGuidebookById, getFeatureRunsForGuidebook, getSignalsForGuidebook } from "@/lib/selectors/forge";
import { useAI } from "@/lib/ai/useAI";
import { FEATURE_TYPE_LABELS, FUNCTION_TYPE_LABELS } from "@/lib/forge/guidebook";
import { computeStallPattern } from "@/lib/selectors/audit";
import type {
  ForgeGuidebook,
  GuidebookInput,
  GuidebookAIFunction,
  GuidebookSection,
  FeatureRunResult,
  Task,
  MomentState,
  ExecutionFeedbackItem,
} from "@/lib/types";

// ─── Context awareness panel ──────────────────────────────────────────────────

function ContextAwarenessPanel({
  guidebook,
  state,
}: {
  guidebook: ForgeGuidebook;
  state: MomentState;
}) {
  const stall = computeStallPattern(state);
  const recentFeedback: ExecutionFeedbackItem[] = (state.execution_feedback ?? []).slice(-7);
  const bottleneck = state.pursuit_model?.workstreams?.find((w) => w.bottleneck)?.bottleneck ?? null;
  const runCount = (state.forge_state?.feature_runs ?? []).filter((r) => r.feature_id === guidebook.id).length;
  const rescueCount7d = (state.rescue_signals ?? []).filter(
    (r) => Date.now() - new Date(r.created_at).getTime() <= 7 * 86400_000,
  ).length;

  const hasSignal =
    stall.stall_type !== "unclear" ||
    recentFeedback.length > 0 ||
    bottleneck ||
    rescueCount7d > 0;

  if (!hasSignal) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-primary">
        <Brain className="h-3.5 w-3.5" /> Why this feature exists right now
      </div>

      {stall.stall_type !== "unclear" && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-foreground">{stall.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {stall.evidence_chips.map((chip, i) => (
              <span key={i} className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                {chip}
              </span>
            ))}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              stall.confidence === "high" ? "bg-red-500/10 text-red-500" :
              stall.confidence === "medium" ? "bg-amber-500/10 text-amber-500" :
              "bg-secondary text-muted-foreground"
            }`}>
              {stall.confidence} confidence
            </span>
          </div>
        </div>
      )}

      {recentFeedback.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Recent feedback</div>
          <div className="flex flex-wrap gap-1">
            {recentFeedback.map((fb, i) => (
              <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                {fb.feedback.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {bottleneck && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Bottleneck: </span>{bottleneck}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        {runCount > 0 && <span>{runCount} run{runCount !== 1 ? "s" : ""} on this feature</span>}
        {rescueCount7d > 0 && <span>{rescueCount7d} rescue call{rescueCount7d !== 1 ? "s" : ""} this week</span>}
      </div>
    </div>
  );
}

// ─── Current target card ──────────────────────────────────────────────────────

function CurrentTargetCard({
  state,
  guidebook,
}: {
  state: MomentState;
  guidebook: ForgeGuidebook;
}) {
  const [expanded, setExpanded] = useState(false);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const pending = (state.tasks ?? [])
    .filter((t) => t.status === "pending")
    .sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

  if (pending.length === 0) return null;

  const primary = pending[0];
  const rest = pending.slice(1, 5);

  const priorityChipClass: Record<string, string> = {
    high: "bg-red-500/10 text-red-500",
    medium: "bg-amber-500/10 text-amber-500",
    low: "bg-secondary text-muted-foreground",
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        Current target · {guidebook.feature_type}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{primary.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityChipClass[primary.priority] ?? "bg-secondary text-muted-foreground"}`}>
              {primary.priority}
            </span>
          </div>
          {primary.estimated_minutes && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" /> {primary.estimated_minutes}m
            </div>
          )}
        </div>
        {rest.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      {expanded && rest.length > 0 && (
        <div className="mt-1 space-y-1 border-t border-border/60 pt-2">
          <div className="text-[10px] text-muted-foreground">Other pending</div>
          {rest.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-xs">
              <span className="truncate text-foreground">{t.title}</span>
              <span className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${priorityChipClass[t.priority] ?? ""}`}>
                {t.priority}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Input renderer ───────────────────────────────────────────────────────────

function InputField({
  input,
  value,
  onChange,
}: {
  input: GuidebookInput;
  value: string;
  onChange: (val: string) => void;
}) {
  const baseClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none";

  if (input.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={input.placeholder}
        rows={3}
        className={`${baseClass} resize-none`}
      />
    );
  }

  if (input.type === "select" && input.options) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={baseClass}>
        <option value="">Select…</option>
        {input.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (input.type === "scale") {
    const max = 10;
    const parsed = parseInt(value) || 0;
    return (
      <div className="space-y-1">
        <input
          type="range"
          min={1}
          max={max}
          value={parsed || 5}
          onChange={(e) => onChange(e.target.value)}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1</span>
          <span className="font-medium text-foreground">{parsed || 5}</span>
          <span>{max}</span>
        </div>
      </div>
    );
  }

  if (input.type === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={input.placeholder}
        className={baseClass}
      />
    );
  }

  if (input.type === "date") {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={input.placeholder}
      className={baseClass}
    />
  );
}

// ─── AI function output renderer ──────────────────────────────────────────────

function AIOutputDisplay({ output }: { output: Record<string, unknown> }) {
  if (!output || Object.keys(output).length === 0) return null;

  const keyLabel = (k: string) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const renderValue = (val: unknown, depth = 0): React.ReactNode => {
    if (val === null || val === undefined || val === "") {
      return <p className="text-sm italic text-muted-foreground">—</p>;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        return <p className="text-sm italic text-muted-foreground">(none)</p>;
      }
      return (
        <ul className="mt-1 space-y-1.5">
          {val.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">{renderValue(item, depth + 1)}</div>
            </li>
          ))}
        </ul>
      );
    }
    if (typeof val === "object") {
      const entries = Object.entries(val as Record<string, unknown>);
      if (entries.length === 0) {
        return <p className="text-sm italic text-muted-foreground">(empty)</p>;
      }
      return (
        <div className={depth === 0 ? "space-y-3" : "mt-1 space-y-2 rounded-md border border-border/60 bg-background/60 p-3"}>
          {entries.map(([k, v]) => (
            <div key={k}>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {keyLabel(k)}
              </div>
              {renderValue(v, depth + 1)}
            </div>
          ))}
        </div>
      );
    }
    if (typeof val === "number") {
      const looksLikeScore = val >= 0 && val <= 10 && Number.isFinite(val);
      if (looksLikeScore) {
        return (
          <div className="flex items-center gap-2">
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${Math.min(100, (val / 10) * 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium tabular-nums">{val}/10</span>
          </div>
        );
      }
      return <p className="text-sm tabular-nums text-foreground">{val}</p>;
    }
    if (typeof val === "boolean") {
      return <p className="text-sm text-foreground">{val ? "Yes" : "No"}</p>;
    }
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{String(val)}</p>;
  };

  return (
    <div className="space-y-4">
      {Object.entries(output).map(([key, val]) => (
        <div key={key}>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {keyLabel(key)}
          </div>
          {renderValue(val, 1)}
        </div>
      ))}
    </div>
  );
}

function flattenToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return val.map(flattenToString).filter(Boolean).join(" • ");
  if (typeof val === "object") {
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${flattenToString(v)}`)
      .join(" | ");
  }
  return String(val);
}

// ─── Section renderer ─────────────────────────────────────────────────────────

function SectionIcon({ type }: { type: GuidebookSection["section_type"] }) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    input_panel: ClipboardList,
    ai_output: Sparkles,
    saved_entries: BookOpen,
    task_list: ListChecks,
    scorecard: BarChart2,
    timeline: Activity,
    protocol_steps: ListChecks,
    decision_result: Target,
    reflection_box: BookOpen,
    audit_summary: BarChart2,
  };
  const Icon = icons[type] ?? Zap;
  return <Icon className="h-3.5 w-3.5" />;
}

// ─── State write approvals ────────────────────────────────────────────────────

interface PendingStateWrite {
  action: string;
  label: string;
  data: Record<string, unknown>;
}

function StateWritePanel({
  pending,
  onApprove,
  onDismiss,
}: {
  pending: PendingStateWrite[];
  onApprove: (write: PendingStateWrite) => void;
  onDismiss: (write: PendingStateWrite) => void;
}) {
  if (pending.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-amber-500">
        <AlertTriangle className="h-3.5 w-3.5" />
        Generated actions — approve to apply
      </div>
      <div className="space-y-2">
        {pending.map((write, i) => (
          <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-background px-3 py-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.12em] text-amber-500">{write.action}</div>
              <div className="truncate text-sm text-foreground">{write.label}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => onDismiss(write)}
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Skip
              </button>
              <button
                onClick={() => onApprove(write)}
                className="rounded bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/25"
              >
                Apply
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── History entry ────────────────────────────────────────────────────────────

function HistoryEntry({ run, guidebook }: { run: FeatureRunResult; guidebook: ForgeGuidebook }) {
  const [expanded, setExpanded] = useState(false);
  const fn = guidebook.ai_functions.find((f) => f.id === run.function_id);
  const relTime = (() => {
    const diff = Date.now() - new Date(run.run_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">{fn?.name ?? run.function_type}</div>
          {run.tasks_created?.length > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500">
              {run.tasks_created.length} task{run.tasks_created.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{relTime}</span>
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-4 pb-3 pt-3 space-y-3">
          {Object.keys(run.inputs).length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Inputs</div>
              <div className="space-y-1">
                {Object.entries(run.inputs).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="shrink-0 text-muted-foreground">{k}:</span>
                    <span className="text-foreground">{String(v).slice(0, 120)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(run.output).length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Output</div>
              <AIOutputDisplay output={run.output} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Function Panel ────────────────────────────────────────────────────────

function AIFunctionPanel({
  fn,
  inputs,
  featureId,
  featureTitle,
  guidebook,
  onRunComplete,
}: {
  fn: GuidebookAIFunction;
  inputs: Record<string, string>;
  featureId: string;
  featureTitle: string;
  guidebook: ForgeGuidebook;
  onRunComplete: (result: Record<string, unknown>, fnId: string, fnType: string, pendingWrites: PendingStateWrite[]) => void;
}) {
  const ai = useAI<Record<string, unknown>>("forge_feature_ai");
  const [collapsed, setCollapsed] = useState(false);

  const run = async () => {
    const result = await ai.run({
      function_type: fn.function_type,
      prompt_contract: fn.prompt_contract,
      input_sources: fn.input_sources,
      inputs,
      output_schema: fn.output_schema,
      feature_title: featureTitle,
    });

    if (result) {
      const pendingWrites: PendingStateWrite[] = [];

      if (fn.writes_to_state) {
        if (fn.allowed_state_actions.includes("task/create") && result.next_action) {
          pendingWrites.push({
            action: "Add to Today",
            label: String(result.next_action ?? result.first_move ?? result.task_title ?? "AI-generated task"),
            data: { type: "task", title: String(result.next_action ?? result.task_title ?? "AI task"), feature_id: featureId },
          });
        }
        if (fn.allowed_state_actions.includes("task/create") && result.today_tasks && Array.isArray(result.today_tasks)) {
          for (const t of result.today_tasks) {
            pendingWrites.push({
              action: "Add to Today",
              label: String(t),
              data: { type: "task", title: String(t), feature_id: featureId },
            });
          }
        }
        if (fn.allowed_state_actions.includes("forge/log_signal") && result.proof_score != null) {
          pendingWrites.push({
            action: "Log signal",
            label: `Proof score: ${result.proof_score}`,
            data: { type: "signal", key: "proof_score", value: String(result.proof_score), feature_id: featureId },
          });
        }
        if (fn.allowed_state_actions.includes("forge/log_signal") && result.total_score != null) {
          pendingWrites.push({
            action: "Log signal",
            label: `Score: ${result.total_score}/10`,
            data: { type: "signal", key: "total_score", value: String(result.total_score), feature_id: featureId },
          });
        }
      }

      onRunComplete(result, fn.id, fn.function_type, pendingWrites);
    }
  };

  const missingRequired = guidebook.required_inputs
    .filter((i) => i.required)
    .some((i) => !inputs[i.id]?.trim());

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-medium">{fn.name}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            {FUNCTION_TYPE_LABELS[fn.function_type] ?? fn.function_type}
          </span>
        </div>
        {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <p className="text-xs text-muted-foreground">{fn.description}</p>
          {missingRequired && (
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
              Fill in all required inputs above before running this function.
            </div>
          )}
          <button
            onClick={run}
            disabled={ai.loading || missingRequired}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {ai.loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Run
              </>
            )}
          </button>
          {ai.error && <p className="text-xs text-destructive">{ai.error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Section renderer ─────────────────────────────────────────────────────────

function FeatureSection({
  section,
  guidebook,
  inputs,
  onInputChange,
  latestOutput,
  runs,
  featureId,
  featureTitle,
  onRunComplete,
}: {
  section: GuidebookSection;
  guidebook: ForgeGuidebook;
  inputs: Record<string, string>;
  onInputChange: (id: string, val: string) => void;
  latestOutput: Record<string, unknown> | null;
  runs: FeatureRunResult[];
  featureId: string;
  featureTitle: string;
  onRunComplete: (result: Record<string, unknown>, fnId: string, fnType: string, pendingWrites: PendingStateWrite[]) => void;
}) {
  const linkedFn = guidebook.ai_functions.find((f) => f.id === section.linked_ai_function_id);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <SectionIcon type={section.section_type} />
        <h3 className="text-sm font-medium">{section.title}</h3>
        {section.description && (
          <span className="ml-auto text-xs text-muted-foreground">{section.description}</span>
        )}
      </div>

      <div className="p-4">
        {section.section_type === "input_panel" && (
          <div className="space-y-4">
            {guidebook.required_inputs.map((inp) => (
              <div key={inp.id}>
                <div className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                  {inp.label}
                  {inp.required && <span className="text-destructive">*</span>}
                </div>
                <InputField input={inp} value={inputs[inp.id] ?? ""} onChange={(v) => onInputChange(inp.id, v)} />
              </div>
            ))}
          </div>
        )}

        {section.section_type === "ai_output" && linkedFn && (
          <AIFunctionPanel
            fn={linkedFn}
            inputs={inputs}
            featureId={featureId}
            featureTitle={featureTitle}
            guidebook={guidebook}
            onRunComplete={onRunComplete}
          />
        )}

        {section.section_type === "ai_output" && !linkedFn && latestOutput && (
          <AIOutputDisplay output={latestOutput} />
        )}

        {section.section_type === "scorecard" && latestOutput && (
          <AIOutputDisplay output={latestOutput} />
        )}

        {section.section_type === "decision_result" && latestOutput && (
          <AIOutputDisplay output={latestOutput} />
        )}

        {section.section_type === "reflection_box" && (
          <textarea
            value={inputs[`reflection_${section.id}`] ?? ""}
            onChange={(e) => onInputChange(`reflection_${section.id}`, e.target.value)}
            placeholder="Type your response or reflection here…"
            rows={4}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        )}

        {section.section_type === "saved_entries" && (
          <div className="space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved entries yet. Run an AI function to get started.</p>
            ) : (
              runs.slice().reverse().slice(0, 10).map((run) => (
                <HistoryEntry key={run.id} run={run} guidebook={guidebook} />
              ))
            )}
          </div>
        )}

        {section.section_type === "task_list" && latestOutput && (
          <div className="space-y-2">
            {latestOutput.today_tasks && Array.isArray(latestOutput.today_tasks) && (
              latestOutput.today_tasks.map((t: unknown, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{String(t)}</span>
                </div>
              ))
            )}
            {latestOutput.next_action && !latestOutput.today_tasks && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{String(latestOutput.next_action)}</span>
              </div>
            )}
          </div>
        )}

        {section.section_type === "protocol_steps" && (
          <div className="space-y-2">
            {guidebook.task_outputs.map((to, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {i + 1}
                </span>
                <span className="text-sm">{to.title_template}</span>
              </div>
            ))}
          </div>
        )}

        {section.section_type === "audit_summary" && (
          <div className="space-y-2">
            {guidebook.audit_hooks.map((hook) => (
              <div key={hook.signal_key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{hook.description}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{hook.signal_key}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Generic feature guard ────────────────────────────────────────────────────

function GenericGuardBanner({
  onUseAnyway,
  guidebookTitle,
  guidebookDescription,
}: {
  onUseAnyway: () => void;
  guidebookTitle: string;
  guidebookDescription?: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="space-y-1">
          <div className="text-sm font-semibold text-amber-300">This Forge tool is too generic.</div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Moment tried to build <strong>"{guidebookTitle}"</strong> but the result did not contain enough
            goal-specific structure. It has no distinct modes, no goal-linked inputs, and no real state
            connections — so it cannot do anything a generic AI chat can't already do.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background/50 p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
          what a real Forge tool needs
        </div>
        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
          <li>• A specific title (not "Custom Feature" or "Analyser")</li>
          <li>• At least 2 goal-specific inputs</li>
          <li>• At least 2 distinct AI modes (e.g. "Quiz me", "Find gaps", "Create next task")</li>
          <li>• At least 1 state write (save signal or create task)</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          to={`/app/forge?rebuild=${encodeURIComponent(guidebookDescription || guidebookTitle)}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <RefreshCw className="h-3 w-3" /> Regenerate from goal context
        </Link>
        <Link
          to="/app/forge"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Edit tool request
        </Link>
        <button
          onClick={onUseAnyway}
          className="rounded-md border border-border px-3 py-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground"
        >
          Use generic analyser anyway
        </button>
      </div>
    </div>
  );
}

// ─── Build pending state writes from AI output ────────────────────────────────

function buildPendingWrites(
  fn: GuidebookAIFunction,
  result: Record<string, unknown>,
  featureId: string,
): PendingStateWrite[] {
  if (!fn.writes_to_state) return [];
  const writes: PendingStateWrite[] = [];
  const actions = fn.allowed_state_actions ?? [];
  if (actions.includes("task/create") && result.next_action) {
    writes.push({
      action: "Add to Today",
      label: String(result.next_action),
      data: {
        type: "task",
        title: String(result.next_action),
        why_now: result.why_now,
        proof_of_completion: result.proof_of_completion,
        estimated_minutes: result.estimated_minutes,
        feature_id: featureId,
      },
    });
  }
  if (actions.includes("task/create") && Array.isArray(result.today_tasks)) {
    for (const t of result.today_tasks) {
      writes.push({
        action: "Add to Today",
        label: String(t),
        data: { type: "task", title: String(t), feature_id: featureId },
      });
    }
  }
  if (actions.includes("forge/log_signal") && result.proof_score != null) {
    writes.push({
      action: "Log signal",
      label: `Proof score: ${result.proof_score}`,
      data: { type: "signal", key: "proof_score", value: String(result.proof_score), feature_id: featureId },
    });
  }
  if (actions.includes("forge/log_signal") && result.total_score != null) {
    writes.push({
      action: "Log signal",
      label: `Score: ${result.total_score}/10`,
      data: { type: "signal", key: "total_score", value: String(result.total_score), feature_id: featureId },
    });
  }
  return writes;
}

// ─── Mode card ────────────────────────────────────────────────────────────────

function ModeCard({
  fn,
  inputs,
  featureId,
  featureTitle,
  guidebook,
  onRunComplete,
  isLastRun,
}: {
  fn: GuidebookAIFunction;
  inputs: Record<string, string>;
  featureId: string;
  featureTitle: string;
  guidebook: ForgeGuidebook;
  onRunComplete: (result: Record<string, unknown>, fnId: string, fnType: string, writes: PendingStateWrite[]) => void;
  isLastRun: boolean;
}) {
  const ai = useAI<Record<string, unknown>>("forge_feature_ai");

  const missingRequired = guidebook.required_inputs
    .filter((i) => i.required)
    .some((i) => !inputs[i.id]?.trim());

  const run = async () => {
    const result = await ai.run({
      function_type: fn.function_type,
      prompt_contract: fn.prompt_contract,
      input_sources: fn.input_sources,
      inputs,
      output_schema: (fn as any).output_schema,
      feature_title: featureTitle,
    });
    if (result) {
      onRunComplete(result, fn.id, fn.function_type, buildPendingWrites(fn, result, featureId));
    }
  };

  return (
    <div className={`flex flex-col rounded-xl border p-4 gap-2 transition-colors ${
      isLastRun ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:border-primary/30"
    }`}>
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-sm font-medium">{fn.name}</span>
        {isLastRun && (
          <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
            last run
          </span>
        )}
      </div>
      {fn.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{fn.description}</p>
      )}
      {ai.error && <p className="text-xs text-destructive">{ai.error}</p>}
      {missingRequired && !ai.loading && (
        <p className="text-[11px] text-amber-600">Fill in required inputs first.</p>
      )}
      <button
        onClick={run}
        disabled={ai.loading || missingRequired}
        className={`mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
          missingRequired
            ? "border-border text-muted-foreground"
            : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
        }`}
      >
        {ai.loading ? (
          <><Loader2 className="h-3 w-3 animate-spin" /> Running…</>
        ) : (
          <><Send className="h-3 w-3" /> {fn.name}</>
        )}
      </button>
    </div>
  );
}

// ─── Output workspace ─────────────────────────────────────────────────────────

function OutputWorkspace({
  fn,
  output,
  featureId,
  guidebook,
}: {
  fn: GuidebookAIFunction;
  output: Record<string, unknown>;
  featureId: string;
  guidebook: ForgeGuidebook;
}) {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [taskCreated, setTaskCreated] = useState(false);
  const [signalSaved, setSignalSaved] = useState(false);

  const createTask = () => {
    const rawTitle = output.next_action ?? output.task_title ?? output.first_move ?? output.next_step;
    const title = (flattenToString(rawTitle).trim().split(/[.\n]/)[0] || "").slice(0, 120)
      || `${fn.name} — next step`;
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      description: `From ${guidebook.title} — ${fn.name}\n\n${flattenToString(output).slice(0, 800)}`,
      status: "pending",
      priority: "medium",
      goal_id: state?.active_goal?.id ?? "",
      domain_id: "",
      estimated_minutes: (typeof output.estimated_minutes === "number" ? output.estimated_minutes : 20),
      category: "goal_direct" as const,
      created_at: new Date().toISOString(),
      completed_at: "",
      due_date: "",
      created_by: "ai",
      why_now: flattenToString(output.why_now).slice(0, 240) || `Generated from ${guidebook.title} — ${fn.name}`,
      proof_of_completion: flattenToString(output.proof_of_completion ?? output.proof).slice(0, 240),
      forge_feature_id: guidebook.id,
      workstream_id: state?.pursuit_model?.workstreams?.[0]?.id,
    };
    dispatch({ type: "task/add", payload: task });
    setTaskCreated(true);
    setTimeout(() => setTaskCreated(false), 3000);
  };

  const saveSignal = () => {
    const candidate =
      output.summary ?? output.pathway ?? output.gaps ?? output.analysis ??
      output.result ?? output;
    const value = flattenToString(candidate).slice(0, 500) || "(no summary)";
    dispatch({
      type: "forge/log_signal",
      payload: {
        id: crypto.randomUUID(),
        feature_id: featureId,
        feature_title: guidebook.title,
        signal_key: fn.function_type,
        value,
        created_at: new Date().toISOString(),
      },
    });
    setSignalSaved(true);
    setTimeout(() => setSignalSaved(false), 3000);
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.15em] text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Result · {fn.name}
      </div>
      <AIOutputDisplay output={output} />
      <div className="flex flex-wrap gap-2 border-t border-primary/15 pt-3">
        <button
          onClick={saveSignal}
          disabled={signalSaved}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {signalSaved ? "Signal saved ✓" : "Save as Forge signal"}
        </button>
        <button
          onClick={createTask}
          disabled={taskCreated}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
        >
          {taskCreated ? "Task created ✓" : "Create task from this"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Feature Page ────────────────────────────────────────────────────────

export default function ForgeFeature() {
  const { featureId } = useParams<{ featureId: string }>();
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);

  const guidebook = getGuidebookById(state, featureId ?? "");
  const runs = getFeatureRunsForGuidebook(state, featureId ?? "");
  const signals = getSignalsForGuidebook(state, featureId ?? "");

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [latestOutputs, setLatestOutputs] = useState<Record<string, Record<string, unknown>>>({});
  const [pendingWrites, setPendingWrites] = useState<PendingStateWrite[]>([]);
  const [activeTab, setActiveTab] = useState<"run" | "history">("run");
  const [lastRunFnId, setLastRunFnId] = useState<string | null>(null);
  const [useGenericAnyway, setUseGenericAnyway] = useState(false);

  const handleInputChange = useCallback((id: string, val: string) => {
    setInputs((prev) => ({ ...prev, [id]: val }));
  }, []);

  const handleRunComplete = useCallback(
    (result: Record<string, unknown>, fnId: string, fnType: string, writes: PendingStateWrite[]) => {
      setLatestOutputs((prev) => ({ ...prev, [fnId]: result }));
      setPendingWrites((prev) => [...prev, ...writes]);
      setLastRunFnId(fnId);

      const run: FeatureRunResult = {
        id: crypto.randomUUID(),
        feature_id: featureId ?? "",
        run_at: new Date().toISOString(),
        function_id: fnId,
        function_type: fnType,
        inputs: { ...inputs },
        output: result,
        state_writes_approved: [],
        tasks_created: [],
      };

      dispatch({ type: "forge/log_feature_run", payload: run });
      dispatch({ type: "forge/touch_guidebook", payload: { id: featureId ?? "" } });
    },
    [dispatch, featureId, inputs],
  );

  const handleApproveWrite = useCallback(
    (write: PendingStateWrite) => {
      if (write.data.type === "task") {
        const rawTitle = write.data.title ?? write.data.next_action ?? "Forge-generated task";
        const task: Task = {
          id: crypto.randomUUID(),
          title: (typeof rawTitle === "string" ? rawTitle.trim() : null) || "Forge-generated task",
          description: `Generated by ${guidebook?.title ?? "Forge feature"}`,
          status: "pending",
          priority: "medium",
          goal_id: "",
          domain_id: "",
          estimated_minutes: (typeof write.data.estimated_minutes === "number" ? write.data.estimated_minutes : null) ?? 30,
          category: "goal_direct",
          created_at: new Date().toISOString(),
          completed_at: "",
          due_date: "",
          created_by: "ai",
          why_now: (typeof write.data.why_now === "string" && write.data.why_now.trim())
            ? write.data.why_now
            : `Generated from ${guidebook?.title ?? "Forge"} — see run history for context.`,
          proof_of_completion: (typeof write.data.proof_of_completion === "string" ? write.data.proof_of_completion : null)
            ?? (typeof write.data.proof === "string" ? write.data.proof : "") ?? "",
          forge_feature_id: guidebook?.id,
          workstream_id: state?.pursuit_model?.workstreams?.[0]?.id,
        };
        dispatch({ type: "task/add", payload: task });
      } else if (write.data.type === "signal") {
        dispatch({
          type: "forge/log_signal",
          payload: {
            id: crypto.randomUUID(),
            feature_id: featureId ?? "",
            feature_title: guidebook?.title ?? "",
            signal_key: String(write.data.key ?? "signal"),
            value: String(write.data.value ?? ""),
            created_at: new Date().toISOString(),
          },
        });
      } else if (write.data.type === "feedback") {
        dispatch({
          type: "feedback/add",
          payload: {
            id: crypto.randomUUID(),
            task_id: String(write.data.task_id ?? ""),
            task_title: String(write.data.task_title ?? ""),
            feedback: String(write.data.feedback ?? "not_relevant") as ExecutionFeedbackItem["feedback"],
            created_at: new Date().toISOString(),
          },
        });
      } else if (write.data.type === "task_tune") {
        dispatch({
          type: "task/tune",
          payload: {
            id: String(write.data.id ?? ""),
            feedback: String(write.data.feedback ?? "too_big"),
            change: String(write.data.change ?? "rewritten"),
            changes: (write.data.changes ?? {}) as Partial<Task>,
          },
        });
      } else if (write.data.type === "rescue") {
        dispatch({
          type: "rescue/log",
          payload: {
            id: crypto.randomUUID(),
            reason: String(write.data.reason ?? "stuck") as "overwhelmed" | "tired" | "stuck" | "anxious",
            created_at: new Date().toISOString(),
          },
        });
      }
      setPendingWrites((prev) => prev.filter((w) => w !== write));
    },
    [dispatch, featureId, guidebook],
  );

  const handleDismissWrite = useCallback((write: PendingStateWrite) => {
    setPendingWrites((prev) => prev.filter((w) => w !== write));
  }, []);

  if (!state) {
    return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!guidebook) {
    return (
      <div className="mx-auto max-w-2xl py-12 space-y-4">
        <Link
          to="/app/forge"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Forge
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Feature not found. It may have been archived.</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-500",
    paused: "bg-amber-500/10 text-amber-500",
    draft: "bg-secondary text-muted-foreground",
    archived: "bg-secondary text-muted-foreground",
  };

  const latestRun = runs[runs.length - 1];
  const latestOutputForSection = (sectionFnId?: string) => {
    if (!sectionFnId) {
      const allOutputs = Object.values(latestOutputs);
      return allOutputs[allOutputs.length - 1] ?? null;
    }
    return latestOutputs[sectionFnId] ?? null;
  };

  const GENERIC_TITLES = ["custom feature", "analyser", "analyzer", "ai analysis", "this feature", "feature"];
  const isGeneric =
    GENERIC_TITLES.includes(guidebook.title.toLowerCase().trim()) ||
    (guidebook.ai_functions.length === 1 &&
      guidebook.ai_functions[0].name.toLowerCase().includes("analys"));

  const lastRunFn = guidebook.ai_functions.find((f) => f.id === lastRunFnId) ?? null;
  const lastRunOutput = lastRunFnId ? (latestOutputs[lastRunFnId] ?? null) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back nav */}
      <Link
        to="/app/forge"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Forge
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{guidebook.title}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusColors[guidebook.status] ?? "bg-secondary text-muted-foreground"}`}>
                {guidebook.status}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                {FEATURE_TYPE_LABELS[guidebook.feature_type]}
              </span>
            </div>
            {guidebook.subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{guidebook.subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {guidebook.status === "active" && (
              <button
                onClick={() => dispatch({ type: "forge/pause_guidebook", payload: { id: guidebook.id } })}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Pause
              </button>
            )}
            {guidebook.status === "paused" && (
              <button
                onClick={() => dispatch({ type: "forge/activate_guidebook", payload: { id: guidebook.id } })}
                className="rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs text-primary"
              >
                Resume
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span>{runs.length} run{runs.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart2 className="h-3 w-3" />
            <span>{signals.length} signal{signals.length !== 1 ? "s" : ""}</span>
          </div>
          {latestRun && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last run {new Date(latestRun.run_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Purpose card */}
      <div className="rounded-2xl border border-border bg-card/50 px-5 py-4">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Purpose
        </div>
        <p className="text-sm leading-relaxed text-foreground">{guidebook.purpose}</p>
        {guidebook.bottleneck_addressed && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Bottleneck: </span>
            {guidebook.bottleneck_addressed}
          </p>
        )}
      </div>

      {/* Tab bar for Run / History */}
      <div className="flex gap-1.5">
        {(["run", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors capitalize ${
              activeTab === tab
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "history" ? `History (${runs.length})` : "Run"}
          </button>
        ))}
      </div>

      {activeTab === "run" && (
        <>
          {/* Context awareness */}
          {state && <ContextAwarenessPanel guidebook={guidebook} state={state} />}

          {/* Current target */}
          {state && <CurrentTargetCard state={state} guidebook={guidebook} />}

          {/* Generic guard — replaces all run content when generic */}
          {isGeneric && !useGenericAnyway && (
            <GenericGuardBanner
              onUseAnyway={() => setUseGenericAnyway(true)}
              guidebookTitle={guidebook.title}
              guidebookDescription={guidebook.purpose || guidebook.subtitle || undefined}
            />
          )}

          {/* Inputs — only shown for real (non-generic) tools */}
          {(!isGeneric || useGenericAnyway) && guidebook.required_inputs.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-medium text-foreground">Inputs</h3>
              {guidebook.required_inputs.map((inp) => (
                <div key={inp.id}>
                  <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground">
                    {inp.label}
                    {inp.required && <span className="text-destructive">*</span>}
                  </div>
                  <InputField
                    input={inp}
                    value={inputs[inp.id] ?? ""}
                    onChange={(v) => handleInputChange(inp.id, v)}
                  />
                </div>
              ))}
            </section>
          )}

          {/* Mode picker — shown when not generic (or user chose to proceed anyway) */}
          {(!isGeneric || useGenericAnyway) && guidebook.ai_functions.length > 0 && (
            <section>
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                {guidebook.ai_functions.length > 1 ? "Choose a mode" : "Run"}
              </div>
              <div className={`grid gap-3 ${guidebook.ai_functions.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {guidebook.ai_functions.map((fn) => (
                  <ModeCard
                    key={fn.id}
                    fn={fn}
                    inputs={inputs}
                    featureId={guidebook.id}
                    featureTitle={guidebook.title}
                    guidebook={guidebook}
                    onRunComplete={handleRunComplete}
                    isLastRun={fn.id === lastRunFnId}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Output workspace — appears after first run */}
          {lastRunFn && lastRunOutput && (
            <OutputWorkspace
              key={lastRunFnId}
              fn={lastRunFn}
              output={lastRunOutput}
              featureId={guidebook.id}
              guidebook={guidebook}
            />
          )}

          {/* Pending state write approvals (auto-detected writes from AI functions) */}
          <StateWritePanel
            pending={pendingWrites}
            onApprove={handleApproveWrite}
            onDismiss={handleDismissWrite}
          />

          {/* Non-AI sections: reflection boxes, protocol steps, saved entries */}
          {guidebook.sections
            .filter((s) => !["input_panel", "ai_output"].includes(s.section_type))
            .map((section) => (
              <FeatureSection
                key={section.id}
                section={section}
                guidebook={guidebook}
                inputs={inputs}
                onInputChange={handleInputChange}
                latestOutput={latestOutputForSection(section.linked_ai_function_id)}
                runs={runs}
                featureId={guidebook.id}
                featureTitle={guidebook.title}
                onRunComplete={handleRunComplete}
              />
            ))}

          {/* Safety rules */}
          {guidebook.safety_rules.length > 0 && (
            <div className="rounded-xl border border-border/50 px-4 py-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Safety boundaries</div>
              <ul className="space-y-1">
                {guidebook.safety_rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {activeTab === "history" && (
        <div className="space-y-3">
          {runs.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No runs yet. Go to the Run tab to get started.</p>
            </div>
          ) : (
            runs.slice().reverse().map((run) => (
              <HistoryEntry key={run.id} run={run} guidebook={guidebook} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
