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

export type CopilotMode =
  | "intake"
  | "task_profile"
  | "resource_intake"
  | "questioner"
  | "work_rater";

export type QuestionType =
  | "quick_quiz"
  | "explain_back"
  | "past_paper_style"
  | "essay_plan"
  | "definition"
  | "formula"
  | "weak_topic";

export type WorkRatingLevel = "needs_work" | "developing" | "solid" | "strong";

export interface ExamCopilotSession {
  id: string;
  mode: CopilotMode;
  started_at: string;
  question_ids: string[];
  current_question_id?: string;
}
