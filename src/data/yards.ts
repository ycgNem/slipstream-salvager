// The yards of a run (PLAN.md 8.1, 8.5, 9.5): each a layout, the salvage its enemies carry (shown
// on the exit sign that leads to it), its waves at depth 2, and the one hint it teaches. The Ring
// is always first, then three of the nine middle yards chosen on the way, The Heap, and last The
// Compactor's yard.
import { CROSS, FOUNDRY, HEAP, HURDLES, JUMPS, KENNEL, LANES, PINBALL, PIT, PRESS, RING, SLICK, type ArenaDef } from './arena';
import type { PartId } from './parts';
import { BOUNCER, COMPACTOR, HOPPER, JAW_SNAPPER, PLOW_RAMMER, RAMMER, SNAPPER, SPRING_RAMMER, WAVES, type EnemySpec, type WaveDef } from './waves';

export type YardId = 'ring' | 'kennel' | 'lanes' | 'pit' | 'jaws' | 'hurdles' | 'pinball' | 'slick' | 'jumps' | 'press' | 'heap' | 'compactor';

export interface YardDef {
  id: YardId;
  name: string;
  arena: ArenaDef;
  /** what its enemies carry, for the exit sign */
  salvage: PartId[];
  waves: WaveDef[];
  /** the enemy a later visit adds to the last wave */
  extra: EnemySpec;
}

export const YARDS: Record<YardId, YardDef> = {
  ring: { id: 'ring', name: 'THE RING', arena: RING, salvage: ['booster'], waves: WAVES, extra: RAMMER },
  kennel: {
    id: 'kennel', name: 'THE KENNEL', arena: KENNEL, salvage: ['treads'], extra: SNAPPER,
    waves: [{ enemies: [SNAPPER, SNAPPER] }, { enemies: [SNAPPER, SNAPPER, SNAPPER] }, { enemies: [RAMMER, SNAPPER, SNAPPER, SNAPPER] }],
  },
  lanes: {
    id: 'lanes', name: 'LONG LANES', arena: LANES, salvage: ['booster'], extra: RAMMER,
    waves: [{ enemies: [RAMMER, RAMMER] }, { enemies: [RAMMER, RAMMER, SNAPPER] }, { enemies: [RAMMER, RAMMER, RAMMER, SNAPPER] }],
  },
  pit: {
    id: 'pit', name: 'THE PLOW PIT', arena: PIT, salvage: ['plow', 'booster'], extra: PLOW_RAMMER,
    waves: [{ enemies: [PLOW_RAMMER] }, { enemies: [PLOW_RAMMER, RAMMER] }, { enemies: [PLOW_RAMMER, PLOW_RAMMER, SNAPPER] }],
  },
  jaws: {
    id: 'jaws', name: 'JAW YARD', arena: CROSS, salvage: ['jaws', 'treads'], extra: JAW_SNAPPER,
    waves: [{ enemies: [JAW_SNAPPER, JAW_SNAPPER] }, { enemies: [JAW_SNAPPER, JAW_SNAPPER, RAMMER] }, { enemies: [JAW_SNAPPER, JAW_SNAPPER, JAW_SNAPPER, SNAPPER] }],
  },
  hurdles: {
    id: 'hurdles', name: 'THE HURDLES', arena: HURDLES, salvage: ['jets'], extra: HOPPER,
    waves: [{ enemies: [HOPPER, HOPPER] }, { enemies: [HOPPER, HOPPER, SNAPPER] }, { enemies: [HOPPER, HOPPER, HOPPER, RAMMER] }],
  },
  pinball: {
    id: 'pinball', name: 'THE PINBALL', arena: PINBALL, salvage: ['springs', 'booster'], extra: BOUNCER,
    waves: [{ enemies: [BOUNCER, BOUNCER] }, { enemies: [BOUNCER, BOUNCER, BOUNCER] }, { enemies: [BOUNCER, BOUNCER, SPRING_RAMMER, SNAPPER] }],
  },
  slick: {
    id: 'slick', name: 'THE SLICK', arena: SLICK, salvage: ['treads', 'booster'], extra: SNAPPER,
    waves: [{ enemies: [SNAPPER, SNAPPER] }, { enemies: [SNAPPER, SNAPPER, RAMMER] }, { enemies: [SNAPPER, SNAPPER, SNAPPER, RAMMER] }],
  },
  jumps: {
    id: 'jumps', name: 'THE JUMPS', arena: JUMPS, salvage: ['booster', 'jets'], extra: RAMMER,
    waves: [{ enemies: [RAMMER, RAMMER] }, { enemies: [RAMMER, HOPPER] }, { enemies: [RAMMER, RAMMER, HOPPER, HOPPER] }],
  },
  press: {
    id: 'press', name: 'THE PRESS', arena: PRESS, salvage: ['plow', 'booster'], extra: RAMMER,
    waves: [{ enemies: [PLOW_RAMMER, RAMMER] }, { enemies: [RAMMER, RAMMER, SNAPPER] }, { enemies: [PLOW_RAMMER, PLOW_RAMMER, SNAPPER, SNAPPER] }],
  },
  heap: {
    id: 'heap', name: 'THE HEAP', arena: HEAP, salvage: ['booster', 'treads', 'plow', 'jaws', 'jets', 'springs'], extra: RAMMER,
    waves: [
      { enemies: [RAMMER, SNAPPER, HOPPER, JAW_SNAPPER] },
      { enemies: [SPRING_RAMMER, RAMMER, PLOW_RAMMER, BOUNCER, SNAPPER, JAW_SNAPPER] },
    ],
  },
  compactor: {
    id: 'compactor', name: 'THE COMPACTOR', arena: FOUNDRY, salvage: ['booster', 'springs', 'plow'], extra: SNAPPER,
    // the safety net: it can't be wrecked while it wears a part, so every fight ends in the core-open
    // act (DECISIONS #97)
    waves: [{ enemies: [COMPACTOR], safety: true }],
  },
};

export const MIDDLE: YardId[] = ['kennel', 'lanes', 'pit', 'jaws', 'hurdles', 'pinball', 'slick', 'jumps', 'press'];
/** how many yards a run has: The Ring, three middle yards, The Heap, The Compactor */
export const RUN_LENGTH = 6;

/**
 * A yard's waves at a depth in the run: escalation is composition, never a clock (DECISIONS #22),
 * so a middle yard visited later sends one more enemy in its last wave per depth past 2.
 */
export function wavesAt(y: YardDef, depth: number): WaveDef[] {
  const extra = y.id === 'ring' || y.id === 'heap' || y.id === 'compactor' ? 0 : Math.max(0, depth - 2);
  return y.waves.map((wv, i) => (i === y.waves.length - 1 && extra ? { ...wv, enemies: [...wv.enemies, ...Array(extra).fill(y.extra)] } : wv));
}
