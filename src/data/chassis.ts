// The chassis (PLAN.md 9.6): the body you drive. Each is its own movement model, as data like a
// part: tuning overrides (the numbers its movement uses) and at most one behavior. The speed tiers
// are the same marks for every body; a chassis changes how you get to Slipstream and keep it.
import type { Tuning } from './tuning';

export type ChassisId = 'scrapper' | 'skiff' | 'hauler';

export interface ChassisDef {
  id: ChassisId;
  name: string;
  /** its line, in a sentence (the Garage card) */
  line: string;
  tuning: Partial<Tuning>;
  /** what bumping an enemy does: bounce off (losing most of your speed), or shove it like a Cruise hit */
  bump: 'bounce' | 'shove';
}

export const CHASSIS: Record<ChassisId, ChassisDef> = {
  scrapper: {
    id: 'scrapper', name: 'SCRAPPER', bump: 'bounce', tuning: {},
    line: "LOOPS HOLD SPEED, HAIRPINS DON'T",
  },
  skiff: {
    id: 'skiff', name: 'SKIFF', bump: 'bounce',
    line: "NEVER SLOWS IN A TURN - CAN'T STOP - EVERY PART COSTS ITS GLIDE",
    // it holds a full-lock turn at top speed (270 x 3.4 is under its scrub line) and coasts nearly
    // a second, but builds speed slower than the Scrapper (DECISIONS #99); three hull, a soft
    // brake, thrown further by hits, and every part costs it grip and coast: three and it scrubs
    tuning: { hull: 3, topSpeed: 270, accHigh: 150, turnLow: 10, turnHigh: 3.4, scrubLat: 1300, coastHalf: 0.9, brakeDecel: 300, knockSpeed: 224, partGrip: 0.85, partCoast: 0.7 },
  },
  hauler: {
    id: 'hauler', name: 'HAULER', bump: 'shove',
    line: 'BUMP ONE WINDING UP TO STOP IT - SLOW TO SPEED',
    // slower to Slipstream with a narrower band above it (230 against 190), so a hard turn drops it out;
    // seven hull, and a bump at any speed is a shove that cancels a windup
    tuning: { hull: 7, topSpeed: 230, accHigh: 160, turnLow: 12, turnHigh: 4.4, scrubLat: 800, coastHalf: 0.25, brakeDecel: 1200 },
  },
};

export const CHASSIS_IDS = Object.keys(CHASSIS) as ChassisId[];
