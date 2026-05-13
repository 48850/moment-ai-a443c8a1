/**
 * Forge feature catalog. Every feature mentioned across the 20 coach
 * scenarios, with module type + a starter config the compiler can use
 * directly. The matcher hands the catalog to the AI so module names stop
 * being generic ("Daily Tracker") and start being domain-true ("Serve Toss
 * Tracker", "Rebuttal Challenger").
 */

import type { ModuleConfig } from "@/lib/types";

export type CatalogModuleType =
  | "tracker" | "evidence_log" | "practice_system" | "planner"
  | "rescue_protocol" | "review_engine" | "decision_engine" | "simulator" | "coach_loop";

export interface CatalogFeature {
  name: string;
  scenario_id: string;
  domain: string;
  module_type: CatalogModuleType;
  bottleneck_addressed: string;
  config: ModuleConfig;
  starter_tasks?: string[];
}

export const FORGE_FEATURE_CATALOG: CatalogFeature[] = [
  // Stanford CS / Builder
  { name: "Application Evidence Bank", scenario_id: "stanford_cs", domain: "applications", module_type: "evidence_log", bottleneck_addressed: "No tangible proof of ambition.", config: { fields: [{ key: "artifact", label: "Artifact / link", kind: "text" }, { key: "category", label: "Category (project, leadership, academic)", kind: "text" }, { key: "strength", label: "Strength of proof", kind: "rating" }] } },
  { name: "Project Shipping Lab", scenario_id: "stanford_cs", domain: "building", module_type: "practice_system", bottleneck_addressed: "Projects start but never ship.", config: { drills: [{ name: "Define one shippable cut", minutes: 15 }, { name: "Build the smallest visible slice", minutes: 60 }, { name: "Show one human", minutes: 10 }] } },
  { name: "Deep Work Lab", scenario_id: "stanford_cs", domain: "focus", module_type: "practice_system", bottleneck_addressed: "Fragmented sessions.", config: { drills: [{ name: "Ramp + intent", minutes: 5 }, { name: "Focused build", minutes: 50 }, { name: "Capture loose threads", minutes: 5 }] } },
  { name: "Weekly Proof Audit", scenario_id: "stanford_cs", domain: "review", module_type: "review_engine", bottleneck_addressed: "Effort without visible artifact.", config: { steps: ["List the artifacts produced this week.", "Mark each as: shippable, internal, or noise.", "Choose next week's one must-ship."] } },

  // Future Doctor
  { name: "Science Error Lab", scenario_id: "future_doctor", domain: "science", module_type: "tracker", bottleneck_addressed: "Mistakes repeat without diagnosis.", config: { fields: [{ key: "topic", label: "Topic", kind: "text" }, { key: "error_type", label: "Error type (knowledge / application / silly)", kind: "text" }, { key: "fix", label: "Fix in your own words", kind: "text" }] } },
  { name: "Practice Question Tracker", scenario_id: "future_doctor", domain: "science", module_type: "tracker", bottleneck_addressed: "Passive content review.", config: { fields: [{ key: "questions_done", label: "Questions done", kind: "number" }, { key: "correct_pct", label: "% correct", kind: "number" }, { key: "topic", label: "Topic", kind: "text" }] } },
  { name: "Medical Evidence Bank", scenario_id: "future_doctor", domain: "applications", module_type: "evidence_log", bottleneck_addressed: "Extracurricular evidence scattered.", config: { fields: [{ key: "experience", label: "Experience", kind: "text" }, { key: "skill_demonstrated", label: "Skill it shows", kind: "text" }, { key: "hours", label: "Hours", kind: "number" }] } },
  { name: "Weekly Mastery Audit", scenario_id: "future_doctor", domain: "review", module_type: "review_engine", bottleneck_addressed: "Hours studied ≠ mastery.", config: { steps: ["List topics touched.", "Mark each: can teach / can do / cannot do.", "Pick one to practise actively next."] } },

  // Debating
  { name: "Debate Drill Lab", scenario_id: "debating", domain: "debate", module_type: "practice_system", bottleneck_addressed: "Practice avoids live response.", config: { drills: [{ name: "Case skeleton (3 args)", minutes: 10 }, { name: "Timed rebuttal vs. recorded prompt", minutes: 8 }, { name: "Self-critique on clarity", minutes: 5 }] } },
  { name: "Rebuttal Challenger", scenario_id: "debating", domain: "debate", module_type: "simulator", bottleneck_addressed: "Slow rebuttal speed.", config: { fields: [{ key: "prompt", label: "Opposition argument", kind: "text" }, { key: "rebuttal", label: "Your 60s rebuttal", kind: "text" }, { key: "self_score", label: "Self-score /5", kind: "rating" }] } },
  { name: "Speech Scorecard", scenario_id: "debating", domain: "debate", module_type: "tracker", bottleneck_addressed: "No granular feedback per speech.", config: { fields: [{ key: "matter", label: "Matter /10", kind: "number" }, { key: "manner", label: "Manner /10", kind: "number" }, { key: "method", label: "Method /10", kind: "number" }] } },
  { name: "Argument Bank", scenario_id: "debating", domain: "debate", module_type: "evidence_log", bottleneck_addressed: "Reinventing arguments each round.", config: { fields: [{ key: "topic", label: "Topic", kind: "text" }, { key: "claim", label: "Claim", kind: "text" }, { key: "evidence", label: "Best evidence", kind: "text" }] } },

  // Maths Recovery
  { name: "Maths Error Lab", scenario_id: "maths_recovery", domain: "maths", module_type: "tracker", bottleneck_addressed: "Errors repeat without categorisation.", config: { fields: [{ key: "problem", label: "Problem", kind: "text" }, { key: "error_type", label: "Formula / setup / arithmetic", kind: "text" }, { key: "fix", label: "Correct first step", kind: "text" }] } },
  { name: "Concept Recovery Room", scenario_id: "maths_recovery", domain: "maths", module_type: "practice_system", bottleneck_addressed: "Skipping foundational gaps.", config: { drills: [{ name: "Re-derive the rule", minutes: 8 }, { name: "Worked example out loud", minutes: 7 }, { name: "Solo attempt + check", minutes: 10 }] } },
  { name: "First-Step Solver", scenario_id: "maths_recovery", domain: "maths", module_type: "coach_loop", bottleneck_addressed: "Doesn't know how to start.", config: { steps: ["Identify what's given.", "Identify what's asked.", "Name the rule that bridges them.", "Write the very first symbol on the page."] } },
  { name: "Practice Set Splitter", scenario_id: "maths_recovery", domain: "maths", module_type: "planner", bottleneck_addressed: "Doom-scrolling problem sets.", config: { slots: [{ label: "5 easy warm-ups", cadence: "daily" }, { label: "3 stretch problems", cadence: "daily" }, { label: "1 written explanation", cadence: "weekly" }] } },

  // Athlete
  { name: "Training-Day Plan B", scenario_id: "athlete_balance", domain: "schedule", module_type: "planner", bottleneck_addressed: "Training nights collapse homework.", config: { slots: [{ label: "Pre-training light prep", cadence: "training days" }, { label: "Post-training low-cog work", cadence: "training days" }, { label: "Heavy work moved", cadence: "rest days" }] } },
  { name: "Recovery-Aware Homework Planner", scenario_id: "athlete_balance", domain: "schedule", module_type: "planner", bottleneck_addressed: "Same plan regardless of body state.", config: { slots: [{ label: "Energy check-in", cadence: "evening" }, { label: "Adapt plan to energy", cadence: "evening" }] } },
  { name: "Performance Log", scenario_id: "athlete_balance", domain: "sport", module_type: "tracker", bottleneck_addressed: "No throughline of progress.", config: { fields: [{ key: "session", label: "Session", kind: "text" }, { key: "rpe", label: "RPE /10", kind: "number" }, { key: "highlight", label: "One highlight", kind: "text" }] } },
  { name: "Weekly Load Balancer", scenario_id: "athlete_balance", domain: "review", module_type: "review_engine", bottleneck_addressed: "Cumulative load invisible.", config: { steps: ["Sum training hours.", "Sum study hours.", "Sum sleep deficit.", "Decide one cut for next week."] } },

  // Music
  { name: "Practice Quality Lab", scenario_id: "music_excellence", domain: "music", module_type: "practice_system", bottleneck_addressed: "Plays through, doesn't isolate.", config: { drills: [{ name: "Hardest 4 bars, slow", minutes: 10 }, { name: "Hands separate / sections separate", minutes: 10 }, { name: "Tempo build to performance", minutes: 10 }] } },
  { name: "Mistake Loop Tracker", scenario_id: "music_excellence", domain: "music", module_type: "tracker", bottleneck_addressed: "Same mistake every session.", config: { fields: [{ key: "passage", label: "Passage", kind: "text" }, { key: "mistake", label: "What broke", kind: "text" }, { key: "fix", label: "Fix tried", kind: "text" }] } },
  { name: "Performance Prep Protocol", scenario_id: "music_excellence", domain: "music", module_type: "rescue_protocol", bottleneck_addressed: "Performance anxiety.", config: { steps: ["Run-through with no stops.", "Walk through what scared you.", "Do a one-shot recording.", "Listen back and pick one fix."] } },
  { name: "Repertoire Progress Map", scenario_id: "music_excellence", domain: "music", module_type: "tracker", bottleneck_addressed: "Don't know what's performance-ready.", config: { fields: [{ key: "piece", label: "Piece", kind: "text" }, { key: "stage", label: "Notes / structure / polish / performance", kind: "text" }] } },

  // Scholarship
  { name: "Exam Error Tracker", scenario_id: "scholarship", domain: "exams", module_type: "tracker", bottleneck_addressed: "No diagnostic on losses.", config: { fields: [{ key: "section", label: "Section", kind: "text" }, { key: "lost_to", label: "Lost to (speed / careless / unfamiliar / pressure)", kind: "text" }] } },
  { name: "Timed Drill Lab", scenario_id: "scholarship", domain: "exams", module_type: "practice_system", bottleneck_addressed: "Practice without time pressure.", config: { drills: [{ name: "Section under time", minutes: 25 }, { name: "Mark + categorise errors", minutes: 10 }, { name: "Re-attempt missed", minutes: 10 }] } },
  { name: "Weakness Heatmap", scenario_id: "scholarship", domain: "exams", module_type: "tracker", bottleneck_addressed: "Effort spread evenly across topics.", config: { fields: [{ key: "topic", label: "Topic", kind: "text" }, { key: "score_pct", label: "% correct", kind: "number" }] } },
  { name: "Weekly Score Delta Log", scenario_id: "scholarship", domain: "review", module_type: "review_engine", bottleneck_addressed: "Can't see improvement.", config: { steps: ["Log this week's mock %.", "Compare to last week.", "Pick the topic with biggest delta to lean into."] } },

  // Creative writer
  { name: "Draft Completion Lab", scenario_id: "creative_writer", domain: "writing", module_type: "practice_system", bottleneck_addressed: "Starts many, finishes few.", config: { drills: [{ name: "Write to next scene break", minutes: 25 }, { name: "Note next-action for tomorrow", minutes: 5 }] } },
  { name: "Scene Builder", scenario_id: "creative_writer", domain: "writing", module_type: "coach_loop", bottleneck_addressed: "Stuck on what happens next.", config: { steps: ["Whose POV?", "What do they want?", "What's in the way?", "What changes by the end?"] } },
  { name: "Revision Protocol", scenario_id: "creative_writer", domain: "writing", module_type: "rescue_protocol", bottleneck_addressed: "Edits forever, never publishes.", config: { steps: ["Pass 1: structure only.", "Pass 2: line edits.", "Pass 3: read aloud.", "Ship."] } },
  { name: "Writing Proof Bank", scenario_id: "creative_writer", domain: "writing", module_type: "evidence_log", bottleneck_addressed: "No evidence of completed work.", config: { fields: [{ key: "title", label: "Title", kind: "text" }, { key: "wordcount", label: "Word count", kind: "number" }, { key: "status", label: "Drafted / revised / published", kind: "text" }] } },

  // Founder
  { name: "Product Shipping Lab", scenario_id: "founder", domain: "product", module_type: "practice_system", bottleneck_addressed: "Vision keeps expanding.", config: { drills: [{ name: "Cut scope to one user story", minutes: 10 }, { name: "Build the slice", minutes: 60 }, { name: "Push to a real URL", minutes: 10 }] } },
  { name: "User Feedback Intake", scenario_id: "founder", domain: "product", module_type: "tracker", bottleneck_addressed: "Building blind.", config: { fields: [{ key: "user", label: "User", kind: "text" }, { key: "verbatim", label: "What they said", kind: "text" }, { key: "action", label: "What you'll change", kind: "text" }] } },
  { name: "Feature Indispensability Audit", scenario_id: "founder", domain: "product", module_type: "review_engine", bottleneck_addressed: "Shallow features.", config: { steps: ["List features shipped.", "Score each: would users miss it /10?", "Cut anything ≤ 5."] } },
  { name: "Revenue Sprint Planner", scenario_id: "founder", domain: "business", module_type: "planner", bottleneck_addressed: "No path to first dollar.", config: { slots: [{ label: "Outreach to 3 potential users", cadence: "weekly" }, { label: "One pricing experiment", cadence: "weekly" }] } },

  // Low motivation
  { name: "Minimum Viable School Day", scenario_id: "low_motivation", domain: "school", module_type: "planner", bottleneck_addressed: "Avoidance spirals.", config: { slots: [{ label: "One must-do task", cadence: "daily" }, { label: "One 10-minute start", cadence: "daily" }] } },
  { name: "Homework Triage Board", scenario_id: "low_motivation", domain: "school", module_type: "tracker", bottleneck_addressed: "Don't know what's actually due.", config: { fields: [{ key: "task", label: "Task", kind: "text" }, { key: "due", label: "Due", kind: "text" }, { key: "size", label: "Tiny / medium / big", kind: "text" }] } },
  { name: "10-Minute Start Protocol", scenario_id: "low_motivation", domain: "rescue", module_type: "rescue_protocol", bottleneck_addressed: "Activation friction.", config: { steps: ["Sit down with the task open.", "Set a 10-minute timer.", "When it ends, decide: stop or continue."] } },
  { name: "Weekly Reset", scenario_id: "low_motivation", domain: "review", module_type: "review_engine", bottleneck_addressed: "Drift accumulates.", config: { steps: ["Clear the desk.", "List what slipped.", "Pick one thing to recover next week."] } },

  // Burnout
  { name: "Capacity Audit", scenario_id: "burnout_high_achiever", domain: "review", module_type: "review_engine", bottleneck_addressed: "Overcommitment invisible.", config: { steps: ["List every commitment.", "Estimate weekly hours.", "Mark each: returns energy / drains energy.", "Choose one to cut or shrink."] } },
  { name: "Plan B Switchboard", scenario_id: "burnout_high_achiever", domain: "schedule", module_type: "planner", bottleneck_addressed: "Plan A or collapse.", config: { slots: [{ label: "Plan B for low-energy day", cadence: "as needed" }, { label: "Protected sleep window", cadence: "daily" }] } },
  { name: "Commitment Triage", scenario_id: "burnout_high_achiever", domain: "review", module_type: "decision_engine", bottleneck_addressed: "Can't say no.", config: { steps: ["For each commitment: is this protecting the goal or just identity?", "Drop one. Shrink one. Keep one."] } },
  { name: "Recovery-Protected Planner", scenario_id: "burnout_high_achiever", domain: "schedule", module_type: "planner", bottleneck_addressed: "No recovery in plan.", config: { slots: [{ label: "Sleep floor", cadence: "daily" }, { label: "One rest block", cadence: "weekly" }] } },

  // Language
  { name: "Speaking Drill Lab", scenario_id: "language_learning", domain: "language", module_type: "practice_system", bottleneck_addressed: "Avoids speaking.", config: { drills: [{ name: "Shadow a 60s clip", minutes: 5 }, { name: "Self-recording on a topic", minutes: 5 }, { name: "Listen back, mark errors", minutes: 5 }] } },
  { name: "Vocabulary Recall Tracker", scenario_id: "language_learning", domain: "language", module_type: "tracker", bottleneck_addressed: "Passive vocab review.", config: { fields: [{ key: "word", label: "Word", kind: "text" }, { key: "in_a_sentence", label: "Used in a sentence", kind: "text" }, { key: "confidence", label: "Confidence /5", kind: "rating" }] } },
  { name: "Writing Correction Loop", scenario_id: "language_learning", domain: "language", module_type: "coach_loop", bottleneck_addressed: "Same mistakes in writing.", config: { steps: ["Write 5 sentences on a topic.", "Get corrections.", "Re-write the original from corrections."] } },
  { name: "Conversation Simulator", scenario_id: "language_learning", domain: "language", module_type: "simulator", bottleneck_addressed: "No speaking partner.", config: { fields: [{ key: "scenario", label: "Scenario (cafe, interview, friend)", kind: "text" }, { key: "transcript", label: "Your transcript", kind: "text" }] } },

  // Art portfolio
  { name: "Portfolio Evidence Bank", scenario_id: "art_portfolio", domain: "art", module_type: "evidence_log", bottleneck_addressed: "No portfolio narrative.", config: { fields: [{ key: "piece", label: "Piece", kind: "text" }, { key: "concept", label: "Concept in one line", kind: "text" }, { key: "process_doc", label: "Process documented?", kind: "text" }] } },
  { name: "Project Finish Protocol", scenario_id: "art_portfolio", domain: "art", module_type: "rescue_protocol", bottleneck_addressed: "Pieces never finished.", config: { steps: ["Define 'done' in one sentence.", "Set a finish window.", "Photograph and archive — even if imperfect."] } },
  { name: "Style Development Log", scenario_id: "art_portfolio", domain: "art", module_type: "tracker", bottleneck_addressed: "No through-line.", config: { fields: [{ key: "experiment", label: "Experiment tried", kind: "text" }, { key: "keep", label: "Keep / drop", kind: "text" }] } },
  { name: "Critique Lab", scenario_id: "art_portfolio", domain: "art", module_type: "coach_loop", bottleneck_addressed: "Avoids critique.", config: { steps: ["Show it to one trusted person.", "Ask: what works / what doesn't.", "Note one change for next piece."] } },

  // Exam comeback
  { name: "Test Post-Mortem", scenario_id: "exam_comeback", domain: "exams", module_type: "review_engine", bottleneck_addressed: "Discouragement blocks diagnosis.", config: { steps: ["For each missed mark: content gap, timing, careless, or comprehension?", "Group the categories.", "Plan one drill per top category."] } },
  { name: "Error-Type Lab", scenario_id: "exam_comeback", domain: "exams", module_type: "tracker", bottleneck_addressed: "Same error repeats.", config: { fields: [{ key: "question", label: "Question", kind: "text" }, { key: "error_type", label: "Error type", kind: "text" }] } },
  { name: "Comeback Plan", scenario_id: "exam_comeback", domain: "exams", module_type: "planner", bottleneck_addressed: "Random catch-up.", config: { slots: [{ label: "Diagnostic block", cadence: "week 1" }, { label: "Targeted drilling", cadence: "weeks 2–3" }, { label: "Full-length mock", cadence: "final week" }] } },
  { name: "Confidence Rebuild Sprint", scenario_id: "exam_comeback", domain: "exams", module_type: "practice_system", bottleneck_addressed: "Spiral after a bad result.", config: { drills: [{ name: "5 easy wins", minutes: 15 }, { name: "1 medium stretch", minutes: 10 }] } },

  // Career exploration
  { name: "Career Experiment Lab", scenario_id: "career_exploration", domain: "career", module_type: "practice_system", bottleneck_addressed: "Endless reflection, no data.", config: { drills: [{ name: "Try one task from a real-world role", minutes: 30 }, { name: "Note: energising or draining?", minutes: 5 }] } },
  { name: "Interest Signal Tracker", scenario_id: "career_exploration", domain: "career", module_type: "tracker", bottleneck_addressed: "Can't tell genuine interest from novelty.", config: { fields: [{ key: "activity", label: "Activity", kind: "text" }, { key: "energy", label: "Energy /5", kind: "rating" }, { key: "would_repeat", label: "Would repeat?", kind: "text" }] } },
  { name: "Pathway Comparison Board", scenario_id: "career_exploration", domain: "career", module_type: "tracker", bottleneck_addressed: "Pathways feel abstract.", config: { fields: [{ key: "pathway", label: "Pathway", kind: "text" }, { key: "day_in_life", label: "Day-in-life pros", kind: "text" }, { key: "trade_offs", label: "Trade-offs", kind: "text" }] } },
  { name: "Subject Choice Decision Engine", scenario_id: "career_exploration", domain: "career", module_type: "decision_engine", bottleneck_addressed: "Subject lock-in feels permanent.", config: { steps: ["List subject options.", "Score each: enjoyment / strength / pathway-fit.", "Pick the highest weighted total — and review in 6 months."] } },

  // Social confidence
  { name: "Social Rep Ladder", scenario_id: "social_confidence", domain: "social", module_type: "practice_system", bottleneck_addressed: "Avoids low-stakes practice.", config: { drills: [{ name: "Say hi to one new person", minutes: 1 }, { name: "Ask one question in a group", minutes: 2 }, { name: "Initiate a plan with one friend", minutes: 5 }] } },
  { name: "Conversation Prep Lab", scenario_id: "social_confidence", domain: "social", module_type: "coach_loop", bottleneck_addressed: "Overthinks every conversation.", config: { steps: ["Pick a topic you actually care about.", "Draft one opener.", "Draft one follow-up question.", "Use it in the wild."] } },
  { name: "Reflection Without Overthinking", scenario_id: "social_confidence", domain: "social", module_type: "review_engine", bottleneck_addressed: "Replays awkward moments.", config: { steps: ["Name the moment in one sentence.", "Ask: what would I tell a friend who did this?", "Close the loop and move on."] } },
  { name: "Weekly Courage Log", scenario_id: "social_confidence", domain: "social", module_type: "evidence_log", bottleneck_addressed: "Forgets evidence of growth.", config: { fields: [{ key: "rep", label: "What you tried", kind: "text" }, { key: "felt", label: "How it felt", kind: "text" }] } },

  // Olympiad
  { name: "Problem Difficulty Ladder", scenario_id: "olympiad", domain: "competition", module_type: "practice_system", bottleneck_addressed: "Avoids hard problems.", config: { drills: [{ name: "1 below-level (warm-up)", minutes: 5 }, { name: "2 at-level", minutes: 30 }, { name: "1 stretch (allowed to fail)", minutes: 30 }] } },
  { name: "Competition Error Lab", scenario_id: "olympiad", domain: "competition", module_type: "tracker", bottleneck_addressed: "Mistakes not analysed.", config: { fields: [{ key: "problem", label: "Problem", kind: "text" }, { key: "missing_idea", label: "What idea was missing", kind: "text" }] } },
  { name: "Weekly Challenge Cycle", scenario_id: "olympiad", domain: "competition", module_type: "planner", bottleneck_addressed: "No training rhythm.", config: { slots: [{ label: "Theory + worked example", cadence: "Mon" }, { label: "Drill at level", cadence: "Wed" }, { label: "Timed mock", cadence: "Sat" }] } },
  { name: "Timed Simulation Room", scenario_id: "olympiad", domain: "competition", module_type: "simulator", bottleneck_addressed: "No exam-condition reps.", config: { fields: [{ key: "set", label: "Problem set", kind: "text" }, { key: "time", label: "Time taken", kind: "number" }, { key: "score", label: "Score", kind: "number" }] } },

  // Messy assignments
  { name: "Assignment Control Room", scenario_id: "messy_assignments", domain: "school", module_type: "tracker", bottleneck_addressed: "No single source of truth.", config: { fields: [{ key: "assignment", label: "Assignment", kind: "text" }, { key: "subject", label: "Subject", kind: "text" }, { key: "due", label: "Due", kind: "text" }, { key: "status", label: "Status", kind: "text" }] } },
  { name: "Deadline Triage Board", scenario_id: "messy_assignments", domain: "school", module_type: "decision_engine", bottleneck_addressed: "Everything feels equally urgent.", config: { steps: ["Sort by due date.", "Mark each: drop / shrink / do.", "Pick the one that unlocks the most space."] } },
  { name: "Plan B Homework Mode", scenario_id: "messy_assignments", domain: "schedule", module_type: "planner", bottleneck_addressed: "Plan A unrealistic when behind.", config: { slots: [{ label: "Cap of 2 must-dos", cadence: "daily" }, { label: "1 catch-up window", cadence: "weekend" }] } },
  { name: "Teacher Help Request Builder", scenario_id: "messy_assignments", domain: "school", module_type: "coach_loop", bottleneck_addressed: "Avoids asking for help.", config: { steps: ["Name the assignment.", "Write the specific question.", "Send it before the next class."] } },

  // Fitness
  { name: "Training Consistency Log", scenario_id: "fitness", domain: "fitness", module_type: "tracker", bottleneck_addressed: "Boom-bust cycle.", config: { fields: [{ key: "session", label: "Session", kind: "text" }, { key: "rpe", label: "RPE /10", kind: "number" }] } },
  { name: "Progressive Workout Builder", scenario_id: "fitness", domain: "fitness", module_type: "practice_system", bottleneck_addressed: "Starts too hard.", config: { drills: [{ name: "Movement prep", minutes: 5 }, { name: "Main lift / set", minutes: 20 }, { name: "Accessory + cool-down", minutes: 10 }] } },
  { name: "Low-Energy Movement Plan", scenario_id: "fitness", domain: "fitness", module_type: "planner", bottleneck_addressed: "All-or-nothing on tired days.", config: { slots: [{ label: "Walk", cadence: "low-energy" }, { label: "Mobility", cadence: "low-energy" }] } },
  { name: "Recovery-Aware Schedule", scenario_id: "fitness", domain: "fitness", module_type: "planner", bottleneck_addressed: "No rest planned.", config: { slots: [{ label: "Rest day", cadence: "weekly" }, { label: "Sleep target", cadence: "daily" }] } },

  // Big dream
  { name: "Goal Operating System", scenario_id: "big_dream_no_system", domain: "system", module_type: "review_engine", bottleneck_addressed: "Dream without infrastructure.", config: { steps: ["Define the proof that means progress.", "Define the daily move that produces proof.", "Define the weekly review that catches drift."] } },
  { name: "Critical Pathway Builder", scenario_id: "big_dream_no_system", domain: "system", module_type: "decision_engine", bottleneck_addressed: "Can't see the path.", config: { steps: ["Where does the goal end?", "What proof at month 6, month 3, this month?", "What single move this week?"] } },
  { name: "Proof Engine", scenario_id: "big_dream_no_system", domain: "system", module_type: "evidence_log", bottleneck_addressed: "Effort without artifacts.", config: { fields: [{ key: "proof", label: "Proof produced", kind: "text" }, { key: "category", label: "Type", kind: "text" }] } },
  { name: "Weekly Execution Audit", scenario_id: "big_dream_no_system", domain: "review", module_type: "review_engine", bottleneck_addressed: "Drift goes unnoticed.", config: { steps: ["Did the daily move happen?", "Did proof get produced?", "What's next week's one bet?"] } },
  { name: "Decision Engine", scenario_id: "big_dream_no_system", domain: "system", module_type: "decision_engine", bottleneck_addressed: "Idea overload.", config: { steps: ["List options.", "Score: leverage × proof × fit.", "Commit to top 1, archive rest for 30 days."] } },
];

export function featuresForScenario(scenarioId: string): CatalogFeature[] {
  return FORGE_FEATURE_CATALOG.filter((f) => f.scenario_id === scenarioId);
}

/** Compact summary for AI prompts. */
export function catalogBrief(scenarioIds: string[]) {
  return FORGE_FEATURE_CATALOG
    .filter((f) => scenarioIds.includes(f.scenario_id))
    .map((f) => ({ name: f.name, type: f.module_type, addresses: f.bottleneck_addressed }));
}
