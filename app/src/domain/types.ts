export interface LatLng {
  lat: number;
  lng: number;
}

export interface TrackPoint extends LatLng {
  /** Час фіксації, мс. */
  t: number;
  accuracyM: number;
  speedMps: number | null;
  headingDeg: number | null;
}

export type ProblemType = 'pothole' | 'broken' | 'bump' | 'roadwork' | 'other';
export type Severity = 'moderate' | 'serious' | 'dangerous';
export type ProblemStatus = 'active' | 'resolved';

export interface Route {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Сирий факт натискання кнопки «ПРОБЛЕМА». */
export interface Mark {
  id: string;
  t: number;
  rawPosition: LatLng;
  position: LatLng;
  problemId: string;
}

export interface Trip {
  id: string;
  routeId: string;
  status: 'active' | 'finished';
  startedAt: number;
  finishedAt: number | null;
  distanceM: number;
  points: TrackPoint[];
  marks: Mark[];
}

export interface Problem extends LatLng {
  id: string;
  routeId: string;
  type: ProblemType;
  severity: Severity;
  status: ProblemStatus;
  confirmations: number;
  firstReportedAt: number;
  lastConfirmedAt: number;
  resolvedAt: number | null;
  createdByTripId: string;
  updatedAt: number;
}

type Gender = 'f' | 'm';

export const PROBLEM_TYPES: Record<ProblemType, { label: string; icon: string; speech: string; gender: Gender }> = {
  pothole: { label: 'Яма', icon: '🕳️', speech: 'яма', gender: 'f' },
  broken: {
    label: 'Розбита ділянка',
    icon: '⚠️',
    speech: 'розбита ділянка',
    gender: 'f',
  },
  bump: {
    label: 'Лежачий поліцейський',
    icon: '〽️',
    speech: 'лежачий поліцейський',
    gender: 'm',
  },
  roadwork: {
    label: 'Ремонт',
    icon: '🚧',
    speech: 'ремонт дороги',
    gender: 'm',
  },
  other: { label: 'Інше', icon: '❗', speech: 'перешкода', gender: 'f' },
};

export const SEVERITIES: Record<Severity, { label: string; speech: Record<Gender, string> }> = {
  moderate: { label: 'Помірно', speech: { f: '', m: '' } },
  serious: { label: 'Серйозно', speech: { f: '', m: '' } },
  dangerous: {
    label: 'Небезпечно',
    speech: { f: 'небезпечна', m: 'небезпечний' },
  },
};

export const uuid = (): string => crypto.randomUUID();
