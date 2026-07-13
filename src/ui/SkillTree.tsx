import { useGameStore } from '../store/gameStore';
import { SKILL_NODES, SKILL_POINTS, skillsAllocated } from '../game';

// PoE-style loadout: 30 nodes, allocate up to SKILL_POINTS, free respec.
export function SkillTree() {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  const allocate = useGameStore((s) => s.actions.allocateSkill);
  const respec = useGameStore((s) => s.actions.respecSkills);
  if (!save) return null;

  const skills = save.meta.skills;
  const used = skillsAllocated(save);
  const full = used >= SKILL_POINTS;

  return (
    <>
      <div className="skill-head">
        <span className="section-label" style={{ margin: 0 }}>
          Points {used}/{SKILL_POINTS}
        </span>
        <button className="mini-btn" onClick={respec} disabled={used === 0}>
          Respec
        </button>
      </div>
      <div className="skill-grid">
        {SKILL_NODES.map((n) => {
          const on = !!skills[n.id];
          const locked = full && !on;
          return (
            <button
              key={n.id}
              className={`skill ${on ? 'on' : ''} ${locked ? 'locked' : ''}`}
              disabled={locked}
              onClick={() => allocate(n.id)}
              title={n.desc}
            >
              <span className="skill-ico">{n.icon}</span>
              <span className="skill-name">{n.name}</span>
              <span className="skill-desc">{n.desc}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
