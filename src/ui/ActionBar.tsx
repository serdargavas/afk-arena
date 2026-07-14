import { IconMeta, IconSkills, IconGear, IconTrophy, IconSettings } from './icons';
import { useGameStore } from '../store/gameStore';

export type SheetTab = 'meta' | 'skills' | 'gear' | 'codex';
export type Panel = SheetTab | 'leaderboard' | 'settings' | 'daily';

const BUTTONS: { panel: Panel; label: string; Icon: (p: { size?: number }) => React.JSX.Element }[] = [
  { panel: 'meta', label: 'Meta', Icon: IconMeta },
  { panel: 'skills', label: 'Skills', Icon: IconSkills },
  { panel: 'gear', label: 'Gear', Icon: IconGear },
  { panel: 'leaderboard', label: 'Ranks', Icon: IconTrophy },
  { panel: 'settings', label: 'Settings', Icon: IconSettings },
];

// In-game armored toolbar. Each button opens the character sheet on its tab (or
// the leaderboard / settings panels).
export function ActionBar({ onOpen }: { onOpen: (panel: Panel) => void }) {
  const badgeMeta = useGameStore((s) => s.badgeMeta);
  const badgeSkills = useGameStore((s) => s.badgeSkills);
  const badgeGear = useGameStore((s) => s.badgeGear);
  const badges: Partial<Record<Panel, number>> = {
    meta: badgeMeta,
    skills: badgeSkills,
    gear: badgeGear,
  };
  return (
    <div className="actionbar">
      {BUTTONS.map(({ panel, label, Icon }) => {
        const n = badges[panel] ?? 0;
        return (
          <button key={panel} className="ab-btn" onClick={() => onOpen(panel)} title={label}>
            <span className="ab-ico">
              <Icon size={20} />
            </span>
            <span className="ab-label">{label}</span>
            {n > 0 && <span className="ab-badge">{n > 9 ? '9+' : n}</span>}
          </button>
        );
      })}
    </div>
  );
}
