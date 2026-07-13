import { useGameStore } from '../store/gameStore';
import { setAlwaysOnTop, setOverFullscreen } from '../platform/window';

export function Settings({ onClose }: { onClose: () => void }) {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  const a = useGameStore((s) => s.actions);
  if (!save) return null;
  const st = save.meta.settings;

  const toggleTop = async (v: boolean) => {
    await setAlwaysOnTop(v);
    a.setAlwaysOnTop(v);
  };
  const toggleFull = async (v: boolean) => {
    await setOverFullscreen(v);
    a.setOverFullscreen(v);
    if (v) a.setAlwaysOnTop(true);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal sheet">
        <div className="sheet-head">
          <span className="modal-title">⚙ Settings</span>
          <span className="tb-spacer" />
          <button className="tb-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sheet-body">
          <div className="section-label">Window</div>
          <Toggle label="Always on top" on={st.alwaysOnTop} onChange={toggleTop} />
          <Toggle
            label="Stay above fullscreen / all Spaces"
            on={st.overFullscreen}
            onChange={toggleFull}
          />

          <div className="section-label">Gameplay</div>
          <Toggle
            label="Auto-pick relics (after 2s)"
            on={st.autoRelic}
            onChange={(v) => a.setAutoRelic(v)}
          />

          <div className="section-label">Leaderboard</div>
          <label className="field">
            <span>Name</span>
            <input
              className="text-input"
              defaultValue={save.meta.playerName}
              placeholder="Your name"
              maxLength={24}
              onBlur={(e) => a.setPlayerName(e.target.value)}
            />
          </label>
          <div className="modal-row sub">Google sign-in &amp; friend leaderboard: wiring up next.</div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <span className="knob">{on ? 'ON' : 'OFF'}</span>
    </button>
  );
}
