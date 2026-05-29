/**
 * DrillQuestion — renders a single exam question with answer hiding.
 *
 * Uses selectVisibleQuestionFields as the single source of truth for
 * what to show. Correct answer, model answer, and expected points are
 * never rendered until the user submits an attempt or clicks Reveal Answer.
 */
import { useState } from "react";
import { ChevronDown, Eye, CheckCircle } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectVisibleQuestionFields } from "@/lib/exam/question-helpers";
import type { ExamQuestion } from "@/lib/types";

interface DrillQuestionProps {
  question: ExamQuestion;
  emergencyId: string;
  questionNumber: number;
  totalQuestions: number;
  onNext?: () => void;
}

export function DrillQuestion({
  question,
  emergencyId,
  questionNumber,
  totalQuestions,
  onNext,
}: DrillQuestionProps) {
  const dispatch = useStateStore((s) => s.dispatch);
  const [answerText, setAnswerText] = useState("");
  const [showHint, setShowHint] = useState(false);

  const visible = selectVisibleQuestionFields(question);
  const answered = !!visible.attempt || visible.revealed_without_attempt;

  function handleSubmit() {
    if (!answerText.trim()) return;
    dispatch({
      type: "exam/submit_answer",
      payload: {
        emergencyId,
        questionId: question.id,
        attempt: {
          submitted_at: new Date().toISOString(),
          answer_text: answerText.trim(),
        },
      },
    });
  }

  function handleReveal() {
    dispatch({
      type: "exam/reveal_answer",
      payload: { emergencyId, questionId: question.id },
    });
  }

  const levelColour: Record<string, string> = {
    strong: "text-emerald-400",
    solid: "text-green-400",
    developing: "text-amber-400",
    needs_work: "text-red-400",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40 uppercase tracking-wider">
          Question {questionNumber} of {totalQuestions}
        </span>
        {visible.revealed_without_attempt && (
          <span className="text-xs text-amber-400/80">Revealed without attempt</span>
        )}
      </div>

      {/* Question */}
      <p className="text-white/90 text-base leading-relaxed font-medium">
        {visible.question_text}
      </p>

      {/* MCQ options — shown before attempt */}
      {!answered && visible.options && visible.options.length > 0 && (
        <div className="space-y-2">
          {visible.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setAnswerText(opt)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors text-sm ${
                answerText === opt
                  ? "border-indigo-500 bg-indigo-500/10 text-white"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Text answer — for non-MCQ or when MCQ not selected */}
      {!answered && (!visible.options || visible.options.length === 0) && (
        <textarea
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/80 placeholder:text-white/30 resize-none focus:outline-none focus:border-indigo-500/50 min-h-[100px]"
          placeholder="Write your answer here…"
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
        />
      )}

      {/* Hint */}
      {!answered && visible.hint && (
        <button
          onClick={() => setShowHint((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${showHint ? "rotate-180" : ""}`}
          />
          {showHint ? "Hide hint" : "Show hint"}
        </button>
      )}
      {showHint && visible.hint && (
        <p className="text-sm text-white/50 italic pl-1">{visible.hint}</p>
      )}

      {/* Action buttons before attempt */}
      {!answered && (
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!answerText.trim()}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            Submit answer
          </button>
          <button
            onClick={handleReveal}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 text-sm transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Reveal
          </button>
        </div>
      )}

      {/* After attempt / reveal — show answer */}
      {answered && (
        <div className="space-y-4 pt-2">
          {/* User's attempt */}
          {visible.attempt && (
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
              <p className="text-xs text-white/40 mb-1">Your answer</p>
              <p className="text-sm text-white/70">{visible.attempt.answer_text}</p>
            </div>
          )}

          {/* Rating */}
          {visible.attempt?.rating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-white/80">Practice estimate</span>
                <span className={`text-sm font-semibold ${levelColour[visible.attempt.rating.level] ?? "text-white"}`}>
                  {visible.attempt.rating.practice_estimate_label}
                </span>
              </div>
              {visible.attempt.rating.next_fix && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                  <p className="text-xs text-amber-400/70 mb-1">Next fix</p>
                  <p className="text-sm text-amber-100/80">{visible.attempt.rating.next_fix}</p>
                </div>
              )}
              {visible.attempt.rating.missing_points.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-white/40">Missing</p>
                  {visible.attempt.rating.missing_points.map((pt, i) => (
                    <p key={i} className="text-sm text-white/60 pl-3">· {pt}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Model answer / expected points */}
          {(visible.model_answer || (visible.expected_points && visible.expected_points.length > 0)) && (
            <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 px-4 py-3 space-y-2">
              {visible.model_answer && (
                <>
                  <p className="text-xs text-emerald-400/70">Model answer</p>
                  <p className="text-sm text-white/70">{visible.model_answer}</p>
                </>
              )}
              {visible.expected_points && visible.expected_points.length > 0 && (
                <>
                  <p className="text-xs text-emerald-400/70 mt-2">Key points</p>
                  {visible.expected_points.map((pt, i) => (
                    <p key={i} className="text-sm text-white/60 pl-3">✓ {pt}</p>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Next button */}
          {onNext && (
            <button
              onClick={onNext}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-xl py-2.5 text-sm transition-colors"
            >
              Next question →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
