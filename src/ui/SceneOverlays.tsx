import { useGameStore } from '../store/gameStore';
import { formatNum } from './format';

/** Heads-up overlays drawn on top of the 3D scene: current stage (top-centre),
 *  a quick 1×/2×/3× speed control, and — while the window is unfocused — an AFK
 *  earnings card in place of the (now frozen) live scene. */
export function SceneOverlays() {
  useGameStore((s) => s.screenVersion); // re-read settings.gameSpeed on change
  const stage = useGameStore((s) => s.stage);
  const biome = useGameStore((s) => s.biomeName);
  const afk = useGameStore((s) => s.afk);
  const afkGold = useGameStore((s) => s.afkGold);
  const speed = useGameStore((s) => s.save?.meta.settings.gameSpeed ?? 1);
  const setSpeed = useGameStore((s) => s.actions.setGameSpeed);

  return (
    <>
      <div className="scene-top">
        <div className="stage-badge">
          <span className="stage-num">STAGE {stage}</span>
          {biome && <span className="stage-biome">{biome}</span>}
        </div>
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
      </div>

      {afk && (
        <div className="afk-card">
          <div className="afk-zzz">💤</div>
          <div className="afk-title">AFK</div>
          <div className="afk-sub">Earned while away</div>
          <div className="afk-gold">+{formatNum(afkGold)}g</div>
        </div>
      )}
    </>
  );
}
