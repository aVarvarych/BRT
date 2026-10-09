// Локальне сховище (IndexedDB). Поки бекенду немає — єдине джерело даних.
import type { Problem, Route, Trip } from '../domain/types';

type StoreName = 'routes' | 'trips' | 'problems';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('road-tracker', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('routes', { keyPath: 'id' });
      db.createObjectStore('trips', { keyPath: 'id' }).createIndex('routeId', 'routeId');
      db.createObjectStore('problems', { keyPath: 'id' }).createIndex('routeId', 'routeId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  return (await open()).transaction(name, mode).objectStore(name);
}

const byRoute = async <T>(name: 'trips' | 'problems', routeId: string) =>
  wrap<T[]>((await store(name)).index('routeId').getAll(routeId));

export const db = {
  async routes(): Promise<Route[]> {
    const all = await wrap<Route[]>((await store('routes')).getAll());
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  route: async (id: string) => wrap<Route | undefined>((await store('routes')).get(id)),
  saveRoute: async (r: Route) => void (await wrap((await store('routes', 'readwrite')).put(r))),

  async deleteRoute(id: string): Promise<void> {
    const d = await open();
    const tx = d.transaction(['routes', 'trips', 'problems'], 'readwrite');
    tx.objectStore('routes').delete(id);
    // Без await усередині транзакції: Safari може закрити її між мікрозадачами.
    for (const name of ['trips', 'problems'] as const) {
      const req = tx.objectStore(name).index('routeId').getAllKeys(id);
      req.onsuccess = () => req.result.forEach((k) => tx.objectStore(name).delete(k));
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  trip: async (id: string) => wrap<Trip | undefined>((await store('trips')).get(id)),
  tripsOfRoute: (routeId: string) => byRoute<Trip>('trips', routeId),
  async activeTrip(): Promise<Trip | undefined> {
    const all = await wrap<Trip[]>((await store('trips')).getAll());
    return all.find((t) => t.status === 'active');
  },
  /** structuredClone відв'язує збережену копію від живих масивів, які ще змінюються під час запису. */
  saveTrip: async (t: Trip) => void (await wrap((await store('trips', 'readwrite')).put(structuredClone(t)))),

  problem: async (id: string) => wrap<Problem | undefined>((await store('problems')).get(id)),
  problemsOfRoute: (routeId: string) => byRoute<Problem>('problems', routeId),
  saveProblem: async (p: Problem) => void (await wrap((await store('problems', 'readwrite')).put(p))),
  deleteProblem: async (id: string) => void (await wrap((await store('problems', 'readwrite')).delete(id))),

  async exportAll(): Promise<string> {
    const [routes, trips, problems] = await Promise.all([
      this.routes(),
      wrap<Trip[]>((await store('trips')).getAll()),
      wrap<Problem[]>((await store('problems')).getAll()),
    ]);
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      routes,
      trips,
      problems,
    });
  },
};
