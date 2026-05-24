import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Lock, RefreshCw, Sparkles, X, GraduationCap, Target, CalendarClock, Music, Moon, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useStateStore } from "@/stores/state-store";
import { sortBlocks } from "@/lib/engine/week-plan";
import { useAI } from "@/lib/ai/useAI";
import type { WeekBlock, WeekCategory } from "@/lib/types";

const HOUR_START = 7;
const HOUR_END = 22;
const HOUR_PX_DEFAULT = 56;

function useHourPx() {
  const [px, setPx] = useState(HOUR_PX_DEFAULT);
  useEffect(() => {
    const update = () =>
      setPx(window.innerWidth < 640 ? 36 : window.innerWidth < 1024 ? 48 : 56);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return px;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// Refined, more distinguishable palette
const CATEGORY_META: Record<WeekCategory, {
  label: string;
  text: string;     // text color
  bg: string;       // block background
  border: string;   // left accent border
  dot: string;      // legend swatch
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  school:     { label: "School",     text: "text-amber-50",    bg: "bg-amber-600",   border: "border-l-amber-300",   dot: "bg-amber-500",   Icon: GraduationCap },
  goal:       { label: "Goal",       text: "text-violet-50",   bg: "bg-violet-600",  border: "border-l-violet-300",  dot: "bg-violet-500",  Icon: Target },
  commitment: { label: "Commitment", text: "text-rose-50",     bg: "bg-rose-600",    border: "border-l-rose-300",    dot: "bg-rose-500",    Icon: CalendarClock },
  hobby:      { label: "Hobby",      text: "text-emerald-50",  bg: "bg-emerald-600", border: "border-l-emerald-300", dot: "bg-emerald-500", Icon: Music },
  rest:       { label: "Rest",       text: "text-slate-50",    bg: "bg-slate-600",   border: "border-l-slate-300",   dot: "bg-slate-500",   Icon: Moon },
};

const DAY_OF_WEEK_NUMS = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun JS day numbers
const todayIdx = (() => {
  const js = new Date().getDay();
  return DAY_OF_WEEK_NUMS.indexOf(js);
})();

function timeToY(hhmm: string, hourPx = HOUR_PX_DEFAULT): number {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h - HOUR_START) * 60 + m) * (hourPx / 60);
}
function durationPx(start: string, end: string, hourPx = HOUR_PX_DEFAULT): number {
  return Math.max(28, timeToY(end, hourPx) - timeToY(start, hourPx));
}
function snapTime(minutes: number): string {
  const clamped = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, minutes));
  const snapped = Math.round(clamped / 15) * 15;
  return `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`;
}
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
const uid = () => `wb_${Math.random().toString(36).slice(2, 10)}`;

export function WeeklyGrid() {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const blocks = ((state?.schedule_state.week_plan ?? []) as WeekBlock[]).slice().sort(sortBlocks);
  const [editing, setEditing] = useState<WeekBlock | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(todayIdx);
  const [reformOpen, setReformOpen] = useState(false);
  const [reformNote, setReformNote] = useState("");
  const { run: runRegenerate, loading: regenerating } = useAI<{ explanation: string; blocks: Omit<WeekBlock, "id" | "notes" | "is_locked"> & { notes?: string; is_locked?: boolean }[] | any }>("week_regenerate");
  const hourPx = useHourPx();

  const onAiReform = async () => {
    if (!reformNote.trim()) return;
    const res: any = await runRegenerate({
      reform_note: reformNote.trim(),
      current_blocks: blocks.map((b) => ({
        id: b.id, day_index: b.day_index, start_time: b.start_time,
        end_time: b.end_time, title: b.title, category: b.category, is_locked: b.is_locked,
      })),
    });
    if (!res || !Array.isArray(res.blocks) || res.blocks.length === 0) {
      toast.error("Couldn't regenerate", { description: "Try a more specific note (e.g. 'less evening study, add morning runs')." });
      return;
    }
    const rebuilt: WeekBlock[] = res.blocks
      .filter((b: any) => b && typeof b.day_index === "number" && b.start_time && b.end_time && b.title && b.category)
      .map((b: any) => ({
        id: uid(),
        day_index: Math.max(0, Math.min(6, Number(b.day_index))),
        start_time: String(b.start_time),
        end_time: String(b.end_time),
        title: String(b.title),
        category: (["school","goal","commitment","hobby","rest"].includes(b.category) ? b.category : "goal") as WeekCategory,
        notes: typeof b.notes === "string" ? b.notes : "",
        is_locked: Boolean(b.is_locked),
      }));
    if (rebuilt.length === 0) {
      toast.error("Regeneration returned no usable blocks");
      return;
    }
    dispatch({ type: "week/set", payload: rebuilt });
    toast.success("Week regenerated", { description: res.explanation || "Updated based on your note." });
    setReformOpen(false);
    setReformNote("");
  };


  const blocksByDay = useMemo(() => {
    const out: WeekBlock[][] = [[], [], [], [], [], [], []];
    for (const b of blocks) out[b.day_index]?.push(b);
    return out;
  }, [blocks]);

  if (state && blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
        <Sparkles className="mx-auto h-5 w-5 text-primary" />
        <h3 className="mt-3 text-sm font-medium">Build your week</h3>
        <p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground">
          We'll lay out school, your goal, commitments and hobbies across 7 days. Every block is liquid — reform anytime.
        </p>
        <button
          onClick={() => dispatch({ type: "week/seed" })}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          Generate week
        </button>
      </div>
    );
  }

  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const totalHeight = hours.length * hourPx;

  const addBlock = (dayIdx: number, startMin: number) => {
    const startTotal = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60 - 60, startMin));
    const start = snapTime(startTotal);
    const end = snapTime(startTotal + 60);
    const block: WeekBlock = {
      id: uid(),
      day_index: dayIdx,
      start_time: start,
      end_time: end,
      title: "New block",
      category: "goal",
      notes: "",
      is_locked: false,
    };
    dispatch({ type: "week/addBlock", payload: block });
    setEditing(block);
  };

  return (
    <section className="space-y-4">
      {/* Header / Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Liquid Week</div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Your 7-day shape</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReformOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${
              reformOpen
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:border-primary/50 hover:bg-card/80"
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reform
          </button>
          <button
            onClick={() => {
              dispatch({ type: "week/seed" });
              toast.success("Week reseeded", { description: "Fresh layout generated from your constraints." });
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" /> Reseed
          </button>
        </div>
      </div>

      {/* AI Reform panel */}
      <AnimatePresence initial={false}>
        {reformOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-primary/30 bg-primary/5"
          >
            <div className="space-y-3 p-4">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">Reform with AI</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tell Moment what to change. It rebuilds the week around your locked blocks.
                </p>
              </div>
              <textarea
                value={reformNote}
                onChange={(e) => setReformNote(e.target.value)}
                placeholder="e.g. Less evening study, add two morning runs, lighter Sundays, more biology recall on Tue/Thu."
                rows={3}
                className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                disabled={regenerating}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setReformOpen(false); setReformNote(""); }}
                  className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  disabled={regenerating}
                >
                  Cancel
                </button>
                <button
                  onClick={onAiReform}
                  disabled={regenerating || !reformNote.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {regenerating ? "Regenerating…" : "Regenerate week"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
        {(Object.keys(CATEGORY_META) as WeekCategory[]).map((cat) => {
          const m = CATEGORY_META[cat];
          return (
            <span key={cat} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${m.dot}`} />
              {m.label}
            </span>
          );
        })}
      </div>

      {/* Mobile day-picker: pills visible only below md */}
      <div className="flex gap-1.5 md:hidden">
        {DAY_LABELS.map((d, i) => (
          <button
            key={d}
            onClick={() => setSelectedDay(i)}
            className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${
              selectedDay === i
                ? "bg-primary text-primary-foreground"
                : i === todayIdx
                ? "border border-primary/40 text-primary"
                : "border border-border text-muted-foreground"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card/40">
        <div
          className="grid w-full md:min-w-[860px]"
          style={{ gridTemplateColumns: `48px repeat(7, minmax(0, 1fr))` }}
        >
          {/* Day header row */}
          <div className="border-b border-border bg-card/60" />
          {DAY_LABELS.map((d, i) => {
            const isToday = i === todayIdx;
            const isHiddenOnMobile = i !== selectedDay;
            return (
              <div
                key={d}
                className={`border-b border-l border-border px-3 py-2.5 text-left ${
                  isToday ? "bg-primary/5" : "bg-card/60"
                } ${isHiddenOnMobile ? "hidden md:block" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isToday ? "text-primary" : "text-foreground/80"}`}>
                    {d}
                  </span>
                  {isToday && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {blocksByDay[i].length} {blocksByDay[i].length === 1 ? "block" : "blocks"}
                </div>
              </div>
            );
          })}

          {/* Time gutter */}
          <div
            className="relative border-r border-border bg-card/30"
            style={{ height: totalHeight }}
          >
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 font-mono text-[10px] tabular-nums text-muted-foreground/80"
                style={{ top: i * hourPx }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAY_LABELS.map((_, dayIdx) => {
            const isToday = dayIdx === todayIdx;
            const isHiddenOnMobile = dayIdx !== selectedDay;
            return (
              <div
                key={dayIdx}
                className={`group relative border-l border-border ${isToday ? "bg-primary/[0.03]" : ""} ${isHiddenOnMobile ? "hidden md:block" : ""}`}
                style={{ height: totalHeight }}
                onMouseEnter={() => setHoverDay(dayIdx)}
                onMouseLeave={() => setHoverDay(null)}
                onDoubleClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const minutes = HOUR_START * 60 + Math.round(y / (hourPx / 60));
                  addBlock(dayIdx, minutes);
                }}
              >
                {/* Hour grid lines (subtle, half-hour even subtler) */}
                {hours.map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-border/40"
                    style={{ top: i * hourPx }}
                  />
                ))}
                {hours.slice(0, -1).map((_, i) => (
                  <div
                    key={`half-${i}`}
                    className="absolute left-0 right-0 border-t border-dashed border-border/15"
                    style={{ top: i * hourPx + hourPx / 2 }}
                  />
                ))}

                {/* Blocks */}
                <AnimatePresence>
                  {blocksByDay[dayIdx].map((b) => {
                    const meta = CATEGORY_META[b.category];
                    const Icon = meta.Icon;
                    const h = durationPx(b.start_time, b.end_time, hourPx);
                    const compact = h < 44;
                    return (
                      <motion.button
                        key={b.id}
                        layout
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        onClick={() => setEditing(b)}
                        title={`${b.title} · ${b.start_time}–${b.end_time}`}
                        className={`absolute left-1 right-1 overflow-hidden rounded-md border-l-2 ${meta.border} ${meta.bg} px-2 py-1.5 text-left shadow-sm backdrop-blur-[2px] transition-all hover:z-20 hover:shadow-lg hover:ring-1 hover:ring-foreground/20`}
                        style={{
                          top: timeToY(b.start_time, hourPx) + 1,
                          height: h - 2,
                        }}
                      >
                        <div className={`flex items-center gap-1 ${meta.text}`}>
                          <Icon className="h-3 w-3 shrink-0 opacity-80" />
                          {b.is_locked && <Lock className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                          <span className="line-clamp-2 text-[11px] font-medium leading-tight">{b.title}</span>
                        </div>
                        {!compact && (
                          <div className={`mt-1 font-mono text-[9px] tabular-nums ${meta.text} opacity-80`}>
                            {b.start_time}–{b.end_time}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>

                {/* Single floating add button on hover (top-right of column) */}
                <AnimatePresence>
                  {hoverDay === dayIdx && (
                    <motion.button
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      onClick={() => addBlock(dayIdx, 17 * 60)}
                      className="absolute right-1.5 top-1.5 z-30 inline-flex items-center gap-1 rounded-full bg-foreground/90 px-2 py-0.5 text-[10px] font-medium text-background shadow-md hover:bg-foreground"
                    >
                      <Plus className="h-3 w-3" /> add
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Double-click any empty slot to add. Click a block to edit. <span className="text-foreground/80">Reform</span> reshuffles liquid blocks; locked ones (school, commitments) stay put.
      </p>

      {/* Editor modal */}
      <AnimatePresence>
        {editing && (
          <BlockEditor
            block={editing}
            onClose={() => setEditing(null)}
            onSave={(changes) => {
              dispatch({ type: "week/updateBlock", payload: { id: editing.id, changes } });
              setEditing(null);
            }}
            onDelete={() => {
              dispatch({ type: "week/deleteBlock", payload: { id: editing.id } });
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

interface EditorProps {
  block: WeekBlock;
  onClose: () => void;
  onSave: (changes: Partial<WeekBlock>) => void;
  onDelete: () => void;
}

function BlockEditor({ block, onClose, onSave, onDelete }: EditorProps) {
  const [title, setTitle] = useState(block.title);
  const [category, setCategory] = useState<WeekCategory>(block.category);
  const [day, setDay] = useState(block.day_index);
  const [start, setStart] = useState(block.start_time);
  const [end, setEnd] = useState(block.end_time);
  const [locked, setLocked] = useState(block.is_locked);
  const [notes, setNotes] = useState(block.notes ?? "");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Edit block</h3>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Block title"
        />

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CATEGORY_META) as WeekCategory[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.Icon;
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition ${meta.bg} ${meta.text} ${
                  active ? "ring-1 ring-foreground/40" : "ring-1 ring-transparent"
                }`}
              >
                <Icon className="h-3 w-3" />
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Day
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              {DAY_LABELS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Start
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            End
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notes (optional)"
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs"
        />

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
          Lock — won't be moved by "Reform week"
        </label>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground">
              Cancel
            </button>
            <button
              onClick={() =>
                onSave({
                  title: title.trim() || "Untitled",
                  category,
                  day_index: day,
                  start_time: snapTime(toMinutes(start)),
                  end_time: snapTime(Math.max(toMinutes(start) + 15, toMinutes(end))),
                  notes,
                  is_locked: locked,
                })
              }
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
