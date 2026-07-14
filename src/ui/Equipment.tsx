import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { SLOT_DEFS, SLOT_IDS, itemName, itemPower } from '../game';
import type { ItemInstance, RelicMods, SlotId } from '../game/types';

const MOD_LABEL: Record<keyof RelicMods, { label: string; pct: boolean }> = {
  attackPct: { label: 'ATK', pct: true },
  attackSpeedPct: { label: 'SPD', pct: true },
  maxHpPct: { label: 'HP', pct: true },
  critChance: { label: 'CRIT', pct: true },
  critMult: { label: 'CRIT×', pct: false },
  armor: { label: 'ARM', pct: false },
  lifesteal: { label: 'LIFE', pct: true },
  dotDps: { label: 'DOT', pct: false },
  summonPct: { label: 'SUMM', pct: true },
  goldMultPct: { label: 'GOLD', pct: true },
  thorns: { label: 'THORN', pct: true },
};

function formatMods(mods: RelicMods): string {
  return (Object.keys(mods) as (keyof RelicMods)[])
    .map((k) => {
      const v = mods[k] ?? 0;
      const m = MOD_LABEL[k];
      const shown = m.pct ? `${Math.round(v * 100)}%` : `${v}`;
      return `+${shown} ${m.label}`;
    })
    .join(' · ');
}

export function Equipment() {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  const equip = useGameStore((s) => s.actions.equipItem);
  const unequip = useGameStore((s) => s.actions.unequipItem);
  const markGearSeen = useGameStore((s) => s.actions.markGearSeen);
  // NEW tags stay visible while you browse; leaving the tab marks them seen.
  useEffect(() => () => markGearSeen(), [markGearSeen]);
  if (!save) return null;

  const { inventory, equipped } = save.meta;
  const seenUid = save.meta.seenItemUid;
  const byUid = (uid: number | null) =>
    uid == null ? null : inventory.find((it) => it.uid === uid) ?? null;
  const sorted = [...inventory].sort((a, b) => itemPower(b) - itemPower(a));

  return (
    <>
      <div className="section-label">Equipped</div>
      <div className="slot-row">
        {SLOT_IDS.map((slot) => {
          const item = byUid(equipped[slot]);
          return (
            <button
              key={slot}
              className={`slot ${item ? `rarity-${item.rarity}` : 'empty'}`}
              onClick={() => item && unequip(slot as SlotId)}
              title={item ? `${itemName(item)} — tap to unequip` : SLOT_DEFS[slot].name}
            >
              <span className="slot-ico">{SLOT_DEFS[slot].icon}</span>
              {item ? (
                <span className="slot-mods">{formatMods(item.mods)}</span>
              ) : (
                <span className="slot-empty">empty</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="section-label">Stash ({inventory.length})</div>
      <div className="item-list">
        {sorted.map((it) => {
          const isEq = equipped[it.slot] === it.uid;
          return (
            <button
              key={it.uid}
              className={`item rarity-${it.rarity} ${isEq ? 'equipped' : ''}`}
              onClick={() => equip(it.uid)}
              disabled={isEq}
            >
              <span className="item-ico">{SLOT_DEFS[it.slot].icon}</span>
              <span className="item-main">
                <span className="item-name">
                  {itemName(it)} {it.uid > seenUid && <span className="item-new">NEW</span>}{' '}
                  {isEq && <span className="item-eq">equipped</span>}
                </span>
                <span className="item-mods">{formatMods(it.mods)}</span>
              </span>
            </button>
          );
        })}
        {inventory.length === 0 && (
          <div className="lb-note">No gear yet — items drop when a run ends.</div>
        )}
      </div>
    </>
  );
}

export type { ItemInstance };
