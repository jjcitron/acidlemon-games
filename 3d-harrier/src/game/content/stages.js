export const STAGE_THEMES = {
  moot: theme(0xb56a42, 42, 235, 0x031032, 0x7a2f52, 0xb56a42, '#083b2c', '#29b34c', 0xa68ad0, 0x24130a, 0.42, 0xffd08a, 1.18),
  geeza: theme(0xc68343, 44, 240, 0x071d3a, 0x8a3e2e, 0xc68343, '#5a351b', '#d8a04a', 0x9bb8e8, 0x351b08, 0.44, 0xffdc9a, 1.22),
  amar: theme(0x7c376c, 38, 220, 0x090d2e, 0x55204f, 0x7c376c, '#143b24', '#77a13b', 0xc09ee0, 0x14230c, 0.42, 0xffb070, 1.05),
  ceiciel: theme(0x223965, 30, 198, 0x020711, 0x102d57, 0x4d6078, '#11192f', '#5c76a5', 0x88a8e8, 0x0d1422, 0.38, 0xc8dcff, 0.92),
  bonus: theme(0xb6d27a, 52, 270, 0x15365a, 0x60a078, 0xb6d27a, '#177d32', '#49ba55', 0xaee7ff, 0x234018, 0.45, 0xffffb0, 1.15),
  olisis: theme(0x5b2f9c, 34, 220, 0x040012, 0x30125f, 0x5b2f9c, '#0e193c', '#6844b8', 0xb0a0ff, 0x0b081a, 0.40, 0xd8b8ff, 1.05),
  lucasia: theme(0x86b8d6, 40, 240, 0x03101d, 0x174c6e, 0x86b8d6, '#172f3e', '#8fd3e8', 0xd0f4ff, 0x0e1d24, 0.44, 0xe8fbff, 1.12),
  ida: theme(0x78614e, 32, 210, 0x08040b, 0x362636, 0x78614e, '#211713', '#91785f', 0xa698b0, 0x120b08, 0.38, 0xffc088, 1.0),
  stalactite: theme(0x466c78, 28, 190, 0x02070d, 0x16323c, 0x466c78, '#07141c', '#2e7580', 0x9fd8e8, 0x061316, 0.34, 0xb8f4ff, 1.0),
  neonDesert: theme(0xd48a3a, 48, 255, 0x050016, 0x6a2458, 0xd48a3a, '#24120a', '#cc7738', 0xffb6c8, 0x251106, 0.43, 0xffa45c, 1.24),
  frost: theme(0xa8d8ff, 46, 260, 0x021026, 0x315c88, 0xa8d8ff, '#173352', '#b7e6ff', 0xe4f8ff, 0x102235, 0.47, 0xffffff, 1.18),
  ash: theme(0x9a5142, 34, 225, 0x060408, 0x401b22, 0x9a5142, '#160c0b', '#743326', 0xd0a0a0, 0x140808, 0.35, 0xff9a64, 1.05),
  biomech: theme(0x42a09a, 30, 215, 0x000b10, 0x073044, 0x42a09a, '#061b1a', '#2fae91', 0x9fffea, 0x04130f, 0.42, 0x80fff0, 1.16),
  temple: theme(0xc2a15f, 36, 238, 0x090711, 0x47302b, 0xc2a15f, '#21160b', '#a77d3d', 0xffdfaa, 0x1c1208, 0.40, 0xffd18a, 1.12),
  finalvoid: theme(0x090212, 26, 200, 0x000004, 0x10001f, 0x4d0735, '#07030b', '#3f1158', 0x7d55aa, 0x030105, 0.34, 0xff6688, 1.28),
  cityscape: theme(0x1a1525, 32, 230, 0x060410, 0x251b3a, 0x4a3a5a, '#0e0a18', '#5a4070', 0xaa88dd, 0x110a20, 0.38, 0xff88cc, 1.18),
  metropolis: theme(0x2a1a1a, 30, 220, 0x0a0405, 0x401820, 0x6a3838, '#1a0c10', '#8a4848', 0xffaa88, 0x1c0a0e, 0.40, 0xffaa77, 1.20),
  underdeep: theme(0x0a1820, 24, 195, 0x020608, 0x081c2a, 0x224050, '#04101a', '#3a6a82', 0x66ccff, 0x040c14, 0.36, 0xaaeeff, 1.10),
  highway: theme(0x331020, 34, 245, 0x080208, 0x281030, 0x6a2845, '#160a14', '#a04268', 0xff99cc, 0x1a0810, 0.42, 0xffbbdd, 1.25),
  neoncity: theme(0x081020, 28, 215, 0x020410, 0x10185a, 0x2a3aaa, '#0a1430', '#3a55cc', 0xaaccff, 0x080c20, 0.45, 0xaaffff, 1.30),
  duskbridge: theme(0x884a3a, 38, 248, 0x180810, 0x6a2845, 0xc25548, '#3a1a14', '#cc7044', 0xffccaa, 0x281008, 0.46, 0xffaa77, 1.22)
};

function theme(fogColor, fogNear, fogFar, skyTop, skyMid, skyBottom, groundA, groundB, hemiSky, hemiGround, hemiIntensity, sunColor, sunIntensity) {
  return {
    fogColor,
    fogNear: Math.round(fogNear * 1.7 + 28),
    fogFar: Math.round(fogFar * 1.55 + 75),
    skyTop,
    skyMid,
    skyBottom,
    groundA,
    groundB,
    light: { hemiSky, hemiGround, hemiIntensity, sunColor, sunIntensity }
  };
}

const commonPickups = { firstMin: 7, firstMax: 12, intervalMin: 10, intervalMax: 16 };
const sparsePickups = { firstMin: 10, firstMax: 15, intervalMin: 13, intervalMax: 19 };
const finalBossRush = [
  { id: 'godarni', name: 'GODARNI', musicTrack: 8 },
  { id: 'shura', name: 'SHURA MIRROR', musicTrack: 8 },
  { id: 'domWave', name: 'DOM CRUCIBLE', musicTrack: 8 },
  { id: 'lowrys', name: 'LOWRYS SWARM', musicTrack: 8 },
  { id: 'tetras', name: 'TETRA PROCESSION', musicTrack: 8 },
  { id: 'carrier', name: 'STANLEY CARRIER', musicTrack: 8 },
  { id: 'wiwi', name: 'WI WI JUMBO PRIME', musicTrack: 8, final: true }
];

export const STAGE_MEDIA = {
  // Per-level music and splash art from /sound. Track assignments were chosen
  // from the dropped audio by matching tempo/brightness/energy and title cues
  // to each level's pacing/theme instead of relying on the saved filenames.
  1:  media('Across the Razor Ridge', 'sound/Arcade Horizon.mp3', 'sound/across razor ridge (2).png'),
  2:  media('Apex Breach', 'sound/Midnight_Apex.mp3', 'sound/apex breach (2).png'),
  3:  media('Over the Precipice', 'sound/Turbo_Ascent.mp3', 'sound/over the prcipice 2.png'),
  4:  media('Storm at the Gates', 'sound/__Gated Thunder__ (1).mp3', 'sound/storm the gates.png'),
  5:  media('Iron Velocity', 'sound/Velocity_Shift.mp3', 'sound/Iron Velocity.png'),
  6:  media('Storming the Citadel', 'sound/Brass Arcade (1).mp3', 'sound/storming the cidadel.png'),
  7:  media('Siege at Iron Gate', 'sound/__Gated Thunder__.mp3', 'sound/seige at teh iron gate.png'),
  8:  media('Redline Horizon', 'sound/The_Last_Quarter.mp3', 'sound/redline hoirizon.png'),
  9:  media('Ash Vector', 'sound/Caldera_Run.mp3', 'sound/ash vector.png'),
  10: media('Frost Needle', 'sound/Circuit Siren (1).mp3', 'sound/frost needle.png'),
  11: media('Biomech Maw', 'sound/Living Machine Gullet.mp3', 'sound/biomech_maw.png'),
  12: media('Crystal Breakaway', 'sound/Gold_Coin_Rush.mp3', 'sound/crystal breakaway.png'),
  13: media('Temple Run', 'sound/Pharaoh_s_Drift.mp3', 'sound/temple run.png'),
  14: media('Stalactite Gate', 'sound/Dripping Arcade Trance.mp3', 'sound/stalagtite gate.png'),
  15: media('Ida Crucible', 'sound/Chromed Majesty (2).mp3', 'sound/ida_crucible.png'),
  16: media('Neon Desert', 'sound/Sandstorm_Pursuit.mp3', 'sound/neon desert.png'),
  17: media('Void Procession', 'sound/Sub-Bass Metro (2).mp3', 'sound/void procession.png'),
  18: media('Citadel Horizon', 'sound/Chromed Majesty.mp3', 'sound/cidadel hiorizon.png'),
  19: media('Skyline Sprint', 'sound/Arcade Horizon (2).mp3', 'sound/skyline_sprint.png'),
  20: media('Underpass Run', 'sound/Sub-Bass Metro.mp3', 'sound/underpass run.png'),
  21: media('Crosstown Bridge', 'sound/Concrete Acceleration.mp3', 'sound/crosstown bridge.png'),
  22: media('Neon Ring Run', 'sound/Quarter_Stolen.mp3', 'sound/neon_ring_run.png'),
  23: media('Metropolis Vector', 'sound/Pixel Thunder.mp3', 'sound/metropolis.png'),
  24: media('Highway to Zero', 'sound/Final_Descent.mp3', 'sound/highway to zero.png')
};

export const STAGES = [
  stage(1, 'Across the Razor Ridge', 55, 1, 'moot', ['palm'], 1.00, ['mammoth:5', 'mukadensu:3', 'tomos:1'], ['line', 'v', 'arc', 'single'], null, { enabled: false }, 2),
  stage(2, 'Apex Breach', 58, 2, 'geeza', ['deadTree', 'rock', 'column', 'idaHead'], 1.06, ['skegg:4', 'tomos:2', 'mukadensu:2', 'pakomen:1'], ['line', 'v', 'single'], null, obstacles(['rock:4:-6', 'deadTree:3:-4', 'column:3:2', 'idaHead:2:1', 'archway:1:0'], 3, 1.8), 3),
  stage(3, 'Over the Precipice', 60, 3, 'amar', ['mushroom', 'tree', 'rock'], 1.12, ['canary:4', 'looper:3', 'mukadensu:2', 'pakomen:2'], ['arc', 'v', 'line', 'single'], { id: 'godarni', name: 'GODARNI', musicTrack: 6 }, obstacles(['mushroom:5:-5', 'tree:3:-2', 'rock:2:-6'], 2.8, 1.6), 4),
  stage(4, 'Storm at the Gates', 62, 4, 'ceiciel', ['column', 'binzubin'], 1.22, ['mukadensu:4', 'tomos:2', 'domBasic:2', 'fighterJet:2'], ['line', 'v', 'single'], { id: 'domWave', name: 'DOM WAVE', musicTrack: 6 }, { ...obstacles(['column:3:2', 'binzubin:5:1', 'binzubin:2:10'], 2.35, 1.25), lanes: [-16, -8, 0, 8, 16] }, 5, { ceiling: true, ceilingY: 20, ceilingPalette: ['#25304a', '#52617f'] }),
  bonusStage(5, 'Iron Velocity', 45, 5, 'bonus', ['palm', 'tree', 'rock'], 1.25, { targetSet: 'natural' }, 6),
  stage(6, 'Storming the Citadel', 65, 6, 'olisis', ['column', 'binzubin', 'rock'], 1.28, ['pakomen:4', 'fighterJet:3', 'domRed:2', 'lowrys:3', 'droneHeavy:1'], ['line', 'v', 'arc', 'single'], { id: 'lowrys', name: 'LOWRYS SWARM', musicTrack: 7 }, obstacles(['column:3:1', 'binzubin:3:4', 'rock:2:-6', 'bridge:1:0', 'tunnelRing:1:0'], 2.4, 1.3), 7),
  stage(7, 'Siege at Iron Gate', 68, 7, 'lucasia', ['rock', 'column', 'idaHead'], 1.34, ['domBasic:2', 'domBlue:3', 'domRed:2', 'tetra:4', 'octopus:2', 'fighterJet:2'], ['line', 'v', 'arc', 'single'], { id: 'tetras', name: 'TETRAS', musicTrack: 7 }, obstacles(['rock:3:-6', 'column:2:2', 'idaHead:3:1', 'binzubin:2:6'], 2.2, 1.2), 8),
  stage(8, 'Redline Horizon', 72, 8, 'finalvoid', ['idaHead', 'binzubin', 'column'], 1.40, ['domRed:3', 'domBlue:3', 'tetra:3', 'octopus:3', 'fighterJet:2', 'droneHeavy:2'], ['v', 'arc', 'line'], { id: 'wiwi', name: 'WI WI JUMBO', musicTrack: 8 }, obstacles(['binzubin:4:4', 'idaHead:3:2', 'column:2:2'], 2.0, 1.05), 9),
  stage(9, 'Ash Vector', 74, 9, 'ash', ['deadTree', 'rock', 'column'], 1.43, ['laneDiver:5', 'mineLayer:3', 'fighterJet:2', 'domRed:2'], ['line', 'single', 'v'], null, obstacles(['deadTree:3:-4', 'rock:3:-6', 'column:2:2'], 1.95, 1.0), 10),
  stage(10, 'Frost Needle', 76, 10, 'frost', ['rock', 'binzubin', 'column'], 1.46, ['sniperDrone:5', 'shieldCarrier:3', 'tetra:3', 'mukadensu:2'], ['arc', 'single', 'line'], { id: 'shura', name: 'SHURA MIRROR', musicTrack: 6 }, obstacles(['binzubin:4:5', 'column:2:2', 'rock:2:-6'], 1.9, 0.95), 11, { ceiling: true, ceilingY: 19, ceilingPalette: ['#173352', '#b7e6ff'] }),
  stage(11, 'Biomech Maw', 78, 11, 'biomech', ['binzubin', 'mushroom', 'idaHead'], 1.50, ['splitter:4', 'mineLayer:3', 'octopus:3', 'shieldCarrier:2'], ['v', 'arc', 'single'], null, obstacles(['binzubin:5:4', 'mushroom:3:-5', 'idaHead:2:1'], 1.8, 0.92), 12),
  bonusStage(12, 'Crystal Breakaway', 48, 12, 'bonus', ['tree', 'binzubin', 'rock'], 1.34, { targetSet: 'metallic' }, 13),
  stage(13, 'Temple Run', 80, 13, 'temple', ['column', 'idaHead', 'deadTree'], 1.54, ['shieldCarrier:4', 'sniperDrone:3', 'domBlue:3', 'laneDiver:3'], ['line', 'v', 'arc'], { id: 'godarni', name: 'GODARNI II', musicTrack: 7 }, obstacles(['column:4:2', 'idaHead:3:1', 'deadTree:2:-4', 'archway:2:0'], 1.75, 0.9), 14),
  stage(14, 'Stalactite Gate', 82, 14, 'stalactite', ['rock', 'column', 'binzubin'], 1.58, ['mineLayer:4', 'splitter:4', 'tetra:3', 'fighterJet:2'], ['arc', 'single', 'v'], null, obstacles(['column:3:2', 'binzubin:3:8', 'rock:2:-6'], 1.68, 0.86), 15, { ceiling: true, ceilingY: 17, ceilingPalette: ['#07141c', '#2e7580'] }),
  stage(15, 'Ida Crucible', 84, 15, 'ida', ['idaHead', 'column', 'rock'], 1.62, ['domRed:4', 'droneHeavy:3', 'sniperDrone:3', 'shieldCarrier:3'], ['line', 'v', 'single'], { id: 'domWave', name: 'DOM CRUCIBLE', musicTrack: 7 }, obstacles(['idaHead:5:2', 'column:3:2', 'rock:2:-6'], 1.62, 0.84), 16),
  stage(16, 'Neon Desert', 86, 16, 'neonDesert', ['palm', 'rock', 'binzubin'], 1.66, ['laneDiver:5', 'fighterJet:4', 'splitter:3', 'pakomen:2'], ['v', 'arc', 'line'], { id: 'carrier', name: 'STANLEY CARRIER', musicTrack: 7 }, obstacles(['rock:4:-6', 'binzubin:3:5', 'deadTree:2:-4', 'skyscraper:1:0'], 1.55, 0.82), 17),
  stage(17, 'Void Procession', 88, 17, 'finalvoid', ['binzubin', 'idaHead', 'column'], 1.70, ['shieldCarrier:4', 'mineLayer:4', 'sniperDrone:4', 'octopus:3', 'droneHeavy:2'], ['arc', 'v', 'single'], { id: 'tetras', name: 'TETRA PROCESSION', musicTrack: 8 }, obstacles(['binzubin:5:5', 'idaHead:3:2', 'column:2:2'], 1.5, 0.8), 18, { ceiling: true, ceilingY: 18, ceilingPalette: ['#07030b', '#3f1158'] }),
  stage(18, 'Citadel Horizon', 92, 18, 'finalvoid', ['idaHead', 'binzubin', 'column'], 1.76, ['laneDiver:4', 'shieldCarrier:4', 'splitter:4', 'sniperDrone:4', 'mineLayer:3', 'droneHeavy:3'], ['v', 'arc', 'line'], null, obstacles(['binzubin:5:5', 'idaHead:4:2', 'column:3:2'], 1.42, 0.78), 19, { ceiling: true, ceilingY: 18, ceilingPalette: ['#07030b', '#3f1158'] }, finalBossRush),

  // ---------- URBAN VECTOR ACT (Levels 19-24) ----------
  // Cityscape gauntlet - tunnel rings, bridges, underpasses, skyscrapers
  stage(19, 'Skyline Sprint', 70, 19, 'cityscape', ['column', 'binzubin'], 1.50, ['laneDiver:5', 'fighterJet:4', 'tomos:2'], ['line', 'v', 'single'], null, obstacles(['skyscraper:4:0', 'archway:2:0', 'column:2:2'], 1.85, 0.95), 20, { ceiling: true, ceilingY: 22, ceilingPalette: ['#0a0a1a', '#3a2a5a'] }),
  stage(20, 'Underpass Run', 68, 20, 'underdeep', ['column', 'binzubin', 'rock'], 1.54, ['sniperDrone:4', 'splitter:3', 'mukadensu:3'], ['arc', 'single', 'line'], null, obstacles(['underpass:5:0', 'tunnelRing:3:0', 'column:2:2'], 1.7, 0.85), 21, { ceiling: true, ceilingY: 16, ceilingPalette: ['#04101a', '#3a6a82'] }),
  stage(21, 'Crosstown Bridge', 72, 21, 'duskbridge', ['column', 'binzubin'], 1.58, ['fighterJet:5', 'droneHeavy:3', 'shieldCarrier:2'], ['line', 'arc', 'v'], { id: 'godarni', name: 'BRIDGE TROLL', musicTrack: 6 }, obstacles(['bridge:4:0', 'tunnelRing:2:0', 'skyscraper:2:0'], 1.65, 0.85), 22),
  bonusStage(22, 'Neon Ring Run', 50, 22, 'neoncity', ['column', 'binzubin'], 1.40, { targetSet: 'rings' }, 23),
  stage(23, 'Metropolis Vector', 78, 23, 'metropolis', ['column', 'binzubin', 'idaHead'], 1.66, ['domRed:4', 'sniperDrone:4', 'splitter:3', 'shieldCarrier:3'], ['v', 'arc', 'line'], { id: 'shura', name: 'GLASS REFLECTION', musicTrack: 7 }, obstacles(['skyscraper:5:0', 'bridge:2:0', 'underpass:2:0', 'archway:1:0'], 1.5, 0.78), 24, { ceiling: true, ceilingY: 24, ceilingPalette: ['#0a0408', '#8a4848'] }),
  stage(24, 'Highway to Zero', 90, 24, 'highway', ['column', 'binzubin'], 1.74, ['laneDiver:5', 'fighterJet:4', 'mineLayer:4', 'droneHeavy:3', 'sniperDrone:3'], ['arc', 'v', 'line'], null, obstacles(['skyscraper:3:0', 'bridge:3:0', 'underpass:4:0', 'tunnelRing:3:0', 'archway:2:0'], 1.38, 0.72), null, { ceiling: true, ceilingY: 20, ceilingPalette: ['#180810', '#cc7044'] }, finalBossRush)
];

function stage(id, name, duration, musicTrack, worldTheme, sceneryTypes, speedScale, enemySpecs, formations, boss, obs, nextStageId, tunnel = null, bossRush = null) {
  const media = getStageMedia(musicTrack);
  const metadata = stageMetadata(id, worldTheme, sceneryTypes, speedScale, enemySpecs, boss, tunnel, bossRush);
  return {
    id,
    name,
    duration,
    musicTrack,
    musicPath: media?.music || null,
    splashImage: media?.splash || null,
    mediaName: media?.name || name,
    worldTheme,
    sceneryTypes,
    speedScale,
    spawn: {
      intervalBase: Math.max(0.56, 1.34 - id * 0.045),
      intervalMin: Math.max(0.24, 0.45 - id * 0.012),
      enemyTypes: enemySpecs.map(spec),
      formations,
      speedMin: 36 + id * 3,
      speedMax: 68 + id * 6
    },
    boss,
    obstacles: obs,
    pickups: id >= 14 ? sparsePickups : commonPickups,
    nextStageId,
    course: course(id),
    tunnel,
    bossRush,
    bossRushMusicTrack: bossRush ? 8 : null,
    metadata,
    turnDensity: id >= 19 ? 1.4 : (id >= 9 ? 0.6 : 0)
  };
}

function bonusStage(id, name, duration, musicTrack, worldTheme, sceneryTypes, speedScale, bonus, nextStageId) {
  const media = getStageMedia(musicTrack);
  const metadata = stageMetadata(id, worldTheme, sceneryTypes, speedScale, [], null, null, null, bonus);
  return {
    id,
    name,
    duration,
    musicTrack,
    musicPath: media?.music || null,
    splashImage: media?.splash || null,
    mediaName: media?.name || name,
    worldTheme,
    sceneryTypes,
    speedScale,
    mode: 'bonus',
    bonus,
    spawn: { intervalBase: 999, intervalMin: 999, enemyTypes: [], formations: ['single'], speedMin: 0, speedMax: 0 },
    obstacles: { enabled: false },
    pickups: commonPickups,
    nextStageId,
    course: course(id),
    metadata
  };
}

function course(id) {
  const amp = [0, 1.6, 1.8, 2.0, 2.25, 2.45, 2.65, 2.85, 3.1][id] || 2.0;
  return {
    amplitude: amp,
    frequency: 0.0048 + id * 0.00018,
    secondaryAmplitude: amp * 0.10,
    secondaryFrequency: 0.009 + id * 0.00016,
    phase: id * 0.83,
    travelScale: 0.14 + id * 0.008
  };
}

function spec(s) {
  const [type, w] = s.split(':');
  return { type, weight: Number(w) };
}

function obstacles(entries, intervalBase, intervalMin) {
  return {
    enabled: true,
    firstDelay: 2.4,
    intervalBase,
    intervalMin,
    lanes: [-18, -10, 0, 10, 18],
    speedMin: 82,
    speedMax: 142,
    entries: entries.map(e => {
      const [type, weight, y] = e.split(':');
      return { type, weight: Number(weight), y: Number(y) };
    })
  };
}

function media(name, music, splash) {
  return { name, music, splash };
}

function stageMetadata(id, worldTheme, sceneryTypes, speedScale, enemySpecs, boss, tunnel, bossRush, bonus = null) {
  const enemyTypes = enemySpecs.map(entry => specType(entry));
  const behaviorFocus = unique([
    ...enemyTypes.map(enemyBehavior),
    ...(bonus ? [`${bonus.targetSet || 'bonus'} target run`] : []),
    ...(boss ? ['boss duel'] : []),
    ...(bossRush ? ['boss rush endurance'] : []),
    ...(tunnel?.ceiling ? ['tunnel ceiling pressure'] : []),
    ...(id >= 13 && !bossRush ? ['mixed elite pressure'] : [])
  ]).filter(Boolean);
  const difficultyRating = Math.min(10, Math.max(1, Math.round(
    1.2 + id * 0.43 + (Number(speedScale) || 1) * 1.15 + enemyTypes.length * 0.16 + (boss ? 0.75 : 0) + (bossRush ? 1.4 : 0)
  )));
  const visualParts = [
    themeHook(worldTheme),
    sceneryHook(sceneryTypes),
    tunnel?.ceiling ? 'compressed ceiling silhouettes' : ''
  ].filter(Boolean);
  const encounterParts = [];
  if (bonus) encounterParts.push(`${labelFromId(bonus.targetSet || 'bonus')} target chain`);
  if (behaviorFocus.length) encounterParts.push(behaviorFocus.slice(0, 3).join(', '));
  if (bossRush) encounterParts.push(`${bossRush.length}-boss rush`);
  else if (boss?.name) encounterParts.push(`${boss.name} duel`);

  return {
    difficultyBand: difficultyBand(id),
    difficultyRating,
    visualHook: visualParts.join(' / '),
    encounterHook: encounterParts.join(' / '),
    behaviorFocus
  };
}

function difficultyBand(id) {
  if (id >= 18) return 'finale';
  if (id >= 13) return 'late campaign';
  if (id >= 9) return 'escalation';
  if (id >= 6) return 'mid campaign';
  return 'opening';
}

function themeHook(worldTheme) {
  const hooks = {
    moot: 'warm ridge dusk',
    geeza: 'burnt mesa breach',
    amar: 'violet precipice grove',
    ceiciel: 'blue storm gate',
    bonus: 'bright target sprint',
    olisis: 'purple citadel approach',
    lucasia: 'cold iron gate',
    finalvoid: 'black void horizon',
    ash: 'ember ash flats',
    frost: 'ice-lit needle field',
    biomech: 'bio-mechanical maw',
    temple: 'gold temple ruins',
    stalactite: 'subterranean gate',
    ida: 'stone idol crucible',
    neonDesert: 'neon desert run',
    cityscape: 'cyberpunk skyline at dusk',
    metropolis: 'crimson metropolis canyon',
    underdeep: 'submerged tunnel grid',
    highway: 'sunset highway breakthrough',
    neoncity: 'neon ring gauntlet',
    duskbridge: 'industrial bridge causeway'
  };
  return hooks[worldTheme] || `${labelFromId(worldTheme)} terrain`;
}

function sceneryHook(sceneryTypes = []) {
  const labels = unique(sceneryTypes).slice(0, 3).map(labelFromId);
  return labels.length ? `${labels.join(', ')} silhouettes` : '';
}

function enemyBehavior(type) {
  const behaviors = {
    mammoth: 'large ramming swarms',
    mukadensu: 'crawler lanes',
    tomos: 'angled flanking',
    skegg: 'armored pressure',
    pakomen: 'erratic ground hops',
    canary: 'fast aerial arcs',
    looper: 'looping ambushes',
    domBasic: 'dom formation fire',
    domBlue: 'wide dom volleys',
    domRed: 'aggressive dom fire',
    fighterJet: 'high-speed passes',
    lowrys: 'swarm splitting',
    droneHeavy: 'heavy drone volleys',
    tetra: 'geometric crossfire',
    octopus: 'tentacle spread fire',
    laneDiver: 'lane-diving strikes',
    mineLayer: 'persistent minefields',
    sniperDrone: 'charged sniper shots',
    shieldCarrier: 'shielded escorts',
    splitter: 'splitting enemy pressure'
  };
  return behaviors[type] || `${labelFromId(type)} pressure`;
}

function specType(entry) {
  return String(entry).split(':')[0];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function labelFromId(value = '') {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getStageMedia(n) { return STAGE_MEDIA[n] || STAGE_MEDIA[((n - 1) % 8) + 1]; }
export function getStage(id) { return STAGES.find(stage => stage.id === id) || STAGES[0]; }
export function getTheme(name) { return STAGE_THEMES[name] || STAGE_THEMES.moot; }
