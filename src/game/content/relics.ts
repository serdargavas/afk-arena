import type { RelicDef } from '../types';

// 34 relics across 7 archetypes. Magnitudes are the COMMON baseline; the rolled
// rarity scales them (see RARITY_MULT). Effects are expressed purely as stat
// mods so the whole roster is data-driven — no per-relic code paths.
export const RELICS: RelicDef[] = [
  // --- attack ---
  { id: 'rusty_blade', name: 'Rusty Blade', archetype: 'attack', icon: '🗡', desc: '+18% attack', mods: { attackPct: 0.18 } },
  { id: 'whetstone', name: 'Whetstone', archetype: 'attack', icon: '🪨', desc: '+12% attack, +4 armor', mods: { attackPct: 0.12, armor: 4 } },
  { id: 'giants_gauntlet', name: "Giant's Gauntlet", archetype: 'attack', icon: '🥊', desc: '+30% attack', mods: { attackPct: 0.3 } },
  { id: 'war_banner', name: 'War Banner', archetype: 'attack', icon: '🚩', desc: '+15% attack, +10% max HP', mods: { attackPct: 0.15, maxHpPct: 0.1 } },
  { id: 'berserker_mask', name: 'Berserker Mask', archetype: 'attack', icon: '😤', desc: '+25% attack, +8% atk speed', mods: { attackPct: 0.25, attackSpeedPct: 0.08 } },

  // --- speed ---
  { id: 'swift_boots', name: 'Swift Boots', archetype: 'speed', icon: '👢', desc: '+15% attack speed', mods: { attackSpeedPct: 0.15 } },
  { id: 'haste_charm', name: 'Haste Charm', archetype: 'speed', icon: '💨', desc: '+22% attack speed', mods: { attackSpeedPct: 0.22 } },
  { id: 'twin_daggers', name: 'Twin Daggers', archetype: 'speed', icon: '🔪', desc: '+12% atk speed, +6% attack', mods: { attackSpeedPct: 0.12, attackPct: 0.06 } },
  { id: 'metronome', name: 'Metronome', archetype: 'speed', icon: '🎵', desc: '+18% atk speed, +3% crit', mods: { attackSpeedPct: 0.18, critChance: 0.03 } },
  { id: 'quickdraw', name: 'Quickdraw', archetype: 'speed', icon: '⚡', desc: '+30% attack speed', mods: { attackSpeedPct: 0.3 } },

  // --- crit ---
  { id: 'lucky_coin', name: 'Lucky Coin', archetype: 'crit', icon: '🍀', desc: '+7% crit chance', mods: { critChance: 0.07 } },
  { id: 'sharp_eye', name: 'Sharp Eye', archetype: 'crit', icon: '👁', desc: '+5% crit, +0.3 crit dmg', mods: { critChance: 0.05, critMult: 0.3 } },
  { id: 'assassin_hood', name: "Assassin's Hood", archetype: 'crit', icon: '🥷', desc: '+10% crit chance', mods: { critChance: 0.1 } },
  { id: 'deadeye_scope', name: 'Deadeye Scope', archetype: 'crit', icon: '🎯', desc: '+0.7 crit damage', mods: { critMult: 0.7 } },
  { id: 'bloodgem', name: 'Bloodgem', archetype: 'crit', icon: '💎', desc: '+6% crit, +4% lifesteal', mods: { critChance: 0.06, lifesteal: 0.04 } },

  // --- dot (poison) ---
  { id: 'venom_vial', name: 'Venom Vial', archetype: 'dot', icon: '🧪', desc: '+6 poison dps', mods: { dotDps: 6 } },
  { id: 'toxic_coating', name: 'Toxic Coating', archetype: 'dot', icon: '🟢', desc: '+10 poison, +5% attack', mods: { dotDps: 10, attackPct: 0.05 } },
  { id: 'plague_doctor', name: 'Plague Mask', archetype: 'dot', icon: '🦠', desc: '+16 poison dps', mods: { dotDps: 16 } },
  { id: 'serpent_fang', name: 'Serpent Fang', archetype: 'dot', icon: '🐍', desc: '+9 poison, +8% atk speed', mods: { dotDps: 9, attackSpeedPct: 0.08 } },
  { id: 'corrosive_ooze', name: 'Corrosive Ooze', archetype: 'dot', icon: '🫧', desc: '+22 poison dps', mods: { dotDps: 22 } },

  // --- summon ---
  { id: 'spirit_wolf', name: 'Spirit Wolf', archetype: 'summon', icon: '🐺', desc: '+12% summon dps', mods: { summonPct: 0.12 } },
  { id: 'raven_familiar', name: 'Raven Familiar', archetype: 'summon', icon: '🐦‍⬛', desc: '+10% summon, +5% atk speed', mods: { summonPct: 0.1, attackSpeedPct: 0.05 } },
  { id: 'skeleton_crew', name: 'Skeleton Crew', archetype: 'summon', icon: '💀', desc: '+20% summon dps', mods: { summonPct: 0.2 } },
  { id: 'ember_sprite', name: 'Ember Sprite', archetype: 'summon', icon: '🔥', desc: '+14% summon, +6 poison', mods: { summonPct: 0.14, dotDps: 6 } },
  { id: 'golem_core', name: 'Golem Core', archetype: 'summon', icon: '🗿', desc: '+16% summon, +8% max HP', mods: { summonPct: 0.16, maxHpPct: 0.08 } },

  // --- tank ---
  { id: 'oak_shield', name: 'Oak Shield', archetype: 'tank', icon: '🛡', desc: '+18% max HP, +3 armor', mods: { maxHpPct: 0.18, armor: 3 } },
  { id: 'iron_plate', name: 'Iron Plate', archetype: 'tank', icon: '🔩', desc: '+7 armor', mods: { armor: 7 } },
  { id: 'vampire_fang', name: 'Vampire Fang', archetype: 'tank', icon: '🧛', desc: '+7% lifesteal', mods: { lifesteal: 0.07 } },
  { id: 'thorn_mail', name: 'Thorn Mail', archetype: 'tank', icon: '🌵', desc: '+18% thorns, +10% max HP', mods: { thorns: 0.18, maxHpPct: 0.1 } },
  { id: 'heart_of_oak', name: 'Heart of Oak', archetype: 'tank', icon: '💚', desc: '+30% max HP', mods: { maxHpPct: 0.3 } },

  // --- gold ---
  { id: 'coin_purse', name: 'Coin Purse', archetype: 'gold', icon: '💰', desc: '+20% gold', mods: { goldMultPct: 0.2 } },
  { id: 'midas_touch', name: 'Midas Touch', archetype: 'gold', icon: '🪙', desc: '+35% gold', mods: { goldMultPct: 0.35 } },
  { id: 'lucky_clover', name: 'Lucky Clover', archetype: 'gold', icon: '☘', desc: '+15% gold, +4% crit', mods: { goldMultPct: 0.15, critChance: 0.04 } },
  { id: 'merchant_ring', name: 'Merchant Ring', archetype: 'gold', icon: '💍', desc: '+25% gold, +5% attack', mods: { goldMultPct: 0.25, attackPct: 0.05 } },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(
  RELICS.map((r) => [r.id, r]),
);

export function relicDef(id: string): RelicDef | undefined {
  return RELIC_BY_ID[id];
}
