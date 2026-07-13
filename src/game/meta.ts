import { META_BY_ID, nodeCost } from './content/metaNodes';
import { CLASSES } from './content/classes';
import { SKILL_BY_ID, SKILL_NODES } from './content/skills';
import { SKILL_POINTS } from './constants';
import type { GameSave, ClassId, SlotId } from './types';

/** Cost of the next level of a meta node (or null if maxed). */
export function nextNodeCost(save: GameSave, nodeId: string): number | null {
  const def = META_BY_ID[nodeId];
  if (!def) return null;
  const cur = save.meta.nodes[nodeId] ?? 0;
  if (cur >= def.maxLevel) return null;
  return nodeCost(def, cur);
}

/** Attempt to buy one level of a meta node. Returns true on success. */
export function buyNode(save: GameSave, nodeId: string): boolean {
  const def = META_BY_ID[nodeId];
  if (!def) return false;
  const cur = save.meta.nodes[nodeId] ?? 0;
  if (cur >= def.maxLevel) return false;
  const cost = nodeCost(def, cur);
  if (save.meta.essence < cost) return false;
  save.meta.essence -= cost;
  save.meta.nodes[nodeId] = cur + 1;
  if (def.unlockClass && !save.meta.unlockedClasses.includes(def.unlockClass)) {
    save.meta.unlockedClasses.push(def.unlockClass);
  }
  return true;
}

/** Select a class for the next run (must be unlocked). */
export function selectClass(save: GameSave, classId: ClassId): boolean {
  if (!(classId in CLASSES)) return false;
  if (!save.meta.unlockedClasses.includes(classId)) return false;
  save.meta.selectedClass = classId;
  return true;
}

/** Number of skill nodes currently allocated (cap is SKILL_POINTS). */
export function skillsAllocated(save: GameSave): number {
  let n = 0;
  for (const id in save.meta.skills) if (save.meta.skills[id] > 0) n++;
  return n;
}

/** Toggle a skill node, PoE-style: allocating requires the prereq (one step
 *  toward the centre) and refunding is blocked while a child depends on it —
 *  chains grow and shrink from the tips. */
export function allocateSkill(save: GameSave, id: string): boolean {
  const node = SKILL_BY_ID[id];
  if (!node) return false;
  if (save.meta.skills[id] > 0) {
    const orphans = SKILL_NODES.some((n) => n.prereq === id && save.meta.skills[n.id] > 0);
    if (orphans) return false;
    delete save.meta.skills[id];
    return true;
  }
  if (skillsAllocated(save) >= SKILL_POINTS) return false;
  if (node.prereq && !(save.meta.skills[node.prereq] > 0)) return false;
  save.meta.skills[id] = 1;
  return true;
}

/** Clear all allocated skills (free respec). */
export function respecSkills(save: GameSave): void {
  save.meta.skills = {};
}

/** Equip an owned item into its slot (replacing whatever was there). */
export function equipItem(save: GameSave, uid: number): boolean {
  const item = save.meta.inventory.find((it) => it.uid === uid);
  if (!item) return false;
  save.meta.equipped[item.slot] = uid;
  return true;
}

/** Clear a slot. */
export function unequipItem(save: GameSave, slot: SlotId): void {
  save.meta.equipped[slot] = null;
}
