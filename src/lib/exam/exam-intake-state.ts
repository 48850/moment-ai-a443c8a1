import type { ExamIntakePayload, ExamIntakeStatus } from "@/lib/types/exam-emergency";

export function getIntakeStatus(partial: Partial<ExamIntakePayload>): ExamIntakeStatus {
  if (!partial.subject) return "needs_subject";
  if (!partial.exam_date_time) return "needs_exam_time";
  if (!partial.topics || partial.topics.length === 0) return "needs_topics";
  if (!partial.available_study_windows || partial.available_study_windows.length === 0) {
    return "needs_available_time";
  }
  return "ready_to_build";
}

export function getMissingField(partial: Partial<ExamIntakePayload>): string | null {
  const status = getIntakeStatus(partial);
  switch (status) {
    case "needs_subject":
      return "What subject is the exam?";
    case "needs_exam_time":
      return "When is the exam — what date and time?";
    case "needs_topics":
      return "What topics are on it?";
    case "needs_available_time":
      return "How much time do you realistically have to study before it?";
    default:
      return null;
  }
}
