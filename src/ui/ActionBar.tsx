import { IconMeta, IconSkills, IconGear, IconTrophy, IconSettings } from './icons';

export type SheetTab = 'meta' | 'skills' | 'gear';
export type Panel = SheetTab | 'leaderboard' | 'settings';

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
  return (
    <div className="actionbar">
      {BUTTONS.map(({ panel, label, Icon }) => (
        <button key={panel} className="ab-btn" onClick={() => onOpen(panel)} title={label}>
          <span className="ab-ico">
            <Icon size={20} />
          </span>
          <span className="ab-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
