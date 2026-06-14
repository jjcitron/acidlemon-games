export const LEVEL_SCHEMA_VERSION = 1;

export const EDITOR_CATALOG = {
  objects: [
    item('rock', 'Rock'),
    item('mushroom', 'Mushroom'),
    item('deadTree', 'Dead Tree'),
    item('tree', 'Tree'),
    item('column', 'Column'),
    item('idaHead', 'Ida Head'),
    item('binzubin', 'Binzubin'),
    item('underpass', 'Underpass'),
    item('bridge', 'Bridge'),
    item('tunnelRing', 'Tunnel Ring'),
    item('skyscraper', 'Skyscraper'),
    item('archway', 'Archway')
  ],
  items: [
    item('multishot', 'Multishot'),
    item('laser', 'Laser'),
    item('bomb', 'Bomb'),
    item('health', 'Health'),
    item('speed', 'Speed'),
    item('slow', 'Slow'),
    item('invincible', 'Shield')
  ],
  enemies: [
    item('mammoth', 'Mammoth'),
    item('mukadensu', 'Mukadensu'),
    item('tomos', 'Tomos'),
    item('skegg', 'Skegg'),
    item('canary', 'Canary'),
    item('looper', 'Looper'),
    item('pakomen', 'Pakomen'),
    item('fighterJet', 'Fighter Jet'),
    item('droneHeavy', 'Heavy Drone'),
    item('shieldCarrier', 'Shield Carrier'),
    item('laneDiver', 'Lane Diver'),
    item('mineLayer', 'Mine Layer'),
    item('splitter', 'Splitter'),
    item('sniperDrone', 'Sniper Drone')
  ],
  turns: [
    item('turnLeft', 'Turn Left'),
    item('turnRight', 'Turn Right')
  ]
};

export const EDITOR_THEMES = [
  'moot', 'geeza', 'amar', 'ceiciel', 'bonus', 'olisis', 'lucasia', 'ida',
  'stalactite', 'neonDesert', 'frost', 'ash', 'biomech', 'temple', 'finalvoid',
  'cityscape', 'metropolis', 'underdeep', 'highway', 'neoncity', 'duskbridge'
];

const DEFAULT_PROCEDURAL = {
  enemyDensity: 1,
  obstacleDensity: 1,
  pickupDensity: 1,
  speedScale: 1.12,
  formations: ['line', 'v', 'arc', 'single']
};

export function createBlankLevel(overrides = {}) {
  const now = new Date().toISOString();
  return normalizeLevel({
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id: makeLevelId(),
    name: 'Untitled Level',
    musicTrack: 1,
    theme: 'moot',
    duration: 60,
    procedural: { ...DEFAULT_PROCEDURAL },
    map: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  });
}

export function normalizeLevel(level = {}) {
  const now = new Date().toISOString();
  const id = cleanString(level.id) || makeLevelId();
  const name = cleanString(level.name) || 'Untitled Level';
  const duration = clampNumber(level.duration, 30, 180, 60);
  const musicTrack = Math.round(clampNumber(level.musicTrack, 1, 24, 1));
  // splashImage can be a data: URL (potentially very large) - skip cleanString limits
  const splashImage = (typeof level.splashImage === 'string' && level.splashImage.length) ? level.splashImage : null;
  const theme = EDITOR_THEMES.includes(level.theme) ? level.theme : 'moot';
  const procedural = normalizeProcedural(level.procedural);
  const map = Array.isArray(level.map) ? level.map.map(normalizeAnchor).filter(Boolean) : [];

  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    id,
    name,
    musicTrack,
    theme,
    duration,
    procedural,
    map,
    splashImage,
    createdAt: cleanString(level.createdAt) || now,
    updatedAt: cleanString(level.updatedAt) || now
  };
}

export function levelToStageDef(level) {
  const normalized = normalizeLevel(level);
  const enemyWeights = anchorsToWeights(normalized.map, 'enemy', 2);
  const objectWeights = anchorsToWeights(normalized.map, 'object', 1);
  const hasObjects = objectWeights.length > 0;

  return {
    id: `custom:${normalized.id}`,
    custom: true,
    name: normalized.name,
    duration: normalized.duration,
    musicTrack: normalized.musicTrack,
    worldTheme: normalized.theme,
    sceneryTypes: objectWeights.length ? objectWeights.map(entry => entry.type) : ['rock', 'column'],
    speedScale: normalized.procedural.speedScale,
    spawn: {
      intervalBase: Math.max(0.48, 1.28 / normalized.procedural.enemyDensity),
      intervalMin: Math.max(0.22, 0.42 / normalized.procedural.enemyDensity),
      enemyTypes: enemyWeights.length ? enemyWeights : [{ type: 'mammoth', weight: 1 }],
      formations: normalized.procedural.formations,
      speedMin: 42,
      speedMax: 92
    },
    obstacles: {
      enabled: hasObjects,
      firstDelay: 2.2,
      intervalBase: Math.max(1.1, 2.4 / normalized.procedural.obstacleDensity),
      intervalMin: Math.max(0.8, 1.2 / normalized.procedural.obstacleDensity),
      lanes: [-18, -10, 0, 10, 18],
      speedMin: 86,
      speedMax: 136,
      entries: objectWeights.length ? objectWeights.map(entry => ({ ...entry, y: objectY(entry.type) })) : []
    },
    pickups: {
      firstMin: Math.max(4, 9 / normalized.procedural.pickupDensity),
      firstMax: Math.max(6, 14 / normalized.procedural.pickupDensity),
      intervalMin: Math.max(5, 12 / normalized.procedural.pickupDensity),
      intervalMax: Math.max(7, 18 / normalized.procedural.pickupDensity)
    },
    nextStageId: null,
    course: customCourse(normalized),
    editorLevel: normalized,
    mapAnchors: normalized.map,
    splashImage: normalized.splashImage || null
  };
}

function item(id, label) {
  return { id, label };
}

function normalizeProcedural(procedural = {}) {
  const formations = Array.isArray(procedural.formations) && procedural.formations.length
    ? procedural.formations.filter(f => ['line', 'v', 'arc', 'single'].includes(f))
    : DEFAULT_PROCEDURAL.formations;
  return {
    enemyDensity: clampNumber(procedural.enemyDensity, 0.35, 2.5, DEFAULT_PROCEDURAL.enemyDensity),
    obstacleDensity: clampNumber(procedural.obstacleDensity, 0.25, 2.5, DEFAULT_PROCEDURAL.obstacleDensity),
    pickupDensity: clampNumber(procedural.pickupDensity, 0.25, 2.5, DEFAULT_PROCEDURAL.pickupDensity),
    speedScale: clampNumber(procedural.speedScale, 0.55, 1.8, DEFAULT_PROCEDURAL.speedScale),
    formations: formations.length ? formations : DEFAULT_PROCEDURAL.formations
  };
}

function normalizeAnchor(anchor = {}) {
  const kind = cleanString(anchor.kind);
  if (!['object', 'item', 'enemy', 'turn'].includes(kind)) return null;
  const type = cleanString(anchor.type);
  if (!type) return null;

  if (kind === 'turn') {
    return {
      id: cleanString(anchor.id) || makeAnchorId(),
      kind: 'turn',
      type: type, // 'turnLeft' or 'turnRight'
      direction: type.includes('Left') ? 'left' : 'right',
      strength: clampNumber(anchor.strength, 0.5, 8, 4.5),
      duration: clampNumber(anchor.duration, 1, 12, 6),
      x: clampNumber(anchor.x, -1, 1, 0),
      y: clampNumber(anchor.y, 0, 1, 0.5)
    };
  }

  return {
    id: cleanString(anchor.id) || makeAnchorId(),
    kind,
    type,
    x: clampNumber(anchor.x, -1, 1, 0),
    y: clampNumber(anchor.y, 0, 1, 0.5),
    weight: clampNumber(anchor.weight, 0.25, 6, 1),
    lane: Number.isFinite(Number(anchor.lane)) ? Number(anchor.lane) : null
  };
}

function anchorsToWeights(anchors, kind, fallbackWeight) {
  const totals = new Map();
  for (const anchor of anchors) {
    if (anchor.kind !== kind) continue;
    totals.set(anchor.type, (totals.get(anchor.type) || 0) + (anchor.weight || fallbackWeight));
  }
  return [...totals.entries()].map(([type, weight]) => ({ type, weight: Number(weight.toFixed(2)) }));
}

function customCourse(level) {
  return {
    amplitude: 1.8 + level.procedural.speedScale * 0.65,
    frequency: 0.0052,
    secondaryAmplitude: 0.22,
    secondaryFrequency: 0.0096,
    phase: level.musicTrack * 0.71,
    travelScale: 0.16
  };
}

function objectY(type) {
  if (type === 'column' || type === 'binzubin' || type === 'idaHead') return 2;
  if (type === 'rock' || type === 'mushroom') return -6;
  return -4;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function makeLevelId() {
  return `level-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeAnchorId() {
  return `anchor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
