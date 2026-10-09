import { CONFIG } from './config';
import { angleDiff, bearing, distance } from './geo';
import type { LatLng, Problem } from './types';

export interface Fix extends LatLng {
  speedMps: number | null;
  headingDeg: number | null;
}

export type AlertEvent =
  | { kind: 'warn'; problem: Problem; distanceM: number }
  | { kind: 'near'; problem: Problem; distanceM: number }
  | { kind: 'clear'; problem: Problem };

type Stage = 'idle' | 'warned' | 'near' | 'passed';

export interface AheadInfo {
  problem: Problem;
  distanceM: number;
}

/**
 * Відстежує наближення до відомих проблем. Не залежить від браузера:
 * на вхід — позиція, на вихід — події, на які реагує UI (звук, голос, плашка).
 */
export class AlertEngine {
  private problems: Problem[];
  private stages = new Map<string, Stage>();
  private heading: number | null = null;
  private anchor: LatLng | null = null;

  constructor(problems: Problem[]) {
    this.problems = problems.filter((p) => p.status === 'active');
  }

  remove(problemId: string): void {
    this.problems = this.problems.filter((p) => p.id !== problemId);
    this.stages.delete(problemId);
  }

  get count(): number {
    return this.problems.length;
  }

  update(fix: Fix): {
    events: AlertEvent[];
    nextAhead: AheadInfo | null;
    active: AheadInfo | null;
  } {
    const heading = this.updateHeading(fix);
    const speed = fix.speedMps;
    const warnDistance =
      speed != null && speed > 0
        ? clamp(speed * CONFIG.alertLeadTimeSec, CONFIG.alertMinDistanceM, CONFIG.alertMaxDistanceM)
        : CONFIG.alertMinDistanceM * 2;

    const events: AlertEvent[] = [];
    let nextAhead: AheadInfo | null = null;
    let active: AheadInfo | null = null;

    for (const p of this.problems) {
      const d = distance(fix, p);
      const ahead = heading == null || angleDiff(heading, bearing(fix, p)) <= CONFIG.aheadMaxAngleDeg;
      const stage = this.stages.get(p.id) ?? 'idle';

      if (ahead && (!nextAhead || d < nextAhead.distanceM)) nextAhead = { problem: p, distanceM: d };

      switch (stage) {
        case 'idle':
          if (ahead && d <= warnDistance) {
            this.stages.set(p.id, d <= CONFIG.alertNearDistanceM ? 'near' : 'warned');
            events.push({ kind: 'warn', problem: p, distanceM: d });
          }
          break;
        case 'warned':
        case 'near':
          if (this.isPassed(d, ahead, warnDistance)) {
            this.stages.set(p.id, 'passed');
            events.push({ kind: 'clear', problem: p });
          } else if (stage === 'warned' && d <= CONFIG.alertNearDistanceM) {
            this.stages.set(p.id, 'near');
            events.push({ kind: 'near', problem: p, distanceM: d });
          }
          break;
        case 'passed':
          // Виїхали із зони попередження — при наступному наближенні (розворот, повторний проїзд) попередимо знову.
          // Поки від'їжджаємо, проблема позаду, тож повторного спрацювання не буде.
          if (d > warnDistance + 100) this.stages.delete(p.id);
          break;
      }

      const s = this.stages.get(p.id);
      if ((s === 'warned' || s === 'near') && (!active || d < active.distanceM)) active = { problem: p, distanceM: d };
    }

    return { events, nextAhead, active };
  }

  private isPassed(d: number, ahead: boolean, warnDistance: number): boolean {
    if (d > warnDistance + 200) return true; // поїхали іншою дорогою
    return !ahead && d > 25;
  }

  /** Курс з GPS, якщо швидкість достатня; інакше — за зсувом від останньої опорної точки. */
  private updateHeading(fix: Fix): number | null {
    const fast = fix.speedMps != null && fix.speedMps >= CONFIG.minSpeedForHeadingMps;
    if (fast && fix.headingDeg != null) {
      this.heading = fix.headingDeg;
      this.anchor = fix;
    } else if (!this.anchor) {
      this.anchor = fix;
    } else if (distance(this.anchor, fix) > 15) {
      this.heading = bearing(this.anchor, fix);
      this.anchor = fix;
    }
    return this.heading;
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
