import { PROBLEM_TYPES, SEVERITIES, type Problem } from './types';

function roundDistance(m: number): number {
  return m >= 100 ? Math.round(m / 50) * 50 : Math.round(m / 10) * 10;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** «Увага! Небезпечна яма через 300 метрів.» */
export function warnPhrase(p: Problem, distanceM: number): string {
  const type = PROBLEM_TYPES[p.type];
  const adjective = SEVERITIES[p.severity].speech[type.gender];
  const what = capitalize(adjective ? `${adjective} ${type.speech}` : type.speech);
  const m = roundDistance(distanceM);
  return m < 20 ? `Увага! ${what} попереду.` : `Увага! ${what} через ${m} метрів.`;
}
