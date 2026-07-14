import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { SKILL_NODES, SKILL_BY_ID, SKILL_POINTS, skillsAllocated } from '../game';

// PoE-style passive constellation: 9 branches radiate from the class start.
// Lines light up as their chains are taken; nodes gate on their prereq.
const VB = 440;
const CENTER = VB / 2;

export function SkillTree() {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  const allocate = useGameStore((s) => s.actions.allocateSkill);
  const respec = useGameStore((s) => s.actions.respecSkills);
  const [hovered, setHovered] = useState<string | null>(null);
  if (!save) return null;

  const skills = save.meta.skills;
  const used = skillsAllocated(save);
  const full = used >= SKILL_POINTS;
  const isOn = (id: string) => !!skills[id];
  const canTake = (id: string) => {
    const n = SKILL_BY_ID[id];
    return !full && (!n.prereq || isOn(n.prereq));
  };
  const hasChildOn = (id: string) => SKILL_NODES.some((n) => n.prereq === id && isOn(n.id));

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
      <svg className="skill-tree" viewBox={`0 0 ${VB} ${VB}`}>
        {/* faint orbit rings for the constellation feel */}
        {[68, 118, 168, 208].map((r) => (
          <circle key={r} cx={CENTER} cy={CENTER} r={r} className="tree-ring" />
        ))}

        {/* edges: centre → branch roots, prereq → node */}
        {SKILL_NODES.map((n) => {
          const from = n.prereq ? SKILL_BY_ID[n.prereq] : { x: CENTER, y: CENTER };
          const lit = isOn(n.id) && (!n.prereq || isOn(n.prereq));
          return (
            <line
              key={`e-${n.id}`}
              x1={from.x}
              y1={from.y}
              x2={n.x}
              y2={n.y}
              className={`tree-edge ${lit ? 'lit' : ''}`}
            />
          );
        })}

        {/* class start */}
        <circle cx={CENTER} cy={CENTER} r={13} className="tree-start" />
        <text x={CENTER} y={CENTER + 1} className="tree-start-ico">
          ⭐
        </text>

        {/* nodes */}
        {SKILL_NODES.map((n) => {
          const on = isOn(n.id);
          const takeable = !on && canTake(n.id);
          const refundable = on && !hasChildOn(n.id);
          const cls = on ? 'on' : takeable ? 'open' : 'locked';
          const deep = !SKILL_NODES.some((c) => c.prereq === n.id); // branch tip
          return (
            <g
              key={n.id}
              className={`tree-node ${cls} ${on && !refundable ? 'held' : ''}`}
              onClick={() => (on ? refundable && allocate(n.id) : takeable && allocate(n.id))}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered((h) => (h === n.id ? null : h))}
            >
              <circle cx={n.x} cy={n.y} r={deep ? 17 : 15} className="tree-node-ring" />
              <circle cx={n.x} cy={n.y} r={deep ? 14 : 12} className="tree-node-fill" />
              <text x={n.x} y={n.y + 1} className="tree-node-ico">
                {n.icon}
              </text>
            </g>
          );
        })}
      </svg>
      {(() => {
        const n = hovered ? SKILL_BY_ID[hovered] : null;
        if (!n) {
          return <div className="tree-hint">Chains grow from the centre · tap an allocated tip to refund</div>;
        }
        const on = isOn(n.id);
        const status = on
          ? hasChildOn(n.id)
            ? 'Allocated — refund its children first'
            : 'Allocated — click to refund'
          : canTake(n.id)
            ? 'Click to allocate'
            : n.prereq && !isOn(n.prereq)
              ? `Requires ${SKILL_BY_ID[n.prereq].name}`
              : 'No points left';
        return (
          <div className="tree-info">
            <span className="tree-info-ico">{n.icon}</span>
            <div className="tree-info-mid">
              <span className="tree-info-name">{n.name}</span>
              <span className="tree-info-desc">{n.desc}</span>
            </div>
            <span className={`tree-info-status ${on ? 'on' : ''}`}>{status}</span>
          </div>
        );
      })()}
    </>
  );
}
