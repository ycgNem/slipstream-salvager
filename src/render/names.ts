// Every sprite name the game can ask for (STYLE.md "Sprite names"). The coverage script and the
// art overhaul work from this list; a test checks every name has art.
import { DIRS } from '../data/dirs';

export const TIERS = ['crawl', 'cruise', 'slip'] as const;
/** every part, in HUD slot order (rear, sides, front) */
export const PART_NAMES = ['booster', 'treads', 'plow', 'jaws', 'jets', 'springs'] as const;

export function allSpriteNames(): string[] {
  const out: string[] = [];
  const R = (n: number) => [...Array(n).keys()];
  for (const i of R(4)) out.push(`t:floor:${i}`);
  for (const m of R(16)) out.push(`t:wall:${m}`);
  out.push('ob:pillar', 'ob:post', 'ob:tower');
  for (const d of ['e', 's', 'w', 'n']) {
    for (const f of R(3)) out.push(`fl:boost:${d}:${f}`);
    out.push(`fl:ramp:${d}`);
  }
  for (const m of R(16)) out.push(`fl:oil:${m}`);
  for (const s of ['idle', 'warn', 'down']) out.push(`fl:crusher:${s}`);
  for (const o of ['h', 'v']) for (const s of ['closed', 'open', 'warn']) out.push(`ob:gate:${o}:${s}`);
  for (const d of DIRS) {
    for (const c of ['scrapper', 'skiff', 'hauler']) {
      for (const f of R(2)) out.push(`pl:${c}:drive:${d}:${f}`, `pl:${c}:rip:${d}:${f}`);
      out.push(`pl:${c}:hurt:${d}`);
    }
    for (const f of R(2)) out.push(`en:rammer:stalk:${d}:${f}`, `en:rammer:windup:${d}:${f}`, `en:rammer:charge:${d}:${f}`, `en:rammer:stunned:${d}:${f}`);
    out.push(`en:rammer:skid:${d}`);
    for (const f of R(2)) out.push(`en:snapper:hunt:${d}:${f}`, `en:snapper:windup:${d}:${f}`, `en:snapper:snap:${d}:${f}`, `en:snapper:stunned:${d}:${f}`);
    out.push(`en:snapper:slide:${d}`);
    for (const f of R(2)) out.push(`en:hopper:stalk:${d}:${f}`, `en:hopper:crouch:${d}:${f}`);
    out.push(`en:hopper:air:${d}`, `en:hopper:land:${d}`);
    for (const f of R(2)) out.push(`en:bouncer:idle:${d}:${f}`, `en:bouncer:windup:${d}:${f}`, `en:bouncer:roll:${d}:${f}`, `en:bouncer:stunned:${d}:${f}`);
    for (const f of R(2)) for (const s of ['stalk', 'windup', 'charge', 'stunned', 'crouch']) out.push(`bo:compactor:${s}:${d}:${f}`);
    for (const s of ['skid', 'air', 'land']) out.push(`bo:compactor:${s}:${d}`);
    for (const part of ['booster', 'plow', 'springs']) out.push(`bo:part:${part}:${d}`);
    for (const f of R(2)) out.push(`bo:plume:${d}:${f}`);
    for (const part of PART_NAMES) out.push(`part:${part}:${d}`);
    out.push(`part:bigsprings:${d}`, `part:bigtreads:${d}`);
    for (const f of R(2)) out.push(`fx:plume:${d}:${f}`);
    for (const t of TIERS) for (const f of R(3)) out.push(`fx:slash:${t}:${d}:${f}`);
  }
  for (const part of PART_NAMES) out.push(`pickup:${part}`, `icon:part:${part}`);
  for (const f of R(3)) out.push(`fx:spark:${f}`);
  for (const k of ['dust', 'steam', 'smoke', 'stars']) for (const f of R(4)) out.push(`fx:${k}:${f}`);
  for (const s of ['s', 'm', 'l', 'xl']) out.push(`fx:shadow:${s}`);
  out.push('ui:hull:full', 'ui:hull:empty');
  return out;
}

/** Frame size and anchor per name (STYLE.md "Grid and sizes"); the art generators must match. */
export function spriteSpec(name: string): { w: number; h: number; ox: number; oy: number } {
  const p = name.split(':');
  const key = p[0] + ':' + p[1];
  switch (key) {
    case 't:floor': case 't:wall': case 'fl:boost': case 'fl:oil': return { w: 16, h: 16, ox: 0, oy: 0 };
    case 'fl:ramp': case 'fl:crusher': return { w: 32, h: 32, ox: 0, oy: 0 };
    case 'ob:pillar': return { w: 32, h: 40, ox: 0, oy: 8 };
    case 'ob:post': return { w: 16, h: 24, ox: 0, oy: 8 };
    case 'ob:tower': return { w: 48, h: 56, ox: 0, oy: 8 };
    case 'en:snapper': case 'en:bouncer': return { w: 32, h: 32, ox: 16, oy: 20 };
    case 'en:hopper': return { w: 40, h: 40, ox: 20, oy: 26 };
    case 'ob:gate': return p[2] === 'h' ? { w: 32, h: 16, ox: 0, oy: 0 } : { w: 16, h: 32, ox: 0, oy: 0 };
    case 'pl:scrapper': case 'pl:skiff': case 'pl:hauler': return { w: 32, h: 32, ox: 16, oy: 20 };
    case 'en:rammer': return { w: 40, h: 40, ox: 20, oy: 26 };
    case 'bo:compactor': return { w: 64, h: 64, ox: 32, oy: 44 };
    case 'bo:part': return p[2] === 'springs' ? { w: 64, h: 64, ox: 32, oy: 44 } : { w: 32, h: 32, ox: 16, oy: 16 };
    case 'bo:plume': return { w: 32, h: 32, ox: 16, oy: 16 };
    case 'part:booster': case 'part:plow': case 'part:jaws': case 'part:jets': return { w: 16, h: 16, ox: 8, oy: 8 };
    case 'part:treads': case 'part:springs': return { w: 32, h: 32, ox: 16, oy: 20 };
    case 'part:bigsprings': case 'part:bigtreads': return { w: 40, h: 40, ox: 20, oy: 26 };
    case 'pickup:booster': case 'pickup:treads': case 'pickup:plow': case 'pickup:jaws': case 'pickup:jets': case 'pickup:springs': return { w: 16, h: 16, ox: 8, oy: 12 };
    case 'icon:part': return { w: 16, h: 16, ox: 0, oy: 0 };
    case 'fx:plume': return { w: 16, h: 16, ox: 8, oy: 8 };
    case 'fx:slash': return { w: 32, h: 32, ox: 16, oy: 16 };
    case 'fx:spark': case 'fx:dust': case 'fx:steam': case 'fx:smoke': return { w: 8, h: 8, ox: 4, oy: 4 };
    case 'fx:stars': return { w: 16, h: 8, ox: 8, oy: 8 };
    case 'fx:shadow': return p[2] === 's' ? { w: 16, h: 6, ox: 8, oy: 3 } : p[2] === 'm' ? { w: 24, h: 8, ox: 12, oy: 4 } : p[2] === 'l' ? { w: 32, h: 10, ox: 16, oy: 5 } : { w: 56, h: 16, ox: 28, oy: 8 };
    case 'ui:hull': return { w: 8, h: 8, ox: 0, oy: 0 };
  }
  throw new Error('no spec for sprite ' + name);
}
