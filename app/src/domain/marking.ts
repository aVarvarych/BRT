import { CONFIG } from './config';
import { distance, positionAt } from './geo';
import { uuid, type LatLng, type Mark, type Problem, type TrackPoint } from './types';

export interface MarkResult {
  mark: Mark;
  problem: Problem;
  outcome: 'created' | 'confirmed' | 'reactivated';
}

/**
 * Реєструє натискання «ПРОБЛЕМА»: відкочує позицію на час реакції водія,
 * шукає наявну проблему поруч (підтвердження) або створює нову.
 */
export function registerMark(params: {
  t: number;
  rawPosition: LatLng;
  recentFixes: TrackPoint[];
  routeProblems: Problem[];
  routeId: string;
  tripId: string;
}): MarkResult {
  const { t, rawPosition, recentFixes, routeProblems, routeId, tripId } = params;
  const position = positionAt(recentFixes, t - CONFIG.reactionDelaySec * 1000) ?? rawPosition;

  let nearest: Problem | null = null;
  let nearestD = Infinity;
  for (const p of routeProblems) {
    const d = distance(p, position);
    if (d <= CONFIG.matchRadiusM && d < nearestD) {
      nearest = p;
      nearestD = d;
    }
  }

  const markId = uuid();
  if (nearest) {
    const reactivated = nearest.status === 'resolved';
    const problem: Problem = {
      ...nearest,
      status: 'active',
      resolvedAt: null,
      confirmations: nearest.confirmations + 1,
      lastConfirmedAt: t,
      updatedAt: t,
    };
    return {
      mark: { id: markId, t, rawPosition, position, problemId: problem.id },
      problem,
      outcome: reactivated ? 'reactivated' : 'confirmed',
    };
  }

  const problem: Problem = {
    id: markId,
    routeId,
    lat: position.lat,
    lng: position.lng,
    type: 'pothole',
    severity: 'serious',
    status: 'active',
    confirmations: 1,
    firstReportedAt: t,
    lastConfirmedAt: t,
    resolvedAt: null,
    createdByTripId: tripId,
    updatedAt: t,
  };
  return {
    mark: { id: markId, t, rawPosition, position, problemId: problem.id },
    problem,
    outcome: 'created',
  };
}
