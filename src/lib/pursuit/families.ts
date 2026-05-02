import type { MomentState } from "@/lib/types";

export const PURSUIT_FAMILIES = [
  "future_doctor_neurology",
  "startup_founder",
  "exam_dominant_student",
  "generic",
] as const;

export type PursuitFamily = (typeof PURSUIT_FAMILIES)[number];

type Goal = MomentState["active_goal"];

interface SeedStandard {
  id: string;
  name: string;
  description: string;
  target_value: string;
  trajectory: "below" | "at_risk" | "on_track" | "ahead";
  kind: string;
}

interface SeedCapability {
  id: string;
  name: string;
  description: string;
  status: "not_started" | "emerging" | "developing" | "solid" | "mastered";
  why_it_matters: string;
}

interface SeedWorkstream {
  id: string;
  name: string;
  description: string;
  status: "not_started" | "on_track" | "slipping" | "stalled" | "complete";
  priority: "critical" | "high" | "medium" | "low";
  bottleneck: string;
  next_proof: string;
}

interface SeedRisk {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  mitigation: string;
}

interface SeedSignal {
  id: string;
  name: string;
  kind: "leading" | "lagging";
  description: string;
  cadence: string;
  target: string;
}

interface SeedMode {
   id: string;
   name: string;
   description: string;
   stance: string;
   when_to_use: string;
}

export interface FamilyTemplate {
   family: PursuitFamily;
   standards: SeedStandard[];
   capabilities: SeedCapability[];
   workstreams: SeedWorkstream[];
   risks: SeedRisk[];
   signals: SeedSignal[];
   modes: SeedMode[];
   defaultActiveModeId: string;
   summary: string;
   assumptions: string[];
}

const KEYWORDS: Record<Exclude<PursuitFamily, "generic">, string[]> = {
   future_doctor_neurology: [
      "neurologist",
      "neurology",
      "medicine",
      "med school",
      "medical school",
      "mcat",
      "doctor",
      "physician",
      "pre-med",
   ],
   startup_founder: [
      "startup",
      "founder",
      "founding",
      "yc",
      "y combinator",
      "product-market fit",
      "pmf",
      "company",
      "saas",
   ],
   exam_dominant_student: [
      "exam",
      "mcat",
      "lsat",
      "gre",
      "sat",
      "board",
      "boards",
      "finals",
      "midterm",
   ],
};

function buildHaystack(goal: Goal): string {
   return `${goal?.statement || ""} ${goal?.why_it_matters || ""}`.toLowerCase();
}

function scoreFamily(goal: Goal, family: Exclude<PursuitFamily, "generic">): { confidence: number; matched: string[] } {
  const haystack = buildHaystack(goal);
  const words = KEYWORDS[family];
  let hits = 0;
  const matched = [];
  for (const word of words) {
     if (haystack.includes(word.toLowerCase())) {
       hits += 1;
       matched.push(word);
     }
  }
  if (hits === 0) return { confidence: 0, matched: [] };
  // Normalize to 50..100: first hit is 50, every additional hit scales up.
  const density = Math.min(1, hits / Math.max(2, words.length / 3));
  return { confidence: Math.round(50 + density * 50), matched };
}

export function inferPursuitFamily(goal: Goal): { family: PursuitFamily; confidence: number; matchedKeywords?: string[] } {
  let best: { family: PursuitFamily; confidence: number; matchedKeywords?: string[] } = { family: "generic", confidence: 50 };
  const candidates: Exclude<PursuitFamily, "generic">[] = [
     "future_doctor_neurology",
     "startup_founder",
     "exam_dominant_student",
  ];

  for (const fam of candidates) {
     const { confidence, matched } = scoreFamily(goal, fam);
     if (confidence > best.confidence) {
       best = { family: fam, confidence, matchedKeywords: matched };
     }
  }

  return best;
}

// --- Family templates ---

export function buildGenericTemplate(goal: Goal): FamilyTemplate {
  const statement = goal.statement.trim() || "your pursuit";

  return {
     family: "generic",
     standards: [
       {
          id: "std:generic:consistency",
          name: "Consistency",
          description: "Show up and advance the pursuit on a regular cadence.",
          target_value: "Most days of the week",
          trajectory: "on_track",
          kind: "behavioral",
       },
       {
          id: "std:generic:focus",
          name: "Focus quality",
          description: "Each session produces a concrete unit of progress.",
          target_value: "One clear output per session",
          trajectory: "on_track",
          kind: "behavioral",
      },
   ],
   capabilities: [
      {
         id: "cap:generic:core_skills",
         name: "Core Skills",
         description: `The fundamental abilities ${statement} depends on.`,
         status: "emerging",
         why_it_matters: "Without the core skills, nothing else compounds.",
      },
   ],
   workstreams: [
      {
         id: "ws:generic:daily_execution",
         name: "Daily execution",
         description: "Small, steady acts that keep the pursuit alive.",
         status: "on_track",
         priority: "high",
         bottleneck: "",
         next_proof: "Complete one focused session today.",
      },
   ],
   risks: [
      {
         id: "risk:generic:drift",
         name: "Drift",
         description: "Days without progress quietly compound into weeks.",
         severity: "medium",
         mitigation: "Check alignment weekly; recommit when drifting.",
      },
   ],
   signals: [
      {
         id: "sig:generic:sessions_per_week",
         name: "Sessions per week",
         kind: "leading",
         description: "Count of focused work sessions this week.",
         cadence: "weekly",
         target: "5",
      },
      {
         id: "sig:generic:outcomes",
         name: "Tangible outcomes",
         kind: "lagging",
         description: "Artifacts, wins, or milestones reached.",
         cadence: "monthly",
         target: "1+",
      },
   ],
   modes: [
      {
         id: "mode:generic:steady",
         name: "Steady build",
         description: "Consistent low-friction progress.",
         stance: "One small action per day beats intensity.",
         when_to_use: "Default when no crisis or deadline is pressing.",
      },
      {
         id: "mode:generic:push",
         name: "Push",
           description: "Short burst of elevated effort.",
           stance: "Compress calendar around the pursuit.",
           when_to_use: "When a deadline or opportunity is imminent.",
        },
        {
           id: "mode:generic:recover",
           name: "Recover",
           description: "Protect sleep and reduce load.",
           stance: "Rest is a feature, not a failure.",
           when_to_use: "When signs of burnout or drift are clear.",
        },
     ],
     defaultActiveModeId: "mode:generic:steady",
     summary: `A generic pursuit frame: show up consistently toward "${statement}".`,
     assumptions: [
        "No pursuit-specific family matched, so generic defaults are used.",
        "You can refine standards, workstreams, and risks as specifics emerge.",
     ],
  };
}

function buildFutureDoctorNeurologyTemplate(goal: Goal): FamilyTemplate {
  const why = goal.why_it_matters.trim();

  return {
     family: "future_doctor_neurology",
     standards: [
        {
           id: "std:future_doctor_neurology:clinical_reasoning",
           name: "Clinical reasoning",
           description: "Translate symptoms into differentials and mechanism-based explanations.",
           target_value: "Confident on weekly case sets",
           trajectory: "at_risk",
           kind: "cognitive",
        },
        {
           id: "std:future_doctor_neurology:content_mastery",
           name: "Content mastery",
           description: "Core neuroscience, anatomy, and pharmacology held in long-term memory.",
           target_value: "Spaced repetition deck stable",
           trajectory: "on_track",
           kind: "knowledge",
        },
        {
           id: "std:future_doctor_neurology:exam_performance",
           name: "Exam performance",
           description: "Practice exam scores trending toward your target.",
           target_value: "Above program threshold",
           trajectory: "below",
           kind: "outcome",
        },
        {
           id: "std:future_doctor_neurology:endurance",
           name: "Endurance & health",
           description: "Sleep, exercise, and recovery protected under academic load.",
           target_value: "Sleep floor held, 3+ exercise sessions weekly",
           trajectory: "at_risk",
           kind: "physical",
        },
     ],
   capabilities: [
      {
         id: "cap:future_doctor_neurology:neuroanatomy",
         name: "Neuroanatomy",
         description: "Structure-function maps of the central and peripheral nervous system.",
         status: "developing",
         why_it_matters: "Foundation for localization and differential diagnosis.",
      },
      {
         id: "cap:future_doctor_neurology:pathophysiology",
         name: "Pathophysiology",
         description: "How neurologic disease processes unfold.",
         status: "emerging",
         why_it_matters: "Converts memorization into reasoning.",
      },
      {
         id: "cap:future_doctor_neurology:clinical_exam",
         name: "Clinical exam",
         description: "Neurologic examination and history-taking.",
         status: "emerging",
         why_it_matters: "Bridges classroom to bedside.",
      },
      {
         id: "cap:future_doctor_neurology:test_taking",
         name: "Test-taking craft",
         description: "Question-dissection, pacing, and self-correction.",
         status: "developing",
         why_it_matters: "Raw knowledge alone does not clear exams.",
      },
   ],
   workstreams: [
      {
         id: "ws:future_doctor_neurology:daily_study_block",
         name: "Daily study block",
         description: "Protected deep work for content + practice questions.",
         status: "on_track",
         priority: "critical",
         bottleneck: "",
         next_proof: "Complete today's question set with a review pass.",
      },
      {
         id: "ws:future_doctor_neurology:weekly_review",
         name: "Weekly review",
         description: "Consolidate the week's learning and surface weak areas.",
         status: "slipping",
         priority: "high",
         bottleneck: "Reviews often skipped under load.",
         next_proof: "Write a 1-page weak-area digest this Sunday.",
      },
      {
         id: "ws:future_doctor_neurology:clinical_exposure",
         name: "Clinical exposure",
         description: "Shadowing, case conferences, or patient encounters.",
         status: "on_track",
         priority: "medium",
         bottleneck: "",
         next_proof: "Attend one case conference this week.",
      },
      {
         id: "ws:future_doctor_neurology:health_maintenance",
       name: "Health maintenance",
       description: "Sleep, exercise, nutrition, and recovery rhythms.",
       status: "slipping",
       priority: "high",
       bottleneck: "Late-night study erodes sleep floor.",
       next_proof: "Hold sleep floor 5 of 7 nights this week.",
      },
   ],
   risks: [
      {
         id: "risk:future_doctor_neurology:burnout",
         name: "Burnout",
         description: "Sustained over-load leading to collapse in productivity.",
         severity: "high",
         mitigation: "Weekly off-block; monitor sleep and energy.",
      },
      {
         id: "risk:future_doctor_neurology:exam_miss",
         name: "Missed exam threshold",
         description: "Practice scores not converging to target.",
         severity: "critical",
         mitigation: "Diagnose gaps early; adjust study ratios.",
      },
      {
         id: "risk:future_doctor_neurology:identity_narrowing",
         name: "Identity narrowing",
         description: "Losing non-medical parts of self during the pursuit.",
         severity: "medium",
         mitigation: "Keep one protected non-medical weekly ritual.",
      },
   ],
   signals: [
      {
         id: "sig:future_doctor_neurology:practice_score",
         name: "Practice exam score",
         kind: "lagging",
         description: "Most recent full-length practice score.",
         cadence: "biweekly",
         target: "Above program threshold",
      },
      {
         id: "sig:future_doctor_neurology:questions_per_day",
         name: "Questions per day",
         kind: "leading",
         description: "Practice questions attempted and reviewed.",
         cadence: "daily",
         target: "40+",
      },
      {
         id: "sig:future_doctor_neurology:sleep_hours",
         name: "Sleep hours",
         kind: "leading",
         description: "Average nightly sleep this week.",
         cadence: "weekly",
         target: "7+",
      },
   ],
   modes: [
      {
         id: "mode:future_doctor_neurology:deep_study",
           name: "Deep study",
           description: "Protected daily block for content and reasoning.",
           stance: "Questions first, review always, no passive reading.",
           when_to_use: "Default outside exam weeks or recovery.",
        },
        {
           id: "mode:future_doctor_neurology:exam_push",
           name: "Exam push",
           description: "Short burst before a major exam.",
           stance: "Maximize retrieval practice, trim everything non-essential.",
           when_to_use: "Within 10 days of a high-stakes exam.",
        },
        {
           id: "mode:future_doctor_neurology:recover",
           name: "Recover",
           description: "Rebuild sleep and physical baseline.",
           stance: "Protect health; study load halved.",
           when_to_use: "After exams or when sleep and energy collapse.",
        },
     ],
     defaultActiveModeId: "mode:future_doctor_neurology:deep_study",
     summary:
        why.length > 0
           ? `A medicine/neurology pursuit grounded in: ${why}`
           : "A medicine/neurology pursuit: build clinical reasoning and exam-ready mastery while protecting health.",
     assumptions: [
        "You are on a path toward medical training, board-style exams, and ultimately neurology.",
        "Sleep and exercise are load-bearing, not optional, for sustained performance.",
        "Practice questions outperform passive reading for exam conversion.",
     ],
  };
}

function buildStartupFounderTemplate(goal: Goal): FamilyTemplate {
  const why = goal.why_it_matters.trim();

  return {
     family: "startup_founder",
     standards: [
        {
           id: "std:startup_founder:customer_learning",
           name: "Customer learning rate",
           description: "Frequency of grounded conversations with real users.",
           target_value: "5+ customer conversations weekly",
           trajectory: "at_risk",
           kind: "discovery",
        },
        {
           id: "std:startup_founder:ship_velocity",
           name: "Ship velocity",
           description: "How often a real improvement reaches users.",
           target_value: "Weekly meaningful release",
           trajectory: "on_track",
           kind: "execution",
        },
        {
           id: "std:startup_founder:runway_discipline",
           name: "Runway discipline",
           description: "Burn vs runway tracked and respected.",
           target_value: "12+ months runway held",
       trajectory: "on_track",
       kind: "financial",
     },
     {
       id: "std:startup_founder:founder_health",
       name: "Founder health",
       description: "Sleep, exercise, and relationships protected.",
       target_value: "Sleep floor held, 3+ exercise sessions weekly",
       trajectory: "at_risk",
       kind: "physical",
      },
   ],
   capabilities: [
      {
         id: "cap:startup_founder:customer_discovery",
         name: "Customer discovery",
         description: "Running interviews that expose truth, not validation.",
         status: "developing",
         why_it_matters: "Most startup death comes from solving a wrong problem.",
      },
      {
         id: "cap:startup_founder:product_building",
         name: "Product building",
         description: "Shipping real software quickly and cleanly.",
         status: "solid",
         why_it_matters: "Velocity compounds into real iteration cycles.",
      },
      {
         id: "cap:startup_founder:distribution",
         name: "Distribution",
         description: "Reaching the right users repeatably.",
         status: "emerging",
         why_it_matters: "A great product without distribution quietly dies.",
      },
      {
         id: "cap:startup_founder:financial_ops",
         name: "Financial ops",
         description: "Cash-in, cash-out, runway, basic accounting hygiene.",
         status: "developing",
         why_it_matters: "Without runway, all other work stops.",
      },
   ],
   workstreams: [
      {
         id: "ws:startup_founder:customer_discovery",
         name: "Customer discovery",
         description: "Interviews, demos, and feedback loops with prospective users.",
         status: "slipping",
         priority: "critical",
         bottleneck: "Too little time with users.",
         next_proof: "Book 5 customer conversations this week.",
      },
      {
         id: "ws:startup_founder:product_build",
         name: "Product build",
         description: "The core product improvements shipping to users.",
         status: "on_track",
         priority: "critical",
         bottleneck: "",
         next_proof: "Ship one user-visible improvement this week.",
     },
     {
       id: "ws:startup_founder:distribution",
       name: "Distribution",
       description: "Channels through which users discover and sign up.",
       status: "slipping",
       priority: "high",
       bottleneck: "No repeatable acquisition channel identified.",
       next_proof: "Run one channel experiment and measure signup lift.",
     },
     {
       id: "ws:startup_founder:ops_finance",
       name: "Ops & finance",
       description: "Runway, tax, hiring, and administrative basics.",
       status: "on_track",
       priority: "medium",
       bottleneck: "",
       next_proof: "Confirm runway and burn rate monthly.",
      },
   ],
   risks: [
      {
         id: "risk:startup_founder:wrong_problem",
         name: "Wrong problem",
         description: "Building something users do not urgently want.",
         severity: "critical",
         mitigation: "Stay close to users; kill features without demand.",
      },
      {
         id: "risk:startup_founder:runway_collapse",
         name: "Runway collapse",
         description: "Running out of cash before reaching next milestone.",
         severity: "critical",
         mitigation: "Track burn weekly; cut before you must.",
      },
      {
         id: "risk:startup_founder:founder_burnout",
         name: "Founder burnout",
         description: "Founder collapse becomes company collapse.",
         severity: "high",
         mitigation: "Sleep floor, one non-work ritual, honest check-ins.",
      },
   ],
   signals: [
      {
         id: "sig:startup_founder:weekly_conversations",
         name: "Customer conversations",
         kind: "leading",
         description: "User interviews or demos this week.",
         cadence: "weekly",
         target: "5+",
      },
      {
         id: "sig:startup_founder:active_users",
         name: "Active users",
         kind: "lagging",
         description: "Weekly active users engaging with the product.",
         cadence: "weekly",
         target: "Growth week over week",
      },
        {
           id: "sig:startup_founder:runway_months",
           name: "Runway months",
           kind: "lagging",
           description: "Months of runway at current burn.",
           cadence: "monthly",
           target: "12+",
        },
     ],
     modes: [
        {
           id: "mode:startup_founder:discovery",
           name: "Discovery",
           description: "Tilted toward learning what to build.",
           stance: "Talk to users more than you write code.",
           when_to_use: "Before strong signal of product-market fit.",
        },
        {
           id: "mode:startup_founder:build",
           name: "Build",
           description: "Tilted toward shipping and iterating.",
           stance: "Weekly releases; tight feedback loops.",
           when_to_use: "When you have a clear user pull to serve.",
        },
        {
           id: "mode:startup_founder:scale",
           name: "Scale",
           description: "Tilted toward distribution and repeatability.",
           stance: "Invest in channels and systems.",
           when_to_use: "Once retention and signal are strong.",
        },
        {
           id: "mode:startup_founder:recover",
           name: "Recover",
           description: "Protect founder health before anything else.",
           stance: "Reduce load, rebuild baseline.",
           when_to_use: "When burnout signals appear.",
        },
     ],
     defaultActiveModeId: "mode:startup_founder:discovery",
     summary:
        why.length > 0
           ? `A startup founder pursuit grounded in: ${why}`
           : "A startup founder pursuit: learn fast, ship weekly, respect runway, protect the founder.",
     assumptions: [
        "Product-market fit is not yet obvious; learning outweighs scaling.",
        "Runway and founder health are non-negotiable constraints.",
        "Shipping velocity is load-bearing for learning velocity.",
     ],
  };
}

function buildExamDominantStudentTemplate(goal: Goal): FamilyTemplate {
  const statement = goal.statement.trim() || "your exam";

  return {
     family: "exam_dominant_student",
     standards: [
        {
           id: "std:exam_dominant_student:practice_score",
       name: "Practice score",
       description: "Recent full-length practice exam score.",
       target_value: "Above your target threshold",
       trajectory: "below",
       kind: "outcome",
     },
     {
       id: "std:exam_dominant_student:daily_volume",
       name: "Daily volume",
       description: "Practice questions attempted and reviewed per day.",
       target_value: "40+ questions daily",
       trajectory: "at_risk",
       kind: "behavioral",
     },
     {
       id: "std:exam_dominant_student:content_coverage",
       name: "Content coverage",
       description: "Portions of the exam domain covered so far.",
       target_value: "All sections touched before review phase",
       trajectory: "on_track",
       kind: "knowledge",
     },
     {
       id: "std:exam_dominant_student:sleep_floor",
       name: "Sleep floor",
       description: "Nightly sleep during prep.",
       target_value: "7+ hours most nights",
       trajectory: "at_risk",
       kind: "physical",
      },
   ],
   capabilities: [
      {
         id: "cap:exam_dominant_student:content_mastery",
         name: "Content mastery",
         description: "The tested knowledge domain held in memory.",
         status: "developing",
         why_it_matters: "You cannot reason without the underlying facts.",
      },
      {
         id: "cap:exam_dominant_student:test_strategy",
         name: "Test strategy",
         description: "Pacing, elimination, and question triage.",
         status: "emerging",
         why_it_matters: "Most raw-knowledge students leave points on the table.",
      },
      {
         id: "cap:exam_dominant_student:error_analysis",
         name: "Error analysis",
         description: "Learning from missed questions and patterns.",
         status: "emerging",
         why_it_matters: "Unreviewed misses repeat themselves on exam day.",
      },
   ],
   workstreams: [
      {
         id: "ws:exam_dominant_student:daily_questions",
         name: "Daily questions",
         description: "Steady daily question volume with review.",
         status: "on_track",
       priority: "critical",
       bottleneck: "",
       next_proof: "Complete today's question set and a review pass.",
     },
     {
       id: "ws:exam_dominant_student:practice_exams",
       name: "Practice exams",
       description: "Periodic full-length simulations.",
       status: "slipping",
       priority: "high",
       bottleneck: "Full-lengths often skipped due to fatigue.",
       next_proof: "Sit one full-length this weekend.",
     },
     {
       id: "ws:exam_dominant_student:weak_area_cleanup",
       name: "Weak-area cleanup",
       description: "Targeted review of consistently missed topics.",
       status: "slipping",
       priority: "high",
       bottleneck: "Weak areas not yet tracked.",
       next_proof: "Maintain a living weak-area list and hit top 3 this week.",
     },
     {
       id: "ws:exam_dominant_student:sleep_protection",
       name: "Sleep protection",
       description: "Guarding the sleep floor during the push.",
       status: "on_track",
       priority: "medium",
       bottleneck: "",
       next_proof: "Hold sleep floor 5 of 7 nights this week.",
      },
   ],
   risks: [
      {
         id: "risk:exam_dominant_student:cramming",
         name: "Cramming collapse",
         description: "Late-stage compression that erodes retention.",
         severity: "high",
         mitigation: "Front-load content; taper before exam.",
      },
      {
         id: "risk:exam_dominant_student:no_error_review",
         name: "Unreviewed errors",
         description: "Doing questions without extracting lessons.",
         severity: "high",
         mitigation: "Review is mandatory; no review, no credit.",
      },
      {
         id: "risk:exam_dominant_student:sleep_debt",
         name: "Sleep debt",
         description: "Lost sleep tanks exam-day performance.",
         severity: "medium",
         mitigation: "Hold sleep floor even under load.",
      },
   ],
   signals: [
      {
         id: "sig:exam_dominant_student:score_trend",
         name: "Score trend",
         kind: "lagging",
            description: "Most recent practice exam score.",
            cadence: "biweekly",
            target: "Target threshold",
         },
         {
            id: "sig:exam_dominant_student:questions_per_day",
            name: "Questions per day",
            kind: "leading",
            description: "Daily practice question count.",
            cadence: "daily",
            target: "40+",
         },
         {
            id: "sig:exam_dominant_student:review_ratio",
            name: "Review ratio",
            kind: "leading",
            description: "Fraction of attempted questions that were reviewed.",
            cadence: "weekly",
            target: "100%",
         },
      ],
      modes: [
         {
            id: "mode:exam_dominant_student:build",
            name: "Build phase",
            description: "Broad content coverage with questions.",
            stance: "Touch every section; finish the deck.",
            when_to_use: "Early and middle prep.",
         },
         {
            id: "mode:exam_dominant_student:sharpen",
            name: "Sharpen",
            description: "Full-lengths and targeted cleanup.",
            stance: "Full-lengths weekly; weak-area drills daily.",
            when_to_use: "Final weeks before the exam.",
         },
         {
            id: "mode:exam_dominant_student:taper",
            name: "Taper",
            description: "Light practice and rest before exam day.",
            stance: "Preserve state; do not cram.",
            when_to_use: "Final 3-5 days.",
         },
      ],
      defaultActiveModeId: "mode:exam_dominant_student:build",
      summary: `An exam-dominant pursuit focused on ${statement}: convert daily reps and review into a real score gain.`,
      assumptions: [
         "Question volume with review beats passive content consumption.",
         "Sleep and taper matter as much as raw hours studied.",
         "Weak areas tracked explicitly convert faster than vague worry.",
      ],
   };
}

export const FAMILY_BUILDERS: Record<PursuitFamily, (goal: Goal) => FamilyTemplate> = {
   future_doctor_neurology: buildFutureDoctorNeurologyTemplate,
   startup_founder: buildStartupFounderTemplate,
   exam_dominant_student: buildExamDominantStudentTemplate,
   generic: buildGenericTemplate,
};

export function buildFamilyTemplate(goal: Goal, family?: PursuitFamily): FamilyTemplate {
  const resolved = family ?? inferPursuitFamily(goal).family;
  const builder = FAMILY_BUILDERS[resolved] ?? buildGenericTemplate;
  return builder(goal);
}
