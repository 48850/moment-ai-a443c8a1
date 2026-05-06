import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Zap, CheckCircle2, Clock, Target, Loader2, ChevronDown, ChevronRight,
  BookOpen, AlertTriangle, Sparkles, Send, BarChart2,
  ClipboardList, ListChecks, Activity,
} from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { getGuidebookById, getFeatureRunsForGuidebook, getSignalsForGuidebook } from "@/lib/selectors/forge";
import { useAI } from "@/lib/ai/useAI";
import { FEATURE_TYPE_LABELS, FUNCTION_TYPE_LABELS } from "@/lib/forge/guidebook";
import type {
  ForgeGuidebook,
  GuidebookInput,
  GuidebookAIFunction,
  GuidebookSection,
  FeatureRunResult,
  Task,
} from "@/lib/types";

function InputField({
  input, value, onChange,
}: { input: GuidebookInput; value: string; onChange: (v: string) => void }) {
  const baseClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none";
  if (input.type === "textarea") return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={input.placeholder} rows={3} className={`${baseClass} resize-none`} />;
  if (input.type === "select" && input.options) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={baseClass}>
        <option value="">Select…</option>
        {input.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    );
  }
  if (input.type === "scale") {
    const max = 10; const parsed = parseInt(value) || 0;
    return (
      <div className="space-y-1">
        <input type="range" min={1} max={max} value={parsed || 5} onChange={(e) => onChange(e.target.value)} className="w-full accent-primary" />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1</span><span className="font-medium text-foreground">{parsed || 5}</span><span>{max}</span>
        </div>
      </div>
    );
  }
  if (input.type === "number") return <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={input.placeholder} className={baseClass} />;
  if (input.type === "date") return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={baseClass} />;
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={input.placeholder} className={baseClass} />;
}

function AIOutputDisplay({ output }: { output: Record<string, unknown> }) {
  if (!output || Object.keys(output).length === 0) return null;
  const renderValue = (val: unknown): React.ReactNode => {
    if (Array.isArray(val)) {
      return (
        <ul className="mt-1 space-y-1">
          {val.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{String(item)}</span>
            </li>
          ))}
        </ul>
      );
    }
    if (typeof val === "number") {
      return (
        <div className="flex items-center gap-2">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${Math.min(100, (val / 10) * 100)}%` }} />
          </div>
          <span className="text-sm font-medium tabular-nums">{val}/10</span>
        </div>
      );
    }
    return <p className="text-sm text-foreground">{String(val)}</p>;
  };
  const keyLabel = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div className="space-y-4">
      {Object.entries(output).map(([key, val]) => (
        <div key={key}>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{keyLabel(key)}</div>
          {renderValue(val)}
        </div>
      ))}
    </div>
  );
}

function SectionIcon({ type }: { type: GuidebookSection["section_type"] }) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    input_panel: ClipboardList, ai_output: Sparkles, saved_entries: BookOpen, task_list: ListChecks,
    scorecard: BarChart2, timeline: Activity, protocol_steps: ListChecks, decision_result: Target,
    reflection_box: BookOpen, audit_summary: BarChart2,
  };
  const Icon = icons[type] ?? Zap;
  return <Icon className="h-3.5 w-3.5" />;
}

interface PendingStateWrite { action: string; label: string; data: Record<string, unknown>; }

function StateWritePanel({
  pending, onApprove, onDismiss,
}: { pending: PendingStateWrite[]; onApprove: (w: PendingStateWrite) => void; onDismiss: (w: PendingStateWrite) => void }) {
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
              <button onClick={() => onDismiss(write)} className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Skip</button>
              <button onClick={() => onApprove(write)} className="rounded bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/25">Apply</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-center justify-between px-4 py-3 text-left">
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

function AIFunctionPanel({
  fn, inputs, featureId, featureTitle, guidebook, onRunComplete,
}: {
  fn: GuidebookAIFunction;
  inputs: Record<string, string>;
  featureId: string;
  featureTitle: string;
  guidebook: ForgeGuidebook;
  onRunComplete: (result: Record<string, unknown>, fnId: string, fnType: string, pending: PendingStateWrite[]) => void;
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
      const pending: PendingStateWrite[] = [];
      if (fn.writes_to_state) {
        if (fn.allowed_state_actions.includes("task/create") && result.next_action) {
          pending.push({
            action: "Add to Today",
            label: String(result.next_action ?? "AI task"),
            data: { type: "task", title: String(result.next_action ?? "AI task"), feature_id: featureId },
          });
        }
        if (fn.allowed_state_actions.includes("task/create") && Array.isArray(result.today_tasks)) {
          for (const t of result.today_tasks) {
            pending.push({ action: "Add to Today", label: String(t), data: { type: "task", title: String(t), feature_id: featureId } });
          }
        }
        if (fn.allowed_state_actions.includes("forge/log_signal") && result.proof_score != null) {
          pending.push({ action: "Log signal", label: `Proof score: ${result.proof_score}`, data: { type: "signal", key: "proof_score", value: String(result.proof_score), feature_id: featureId } });
        }
        if (fn.allowed_state_actions.includes("forge/log_signal") && result.total_score != null) {
          pending.push({ action: "Log signal", label: `Score: ${result.total_score}/10`, data: { type: "signal", key: "total_score", value: String(result.total_score), feature_id: featureId } });
        }
      }
      onRunComplete(result, fn.id, fn.function_type, pending);
    }
  };

  const missingRequired = guidebook.required_inputs.filter((i) => i.required).some((i) => !inputs[i.id]?.trim());

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setCollapsed((c) => !c)} className="flex w-full items-center justify-between px-4 py-3 text-left">
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
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">Fill in all required inputs above before running this function.</div>
          )}
          <button onClick={run} disabled={ai.loading || missingRequired}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {ai.loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running…</> : <><Send className="h-3.5 w-3.5" /> Run</>}
          </button>
          {ai.error && <p className="text-xs text-destructive">{ai.error}</p>}
        </div>
      )}
    </div>
  );
}

function FeatureSection({
  section, guidebook, inputs, onInputChange, latestOutput, runs, featureId, featureTitle, onRunComplete,
}: {
  section: GuidebookSection;
  guidebook: ForgeGuidebook;
  inputs: Record<string, string>;
  onInputChange: (id: string, val: string) => void;
  latestOutput: Record<string, unknown> | null;
  runs: FeatureRunResult[];
  featureId: string;
  featureTitle: string;
  onRunComplete: (result: Record<string, unknown>, fnId: string, fnType: string, pending: PendingStateWrite[]) => void;
}) {
  const linkedFn = guidebook.ai_functions.find((f) => f.id === section.linked_ai_function_id);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <SectionIcon type={section.section_type} />
        <h3 className="text-sm font-medium">{section.title}</h3>
        {section.description && <span className="ml-auto text-xs text-muted-foreground">{section.description}</span>}
      </div>
      <div className="p-4">
        {section.section_type === "input_panel" && (
          <div className="space-y-4">
            {guidebook.required_inputs.map((inp) => (
              <div key={inp.id}>
                <div className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                  {inp.label}{inp.required && <span className="text-destructive">*</span>}
                </div>
                <InputField input={inp} value={inputs[inp.id] ?? ""} onChange={(v) => onInputChange(inp.id, v)} />
              </div>
            ))}
          </div>
        )}
        {section.section_type === "ai_output" && linkedFn && (
          <AIFunctionPanel fn={linkedFn} inputs={inputs} featureId={featureId} featureTitle={featureTitle} guidebook={guidebook} onRunComplete={onRunComplete} />
        )}
        {section.section_type === "ai_output" && !linkedFn && latestOutput && <AIOutputDisplay output={latestOutput} />}
        {section.section_type === "scorecard" && latestOutput && <AIOutputDisplay output={latestOutput} />}
        {section.section_type === "decision_result" && latestOutput && <AIOutputDisplay output={latestOutput} />}
        {section.section_type === "reflection_box" && (
          <textarea value={inputs[`reflection_${section.id}`] ?? ""} onChange={(e) => onInputChange(`reflection_${section.id}`, e.target.value)}
            placeholder="Type your response or reflection here…" rows={4}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
        )}
        {section.section_type === "saved_entries" && (
          <div className="space-y-2">
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved entries yet. Run an AI function to get started.</p>
            ) : (
              runs.slice().reverse().slice(0, 10).map((run) => <HistoryEntry key={run.id} run={run} guidebook={guidebook} />)
            )}
          </div>
        )}
        {section.section_type === "task_list" && latestOutput && (
          <div className="space-y-2">
            {Array.isArray(latestOutput.today_tasks) && latestOutput.today_tasks.map((t: unknown, i: number) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" /><span>{String(t)}</span>
              </div>
            ))}
            {latestOutput.next_action && !latestOutput.today_tasks && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" /><span>{String(latestOutput.next_action)}</span>
              </div>
            )}
          </div>
        )}
        {section.section_type === "protocol_steps" && (
          <div className="space-y-2">
            {guidebook.task_outputs.map((to, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">{i + 1}</span>
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

  const handleInputChange = useCallback((id: string, val: string) => {
    setInputs((prev) => ({ ...prev, [id]: val }));
  }, []);

  const handleRunComplete = useCallback(
    (result: Record<string, unknown>, fnId: string, fnType: string, writes: PendingStateWrite[]) => {
      setLatestOutputs((prev) => ({ ...prev, [fnId]: result }));
      setPendingWrites((prev) => [...prev, ...writes]);
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
        const task: Task = {
          id: crypto.randomUUID(),
          title: String(write.data.title ?? "AI-generated task"),
          description: `Generated by ${guidebook?.title ?? "Forge feature"}`,
          status: "pending",
          priority: "medium",
          goal_id: "",
          domain_id: "",
          estimated_minutes: 30,
          category: "goal_direct",
          created_at: new Date().toISOString(),
          completed_at: "",
          due_date: "",
          tune_notes: [],
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
      }
      setPendingWrites((prev) => prev.filter((w) => w !== write));
    },
    [dispatch, featureId, guidebook],
  );

  const handleDismissWrite = useCallback((write: PendingStateWrite) => {
    setPendingWrites((prev) => prev.filter((w) => w !== write));
  }, []);

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;
  if (!guidebook) {
    return (
      <div className="mx-auto max-w-2xl py-12 space-y-4">
        <Link to="/app/forge" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
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
      const all = Object.values(latestOutputs);
      return all[all.length - 1] ?? null;
    }
    return latestOutputs[sectionFnId] ?? null;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/app/forge" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Forge
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{guidebook.title}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusColors[guidebook.status] ?? "bg-secondary text-muted-foreground"}`}>{guidebook.status}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{FEATURE_TYPE_LABELS[guidebook.feature_type]}</span>
            </div>
            {guidebook.subtitle && <p className="mt-1 text-sm text-muted-foreground">{guidebook.subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {guidebook.status === "active" && (
              <button onClick={() => dispatch({ type: "forge/pause_guidebook", payload: { id: guidebook.id } })}
                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">Pause</button>
            )}
            {guidebook.status === "paused" && (
              <button onClick={() => dispatch({ type: "forge/activate_guidebook", payload: { id: guidebook.id } })}
                className="rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs text-primary">Resume</button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Activity className="h-3 w-3" /><span>{runs.length} run{runs.length !== 1 ? "s" : ""}</span></div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><BarChart2 className="h-3 w-3" /><span>{signals.length} signal{signals.length !== 1 ? "s" : ""}</span></div>
          {latestRun && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" /><span>Last run {new Date(latestRun.run_at).toLocaleDateString()}</span></div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/50 px-5 py-4">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Purpose</div>
        <p className="text-sm leading-relaxed text-foreground">{guidebook.purpose}</p>
        {guidebook.bottleneck_addressed && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Bottleneck: </span>{guidebook.bottleneck_addressed}
          </p>
        )}
      </div>

      <div className="flex gap-1.5">
        {(["run", "history"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors capitalize ${
              activeTab === tab ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}>
            {tab === "history" ? `History (${runs.length})` : "Run"}
          </button>
        ))}
      </div>

      {activeTab === "run" && (
        <>
          <StateWritePanel pending={pendingWrites} onApprove={handleApproveWrite} onDismiss={handleDismissWrite} />
          {guidebook.sections.map((section) => (
            <FeatureSection key={section.id} section={section} guidebook={guidebook}
              inputs={inputs} onInputChange={handleInputChange}
              latestOutput={latestOutputForSection(section.linked_ai_function_id)}
              runs={runs} featureId={guidebook.id} featureTitle={guidebook.title}
              onRunComplete={handleRunComplete} />
          ))}
          {guidebook.ai_functions.filter((fn) => !guidebook.sections.some((s) => s.linked_ai_function_id === fn.id)).map((fn) => (
            <div key={fn.id}>
              <AIFunctionPanel fn={fn} inputs={inputs} featureId={guidebook.id} featureTitle={guidebook.title}
                guidebook={guidebook} onRunComplete={handleRunComplete} />
              {latestOutputs[fn.id] && (
                <div className="mt-2 rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Result</div>
                  <AIOutputDisplay output={latestOutputs[fn.id]} />
                </div>
              )}
            </div>
          ))}
          {guidebook.safety_rules.length > 0 && (
            <div className="rounded-xl border border-border/50 px-4 py-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Safety boundaries</div>
              <ul className="space-y-1">
                {guidebook.safety_rules.map((rule, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />{rule}
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
            runs.slice().reverse().map((run) => <HistoryEntry key={run.id} run={run} guidebook={guidebook} />)
          )}
        </div>
      )}
    </div>
  );
}
