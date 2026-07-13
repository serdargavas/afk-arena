import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { META_NODES, nextNodeCost, CLASS_LIST } from '../game';
import { formatNum } from './format';
import { SkillTree } from './SkillTree';
import { Equipment } from './Equipment';

type Tab = 'meta' | 'skills' | 'gear';

export function RebirthScreen({ onClose, initialTab = 'meta' }: { onClose: () => void; initialTab?: Tab }) {
  useGameStore((s) => s.screenVersion);
  const save = useGameStore((s) => s.save);
  const buy = useGameStore((s) => s.actions.buyNode);
  const selectClass = useGameStore((s) => s.actions.selectClass);
  const rebirth = useGameStore((s) => s.actions.rebirth);
  const essenceIfRebirth = useGameStore((s) => s.essenceIfRebirth);
  const stage = useGameStore((s) => s.stage);
  const phase = useGameStore((s) => s.phase);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);
  if (!save) return null;
  const meta = save.meta;
  const dead = phase === 'dead';

  return (
    <div className="modal-backdrop">
      <div className="modal sheet">
        <div className="sheet-head">
          <span className="modal-title">🌳 Character</span>
          <span className="essence-pill">◆ {formatNum(meta.essence)}</span>
          <button className="tb-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="tab-row">
          <button className={`tab ${tab === 'meta' ? 'sel' : ''}`} onClick={() => setTab('meta')}>
            Meta
          </button>
          <button className={`tab ${tab === 'skills' ? 'sel' : ''}`} onClick={() => setTab('skills')}>
            Skills
          </button>
          <button className={`tab ${tab === 'gear' ? 'sel' : ''}`} onClick={() => setTab('gear')}>
            Gear
          </button>
        </div>

        <div className="sheet-body">
          {tab === 'meta' && (
            <>
              <div className="section-label">
                Class · best stage {meta.bestStage} · rebirths {meta.totalRebirths}
              </div>
              <div className="class-row">
                {CLASS_LIST.map((c) => {
                  const unlocked = meta.unlockedClasses.includes(c.id);
                  const sel = meta.selectedClass === c.id;
                  return (
                    <button
                      key={c.id}
                      disabled={!unlocked}
                      className={`class-chip ${sel ? 'sel' : ''} ${unlocked ? '' : 'locked'}`}
                      onClick={() => selectClass(c.id)}
                      title={c.blurb}
                    >
                      <span className="class-ico">{c.icon}</span>
                      <span>{unlocked ? c.name : '🔒'}</span>
                    </button>
                  );
                })}
              </div>

              <div className="section-label">Upgrades</div>
              <div className="node-list">
                {META_NODES.map((n) => {
                  const lvl = meta.nodes[n.id] ?? 0;
                  const cost = nextNodeCost(save, n.id);
                  const maxed = cost === null;
                  const afford = cost !== null && meta.essence >= cost;
                  return (
                    <button
                      key={n.id}
                      className={`node ${maxed ? 'maxed' : afford ? 'afford' : 'poor'}`}
                      disabled={maxed || !afford}
                      onClick={() => buy(n.id)}
                    >
                      <span className="node-ico">{n.icon}</span>
                      <span className="node-main">
                        <span className="node-name">
                          {n.name} <span className="node-lvl">{lvl}/{n.maxLevel}</span>
                        </span>
                        <span className="node-desc">{n.desc}</span>
                      </span>
                      <span className="node-cost">{maxed ? 'MAX' : `◆${formatNum(cost!)}`}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {tab === 'skills' && <SkillTree />}
          {tab === 'gear' && <Equipment />}
        </div>

        {tab === 'meta' && (
          <div className="sheet-foot">
            <div className="rebirth-hint">
              {dead
                ? 'This run already ended — its essence is banked. Close and hit New Run to dive back in. Rebirth is only for cashing out an active run.'
                : `Rebirth ends this run (now stage ${stage}) and banks essence to buy permanent upgrades. Push as far as you can, then rebirth stronger.`}
            </div>
            {dead ? (
              <button className="modal-btn danger" disabled>
                Rebirth · run already ended
              </button>
            ) : confirm ? (
              <div className="confirm-row">
                <span>End run for +{formatNum(essenceIfRebirth)} ◆?</span>
                <button className="modal-btn danger" onClick={() => { rebirth(); onClose(); }}>
                  Yes
                </button>
                <button className="modal-btn ghost" onClick={() => setConfirm(false)}>
                  No
                </button>
              </div>
            ) : (
              <button className="modal-btn danger" onClick={() => setConfirm(true)}>
                Rebirth Now · +{formatNum(essenceIfRebirth)} ◆
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
