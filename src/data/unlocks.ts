// What you unlock by playing (PLAN.md 9.6): two chassis and two run modifiers, for variety, never
// power. Pure: the counts come from the save (src/app/settings.ts), the rules from here.
import type { ChassisId } from './chassis';
import { RUN_LENGTH } from './yards';

/** Run modifiers: a run made different, not easier. */
export type ModId = 'bare' | 'rush';

export const MODS: Record<ModId, { id: ModId; name: string; line: string }> = {
  bare: { id: 'bare', name: 'BARE BONES', line: "YOUR PARTS DON'T CARRY BETWEEN YARDS" },
  rush: { id: 'rush', name: 'NO BREATHER', line: 'THE NEXT WAVE COMES IN WHILE ONE ENEMY IS LEFT' },
};
export const MOD_IDS = Object.keys(MODS) as ModId[];

/** Your lifetime counts, as the unlocks read them. */
export interface Career {
  tears: number;
  /** windups cancelled (a Cruise hit) and slipstreams caught (a close dodge of a charge or a slam) */
  cancels: number;
  drafts: number;
  /** the most yards cleared in one run */
  bestYards: number;
  wins: number;
}

type Lockable = Exclude<ChassisId, 'scrapper'> | ModId;

const UNLOCKS: Record<Lockable, { need: number; have: (c: Career) => number; what: string; count: boolean }> = {
  // each chassis is unlocked by its own verb (DECISIONS #99): the Hauler, the forgiving one, by
  // the Cruise cancel any new player finds; the Skiff, the glass cannon, by close dodges at speed
  skiff: { need: 15, have: (c) => c.drafts, what: 'CATCH 15 SLIPSTREAMS', count: true },
  hauler: { need: 15, have: (c) => c.cancels, what: 'CANCEL 15 WINDUPS', count: true },
  // The Heap is the second-last yard: clear it and you've cleared RUN_LENGTH - 1
  bare: { need: RUN_LENGTH - 1, have: (c) => c.bestYards, what: 'CLEAR THE HEAP', count: false },
  rush: { need: 1, have: (c) => c.wins, what: 'WIN A RUN', count: false },
};

export function isUnlocked(id: ChassisId | ModId, c: Career): boolean {
  if (id === 'scrapper') return true;
  const u = UNLOCKS[id];
  return u.have(c) >= u.need;
}

/** How to unlock it, with your progress where it's a count ("TEAR 20 PARTS OFF  12/20"). */
export function unlockText(id: Lockable, c: Career): string {
  const u = UNLOCKS[id];
  return u.count ? `${u.what}  ${Math.min(u.have(c), u.need)}/${u.need}` : u.what;
}

/** Today's daily run seed, from the date (YYYY-MM-DD): the same for everyone that day. */
export function dailySeed(date: string): number {
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619);
  return h >>> 0;
}
