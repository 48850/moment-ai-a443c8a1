import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Lock, RefreshCw, Sparkles, X } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import {
  CATEGORY_META,
  DAY_LABELS,
  sortBlocks,
} from "@/lib/engine/week-plan";
import type { WeekBlock, WeekCategory } from "@/lib/types";

const HOUR_START = 7;
const HOUR_END = 22; // exclusive — visual range 07:00–22:00
const HOUR_PX = 36;

function timeToY(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return ((h - HOUR_START) * 60 + m) * (HOUR_PX / 60);
}
function durationPx(start: string, end: string): number {
  return Math.max(20, timeToY(end) - timeToY(start));
}
function snapTime(minutes: number): string {
  const clamped = Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, minutes));
  const snapped = Math.round(clamped / 15) * 15;
  return `${String(Math.floor(snapped / 60)).padStart(2, "0")}:${String(snapped % 60).padStart(2, "0")}`;
}

const uid = () => `wb_${Math.random().toString(36).slice(2, 10)}`;

export function WeeklyGrid() {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const blocks = ((state?.schedule_state.week_plan ?? []) as WeekBlock[]).slice().sort(sortBlocks);
  const [editing, setEditing] = useState<WeekBlock | null>(null);

  const blocksByDay = useMemo(() => {
    const out: WeekBlock[][] = [[], [], [], [], [], [], []];
    for (const b of blocks) out[b.day_index]?.push(b);
    return out;
  }, [blocks]);

  // Auto-seed if empty
  if (state && blocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <Sparkles className="mx-auto h-5 w-5 text-primary" />
        <h3 className="mt-3 text-sm font-medium">Build your week</h3>
        <p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground">
          We'll lay out school, your goal, commitments and hobbies across 7 days.
          Every block is liquid — drag to reform anytime.
        </p>
        <button
          onClick={() => dispatch({ type: "week/seed" })}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
        >
          Generate week
        </button>
      </div>
    );
  }

  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  const addBlock = (dayIdx: number, startHour: number) => {
    const start = `${String(startHour).padStart(2, "0")}:00`;
    const end = `${String(startHour + 1).padStart(2, "0")}:00`;
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
    <section className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Liquid week</span>
          <span className="text-border">·</span>
          {(Object.keys(CATEGORY_META) as WeekCategory[]).map((cat) => (
            <span key={cat} className={`inline-flex items-center gap-1 ${CATEGORY_META[cat].tone}`}>
              <span className={`h-2 w-2 rounded-sm ${CATEGORY_META[cat].bg}`} />
              {CATEGORY_META[cat].label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: "week/reform" })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs hover:border-primary/40"
          >
            <RefreshCw className="h-3 w-3" /> Reform week
          </button>
          <button
            onClick={() => dispatch({ type: "week/seed" })}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground"
          >
            <Sparkles className="h-3 w-3" /> Reseed
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `48px repeat(7, minmax(0, 1fr))` }}>
          {/* Header row */}
          <div className="border-b border-border" />
          {DAY_LABELS.map((d) => (
            <div key={d} className="border-b border-l border-border px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {d}
            </div>
          ))}

          {/* Time gutter */}
          <div
            className="relative border-r border-border"
            style={{ height: hours.length * HOUR_PX }}
          >
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 font-mono text-[9px] text-muted-foreground"
                style={{ top: i * HOUR_PX }}
              >
                {String(h).padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {DAY_LABELS.map((_, dayIdx) => (
            <div
              key={dayIdx}
              className="relative border-l border-border"
              style={{ height: hours.length * HOUR_PX }}
              onDoubleClick={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const y = e.clientY - rect.top;
                const minutes = HOUR_START * 60 + Math.round(y / (HOUR_PX / 60));
                addBlock(dayIdx, Math.floor(minutes / 60));
              }}
            >
              {/* Hour grid lines */}
              {hours.map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-border/50"
                  style={{ top: i * HOUR_PX }}
                />
              ))}

              {/* Empty-state add hint */}
              {blocksByDay[dayIdx].length === 0 && (
                <button
                  type="button"
                  onClick={() => addBlock(dayIdx, 17)}
                  className="absolute inset-2 flex items-center justify-center rounded-md border border-dashed border-border/50 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  <Plus className="mr-1 h-3 w-3" /> add
                </button>
              )}

              {/* Blocks */}
              <AnimatePresence>
                {blocksByDay[dayIdx].map((b) => {
                  const meta = CATEGORY_META[b.category];
                  return (
                    <motion.button
                      key={b.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      onClick={() => setEditing(b)}
                      className={`absolute left-1 right-1 overflow-hidden rounded-md ring-1 ${meta.ring} ${meta.bg} px-1.5 py-1 text-left transition-shadow hover:shadow-md`}
                      style={{
                        top: timeToY(b.start_time),
                        height: durationPx(b.start_time, b.end_time),
                      }}
                    >
                      <div className={`flex items-center gap-1 text-[10px] font-medium ${meta.tone}`}>
                        {b.is_locked && <Lock className="h-2.5 w-2.5 opacity-70" />}
                        <span className="truncate">{b.title}</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[9px] text-foreground/60">
                        {b.start_time}–{b.end_time}
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>

              {/* Tap-to-add */}
              <button
                type="button"
                aria-label="Add block"
                onClick={() => addBlock(dayIdx, 17)}
                className="absolute bottom-1 right-1 z-10 rounded-full bg-background/80 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100 sm:opacity-100"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Double-click any empty slot to add. Click a block to edit, move days, or change time. <span className="text-foreground/70">Reform week</span> reshuffles everything liquid; locked blocks (school, commitments) stay put.
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
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
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${meta.bg} ${meta.tone} ring-1 ${
                  active ? meta.ring : "ring-transparent"
                }`}
              >
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

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
