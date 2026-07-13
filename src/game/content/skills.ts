import type { RelicMods } from '../types';

// PoE-style passive tree: 9 branches radiate from a class start in the centre.
// A node can only be allocated when its `prereq` (the node one step closer to
// the centre) is taken, and a node with allocated children can't be refunded —
// chains grow and shrink from the tips, like Path of Exile. Deeper nodes are
// deliberately stronger so travelling a branch pays off. Only SKILL_POINTS may
// be allocated at once (respec is free).
export interface SkillNode {
  id: string;
  name: string;
  icon: string;
  desc: string;
  mods: RelicMods;
  prereq?: string; // must be allocated first (chain toward the centre)
  x: number; // tree layout coords in a 440×440 viewBox
  y: number;
}

// Polar helper: branch angle in degrees (0 = up, clockwise), radius from centre.
const C = 220;
const at = (deg: number, r: number): { x: number; y: number } => ({
  x: Math.round(C + r * Math.sin((deg * Math.PI) / 180)),
  y: Math.round(C - r * Math.cos((deg * Math.PI) / 180)),
});

const R1 = 68;
const R2 = 118;
const R3 = 168;
const R4 = 208;
const RS = 150; // side-branch radius

export const SKILL_NODES: SkillNode[] = [
  // ⚔ War (0°): raw attack
  { id: 'sk_edge', name: 'Keen Edge', icon: '🗡', desc: '+12% attack', mods: { attackPct: 0.12 }, ...at(0, R1) },
  { id: 'sk_power', name: 'Overpower', icon: '💥', desc: '+20% attack', mods: { attackPct: 0.2 }, prereq: 'sk_edge', ...at(0, R2) },
  { id: 'sk_exec', name: 'Executioner', icon: '⚔️', desc: '+32% attack', mods: { attackPct: 0.32 }, prereq: 'sk_power', ...at(0, R3) },
  { id: 'sk_rage', name: 'Berserk', icon: '😤', desc: '+14% attack, +8% attack speed', mods: { attackPct: 0.14, attackSpeedPct: 0.08 }, prereq: 'sk_power', ...at(-16, RS) },

  // 💨 Tempo (40°): attack speed
  { id: 'sk_swift', name: 'Swiftness', icon: '💨', desc: '+12% attack speed', mods: { attackSpeedPct: 0.12 }, ...at(40, R1) },
  { id: 'sk_frenzy', name: 'Frenzy', icon: '🌀', desc: '+20% attack speed', mods: { attackSpeedPct: 0.2 }, prereq: 'sk_swift', ...at(40, R2) },
  { id: 'sk_flow', name: 'Flow State', icon: '🎐', desc: '+12% attack speed, +6% crit', mods: { attackSpeedPct: 0.12, critChance: 0.06 }, prereq: 'sk_frenzy', ...at(40, R3) },

  // 🎯 Precision (80°): crit — the longest branch, capstone included
  { id: 'sk_eye', name: 'Keen Eye', icon: '🎯', desc: '+8% crit chance', mods: { critChance: 0.08 }, ...at(80, R1) },
  { id: 'sk_savage', name: 'Savagery', icon: '🔪', desc: '+0.5 crit damage', mods: { critMult: 0.5 }, prereq: 'sk_eye', ...at(80, R2) },
  { id: 'sk_deadly', name: 'Deadly Aim', icon: '🏹', desc: '+12% crit chance', mods: { critChance: 0.12 }, prereq: 'sk_savage', ...at(80, R3) },
  { id: 'sk_ruin', name: 'Ruination', icon: '☄️', desc: '+1.0 crit damage', mods: { critMult: 1.0 }, prereq: 'sk_deadly', ...at(80, R4) },
  { id: 'sk_assassin', name: 'Assassinate', icon: '🥷', desc: '+6% crit, +0.35 crit dmg', mods: { critChance: 0.06, critMult: 0.35 }, prereq: 'sk_savage', ...at(96, RS) },

  // 💰 Greed (120°)
  { id: 'sk_gold', name: 'Prospector', icon: '💰', desc: '+22% gold', mods: { goldMultPct: 0.22 }, ...at(120, R1) },
  { id: 'sk_fortune', name: 'Fortune', icon: '🍀', desc: '+40% gold', mods: { goldMultPct: 0.4 }, prereq: 'sk_gold', ...at(120, R2) },

  // 🐺 Beastmaster (160°): summons
  { id: 'sk_call', name: 'Companion', icon: '🐺', desc: '+14% summon damage', mods: { summonPct: 0.14 }, ...at(160, R1) },
  { id: 'sk_bond', name: 'Spirit Bond', icon: '✨', desc: '+12% summon, +10% attack', mods: { summonPct: 0.12, attackPct: 0.1 }, prereq: 'sk_call', ...at(160, R2) },
  { id: 'sk_pack', name: 'Pack Leader', icon: '🐾', desc: '+28% summon damage', mods: { summonPct: 0.28 }, prereq: 'sk_bond', ...at(160, R3) },

  // 🐍 Venom (200°): poison
  { id: 'sk_venom', name: 'Venom', icon: '🐍', desc: '+6 poison dps', mods: { dotDps: 6 }, ...at(200, R1) },
  { id: 'sk_toxic', name: 'Toxic Blades', icon: '🧪', desc: '+5 poison, +8% attack speed', mods: { dotDps: 5, attackSpeedPct: 0.08 }, prereq: 'sk_venom', ...at(200, R2) },
  { id: 'sk_plague', name: 'Plaguebearer', icon: '☣️', desc: '+14 poison dps', mods: { dotDps: 14 }, prereq: 'sk_toxic', ...at(200, R3) },

  // 🌵 Retaliation (240°): thorns
  { id: 'sk_spikes', name: 'Spiked Skin', icon: '🌵', desc: '+18% thorns', mods: { thorns: 0.18 }, ...at(240, R1) },
  { id: 'sk_reflect', name: 'Retribution', icon: '⚡', desc: '+35% thorns', mods: { thorns: 0.35 }, prereq: 'sk_spikes', ...at(240, R2) },

  // 🦇 Blood (280°): sustain
  { id: 'sk_leech', name: 'Bloodthirst', icon: '🦇', desc: '+5% lifesteal', mods: { lifesteal: 0.05 }, ...at(280, R1) },
  { id: 'sk_regen', name: 'Second Wind', icon: '🌬', desc: '+8% max HP, +4% lifesteal', mods: { maxHpPct: 0.08, lifesteal: 0.04 }, prereq: 'sk_leech', ...at(280, R2) },
  { id: 'sk_vamp', name: 'Vampirism', icon: '🧛', desc: '+10% lifesteal', mods: { lifesteal: 0.1 }, prereq: 'sk_regen', ...at(280, R3) },

  // 🛡 Bulwark (320°): defense — long branch with capstone armor
  { id: 'sk_hide', name: 'Thick Hide', icon: '🐗', desc: '+14% max HP', mods: { maxHpPct: 0.14 }, ...at(320, R1) },
  { id: 'sk_plate', name: 'Plating', icon: '🧱', desc: '+5 armor', mods: { armor: 5 }, prereq: 'sk_hide', ...at(320, R2) },
  { id: 'sk_titan', name: 'Titan Blood', icon: '🩸', desc: '+26% max HP', mods: { maxHpPct: 0.26 }, prereq: 'sk_plate', ...at(320, R3) },
  { id: 'sk_aegis', name: 'Aegis', icon: '🛡', desc: '+10 armor', mods: { armor: 10 }, prereq: 'sk_titan', ...at(320, R4) },
  { id: 'sk_ward', name: 'Warded', icon: '🔰', desc: '+10% max HP, +3 armor', mods: { maxHpPct: 0.1, armor: 3 }, prereq: 'sk_plate', ...at(304, RS) },
];

export const SKILL_BY_ID: Record<string, SkillNode> = Object.fromEntries(
  SKILL_NODES.map((n) => [n.id, n]),
);
