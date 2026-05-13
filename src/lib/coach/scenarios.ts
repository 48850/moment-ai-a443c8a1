/**
 * 20 synthetic training scenarios. Each scenario describes a recognisable
 * teen-pursuit pattern Moment must learn to handle: bottleneck, sharp probe,
 * Forge features that genuinely help, and the AI behaviour that's correct
 * (and the kind that isn't).
 *
 * Used by:
 *   • match-scenario.ts — picks the 1–2 most relevant for the live state
 *   • app-intelligence — passed as few-shot context so AI replies follow the
 *     diagnostic loop instead of generic motivation-speak.
 */

export interface CoachScenario {
  id: string;
  label: string;
  /** Human one-liner describing the user pattern. */
  user_pattern: string;
  /** What Moment must INFER (not what the user says). */
  inferred_bottleneck: string;
  /** Single sharp probe — 'one missing question if needed'. */
  probe: string;
  /** Forge features (named, not generic). */
  forge_features: string[];
  /** What 'correct AI behaviour' looks like for this scenario. */
  correct_behaviour: string;
  /** Heuristic triggers — used by the matcher to score live state. */
  triggers: {
    /** Substrings searched in goal.statement + why_it_matters (lowercased). */
    goal_keywords?: string[];
    /** Feedback options that signal this scenario when present. */
    feedback_signals?: string[];
    /** True if scenario is plausible when these conditions match. */
    needs_recent_rescue?: boolean;
    needs_low_velocity?: boolean;
    needs_high_overload?: boolean;
    needs_no_goal?: boolean;
  };
}

export const COACH_SCENARIOS: CoachScenario[] = [
  {
    id: "stanford_cs",
    label: "Stanford CS / High-Ambition Builder",
    user_pattern: "Strong student, builds apps, wants elite CS pathway.",
    inferred_bottleneck: "Converting ambition into visible proof — not motivation.",
    probe: "What would be more valuable this month: shipping one visible project proof, improving grades, or building application evidence?",
    forge_features: ["Application Evidence Bank", "Project Shipping Lab", "Deep Work Lab", "Weekly Proof Audit"],
    correct_behaviour: "Turn abstract ambition into concrete weekly proof. Avoid generic 'study hard' advice.",
    triggers: {
      goal_keywords: ["stanford", "mit", "cs", "computer science", "ivy", "elite"],
      feedback_signals: ["too_big", "too_vague", "feels_unrealistic"],
    },
  },
  {
    id: "future_doctor",
    label: "Future Doctor / Medical Pathway",
    user_pattern: "Year 11+, science-focused, family pressure, heavy workload.",
    inferred_bottleneck: "Needs evidence of mastery, not more passive study hours.",
    probe: "When science study breaks down, is it because you don't understand the content, avoid practice questions, or don't know what to prioritise?",
    forge_features: ["Science Error Lab", "Practice Question Tracker", "Medical Evidence Bank", "Weekly Mastery Audit"],
    correct_behaviour: "Prioritise active recall, mistake tracking, and workload triage.",
    triggers: {
      goal_keywords: ["medicine", "doctor", "medical", "umat", "ucat", "biomed", "biology", "chemistry"],
      feedback_signals: ["dont_understand", "feels_unrealistic", "too_much_today"],
    },
  },
  {
    id: "debating",
    label: "Debating / Public Speaking",
    user_pattern: "Active debater, weak under pressure, avoids rebuttal practice.",
    inferred_bottleneck: "Live response quality — not knowledge.",
    probe: "Is your biggest debate weakness case-building, rebuttal speed, expression, or staying calm under pressure?",
    forge_features: ["Debate Drill Lab", "Rebuttal Challenger", "Speech Scorecard", "Argument Bank"],
    correct_behaviour: "Create active drills, timed rebuttals, and feedback loops.",
    triggers: {
      goal_keywords: ["debate", "debating", "speech", "public speaking", "moot", "mun"],
    },
  },
  {
    id: "maths_recovery",
    label: "Maths Recovery",
    user_pattern: "Falling behind in maths, vague tasks, gets stuck early.",
    inferred_bottleneck: "Concept diagnosis and first-step clarity.",
    probe: "When you get stuck in maths, is it because you don't know the formula, don't know when to use it, or make errors halfway through?",
    forge_features: ["Maths Error Lab", "Concept Recovery Room", "First-Step Solver", "Practice Set Splitter"],
    correct_behaviour: "Break problems into error categories and small drills. Do not just say 'revise more.'",
    triggers: {
      goal_keywords: ["maths", "math", "algebra", "calculus", "geometry"],
      feedback_signals: ["need_help", "too_vague", "dont_understand", "hard"],
    },
  },
  {
    id: "athlete_balance",
    label: "Athlete Balancing School",
    user_pattern: "Trains multiple times a week, tired after school, falls behind on busy weeks.",
    inferred_bottleneck: "Energy-aware planning.",
    probe: "After training, do you still have mental energy for homework, or should Moment protect lighter work for those nights?",
    forge_features: ["Training-Day Plan B", "Recovery-Aware Homework Planner", "Performance Log", "Weekly Load Balancer"],
    correct_behaviour: "Schedule around energy realistically, not as if every day has equal capacity.",
    triggers: {
      goal_keywords: ["sport", "athlete", "soccer", "football", "rugby", "basketball", "tennis", "swim", "track", "rowing", "cricket", "training"],
      feedback_signals: ["tired", "wrong_time"],
    },
  },
  {
    id: "music_excellence",
    label: "Music Excellence",
    user_pattern: "Practising piano/violin/drums/vocals, plays through pieces without targeted improvement.",
    inferred_bottleneck: "Deliberate practice — not more playing.",
    probe: "Is your practice breaking down because you avoid hard sections, don't track mistakes, or don't know what 'better' means each session?",
    forge_features: ["Practice Quality Lab", "Mistake Loop Tracker", "Performance Prep Protocol", "Repertoire Progress Map"],
    correct_behaviour: "Turn practice into measurable improvement loops.",
    triggers: {
      goal_keywords: ["music", "piano", "violin", "guitar", "drums", "vocals", "singing", "audition", "amus", "lmus", "grade exam"],
    },
  },
  {
    id: "scholarship",
    label: "Scholarship / Selective Entry",
    user_pattern: "Preparing for selective exam, random practice, avoids reviewing mistakes.",
    inferred_bottleneck: "Weak feedback loops.",
    probe: "Are you losing marks mostly from speed, careless mistakes, unfamiliar content, or pressure?",
    forge_features: ["Exam Error Tracker", "Timed Drill Lab", "Weakness Heatmap", "Weekly Score Delta Log"],
    correct_behaviour: "Build a system around measurable improvement.",
    triggers: {
      goal_keywords: ["scholarship", "selective", "entrance exam", "11+", "isee", "ssat", "naplan"],
    },
  },
  {
    id: "creative_writer",
    label: "Creative Writer",
    user_pattern: "Wants to write a novel/poetry/stories. Starts many, finishes few.",
    inferred_bottleneck: "Output completion and revision structure.",
    probe: "Do you need help generating ideas, finishing drafts, or revising work you already have?",
    forge_features: ["Draft Completion Lab", "Scene Builder", "Revision Protocol", "Writing Proof Bank"],
    correct_behaviour: "Protect creative flow while still producing finished artifacts.",
    triggers: {
      goal_keywords: ["novel", "writing", "writer", "poetry", "short story", "short stories", "screenplay", "fiction"],
      feedback_signals: ["too_vague", "too_big"],
    },
  },
  {
    id: "founder",
    label: "Founder / Teen Startup Builder",
    user_pattern: "Building app/startup with AI coding tools, vision keeps expanding, prototypes feel shallow.",
    inferred_bottleneck: "Shipping useful features — not ideation.",
    probe: "What would prove this product is becoming real: one working feature, one user test, or one paid customer?",
    forge_features: ["Product Shipping Lab", "User Feedback Intake", "Feature Indispensability Audit", "Revenue Sprint Planner"],
    correct_behaviour: "Turn vision into proof, tests, and user-facing functionality.",
    triggers: {
      goal_keywords: ["startup", "founder", "saas", "launch", "product", "app", "build a", "shipping", "users"],
      feedback_signals: ["too_big", "too_vague"],
    },
  },
  {
    id: "low_motivation",
    label: "Student With Low Motivation",
    user_pattern: "Wants better grades, no strong long-term goal, avoids planning.",
    inferred_bottleneck: "Stability and small wins — not huge ambition.",
    probe: "What is the smallest area of school that would make life feel less out of control this week?",
    forge_features: ["Minimum Viable School Day", "Homework Triage Board", "10-Minute Start Protocol", "Weekly Reset"],
    correct_behaviour: "Do not over-motivate. Build trust through tiny visible progress.",
    triggers: {
      needs_no_goal: true,
      feedback_signals: ["not_relevant", "wrong_time"],
    },
  },
  {
    id: "burnout_high_achiever",
    label: "High Achiever Burning Out",
    user_pattern: "Strong student, too many commitments, often hits Rescue.",
    inferred_bottleneck: "Capacity overload.",
    probe: "What is the one commitment that is currently costing more energy than it returns?",
    forge_features: ["Capacity Audit", "Plan B Switchboard", "Commitment Triage", "Recovery-Protected Planner"],
    correct_behaviour: "Preserve ambition but reduce unsustainable load.",
    triggers: {
      needs_recent_rescue: true,
      needs_high_overload: true,
      feedback_signals: ["too_much_today", "overwhelmed", "tired"],
    },
  },
  {
    id: "language_learning",
    label: "Language Learning",
    user_pattern: "Learning Japanese/French/Mandarin etc. Uses apps passively, avoids speaking.",
    inferred_bottleneck: "Active production.",
    probe: "Do you want to improve speaking, listening, writing, vocabulary, or exam performance first?",
    forge_features: ["Speaking Drill Lab", "Vocabulary Recall Tracker", "Writing Correction Loop", "Conversation Simulator"],
    correct_behaviour: "Create active language use, not just study reminders.",
    triggers: {
      goal_keywords: ["japanese", "french", "mandarin", "spanish", "german", "korean", "italian", "language", "fluent", "conversational"],
    },
  },
  {
    id: "art_portfolio",
    label: "Art / Design Portfolio",
    user_pattern: "Visual art / animation / architecture. Random pieces, no portfolio narrative.",
    inferred_bottleneck: "Portfolio proof and project selection.",
    probe: "Do you need help choosing portfolio pieces, finishing pieces, or explaining your creative process?",
    forge_features: ["Portfolio Evidence Bank", "Project Finish Protocol", "Style Development Log", "Critique Lab"],
    correct_behaviour: "Help create a portfolio narrative, not just more art tasks.",
    triggers: {
      goal_keywords: ["portfolio", "art", "design", "animation", "architecture", "illustration", "drawing", "painting"],
    },
  },
  {
    id: "exam_comeback",
    label: "Exam Comeback",
    user_pattern: "Did badly on a recent test, discouraged, doesn't know what went wrong.",
    inferred_bottleneck: "Post-failure analysis.",
    probe: "Do you know whether the marks were lost from content gaps, timing, careless errors, or not understanding the question?",
    forge_features: ["Test Post-Mortem", "Error-Type Lab", "Comeback Plan", "Confidence Rebuild Sprint"],
    correct_behaviour: "Turn the bad result into diagnostic data without shaming.",
    triggers: {
      goal_keywords: ["recover", "comeback", "next test", "improve", "bombed", "failed"],
      feedback_signals: ["overwhelmed", "feels_unrealistic"],
    },
  },
  {
    id: "career_exploration",
    label: "Career Exploration",
    user_pattern: "Unsure of direction, jumps between interests, broad questions.",
    inferred_bottleneck: "Exploration through experiments — not abstract reflection.",
    probe: "Would you rather explore through reading, small projects, talking to people, or trying real tasks?",
    forge_features: ["Career Experiment Lab", "Interest Signal Tracker", "Pathway Comparison Board", "Subject Choice Decision Engine"],
    correct_behaviour: "Create small experiments that reveal preferences.",
    triggers: {
      goal_keywords: ["career", "what to do", "direction", "subjects", "atar", "pathway", "unsure"],
      needs_no_goal: true,
    },
  },
  {
    id: "social_confidence",
    label: "Social Confidence",
    user_pattern: "Wants to speak more, join groups, avoids events.",
    inferred_bottleneck: "Low-pressure social reps.",
    probe: "What feels hardest: starting conversations, joining groups, speaking in class, or staying confident after awkward moments?",
    forge_features: ["Social Rep Ladder", "Conversation Prep Lab", "Reflection Without Overthinking", "Weekly Courage Log"],
    correct_behaviour: "Be gentle, practical, non-clinical. Avoid fake confidence slogans.",
    triggers: {
      goal_keywords: ["confidence", "social", "friends", "speak more", "anxiety", "shy", "introvert"],
    },
  },
  {
    id: "olympiad",
    label: "Competition / Olympiad",
    user_pattern: "Maths/science/coding/writing competition. Avoids hard problems, inconsistent practice.",
    inferred_bottleneck: "Difficulty progression and error analysis.",
    probe: "Are you stuck because the problems are too hard, because you avoid reviewing mistakes, or because you don't have a training schedule?",
    forge_features: ["Problem Difficulty Ladder", "Competition Error Lab", "Weekly Challenge Cycle", "Timed Simulation Room"],
    correct_behaviour: "Train like a competitor — progressive overload and review.",
    triggers: {
      goal_keywords: ["olympiad", "competition", "amc", "imo", "informatics", "icpc", "hackathon"],
    },
  },
  {
    id: "messy_assignments",
    label: "Messy Assignments",
    user_pattern: "Multiple overdue/unclear assignments. Hits Rescue, says they're behind.",
    inferred_bottleneck: "Triage before motivation.",
    probe: "Which is the bigger problem: too many assignments, unclear instructions, or not knowing what to do first?",
    forge_features: ["Assignment Control Room", "Deadline Triage Board", "Plan B Homework Mode", "Teacher Help Request Builder"],
    correct_behaviour: "Sort, shrink, and sequence. Do not dump a giant plan.",
    triggers: {
      needs_recent_rescue: true,
      feedback_signals: ["too_much_today", "overwhelmed", "too_vague"],
    },
  },
  {
    id: "fitness",
    label: "Personal Fitness",
    user_pattern: "Wants fitter/stronger/consistent. Starts intense routines then stops.",
    inferred_bottleneck: "Sustainable progression.",
    probe: "What matters most right now: strength, endurance, sport performance, energy, or consistency?",
    forge_features: ["Training Consistency Log", "Progressive Workout Builder", "Low-Energy Movement Plan", "Recovery-Aware Schedule"],
    correct_behaviour: "Avoid extreme body ideals. Focus on health, strength, energy, consistency.",
    triggers: {
      goal_keywords: ["fitness", "gym", "workout", "stronger", "fitter", "lose weight", "muscle", "running", "cardio"],
    },
  },
  {
    id: "big_dream_no_system",
    label: "Big Dream but No System",
    user_pattern: "Huge goal, scattered execution, rejects generic advice.",
    inferred_bottleneck: "Needs a personalised operating system.",
    probe: "What is the biggest leak in your current system: unclear priorities, weak daily execution, lack of proof, emotional collapse, or too many competing ideas?",
    forge_features: ["Goal Operating System", "Critical Pathway Builder", "Proof Engine", "Weekly Execution Audit", "Decision Engine"],
    correct_behaviour: "Be ambitious but structurally sound. Convert the dream into pathway, systems, and proof.",
    triggers: {
      goal_keywords: ["dream", "big", "everything", "all of", "world-class", "best in"],
      needs_low_velocity: true,
    },
  },
];

export const DIAGNOSTIC_LOOP = `
The Moment diagnostic loop. Apply on every response:
1. Read known context first (goal, recent feedback, reflections, mission analytics).
2. Identify the likely bottleneck — not what the user says, what's actually blocking them.
3. Do NOT re-ask known information.
4. Ask one sharp missing question only if needed. Otherwise act.
5. Generate a specific next move (named, sized, owns the first physical step).
6. Suggest or activate a relevant Forge feature when it would close the loop.
7. Write useful signals back into Today / Plan / Audit / Chat / Mission.
8. NEVER use generic motivation ("you got this", "stay focused").
9. NEVER fake certainty. If unsure, name what you'd need to know.
10. Make the user feel the app is protecting their actual future.
`.trim();

export const ANTI_PATTERNS = [
  "Generic productivity advice ('break it down', 'stay consistent', 'just start').",
  "Re-asking information already in state (goal, energy pattern, constraints).",
  "Cheerleading without a concrete next move.",
  "Dumping a giant plan when triage is needed.",
  "Naming features generically ('Daily Tracker') instead of domain-specific ('Serve Toss Tracker').",
  "Treating energy as flat across the week.",
  "Shaming language. Always plan-blame, not user-blame.",
];
