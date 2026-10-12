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
  /** runs (M3): started, won, the most yards cleared, the fastest win */
  runs: number;
  wins: number;
  bestYards: number;
  bestWinTicks: number;
  /** lifetime counts for the unlocks (M9) */
  tearsTotal: number;
  cancelsTotal: number;
  draftsTotal: number;
}

/** The Log (M9): what you've met and done, by enemy kind and by part. */
export interface LogBook {
  met: Record<string, number>;
  wrecked: Record<string, number>;
  torn: Record<string, number>;
  bolted: Record<string, number>;
}

/** The daily run's best for a date. */
export interface DailyBest {
  date: string;
  yards: number;
  ticks: number;
  won: boolean;
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

export const loadBest = () => read<Best>(BEST, { clears: 0, bestTicks: 0, bestHull: 0, runs: 0, wins: 0, bestYards: 0, bestWinTicks: 0, tearsTotal: 0, cancelsTotal: 0, draftsTotal: 0 });
export const saveBest = (b: Best) => write(BEST, b);

const LOG = 'salvager.log';
const DAILY = 'salvager.daily';
export const loadLog = () => read<LogBook>(LOG, { met: {}, wrecked: {}, torn: {}, bolted: {} });
export const saveLog = (l: LogBook) => write(LOG, l);
export const loadDaily = () => read<DailyBest>(DAILY, { date: '', yards: 0, ticks: 0, won: false });
export const saveDaily = (d: DailyBest) => write(DAILY, d);

/** Today in UTC as YYYY-MM-DD (the daily run's key): the same day for everyone at once. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
