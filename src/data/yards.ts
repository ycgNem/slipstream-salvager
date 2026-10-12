// The yards of a run (PLAN.md 8.1, 8.5): each a layout, the salvage its enemies carry (shown on
// the exit sign that leads to it), its waves at depth 2, and the one hint it teaches. The Ring is
// always first and The Heap always last; three of the four middle yards are chosen on the way.
import { CROSS, HEAP, HURDLES, KENNEL, LANES, PINBALL, PIT, RING, type ArenaDef } from './arena';
import type { PartId } from './parts';
import { BOUNCER, HOPPER, JAW_SNAPPER, PLOW_RAMMER, RAMMER, SNAPPER, SPRING_RAMMER, WAVES, type EnemySpec, type WaveDef } from './waves';

export type YardId = 'ring' | 'kennel' | 'lanes' | 'pit' | 'jaws' | 'hurdles' | 'pinball' | 'heap';

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
  heap: {
    id: 'heap', name: 'THE HEAP', arena: HEAP, salvage: ['booster', 'treads', 'plow', 'jaws', 'jets', 'springs'], extra: RAMMER,
    waves: [
      { enemies: [RAMMER, SNAPPER, HOPPER, JAW_SNAPPER] },
      { enemies: [PLOW_RAMMER, JAW_SNAPPER, JAW_SNAPPER, RAMMER] },
      { enemies: [SPRING_RAMMER, RAMMER, PLOW_RAMMER, BOUNCER, SNAPPER, JAW_SNAPPER] },
    ],
  },
};

export const MIDDLE: YardId[] = ['kennel', 'lanes', 'pit', 'jaws', 'hurdles', 'pinball'];
/** how many yards a run has */
export const RUN_LENGTH = 5;

/**
 * A yard's waves at a depth in the run: escalation is composition, never a clock (DECISIONS #22),
 * so a middle yard visited later sends one more enemy in its last wave per depth past 2.
 */
export function wavesAt(y: YardDef, depth: number): WaveDef[] {
  const extra = y.id === 'ring' || y.id === 'heap' ? 0 : Math.max(0, depth - 2);
  return y.waves.map((wv, i) => (i === y.waves.length - 1 && extra ? { ...wv, enemies: [...wv.enemies, ...Array(extra).fill(y.extra)] } : wv));
}
