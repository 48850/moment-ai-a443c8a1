import { Mote } from "@/components/app/Mote";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { buildContextPacket } from "@/lib/ai/context-packet";
import { buildContextualForgeSuggestions, HeartbeatBanner } from "@/components/app/HeartbeatBanner";
import { buildContextSnapshot } from "@/lib/coach/context-snapshot";
import {
  Hammer, Sparkles, Loader2, Plus, Archive, Pencil, Play,
  X, ChevronRight, Zap, Target, Clock, BarChart2, Activity,
  Check, AlertCircle, BookOpen, Eye, Pause, RotateCcw,
  CheckCircle2, ArrowRight,
} from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { getForgeViewModel } from "@/lib/selectors/forge";
import { useAI } from "@/lib/ai/useAI";
import { ModuleEngine } from "@/components/app/forge/engines";
import {
  buildTemplateGuidebook,
  parseAIGuidebookResponse,
  FEATURE_TYPE_LABELS,
  detectSystemGap,
  validateGuidebook,
  generateCustomGuidebookViaAI,
} from "@/lib/forge/guidebook";
import type {
  FeatureCandidate,
  GeneratedModuleManifest,
  ModuleEntry,
  ForgeGuidebook,
  ForgeFeatureType,
  GuidebookInput,
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

type BuildStep = "type_select" | "question" | "candidates_generating" | "pick_candidate" | "ai_generating" | "preview";

interface CandidateOption {
  title: string;
  feature_type: ForgeFeatureType;
  purpose: string;
  why_this_one: string;
  inputs: Array<{ id: string; label: string; type: string; required: boolean; placeholder?: string }>;
  first_run_example: string;
  creates: string[];
}

const GENERIC_TITLES = new Set([
  "custom feature", "analyser", "analyzer", "ai analysis",
  "goal helper", "your own ai-powered system", "feature",
]);

function ForgeBuilderFlow({
  onCancel,
  preselectedType,
  systemQuestion,
  prefilledDescription,
}: {
  onCancel: () => void;
  preselectedType?: ForgeFeatureType;
  systemQuestion?: string;
  prefilledDescription?: string;
}) {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const ai = useAI<Partial<ForgeGuidebook>>("forge_guidebook");

  const [step, setStep] = useState<BuildStep>(preselectedType ? "question" : "type_select");
  const [selectedType, setSelectedType] = useState<ForgeFeatureType | null>(preselectedType ?? null);
  const [description, setDescription] = useState(prefilledDescription ?? "");
  const [draft, setDraft] = useState<Partial<ForgeGuidebook> | null>(null);
  const [activating, setActivating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);

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
    setValidationErrors([]);

    // Custom features go through a dedicated AI generation + validation path.
    if (selectedType === "custom" || !selectedType) {
      try {
        const { guidebook, validation } = await generateCustomGuidebookViaAI(state, description);
        if (validation.ok) {
          setDraft(guidebook);
          setValidationErrors([]);
        } else {
          // Show errors and offer the template fallback
          setValidationErrors(validation.reasons);
          setDraft(guidebook); // show it anyway so user can see what was generated
        }
        setStep("preview");
      } catch {
        // Fall back to static template on network failure
        const template = buildTemplateGuidebook("custom", state.active_goal?.statement ?? "");
        setDraft(template);
        setValidationErrors(["AI generation failed — using the generic template. It will be less specific to your goal."]);
        setStep("preview");
      }
      return;
    }

    const result = await ai.run({
      feature_type: selectedType,
      description,
      goal: state.active_goal?.statement,
      bottleneck: state.pursuit_model?.workstreams?.find((w) => w.bottleneck)?.bottleneck,
    });

    if (result && Object.keys(result).length > 0) {
      const parsed = parseAIGuidebookResponse(result as Record<string, unknown>, state!);
      const validation = validateGuidebook(parsed);
      setDraft(parsed);
      setValidationErrors(validation.ok ? [] : validation.reasons);
    } else {
      // Fallback to template
      const template = buildTemplateGuidebook(selectedType, state.active_goal?.statement ?? "");
      setDraft(template);
    }
    setStep("preview");
  };

  const handleGenerateCandidates = async () => {
    if (!description.trim() || !state) return;
    setStep("candidates_generating");
    setValidationErrors([]);
    try {
      const { data } = await supabase.functions.invoke("app-intelligence", {
        body: {
          intent: "forge_guidebook_candidates",
          snapshot: buildContextPacket(state),
          payload: { description, feature_type: selectedType ?? "custom" },
        },
      });
      const raw = data?.result;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const list: CandidateOption[] = parsed?.candidates ?? [];
      if (list.length >= 1) {
        setCandidates(list);
        setStep("pick_candidate");
      } else {
        await handleGenerate();
      }
    } catch {
      await handleGenerate();
    }
  };

  const handleGenerateFromCandidate = async (candidate: CandidateOption) => {
    if (!state) return;
    setStep("ai_generating");
    setValidationErrors([]);
    const seededDescription = `${candidate.title}: ${candidate.purpose}`;
    try {
      const { guidebook, validation } = await generateCustomGuidebookViaAI(state, seededDescription);
      // Preserve candidate identity — override generic AI output
      if (GENERIC_TITLES.has(guidebook.title.toLowerCase().trim())) {
        guidebook.title = candidate.title;
      }
      if (!guidebook.purpose?.trim()) guidebook.purpose = candidate.purpose;
      if (!guidebook.bottleneck_addressed) guidebook.bottleneck_addressed = candidate.why_this_one;
      // Preserve candidate inputs if AI returned fewer
      if ((guidebook.required_inputs?.length ?? 0) < candidate.inputs.length) {
        guidebook.required_inputs = candidate.inputs.map((inp) => ({
          id: inp.id,
          label: inp.label,
          type: inp.type as GuidebookInput["type"],
          placeholder: inp.placeholder ?? "",
          required: inp.required,
        }));
      }
      setDraft(guidebook);
      setValidationErrors(validation.ok ? [] : validation.reasons);
      setStep("preview");
    } catch {
      // Hard fallback: use candidate fields directly to build a minimal guidebook
      const template = buildTemplateGuidebook("custom", state.active_goal?.statement ?? "");
      template.title = candidate.title;
      template.purpose = candidate.purpose;
      template.bottleneck_addressed = candidate.why_this_one;
      if (candidate.inputs.length > 0) {
        template.required_inputs = candidate.inputs.map((inp) => ({
          id: inp.id,
          label: inp.label,
          type: inp.type as GuidebookInput["type"],
          placeholder: inp.placeholder ?? "",
          required: inp.required,
        }));
      }
      setDraft(template);
      setValidationErrors(["AI generation failed — built from your selection. You can still use this tool."]);
      setStep("preview");
    }
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
          <span className="text-xs font-medium text-primary">Forge a tool</span>
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
            <button
              onClick={() => {
                const pickable = FEATURE_TYPES.filter((f) => f.type !== "custom");
                const pick = pickable[Math.floor(Math.random() * pickable.length)];
                const bottleneck = state?.pursuit_model?.workstreams?.find((w) => w.bottleneck)?.bottleneck;
                const goal = state?.active_goal?.statement;
                const auto = `Surprise me — build the most useful ${pick.label} for my current pursuit${
                  goal ? ` ("${goal}")` : ""
                }${bottleneck ? `. Focus on this bottleneck: ${bottleneck}` : ""}. Pick the sharpest angle.`;
                setSelectedType(pick.type);
                setDescription(auto);
                setStep("question");
              }}
              className="group flex w-full items-center justify-between rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 text-left hover:border-primary/60 hover:from-primary/20 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>
                  <span className="block text-sm font-medium">Surprise me</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Let Forge pick the feature type and draft it from your goal & bottleneck.
                  </span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </button>
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
                onClick={selectedType === "custom" || !selectedType ? handleGenerateCandidates : handleGenerate}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {selectedType === "custom" || !selectedType ? "Find tool options" : "Generate tool"}
              </button>
            </div>
            {ai.error && <p className="text-xs text-destructive">{ai.error}</p>}
          </div>
        )}

        {/* Step 2.5a: Finding candidates */}
        {step === "candidates_generating" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Finding the right tools for your goal…</p>
            <p className="text-xs text-muted-foreground/70">Generating three specific options based on your context</p>
          </div>
        )}

        {/* Step 2.5b: Pick a candidate */}
        {step === "pick_candidate" && candidates.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Pick the tool that fits best</p>
              <p className="text-xs text-muted-foreground">Three options specific to your goal. Choose one to build it.</p>
            </div>
            <div className="space-y-3">
              {candidates.map((c) => (
                <button
                  key={c.title}
                  onClick={() => handleGenerateFromCandidate(c)}
                  className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-primary/40 transition-colors space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-primary">
                      {c.feature_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-foreground">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.purpose}</div>
                  {c.why_this_one && (
                    <div className="text-[11px] text-muted-foreground/70 italic">{c.why_this_one}</div>
                  )}
                  {c.first_run_example && (
                    <div className="mt-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground/70">First run: </span>
                      {c.first_run_example}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep("question")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Describe differently
            </button>
          </div>
        )}

        {/* Step 3: AI generating tool from candidate */}
        {step === "ai_generating" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Building your tool…</p>
            <p className="text-xs text-muted-foreground/70">Designing inputs, AI functions, sections, and state connections</p>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === "preview" && draft && (
          <div className="space-y-3">
            {validationErrors.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="mb-1 text-xs font-medium text-amber-400">AI generated a partial result:</p>
                <ul className="space-y-0.5">
                  {validationErrors.map((e, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-300/80">
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <GuidebookPreview
              guidebook={draft}
              onActivate={handleActivate}
              onDiscard={handleDiscard}
              loading={activating}
            />
          </div>
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
  const [searchParams] = useSearchParams();
  const [building, setBuilding] = useState(false);
  const [preselectedType, setPreselectedType] = useState<ForgeFeatureType | undefined>(undefined);
  const [systemQuestion, setSystemQuestion] = useState<string | undefined>(undefined);
  const [prefilledDescription, setPrefilledDescription] = useState<string | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);

  // Auto-open builder when ?rebuild= param is present (from ForgeFeature recovery screen)
  useEffect(() => {
    const rebuild = searchParams.get("rebuild");
    if (rebuild && !building) {
      setPreselectedType("custom");
      setPrefilledDescription(decodeURIComponent(rebuild));
      setSystemQuestion(undefined);
      setBuilding(true);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  const vm = getForgeViewModel(state)!;

  const activeGuidebooks = vm.guidebooks.filter((g) => g.status === "active");
  const pausedGuidebooks = vm.guidebooks.filter((g) => g.status === "paused");
  const archivedGuidebooks = vm.guidebooks.filter((g) => g.status === "archived");
  const activeModules = vm.modules.filter((m) => m.status === "active");

  const gap = vm.system_gap;

  // Context-aware suggestions — powered by the shared ContextSnapshot
  const contextSnap = useMemo(() => buildContextSnapshot(state, ""), [state]);
  const existingActiveTypes = useMemo(
    () => new Set(activeGuidebooks.map((g) => g.feature_type as string)),
    [activeGuidebooks],
  );
  const contextualSuggestions = useMemo(
    () => buildContextualForgeSuggestions(contextSnap, existingActiveTypes),
    [contextSnap, existingActiveTypes],
  );

  const handleBuildAroundGap = (type: ForgeFeatureType) => {
    setPreselectedType(type);
    setSystemQuestion(gap.suggested_question);
    setPrefilledDescription(undefined);
    setBuilding(true);
  };

  const handleBuildRecommendation = (type: ForgeFeatureType, descriptionHint: string) => {
    setPreselectedType(type);
    setSystemQuestion(undefined);
    setPrefilledDescription(descriptionHint);
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
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight"><Mote size={56} bounce mood="celebrate" />Forge</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build small, runnable tools for your goal. Describe what you want help with — Moment generates three specific options, you pick one.
        </p>
      </div>


      </div>

      {/* Heartbeat — shared context pulse */}
      <HeartbeatBanner />

      {/* Contextual suggestions — based on user's current situation */}
      {!building && contextualSuggestions.length > 0 && (
        <section>
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            for your situation right now
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {contextualSuggestions.map((s) => (
              <div
                key={s.title}
                className={`rounded-xl border bg-card p-4 flex flex-col gap-2 ${
                  s.urgency === "high" ? "border-amber-500/40" : "border-border"
                }`}
              >
                {s.urgency === "high" && (
                  <div className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    urgent
                  </div>
                )}
                <div className="text-sm font-medium text-foreground">{s.title}</div>
                <div className="text-xs text-muted-foreground flex-1">{s.why}</div>
                <button
                  onClick={() => handleBuildRecommendation(s.feature_type as ForgeFeatureType, s.description_hint)}
                  className={`mt-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    s.urgency === "high"
                      ? "border-amber-500/40 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10"
                      : "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
                  }`}
                >
                  Build this
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!building && gap && (
        <SystemGapCard gap={gap} onBuild={handleBuildAroundGap} />
      )}

      {/* Recommended tools for goal */}
      {!building && gap.recommendations.length > 0 && (
        <section>
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Recommended for your path right now
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {gap.recommendations.map((rec) => (
              <div key={rec.title} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
                <div className="text-sm font-medium text-foreground">{rec.title}</div>
                <div className="text-xs text-muted-foreground flex-1">{rec.why}</div>
                <div className="text-[10px] text-muted-foreground/60 italic">{rec.triggered_by}</div>
                <button
                  onClick={() => handleBuildRecommendation(rec.feature_type, rec.description_hint)}
                  className="mt-1 rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Build this
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Forge builder flow */}
      {building && (
        <ForgeBuilderFlow
          onCancel={() => { setBuilding(false); setPreselectedType(undefined); setSystemQuestion(undefined); setPrefilledDescription(undefined); }}
          preselectedType={preselectedType}
          systemQuestion={systemQuestion}
          prefilledDescription={prefilledDescription}
        />
      )}

      {/* Main CTA — when not building */}
      {!building && (
        <button
          onClick={() => { setPreselectedType(undefined); setSystemQuestion(undefined); setBuilding(true); }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Forge a tool
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
