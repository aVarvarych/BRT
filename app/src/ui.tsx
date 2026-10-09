import { useEffect, useState } from 'react';
import { PROBLEM_TYPES, SEVERITIES, type Problem, type ProblemType, type Severity } from './domain/types';

export const navigate = (hash: string) => {
  location.hash = hash;
};

export function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export function toast(text: string): void {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: text }));
}

export function Toast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer = 0;
    const on = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = window.setTimeout(() => setText(null), 2500);
    };
    window.addEventListener('app-toast', on);
    return () => window.removeEventListener('app-toast', on);
  }, []);
  return <div className={`toast ${text ? 'show' : ''}`}>{text}</div>;
}

export function TopBar({ title, back }: { title: string; back?: string }) {
  return (
    <header className="topbar">
      {back && (
        <a className="back" href={back} aria-label="Назад">
          ‹
        </a>
      )}
      <h1>{title}</h1>
    </header>
  );
}

export const formatDateTime = (t: number) =>
  new Date(t).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatTime = (t: number) =>
  new Date(t).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });

/** Вибір типу та серйозності проблеми. */
export function ProblemEditor({ problem, onChange }: { problem: Problem; onChange: (p: Problem) => void }) {
  const set = (patch: Partial<Problem>) => onChange({ ...problem, ...patch, updatedAt: Date.now() });
  return (
    <div className="editor">
      <select value={problem.type} onChange={(e) => set({ type: e.target.value as ProblemType })} aria-label="Тип">
        {Object.entries(PROBLEM_TYPES).map(([k, v]) => (
          <option key={k} value={k}>
            {v.icon} {v.label}
          </option>
        ))}
      </select>
      <div className="segmented" role="radiogroup" aria-label="Серйозність">
        {(Object.keys(SEVERITIES) as Severity[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`sev-${s} ${problem.severity === s ? 'on' : ''}`}
            onClick={() => set({ severity: s })}
          >
            {SEVERITIES[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}
