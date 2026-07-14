import { useGameStore } from '../store/gameStore';
import { STAGE_KILLS } from '../game';
import { formatNum } from './format';

/** Heads-up overlays drawn on top of the 3D scene: the stage badge with a wave
 *  pip per enemy (the old HUD bar is gone — the scene got its space), essence,
 *  a quick 1×/2×/3× speed control, and — while the window is unfocused — a dim
 *  veil plus an AFK earnings card over the (now slow-idling) scene. */
export function SceneOverlays({ onOpenDaily }: { onOpenDaily: () => void }) {
  useGameStore((s) => s.screenVersion); // re-read settings.gameSpeed on change
  const stage = useGameStore((s) => s.stage);
  const biome = useGameStore((s) => s.biomeName);
  const wave = useGameStore((s) => s.waveInStage);
  const essence = useGameStore((s) => s.essence);
  const afk = useGameStore((s) => s.afk);
  const afkGold = useGameStore((s) => s.afkGold);
  const dailyClaimable = useGameStore((s) => s.dailyClaimable);
  const speed = useGameStore((s) => s.save?.meta.settings.gameSpeed ?? 1);
  const setSpeed = useGameStore((s) => s.actions.setGameSpeed);

  return (
    <>
      <div className="scene-top">
        <div className="stage-badge">
          <span className="stage-num">STAGE {stage}</span>
          {biome && <span className="stage-biome">{biome}</span>}
          <div className="wave-dots">
            {Array.from({ length: STAGE_KILLS }, (_, i) => (
              <span
                key={i}
                className={`wave-dot ${i < wave ? 'done' : i === wave ? 'now' : ''} ${
                  i === STAGE_KILLS - 1 ? 'end' : ''
                }`}
              />
            ))}
          </div>
        </div>
        <div className="scene-top-right">
          <div className="speed-seg mini">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                className={`speed-btn ${speed === n ? 'sel' : ''}`}
                onClick={() => setSpeed(n)}
              >
                {n}×
              </button>
            ))}
          </div>
          <div className="ess-chip" title="Essence">
            ✦ {formatNum(essence)}
          </div>
          <button className="daily-btn" onClick={onOpenDaily} title="Daily quests">
            📜
            {dailyClaimable > 0 && <span className="daily-badge">{dailyClaimable}</span>}
          </button>
        </div>
      </div>

      {afk && (
        <>
          <div className="afk-dim" />
          <div className="afk-card">
            <div className="afk-zzz">💤</div>
            <div className="afk-title">AFK</div>
            <div className="afk-sub">Earned while away</div>
            <div className="afk-gold">+{formatNum(afkGold)}g</div>
          </div>
        </>
      )}
    </>
  );
}
