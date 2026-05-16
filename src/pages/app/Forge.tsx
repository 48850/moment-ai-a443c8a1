import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Hammer, Sparkles, Loader2, Plus, Archive, Pencil, Play,
  X, ChevronRight, Zap, Target, Clock, BarChart2, Activity,
  Check, AlertCircle, BookOpen, Eye, Pause, RotateCcw,
  CheckCircle2, ArrowRight,
} from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { logLearningSignal } from "@/lib/learning/log-signal";
import { getForgeViewModel } from "@/lib/selectors/forge";
import { useAI } from "@/lib/ai/useAI";
import { ModuleEngine } from "@/components/app/forge/engines";
import {
  buildTemplateGuidebook,
  parseAIGuidebookResponse,
  FEATURE_TYPE_LABELS,
  detectSystemGap,
} from "@/lib/forge/guidebook";
import type {
  FeatureCandidate,
  GeneratedModuleManifest,
  ModuleEntry,
  ForgeGuidebook,
  ForgeFeatureType,
} from "@/lib/types";

// ─── Feature type options ─────────────────────────────────────────────────────

const FEATURE_TYPES: Array<{ type: ForgeFeatureType; label: string; description: string }> = [
  { type: "control_room", label: "Control Room", description: "Triage, plan, and execute under pressure" },
  { type: "proof_builder", label: "Proof Builder", description: "Collect and score application evidence" },
  { type: "drill_lab", label: "Drill Lab", description: "Practise with AI opposition and scoring" },
  { type: "tracker", label: "Signal Tracker", description: "Log and analyse real progress signals" },
  { type: "planner", label: "Planner", description: "Turn goals into structured execution plans" },
  { type: "simulator", label: "Simulator", description: "Run controlled practice simulations" },
  { type: "coach_lens", label: "Coach Lens", description: "Get strategic coaching on your approach" },
  { type: "research_helper", label: "Research Helper", description: "Find, organise, and synthesise information" },
  { type: "decision_engine", label: "Decision Engine", description: "Rank options and choose the best next move" },
  { type: "protocol", label: "Protocol", description: "Run a structured step-by-step protocol" },
  { type: "custom", label: "Custom", description: "Describe anything — Forge will build it" },
];

// ─── Guidebook preview card ───────────────────────────────────────────────────

function GuidebookPreview({
  guidebook,
  onActivate,
  onDiscard,
  loading,
}: {
  guidebook: Partial<ForgeGuidebook>;
  onActivate: () => void;
  onDiscard: () => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-card overflow-hidden">
      <div className="border-b border-border/60 bg-primary/5 px-5 py-3 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium text-primary">Guidebook preview</span>
      </div>
      <div className="p-5 space-y-4">
        {guidebook.title && (
          <div>
            <h3 className="text-lg font-semibold">{guidebook.title}</h3>
            {guidebook.subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{guidebook.subtitle}</p>}
          </div>
        )}

        {guidebook.purpose && (
          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Purpose</div>
            <p className="text-sm text-foreground">{guidebook.purpose}</p>
          </div>
        )}

        {/* What this feature creates */}
        <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
            This feature will create
          </div>
          <div className="grid grid-cols-2 gap-2">
            {guidebook.required_inputs && guidebook.required_inputs.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{guidebook.required_inputs.length} input field{guidebook.required_inputs.length !== 1 ? "s" : ""}</span>
              </div>
            )}
            {guidebook.ai_functions && guidebook.ai_functions.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{guidebook.ai_functions.length} AI function{guidebook.ai_functions.length !== 1 ? "s" : ""}</span>
              </div>
            )}
            {guidebook.sections && guidebook.sections.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{guidebook.sections.length} page section{guidebook.sections.length !== 1 ? "s" : ""}</span>
              </div>
            )}
            {guidebook.state_writes && guidebook.state_writes.filter((w) => w.action === "task/create").length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Today task output</span>
              </div>
            )}
            {guidebook.audit_hooks && guidebook.audit_hooks.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{guidebook.audit_hooks.length} audit signal{guidebook.audit_hooks.length !== 1 ? "s" : ""}</span>
              </div>
            )}
            {guidebook.route_slug && (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="font-mono text-muted-foreground">/forge/{guidebook.route_slug}</span>
              </div>
            )}
          </div>
        </div>

        {/* AI functions preview */}
        {guidebook.ai_functions && guidebook.ai_functions.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">AI functions</div>
            <div className="space-y-1.5">
              {guidebook.ai_functions.map((fn) => (
                <div key={fn.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <Zap className="h-3 w-3 shrink-0 text-primary" />
                  <span className="text-xs font-medium">{fn.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{fn.function_type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety */}
        {guidebook.safety_rules && guidebook.safety_rules.length > 0 && (
          <div className="rounded-xl bg-secondary/50 px-3 py-2">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Safety</div>
            <ul className="space-y-0.5">
              {guidebook.safety_rules.map((rule, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-border" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between pt-1">
          <button
            onClick={onDiscard}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Discard
          </button>
          <button
            onClick={onActivate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Launch feature
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Active guidebook card ────────────────────────────────────────────────────

function GuidebookCard({ guidebook, runCount, signalCount }: {
  guidebook: ForgeGuidebook;
  runCount: number;
  signalCount: number;
}) {
  const dispatch = useStateStore((s) => s.dispatch);

  const statusDot: Record<string, string> = {
    active: "bg-emerald-500",
    paused: "bg-amber-500",
    draft: "bg-muted-foreground",
    archived: "bg-muted-foreground/50",
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[guidebook.status] ?? "bg-muted-foreground"}`} />
            <span className="text-sm font-medium">{guidebook.title}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              {FEATURE_TYPE_LABELS[guidebook.feature_type]}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{guidebook.purpose}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {runCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Activity className="h-3 w-3" /> {runCount} run{runCount !== 1 ? "s" : ""}
              </span>
            )}
            {signalCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <BarChart2 className="h-3 w-3" /> {signalCount} signal{signalCount !== 1 ? "s" : ""}
              </span>
            )}
            {guidebook.last_used_at && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />{" "}
                {new Date(guidebook.last_used_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {guidebook.status === "active" && (
            <button
              onClick={() => dispatch({ type: "forge/pause_guidebook", payload: { id: guidebook.id } })}
              className="p-1.5 text-muted-foreground hover:text-foreground"
              title="Pause"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          )}
          {guidebook.status === "paused" && (
            <button
              onClick={() => dispatch({ type: "forge/activate_guidebook", payload: { id: guidebook.id } })}
              className="p-1.5 text-muted-foreground hover:text-foreground"
              title="Resume"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => dispatch({ type: "forge/archive_guidebook", payload: { id: guidebook.id } })}
            className="p-1.5 text-muted-foreground hover:text-foreground"
            title="Archive"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-2.5">
        <Link
          to={`/app/forge/${guidebook.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Play className="h-3 w-3" /> Open feature
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── System gap card ──────────────────────────────────────────────────────────

function SystemGapCard({
  gap,
  onBuild,
}: {
  gap: ReturnType<typeof detectSystemGap>;
  onBuild: (type: ForgeFeatureType) => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">{gap.bottleneck}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{gap.reason}</p>
        </div>
      </div>
      <button
        onClick={() => onBuild(gap.suggested_feature_type)}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-500/20"
      >
        <Hammer className="h-3 w-3" /> Build around this
      </button>
    </div>
  );
}

// ─── Forge builder flow ───────────────────────────────────────────────────────

type BuildStep = "type_select" | "question" | "ai_generating" | "preview";

function ForgeBuilderFlow({
  onCancel,
  preselectedType,
  systemQuestion,
}: {
  onCancel: () => void;
  preselectedType?: ForgeFeatureType;
  systemQuestion?: string;
}) {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const ai = useAI<Partial<ForgeGuidebook>>("forge_guidebook");

  const [step, setStep] = useState<BuildStep>(preselectedType ? "question" : "type_select");
  const [selectedType, setSelectedType] = useState<ForgeFeatureType | null>(preselectedType ?? null);
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<Partial<ForgeGuidebook> | null>(null);
  const [activating, setActivating] = useState(false);

  const question =
    systemQuestion ??
    (selectedType
      ? `Tell me what you need: what problem should the ${FEATURE_TYPE_LABELS[selectedType]} solve for your goal?`
      : "Describe the system you need. What problem should it solve?");

  const handleTypeSelect = (type: ForgeFeatureType) => {
    setSelectedType(type);
    setStep("question");
  };

  const handleGenerate = async () => {
    if (!description.trim() || !state) return;
    setStep("ai_generating");

    const lp = state.learning_profile;
    const result = await ai.run({
      feature_type: selectedType,
      description,
      goal: state.active_goal?.statement,
      bottleneck: state.pursuit_model?.workstreams?.find((w) => w.bottleneck)?.bottleneck,
      // Learning profile biases the generated guidebook complexity and task sizes
      ...(lp ? {
        preferred_task_size: lp.preferred_task_size,
        friction_tags: lp.friction_tags.slice(0, 3).map((f) => f.tag),
        adaptation_rules: lp.adaptation_rules.slice(0, 3).map((r) => r.rule),
      } : {}),
    });

    if (result && Object.keys(result).length > 0) {
      const parsed = parseAIGuidebookResponse(result as Record<string, unknown>, state!);
      setDraft(parsed);
    } else {
      // Fallback to template
      const template = buildTemplateGuidebook(selectedType ?? "custom", state.active_goal?.statement ?? "");
      setDraft(template);
    }
    setStep("preview");
  };

  const handleActivate = () => {
    if (!draft || !state) return;
    setActivating(true);
    const guidebook: ForgeGuidebook = {
      ...(draft as ForgeGuidebook),
      status: "active",
      updated_at: new Date().toISOString(),
    };
    dispatch({ type: "forge/create_guidebook", payload: guidebook });
    logLearningSignal(dispatch, {
      signal_type: "forge_feature_created",
      source_surface: "forge",
      forge_feature_id: guidebook.id,
      metadata: {
        feature_type: guidebook.feature_type,
        hour_of_day: new Date().getHours(),
      },
      privacy_level: "private",
    });
    setActivating(false);
    onCancel(); // Return to main forge view
  };

  const handleDiscard = () => {
    setDraft(null);
    setStep("type_select");
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-primary/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <Hammer className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Forge a feature</span>
          {selectedType && step !== "type_select" && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{FEATURE_TYPE_LABELS[selectedType]}</span>
            </>
          )}
        </div>
        <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-5">
        {/* Step 1: Type selection */}
        {step === "type_select" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              What kind of feature do you need? Pick the closest match — Forge will tailor it to your goal.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FEATURE_TYPES.map((ft) => (
                <button
                  key={ft.type}
                  onClick={() => handleTypeSelect(ft.type)}
                  className="flex flex-col items-start rounded-xl border border-border bg-background p-3 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <span className="text-sm font-medium">{ft.label}</span>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">{ft.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Sharp question */}
        {step === "question" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-background/50 px-4 py-3">
              <p className="text-sm font-medium">{question}</p>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Be specific. The more context you give, the better the feature will be."
              rows={4}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              autoFocus
            />
            <div className="flex justify-between">
              <button
                onClick={() => setStep("type_select")}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back
              </button>
              <button
                disabled={!description.trim() || ai.loading}
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate Guidebook
              </button>
            </div>
            {ai.error && <p className="text-xs text-destructive">{ai.error}</p>}
          </div>
        )}

        {/* Step 3: AI generating */}
        {step === "ai_generating" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Building your Guidebook…</p>
            <p className="text-xs text-muted-foreground/70">Designing inputs, AI functions, sections, and state connections</p>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === "preview" && draft && (
          <GuidebookPreview
            guidebook={draft}
            onActivate={handleActivate}
            onDiscard={handleDiscard}
            loading={activating}
          />
        )}
      </div>
    </div>
  );
}

// ─── Legacy module container (kept for backward compatibility) ────────────────

function ModuleContainer({ mod: m }: { mod: GeneratedModuleManifest }) {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [launched, setLaunched] = useState(false);

  const logEntry = (data: Record<string, unknown>, note?: string) => {
    const entry: ModuleEntry = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      data,
      note,
    };
    dispatch({ type: "forge/log_entry", payload: { module_id: m.id, entry } });
  };

  const runCount = (m.entries ?? []).length;

  if (launched) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60">
          <button onClick={() => setLaunched(false)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
            <span className="truncate">{m.title}</span>
          </button>
          {runCount > 0 && (
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {runCount} {runCount === 1 ? "run" : "runs"}
            </span>
          )}
        </div>
        <div className="p-4">
          <ModuleEngine module={m} logEntry={logEntry} state={state ?? undefined} dispatch={dispatch} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <button onClick={() => setLaunched(true)} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{m.title}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
              {m.module_type.replace("_", " ")}
            </span>
            <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground">legacy</span>
            {runCount > 0 && (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500">
                {runCount} run{runCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
            <Play className="h-3 w-3" /> Launch
          </div>
        </button>
        <button
          onClick={() => dispatch({ type: "forge/archive_module", payload: { id: m.id } })}
          className="p-1.5 text-muted-foreground hover:text-foreground shrink-0"
          title="Archive"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Forge page ──────────────────────────────────────────────────────────

const Forge = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [building, setBuilding] = useState(false);
  const [preselectedType, setPreselectedType] = useState<ForgeFeatureType | undefined>(undefined);
  const [systemQuestion, setSystemQuestion] = useState<string | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  const vm = getForgeViewModel(state)!;

  const activeGuidebooks = vm.guidebooks.filter((g) => g.status === "active");
  const pausedGuidebooks = vm.guidebooks.filter((g) => g.status === "paused");
  const archivedGuidebooks = vm.guidebooks.filter((g) => g.status === "archived");
  const activeModules = vm.modules.filter((m) => m.status === "active");

  const gap = vm.system_gap;

  const handleBuildAroundGap = (type: ForgeFeatureType) => {
    setPreselectedType(type);
    setSystemQuestion(gap.suggested_question);
    setBuilding(true);
  };

  const runs = vm.feature_runs;
  const signals = vm.forge_signals;
  const getRunCount = (id: string) => runs.filter((r) => r.feature_id === id).length;
  const getSignalCount = (id: string) => signals.filter((s) => s.feature_id === id).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="text-xs text-muted-foreground">/ forge</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Forge</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build custom AI systems around your goal. Describe what you need — Forge creates a full feature page with AI functions, inputs, and state connections.
        </p>
      </div>

      {/* System Gap Card */}
      {!building && gap && (
        <SystemGapCard gap={gap} onBuild={handleBuildAroundGap} />
      )}

      {/* Forge builder flow */}
      {building && (
        <ForgeBuilderFlow
          onCancel={() => { setBuilding(false); setPreselectedType(undefined); setSystemQuestion(undefined); }}
          preselectedType={preselectedType}
          systemQuestion={systemQuestion}
        />
      )}

      {/* Main CTA — when not building */}
      {!building && (
        <button
          onClick={() => { setPreselectedType(undefined); setSystemQuestion(undefined); setBuilding(true); }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Forge a feature
        </button>
      )}

      {/* Active guidebook features */}
      {activeGuidebooks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active features · {activeGuidebooks.length}
          </div>
          {activeGuidebooks.map((g) => (
            <GuidebookCard
              key={g.id}
              guidebook={g}
              runCount={getRunCount(g.id)}
              signalCount={getSignalCount(g.id)}
            />
          ))}
        </section>
      )}

      {/* Paused features */}
      {pausedGuidebooks.length > 0 && (
        <section className="space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Paused · {pausedGuidebooks.length}
          </div>
          {pausedGuidebooks.map((g) => (
            <GuidebookCard
              key={g.id}
              guidebook={g}
              runCount={getRunCount(g.id)}
              signalCount={getSignalCount(g.id)}
            />
          ))}
        </section>
      )}

      {/* Legacy modules */}
      {activeModules.length > 0 && (
        <section className="space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Legacy modules · {activeModules.length}
          </div>
          {activeModules.map((m) => (
            <ModuleContainer key={m.id} mod={m} />
          ))}
        </section>
      )}

      {/* Archived toggle */}
      {archivedGuidebooks.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Archive className="h-3 w-3" />
            {showArchived ? "Hide" : "Show"} archived ({archivedGuidebooks.length})
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2 opacity-60">
              {archivedGuidebooks.map((g) => (
                <GuidebookCard
                  key={g.id}
                  guidebook={g}
                  runCount={getRunCount(g.id)}
                  signalCount={getSignalCount(g.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!building && activeGuidebooks.length === 0 && pausedGuidebooks.length === 0 && activeModules.length === 0 && (
        <section className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <Hammer className="mx-auto h-6 w-6 text-primary" />
          <div>
            <h2 className="text-base font-semibold">No features yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Forge can build almost any goal-related system. Describe what you need and it will create a full AI-powered feature page.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {["proof_builder", "control_room", "drill_lab"].map((type) => {
              const ft = FEATURE_TYPES.find((f) => f.type === type)!;
              return (
                <button
                  key={type}
                  onClick={() => { setPreselectedType(type as ForgeFeatureType); setBuilding(true); }}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                >
                  {ft.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Forge stat strip — shown when there are active features */}
      {(activeGuidebooks.length > 0 || runs.length > 0) && (
        <div className="rounded-xl border border-border/50 bg-card/50 px-4 py-3">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Active features</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{activeGuidebooks.length}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Total runs</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{runs.length}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Signals logged</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">{signals.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* Legacy interview flow — only shown when in that flow */}
      {vm.status === "interviewing" && !building && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs text-amber-600">
            You have an in-progress legacy interview. It has been superseded by the new Forge flow above. You can{" "}
            <button onClick={() => dispatch({ type: "forge/reset" })} className="underline">reset it</button>.
          </p>
        </section>
      )}
    </div>
  );
};

export default Forge;
