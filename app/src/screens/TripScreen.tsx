import { useEffect, useRef, useState } from 'react';
import { db } from '../store/db';
import { AlertEngine, type AheadInfo, type Fix } from '../domain/alertEngine';
import { CONFIG } from '../domain/config';
import { distance, formatDistance, formatDuration } from '../domain/geo';
import { registerMark } from '../domain/marking';
import { warnPhrase } from '../domain/phrases';
import { PROBLEM_TYPES, SEVERITIES, type Problem, type Route, type TrackPoint, type Trip } from '../domain/types';
import {
  alarmSound,
  confirmSound,
  gpsErrorText,
  keepScreenOn,
  nearSound,
  speak,
  unlockAudio,
  watchGps,
} from '../lib/device';
import { navigate, toast } from '../ui';

const FIX_MAX_AGE_MS = 10_000;
const RECENT_FIXES_MS = 20_000;
const SAVE_EVERY_MS = 10_000;
const STATIONARY_RADIUS_M = 50;
const ASK_ARRIVED_AFTER_MS = 10 * 60_000;
const AUTO_FINISH_AFTER_MS = 30 * 60_000;

interface Live {
  fix: (Fix & { accuracyM: number; at: number }) | null;
  gpsError: string | null;
  nextAhead: AheadInfo | null;
  active: AheadInfo | null;
  marks: number;
  distanceM: number;
}

export function TripScreen({ tripId }: { tripId: string }) {
  const [route, setRoute] = useState<Route | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [live, setLive] = useState<Live>({
    fix: null,
    gpsError: null,
    nextAhead: null,
    active: null,
    marks: 0,
    distanceM: 0,
  });
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [askArrived, setAskArrived] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [, tick] = useState(0);

  const trip = useRef<Trip | null>(null);
  const problems = useRef<Problem[]>([]);
  const engine = useRef<AlertEngine | null>(null);
  const recent = useRef<TrackPoint[]>([]);
  const lastFix = useRef<Live['fix']>(null);
  const stationary = useRef<{
    anchor: Fix;
    since: number;
    asked: boolean;
  } | null>(null);
  const finishing = useRef(false);

  useEffect(() => {
    let stopGps: (() => void) | null = null;
    let releaseScreen: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      const t = await db.trip(tripId);
      if (!t || t.status === 'finished') return navigate(t ? `#/trip/${tripId}/review` : '#/');
      const [r, ps] = await Promise.all([db.route(t.routeId), db.problemsOfRoute(t.routeId)]);
      if (cancelled) return;
      trip.current = t;
      problems.current = ps;
      // Проблеми, позначені в цій поїздці, в ній же не попереджають.
      engine.current = new AlertEngine(ps.filter((p) => p.createdByTripId !== t.id));
      setAlertCount(engine.current.count);
      setRoute(r ?? null);
      setStartedAt(t.startedAt);
      setLive((l) => ({ ...l, marks: t.marks.length, distanceM: t.distanceM }));
      unlockAudio();
      releaseScreen = keepScreenOn();
      stopGps = watchGps(onPosition, (e) => setLive((l) => ({ ...l, gpsError: gpsErrorText(e) })));
    })();

    const saver = setInterval(save, SAVE_EVERY_MS);
    const ticker = setInterval(() => {
      tick((n) => n + 1);
      checkStationary();
    }, 1000);

    return () => {
      cancelled = true;
      stopGps?.();
      releaseScreen?.();
      clearInterval(saver);
      clearInterval(ticker);
      void save();
    };
  }, [tripId]);

  async function save() {
    if (trip.current) await db.saveTrip(trip.current);
  }

  function onPosition(pos: GeolocationPosition) {
    const t = trip.current;
    if (!t || finishing.current) return;
    const c = pos.coords;
    const now = Date.now();
    const valid = (v: number | null) => (v != null && !Number.isNaN(v) && v >= 0 ? v : null);
    const fix = {
      lat: c.latitude,
      lng: c.longitude,
      accuracyM: c.accuracy,
      speedMps: valid(c.speed),
      headingDeg: valid(c.heading),
      at: now,
    };
    lastFix.current = fix;

    const point: TrackPoint = {
      lat: fix.lat,
      lng: fix.lng,
      t: now,
      accuracyM: fix.accuracyM,
      speedMps: fix.speedMps,
      headingDeg: fix.headingDeg,
    };
    recent.current = [...recent.current.filter((p) => now - p.t < RECENT_FIXES_MS), point];

    if (fix.accuracyM <= CONFIG.maxTrackAccuracyM) {
      const prev = t.points[t.points.length - 1];
      const step = prev ? distance(prev, point) : 0;
      if (!prev || step >= CONFIG.minTrackStepM) {
        t.points.push(point);
        t.distanceM += step;
      }
    }
    trackStationary(fix, now);

    const result = engine.current?.update(fix);
    if (result) {
      for (const ev of result.events) {
        if (ev.kind === 'warn') {
          setDismissedId(null);
          alarmSound(ev.problem.severity);
          const phrase = warnPhrase(ev.problem, ev.distanceM);
          setTimeout(() => speak(phrase), 1000);
        } else if (ev.kind === 'near') {
          nearSound();
        }
      }
    }

    setLive({
      fix,
      gpsError: null,
      nextAhead: result?.nextAhead ?? null,
      active: result?.active ?? null,
      marks: t.marks.length,
      distanceM: t.distanceM,
    });
  }

  function trackStationary(fix: Fix, now: number) {
    const s = stationary.current;
    if (!s || distance(s.anchor, fix) > STATIONARY_RADIUS_M) {
      stationary.current = { anchor: fix, since: now, asked: false };
      setAskArrived(false);
    }
  }

  function checkStationary() {
    const s = stationary.current;
    if (!s || finishing.current) return;
    const still = Date.now() - s.since;
    if (still >= AUTO_FINISH_AFTER_MS) {
      void finish(true);
    } else if (still >= ASK_ARRIVED_AFTER_MS && !s.asked) {
      s.asked = true;
      setAskArrived(true);
      speak('Ви доїхали? Завершити поїздку?');
    }
  }

  async function mark() {
    const t = trip.current;
    const fix = lastFix.current;
    if (!t) return;
    unlockAudio();
    if (!fix || Date.now() - fix.at > FIX_MAX_AGE_MS) {
      toast('Немає GPS-сигналу — позначку не збережено');
      return;
    }
    const now = Date.now();
    const res = registerMark({
      t: now,
      rawPosition: fix,
      recentFixes: recent.current,
      routeProblems: problems.current,
      routeId: t.routeId,
      tripId: t.id,
    });
    t.marks.push(res.mark);
    problems.current =
      res.outcome === 'created'
        ? [...problems.current, res.problem]
        : problems.current.map((p) => (p.id === res.problem.id ? res.problem : p));
    confirmSound();
    toast(
      res.outcome === 'created'
        ? `Позначено №${t.marks.length}`
        : res.outcome === 'confirmed'
          ? 'Відома проблема — підтверджено'
          : 'Проблему знову позначено активною',
    );
    setLive((l) => ({ ...l, marks: t.marks.length }));
    await Promise.all([db.saveProblem(res.problem), save()]);
  }

  async function resolve(p: Problem) {
    const now = Date.now();
    const updated: Problem = {
      ...p,
      status: 'resolved',
      resolvedAt: now,
      updatedAt: now,
    };
    problems.current = problems.current.map((x) => (x.id === p.id ? updated : x));
    engine.current?.remove(p.id);
    setAlertCount(engine.current?.count ?? 0);
    setLive((l) => ({ ...l, active: null }));
    await db.saveProblem(updated);
    toast('Дякую! Більше не попереджатиму');
  }

  async function finish(auto = false) {
    const t = trip.current;
    if (!t || finishing.current) return;
    if (!auto && !confirm('Завершити поїздку?')) return;
    finishing.current = true;
    t.status = 'finished';
    t.finishedAt = Date.now();
    await save();
    if (auto) speak('Поїздку завершено автоматично.');
    navigate(`#/trip/${t.id}/review`);
  }

  const fix = live.fix;
  const fixAge = fix ? Date.now() - fix.at : Infinity;
  const gpsOk = fixAge < FIX_MAX_AGE_MS;
  const gpsText =
    live.gpsError ?? (!fix ? 'Пошук GPS…' : !gpsOk ? 'Сигнал GPS втрачено' : `GPS ±${Math.round(fix.accuracyM)} м`);
  const gpsClass = !gpsOk ? 'bad' : fix!.accuracyM > CONFIG.maxTrackAccuracyM ? 'warn' : 'ok';
  const speed = fix?.speedMps != null ? `${Math.round(fix.speedMps * 3.6)} км/год` : '—';
  const showAlert = live.active && live.active.problem.id !== dismissedId;

  return (
    <div className="trip">
      <header className="trip-top">
        <div className="trip-title">{route?.name ?? '…'}</div>
        <div className="trip-stats">
          <span>⏱ {startedAt ? formatDuration(Date.now() - startedAt) : '—'}</span>
          <span>{formatDistance(live.distanceM)}</span>
          <span>{speed}</span>
          <span>⚠️ {live.marks}</span>
        </div>
        <div className={`gps ${gpsClass}`}>{gpsText}</div>
      </header>

      <section className="ahead">
        {alertCount === 0 ? (
          <span className="muted">Відомих проблем на маршруті ще немає — записуємо</span>
        ) : live.nextAhead ? (
          <>
            <span className="ahead-icon">{PROBLEM_TYPES[live.nextAhead.problem.type].icon}</span>
            <span>
              <small>Наступна попереду</small>
              <b>
                {PROBLEM_TYPES[live.nextAhead.problem.type].label} · {formatDistance(live.nextAhead.distanceM)}
              </b>
            </span>
          </>
        ) : (
          <span className="muted">Попереду чисто ({alertCount} відомих на маршруті)</span>
        )}
      </section>

      <button className="mark-btn" onClick={mark} disabled={!gpsOk}>
        ⚠ ПРОБЛЕМА
        {!gpsOk && <small>чекаю на GPS</small>}
      </button>

      <button className="btn finish" onClick={() => finish()}>
        ■ Завершити поїздку
      </button>

      {showAlert && live.active && (
        <div
          className={`alert-overlay sev-${live.active.problem.severity}`}
          onClick={() => setDismissedId(live.active!.problem.id)}
        >
          <div className="alert-icon">{PROBLEM_TYPES[live.active.problem.type].icon}</div>
          <div className="alert-type">{PROBLEM_TYPES[live.active.problem.type].label}</div>
          <div className="alert-sev">{SEVERITIES[live.active.problem.severity].label}</div>
          <div className="alert-dist">{formatDistance(live.active.distanceM)}</div>
          <div className="alert-actions">
            <button
              className="btn"
              onClick={(e) => {
                e.stopPropagation();
                void resolve(live.active!.problem);
              }}
            >
              ✓ Вже нема
            </button>
            <button className="btn" onClick={() => setDismissedId(live.active!.problem.id)}>
              Сховати
            </button>
          </div>
        </div>
      )}

      {askArrived && (
        <div className="arrived">
          <b>Ви доїхали?</b>
          <span>Машина стоїть понад 10 хв. Без відповіді поїздка завершиться через 20 хв.</span>
          <div className="row">
            <button className="btn primary" onClick={() => finish(true)}>
              Завершити
            </button>
            <button
              className="btn"
              onClick={() => {
                setAskArrived(false);
                if (stationary.current)
                  stationary.current = {
                    ...stationary.current,
                    since: Date.now(),
                    asked: false,
                  };
              }}
            >
              Ще їду
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
