import { META_BY_ID, nodeCost } from './content/metaNodes';
import { CLASSES } from './content/classes';
import type { GameSave, ClassId } from './types';

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
