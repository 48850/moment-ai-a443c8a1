/**
 * Exam Emergency non-persisted types.
 * Persisted types (ExamEmergency, ExamTopic, etc.) are Zod-inferred in types/index.ts.
 */

export type ExamTopicPriority = "critical" | "high" | "medium" | "low" | "ignore_for_now";
export type StudyMethod =
  | "active_recall"
  | "practice_questions"
  | "summary"
  | "flashcards"
  | "essay_plan"
  | "formula_drill";
export type TargetOutcome = "survive" | "solid" | "high_score";
export type ExamEmergencyStatus = "intake" | "active" | "recovering" | "completed";
export type ExamBlockFeedbackResult =
  | "easy"
  | "hard"
  | "confused"
  | "avoided"
  | "too_long"
  | "completed";

export type ExamIntakeStatus =
  | "needs_subject"
  | "needs_exam_time"
  | "needs_topics"
  | "needs_available_time"
  | "ready_to_build"
  | "active";

export type ExamResourceKind =
  | "notes" | "textbook" | "slides" | "past_paper" | "rubric"
  | "study_guide" | "teacher_feedback" | "practice_q" | "other";

export type ExamTaskFormat =
  | "multiple_choice" | "short_answer" | "essay" | "prac" | "oral" | "mixed" | "unknown";

export interface ExamTaskProfileUpdate {
  format?: ExamTaskFormat;
  sections?: string[];
  highest_mark_section?: string;
  has_rubric?: boolean;
  rubric_text?: string;
  has_topic_list?: boolean;
  has_past_papers?: boolean;
  teacher_emphasis?: string;
  target_mark?: string;
}

export interface ExamResourceInput {
  kind: ExamResourceKind;
  label: string;
  helps_with?: string[];
  priority?: "high" | "medium" | "low";
  how_to_use?: string;
}

export interface ExamIntakePayload {
  action: "start" | "update" | "ready_to_build";
  subject?: string;
  exam_date_time?: string;
  preparedness_score?: number;
  target_outcome?: TargetOutcome;
  topics?: Array<{
    name: string;
    confidence?: 1 | 2 | 3 | 4 | 5;
    mark_value?: 1 | 2 | 3 | 4 | 5;
    likelihood?: 1 | 2 | 3 | 4 | 5;
    time_cost?: 1 | 2 | 3 | 4 | 5;
    quick_win_potential?: 1 | 2 | 3 | 4 | 5;
  }>;
  available_study_windows?: Array<{
    start_time: string;
    end_time: string;
    day_label: string;
    available_minutes: number;
  }>;
  task_profile?: ExamTaskProfileUpdate;
  resources?: ExamResourceInput[];
  missing_fields?: string[];
}

export interface ExamPlanFromCoach {
  action: "create" | "update" | "complete";
  emergency: unknown;
}

export interface TriageScore {
  topicId: string;
  topicName: string;
  score: number;
  priority: ExamTopicPriority;
  rationale: string;
}

export interface ExamIntentSignal {
  detected: boolean;
  subject?: string;
  timeframe?: string;
  urgencyLevel: "low" | "medium" | "high" | "critical";
}
