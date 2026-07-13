import { useGameStore } from '../store/gameStore';
import { relicDef } from '../game';

export function RelicChoice() {
  useGameStore((s) => s.screenVersion); // re-render when the offer / setting changes
  const save = useGameStore((s) => s.save);
  const pick = useGameStore((s) => s.actions.pickRelic);
  const setAutoRelic = useGameStore((s) => s.actions.setAutoRelic);
  const offer = save?.run.offer;
  if (!offer || !save) return null;
  const auto = save.meta.settings.autoRelic;

  return (
    <div className="modal-backdrop">
      <div className="modal wide">
        <div className="modal-title">Choose a Relic</div>
        <div className="relic-row">
          {offer.map((r, i) => {
            const def = relicDef(r.id);
            if (!def) return null;
            return (
              <button key={i} className={`relic-card rr-${r.rarity}`} onClick={() => pick(i)}>
                <span className="relic-ico">{def.icon}</span>
                <span className="relic-name">{def.name}</span>
                <span className={`relic-rarity rc-${r.rarity}`}>{r.rarity}</span>
                <span className="relic-desc">{def.desc}</span>
              </button>
            );
          })}
        </div>
        <button className={`toggle auto-toggle ${auto ? 'on' : ''}`} onClick={() => setAutoRelic(!auto)}>
          <span>{auto ? 'Auto-picking best in 2s…' : 'Auto-pick relics & events'}</span>
          <span className="knob">{auto ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
}
