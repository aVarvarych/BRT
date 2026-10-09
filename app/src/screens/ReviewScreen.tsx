import { useEffect, useState } from 'react';
import { db } from '../store/db';
import { distanceAlongTrackAt, formatDistance, formatDuration } from '../domain/geo';
import { PROBLEM_TYPES, type Mark, type Problem, type Trip } from '../domain/types';
import { formatTime, navigate, ProblemEditor, toast, TopBar } from '../ui';

/** Перегляд міток після поїздки: уточнити тип і серйозність, прибрати хибні. */
export function ReviewScreen({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [problems, setProblems] = useState<Map<string, Problem>>(new Map());

  useEffect(() => {
    void (async () => {
      const t = await db.trip(tripId);
      if (!t) return navigate('#/');
      setTrip(t);
      const list = await Promise.all(t.marks.map((m) => db.problem(m.problemId)));
      setProblems(new Map(list.filter((p): p is Problem => !!p).map((p) => [p.id, p])));
    })();
  }, [tripId]);

  if (!trip) return null;

  async function saveProblem(p: Problem) {
    await db.saveProblem(p);
    setProblems((m) => new Map(m).set(p.id, p));
  }

  async function removeMark(mark: Mark) {
    if (!confirm('Прибрати цю позначку?')) return;
    const p = problems.get(mark.problemId);
    if (p) {
      if (p.confirmations <= 1) {
        await db.deleteProblem(p.id);
        setProblems((m) => {
          const next = new Map(m);
          next.delete(p.id);
          return next;
        });
      } else {
        await saveProblem({
          ...p,
          confirmations: p.confirmations - 1,
          updatedAt: Date.now(),
        });
      }
    }
    const t = { ...trip!, marks: trip!.marks.filter((m) => m.id !== mark.id) };
    await db.saveTrip(t);
    setTrip(t);
    toast('Позначку прибрано');
  }

  const marks = [...trip.marks].sort((a, b) => a.t - b.t);
  const duration = (trip.finishedAt ?? Date.now()) - trip.startedAt;

  return (
    <>
      <TopBar title="Перегляд поїздки" back={`#/route/${trip.routeId}`} />
      <main className="page">
        <div className="stats">
          <div>
            <b>{formatDistance(trip.distanceM)}</b>
            <span>проїхано</span>
          </div>
          <div>
            <b>{formatDuration(duration)}</b>
            <span>у дорозі</span>
          </div>
          <div>
            <b>{marks.length}</b>
            <span>позначок</span>
          </div>
        </div>

        {!marks.length && <p className="empty">У цій поїздці позначок не було.</p>}
        <ul className="problems">
          {marks.map((m) => {
            const p = problems.get(m.problemId);
            const isNew = p?.id === m.id;
            return (
              <li key={m.id} className="problem">
                <div className="problem-head">
                  <span className="p-icon">{p ? PROBLEM_TYPES[p.type].icon : '•'}</span>
                  <span className="p-text">
                    <b>{p ? PROBLEM_TYPES[p.type].label : 'Проблему видалено'}</b>
                    <small>
                      {formatDistance(distanceAlongTrackAt(trip.points, m.t))} від старту · {formatTime(m.t)}
                      {p && !isNew && ' · повторна позначка'}
                    </small>
                  </span>
                </div>
                <div className="problem-body">
                  {p && <ProblemEditor problem={p} onChange={saveProblem} />}
                  <button className="btn small danger" onClick={() => removeMark(m)}>
                    Прибрати позначку
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button className="btn primary big" onClick={() => navigate(`#/route/${trip.routeId}`)}>
          Готово
        </button>
      </main>
    </>
  );
}
