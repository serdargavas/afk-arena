import { useGameStore } from '../store/gameStore';
import { shopCost, relicDef, RARITIES } from '../game';
import type { ShopKey } from '../game';
import { formatNum } from './format';

const SHOP_ITEMS: Array<{ key: ShopKey; icon: string; label: string }> = [
  { key: 'attack', icon: '⚔', label: 'Attack' },
  { key: 'hp', icon: '❤', label: 'Max HP' },
  { key: 'speed', icon: '⚡', label: 'Speed' },
];

export function RunPanel() {
  // Re-render on relic/shop changes (screenVersion) and roughly with the HUD.
  useGameStore((s) => s.screenVersion);
  const gold = useGameStore((s) => s.gold);
  const dps = useGameStore((s) => s.dps);
  useGameStore((s) => s.stage); // refresh stats when a stage is cleared
  const save = useGameStore((s) => s.save);
  const buyShop = useGameStore((s) => s.actions.buyShop);
  if (!save) return null;
  const s = save.run.stats;
  const relics = save.run.relics;

  return (
    <div className="runpanel">
      <div className="panel-label">Shop · spend gold</div>
      <div className="shop-row">
        {SHOP_ITEMS.map((item) => {
          const lvl = save.run.shop[item.key];
          const cost = shopCost(save, item.key);
          const afford = gold >= cost;
          return (
            <button
              key={item.key}
              className={`shop-btn ${afford ? 'afford' : 'poor'}`}
              disabled={!afford}
              onClick={() => buyShop(item.key)}
            >
              <span className="shop-ico">{item.icon}</span>
              <span className="shop-label">
                {item.label} <span className="shop-lvl">Lv{lvl}</span>
              </span>
              <span className="shop-cost">◈{formatNum(cost)}</span>
            </button>
          );
        })}
      </div>

      <div className="panel-label">Stats</div>
      <div className="stat-grid">
        <Stat k="⚔ DMG" v={formatNum(Math.round(s.attack))} />
        <Stat k="⚡ SPD" v={`${s.attackSpeed.toFixed(2)}/s`} />
        <Stat k="🔥 DPS" v={formatNum(dps)} />
        <Stat k="🎯 CRIT" v={`${Math.round(s.critChance * 100)}%`} />
        <Stat k="🛡 ARMOR" v={`${Math.round(s.armor)}`} />
        <Stat k="🩸 LIFE" v={`${Math.round(s.lifesteal * 100)}%`} />
      </div>

      <div className="panel-label">Relics · {relics.length}</div>
      {relics.length === 0 && (
        <div className="relic-grid">
          <span className="empty">— none yet —</span>
        </div>
      )}
      {[...RARITIES].reverse().map((rarity) => {
        const group = relics.filter((r) => r.rarity === rarity);
        if (group.length === 0) return null;
        return (
          <div key={rarity} className="relic-group">
            <span className={`relic-group-label rc-${rarity}`}>
              {rarity} · {group.length}
            </span>
            <div className="relic-grid">
              {group.map((r, i) => {
                const def = relicDef(r.id);
                if (!def) return null;
                return (
                  <span key={i} className={`relic-chip rr-${r.rarity}`} title={`${def.name} (${r.rarity}) — ${def.desc}`}>
                    {def.icon}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat">
      <span className="stat-k">{k}</span>
      <span className="stat-v">{v}</span>
    </div>
  );
}
