import { useGameStore } from '../store/gameStore';
import { EVENT_BY_ID } from '../game';

export function EventModal() {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  const resolve = useGameStore((s) => s.actions.resolveEvent);
  const setAutoRelic = useGameStore((s) => s.actions.setAutoRelic);
  const id = save?.run.eventId;
  const def = id ? EVENT_BY_ID[id] : undefined;
  if (!def || !save) return null;
  const auto = save.meta.settings.autoRelic;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-title">
          {def.icon} {def.title}
        </div>
        <div className="modal-row sub">{def.text}</div>
        <div className="event-choices">
          {def.choices.map((c, i) => (
            <button key={i} className="modal-btn ghost" onClick={() => resolve(i)}>
              {c.label}
            </button>
          ))}
        </div>
        <button className={`toggle auto-toggle ${auto ? 'on' : ''}`} onClick={() => setAutoRelic(!auto)}>
          <span>{auto ? 'Auto-resolving in 2s…' : 'Auto-pick relics & events'}</span>
          <span className="knob">{auto ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
}
