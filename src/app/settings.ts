// Settings and the little that persists in the slice (DECISIONS #23): volumes, screen shake, hints,
// which hints you've seen, and your best results. localStorage, always wrapped in try/catch.

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  musicOn: boolean;
  shake: boolean;
  hints: boolean;
}

export interface Best {
  clears: number;
  bestTicks: number;
  bestHull: number;
}

const KEY = 'salvager.settings';
const SEEN = 'salvager.hints';
const BEST = 'salvager.best';

export const DEFAULT_SETTINGS: Settings = { master: 0.8, music: 0.6, sfx: 0.8, musicOn: true, shake: true, hints: true };

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? { ...fallback, ...JSON.parse(s) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // private window or storage blocked: settings just don't persist
  }
}

export const loadSettings = () => read<Settings>(KEY, { ...DEFAULT_SETTINGS });
export const saveSettings = (s: Settings) => write(KEY, s);

export const loadSeenHints = () => read<Record<string, boolean>>(SEEN, {});
export const saveSeenHints = (h: Record<string, boolean>) => write(SEEN, h);

export const loadBest = () => read<Best>(BEST, { clears: 0, bestTicks: 0, bestHull: 0 });
export const saveBest = (b: Best) => write(BEST, b);
