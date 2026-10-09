import { describe, expect, it } from 'vitest';
import { AlertEngine, type Fix } from './alertEngine';
import { distance } from './geo';
import { registerMark } from './marking';
import { warnPhrase } from './phrases';
import type { Problem, TrackPoint } from './types';

// ~111 м на 0.001° широти; їдемо строго на північ уздовж меридіана.
const LNG = 30.5;
const at = (northM: number) => ({ lat: 50 + northM / 111_195, lng: LNG });

function problem(northM: number, extra: Partial<Problem> = {}): Problem {
  return {
    id: `p${northM}`,
    routeId: 'r',
    ...at(northM),
    type: 'pothole',
    severity: 'serious',
    status: 'active',
    confirmations: 1,
    firstReportedAt: 0,
    lastConfirmedAt: 0,
    resolvedAt: null,
    createdByTripId: 'old',
    updatedAt: 0,
    ...extra,
  };
}

/** Проїзд від fromM до toM кроком stepM зі швидкістю speed м/с; повертає всі події. */
function drive(engine: AlertEngine, fromM: number, toM: number, speed = 25, stepM = 25) {
  const dir = toM > fromM ? 1 : -1;
  const heading = dir > 0 ? 0 : 180;
  const events = [];
  for (let m = fromM; dir > 0 ? m <= toM : m >= toM; m += dir * stepM) {
    const fix: Fix = { ...at(m), speedMps: speed, headingDeg: heading };
    events.push(...engine.update(fix).events.map((e) => ({ ...e, atM: m })));
  }
  return events;
}

describe('AlertEngine', () => {
  it('попереджає один раз за ~12 с до ями, потім «близько», потім знімає', () => {
    const engine = new AlertEngine([problem(1000)]);
    const events = drive(engine, 0, 1500);
    expect(events.map((e) => e.kind)).toEqual(['warn', 'near', 'clear']);
    const warn = events[0];
    // 25 м/с × 12 с = 300 м
    expect(1000 - warn.atM).toBeLessThanOrEqual(300);
    expect(1000 - warn.atM).toBeGreaterThan(250);
  });

  it('попереджає і в зворотному напрямку', () => {
    const engine = new AlertEngine([problem(1000)]);
    const events = drive(engine, 2000, 0);
    expect(events.map((e) => e.kind)).toEqual(['warn', 'near', 'clear']);
  });

  it('не попереджає про яму позаду', () => {
    const engine = new AlertEngine([problem(1000)]);
    // стартуємо одразу за ямою і їдемо далі
    expect(drive(engine, 1100, 2500)).toEqual([]);
  });

  it('на малій швидкості попереджає не ближче мінімальної дистанції', () => {
    const engine = new AlertEngine([problem(1000)]);
    const [warn] = drive(engine, 0, 1200, 5, 10);
    expect(warn.kind).toBe('warn');
    expect(1000 - warn.atM).toBeGreaterThanOrEqual(140);
    expect(1000 - warn.atM).toBeLessThanOrEqual(150);
  });

  it('ігнорує усунені проблеми і ті, що прибрали під час поїздки', () => {
    const engine = new AlertEngine([problem(500, { status: 'resolved' }), problem(1000)]);
    engine.remove('p1000');
    expect(drive(engine, 0, 1500)).toEqual([]);
  });

  it('попереджає після розвороту невдовзі за ямою', () => {
    const engine = new AlertEngine([problem(1000)]);
    drive(engine, 0, 1450); // проїхали яму на 450 м і розвернулись
    const back = drive(engine, 1450, 0);
    expect(back.map((e) => e.kind)).toEqual(['warn', 'near', 'clear']);
  });

  it("не повторює попередження, поки від'їжджаємо від ями", () => {
    const engine = new AlertEngine([problem(1000)]);
    const events = drive(engine, 0, 3000);
    expect(events.filter((e) => e.kind === 'warn')).toHaveLength(1);
  });

  it('попереджає знову при повторному проїзді', () => {
    const engine = new AlertEngine([problem(1000)]);
    drive(engine, 0, 2000);
    const back = drive(engine, 2000, 0);
    expect(back.filter((e) => e.kind === 'warn')).toHaveLength(1);
  });
});

describe('registerMark', () => {
  const track: TrackPoint[] = [0, 1, 2, 3].map((s) => ({
    ...at(s * 25),
    t: 10_000 + s * 1000,
    accuracyM: 5,
    speedMps: 25,
    headingDeg: 0,
  }));

  it('відкочує позицію на 1,5 с назад і створює нову проблему', () => {
    const res = registerMark({
      t: 13_000,
      rawPosition: at(75),
      recentFixes: track,
      routeProblems: [],
      routeId: 'r',
      tripId: 't',
    });
    expect(res.outcome).toBe('created');
    expect(res.problem.id).toBe(res.mark.id);
    // 1,5 с × 25 м/с = 37,5 м назад від 75 м
    expect(distance(res.problem, at(37.5))).toBeLessThan(1);
  });

  it('позначка біля відомої проблеми — підтвердження', () => {
    const existing = problem(40);
    const res = registerMark({
      t: 13_000,
      rawPosition: at(75),
      recentFixes: track,
      routeProblems: [existing],
      routeId: 'r',
      tripId: 't',
    });
    expect(res.outcome).toBe('confirmed');
    expect(res.problem.id).toBe(existing.id);
    expect(res.problem.confirmations).toBe(2);
  });

  it('позначка біля усуненої проблеми повертає її', () => {
    const existing = problem(40, { status: 'resolved', resolvedAt: 1 });
    const res = registerMark({
      t: 13_000,
      rawPosition: at(75),
      recentFixes: track,
      routeProblems: [existing],
      routeId: 'r',
      tripId: 't',
    });
    expect(res.outcome).toBe('reactivated');
    expect(res.problem.status).toBe('active');
    expect(res.problem.resolvedAt).toBeNull();
  });
});

describe('warnPhrase', () => {
  it('округлює відстань і узгоджує рід', () => {
    expect(warnPhrase(problem(0), 287)).toBe('Увага! Яма через 300 метрів.');
    expect(warnPhrase(problem(0, { severity: 'dangerous' }), 160)).toBe('Увага! Небезпечна яма через 150 метрів.');
    expect(warnPhrase(problem(0, { type: 'bump', severity: 'dangerous' }), 44)).toBe(
      'Увага! Небезпечний лежачий поліцейський через 40 метрів.',
    );
  });
});
