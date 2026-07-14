import { useGameStore } from '../store/gameStore';
import { RELICS, ARCHETYPE_SET_BONUS, RARITIES } from '../game';
import type { Archetype, Rarity } from '../game';

const ARCH_LABEL: Record<Archetype, string> = {
  attack: '⚔ War',
  speed: '💨 Tempo',
  crit: '🎯 Precision',
  dot: '🐍 Venom',
  summon: '🐺 Beasts',
  tank: '🛡 Bulwark',
  gold: '💰 Greed',
};

/** Permanent relic collection: every relic ever obtained, best rarity kept.
 *  Complete an archetype and its set bonus applies to every future run. */
export function Codex() {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  if (!save) return null;
  const codex = save.meta.codex;
  const discovered = Object.keys(codex).length;

  return (
    <>
      <div className="section-label">
        Discovered {discovered}/{RELICS.length} · set bonuses are permanent
      </div>
      {(Object.keys(ARCHETYPE_SET_BONUS) as Archetype[]).map((arch) => {
        const group = RELICS.filter((r) => r.archetype === arch);
        const complete = group.every((r) => codex[r.id] !== undefined);
        const bonus = ARCHETYPE_SET_BONUS[arch];
        return (
          <div key={arch} className={`codex-group ${complete ? 'complete' : ''}`}>
            <div className="codex-head">
              <span className="codex-arch">{ARCH_LABEL[arch]}</span>
              <span className={`codex-bonus ${complete ? 'active' : ''}`}>
                {complete ? '✓ ' : ''}
                {bonus.desc}
              </span>
            </div>
            <div className="codex-row">
              {group.map((r) => {
                const idx = codex[r.id];
                const known = idx !== undefined;
                const rarity: Rarity | null = known ? RARITIES[idx] : null;
                return (
                  <span
                    key={r.id}
                    className={`codex-chip ${known ? `rr-${rarity}` : 'unknown'}`}
                    title={known ? `${r.name} (${rarity}) — ${r.desc}` : '??? — not yet obtained'}
                  >
                    {known ? r.icon : '?'}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
