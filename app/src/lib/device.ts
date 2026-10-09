// Звук, голос, утримання екрана, GPS — усе, що залежить від браузера.
import type { Severity } from '../domain/types';

let ctx: AudioContext | null = null;

interface AudioSessionLike {
  type: string;
}

/** Викликати з обробника натискання: браузер дозволяє звук лише після жесту користувача. */
export function unlockAudio(): void {
  const session = (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
  // 'playback' — звук іде навіть у беззвучному режимі iPhone (iOS 17+).
  if (session) {
    try {
      session.type = 'playback';
    } catch {
      /* не критично */
    }
  }
  ctx ??= new AudioContext();
  if (ctx.state !== 'running') void ctx.resume();
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

function tone(freq: number, start: number, dur: number, volume: number): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + start;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.setValueAtTime(volume, t0 + dur - 0.02);
  gain.gain.linearRampToValueAtTime(0, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function ensureRunning(): void {
  if (ctx && ctx.state !== 'running') void ctx.resume();
}

/** Тривожний сигнал; наполегливість залежить від серйозності. */
export function alarmSound(severity: Severity): void {
  ensureRunning();
  const repeats = severity === 'dangerous' ? 2 : 1;
  for (let r = 0; r < repeats; r++) {
    const o = r * 0.9;
    tone(880, o, 0.18, 0.6);
    tone(1100, o + 0.22, 0.18, 0.6);
    if (severity !== 'moderate') tone(1320, o + 0.44, 0.3, 0.6);
  }
}

/** Коротке подвійне пищання — проблема зовсім поруч. */
export function nearSound(): void {
  ensureRunning();
  tone(1320, 0, 0.12, 0.6);
  tone(1320, 0.16, 0.12, 0.6);
}

/** Тихе підтвердження позначки. */
export function confirmSound(): void {
  ensureRunning();
  tone(660, 0, 0.08, 0.25);
  tone(990, 0.1, 0.12, 0.25);
}

let voice: SpeechSynthesisVoice | null | undefined;

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;
  if (!voice) {
    const voices = speechSynthesis.getVoices();
    if (voices.length) voice = voices.find((v) => v.lang.toLowerCase().startsWith('uk')) ?? null;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'uk-UA';
  if (voice) u.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/** Тримає екран увімкненим, поки не викликана повернена функція. */
export function keepScreenOn(): () => void {
  let lock: WakeLockSentinel | null = null;
  let active = true;
  const acquire = async () => {
    if (!active || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
      lock = await navigator.wakeLock.request('screen');
    } catch {
      /* немає підтримки або відмовлено */
    }
  };
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return;
    void acquire();
    ensureRunning();
  };
  void acquire();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisible);
    void lock?.release();
  };
}

export function watchGps(
  onPos: (p: GeolocationPosition) => void,
  onErr: (e: GeolocationPositionError) => void,
): () => void {
  const id = navigator.geolocation.watchPosition(onPos, onErr, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 30000,
  });
  return () => navigator.geolocation.clearWatch(id);
}

export function gpsErrorText(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED) return 'Немає дозволу на геолокацію';
  if (e.code === e.POSITION_UNAVAILABLE) return 'GPS недоступний';
  return 'Чекаю на GPS…';
}
