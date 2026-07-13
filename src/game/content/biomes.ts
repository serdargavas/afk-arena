// Biomes are purely cosmetic in the sim (palette + enemy flavor); difficulty is
// driven by stage number. The renderer reads the palette; the biome cycles every
// BIOME_STAGES stages, escalating in "tier" as it wraps.

export interface BiomeDef {
  name: string;
  enemyName: string;
  // canvas palette
  sky: string;
  sky2: string;
  ground: string;
  groundTop: string;
  enemy: string;
  enemyDk: string;
}

export const BIOMES: BiomeDef[] = [
  {
    name: 'Verdant Hollow',
    enemyName: 'Slime',
    sky: '#0e1f16',
    sky2: '#1c3a28',
    ground: '#20301c',
    groundTop: '#3f5a2c',
    enemy: '#6ddf7a',
    enemyDk: '#2f8f3c',
  },
  {
    name: 'Ember Wastes',
    enemyName: 'Imp',
    sky: '#25100c',
    sky2: '#4a1c12',
    ground: '#331a12',
    groundTop: '#5a3320',
    enemy: '#ff7a45',
    enemyDk: '#b3341c',
  },
  {
    name: 'Frostspire',
    enemyName: 'Wraith',
    sky: '#0d1830',
    sky2: '#1c2f58',
    ground: '#1a2338',
    groundTop: '#2f456b',
    enemy: '#7ac6ff',
    enemyDk: '#2f74c4',
  },
  {
    name: 'Void Reach',
    enemyName: 'Horror',
    sky: '#180f2a',
    sky2: '#2f1c50',
    ground: '#231a38',
    groundTop: '#432c6b',
    enemy: '#c77aff',
    enemyDk: '#7a2fc4',
  },
];

export function biomeForStage(stage: number, biomeStages: number): BiomeDef {
  const idx = Math.floor((stage - 1) / biomeStages) % BIOMES.length;
  return BIOMES[idx];
}
