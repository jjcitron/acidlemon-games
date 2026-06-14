export const ACTOR_CAPS = {
  enemies: 34,
  obstacles: 22,
  pickups: 12
};

export const EXTRA_LIFE_STAGE_CADENCE = 3;

export const PICKUP_WEIGHTS = [
  { type: 'multishot', weight: 22 },
  { type: 'laser', weight: 21 },
  { type: 'bomb', weight: 15 },
  { type: 'health', weight: 12 },
  { type: 'speed', weight: 12 },
  { type: 'slow', weight: 11 },
  { type: 'invincible', weight: 7 }
];

export const PICKUP_WEIGHT_BANDS = {
  opening: [
    { type: 'multishot', weight: 28 },
    { type: 'laser', weight: 24 },
    { type: 'bomb', weight: 10 },
    { type: 'health', weight: 14 },
    { type: 'speed', weight: 14 },
    { type: 'slow', weight: 6 },
    { type: 'invincible', weight: 4 }
  ],
  'mid campaign': [
    { type: 'multishot', weight: 24 },
    { type: 'laser', weight: 23 },
    { type: 'bomb', weight: 14 },
    { type: 'health', weight: 13 },
    { type: 'speed', weight: 12 },
    { type: 'slow', weight: 8 },
    { type: 'invincible', weight: 6 }
  ],
  escalation: [
    { type: 'multishot', weight: 21 },
    { type: 'laser', weight: 22 },
    { type: 'bomb', weight: 18 },
    { type: 'health', weight: 12 },
    { type: 'speed', weight: 10 },
    { type: 'slow', weight: 9 },
    { type: 'invincible', weight: 8 }
  ],
  'late campaign': [
    { type: 'multishot', weight: 18 },
    { type: 'laser', weight: 20 },
    { type: 'bomb', weight: 23 },
    { type: 'health', weight: 13 },
    { type: 'speed', weight: 8 },
    { type: 'slow', weight: 9 },
    { type: 'invincible', weight: 9 }
  ],
  finale: [
    { type: 'multishot', weight: 16 },
    { type: 'laser', weight: 18 },
    { type: 'bomb', weight: 28 },
    { type: 'health', weight: 14 },
    { type: 'speed', weight: 6 },
    { type: 'slow', weight: 8 },
    { type: 'invincible', weight: 10 }
  ]
};

export const QA_PERFORMANCE_LIMITS = {
  minFps: 20,
  maxEnemyProjectiles: 120,
  maxPlayerProjectiles: 90,
  minCampaignStages: 18,
  minBossRushBosses: 5,
  maxEnduranceGeometryGrowth: 18,
  maxEnduranceTextureGrowth: 8
};

export function getPickupWeightsForStage(stageDef = {}) {
  if (stageDef.mode === 'bonus') return PICKUP_WEIGHT_BANDS.opening;
  const band = stageDef.metadata?.difficultyBand || bandForStageId(stageDef.id);
  return PICKUP_WEIGHT_BANDS[band] || PICKUP_WEIGHTS;
}

function bandForStageId(id) {
  const n = Number(id) || 1;
  if (n >= 18) return 'finale';
  if (n >= 13) return 'late campaign';
  if (n >= 9) return 'escalation';
  if (n >= 6) return 'mid campaign';
  return 'opening';
}

export function pickWeighted(entries, random = Math.random) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
  if (total <= 0) return entries[0]?.type || null;
  let cursor = random() * total;
  for (const entry of entries) {
    cursor -= Math.max(0, Number(entry.weight) || 0);
    if (cursor <= 0) return entry.type;
  }
  return entries[entries.length - 1]?.type || null;
}
