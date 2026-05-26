import { useState } from "react";
import { AlertTriangle, Clock, BookOpen, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { ExamEmergency, StudyBlock } from "@/lib/types";
import type { ExamBlockFeedbackResult } from "@/lib/types/exam-emergency";

interface Props {
  emergency: ExamEmergency;
  onBlockFeedback: (blockId: string, result: ExamBlockFeedbackResult) => void;
  onStartBlock: (blockId: string) => void;
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  ignore_for_now: "bg-slate-700/20 text-slate-500 border-slate-700/30",
};

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
  index,
  completedIds,
  onFeedback,
  onStart,
  isFirst,
}: {
  block: StudyBlock;
  index: number;
  completedIds: Set<string>;
  onFeedback: (blockId: string, result: ExamBlockFeedbackResult) => void;
  onStart: (blockId: string) => void;
  isFirst?: boolean;
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
          <div className="flex items-center gap-1.5">
            {isFirst && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">First 20 min</span>}
            {done && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
          </div>
          <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {block.title}
          </p>
          <p className="text-[11px] text-muted-foreground">{block.goal}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            <Clock className="inline h-2.5 w-2.5 mr-0.5" />
            {block.duration_minutes}m
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground">
            {METHOD_LABEL[block.method] ?? block.method}
          </span>
        </div>
      </div>

      {!done && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onStart(block.id)}
            className="text-[11px] text-primary hover:underline"
          >
            Start →
          </button>
          <button
            onClick={() => setShowFeedback((v) => !v)}
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Feedback {showFeedback ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
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

export function ExamEmergencyCard({ emergency, onBlockFeedback, onStartBlock }: Props) {
  const [showRecovery, setShowRecovery] = useState(false);

  const hoursUntilExam = Math.max(
    0,
    (new Date(emergency.exam_date_time).getTime() - Date.now()) / 3_600_000,
  );

  const completedIds = new Set(
    emergency.feedback.filter((f) => f.result === "completed").map((f) => f.block_id),
  );

  const survivalBlocks = emergency.current_plan.survival_plan;
  const recoveryBlocks = emergency.current_plan.recovery_plan;

  const countdownText =
    hoursUntilExam < 1
      ? "less than 1h"
      : hoursUntilExam < 24
      ? `${Math.round(hoursUntilExam)}h`
      : `${Math.round(hoursUntilExam / 24)}d`;

  const urgencyColor = hoursUntilExam < 6 ? "border-red-500/40 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5";

  return (
    <div className={`rounded-xl border ${urgencyColor} p-4 space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 shrink-0 ${hoursUntilExam < 6 ? "text-red-400" : "text-amber-400"}`} />
          <span className="font-semibold text-foreground">{emergency.subject}</span>
          <span className="text-sm text-muted-foreground">exam in {countdownText}</span>
        </div>
        {emergency.preparedness_score && (
          <span className="text-[11px] text-muted-foreground">
            prepared: {emergency.preparedness_score}/10
          </span>
        )}
      </div>

      {emergency.topics.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            <BookOpen className="inline h-2.5 w-2.5 mr-1" />
            Topics
          </p>
          <div className="flex flex-wrap gap-1">
            {emergency.topics
              .filter((t) => t.priority !== "ignore_for_now")
              .slice(0, 8)
              .map((t) => (
                <span
                  key={t.id}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.low}`}
                >
                  {t.name}
                </span>
              ))}
          </div>
        </div>
      )}

      {survivalBlocks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Survival plan · {survivalBlocks.reduce((s, b) => s + b.duration_minutes, 0)}m
          </p>
          {survivalBlocks.map((block, i) => (
            <BlockRow
              key={block.id}
              block={block}
              index={i}
              completedIds={completedIds}
              onFeedback={onBlockFeedback}
              onStart={onStartBlock}
              isFirst={i === 0}
            />
          ))}
        </div>
      )}

      {recoveryBlocks.length > 0 && (
        <div>
          <button
            onClick={() => setShowRecovery((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {showRecovery ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Recovery plan ({recoveryBlocks.length} blocks)
          </button>
          {showRecovery && (
            <div className="mt-1.5 space-y-1.5">
              {recoveryBlocks.map((block, i) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  index={i}
                  completedIds={completedIds}
                  onFeedback={onBlockFeedback}
                  onStart={onStartBlock}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
