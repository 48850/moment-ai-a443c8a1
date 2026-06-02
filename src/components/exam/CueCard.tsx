/**
 * CueCard — Brainscape-style flip cue card.
 *
 * Front: question + your answer.
 * Back: AI-graded correction (after submit) with model answer & next-fix.
 *
 * On submit, calls app-intelligence `exam_rate_answer`, then dispatches
 * exam/submit_answer with the AI rating attached. Falls back to a local
 * heuristic if the AI call fails.
 */
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Sparkles, ArrowRight, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStateStore } from "@/stores/state-store";
import { buildContextPacket } from "@/lib/ai/context-packet";
import { selectVisibleQuestionFields } from "@/lib/exam/question-helpers";
import { buildLocalFallbackRating } from "@/lib/trial/trial-helpers";
import type { ExamQuestion, ExamTaskProfile, QuestionRating } from "@/lib/types";

interface CueCardProps {
  question: ExamQuestion;
  emergencyId: string;
  subject: string;
  taskProfile?: ExamTaskProfile;
  questionNumber: number;
  totalQuestions: number;
  onNext?: () => void;
}

const LEVEL_COLOUR: Record<QuestionRating["level"], { ring: string; bg: string; text: string; dot: string }> = {
  strong:      { ring: "ring-emerald-500/40", bg: "bg-emerald-500/10",  text: "text-emerald-300", dot: "bg-emerald-400" },
  solid:       { ring: "ring-green-500/40",   bg: "bg-green-500/10",    text: "text-green-300",   dot: "bg-green-400" },
  developing:  { ring: "ring-amber-500/40",   bg: "bg-amber-500/10",    text: "text-amber-300",   dot: "bg-amber-400" },
  needs_work:  { ring: "ring-red-500/40",     bg: "bg-red-500/10",      text: "text-red-300",     dot: "bg-red-400" },
};

export function CueCard({
  question,
  emergencyId,
  subject,
  taskProfile,
  questionNumber,
  totalQuestions,
  onNext,
}: CueCardProps) {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const visible = selectVisibleQuestionFields(question);
  const answered = !!visible.attempt || visible.revealed_without_attempt;

  const [answerText, setAnswerText] = useState("");
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState(answered);

  // Reset state when question id changes
  useEffect(() => {
    setAnswerText("");
    setLoading(false);
    setFlipped(answered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const levelStyle = useMemo(() => {
    const l = visible.attempt?.rating?.level;
    return l ? LEVEL_COLOUR[l] : null;
  }, [visible.attempt?.rating?.level]);

  async function gradeWithAI(text: string): Promise<QuestionRating> {
    try {
      const { data, error } = await supabase.functions.invoke("app-intelligence", {
        body: {
          intent: "exam_rate_answer",
          snapshot: buildContextPacket(state),
          payload: {
            subject,
            question_text: question.question_text,
            question_type: question.question_type,
            model_answer: question.model_answer,
            correct_answer: question.correct_answer,
            expected_points: question.expected_points ?? [],
            answer_text: text,
            task_profile: taskProfile,
          },
        },
      });
      if (error) throw error;
      const r = (data?.result ?? data) as any;
      const rating = r?.rating ?? r;
      if (rating?.level) {
        return {
          level: rating.level,
          practice_estimate_label: rating.practice_estimate_label ?? rating.level,
          strengths: Array.isArray(rating.strengths) ? rating.strengths : [],
          missing_points: Array.isArray(rating.missing_points) ? rating.missing_points : [],
          misconception: rating.misconception ?? undefined,
          next_fix: rating.next_fix ?? "Review and try again.",
        };
      }
    } catch (e) {
      console.warn("AI grading fallback", e);
    }
    return buildLocalFallbackRating(text);
  }

  async function handleSubmit() {
    const text = answerText.trim();
    if (!text || loading) return;
    setLoading(true);
    const rating = await gradeWithAI(text);
    dispatch({
      type: "exam/submit_answer",
      payload: {
        emergencyId,
        questionId: question.id,
        attempt: {
          submitted_at: new Date().toISOString(),
          answer_text: text,
          rating,
        },
      },
    });
    setLoading(false);
    setFlipped(true);
  }

  function handleReveal() {
    dispatch({ type: "exam/reveal_answer", payload: { emergencyId, questionId: question.id } });
    setFlipped(true);
  }

  return (
    <div className="space-y-3">
      {/* Counter */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Card {questionNumber} / {totalQuestions}
        </span>
        {answered && (
          <button
            onClick={() => setFlipped((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" /> Flip
          </button>
        )}
      </div>

      {/* Card stage with 3D flip */}
      <div className="[perspective:1600px]">
        <div
          className={`relative min-h-[360px] w-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* FRONT */}
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <div className="h-full rounded-3xl border border-border bg-card shadow-xl shadow-black/20 flex flex-col">
              <div className="px-6 pt-6 pb-3 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-indigo-300/80 font-medium">
                  Question
                </span>
              </div>
              <div className="px-6 pb-4 flex-1 flex items-center">
                <p className="text-xl leading-relaxed font-medium text-foreground text-balance">
                  {visible.question_text}
                </p>
              </div>

              {/* MCQ options */}
              {visible.options && visible.options.length > 0 ? (
                <div className="px-6 pb-4 space-y-2">
                  {visible.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswerText(opt)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                        answerText === opt
                          ? "border-indigo-500 bg-indigo-500/15 text-foreground"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-border/80 hover:text-foreground"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-6 pb-4">
                  <textarea
                    className="w-full bg-muted/30 border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-indigo-500/60 focus:bg-muted/50 transition-colors min-h-[120px]"
                    placeholder="Type your answer…"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    disabled={loading}
                  />
                </div>
              )}

              <div className="px-6 pb-6 flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!answerText.trim() || loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-medium transition-colors"
                >
                  {loading ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" /> Grading…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Submit & grade
                    </>
                  )}
                </button>
                <button
                  onClick={handleReveal}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-border/80 text-sm transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" /> Reveal
                </button>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <div className={`h-full rounded-3xl border border-border bg-card shadow-xl shadow-black/20 flex flex-col ${levelStyle ? `ring-2 ${levelStyle.ring}` : ""}`}>
              <div className="px-6 pt-6 pb-3 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                  Correction
                </span>
                {visible.attempt?.rating && levelStyle && (
                  <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full ${levelStyle.bg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${levelStyle.dot}`} />
                    <span className={`text-[11px] font-medium ${levelStyle.text}`}>
                      {visible.attempt.rating.practice_estimate_label}
                    </span>
                  </div>
                )}
              </div>

              <div className="px-6 pb-4 flex-1 overflow-y-auto space-y-4">
                {/* Your answer */}
                {visible.attempt && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">Your answer</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{visible.attempt.answer_text}</p>
                  </div>
                )}

                {/* AI feedback */}
                {visible.attempt?.rating && (
                  <div className="space-y-3">
                    {visible.attempt.rating.strengths.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-400/80 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> What worked
                        </p>
                        {visible.attempt.rating.strengths.map((s, i) => (
                          <p key={i} className="text-sm text-foreground/70 pl-3">+ {s}</p>
                        ))}
                      </div>
                    )}
                    {visible.attempt.rating.missing_points.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-amber-400/80 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Missing
                        </p>
                        {visible.attempt.rating.missing_points.map((s, i) => (
                          <p key={i} className="text-sm text-foreground/70 pl-3">– {s}</p>
                        ))}
                      </div>
                    )}
                    {visible.attempt.rating.misconception && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-red-300/80 mb-0.5">Misconception</p>
                        <p className="text-sm text-foreground/80">{visible.attempt.rating.misconception}</p>
                      </div>
                    )}
                    {visible.attempt.rating.next_fix && (
                      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-indigo-300/80 mb-0.5">Next fix</p>
                        <p className="text-sm text-foreground/80">{visible.attempt.rating.next_fix}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Model answer */}
                {(visible.model_answer || (visible.expected_points && visible.expected_points.length > 0)) && (
                  <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 px-3 py-2.5 space-y-2">
                    {visible.model_answer && (
                      <>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-400/80">Model answer</p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{visible.model_answer}</p>
                      </>
                    )}
                    {visible.expected_points && visible.expected_points.length > 0 && (
                      <>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-400/80 mt-1">Key points</p>
                        {visible.expected_points.map((pt, i) => (
                          <p key={i} className="text-sm text-foreground/70 pl-3">✓ {pt}</p>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {visible.revealed_without_attempt && !visible.attempt && (
                  <p className="text-xs text-amber-400/80 italic">Revealed without attempt.</p>
                )}
              </div>

              {onNext && (
                <div className="px-6 pb-6">
                  <button
                    onClick={onNext}
                    className="w-full flex items-center justify-center gap-2 bg-muted/40 hover:bg-muted/60 border border-border text-foreground rounded-xl py-3 text-sm font-medium transition-colors"
                  >
                    Next card <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
