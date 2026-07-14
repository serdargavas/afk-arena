import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { relicDef, PITY_BOX_GUARANTEE, RARITIES } from '../game';
import type { Rarity } from '../game';

// Stage-clear mystery box: no choices — the box shakes and glows in its rolled
// rarity's colour, bursts open into a big reveal of the relic you got, then the
// run continues by itself. Any click skips straight ahead (shake → reveal →
// done), so the whole beat is over in a tap. Higher rarities tease longer.
const SHAKE_MS: Record<Rarity, number> = {
  common: 900,
  uncommon: 1100,
  rare: 1400,
  epic: 1800,
  legendary: 2300,
};
const REVEAL_MS = 1500;

export function MysteryBox() {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  const pick = useGameStore((s) => s.actions.pickRelic);
  const [open, setOpen] = useState(false);
  const done = useRef(false);
  const relic = save?.run.offer?.[0];
  const rarity: Rarity = relic?.rarity ?? 'common';

  // auto-advance: shake → reveal → collect (clicks fast-forward the same path)
  useEffect(() => {
    if (!relic) return;
    const t = setTimeout(() => setOpen(true), SHAKE_MS[rarity]);
    return () => clearTimeout(t);
  }, [relic, rarity]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    pick(0);
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(finish, REVEAL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!relic) return null;
  const def = relicDef(relic.id);
  if (!def) return null;

  return (
    <div className="modal-backdrop box-backdrop" onClick={() => (open ? finish() : setOpen(true))}>
      {!open ? (
        <div className={`mystery-box mb-${rarity}`}>
          <div className="box-rays" />
          <div className="box-aura" />
          <div className="chest">
            <div className="chest-lid" />
            <div className="chest-seam" />
            <div className="chest-base" />
            <div className="chest-lock" />
          </div>
          <div className="box-motes">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          <div className="box-label">Mystery Box</div>
          <div className="box-tap">tap to open</div>
          <div className="pity-line">
            {RARITIES.indexOf(rarity) >= RARITIES.indexOf('epic')
              ? '✨ pity reset'
              : (() => {
                  const left = PITY_BOX_GUARANTEE - (save?.meta.pity ?? 0);
                  return `✨ epic+ guaranteed in ${left} ${left === 1 ? 'box' : 'boxes'}`;
                })()}
          </div>
        </div>
      ) : (
        <div className={`box-reveal rr-${rarity}`}>
          <div className="reveal-beam" />
          <div className="reveal-burst" />
          <div className="reveal-card">
            <span className="reveal-ico">{def.icon}</span>
            <span className="reveal-name">{def.name}</span>
            <span className={`relic-rarity rc-${rarity}`}>{rarity}</span>
            <span className="reveal-desc">{def.desc}</span>
            <span className="reveal-tap">tap to continue</span>
          </div>
        </div>
      )}
    </div>
  );
}
