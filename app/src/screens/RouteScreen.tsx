import { useEffect, useState } from 'react';
import { db } from '../store/db';
import { formatDistance } from '../domain/geo';
import { PROBLEM_TYPES, SEVERITIES, uuid, type Problem, type Route, type Trip } from '../domain/types';
import { unlockAudio } from '../lib/device';
import { formatDateTime, navigate, ProblemEditor, toast, TopBar } from '../ui';

export function RouteScreen({ routeId }: { routeId: string }) {
  const [route, setRoute] = useState<Route | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  async function load() {
    const r = await db.route(routeId);
    if (!r) return navigate('#/');
    setRoute(r);
    setProblems((await db.problemsOfRoute(routeId)).sort((a, b) => a.firstReportedAt - b.firstReportedAt));
    setTrips((await db.tripsOfRoute(routeId)).sort((a, b) => b.startedAt - a.startedAt));
  }

  useEffect(() => {
    void load();
  }, [routeId]);

  if (!route) return null;
  const active = problems.filter((p) => p.status === 'active');
  const resolved = problems.filter((p) => p.status === 'resolved');

  async function start() {
    unlockAudio();
    // Одна активна поїздка на пристрій: попередню завершуємо.
    const running = await db.activeTrip();
    if (running)
      await db.saveTrip({
        ...running,
        status: 'finished',
        finishedAt: Date.now(),
      });
    const trip: Trip = {
      id: uuid(),
      routeId,
      status: 'active',
      startedAt: Date.now(),
      finishedAt: null,
      distanceM: 0,
      points: [],
      marks: [],
    };
    await db.saveTrip(trip);
    await db.saveRoute({ ...route!, updatedAt: Date.now() });
    navigate(`#/trip/${trip.id}`);
  }

  async function saveProblem(p: Problem) {
    await db.saveProblem(p);
    setProblems((list) => list.map((x) => (x.id === p.id ? p : x)));
  }

  async function setStatus(p: Problem, status: Problem['status']) {
    const now = Date.now();
    await saveProblem({
      ...p,
      status,
      resolvedAt: status === 'resolved' ? now : null,
      updatedAt: now,
    });
    toast(status === 'resolved' ? 'Позначено як усунену' : 'Відновлено');
  }

  async function remove(p: Problem) {
    if (!confirm('Видалити цю проблему назавжди?')) return;
    await db.deleteProblem(p.id);
    setProblems((list) => list.filter((x) => x.id !== p.id));
  }

  async function rename() {
    const name = prompt('Назва маршруту', route!.name)?.trim();
    if (!name) return;
    const r = { ...route!, name: name.slice(0, 100), updatedAt: Date.now() };
    await db.saveRoute(r);
    setRoute(r);
  }

  async function removeRoute() {
    if (!confirm(`Видалити маршрут «${route!.name}» разом з усіма поїздками й позначками?`)) return;
    await db.deleteRoute(routeId);
    navigate('#/');
  }

  const row = (p: Problem) => (
    <li key={p.id} className={`problem ${p.status}`}>
      <button className="problem-head" onClick={() => setEditing(editing === p.id ? null : p.id)}>
        <span className="p-icon">{PROBLEM_TYPES[p.type].icon}</span>
        <span className="p-text">
          <b>
            {PROBLEM_TYPES[p.type].label} ·{' '}
            <span className={`sev-text-${p.severity}`}>{SEVERITIES[p.severity].label}</span>
          </b>
          <small>
            {formatDateTime(p.firstReportedAt)} · підтверджень: {p.confirmations}
          </small>
        </span>
      </button>
      {editing === p.id && (
        <div className="problem-body">
          {p.status === 'active' && <ProblemEditor problem={p} onChange={saveProblem} />}
          <div className="row">
            {p.status === 'active' ? (
              <button className="btn small" onClick={() => setStatus(p, 'resolved')}>
                ✓ Вже нема
              </button>
            ) : (
              <button className="btn small" onClick={() => setStatus(p, 'active')}>
                ↺ Відновити
              </button>
            )}
            <button className="btn small danger" onClick={() => remove(p)}>
              Видалити
            </button>
          </div>
        </div>
      )}
    </li>
  );

  return (
    <>
      <TopBar title={route.name} back="#/" />
      <main className="page">
        <div className="stats">
          <div>
            <b>{active.length}</b>
            <span>активних проблем</span>
          </div>
          <div>
            <b>{trips.length}</b>
            <span>поїздок</span>
          </div>
        </div>

        <button className="btn primary big" onClick={start}>
          ▶ Старт поїздки
        </button>
        <p className="hint">
          {active.length
            ? `Під час поїздки попереджатиму про ${active.length} відомих проблем — в обидва боки.`
            : 'Перша поїздка: тисніть «ПРОБЛЕМА», коли проїжджаєте яму.'}
        </p>

        <h2>Проблеми</h2>
        {active.length ? (
          <ul className="problems">{active.map(row)}</ul>
        ) : (
          <p className="empty">Активних проблем немає.</p>
        )}

        {resolved.length > 0 && (
          <details>
            <summary>Усунені ({resolved.length})</summary>
            <ul className="problems">{resolved.map(row)}</ul>
          </details>
        )}

        {trips.length > 0 && (
          <>
            <h2>Поїздки</h2>
            <ul className="trips">
              {trips.map((t) => (
                <li key={t.id}>
                  <button onClick={() => navigate(t.status === 'active' ? `#/trip/${t.id}` : `#/trip/${t.id}/review`)}>
                    <span>{formatDateTime(t.startedAt)}</span>
                    <span>{formatDistance(t.distanceM)}</span>
                    <span>⚠️ {t.marks.length}</span>
                    {t.status === 'active' && <span className="badge">йде</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="row bottom-actions">
          <button className="btn ghost small" onClick={rename}>
            Перейменувати
          </button>
          <button className="btn ghost small danger" onClick={removeRoute}>
            Видалити маршрут
          </button>
        </div>
      </main>
    </>
  );
}
