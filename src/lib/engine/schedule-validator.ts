import type { MomentState, ScheduleBlock } from "@/lib/types";
import { timeToMinutes, minutesToTime } from "@/lib/utils";

interface ValidationResult {
  blocks: ScheduleBlock[];
  confidence: number;
  warnings: string[];
  rejected: boolean;
}

export function validateSchedule(blocks: ScheduleBlock[], state: MomentState): ValidationResult {
  const warnings: string[] = [];
  let repairCount = 0;
  let structuralIssues = 0;
  let confidence = 100;

  if (blocks.length === 0) return { blocks: [], confidence: 0, warnings: ["No schedule blocks provided"], rejected: false };

  let sorted = blocks
    .filter((b) => {
      const s = timeToMinutes(b.start_time);
      const e = timeToMinutes(b.end_time);
      return s !== -1 && e !== -1 && e > s;
    })
    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

  if (sorted.length === 0) return { blocks: [], confidence: 0, warnings: ["All provided blocks had invalid times"], rejected: true };

  sorted = sorted.filter((b) => {
    if (b.duration_minutes < 10) {
      warnings.push(`Removed "${b.title}": too short`);
      repairCount++;
      return false;
    }
    return true;
  });

  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i], next = sorted[i + 1];
    const curEnd = timeToMinutes(cur.end_time);
    const nextStart = timeToMinutes(next.start_time);
    if (curEnd > nextStart) {
      const newDur = nextStart - timeToMinutes(cur.start_time);
      if (newDur < 10) {
        warnings.push(`Removed "${cur.title}": overlap with "${next.title}"`);
        sorted.splice(i, 1); i--; repairCount++;
      } else {
        warnings.push(`Trimmed "${cur.title}" to ${minutesToTime(nextStart)}`);
        sorted[i] = { ...cur, end_time: minutesToTime(nextStart), duration_minutes: newDur };
        repairCount++;
      }
    }
  }

  const sleep = state.constraints.sleep_floor_time || state.constraints.sleep_target_time;
  let sleepMin = timeToMinutes(sleep);
  if (sleepMin !== -1) {
    if (sleepMin < 480) sleepMin += 1440;
    sorted = sorted.filter((b) => {
      let end = timeToMinutes(b.end_time);
      if (end === -1) return false;
      if (end < 480 && timeToMinutes(b.start_time) > 480) end += 1440;
      if (end > sleepMin) {
        warnings.push(`Removed "${b.title}": ends after sleep`);
        structuralIssues++;
        return false;
      }
      return true;
    });
  }

  if (repairCount >= 3) confidence -= 15;
  if (structuralIssues > 0) confidence -= 25 * structuralIssues;
  confidence = Math.max(0, confidence);
  const rejected = repairCount + structuralIssues > 5 || confidence < 10;
  if (rejected) warnings.push("Schedule rejected: too many repairs needed");
  return { blocks: sorted, confidence, warnings, rejected };
}
