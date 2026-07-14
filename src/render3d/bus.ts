// Tiny typed pub/sub so the (render-agnostic) game loop can push combat juice to
// whichever renderer is mounted — the R3F scene subscribes to these.
export interface HitEvent {
  damage: number;
  crit: boolean;
  double?: boolean; // double crit — rolled when crit chance overflows past 100%
  heal?: number; // HP actually gained from lifesteal on this hit (0 if none / at full HP)
  miss?: boolean; // the swing whiffed — no damage, no impact juice
}
export interface HurtEvent {
  damage: number;
  miss?: boolean;
}
export interface KillEvent {
  gold: number;
}

interface Events {
  hit: HitEvent; // the SIM landed a blow (damage applied, HP updated) — drives the hero's swing
  contact: HitEvent; // the hero's blade actually reaches the strike frame — drives all impact FX
  hurt: HurtEvent;
  kill: KillEvent;
}
type Handler<T> = (e: T) => void;

class CombatBus {
  private readonly hs: { [K in keyof Events]: Set<Handler<Events[K]>> } = {
    hit: new Set(),
    contact: new Set(),
    hurt: new Set(),
    kill: new Set(),
  };

  on<K extends keyof Events>(k: K, h: Handler<Events[K]>): () => void {
    const set = this.hs[k] as Set<Handler<Events[K]>>;
    set.add(h);
    return () => set.delete(h);
  }

  emit<K extends keyof Events>(k: K, e: Events[K]): void {
    (this.hs[k] as Set<Handler<Events[K]>>).forEach((h) => h(e));
  }
}

export const combatBus = new CombatBus();
