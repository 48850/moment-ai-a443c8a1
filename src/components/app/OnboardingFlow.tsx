import { useState } from "react";
import { useStateStore } from "@/stores/state-store";
import { Sparkles, ChevronRight } from "lucide-react";

/**
 * One-time onboarding. Runs once per user, captures the context
 * every other feature relies on, then never appears again.
 *
 * Captured: goal, age, school + grade, weekly schedule shape,
 * and predispositions (how they work / what trips them up).
 */
type Step = {
  id: keyof Answers;
  label: string;
  prompt: string;
  placeholder: string;
  multiline?: boolean;
  type?: "text" | "number";
};

interface Answers {
  goal: string;
  age: string;
  school_name: string;
  grade_level: string;
  weekly_schedule_summary: string;
  predispositions: string;
}

const STEPS: Step[] = [
  {
    id: "goal",
    label: "the goal",
    prompt: "What's the one goal you want Moment pointed at right now?",
    placeholder: "e.g. Get into a top CS program / launch my band's first EP",
    multiline: true,
  },
  {
    id: "age",
    label: "age",
    prompt: "How old are you?",
    placeholder: "e.g. 17",
    type: "number",
  },
  {
    id: "school_name",
    label: "school",
    prompt: "Where do you go to school?",
    placeholder: "e.g. Lincoln High",
  },
  {
    id: "grade_level",
    label: "grade",
    prompt: "What grade or year are you in?",
    placeholder: "e.g. Junior / Year 12 / 2nd year university",
  },
  {
    id: "weekly_schedule_summary",
    label: "weekly schedule",
    prompt: "Quick sketch of a typical week — when's school, jobs, sports, anything fixed?",
    placeholder: "e.g. School Mon–Fri 8–3, soccer Tue/Thu 4–6, work Sat morning",
    multiline: true,
  },
  {
    id: "predispositions",
    label: "predispositions",
    prompt: "Anything we should know about how you work? Strengths, what trips you up, energy patterns, anything.",
    placeholder: "e.g. ADHD, sharp at night, freeze on big tasks, perfectionist",
    multiline: true,
  },
];

export const OnboardingFlow = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const applyPatch = useStateStore((s) => s.applyPatch);

  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    goal: state?.active_goal?.statement ?? "",
    age: state?.profile.age ? String(state.profile.age) : "",
    school_name: state?.profile.school_name ?? "",
    grade_level: state?.profile.grade_level ?? "",
    weekly_schedule_summary: state?.profile.weekly_schedule_summary ?? "",
    predispositions: state?.profile.predispositions ?? "",
  });

  const step = STEPS[stepIdx];
  const value = answers[step.id];
  const canAdvance = value.trim().length > 0;
  const isLast = stepIdx === STEPS.length - 1;

  const onNext = () => {
    if (!canAdvance) return;
    if (!isLast) {
      setStepIdx((i) => i + 1);
      return;
    }
    // Final commit
    if (!state) return;
    dispatch({
      type: "goal/patch",
      payload: {
        statement: answers.goal.trim(),
        why_it_matters: state.active_goal.why_it_matters,
        status: state.active_goal.status === "forming" ? "active" : state.active_goal.status,
      },
    });
    applyPatch({
      profile: {
        ...state.profile,
        age: Number(answers.age) || 0,
        school_name: answers.school_name.trim(),
        grade_level: answers.grade_level.trim(),
        weekly_schedule_summary: answers.weekly_schedule_summary.trim(),
        predispositions: answers.predispositions.trim(),
        onboarding_completed_at: new Date().toISOString(),
      },
    });
  };

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" /> setup · {stepIdx + 1} / {STEPS.length}
      </div>
      <div className="mb-6 flex gap-1">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`h-1 flex-1 rounded-full ${i <= stepIdx ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {step.label}
        </div>
        <h1 className="mt-2 font-display text-2xl font-medium tracking-tight">
          {step.prompt}
        </h1>

        {step.multiline ? (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => setAnswers((a) => ({ ...a, [step.id]: e.target.value }))}
            placeholder={step.placeholder}
            rows={4}
            className="mt-5 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onNext();
            }}
          />
        ) : (
          <input
            autoFocus
            type={step.type ?? "text"}
            value={value}
            onChange={(e) => setAnswers((a) => ({ ...a, [step.id]: e.target.value }))}
            placeholder={step.placeholder}
            className="mt-5 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") onNext();
            }}
          />
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canAdvance}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLast ? "Enter Moment" : "Next"}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        This runs once. Everything you share here flows into your plan, tasks, and chat.
      </p>
    </div>
  );
};
