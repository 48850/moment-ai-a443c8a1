/**
 * Exam Copilot Panel — captures task profile + resource map for an ExamEmergency.
 *
 * The user can also fill this via chat; this panel is the inline editor.
 * Step 2 of the Exam Copilot build. Step 3+ (Questioner/Rating) will read
 * from these fields to produce non-generic questions.
 */
import { useState } from "react";
import {
  FileText, Layers, BookOpen, ClipboardList, Plus, X,
  Target, Sparkles, GraduationCap,
} from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import type { ExamEmergency, ExamResource, ExamTaskProfile } from "@/lib/types";
import type { ExamResourceKind, ExamTaskFormat } from "@/lib/types/exam-emergency";

const FORMAT_OPTIONS: Array<{ value: ExamTaskFormat; label: string }> = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "short_answer", label: "Short answer" },
  { value: "essay", label: "Essay" },
  { value: "prac", label: "Prac" },
  { value: "oral", label: "Oral" },
  { value: "mixed", label: "Mixed" },
];

const RESOURCE_KINDS: Array<{ value: ExamResourceKind; label: string }> = [
  { value: "notes", label: "Class notes" },
  { value: "textbook", label: "Textbook" },
  { value: "slides", label: "Slides" },
  { value: "past_paper", label: "Past paper" },
  { value: "rubric", label: "Rubric" },
  { value: "study_guide", label: "Study guide" },
  { value: "teacher_feedback", label: "Teacher feedback" },
  { value: "practice_q", label: "Practice questions" },
  { value: "other", label: "Other" },
];

const KIND_PRIORITY: Record<ExamResourceKind, "high" | "medium" | "low"> = {
  past_paper: "high",
  rubric: "high",
  teacher_feedback: "high",
  practice_q: "high",
  notes: "medium",
  slides: "medium",
  study_guide: "medium",
  textbook: "low",
  other: "low",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  medium: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  low: "border-border bg-muted/30 text-muted-foreground",
};

export function ExamCopilotPanel({ emergency }: { emergency: ExamEmergency }) {
  const dispatch = useStateStore((s) => s.dispatch);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addingResource, setAddingResource] = useState(false);

  const profile = emergency.task_profile;
  const resources = emergency.resources ?? [];

  const handleSaveProfile = (next: ExamTaskProfile) => {
    dispatch({
      type: "exam/set_task_profile",
      payload: { emergencyId: emergency.id, profile: next },
    } as any);
    setEditingProfile(false);
  };

  const handleAddResource = (kind: ExamResourceKind, label: string) => {
    const resource: ExamResource = {
      id: crypto.randomUUID(),
      kind,
      label: label.trim(),
      helps_with: [],
      priority: KIND_PRIORITY[kind] ?? "medium",
      how_to_use: defaultHowToUse(kind),
      created_at: new Date().toISOString(),
    };
    dispatch({
      type: "exam/add_resource",
      payload: { emergencyId: emergency.id, resource },
    } as any);
    setAddingResource(false);
  };

  const handleRemoveResource = (resourceId: string) => {
    dispatch({
      type: "exam/remove_resource",
      payload: { emergencyId: emergency.id, resourceId },
    } as any);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        <Sparkles className="h-3 w-3" /> exam copilot
      </div>

      {/* ── Task profile ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
            Task profile
          </div>
          {!editingProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              className="text-[11px] text-primary hover:underline"
            >
              {profile ? "Edit" : "Add"}
            </button>
          )}
        </div>

        {editingProfile ? (
          <TaskProfileForm
            initial={profile}
            onSave={handleSaveProfile}
            onCancel={() => setEditingProfile(false)}
          />
        ) : profile ? (
          <TaskProfileSummary profile={profile} />
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            Add structure so Moment can ask the right questions and rate your answers — format, sections, target mark.
          </p>
        )}
      </div>

      {/* ── Resource map ──────────────────────────────────────────────── */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
            Resources <span className="text-muted-foreground">({resources.length})</span>
          </div>
          {!addingResource && (
            <button
              onClick={() => setAddingResource(true)}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>

        {addingResource && (
          <ResourceForm onSave={handleAddResource} onCancel={() => setAddingResource(false)} />
        )}

        {resources.length === 0 && !addingResource && (
          <p className="text-[11px] text-muted-foreground italic">
            Tell Moment what you have — past papers, rubric, notes — so the plan and questions use real material.
          </p>
        )}

        {resources.length > 0 && (
          <ul className="space-y-1.5">
            {resources.map((r) => (
              <li
                key={r.id}
                className={`flex items-start justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${PRIORITY_COLOR[r.priority]}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{r.label}</span>
                    <span className="text-[10px] opacity-70 shrink-0">
                      {RESOURCE_KINDS.find((k) => k.value === r.kind)?.label ?? r.kind}
                    </span>
                  </div>
                  {r.how_to_use && (
                    <p className="text-[10px] opacity-70 mt-0.5">{r.how_to_use}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveResource(r.id)}
                  className="opacity-50 hover:opacity-100 shrink-0"
                  aria-label="Remove resource"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ── Task profile summary ────────────────────────────────────────────────────

function TaskProfileSummary({ profile }: { profile: ExamTaskProfile }) {
  const formatLabel = FORMAT_OPTIONS.find((f) => f.value === profile.format)?.label ?? "Unknown format";
  return (
    <div className="space-y-1 text-[11px] text-muted-foreground">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-foreground">
          <FileText className="h-2.5 w-2.5" /> {formatLabel}
        </span>
        {profile.target_mark && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
            <Target className="h-2.5 w-2.5" /> {profile.target_mark}
          </span>
        )}
        {profile.has_rubric && (
          <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5">rubric ✓</span>
        )}
        {profile.has_past_papers && (
          <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5">past papers ✓</span>
        )}
      </div>
      {profile.sections.length > 0 && (
        <p>
          <Layers className="inline h-2.5 w-2.5 mr-1" />
          {profile.sections.length} sections
          {profile.highest_mark_section && ` · highest: ${profile.highest_mark_section}`}
        </p>
      )}
      {profile.teacher_emphasis && (
        <p>
          <GraduationCap className="inline h-2.5 w-2.5 mr-1" />
          Teacher emphasises: {profile.teacher_emphasis}
        </p>
      )}
    </div>
  );
}

// ── Task profile form ───────────────────────────────────────────────────────

function TaskProfileForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ExamTaskProfile;
  onSave: (p: ExamTaskProfile) => void;
  onCancel: () => void;
}) {
  const [format, setFormat] = useState<ExamTaskFormat>(initial?.format ?? "unknown");
  const [sections, setSections] = useState(initial?.sections.join(", ") ?? "");
  const [highestSection, setHighestSection] = useState(initial?.highest_mark_section ?? "");
  const [targetMark, setTargetMark] = useState(initial?.target_mark ?? "");
  const [teacherEmphasis, setTeacherEmphasis] = useState(initial?.teacher_emphasis ?? "");
  const [hasRubric, setHasRubric] = useState(initial?.has_rubric ?? false);
  const [hasPastPapers, setHasPastPapers] = useState(initial?.has_past_papers ?? false);
  const [hasTopicList, setHasTopicList] = useState(initial?.has_topic_list ?? false);

  const save = () => {
    onSave({
      format,
      sections: sections.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12),
      highest_mark_section: highestSection.trim() || undefined,
      has_rubric: hasRubric,
      rubric_text: initial?.rubric_text,
      has_topic_list: hasTopicList,
      has_past_papers: hasPastPapers,
      teacher_emphasis: teacherEmphasis.trim().slice(0, 240) || undefined,
      target_mark: targetMark.trim().slice(0, 40) || undefined,
      updated_at: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/50 p-2.5">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Format</label>
        <div className="mt-1 flex flex-wrap gap-1">
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                format === f.value
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Sections (comma-separated)"
        value={sections}
        onChange={setSections}
        placeholder="Section A, Section B, Essay"
      />
      <Input
        label="Highest-mark section"
        value={highestSection}
        onChange={setHighestSection}
        placeholder="Essay"
      />
      <Input
        label="Target mark"
        value={targetMark}
        onChange={setTargetMark}
        placeholder="80%, B+, just pass"
      />
      <Input
        label="What does your teacher emphasise?"
        value={teacherEmphasis}
        onChange={setTeacherEmphasis}
        placeholder="Show working, use case studies, etc."
      />

      <div className="flex flex-wrap gap-2 text-[11px]">
        <Toggle label="Have rubric" value={hasRubric} onChange={setHasRubric} />
        <Toggle label="Have past papers" value={hasPastPapers} onChange={setHasPastPapers} />
        <Toggle label="Have topic list" value={hasTopicList} onChange={setHasTopicList} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={save}
          className="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ── Resource form ───────────────────────────────────────────────────────────

function ResourceForm({
  onSave,
  onCancel,
}: {
  onSave: (kind: ExamResourceKind, label: string) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<ExamResourceKind>("past_paper");
  const [label, setLabel] = useState("");

  const submit = () => {
    if (!label.trim()) return;
    onSave(kind, label);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/50 p-2.5">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</label>
        <div className="mt-1 flex flex-wrap gap-1">
          {RESOURCE_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`text-[11px] px-2 py-0.5 rounded-full border ${
                kind === k.value
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <Input
        label="Label"
        value={label}
        onChange={setLabel}
        placeholder="e.g. 2023 VCE Methods paper"
      />
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="text-[11px] text-muted-foreground hover:text-foreground">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!label.trim()}
          className="rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 240))}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`px-2 py-0.5 rounded-full border ${
        value
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label} {value ? "✓" : ""}
    </button>
  );
}

function defaultHowToUse(kind: ExamResourceKind): string {
  switch (kind) {
    case "past_paper": return "Work through one question per block under exam timing.";
    case "rubric": return "Check answers against criteria after each attempt.";
    case "teacher_feedback": return "Address one feedback item before each practice block.";
    case "practice_q": return "Do 3–5 questions, then review which were wrong.";
    case "notes": return "Read once, then memory-dump from blank page.";
    case "slides": return "Skim for definitions; turn each into a recall prompt.";
    case "study_guide": return "Use as the topic checklist for triage.";
    case "textbook": return "Use as backup explanation when a topic stays unclear.";
    default: return "";
  }
}
