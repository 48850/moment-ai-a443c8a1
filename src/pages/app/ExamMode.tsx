import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronUp,
  Clock, MessageSquare, Zap, ArrowRight, Plus,
} from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { Mote } from "@/components/app/Mote";
import { buildExamEmergencyFromIntake } from "@/lib/exam/build-exam-emergency";
import type { ExamEmergency, StudyBlock } from "@/lib/types";
import type { ExamBlockFeedbackResult, TargetOutcome } from "@/lib/types/exam-emergency";
import type { ForgeFeatureType } from "@/lib/types";

// ── Study block row ───────────────────────────────────────────────────────────

const METHOD_LABEL: Record<string, string> = {
  active_recall: "recall",
  practice_questions: "practice",
  summary: "summary",
  flashcards: "flashcards",
  essay_plan: "essay plan",
  formula_drill: "formula drill",
};

const FEEDBACK_OPTIONS: Array<{ result: ExamBlockFeedbackResult; label: string }> = [
  { result: "completed", label: "Done ✓" },
  { result: "easy", label: "Easy" },
  { result: "hard", label: "Hard" },
  { result: "confused", label: "Confused" },
  { result: "avoided", label: "Avoided" },
  { result: "too_long", label: "Too long" },
];

function BlockRow({
  block,
  isFirst,
  completedIds,
  onFeedback,
}: {
  block: StudyBlock;
  isFirst?: boolean;
  completedIds: Set<string>;
  onFeedback: (blockId: string, result: ExamBlockFeedbackResult) => void;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const done = completedIds.has(block.id);

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 space-y-1.5 ${
        isFirst
          ? "border-amber-500/40 bg-amber-500/5"
          : done
          ? "border-emerald-500/20 bg-emerald-500/5 opacity-60"
          : "border-border bg-card/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isFirst && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-0.5">
              First 20 minutes
            </p>
          )}
          <div className="flex items-center gap-1.5">
            {done && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
            <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {block.title}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{block.goal}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {block.duration_minutes}m
          <span className="px-1.5 py-0.5 rounded-full bg-muted/40">
            {METHOD_LABEL[block.method] ?? block.method}
          </span>
        </div>
      </div>

      {!done && (
        <button
          onClick={() => setShowFeedback((v) => !v)}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Mark progress {showFeedback ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        </button>
      )}

      {showFeedback && !done && (
        <div className="flex flex-wrap gap-1">
          {FEEDBACK_OPTIONS.map((opt) => (
            <button
              key={opt.result}
              onClick={() => { onFeedback(block.id, opt.result); setShowFeedback(false); }}
              className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted/30 hover:bg-muted/60 text-foreground"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Study tools ───────────────────────────────────────────────────────────────

function StudyTools({ emergency }: { emergency: ExamEmergency }) {
  const subject = emergency.subject;
  const priorityTopics = emergency.topics
    .filter((t) => t.priority === "critical" || t.priority === "high")
    .map((t) => t.name)
    .slice(0, 3)
    .join(", ") || subject;
  const weakTopics = emergency.topics
    .filter((t) => t.confidence <= 2)
    .map((t) => t.name)
    .slice(0, 3)
    .join(", ");

  const tools: Array<{ title: string; desc: string; type: ForgeFeatureType; hint: string }> = [
    {
      title: "Practice Quiz",
      desc: `10 questions on ${priorityTopics}`,
      type: "drill_lab",
      hint: `Build a 10-question practice quiz for ${subject} focusing on ${priorityTopics}. Include model answers.`,
    },
    {
      title: "Flashcard Set",
      desc: `Key concepts · ${priorityTopics}`,
      type: "tracker",
      hint: `Create a flashcard set for ${subject} covering: ${priorityTopics}. Term on one side, clear explanation on the other.`,
    },
    {
      title: "Essay Plan",
      desc: `Structured plans for ${subject}`,
      type: "protocol",
      hint: `Build an essay plan template for ${subject} exam questions with intro, body, conclusion formula and worked examples.`,
    },
    {
      title: "Formula Drill",
      desc: `Methods & formulas for ${subject}`,
      type: "drill_lab",
      hint: `Create a formula and method drill for ${subject} with all key formulas, worked examples, and a self-test checklist.`,
    },
    ...(weakTopics
      ? [{
          title: "Weak Topic Drill",
          desc: `Extra practice · ${weakTopics}`,
          type: "drill_lab" as ForgeFeatureType,
          hint: `Build a targeted drill for weak topics in ${subject}: ${weakTopics}. Start with fundamentals, then increase difficulty.`,
        }]
      : []),
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        <Zap className="h-3 w-3" /> build a study tool
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tools.slice(0, 5).map((tool) => (
          <Link
            key={tool.title}
            to={`/app/forge?rebuild=${encodeURIComponent(tool.hint)}`}
            className="rounded-xl border border-border bg-card p-3 flex items-start justify-between gap-2 hover:border-primary/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{tool.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{tool.desc}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Reflection form ───────────────────────────────────────────────────────────

const REFLECTION_OPTIONS = ["easy", "okay", "hard", "very_hard"] as const;

function ReflectionForm({ emergency, dispatch }: { emergency: ExamEmergency; dispatch: (a: unknown) => void }) {
  const [surprise, setSurprise] = useState("");
  const [nextTime, setNextTime] = useState("");

  const submit = (result: string) => {
    dispatch({
      type: "exam/update",
      payload: {
        id: emergency.id,
        changes: {
          status: "completed",
          reflection: {
            result: result as "easy" | "okay" | "hard" | "very_hard",
            surprise: surprise || undefined,
            next_time: nextTime || undefined,
            created_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
      },
    } as any);
  };

  if (emergency.reflection?.result) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-medium">Reflection saved</p>
        <p className="text-sm text-foreground">Felt: {emergency.reflection.result.replace(/_/g, " ")}</p>
        {emergency.reflection.surprise && (
          <p className="text-xs text-muted-foreground">Surprised by: {emergency.reflection.surprise}</p>
        )}
        {emergency.reflection.next_time && (
          <p className="text-xs text-muted-foreground">Next time: {emergency.reflection.next_time}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">How did the exam go?</p>
      <div className="flex flex-wrap gap-1.5">
        {REFLECTION_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => submit(r)}
            className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground hover:border-primary hover:text-primary"
          >
            {r.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      <input
        value={surprise}
        onChange={(e) => setSurprise(e.target.value)}
        placeholder="What surprised you? (optional)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <input
        value={nextTime}
        onChange={(e) => setNextTime(e.target.value)}
        placeholder="What will you do differently next time? (optional)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
    </div>
  );
}

// ── Quick intake form ─────────────────────────────────────────────────────────

const TIME_OPTIONS: Array<{ label: string; offsetHours: number }> = [
  { label: "In 1–2 hours", offsetHours: 1.5 },
  { label: "Tonight", offsetHours: 5 },
  { label: "Tomorrow morning", offsetHours: 16 },
  { label: "Tomorrow afternoon", offsetHours: 22 },
  { label: "In 2 days", offsetHours: 48 },
  { label: "This week", offsetHours: 96 },
];

const STUDY_HOURS_OPTIONS = [1, 2, 3, 4] as const;

const OUTCOME_OPTIONS: Array<{ value: TargetOutcome; label: string; desc: string }> = [
  { value: "survive", label: "Survive", desc: "Pass with what I have" },
  { value: "solid", label: "Solid", desc: "Good result with focused prep" },
  { value: "high_score", label: "High score", desc: "Everything I can get" },
];

function QuickIntakeForm({ onCreated }: { onCreated: () => void }) {
  const dispatch = useStateStore((s) => s.dispatch);
  const [subject, setSubject] = useState("");
  const [timeOffset, setTimeOffset] = useState<number>(16);
  const [topicsRaw, setTopicsRaw] = useState("");
  const [studyHours, setStudyHours] = useState<number>(2);
  const [preparedness, setPreparedness] = useState<number>(3);
  const [targetOutcome, setTargetOutcome] = useState<TargetOutcome>("solid");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) { setError("Subject is required"); return; }

    const examDateTime = new Date(Date.now() + timeOffset * 3_600_000).toISOString();

    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const endHour = Math.min(now.getHours() + studyHours, 23);
    const endTime = `${String(endHour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const topics = topicsRaw
      .split(/[\n,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

    const emergency = buildExamEmergencyFromIntake({
      action: "ready_to_build",
      subject: subject.trim(),
      exam_date_time: examDateTime,
      preparedness_score: preparedness,
      target_outcome: targetOutcome,
      topics: topics.length > 0 ? topics : undefined,
      available_study_windows: [
        { start_time: startTime, end_time: endTime, day_label: "Today", available_minutes: studyHours * 60 },
      ],
    });

    dispatch({ type: "exam/create", payload: emergency } as any);
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Subject */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Subject</label>
        <input
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setError(null); }}
          placeholder="e.g. Maths, Biology, History…"
          className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          autoFocus
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* When is the exam */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">When is the exam?</label>
        <div className="flex flex-wrap gap-1.5">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.offsetHours}
              type="button"
              onClick={() => setTimeOffset(opt.offsetHours)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                timeOffset === opt.offsetHours
                  ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topics */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Topics <span className="normal-case text-muted-foreground/60">(optional — one per line or comma-separated)</span>
        </label>
        <textarea
          value={topicsRaw}
          onChange={(e) => setTopicsRaw(e.target.value)}
          placeholder={"Algebra\nProbability\nGeometry"}
          rows={3}
          className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
        />
      </div>

      {/* Study time available */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Study time available today</label>
        <div className="flex gap-1.5">
          {STUDY_HOURS_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setStudyHours(h)}
              className={`flex-1 rounded-xl border py-2 text-sm transition-colors ${
                studyHours === h
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {h}h{h === 4 ? "+" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Preparedness + target */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Confidence now <span className="font-normal">{preparedness}/10</span>
          </label>
          <input
            type="range" min={1} max={10} value={preparedness}
            onChange={(e) => setPreparedness(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Goal</label>
          <div className="flex flex-col gap-1">
            {OUTCOME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTargetOutcome(opt.value)}
                className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                  targetOutcome === opt.value
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="block text-[10px] opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-400 transition-colors"
      >
        Build my rescue plan
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExamMode() {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [activeTab, setActiveTab] = useState<"survival" | "recovery" | "stretch">("survival");
  const [showNewForm, setShowNewForm] = useState(false);

  const emergency = (state?.exam_emergencies as ExamEmergency[] | undefined)?.find(
    (e) => e.status === "active" || e.status === "intake" || e.status === "recovering",
  );
  const completed = !emergency
    ? (state?.exam_emergencies as ExamEmergency[] | undefined)?.find((e) => e.status === "completed")
    : undefined;

  const target = emergency ?? completed;

  if (!target || showNewForm) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-400/80">
            <AlertTriangle className="h-3 w-3" /> exam emergency
          </div>
          <h1 className="text-xl font-semibold text-foreground">Build a rescue plan</h1>
          <p className="text-sm text-muted-foreground">
            Fill in what you know. Moment will triage your topics and build a timed study plan in seconds.
          </p>
        </div>
        <QuickIntakeForm onCreated={() => setShowNewForm(false)} />
        {!showNewForm && (
          <p className="text-center text-xs text-muted-foreground">
            Or describe your situation in{" "}
            <Link to="/app/chat" className="text-primary underline">Chat</Link> for a guided intake.
          </p>
        )}
        {showNewForm && (
          <button
            onClick={() => setShowNewForm(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        )}
      </div>
    );
  }

  const hoursUntilExam = Math.max(
    0,
    (new Date(target.exam_date_time).getTime() - Date.now()) / 3_600_000,
  );
  const countdownText =
    hoursUntilExam < 1 ? "< 1h"
    : hoursUntilExam < 24 ? `${Math.round(hoursUntilExam)}h`
    : `${Math.round(hoursUntilExam / 24)}d`;

  const completedIds = new Set(
    target.feedback.filter((f) => f.result === "completed").map((f) => f.block_id),
  );

  const survivalBlocks = target.current_plan.survival_plan;
  const recoveryBlocks = target.current_plan.recovery_plan;
  const stretchBlocks = target.current_plan.stretch_plan;

  const completedSurvival = survivalBlocks.filter((b) => completedIds.has(b.id)).length;
  const progressPct = survivalBlocks.length > 0
    ? Math.round((completedSurvival / survivalBlocks.length) * 100)
    : 0;

  const preparedness = target.preparedness_score ?? 0;
  const showRecovery = preparedness >= 5 && recoveryBlocks.length > 0;
  const showStretch = preparedness >= 7 && stretchBlocks.length > 0;

  const currentBlocks =
    activeTab === "survival" ? survivalBlocks
    : activeTab === "recovery" ? recoveryBlocks
    : stretchBlocks;

  const handleFeedback = (blockId: string, result: ExamBlockFeedbackResult) => {
    dispatch({
      type: "exam/add_feedback",
      payload: {
        emergencyId: target.id,
        feedback: { block_id: blockId, result, created_at: new Date().toISOString() },
      },
    } as any);
  };

  const urgencyBorder = hoursUntilExam < 6
    ? "border-red-500/30"
    : "border-amber-500/20";

  return (
    <div className="mx-auto max-w-xl space-y-6 py-2">
      {/* Header */}
      <section className={`rounded-2xl border ${urgencyBorder} bg-card p-5 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 shrink-0 ${hoursUntilExam < 6 ? "text-red-400" : "text-amber-400"}`} />
            <h1 className="text-lg font-semibold text-foreground">
              {target.subject}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={`text-sm font-medium ${hoursUntilExam < 6 ? "text-red-400" : "text-amber-400"}`}>
                {target.status === "completed" ? "completed" : `${countdownText} remaining`}
              </p>
              {target.preparedness_score && (
                <p className="text-[11px] text-muted-foreground">
                  confidence before: {target.preparedness_score}/10
                </p>
              )}
            </div>
            <button
              onClick={() => setShowNewForm(true)}
              title="New exam plan"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Topics */}
        {target.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {target.topics
              .filter((t) => t.priority !== "ignore_for_now")
              .slice(0, 8)
              .map((t) => {
                const color =
                  t.priority === "critical" ? "bg-red-500/15 text-red-300 border-red-500/30"
                  : t.priority === "high" ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
                  : "bg-muted/30 text-muted-foreground border-border";
                return (
                  <span key={t.id} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${color}`}>
                    {t.name}
                  </span>
                );
              })}
          </div>
        )}

        {/* No plan yet (intake status) */}
        {survivalBlocks.length === 0 && target.status === "intake" && (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              Keep chatting with Moment — once topics and available time are confirmed, your survival plan will appear here.
            </p>
            <Link to="/app/chat" className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <MessageSquare className="h-3 w-3" /> Continue in Chat
            </Link>
          </div>
        )}

        {/* Progress bar */}
        {survivalBlocks.length > 0 && (
          <>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{completedSurvival}/{survivalBlocks.length} survival blocks</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/30">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </>
        )}
      </section>

      {/* Study plan */}
      {survivalBlocks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <BookOpen className="h-3 w-3" /> study plan
          </div>

          {/* Tab switcher */}
          {(showRecovery || showStretch) && (
            <div className="flex gap-1">
              {(["survival", showRecovery && "recovery", showStretch && "stretch"] as const)
                .filter(Boolean)
                .map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as typeof activeTab)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      activeTab === tab
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
            </div>
          )}

          <div className="space-y-2">
            {currentBlocks.map((block, i) => (
              <BlockRow
                key={block.id}
                block={block}
                isFirst={activeTab === "survival" && i === 0}
                completedIds={completedIds}
                onFeedback={handleFeedback}
              />
            ))}
            {currentBlocks.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No blocks in this plan yet.</p>
            )}
          </div>

          {target.status !== "completed" && (
            <button
              onClick={() => dispatch({ type: "exam/complete", payload: { id: target.id } } as any)}
              className="w-full text-[12px] font-medium text-emerald-400 border border-emerald-500/30 rounded-xl py-2.5 hover:bg-emerald-500/10 transition-colors"
            >
              Exam done — reflect
            </button>
          )}
        </section>
      )}

      {/* Post-exam reflection */}
      {target.status === "completed" && (
        <section className="space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            post-exam reflection
          </div>
          <ReflectionForm emergency={target} dispatch={dispatch} />
        </section>
      )}

      {/* Study tools */}
      {target.status !== "completed" && <StudyTools emergency={target} />}

      {/* Chat CTA */}
      <Link
        to="/app/chat"
        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/40 transition-colors"
      >
        <div>
          <p className="text-sm font-medium text-foreground">Ask Moment for help</p>
          <p className="text-[11px] text-muted-foreground">Get coaching on a specific block or topic</p>
        </div>
        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
      </Link>
    </div>
  );
}
