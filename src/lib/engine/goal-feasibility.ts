import type { GoalFeasibilityReport } from "@/lib/types";

export interface FeasibilityInput {
  goal: string;
  age_bracket: string;
  school_year?: string;       // structural position, e.g. "Year 10"
  stage_of_life?: string;     // e.g. "School student", "University"
  pursuit_family: string;     // e.g. "future_doctor_neurology"
  current_level?: string;     // raw chip answer from Stage 4: "a little", "some foundation", etc.
  current_stage: string;      // synthesised capability stage (NOT school_year)
}

function isTeen(age_bracket: string): boolean {
  return age_bracket === "teen_13_15" || age_bracket === "teen_16_18";
}

function isSchoolAge(age_bracket: string): boolean {
  return isTeen(age_bracket) || age_bracket === "under_13";
}

function goalContains(goal: string, terms: string[]): boolean {
  const lower = goal.toLowerCase();
  return terms.some((t) => lower.includes(t));
}

function synthesiseCurrentStage(input: FeasibilityInput): string {
  if (input.current_stage && input.current_stage.trim()) return input.current_stage.trim();

  const levelMap: Record<string, string> = {
    "not at all": "no foundation yet",
    "a little": "beginner with minimal exposure",
    "some foundation": "some foundational knowledge",
    "quite a lot": "developing practitioner",
    "advanced": "advanced student",
  };

  const levelKey = (input.current_level ?? "").toLowerCase().trim();
  const levelDesc = levelMap[levelKey] ?? "unknown level";

  if (input.school_year) {
    return `${input.school_year} student — ${levelDesc}`;
  }
  if (input.stage_of_life) {
    return `${input.stage_of_life} — ${levelDesc}`;
  }
  return levelDesc;
}

function detectGoalType(goal: string, pursuit_family: string): GoalFeasibilityReport["goal_type"] {
  const lower = goal.toLowerCase();
  const family = pursuit_family.toLowerCase();

  if (family.includes("doctor") || family.includes("medical") || family.includes("neuro") ||
      lower.includes("doctor") || lower.includes("medicine") || lower.includes("neurol") ||
      lower.includes("surgeon") || lower.includes("physician")) return "career";

  if (family.includes("startup") || family.includes("founder") || lower.includes("startup") ||
      lower.includes("entrepreneur") || lower.includes("business")) return "business";

  if (family.includes("academic") || family.includes("exam") || lower.includes("university") ||
      lower.includes("college") || lower.includes("exam") || lower.includes("degree")) return "academic";

  if (lower.includes("fitness") || lower.includes("sport") || lower.includes("athlete")) return "fitness";

  if (lower.includes("creative") || lower.includes("art") || lower.includes("music") ||
      lower.includes("write") || lower.includes("film")) return "creative";

  if (lower.includes("year") || lower.includes("decade") || lower.includes("long")) return "long_term";
  return "near_term";
}

export function evaluateGoalFeasibility(input: FeasibilityInput): GoalFeasibilityReport {
  const { goal, age_bracket, pursuit_family } = input;
  const userIsTeen = isTeen(age_bracket);
  const userIsSchoolAge = isSchoolAge(age_bracket);
  const goal_type = detectGoalType(goal, pursuit_family);
  const current_stage = synthesiseCurrentStage(input);

  // Medical / neurology pathway
  const isMedicalGoal = goalContains(goal, [
    "doctor", "medicine", "medical", "neurolog", "surgeon", "physician",
    "psychiatr", "pediatr", "cardiolog",
  ]) || pursuit_family.includes("doctor") || pursuit_family.includes("neuro") ||
    pursuit_family.includes("medical");

  if (isMedicalGoal && userIsSchoolAge) {
    const isTeen16 = age_bracket === "teen_16_18";
    const isYoungerTeen = age_bracket === "teen_13_15" || age_bracket === "under_13";
    return {
      goal_is_possible: true,
      goal_type: "career",
      user_stage: current_stage || "school student — foundation stage",
      target_stage: "medical professional (after 10+ years of study and training)",
      reality_gap:
        "You are aiming at a long medical pathway, but you are currently at the school foundation stage. " +
        "Moment's job is not to pretend you are in medicine. It is to build the bridge from school " +
        "foundations → science prerequisites → university pathway → medical training → specialisation.",
      risk_of_bad_advice: "high",
      premature_recommendations: [
        "clinical patient case review",
        "medical school interview prep",
        "residency preparation",
        "hospital rotation planning",
        "advanced neuroanatomy as daily work",
        "diagnosing patients",
        "treatment plan development",
        "medical licensing tasks",
        "MCAT preparation",
        "USMLE study",
      ],
      appropriate_focus_now: isTeen16
        ? [
            "biology and chemistry foundations",
            "study system and habits for science",
            "career pathway research (neurology vs neuroscience vs psychology)",
            "subject selection planning for university entry",
            "science reading and curiosity projects",
            "teacher or careers-advisor conversations",
            "academic performance in science subjects",
            "small independent projects (blog, science competition, explainer)",
            "understanding the medical pathway timeline",
          ]
        : [
            "curiosity about how the brain works (books, videos, podcasts)",
            "biology basics at school level",
            "talking to older students or family about the pathway",
            "study skills and reading habits",
            "science clubs or competitions",
          ],
      next_clarifying_question: isYoungerTeen
        ? "Which science subjects are you studying at school right now?"
        : "Have you started biology or chemistry A-levels / IB / AP yet?",
    };
  }

  // Startup / entrepreneurship pathway for teens
  const isStartupGoal = goalContains(goal, [
    "startup", "entrepreneur", "founder", "raise", "funding", "investor",
  ]) || pursuit_family.includes("startup") || pursuit_family.includes("founder");

  if (isStartupGoal && userIsTeen) {
    return {
      goal_is_possible: true,
      goal_type: "business",
      user_stage: current_stage || "teen explorer",
      target_stage: "independent builder and entrepreneur",
      reality_gap:
        "Building things is completely age-appropriate. Raising institutional funding, signing contracts, " +
        "and running a company payroll are not. Moment will focus on building, shipping, and learning — " +
        "the parts you can do right now.",
      risk_of_bad_advice: "medium",
      premature_recommendations: [
        "raising venture capital",
        "hiring employees",
        "incorporating a company (as primary task)",
        "pitching to institutional investors",
        "revenue contracts with enterprises",
      ],
      appropriate_focus_now: [
        "build a small product that solves a real problem",
        "ship something publicly (website, app, tool)",
        "talk to potential users before building",
        "learn the core skill you need (coding, design, copywriting)",
        "build in public — share what you are making",
        "find one mentor or community in your domain",
      ],
    };
  }

  // Law / legal profession for teens
  const isLegalGoal = goalContains(goal, [
    "lawyer", "attorney", "law school", "barrister", "solicitor", "legal",
  ]) || pursuit_family.includes("law");

  if (isLegalGoal && userIsSchoolAge) {
    return {
      goal_is_possible: true,
      goal_type: "career",
      user_stage: current_stage || "school student",
      target_stage: "qualified legal professional (after ~7 years of study and training)",
      reality_gap:
        "Law is a long pathway. You are at the foundation stage. " +
        "The best moves now are building the habits, skills, and subject choices that make the pathway possible.",
      risk_of_bad_advice: "medium",
      premature_recommendations: [
        "bar exam preparation",
        "law school applications (if not in final year)",
        "client case analysis",
        "courtroom practice",
      ],
      appropriate_focus_now: [
        "critical thinking and argumentation skills",
        "English and essay writing",
        "debate or public speaking",
        "reading about landmark cases",
        "subject choices that support law entry",
        "work experience or shadowing (where possible)",
      ],
    };
  }

  // CS / engineering / university admissions
  const isCsAcademicGoal = goalContains(goal, [
    "stanford", "mit", "ivy", "oxford", "cambridge", "computer science",
    "engineering degree", "cs degree",
  ]);

  if (isCsAcademicGoal && userIsSchoolAge) {
    return {
      goal_is_possible: true,
      goal_type: "academic",
      user_stage: current_stage || "school student preparing for university",
      target_stage: "university student at target institution",
      reality_gap:
        "University admissions require strong grades, relevant projects, and a compelling application. " +
        "Moment will focus on the concrete preparation that makes the application strong.",
      risk_of_bad_advice: "low",
      premature_recommendations: [
        "university-level coursework as primary study (not supplementary)",
        "postgraduate research tasks",
      ],
      appropriate_focus_now: [
        "target grade achievement in relevant subjects",
        "personal statement / common app essay drafts",
        "side projects that demonstrate technical interest",
        "preparation for relevant standardised tests",
        "teacher recommendation letter relationships",
        "extracurricular activities in the domain",
      ],
    };
  }

  // Generic adult or adult-like goal
  const riskLevel: GoalFeasibilityReport["risk_of_bad_advice"] =
    age_bracket === "unknown" ? "medium" : (userIsTeen && goal_type === "career") ? "medium" : "low";

  return {
    goal_is_possible: true,
    goal_type,
    user_stage: current_stage || (age_bracket === "unknown" ? "unknown stage" : "active learner"),
    target_stage: goal.slice(0, 60),
    reality_gap:
      age_bracket === "unknown"
        ? "Moment doesn't yet know your age or stage. Tasks will be exploratory and safe until you share more context."
        : "Working from your current stage toward your goal.",
    risk_of_bad_advice: riskLevel,
    premature_recommendations: [],
    appropriate_focus_now: [],
    next_clarifying_question:
      age_bracket === "unknown"
        ? "What stage of life are you at right now? (school, university, working, etc.)"
        : undefined,
  };
}
