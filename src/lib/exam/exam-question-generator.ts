import type { ExamEmergency, ExamQuestion, ExamTopic, ExamWorkRating } from "@/lib/types";
import type { QuestionType, WorkRatingLevel } from "@/lib/types/exam-emergency";
import { selectWeakestExamTopics } from "@/lib/selectors/exam-selectors";

export function generateLocalQuestion(
  topic: ExamTopic,
  type: QuestionType,
  subject: string,
): ExamQuestion {
  const id = `local_q_${topic.id}_${type}_${Date.now()}`;
  const now = new Date().toISOString();

  let question_text = "";
  let model_answer = "";
  const hints: string[] = [];

  switch (type) {
    case "quick_quiz":
      question_text = `In one sentence, what is ${topic.name}?`;
      model_answer = `A concise definition of ${topic.name} covering the key concept.`;
      hints.push(`Think about the core idea of ${topic.name}.`);
      break;

    case "explain_back":
      question_text = `Explain ${topic.name} as if teaching a friend. Cover the main idea and one example.`;
      model_answer = `Clear explanation of ${topic.name} with a real-world example.`;
      hints.push(`Start with "The main idea of ${topic.name} is..."`);
      hints.push("Add one concrete example.");
      break;

    case "definition":
      question_text = `Write the definition of ${topic.name}.`;
      model_answer = `The formal definition of ${topic.name}.`;
      hints.push(`Include what it is, what it does, and why it matters.`);
      break;

    case "formula":
      question_text = `Write and apply the formula for ${topic.name} with a worked example.`;
      model_answer = `The formula for ${topic.name} plus a step-by-step worked calculation.`;
      hints.push("Write the formula first, then substitute numbers.");
      hints.push("Show all working steps.");
      break;

    case "essay_plan":
      question_text = `Write a bullet-point essay plan for: "Discuss the significance of ${topic.name} in ${subject}."`;
      model_answer = `Introduction → 3 main arguments with evidence → Counterargument → Conclusion.`;
      hints.push("Aim for 5–7 bullets.");
      hints.push("Each bullet = one paragraph idea.");
      break;

    case "past_paper_style":
      question_text = `Describe the key features of ${topic.name} in ${subject}. Give two examples. [6 marks]`;
      model_answer = `Two features clearly explained with one example each — 2 marks per feature + example.`;
      hints.push("One point = one mark. Aim for 6 distinct points.");
      break;

    case "weak_topic":
      question_text = `What do you know about ${topic.name}? Write everything — no stopping.`;
      model_answer = `A memory dump covering the key ideas, definitions, and examples for ${topic.name}.`;
      hints.push("Don't worry about order. Just write.");
      hints.push("Set a 3-minute timer.");
      break;
  }

  return {
    id,
    type,
    topic_id: topic.id,
    topic_name: topic.name,
    question_text,
    model_answer,
    hints,
    source: "local_template",
    created_at: now,
  };
}

export function generateWeakTopicQuestion(emergency: ExamEmergency): ExamQuestion {
  const weakTopics = selectWeakestExamTopics(emergency, 1);
  const topic = weakTopics[0] ?? emergency.topics[0];

  if (!topic) {
    return {
      id: `local_q_fallback_${Date.now()}`,
      type: "explain_back",
      question_text: `What is the main concept you need to understand for your ${emergency.subject} exam?`,
      model_answer: "A clear explanation of the core concept.",
      hints: ["Think about what your teacher emphasised most."],
      source: "local_template",
      created_at: new Date().toISOString(),
    };
  }

  const type: QuestionType = topic.confidence <= 2 ? "weak_topic" : "explain_back";
  return generateLocalQuestion(topic, type, emergency.subject);
}

export function generateLocalRating(
  question: ExamQuestion,
  answerText: string,
): ExamWorkRating {
  const trimmed = answerText.trim();
  const len = trimmed.length;

  let level: WorkRatingLevel;
  let missing_points: string[] = [];
  let upgrade_suggestion = "";

  if (len < 30) {
    level = "needs_work";
    missing_points = ["Answer is too short — more detail needed."];
    upgrade_suggestion = "Expand your answer. Aim for at least 2–3 sentences covering the main idea.";
  } else if (len < 80) {
    level = "developing";
    missing_points = ["Could include more explanation or an example."];
    upgrade_suggestion = "Add one concrete example to support your point.";
  } else {
    const modelKeywords = extractKeywords(question.model_answer ?? "");
    const answerLower = trimmed.toLowerCase();
    const missing = modelKeywords.filter((kw) => !answerLower.includes(kw));

    if (missing.length === 0) {
      level = "strong";
      upgrade_suggestion = "Good coverage. Try to also connect this to a broader concept or exam scenario.";
    } else if (missing.length <= 2) {
      level = "solid";
      missing_points = missing.map((kw) => `Missing mention of: ${kw}`);
      upgrade_suggestion = `Include ${missing[0]} in your answer to strengthen it.`;
    } else {
      level = "developing";
      missing_points = missing.slice(0, 3).map((kw) => `Missing: ${kw}`);
      upgrade_suggestion = `Focus on adding: ${missing.slice(0, 2).join(", ")}.`;
    }
  }

  return {
    id: `local_rating_${Date.now()}`,
    question_id: question.id,
    answer_attempt_id: "",
    level,
    missing_points,
    upgrade_suggestion,
    source: "local_heuristic",
    created_at: new Date().toISOString(),
  };
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4)
    .filter((w) => !STOP_WORDS.has(w));
}

const STOP_WORDS = new Set([
  "about", "above", "after", "again", "also", "another", "answer", "before",
  "being", "between", "cover", "every", "example", "explain", "first",
  "from", "have", "include", "including", "least", "make", "more", "most",
  "must", "needs", "other", "plus", "should", "their", "there", "these",
  "thing", "think", "this", "those", "three", "through", "using", "where",
  "which", "while", "with", "without", "would", "write", "your",
]);
