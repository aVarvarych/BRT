import type { LatLng, TrackPoint } from './types';

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Відстань у метрах (haversine). */
export function distance(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Азимут від a до b, 0..360. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Найменша різниця між двома кутами, 0..180. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Положення на треку в момент t (лінійна інтерполяція між сусідніми точками). */
export function positionAt(track: TrackPoint[], t: number): LatLng | null {
  if (!track.length) return null;
  if (t <= track[0].t) return track[0];
  const last = track[track.length - 1];
  if (t >= last.t) return last;
  for (let i = 1; i < track.length; i++) {
    const b = track[i];
    if (b.t < t) continue;
    const a = track[i - 1];
    const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    return {
      lat: a.lat + (b.lat - a.lat) * k,
      lng: a.lng + (b.lng - a.lng) * k,
    };
  }
  return last;
}

/** Відстань уздовж треку від початку до точки треку, найближчої за часом до t. */
export function distanceAlongTrackAt(track: TrackPoint[], t: number): number {
  let sum = 0;
  for (let i = 1; i < track.length; i++) {
    if (track[i].t > t) break;
    sum += distance(track[i - 1], track[i]);
  }
  return sum;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} м`;
  return `${(m / 1000).toFixed(m < 10000 ? 2 : 1).replace('.', ',')} км`;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}
