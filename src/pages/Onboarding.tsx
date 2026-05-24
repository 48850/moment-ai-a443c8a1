import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, ChevronLeft, Lock } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { evaluateGoalFeasibility } from "@/lib/engine/goal-feasibility";
import type { GoalFeasibilityReport } from "@/lib/types";
import type { MomentState } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// ─── Stage types ──────────────────────────────────────────────────────────────

interface OnboardingData {
  // Name (step 0)
  preferred_name: string;
  // Stage 1 — channelled pursuit
  long_term_goal: string;   // the anchor / horizon ambition
  medium_term_goal: string; // milestone within months / this year
  short_term_goal: string;  // the next concrete proof (weeks)
  horizon: string;
  // Stage 2
  why_it_matters: string;
  desired_identity: string;
  // Stage 3
  stage_of_life: string;
  school_year: string;
  age_str: string;
  normal_weekday: string;
  // Stage 4 (country/education)
  country: string;
  education_system: string;
  // Stage 5
  current_level: string;
  // Stage 7
  support_preferences: string[];
  tone: string;
}

/** Compose the three horizons into a single channelled goal statement. */
function composeChannelledGoal(d: Pick<OnboardingData, "long_term_goal" | "medium_term_goal" | "short_term_goal">): string {
  const parts: string[] = [];
  if (d.long_term_goal.trim()) parts.push(`Long-term: ${d.long_term_goal.trim()}`);
  if (d.medium_term_goal.trim()) parts.push(`Medium-term: ${d.medium_term_goal.trim()}`);
  if (d.short_term_goal.trim()) parts.push(`Short-term: ${d.short_term_goal.trim()}`);
  return parts.join(" → ");
}

const EMOTION_CHIPS = [
  "interest", "identity", "pressure", "curiosity",
  "status", "purpose", "creative", "financial",
];

const LIFE_STAGES = [
  { value: "School student", label: "School student", bracket: "teen_16_18" as const },
  { value: "University", label: "University / college", bracket: "adult" as const },
  { value: "Working", label: "Working", bracket: "adult" as const },
  { value: "Gap year", label: "Gap year", bracket: "adult" as const },
  { value: "Other", label: "Other", bracket: "unknown" as const },
];

const CURRENT_LEVEL_OPTIONS = [
  { value: "not at all", label: "Not at all" },
  { value: "a little", label: "A little" },
  { value: "some foundation", label: "Some foundation" },
  { value: "quite a lot", label: "Quite a lot" },
  { value: "advanced", label: "Advanced" },
];

const SUPPORT_OPTIONS = [
  "build daily schedule",
  "break into steps",
  "keep me focused",
  "help when I fall behind",
  "track progress",
  "challenge me when I drift",
];

const TONE_OPTIONS = [
  { value: "gentle", label: "Gentle" },
  { value: "calm", label: "Calm" },
  { value: "direct", label: "Direct" },
];

function ageBracketFromLifeStage(stage: string, ageStr: string): MomentState["profile"]["age_bracket"] {
  const age = parseInt(ageStr, 10);
  if (!isNaN(age)) {
    if (age < 13) return "under_13";
    if (age <= 15) return "teen_13_15";
    if (age <= 18) return "teen_16_18";
    return "adult";
  }
  const found = LIFE_STAGES.find((s) => s.value === stage);
  return found?.bracket ?? "unknown";
}

function buildCurrentStageDescription(data: Partial<OnboardingData>): string {
  const levelMap: Record<string, string> = {
    "not at all": "no foundation yet",
    "a little": "beginner with minimal exposure",
    "some foundation": "some foundational knowledge",
    "quite a lot": "developing practitioner",
    "advanced": "advanced student",
  };
  const levelDesc = levelMap[data.current_level ?? ""] ?? "unknown level";
  if (data.school_year) return `${data.school_year} — ${levelDesc}`;
  if (data.stage_of_life) return `${data.stage_of_life} — ${levelDesc}`;
  return levelDesc;
}

function getDomainPrompt(goal: string): string {
  const lower = goal.toLowerCase();
  if (lower.includes("neurol") || lower.includes("doctor") || lower.includes("medicine")) {
    return "Have you studied biology, chemistry, or psychology yet?";
  }
  if (lower.includes("cs") || lower.includes("computer science") || lower.includes("coding")) {
    return "How much programming experience do you have?";
  }
  if (lower.includes("law") || lower.includes("lawyer")) {
    return "How much have you engaged with legal reasoning, debate, or essay writing?";
  }
  if (lower.includes("stanford") || lower.includes("oxford") || lower.includes("cambridge") || lower.includes("university")) {
    return "How prepared are you in the key subjects for your target degree?";
  }
  return `How much experience or knowledge do you have in the area your goal requires?`;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i < step ? "bg-amber-400" : i === step ? "bg-amber-400/60" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Chip components ──────────────────────────────────────────────────────────

function Chip({
  label,
  selected,
  onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
        selected
          ? "border-amber-400 bg-amber-400/15 text-amber-300"
          : "border-white/20 bg-white/5 text-white/60 hover:border-white/40"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const dispatch = useStateStore((s) => s.dispatch);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const TOTAL_STEPS = 9;

  // Heuristic: pre-fill country from browser timezone.
  const guessedCountry = (() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz.startsWith("Australia/")) return "Australia";
      if (tz.startsWith("America/")) return "United States";
      if (tz.startsWith("Europe/London")) return "United Kingdom";
      if (tz.startsWith("Europe/")) return "Other";
      if (tz.startsWith("Asia/Kolkata") || tz.startsWith("Asia/Calcutta")) return "India";
      if (tz.startsWith("Asia/Singapore")) return "Singapore";
      if (tz.startsWith("America/Toronto") || tz.startsWith("America/Vancouver")) return "Canada";
    } catch { /* ignore */ }
    return "";
  })();

  const [data, setData] = useState<OnboardingData>({
    preferred_name: "",
    long_term_goal: "",
    medium_term_goal: "",
    short_term_goal: "",
    horizon: "years",
    why_it_matters: "",
    desired_identity: "",
    stage_of_life: "",
    school_year: "",
    age_str: "",
    normal_weekday: "",
    country: guessedCountry,
    education_system: "unknown",
    current_level: "a little",
    support_preferences: [],
    tone: "calm",
  });

  const set = (patch: Partial<OnboardingData>) => setData((d) => ({ ...d, ...patch }));

  /** Channelled goal statement (long → medium → short). */
  const channelledGoal = useMemo(() => composeChannelledGoal(data), [data.long_term_goal, data.medium_term_goal, data.short_term_goal]);

  // Stage 5 feasibility — computed live from collected data
  const feasibility: GoalFeasibilityReport | null = useMemo(() => {
    if (!data.long_term_goal.trim()) return null;
    const age_bracket = ageBracketFromLifeStage(data.stage_of_life, data.age_str);
    return evaluateGoalFeasibility({
      goal: data.long_term_goal,
      age_bracket,
      school_year: data.school_year || undefined,
      stage_of_life: data.stage_of_life || undefined,
      pursuit_family: "generic",
      current_level: data.current_level,
      current_stage: buildCurrentStageDescription(data),
    });
  }, [data.long_term_goal, data.stage_of_life, data.age_str, data.school_year, data.current_level]);


  // Stage 7 understanding object — auto-generated from collected data
  const understanding = useMemo(() => {
    const knowns: string[] = [];
    const unknowns: string[] = [];
    const assumptions: string[] = [];

    if (data.long_term_goal.trim()) knowns.push(`long-term goal: "${data.long_term_goal.trim()}"`);
    if (data.medium_term_goal.trim()) knowns.push(`medium-term milestone: "${data.medium_term_goal.trim()}"`);
    if (data.short_term_goal.trim()) knowns.push(`short-term focus: "${data.short_term_goal.trim()}"`);
    if (!data.long_term_goal.trim() && !data.medium_term_goal.trim() && !data.short_term_goal.trim()) {
      unknowns.push("what their goal actually is");
    }

    if (data.why_it_matters.trim()) knowns.push(`why it matters: "${data.why_it_matters.trim()}"`);
    else unknowns.push("why this goal matters to them personally");

    if (data.stage_of_life) knowns.push(`stage of life: ${data.stage_of_life}`);
    else unknowns.push("stage of life (student / working / other)");

    if (data.school_year) knowns.push(`school year: ${data.school_year}`);
    else if (data.stage_of_life === "School student") unknowns.push("specific school year / grade");

    if (data.age_str) knowns.push(`age: ${data.age_str}`);
    else unknowns.push("their age");

    if (data.current_level) knowns.push(`current ability level: ${data.current_level}`);
    else unknowns.push("their current ability level in the relevant area");

    if (data.normal_weekday.trim()) knowns.push(`typical weekday: ${data.normal_weekday.trim()}`);
    else unknowns.push("how their typical weekday is structured and how many hours are available");

    if (!data.age_str && data.stage_of_life === "School student") {
      assumptions.push("User is in secondary/high school");
    }
    if (feasibility) {
      if (feasibility.target_stage) {
        assumptions.push(`Target stage: ${feasibility.target_stage}`);
      }
    }

    const confidence: "low" | "medium" | "high" =
      unknowns.filter((u) => u !== "available weekly hours").length === 0
        ? "high"
        : unknowns.length <= 1
        ? "medium"
        : "low";

    return { knowns, unknowns, assumptions, confidence };
  }, [data, feasibility]);

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return true; // name is skippable
      case 1: return data.long_term_goal.trim().length >= 5 && data.short_term_goal.trim().length >= 3;
      case 2: return data.why_it_matters.trim().length >= 5;
      case 3: return true; // user reality is optional
      case 4: return true; // country/education optional
      case 5: return Boolean(data.current_level);
      case 6: return true; // preview, no input
      case 7: return true; // preferences optional
      case 8: return true; // understanding review
      default: return true;
    }
  };

  const handleComplete = () => {
    if (!feasibility) return;

    const age_bracket = ageBracketFromLifeStage(data.stage_of_life, data.age_str);
    const age = parseInt(data.age_str, 10);
    const current_stage = buildCurrentStageDescription(data);

    const horizon = data.horizon as MomentState["active_goal"]["horizon"];

    dispatch({
      type: "onboarding/complete",
      payload: {
        profile_patch: {
          display_name: data.preferred_name.trim() || "",
          age_bracket,
          age: isNaN(age) ? undefined : age,
          school_year: data.school_year || undefined,
          academic_context: data.stage_of_life || undefined,
          normal_weekday: data.normal_weekday || undefined,
          country: data.country || undefined,
          education_system: (data.education_system || "unknown") as MomentState["profile"]["education_system"],
          preferences: {
            tone: data.tone as MomentState["profile"]["preferences"]["tone"],
            strictness: "soft",
            schedule_style: data.support_preferences.includes("build daily schedule") ? "structured" : "flexible",
            support_style: data.support_preferences.includes("challenge me when I drift") ? "accountability" : "coach",
          },
        },
        goal_patch: {
          statement: channelledGoal || data.long_term_goal.trim(),
          why_it_matters: data.why_it_matters,
          desired_identity: data.desired_identity,
          horizon,
          current_stage,
          success_definition: channelledGoal,
          status: "forming",
          phase: "clarifying",
        },
        answers: {
          stage_of_life: data.stage_of_life,
          horizon: data.horizon,
          long_term_goal: data.long_term_goal,
          medium_term_goal: data.medium_term_goal,
          short_term_goal: data.short_term_goal,
          channelled_goal: channelledGoal,
          current_level: data.current_level,
          support_preferences: data.support_preferences,
          tone: data.tone,
        },
        understanding,
        feasibility,
      },
    });

    navigate("/app/chat?mode=goal_specialisation");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(ellipse at 30% 20%, #1a1d3d 0%, #0a0d24 45%, #03051a 100%)",
      }}
    >
      <div className="w-full max-w-lg">
        <ProgressBar step={step} total={TOTAL_STEPS} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22 }}
            className="space-y-6"
          >
            {/* Step 0 — Name */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Step 1 of 9</p>
                  <h2 className="text-2xl font-semibold text-white leading-snug">
                    What should Moment call you?
                  </h2>
                  <p className="text-white/50 text-sm mt-1">
                    First name, nickname, whatever you prefer. You can skip this.
                  </p>
                </div>
                <input
                  autoFocus
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-base focus:outline-none focus:border-amber-400/50"
                  placeholder="e.g. Elliot"
                  value={data.preferred_name}
                  onChange={(e) => set({ preferred_name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && setStep((s) => s + 1)}
                />
              </div>
            )}

            {/* Stage 1 — Channelled Pursuit Capture */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Step 2 of 9</p>
                  <h2 className="text-2xl font-semibold text-white leading-snug">
                    What's the pursuit?
                  </h2>
                  <p className="text-white/50 text-sm mt-1">
                    Three horizons, one channel. The long-term anchors it, the medium-term shapes the year, the short-term is what you start moving on now.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-white/40">Long-term — the anchor</label>
                  <textarea
                    className="w-full bg-white/5 border border-white/15 rounded-xl p-4 text-white placeholder-white/30 text-base resize-none focus:outline-none focus:border-amber-400/50 min-h-[64px]"
                    placeholder="e.g. Become a neurologist. Get into Stanford CS. Run a creative studio."
                    value={data.long_term_goal}
                    onChange={(e) => set({ long_term_goal: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-white/40">Medium-term — the milestone (this year)</label>
                  <textarea
                    className="w-full bg-white/5 border border-white/15 rounded-xl p-4 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-amber-400/50 min-h-[56px]"
                    placeholder="e.g. Finish AP Bio with an A and a research project. Ship v1 of my app."
                    value={data.medium_term_goal}
                    onChange={(e) => set({ medium_term_goal: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-white/40">Short-term — the next proof (weeks)</label>
                  <textarea
                    className="w-full bg-white/5 border border-white/15 rounded-xl p-4 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-amber-400/50 min-h-[56px]"
                    placeholder="e.g. Lock in a daily study block. Draft my CommonApp opener."
                    value={data.short_term_goal}
                    onChange={(e) => set({ short_term_goal: e.target.value })}
                  />
                </div>

                {channelledGoal && (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-amber-400/70 mb-1">Your channel</p>
                    <p className="text-sm text-amber-100/80 leading-snug">{channelledGoal}</p>
                  </div>
                )}
              </div>
            )}

            {/* Stage 2 — Why It Matters */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Step 3 of 9</p>
                  <h2 className="text-2xl font-semibold text-white leading-snug">
                    Why does it matter to you?
                  </h2>
                  <p className="text-white/50 text-sm mt-1">
                    Honest answers make better plans. Pressure is a valid answer.
                  </p>
                </div>
                <textarea
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-4 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-amber-400/50 min-h-[80px]"
                  placeholder="Why this goal? What would change if you reached it?"
                  value={data.why_it_matters}
                  onChange={(e) => set({ why_it_matters: e.target.value })}
                  autoFocus
                />
                <div>
                  <p className="text-xs text-white/40 mb-2">What's the main driver? (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {EMOTION_CHIPS.map((chip) => (
                      <Chip
                        key={chip}
                        label={chip}
                        selected={data.desired_identity.includes(chip)}
                        onClick={() =>
                          set({
                            desired_identity: data.desired_identity.includes(chip)
                              ? data.desired_identity.replace(chip, "").trim()
                              : `${data.desired_identity} ${chip}`.trim(),
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Stage 3 — User Reality */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Step 4 of 9</p>
                  <h2 className="text-2xl font-semibold text-white leading-snug">
                    Where are you right now?
                  </h2>
                  <p className="text-white/50 text-sm mt-1">
                    This helps Moment give you real plans, not generic advice.
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-2">Stage of life</p>
                  <div className="flex flex-wrap gap-2">
                    {LIFE_STAGES.map((ls) => (
                      <Chip
                        key={ls.value}
                        label={ls.label}
                        selected={data.stage_of_life === ls.value}
                        onClick={() => set({ stage_of_life: ls.value })}
                      />
                    ))}
                  </div>
                </div>
                {data.stage_of_life === "School student" && (
                  <input
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/50"
                    placeholder="School year (e.g. Year 10, Grade 11, IB Year 1)"
                    value={data.school_year}
                    onChange={(e) => set({ school_year: e.target.value })}
                  />
                )}
                <div>
                  <p className="text-xs text-white/40 mb-1">
                    How old are you? <span className="text-white/25">(optional — skip if you prefer)</span>
                  </p>
                  <input
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/50"
                    placeholder="Your age (optional)"
                    value={data.age_str}
                    onChange={(e) => set({ age_str: e.target.value })}
                    type="number"
                    min={10}
                    max={80}
                  />
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-1">
                    What does a normal weekday look like? <span className="text-white/25">(optional)</span>
                  </p>
                  <textarea
                    className="w-full bg-white/5 border border-white/15 rounded-xl p-4 text-white placeholder-white/30 text-sm resize-none focus:outline-none focus:border-amber-400/50 min-h-[60px]"
                    placeholder="e.g. School 8am-4pm, free time 4:30-10pm, sport Tuesday"
                    value={data.normal_weekday}
                    onChange={(e) => set({ normal_weekday: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Stage 4 — Country / Education system */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Step 5 of 9</p>
                  <h2 className="text-2xl font-semibold text-white leading-snug">
                    Where are you studying?
                  </h2>
                  <p className="text-white/50 text-sm mt-1">
                    This helps Moment give advice that fits your actual system — not a generic one.
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-2">Country</p>
                  <div className="flex flex-col gap-2">
                    {["Australia", "United Kingdom", "United States", "Canada", "New Zealand", "Singapore", "India", "Other"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          const eduMap: Record<string, string> = {
                            "Australia": "au_atar",
                            "United Kingdom": "uk_a_levels",
                            "United States": "us_highschool",
                            "Canada": "ca_ontario",
                            "Singapore": "sg_a_levels",
                            "India": "in_cbse",
                          };
                          set({ country: c, education_system: eduMap[c] ?? "other" });
                        }}
                        className={`px-4 py-2.5 rounded-xl text-sm text-left border transition-all ${
                          data.country === c
                            ? "border-amber-400 bg-amber-400/10 text-amber-200"
                            : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                {data.country && (
                  <div>
                    <p className="text-xs text-white/40 mb-2">Education system <span className="text-white/25">(auto-filled — override if needed)</span></p>
                    <div className="flex flex-col gap-2">
                      {[
                        { value: "au_atar", label: "ATAR / HSC (Australia)" },
                        { value: "au_hsc", label: "HSC — NSW specific" },
                        { value: "uk_a_levels", label: "A-levels (UK)" },
                        { value: "uk_gcse", label: "GCSEs (UK)" },
                        { value: "ib", label: "IB (International Baccalaureate)" },
                        { value: "us_ap", label: "AP / Honours (US)" },
                        { value: "us_highschool", label: "US High School" },
                        { value: "ca_ontario", label: "Ontario Grade 12" },
                        { value: "ca_ib", label: "IB Canada" },
                        { value: "sg_a_levels", label: "Singapore A-levels" },
                        { value: "in_cbse", label: "CBSE (India)" },
                        { value: "in_isc", label: "ISC (India)" },
                        { value: "other", label: "Other / Not applicable" },
                      ].map((e) => (
                        <button
                          key={e.value}
                          type="button"
                          onClick={() => set({ education_system: e.value })}
                          className={`px-4 py-2.5 rounded-xl text-sm text-left border transition-all ${
                            data.education_system === e.value
                              ? "border-amber-400 bg-amber-400/10 text-amber-200"
                              : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                          }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stage 5 — Current Level */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Step 6 of 9</p>
                  <h2 className="text-2xl font-semibold text-white leading-snug">
                    Where are you with the skills?
                  </h2>
                  <p className="text-white/50 text-sm mt-1">
                    {getDomainPrompt(data.long_term_goal || data.medium_term_goal || data.short_term_goal)}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {CURRENT_LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set({ current_level: opt.value })}
                      className={`px-4 py-3 rounded-xl text-sm text-left border transition-all ${
                        data.current_level === opt.value
                          ? "border-amber-400 bg-amber-400/10 text-amber-200"
                          : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stage 6 — Reality Gap Preview */}
            {step === 6 && feasibility && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Step 7 of 9</p>
                  <h2 className="text-2xl font-semibold text-white leading-snug">
                    Here's how Moment sees your pathway
                  </h2>
                  <p className="text-white/50 text-sm mt-1">
                    Read this. If it feels wrong, go back and adjust.
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1">
                  <p className="text-xs uppercase tracking-widest text-white/40">Reality gap</p>
                  <p className="text-sm text-white/80 leading-relaxed">{feasibility.reality_gap}</p>
                </div>

                {feasibility.appropriate_focus_now.length > 0 && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-widest text-emerald-400/70">What Moment will focus on for you now</p>
                    <ul className="space-y-1">
                      {feasibility.appropriate_focus_now.map((item, i) => (
                        <li key={i} className="text-sm text-white/70 flex gap-2">
                          <span className="text-emerald-400 shrink-0">·</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {feasibility.premature_recommendations.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                      <Lock className="w-3 h-3" /> Not the right move yet
                    </p>
                    <ul className="space-y-1">
                      {feasibility.premature_recommendations.map((item, i) => (
                        <li key={i} className="text-sm text-white/40 flex gap-2">
                          <span className="text-white/20 shrink-0">·</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  ← Adjust my current level
                </button>
              </div>
            )}

            {/* Stage 7 — How Moment Should Help */}
            {step === 7 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Step 8 of 9</p>
                  <h2 className="text-2xl font-semibold text-white leading-snug">
                    How do you want Moment to help?
                  </h2>
                  <p className="text-white/50 text-sm mt-1">Select everything that sounds right.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUPPORT_OPTIONS.map((opt) => (
                    <Chip
                      key={opt}
                      label={opt}
                      selected={data.support_preferences.includes(opt)}
                      onClick={() =>
                        set({
                          support_preferences: data.support_preferences.includes(opt)
                            ? data.support_preferences.filter((p) => p !== opt)
                            : [...data.support_preferences, opt],
                        })
                      }
                    />
                  ))}
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-2">Preferred tone</p>
                  <div className="flex gap-2">
                    {TONE_OPTIONS.map((t) => (
                      <Chip
                        key={t.value}
                        label={t.label}
                        selected={data.tone === t.value}
                        onClick={() => set({ tone: t.value })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Stage 8 — What Moment Still Needs to Learn */}
            {step === 8 && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Step 9 of 9</p>
                  <h2 className="text-2xl font-semibold text-white leading-snug">
                    Here's what Moment knows about you so far
                  </h2>
                  <p className="text-white/50 text-sm mt-1">
                    This is your starting picture. Moment will fill in the gaps as you use it.
                  </p>
                </div>

                {understanding.knowns.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-widest text-emerald-400/70">Moment knows</p>
                    <div className="flex flex-wrap gap-1.5">
                      {understanding.knowns.map((k, i) => (
                        <span key={i} className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {understanding.unknowns.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-widest text-white/40">Moment doesn't yet know</p>
                    <div className="flex flex-wrap gap-1.5">
                      {understanding.unknowns.map((u, i) => (
                        <span key={i} className="px-2 py-1 rounded-full bg-white/5 border border-white/15 text-xs text-white/50">
                          {u}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-white/30">
                      Moment will ask for these as needed, or infer them from what you share.
                    </p>
                  </div>
                )}

                {understanding.assumptions.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-widest text-amber-400/40">Moment is assuming</p>
                    <div className="flex flex-wrap gap-1.5">
                      {understanding.assumptions.slice(0, 4).map((a, i) => (
                        <span key={i} className="px-2 py-1 rounded-full bg-amber-400/5 border border-amber-400/15 text-xs text-amber-300/60">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                  <span className="text-xs text-white/40 uppercase tracking-widest">Context confidence</span>
                  <span className={`text-sm font-medium ${
                    understanding.confidence === "high" ? "text-emerald-400" :
                    understanding.confidence === "medium" ? "text-amber-400" : "text-white/50"
                  }`}>
                    {understanding.confidence}
                  </span>
                </div>

                <AuthPanel />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className={`flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors ${
              step === 0 ? "invisible" : ""
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                canProceed()
                  ? "bg-amber-400 text-black hover:bg-amber-300"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-amber-400 text-black hover:bg-amber-300 transition-all"
            >
              Let's start <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthPanel() {
  const { uid, user } = useAuth();
  const [mode, setMode] = useState<"sign_up" | "sign_in">("sign_up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Reset messages when toggling mode
  useEffect(() => { setErr(null); setInfo(null); }, [mode]);

  if (uid) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <p className="text-xs uppercase tracking-widest text-emerald-400/70 mb-1">Signed in</p>
        <p className="text-sm text-white/80">Your moment will save to {user?.email}.</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        setInfo("Check your email to confirm, then sign in.");
        setMode("sign_in");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Save your moment</p>
        <p className="text-sm text-white/60">
          Create an account so your goal, plan, and progress sync across devices. Optional — you can skip and stay local.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/50"
        />
        <input
          type="password" required minLength={8}
          placeholder={mode === "sign_up" ? "Password (8+ chars)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-amber-400/50"
        />
        {err && <p className="text-xs text-rose-300">{err}</p>}
        {info && <p className="text-xs text-emerald-300">{info}</p>}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === "sign_up" ? "sign_in" : "sign_up")}
            className="text-xs text-white/40 hover:text-white/70"
          >
            {mode === "sign_up" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs px-3 py-1.5 disabled:opacity-50"
          >
            {busy ? "…" : mode === "sign_up" ? "Create account" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
