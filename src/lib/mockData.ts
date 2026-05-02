// Mock data shaped to match the ViewModel contracts in
// LOVABLE_HANDOFF_PROMPTS.md. These are placeholders so the UI
// renders standalone — the real shapes will come from
// src/lib/selectors/* once the state layer is ported.

export const FEEDBACK_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "hard", label: "Hard" },
  { value: "too_vague", label: "Too vague" },
  { value: "too_big", label: "Too big" },
  { value: "valuable", label: "Valuable" },
  { value: "not_relevant", label: "Not relevant" },
  { value: "need_help", label: "Need help" },
  { value: "do_differently", label: "Do differently" },
] as const;

export type FeedbackValue = (typeof FEEDBACK_OPTIONS)[number]["value"];

export type Task = {
  id: string;
  title: string;
  status: "pending" | "completed";
  estimated_minutes: number;
  priority?: "high" | "medium" | "low";
};

export type ScheduleBlock = {
  id: string;
  title: string;
  type: "study" | "exercise" | "commute" | "buffer" | "fixed";
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: "pending" | "completed";
  decisive?: boolean;
};

// ---- Home ----
export const homeMock = {
  greeting: "Today, Sat May 2",
  goalSnippet: "Stanford CS 2027",
  decisiveMove: {
    id: "t-essay-opener",
    title: "Draft three opening lines for the Stanford 'why us' essay",
    description: "Pick the one that scares you most. 25-min sprint.",
    estimatedMinutes: 25,
  },
  whyThisMattered: {
    populated: false,
    taskTitle: "",
    workstreamName: "",
    rationale: "",
    nextProof: "",
  },
  tasks: [
    { id: "t1", title: "Re-read last essay draft", status: "pending", estimated_minutes: 15 },
    { id: "t2", title: "30-min focused math review (problem set 4)", status: "pending", estimated_minutes: 30 },
    { id: "t3", title: "Email Mr. Patel about rec letter", status: "completed", estimated_minutes: 10 },
  ] as Task[],
};

// ---- Plan ----
export const planMock = {
  scheduleBlocks: [
    { id: "b1", title: "School", type: "fixed", start_time: "08:00", end_time: "15:30", duration_minutes: 450, status: "completed" },
    { id: "b2", title: "Commute home", type: "commute", start_time: "15:30", end_time: "16:00", duration_minutes: 30, status: "completed" },
    { id: "b3", title: "Essay opener sprint", type: "study", start_time: "16:30", end_time: "17:00", duration_minutes: 30, status: "pending", decisive: true },
    { id: "b4", title: "Buffer + snack", type: "buffer", start_time: "17:00", end_time: "17:20", duration_minutes: 20, status: "pending" },
    { id: "b5", title: "Math problem set 4", type: "study", start_time: "17:20", end_time: "18:00", duration_minutes: 40, status: "pending" },
    { id: "b6", title: "Run", type: "exercise", start_time: "18:30", end_time: "19:10", duration_minutes: 40, status: "pending" },
  ] as ScheduleBlock[],
  hasPlanB: false,
  activePlan: "plan_a" as "plan_a" | "plan_b",
  unscheduledTasks: [
    { id: "u1", title: "Order SAT prep book", status: "pending", estimated_minutes: 5 },
  ] as Task[],
};

// ---- Mission ----
export type Workstream = {
  id: string;
  name: string;
  status: "on_track" | "at_risk" | "blocked" | "complete" | "not_started";
  bottleneck?: string;
  description: string;
  next_proof: string;
  last_updated_at: string;
};
export type CapabilityCluster = {
  id: string;
  name: string;
  status: "mastered" | "solid" | "developing" | "emerging" | "not_started";
};
export type EvidenceSignal = {
  id: string;
  name: string;
  type: "leading" | "lagging";
  last_value: string | null;
  last_checked_at: string | null;
};

export const missionMock = {
  goal: { statement: "Stanford CS, class of 2027", deadline: "2026-11-01" },
  activeOperatingMode: { name: "Essay sprint" },
  workstreams: [
    { id: "w1", name: "Personal essays", status: "at_risk", bottleneck: "Opener still unclear", description: "Draft, revise, and finalize 3 supplements + main essay.", next_proof: "Submit opener for mentor review", last_updated_at: "2d ago" },
    { id: "w2", name: "Standardized testing", status: "on_track", description: "Hit 1520+ SAT.", next_proof: "Practice test #6 by Sunday", last_updated_at: "today" },
    { id: "w3", name: "Recommendations", status: "not_started", description: "Two academic + one counselor.", next_proof: "Ask Mr. Patel", last_updated_at: "—" },
    { id: "w4", name: "Activities narrative", status: "complete", description: "10 activities ranked + described.", next_proof: "—", last_updated_at: "1w ago" },
  ] as Workstream[],
  capabilityClusters: [
    { id: "c1", name: "Narrative writing", status: "developing" },
    { id: "c2", name: "Math reasoning", status: "solid" },
    { id: "c3", name: "Self-editing", status: "emerging" },
    { id: "c4", name: "Time-boxing", status: "mastered" },
  ] as CapabilityCluster[],
  evidenceSignals: [
    { id: "e1", name: "Mock SAT score", type: "lagging", last_value: "1480", last_checked_at: "Apr 28" },
    { id: "e2", name: "Decisive days streak", type: "leading", last_value: "12", last_checked_at: "today" },
    { id: "e3", name: "Mentor feedback cycles", type: "leading", last_value: null, last_checked_at: null },
  ] as EvidenceSignal[],
};

// ---- Chat ----
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  renderedResponse?: { type: "day_plan"; blocks: ScheduleBlock[] } | null;
};

export const chatMock: ChatMessage[] = [
  { id: "m1", role: "assistant", content: "Hey Alex — what's on your mind today?" },
  { id: "m2", role: "user", content: "I'm anxious about the Stanford opener. Can't pick a line." },
  { id: "m3", role: "assistant", content: "That's the right thing to be anxious about. Let's commit to one 25-minute sprint after school. Here's today's plan:", renderedResponse: { type: "day_plan", blocks: planMock.scheduleBlocks } },
];
