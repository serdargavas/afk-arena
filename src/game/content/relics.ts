import type { Archetype, RelicDef, RelicMods } from '../types';

// 34 relics across 7 archetypes. Magnitudes are the COMMON baseline; the rolled
// rarity scales them (see RARITY_MULT). Effects are expressed purely as stat
// mods so the whole roster is data-driven — no per-relic code paths.
// Baselines are tuned ~1.8× hotter than the original roster: boxes only drop
// every RELIC_EVERY_STAGES stages now, so each relic must carry more weight.
export const RELICS: RelicDef[] = [
  // --- attack ---
  { id: 'rusty_blade', name: 'Rusty Blade', archetype: 'attack', icon: '🗡', desc: '+32% attack', mods: { attackPct: 0.32 } },
  { id: 'whetstone', name: 'Whetstone', archetype: 'attack', icon: '🪨', desc: '+22% attack, +7 armor', mods: { attackPct: 0.22, armor: 7 } },
  { id: 'giants_gauntlet', name: "Giant's Gauntlet", archetype: 'attack', icon: '🥊', desc: '+55% attack', mods: { attackPct: 0.55 } },
  { id: 'war_banner', name: 'War Banner', archetype: 'attack', icon: '🚩', desc: '+27% attack, +18% max HP', mods: { attackPct: 0.27, maxHpPct: 0.18 } },
  { id: 'berserker_mask', name: 'Berserker Mask', archetype: 'attack', icon: '😤', desc: '+45% attack, +14% atk speed', mods: { attackPct: 0.45, attackSpeedPct: 0.14 } },

  // --- speed ---
  { id: 'swift_boots', name: 'Swift Boots', archetype: 'speed', icon: '👢', desc: '+27% attack speed', mods: { attackSpeedPct: 0.27 } },
  { id: 'haste_charm', name: 'Haste Charm', archetype: 'speed', icon: '💨', desc: '+40% attack speed', mods: { attackSpeedPct: 0.4 } },
  { id: 'twin_daggers', name: 'Twin Daggers', archetype: 'speed', icon: '🔪', desc: '+22% atk speed, +11% attack', mods: { attackSpeedPct: 0.22, attackPct: 0.11 } },
  { id: 'metronome', name: 'Metronome', archetype: 'speed', icon: '🎵', desc: '+32% atk speed, +5% crit', mods: { attackSpeedPct: 0.32, critChance: 0.05 } },
  { id: 'quickdraw', name: 'Quickdraw', archetype: 'speed', icon: '⚡', desc: '+55% attack speed', mods: { attackSpeedPct: 0.55 } },

  // --- crit ---
  { id: 'lucky_coin', name: 'Lucky Coin', archetype: 'crit', icon: '🍀', desc: '+13% crit chance', mods: { critChance: 0.13 } },
  { id: 'sharp_eye', name: 'Sharp Eye', archetype: 'crit', icon: '👁', desc: '+9% crit, +0.55 crit dmg', mods: { critChance: 0.09, critMult: 0.55 } },
  { id: 'assassin_hood', name: "Assassin's Hood", archetype: 'crit', icon: '🥷', desc: '+18% crit chance', mods: { critChance: 0.18 } },
  { id: 'deadeye_scope', name: 'Deadeye Scope', archetype: 'crit', icon: '🎯', desc: '+1.25 crit damage', mods: { critMult: 1.25 } },
  { id: 'bloodgem', name: 'Bloodgem', archetype: 'crit', icon: '💎', desc: '+11% crit, +7% lifesteal', mods: { critChance: 0.11, lifesteal: 0.07 } },

  // --- dot (poison) ---
  { id: 'venom_vial', name: 'Venom Vial', archetype: 'dot', icon: '🧪', desc: '+11 poison dps', mods: { dotDps: 11 } },
  { id: 'toxic_coating', name: 'Toxic Coating', archetype: 'dot', icon: '🟢', desc: '+18 poison, +9% attack', mods: { dotDps: 18, attackPct: 0.09 } },
  { id: 'plague_doctor', name: 'Plague Mask', archetype: 'dot', icon: '🦠', desc: '+29 poison dps', mods: { dotDps: 29 } },
  { id: 'serpent_fang', name: 'Serpent Fang', archetype: 'dot', icon: '🐍', desc: '+16 poison, +14% atk speed', mods: { dotDps: 16, attackSpeedPct: 0.14 } },
  { id: 'corrosive_ooze', name: 'Corrosive Ooze', archetype: 'dot', icon: '🫧', desc: '+40 poison dps', mods: { dotDps: 40 } },

  // --- summon ---
  { id: 'spirit_wolf', name: 'Spirit Wolf', archetype: 'summon', icon: '🐺', desc: '+22% summon dps', mods: { summonPct: 0.22 } },
  { id: 'raven_familiar', name: 'Raven Familiar', archetype: 'summon', icon: '🐦‍⬛', desc: '+18% summon, +9% atk speed', mods: { summonPct: 0.18, attackSpeedPct: 0.09 } },
  { id: 'skeleton_crew', name: 'Skeleton Crew', archetype: 'summon', icon: '💀', desc: '+36% summon dps', mods: { summonPct: 0.36 } },
  { id: 'ember_sprite', name: 'Ember Sprite', archetype: 'summon', icon: '🔥', desc: '+25% summon, +11 poison', mods: { summonPct: 0.25, dotDps: 11 } },
  { id: 'golem_core', name: 'Golem Core', archetype: 'summon', icon: '🗿', desc: '+29% summon, +14% max HP', mods: { summonPct: 0.29, maxHpPct: 0.14 } },

  // --- tank ---
  { id: 'oak_shield', name: 'Oak Shield', archetype: 'tank', icon: '🛡', desc: '+32% max HP, +5 armor', mods: { maxHpPct: 0.32, armor: 5 } },
  { id: 'iron_plate', name: 'Iron Plate', archetype: 'tank', icon: '🔩', desc: '+13 armor', mods: { armor: 13 } },
  { id: 'vampire_fang', name: 'Vampire Fang', archetype: 'tank', icon: '🧛', desc: '+13% lifesteal', mods: { lifesteal: 0.13 } },
  { id: 'thorn_mail', name: 'Thorn Mail', archetype: 'tank', icon: '🌵', desc: '+32% thorns, +18% max HP', mods: { thorns: 0.32, maxHpPct: 0.18 } },
  { id: 'heart_of_oak', name: 'Heart of Oak', archetype: 'tank', icon: '💚', desc: '+55% max HP', mods: { maxHpPct: 0.55 } },

  // --- gold ---
  { id: 'coin_purse', name: 'Coin Purse', archetype: 'gold', icon: '💰', desc: '+36% gold', mods: { goldMultPct: 0.36 } },
  { id: 'midas_touch', name: 'Midas Touch', archetype: 'gold', icon: '🪙', desc: '+63% gold', mods: { goldMultPct: 0.63 } },
  { id: 'lucky_clover', name: 'Lucky Clover', archetype: 'gold', icon: '☘', desc: '+27% gold, +7% crit', mods: { goldMultPct: 0.27, critChance: 0.07 } },
  { id: 'merchant_ring', name: 'Merchant Ring', archetype: 'gold', icon: '💍', desc: '+45% gold, +9% attack', mods: { goldMultPct: 0.45, attackPct: 0.09 } },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(
  RELICS.map((r) => [r.id, r]),
);

export function relicDef(id: string): RelicDef | undefined {
  return RELIC_BY_ID[id];
}

// Codex set bonuses: discover every relic of an archetype (any rarity) and its
// bonus applies permanently, on every run — collection becomes power.
export const ARCHETYPE_SET_BONUS: Record<Archetype, { desc: string; mods: RelicMods }> = {
  attack: { desc: '+6% attack', mods: { attackPct: 0.06 } },
  speed: { desc: '+6% attack speed', mods: { attackSpeedPct: 0.06 } },
  crit: { desc: '+4% crit chance', mods: { critChance: 0.04 } },
  dot: { desc: '+8 poison dps', mods: { dotDps: 8 } },
  summon: { desc: '+10% summon dps', mods: { summonPct: 0.1 } },
  tank: { desc: '+10% max HP', mods: { maxHpPct: 0.1 } },
  gold: { desc: '+12% gold', mods: { goldMultPct: 0.12 } },
};
