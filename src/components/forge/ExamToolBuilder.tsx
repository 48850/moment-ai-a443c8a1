import { useMemo } from "react";
import { BookOpen, Zap } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import type { ExamEmergency } from "@/lib/types";
import type { ForgeFeatureType } from "@/lib/types";

interface ToolCard {
  title: string;
  description: string;
  featureType: ForgeFeatureType;
  descriptionHint: string;
}

interface Props {
  onBuildTool: (type: ForgeFeatureType, descriptionHint: string) => void;
}

export function ExamToolBuilder({ onBuildTool }: Props) {
  const state = useStateStore((s) => s.state);

  const emergency: ExamEmergency | undefined = useMemo(
    () =>
      (state?.exam_emergencies as ExamEmergency[] | undefined)?.find(
        (e) => e.status === "active" || e.status === "intake",
      ),
    [state?.exam_emergencies],
  );

  if (!emergency) return null;

  const subject = emergency.subject;
  const priorityTopics = emergency.topics
    .filter((t) => t.priority === "critical" || t.priority === "high")
    .map((t) => t.name)
    .slice(0, 3)
    .join(", ") || subject;

  const weakTopics = emergency.topics
    .filter((t) => t.confidence <= 2)
    .map((t) => t.name)
    .slice(0, 3)
    .join(", ");

  const tools: ToolCard[] = [
    {
      title: "Practice Quiz",
      description: `10 questions on ${priorityTopics} with worked answers`,
      featureType: "drill_lab",
      descriptionHint: `Build a 10-question practice quiz for ${subject} focusing on ${priorityTopics}. Include model answers for each question.`,
    },
    {
      title: "Flashcard Set",
      description: `Key concepts for ${priorityTopics}`,
      featureType: "tracker",
      descriptionHint: `Create a flashcard set for ${subject} revision covering these critical topics: ${priorityTopics}. Each card should have a term on one side and a clear explanation on the other.`,
    },
    {
      title: "Essay Plan Builder",
      description: `Structured plans for ${subject} essay questions`,
      featureType: "protocol",
      descriptionHint: `Build an essay plan template for ${subject} exam questions. Include introduction structure, body paragraph formula, and conclusion approach with worked examples.`,
    },
    {
      title: "Formula Drill",
      description: `Formula and method practice for ${subject}`,
      featureType: "drill_lab",
      descriptionHint: `Create a formula and method drill sheet for ${subject}. List all key formulas, worked example problems, and a self-test checklist.`,
    },
    ...(weakTopics
      ? [
          {
            title: "Weak Topic Drill",
            description: `Extra practice for ${weakTopics}`,
            featureType: "drill_lab" as ForgeFeatureType,
            descriptionHint: `Build a targeted drill for the weakest topics in ${subject}: ${weakTopics}. Start with fundamentals, then add practice questions at increasing difficulty.`,
          },
        ]
      : []),
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-medium text-foreground">Exam tools · {subject}</span>
        <span className="text-[11px] text-muted-foreground">Build a study tool for this exam</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tools.slice(0, 5).map((tool) => (
          <div
            key={tool.title}
            className="rounded-xl border border-border bg-card p-3 flex items-start justify-between gap-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{tool.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{tool.description}</p>
            </div>
            <button
              onClick={() => onBuildTool(tool.featureType, tool.descriptionHint)}
              className="flex items-center gap-1 shrink-0 rounded-md bg-primary/15 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/25 transition-colors"
            >
              <Zap className="h-2.5 w-2.5" />
              Build
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
