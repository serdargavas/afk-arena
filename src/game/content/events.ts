import type { GameSave } from '../types';

// Random between-stage events. Each choice mutates the save directly (gold/hp/
// relic via callbacks provided by run.ts to avoid circular imports).
export interface EventChoice {
  label: string;
  /** Apply the choice. `ctx` gives run.ts helpers (heal, grant relic, gamble). */
  apply: (save: GameSave, ctx: EventCtx) => void;
}

export interface EventCtx {
  healFraction: (save: GameSave, frac: number) => void;
  grantRelic: (save: GameSave) => void;
  rng: () => number; // 0..1
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  icon: string;
  choices: EventChoice[];
}

export const EVENTS: EventDef[] = [
  {
    id: 'shrine',
    title: 'Healing Shrine',
    icon: '⛲',
    text: 'A quiet shrine hums with restorative light.',
    choices: [
      { label: 'Rest (heal 60%)', apply: (s, c) => c.healFraction(s, 0.6) },
      { label: 'Pray (gain a relic)', apply: (s, c) => c.grantRelic(s) },
    ],
  },
  {
    id: 'chest',
    title: 'Mimic or Treasure?',
    icon: '🧰',
    text: 'A gilded chest sits invitingly in the path.',
    choices: [
      {
        label: 'Open it (50/50)',
        apply: (s, c) => {
          if (c.rng() < 0.5) c.grantRelic(s);
          else s.run.gold += Math.ceil(s.run.enemy.goldReward * 6);
        },
      },
      { label: 'Leave it (heal 25%)', apply: (s, c) => c.healFraction(s, 0.25) },
    ],
  },
  {
    id: 'merchant',
    title: 'Wandering Merchant',
    icon: '🧙',
    text: 'A hooded merchant offers a deal.',
    choices: [
      {
        label: 'Trade HP for gold',
        apply: (s) => {
          s.run.hero.hp = Math.max(1, s.run.hero.hp * 0.6);
          s.run.gold += Math.ceil(s.run.enemy.goldReward * 10);
        },
      },
      { label: 'Decline (gain a relic)', apply: (s, c) => c.grantRelic(s) },
    ],
  },
  {
    id: 'obelisk',
    title: 'Blood Obelisk',
    icon: '🩸',
    text: 'The obelisk offers power for a price.',
    choices: [
      {
        label: 'Two relics, lose 40% HP',
        apply: (s, c) => {
          c.grantRelic(s);
          c.grantRelic(s);
          s.run.hero.hp = Math.max(1, s.run.hero.hp * 0.6);
        },
      },
      { label: 'Refuse (heal 40%)', apply: (s, c) => c.healFraction(s, 0.4) },
    ],
  },
  {
    id: 'campfire',
    title: 'Campfire',
    icon: '🔥',
    text: 'A warm fire — a moment to recover.',
    choices: [
      { label: 'Heal fully', apply: (s) => { s.run.hero.hp = s.run.stats.maxHp; } },
      {
        label: 'Gamble gold (double or nothing)',
        apply: (s, c) => {
          if (c.rng() < 0.5) s.run.gold *= 2;
          else s.run.gold = Math.floor(s.run.gold / 2);
        },
      },
    ],
  },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(
  EVENTS.map((e) => [e.id, e]),
);
