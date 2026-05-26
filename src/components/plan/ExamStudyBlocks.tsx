import { useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import type { ExamEmergency, StudyBlock } from "@/lib/types";
import type { ExamBlockFeedbackResult } from "@/lib/types/exam-emergency";

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

function StudyBlockRow({
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
      className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFeedback((v) => !v)}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Mark progress {showFeedback ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
          </button>
        </div>
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

export function ExamStudyBlocks() {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [activeTab, setActiveTab] = useState<"survival" | "recovery" | "stretch">("survival");

  const emergency: ExamEmergency | undefined = (state?.exam_emergencies as ExamEmergency[] | undefined)?.find(
    (e) => e.status === "active" || e.status === "intake",
  );

  if (!emergency) return null;

  const hoursUntilExam = Math.max(
    0,
    (new Date(emergency.exam_date_time).getTime() - Date.now()) / 3_600_000,
  );

  const completedIds = new Set(
    emergency.feedback.filter((f) => f.result === "completed").map((f) => f.block_id),
  );

  const survivalBlocks = emergency.current_plan.survival_plan;
  const recoveryBlocks = emergency.current_plan.recovery_plan;
  const stretchBlocks = emergency.current_plan.stretch_plan;

  const completedSurvival = survivalBlocks.filter((b) => completedIds.has(b.id)).length;
  const progressPct = survivalBlocks.length > 0
    ? Math.round((completedSurvival / survivalBlocks.length) * 100)
    : 0;

  const preparedness = emergency.preparedness_score ?? 0;
  const showRecovery = preparedness >= 5 && recoveryBlocks.length > 0;
  const showStretch = preparedness >= 7 && stretchBlocks.length > 0;

  const countdownText =
    hoursUntilExam < 1
      ? "< 1h"
      : hoursUntilExam < 24
      ? `${Math.round(hoursUntilExam)}h`
      : `${Math.round(hoursUntilExam / 24)}d`;

  const handleFeedback = (blockId: string, result: ExamBlockFeedbackResult) => {
    dispatch({
      type: "exam/add_feedback",
      payload: {
        emergencyId: emergency.id,
        feedback: { block_id: blockId, result, created_at: new Date().toISOString() },
      },
    } as any);
  };

  const handleComplete = () => {
    dispatch({ type: "exam/complete", payload: { id: emergency.id } } as any);
  };

  const currentBlocks =
    activeTab === "survival" ? survivalBlocks
    : activeTab === "recovery" ? recoveryBlocks
    : stretchBlocks;

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-foreground">Exam Mode · {emergency.subject}</span>
          <span className="text-sm text-muted-foreground">{countdownText} remaining</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {completedSurvival}/{survivalBlocks.length} survival blocks
        </span>
      </div>

      {survivalBlocks.length > 0 && (
        <div className="h-1.5 w-full rounded-full bg-muted/30">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

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

      <div className="space-y-1.5">
        {currentBlocks.map((block, i) => (
          <StudyBlockRow
            key={block.id}
            block={block}
            isFirst={activeTab === "survival" && i === 0}
            completedIds={completedIds}
            onFeedback={handleFeedback}
          />
        ))}
        {currentBlocks.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">No blocks in this plan.</p>
        )}
      </div>

      {emergency.status !== "completed" && (
        <button
          onClick={handleComplete}
          className="w-full text-[12px] font-medium text-emerald-400 border border-emerald-500/30 rounded-lg py-2 hover:bg-emerald-500/10 transition-colors"
        >
          Exam done — reflect
        </button>
      )}
    </section>
  );
}
