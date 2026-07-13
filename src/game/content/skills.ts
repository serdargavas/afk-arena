import type { RelicMods } from '../types';

// PoE-style loadout: 30 nodes exist, but only SKILL_POINTS may be allocated at
// once (respec is free). Magnitudes are fixed (no rarity) and fold into
// computeStats exactly like relics with a rarity multiplier of 1.
export interface SkillNode {
  id: string;
  name: string;
  icon: string;
  desc: string;
  mods: RelicMods;
}

export const SKILL_NODES: SkillNode[] = [
  // Offense
  { id: 'sk_edge', name: 'Keen Edge', icon: '🗡', desc: '+10% attack', mods: { attackPct: 0.1 } },
  { id: 'sk_power', name: 'Overpower', icon: '💥', desc: '+16% attack', mods: { attackPct: 0.16 } },
  { id: 'sk_rage', name: 'Berserk', icon: '😤', desc: '+12% attack, +6% attack speed', mods: { attackPct: 0.12, attackSpeedPct: 0.06 } },
  { id: 'sk_exec', name: 'Executioner', icon: '⚔️', desc: '+20% attack', mods: { attackPct: 0.2 } },
  // Speed
  { id: 'sk_swift', name: 'Swiftness', icon: '💨', desc: '+10% attack speed', mods: { attackSpeedPct: 0.1 } },
  { id: 'sk_frenzy', name: 'Frenzy', icon: '🌀', desc: '+16% attack speed', mods: { attackSpeedPct: 0.16 } },
  { id: 'sk_flow', name: 'Flow State', icon: '🎐', desc: '+8% attack speed, +5% crit', mods: { attackSpeedPct: 0.08, critChance: 0.05 } },
  // Crit
  { id: 'sk_eye', name: 'Keen Eye', icon: '🎯', desc: '+7% crit chance', mods: { critChance: 0.07 } },
  { id: 'sk_deadly', name: 'Deadly Aim', icon: '🏹', desc: '+11% crit chance', mods: { critChance: 0.11 } },
  { id: 'sk_savage', name: 'Savagery', icon: '🔪', desc: '+0.4 crit damage', mods: { critMult: 0.4 } },
  { id: 'sk_ruin', name: 'Ruination', icon: '☄️', desc: '+0.7 crit damage', mods: { critMult: 0.7 } },
  { id: 'sk_assassin', name: 'Assassinate', icon: '🥷', desc: '+5% crit, +0.3 crit dmg', mods: { critChance: 0.05, critMult: 0.3 } },
  // Defense
  { id: 'sk_hide', name: 'Thick Hide', icon: '🐗', desc: '+12% max HP', mods: { maxHpPct: 0.12 } },
  { id: 'sk_titan', name: 'Titan Blood', icon: '🩸', desc: '+20% max HP', mods: { maxHpPct: 0.2 } },
  { id: 'sk_plate', name: 'Plating', icon: '🧱', desc: '+4 armor', mods: { armor: 4 } },
  { id: 'sk_aegis', name: 'Aegis', icon: '🛡', desc: '+7 armor', mods: { armor: 7 } },
  { id: 'sk_ward', name: 'Warded', icon: '🔰', desc: '+8% max HP, +2 armor', mods: { maxHpPct: 0.08, armor: 2 } },
  // Sustain
  { id: 'sk_leech', name: 'Bloodthirst', icon: '🦇', desc: '+4% lifesteal', mods: { lifesteal: 0.04 } },
  { id: 'sk_vamp', name: 'Vampirism', icon: '🧛', desc: '+7% lifesteal', mods: { lifesteal: 0.07 } },
  { id: 'sk_regen', name: 'Second Wind', icon: '🌬', desc: '+6% max HP, +3% lifesteal', mods: { maxHpPct: 0.06, lifesteal: 0.03 } },
  // Thorns
  { id: 'sk_spikes', name: 'Spiked Skin', icon: '🌵', desc: '+12% thorns', mods: { thorns: 0.12 } },
  { id: 'sk_reflect', name: 'Retribution', icon: '⚡', desc: '+22% thorns', mods: { thorns: 0.22 } },
  // Poison / DoT
  { id: 'sk_venom', name: 'Venom', icon: '🐍', desc: '+4 poison dps', mods: { dotDps: 4 } },
  { id: 'sk_plague', name: 'Plaguebearer', icon: '☣️', desc: '+8 poison dps', mods: { dotDps: 8 } },
  { id: 'sk_toxic', name: 'Toxic Blades', icon: '🧪', desc: '+3 poison, +6% attack speed', mods: { dotDps: 3, attackSpeedPct: 0.06 } },
  // Summon
  { id: 'sk_call', name: 'Companion', icon: '🐺', desc: '+10% summon damage', mods: { summonPct: 0.1 } },
  { id: 'sk_pack', name: 'Pack Leader', icon: '🐾', desc: '+18% summon damage', mods: { summonPct: 0.18 } },
  { id: 'sk_bond', name: 'Spirit Bond', icon: '✨', desc: '+8% summon, +8% attack', mods: { summonPct: 0.08, attackPct: 0.08 } },
  // Greed
  { id: 'sk_gold', name: 'Prospector', icon: '💰', desc: '+18% gold', mods: { goldMultPct: 0.18 } },
  { id: 'sk_fortune', name: 'Fortune', icon: '🍀', desc: '+30% gold', mods: { goldMultPct: 0.3 } },
];

export const SKILL_BY_ID: Record<string, SkillNode> = Object.fromEntries(
  SKILL_NODES.map((n) => [n.id, n]),
);
