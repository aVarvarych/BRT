import { useEffect, useState, type FormEvent } from 'react';
import { db } from '../store/db';
import { uuid, type Route, type Trip } from '../domain/types';
import { formatDateTime, navigate, TopBar } from '../ui';

interface RouteRow {
  route: Route;
  active: number;
  trips: number;
}

export function HomeScreen() {
  const [rows, setRows] = useState<RouteRow[] | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    void (async () => {
      const routes = await db.routes();
      setRows(
        await Promise.all(
          routes.map(async (route) => {
            const [problems, trips] = await Promise.all([db.problemsOfRoute(route.id), db.tripsOfRoute(route.id)]);
            return {
              route,
              active: problems.filter((p) => p.status === 'active').length,
              trips: trips.length,
            };
          }),
        ),
      );
      setActiveTrip((await db.activeTrip()) ?? null);
    })();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = Date.now();
    const route: Route = {
      id: uuid(),
      name: trimmed,
      createdAt: now,
      updatedAt: now,
    };
    await db.saveRoute(route);
    navigate(`#/route/${route.id}`);
  }

  async function exportData() {
    const blob = new Blob([await db.exportAll()], { type: 'application/json' });
    const file = new File([blob], `road-tracker-${new Date().toISOString().slice(0, 10)}.json`, {
      type: 'application/json',
    });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] }).catch(() => {});
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <TopBar title="🛣️ Погані дороги" />
      <main className="page">
        {activeTrip && (
          <button className="btn warn big" onClick={() => navigate(`#/trip/${activeTrip.id}`)}>
            ▶ Повернутись до поїздки
          </button>
        )}

        <form className="card" onSubmit={create}>
          <label htmlFor="route-name" className="label">
            Новий маршрут
          </label>
          <div className="row">
            <input
              id="route-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр. Київ — Іллінці"
              maxLength={100}
              autoComplete="off"
            />
            <button className="btn primary" type="submit" disabled={!name.trim()}>
              Створити
            </button>
          </div>
        </form>

        {rows && !rows.length && (
          <p className="empty">Маршрутів ще немає. Створіть перший, натисніть «Старт» і відмічайте ями дорогою.</p>
        )}
        {rows?.map(({ route, active, trips }) => (
          <button key={route.id} className="card route-card" onClick={() => navigate(`#/route/${route.id}`)}>
            <span className="route-title">{route.name}</span>
            <span className="meta">
              <span>⚠️ {active}</span>
              <span>🚗 {trips}</span>
              <span>{formatDateTime(route.updatedAt)}</span>
            </span>
          </button>
        ))}

        <button className="btn ghost small" onClick={exportData}>
          Експорт даних (резервна копія)
        </button>
      </main>
    </>
  );
}
