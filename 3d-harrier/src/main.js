import * as THREE from 'three';
import { HeadTracker } from './engine/headtracking.js';
import { setOffAxisProjection } from './engine/offaxis.js';
import { Input } from './engine/input.js';
import { AudioBus } from './engine/audio.js';
import { World } from './game/world.js';
import { Player } from './game/player.js';
import { Projectiles, checkPlayerEnemyCollisions, Explosions, Shockwaves } from './game/entities.js';
import { checkPlayerObstacleCollisions } from './game/obstacles.js';
import { EnemyProjectiles } from './game/enemyProjectiles.js';
import { HUD } from './game/hud.js';
import { StageManager } from './game/stageManager.js';
import { STAGES, getStageMedia } from './game/content/stages.js';
import { EDITOR_CATALOG, EDITOR_THEMES, createBlankLevel, levelToStageDef, normalizeLevel } from './game/content/levelSchema.js';
import { levelStore } from './game/content/customLevels.js';
import { getCampaignStageCount } from './game/content/campaign.js';
import { EXTRA_LIFE_STAGE_CADENCE, QA_PERFORMANCE_LIMITS } from './game/content/balance.js';
import { saveStore } from './game/save.js';
import { DEV } from './game/dev.js';
import { HitSphereDebug } from './game/debugViz.js';

// ---------- DOM ----------
const PERFORMANCE_PIXEL_RATIO_CAP = 1.5;
const PERF_OVERLAY_QUERY = new URLSearchParams(window.location.search).has('perf');
const PERF_OVERLAY_STORAGE_KEY = 'harrierPerfOverlay';
const canvas        = document.getElementById('scene');
const video         = document.getElementById('video');
const menu          = document.getElementById('menu');
const playPanel     = document.getElementById('playPanel');
const editorPanel   = document.getElementById('editorPanel');
const playTabBtn    = document.getElementById('playTabBtn');
const editorTabBtn  = document.getElementById('editorTabBtn');
const startBtn      = document.getElementById('startGameBtn');
const stageSelect   = document.getElementById('stageSelect');
const saveSummary   = document.getElementById('saveSummary');
const stageBriefing = document.getElementById('stageBriefing');
const stageBriefingImage = document.getElementById('stageBriefingImage');
const stageBriefingKicker = document.getElementById('stageBriefingKicker');
const stageBriefingName = document.getElementById('stageBriefingName');
const stageBriefingMeta = document.getElementById('stageBriefingMeta');
const stageBriefingTags = document.getElementById('stageBriefingTags');
const levelNameInput = document.getElementById('levelNameInput');
const levelLoadSelect = document.getElementById('levelLoadSelect');
const levelMusicSelect = document.getElementById('levelMusicSelect');
const levelThemeSelect = document.getElementById('levelThemeSelect');
const newLevelBtn = document.getElementById('newLevelBtn');
const loadLevelBtn = document.getElementById('loadLevelBtn');
const saveLevelBtn = document.getElementById('saveLevelBtn');
const duplicateLevelBtn = document.getElementById('duplicateLevelBtn');
const deleteLevelBtn = document.getElementById('deleteLevelBtn');
const exportLevelBtn = document.getElementById('exportLevelBtn');
const importLevelBtn = document.getElementById('importLevelBtn');
const importLevelInput = document.getElementById('importLevelInput');
const splashUploadBtn = document.getElementById('splashUploadBtn');
const splashUploadInput = document.getElementById('splashUploadInput');
const splashPreview = document.getElementById('splashPreview');
const playtestLevelBtn = document.getElementById('playtestLevelBtn');
const editorMap = document.getElementById('editorMap');
const objectPalette = document.getElementById('objectPalette');
const itemPalette = document.getElementById('itemPalette');
const enemyPalette = document.getElementById('enemyPalette');
const editorInspector = document.getElementById('editorInspector');
const editorStatus = document.getElementById('editorStatus');
const enemyDensityInput = document.getElementById('enemyDensityInput');
const obstacleDensityInput = document.getElementById('obstacleDensityInput');
const pickupDensityInput = document.getElementById('pickupDensityInput');
const speedScaleInput = document.getElementById('speedScaleInput');
const touchStickModeBtn = document.getElementById('touchStickModeBtn');
const easyModeBtn   = document.getElementById('easyModeBtn');
const enableGyroBtn = document.getElementById('enableGyroBtn');
const touchPauseBtn = document.getElementById('touchPauseBtn');
const enableCamBtn  = document.getElementById('enableCamBtn');
const cameraFollowBtn = document.getElementById('cameraFollowBtn');
const orbitBtn      = document.getElementById('orbitBtn');
const resetProgressBtn = document.getElementById('resetProgressBtn');
const camStatus     = document.getElementById('camStatus');

// ---------- Renderer & scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PERFORMANCE_PIXEL_RATIO_CAP));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 1, 800);

// Lighting — intentionally dim ambient so the dynamic lights (jetpack,
// muzzle flash, tracers, pickups) drive the look. The scene reads as
// "dusk on a warm planet" rather than overlit daytime.
const hemi = new THREE.HemisphereLight(0x8870a8, 0x402818, 0.32);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffc488, 0.95);
sun.position.set(35, 75, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);
// Aim the sun at the player area so the shadow camera frames things correctly
sun.target.position.set(0, 0, -40);
scene.add(sun.target);

// ---------- Subsystems ----------
const audio       = new AudioBus();
const input       = new Input(canvas);
const headTracker = new HeadTracker(video);
const world       = new World(scene, { hemi, sun });
const projectiles = new Projectiles(scene);
const enemyProjectiles = new EnemyProjectiles(scene, audio);
const explosions  = new Explosions(scene);
const shockwaves  = new Shockwaves(scene);
const player      = new Player(scene);
const hud         = new HUD();
const hitSphereDebug = new HitSphereDebug(scene);
const stage       = new StageManager(scene, hud, audio, {
  world,
  enemyProjectiles,
  onStageStart: (stageDef) => {
    centerPlayerForStageStart();
    stageHits = 0;
    if (!stageDef.custom) {
      saveData = saveStore.recordStageReached(stageDef.id);
      highScore = saveData.highScore || highScore;
      refreshSaveUi();
    }
    preloadStageMedia(stageDef);
    audio.loadAndPlayMusic(stageDef.musicPath || trackForStage(stageDef.musicTrack || stageDef.id), 0.5);
  },
  onBonusScore: (points) => {
    score += points;
    hud.setScore(score);
    audio.playPickup();
  },
  onStageClear: (stageDef) => {
    const stageId = Number(stageDef.id) || 0;
    const baseBonus = stageDef.mode === 'bonus' ? 1500 : 1000;
    const clearBonus = baseBonus + stageId * 250;
    const noHitBonus = stageHits === 0 && stageDef.mode !== 'bonus' ? 750 + stageId * 50 : 0;
    score += clearBonus + noHitBonus;
    stagesCleared++;
    let extraLifeAwarded = false;
    if (!stageDef.custom && stageId > 0 && stageId % EXTRA_LIFE_STAGE_CADENCE === 0 && lives < MAX_LIVES) {
      lives++;
      extraLifeAwarded = true;
      hud.setHealth(lives, MAX_LIVES);
      audio.playPickup();
    }
    hud.setScore(score);
    const clearParts = [`CLEAR ${clearBonus}`];
    if (noHitBonus) clearParts.push(`NO HIT ${noHitBonus}`);
    if (extraLifeAwarded) clearParts.push('EXTRA LIFE');
    hud.showTitle(`${stageDef.mode === 'bonus' ? 'BONUS' : 'STAGE'} ${stage.stage} CLEAR`, 1900, clearParts.join(' / '));
  },
  onCampaignComplete: () => {
    finishCampaign();
  }
});

window.addEventListener('harrier-touch-aim', e => {
  if (!e.detail) return;
  reticleX = e.detail.x;
  reticleY = e.detail.y;
});

world.spawnScenery();

// ---------- State ----------
let gameState = 'menu';   // 'menu' | 'playing' | 'paused' | 'gameover' | 'ending'
let score = 0;
let lives = 3;
let saveData = saveStore.load();
let highScore = saveData.highScore || 0;
let easyMode = localStorage.getItem('harrierEasyMode') === '1';
let easyHealth = 100;
const EASY_HEALTH_MAX = 100;
const EASY_HEALTH_REGEN = 12; // % per second
let cameraFollowMode = localStorage.getItem('harrierCameraFollow') !== '0';
const MAX_LIVES = 5;
let slowWorldTimer = 0;

// Sprint mechanic
let sprintActive = false;
let sprintTimer = 0;       // seconds remaining in current sprint
let sprintCooldown = 0;    // seconds remaining until next sprint allowed
const SPRINT_DURATION = 1.5;
const SPRINT_COOLDOWN = 30;
const SPRINT_DISTANCE_FACTOR = 0.5; // 50% forward jump
let sprintWorldBoost = 1; // multiplier on world scroll speed
let sprintForwardOffset = 0; // how far forward the player has charged
let cameraSprintZ = 0; // how far the camera has dollied forward (lags behind player)
let editorLevel = null;
let selectedAnchorId = null;
let stageHits = 0;
let stagesCleared = 0;
let currentRunStartStage = 1;
let perfOverlayEnabled = PERF_OVERLAY_QUERY || localStorage.getItem(PERF_OVERLAY_STORAGE_KEY) === '1';
let perfHudAccumulator = 0;
const perfStats = createPerfStats();

// Head-tracking influence and clamps. Aim is decoupled (hitscan from a fixed
// neutral eye), so camera shift no longer breaks aim — we can let cinematic
// mode swing wider in gameplay without consequences.
// Live head tracking still stays subtle so the user isn't fighting their own
// head motion while strafing.
const HEAD_TRACK_GAME_INFLUENCE = 0.35;
const HEAD_TRACK_GAME_CLAMP_CM  = 6;
const HEAD_TRACK_MENU_INFLUENCE = 1.0;
const HEAD_TRACK_MENU_CLAMP_CM  = 30;
const HEAD_ORBIT_GAME_INFLUENCE = 0.9;
const HEAD_ORBIT_GAME_CLAMP_CM  = 18;
const HEAD_ORBIT_MENU_INFLUENCE = 1.0;
const HEAD_ORBIT_MENU_CLAMP_CM  = 40;

const renderEye = new THREE.Vector3(0, 0, 50);
const cameraFollowEye = new THREE.Vector2(0, 0);
hud.showPerfOverlay(perfOverlayEnabled);

// Music and splash art are supplied in /sound. Campaign stage definitions carry
// explicit musicTrack ids that resolve through the central STAGE_MEDIA map.
const splashPreload = new Map();
function trackForStage(n) {
  return getStageMedia(n)?.music || getStageMedia(1).music;
}

function preloadSplash(src) {
  if (!src || splashPreload.has(src)) return splashPreload.get(src) || Promise.resolve(null);
  const promise = new Promise(resolve => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().catch(() => {}).finally(() => resolve(img));
      else resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  splashPreload.set(src, promise);
  return promise;
}

function preloadStageMedia(stageDef) {
  if (!stageDef) return;
  preloadSplash(stageDef.splashImage);
  audio.preloadMusic?.(stageDef.musicPath || trackForStage(stageDef.musicTrack || stageDef.id));
  const nextId = stageDef.nextStageId;
  const nextStage = STAGES.find(entry => entry.id === nextId);
  if (nextStage) {
    preloadSplash(nextStage.splashImage);
    audio.preloadMusic?.(nextStage.musicPath || trackForStage(nextStage.musicTrack || nextStage.id));
  }
}

function populateStageSelector(preferredValue = stageSelect?.value) {
  if (!stageSelect) return;
  const levelSet = (document.getElementById('levelSetSelect')?.value) || 'campaign';
  const previous = preferredValue || stageSelect.value || String(saveData.bestStageReached || 1);
  const best = Math.max(1, Number(saveData.bestStageReached) || 1);
  const clears = Number(saveData.completionCount) || 0;
  stageSelect.innerHTML = '';

  if (levelSet === 'custom') {
    const customLevels = levelStore.listLevels();
    if (customLevels.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No custom levels - create one in the Editor';
      opt.disabled = true;
      stageSelect.appendChild(opt);
    } else {
      for (const level of customLevels) {
        const opt = document.createElement('option');
        opt.value = `custom:${level.id}`;
        opt.textContent = level.name || 'Untitled Level';
        stageSelect.appendChild(opt);
      }
      stageSelect.value = `custom:${customLevels[0].id}`;
    }
    renderStageBriefing();
    return;
  }

  // Campaign mode (default)
  for (const stageDef of STAGES) {
    const opt = document.createElement('option');
    opt.value = String(stageDef.id);
    const progress = stageDef.id === best
      ? 'BEST'
      : stageDef.id < best || clears > 0
        ? 'CLEAR'
        : stageDef.id === best + 1
          ? 'NEXT'
          : '';
    opt.textContent = `STAGE ${String(stageDef.id).padStart(2, '0')} ${stageDef.name}${progress ? ` - ${progress}` : ''}`;
    stageSelect.appendChild(opt);
  }
  stageSelect.value = STAGES.some(stageDef => String(stageDef.id) === String(previous)) ? String(previous) : String(best);
  renderStageBriefing();
}

function renderSaveSummary() {
  if (!saveSummary) return;
  const best = Math.max(1, Number(saveData.bestStageReached) || 1);
  const clears = Number(saveData.completionCount) || 0;
  saveSummary.textContent = `HI ${String(highScore || 0).padStart(6, '0')} / BEST STAGE ${String(best).padStart(2, '0')} / CLEARS ${clears}`;
}

function renderStageBriefing() {
  if (!stageBriefing || !stageSelect) return;
  const value = stageSelect.value || '';

  // Custom level briefing
  if (value.startsWith('custom:')) {
    const id = value.slice(7);
    const lvl = levelStore.getLevel(id);
    if (!lvl) return;
    if (stageBriefingImage) {
      stageBriefingImage.src = lvl.splashImage || '';
      stageBriefingImage.style.display = lvl.splashImage ? 'block' : 'none';
    }
    if (stageBriefingKicker) stageBriefingKicker.textContent = 'CUSTOM LEVEL';
    if (stageBriefingName) stageBriefingName.textContent = lvl.name || 'Untitled';
    const counts = (lvl.map || []).reduce((acc, a) => { acc[a.kind] = (acc[a.kind] || 0) + 1; return acc; }, {});
    if (stageBriefingMeta) stageBriefingMeta.textContent = `${labelFromId(lvl.theme)} / ${Math.round(lvl.duration || 60)} SEC / ${counts.enemy || 0} enemies / ${counts.object || 0} objects / ${counts.item || 0} items / ${counts.turn || 0} turns`;
    if (stageBriefingTags) {
      stageBriefingTags.innerHTML = '';
      const tags = [`TRACK ${String(lvl.musicTrack || 1).padStart(2, '0')}`, 'CUSTOM'];
      for (const t of tags) {
        const chip = document.createElement('span');
        chip.textContent = t;
        stageBriefingTags.appendChild(chip);
      }
    }
    return;
  }

  const stageDef = STAGES.find(entry => String(entry.id) === String(stageSelect.value)) || STAGES[0];
  if (!stageDef) return;
  if (stageBriefingImage) {
    stageBriefingImage.src = stageDef.splashImage || '';
    stageBriefingImage.style.display = stageDef.splashImage ? 'block' : 'none';
  }
  if (stageBriefingKicker) {
    const mode = stageDef.mode === 'bonus' ? 'BONUS ROUTE' : stageDef.bossRush?.length ? 'FINAL RUSH' : stageDef.boss ? 'BOSS ROUTE' : 'CAMPAIGN ROUTE';
    stageBriefingKicker.textContent = `STAGE ${String(stageDef.id).padStart(2, '0')} / ${mode}`;
  }
  if (stageBriefingName) stageBriefingName.textContent = stageDef.mediaName || stageDef.name;
  if (stageBriefingMeta) {
    const meta = stageDef.metadata || {};
    const band = meta.difficultyBand ? labelFromId(meta.difficultyBand) : labelFromId(stageDef.worldTheme);
    const rating = meta.difficultyRating ? `THREAT ${meta.difficultyRating}/10` : `${Math.round(stageDef.duration || 0)} SEC`;
    const visualHook = meta.visualHook || (stageDef.sceneryTypes || []).slice(0, 4).map(labelFromId).join(', ') || labelFromId(stageDef.worldTheme);
    const encounterHook = meta.encounterHook || (stageDef.spawn?.enemyTypes || []).slice(0, 4).map(entry => labelFromId(entry.type)).join(', ') || 'bonus targets';
    stageBriefingMeta.textContent = `${band} / ${rating} / ${visualHook} / ${encounterHook}`;
  }
  if (stageBriefingTags) {
    stageBriefingTags.innerHTML = '';
    const tags = [
      `TRACK ${String(stageDef.musicTrack || 1).padStart(2, '0')}`,
      `SPEED ${Number(stageDef.speedScale || 1).toFixed(2)}X`
    ];
    if (stageDef.tunnel?.ceiling) tags.push('TUNNEL');
    if (stageDef.mode === 'bonus') tags.push('BONUS');
    if (stageDef.boss?.name) tags.push(stageDef.boss.name);
    if (stageDef.bossRush?.length) tags.push(`${stageDef.bossRush.length} BOSSES`);
    for (const tag of tags) {
      const chip = document.createElement('span');
      chip.textContent = tag;
      stageBriefingTags.appendChild(chip);
    }
  }
}

function refreshSaveUi(preferredValue = stageSelect?.value) {
  populateStageSelector(preferredValue);
  renderSaveSummary();
  renderStageBriefing();
}
refreshSaveUi();
initEditor();
// initOptionsModal(); // removed - modal attaches itself
updateMobileModeButtons();
updateEasyModeButton();
updateCameraFollowButton();
if (input.gyroEnabled && enableGyroBtn) { enableGyroBtn && enableGyroBtn.classList.add('on'); enableGyroBtn && (enableGyroBtn.textContent = 'GYRO VIEW: ON'); }
if (input.mobileAvailable && enableCamBtn) {
  enableCamBtn && (enableCamBtn.disabled = true);
  enableCamBtn && (enableCamBtn.textContent = 'HEAD TRACKING: DESKTOP ONLY');
  camStatus.textContent = 'mobile uses gyro view tilt instead of camera';
}
if (DEV.enabled) document.body.classList.add('dev-mode');

// ---------- Level editor ----------
function initEditor() {
  if (!editorPanel || !editorMap) return;
  editorLevel = levelStore.listLevels()[0] || createBlankLevel();
  populateEditorSelects();
  populatePalettes();
  bindEditorEvents();
  renderEditor();
}

function populateEditorSelects() {
  if (levelMusicSelect) {
    levelMusicSelect.innerHTML = '';
    for (let i = 1; i <= STAGES.length; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `TRACK ${String(i).padStart(2, '0')}`;
      levelMusicSelect.appendChild(opt);
    }
  }
  if (levelThemeSelect) {
    levelThemeSelect.innerHTML = '';
    for (const theme of EDITOR_THEMES) {
      const opt = document.createElement('option');
      opt.value = theme;
      opt.textContent = theme.toUpperCase();
      levelThemeSelect.appendChild(opt);
    }
  }
  refreshLevelLoadSelect();
}

function populatePalettes() {
  buildPalette(objectPalette, 'object', EDITOR_CATALOG.objects);
  buildPalette(itemPalette, 'item', EDITOR_CATALOG.items);
  buildPalette(enemyPalette, 'enemy', EDITOR_CATALOG.enemies);
  if (typeof EDITOR_CATALOG.turns !== 'undefined') {
    buildPalette(document.getElementById('turnPalette'), 'turn', EDITOR_CATALOG.turns);
  }
}

function buildPalette(root, kind, entries) {
  if (!root) return;
  root.innerHTML = '';
  for (const entry of entries) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'palette-chip';
    chip.draggable = true;
    chip.innerHTML = `<span class="palette-swatch" style="color:${kindColor(kind)}"></span><span>${entry.label}</span>`;
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/json', JSON.stringify({ kind, type: entry.id }));
      e.dataTransfer.effectAllowed = 'copy';
    });
    chip.addEventListener('click', () => addAnchor(kind, entry.id, 0, 0.5));
    root.appendChild(chip);
  }
}

function bindEditorEvents() {
  playTabBtn?.addEventListener('click', () => setMenuMode('play'));
  editorTabBtn?.addEventListener('click', () => setMenuMode('editor'));
  levelNameInput?.addEventListener('input', () => { editorLevel.name = levelNameInput.value || 'Untitled Level'; renderEditorStatus(); });
  levelMusicSelect?.addEventListener('change', () => { editorLevel.musicTrack = Number(levelMusicSelect.value) || 1; renderEditorStatus(); });
  levelThemeSelect?.addEventListener('change', () => { editorLevel.theme = levelThemeSelect.value || 'moot'; renderEditorStatus(); });
  levelLoadSelect?.addEventListener('change', () => {
    loadSelectedEditorLevel();
  });
  loadLevelBtn?.addEventListener('click', () => {
    loadSelectedEditorLevel();
  });
  newLevelBtn?.addEventListener('click', () => {
    editorLevel = createBlankLevel();
    selectedAnchorId = null;
    renderEditor();
    setEditorStatus('New level ready');
  });
  saveLevelBtn?.addEventListener('click', () => {
    syncEditorControls();
    editorLevel = levelStore.saveLevel(editorLevel);
    refreshLevelLoadSelect();
    if (levelLoadSelect && editorLevel.id) levelLoadSelect.value = editorLevel.id;
    renderEditor();
    // Also refresh main menu stage selector so this level shows up in Custom Levels
    populateStageSelector();
    setEditorStatus(`Saved ${editorLevel.name}`);
  });
  duplicateLevelBtn?.addEventListener('click', () => {
    syncEditorControls();
    editorLevel = createBlankLevel({ ...editorLevel, id: undefined, name: `${editorLevel.name} Copy`, createdAt: undefined });
    selectedAnchorId = null;
    renderEditor();
    setEditorStatus('Duplicated level');
  });
  deleteLevelBtn?.addEventListener('click', () => {
    deleteCurrentEditorLevel();
  });
  exportLevelBtn?.addEventListener('click', () => {
    exportCurrentEditorLevel();
  });
  importLevelBtn?.addEventListener('click', () => {
    importLevelInput?.click();
  });
  importLevelInput?.addEventListener('change', () => {
    importEditorLevelFromFile(importLevelInput.files?.[0]);
    importLevelInput.value = '';
  });

  splashUploadBtn?.addEventListener('click', () => {
    splashUploadInput?.click();
  });
  splashUploadInput?.addEventListener('change', () => {
    const file = splashUploadInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      if (editorLevel) {
        editorLevel.splashImage = dataUrl;
      }
      updateSplashPreview(dataUrl);
      setEditorStatus('Splash image uploaded');
    };
    reader.readAsDataURL(file);
    splashUploadInput.value = '';
  });
  playtestLevelBtn?.addEventListener('click', () => {
    syncEditorControls();
    menu.classList.add('hidden');
    startGame(levelToStageDef(editorLevel));
  });

  for (const inputEl of [enemyDensityInput, obstacleDensityInput, pickupDensityInput, speedScaleInput]) {
    inputEl?.addEventListener('input', () => {
      syncEditorControls();
      renderEditorStatus();
    });
  }

  editorMap.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  editorMap.addEventListener('drop', e => {
    e.preventDefault();
    const data = parseDragData(e.dataTransfer.getData('application/json'));
    if (!data) return;
    const point = mapPointFromEvent(e);
    addAnchor(data.kind, data.type, point.x, point.y);
  });
  editorMap.addEventListener('pointerdown', e => {
    if (e.target === editorMap) {
      selectedAnchorId = null;
      renderEditor();
    }
  });
  window.addEventListener('keydown', e => {
    if (e.code !== 'Delete' && e.code !== 'Backspace') return;
    if (!editorPanel || editorPanel.classList.contains('hidden')) return;
    if (deleteSelectedAnchor()) e.preventDefault();
  });
}

function loadSelectedEditorLevel() {
  if (!levelLoadSelect?.value) return;
  const value = levelLoadSelect.value;

  // Handle campaign stage selection: convert to a fresh editable copy
  if (value.startsWith('stage:')) {
    const stageId = Number(value.slice(6));
    const stageDef = STAGES.find(s => s.id === stageId);
    if (!stageDef) return;

    // Build a fresh custom level seeded from the campaign stage
    const seed = {
      name: `${stageDef.name} (copy)`,
      musicTrack: stageDef.musicTrack || 1,
      theme: stageDef.worldTheme || 'moot',
      duration: stageDef.duration || 60,
      splashImage: stageDef.splashImage || null,
      procedural: {
        enemyDensity: 1,
        obstacleDensity: 1,
        pickupDensity: 1,
        speedScale: stageDef.speedScale || 1,
        formations: (stageDef.spawn?.formations) || ['line', 'v', 'arc', 'single']
      },
      map: []
    };
    editorLevel = createBlankLevel(seed);
    selectedAnchorId = null;
    // Save it immediately so it persists in the custom level list
    editorLevel = levelStore.saveLevel(editorLevel);
    refreshLevelLoadSelect();
    levelLoadSelect.value = editorLevel.id;
    renderEditor();
    setEditorStatus(`Loaded ${editorLevel.name} (saved as new custom)`);
    return;
  }

  // Regular custom level load
  const loaded = levelStore.getLevel(value);
  if (!loaded) return;
  editorLevel = loaded;
  selectedAnchorId = null;
  renderEditor();
  setEditorStatus(`Loaded ${editorLevel.name}`);
}

function setMenuMode(mode) {
  const editor = mode === 'editor';
  playPanel?.classList.toggle('hidden', editor);
  editorPanel?.classList.toggle('hidden', !editor);
  playTabBtn?.classList.toggle('on', !editor);
  editorTabBtn?.classList.toggle('on', editor);
}

function refreshLevelLoadSelect() {
  if (!levelLoadSelect) return;
  const levels = levelStore.listLevels();
  levelLoadSelect.innerHTML = '';
  // Campaign stages first (for "save as" editing)
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i];
    const opt = document.createElement('option');
    opt.value = `stage:${s.id}`;
    opt.textContent = `Campaign ${s.id}: ${s.name}`;
    levelLoadSelect.appendChild(opt);
  }
  // Then custom levels
  for (const level of levels) {
    const opt = document.createElement('option');
    opt.value = level.id;
    opt.textContent = level.name;
    levelLoadSelect.appendChild(opt);
  }
  if (!levels.length && STAGES.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'NO LEVELS';
    levelLoadSelect.appendChild(opt);
  }
}


function updateSplashPreview(url) {
  if (!splashPreview) return;
  if (url) {
    splashPreview.src = url;
    splashPreview.style.display = 'inline-block';
  } else {
    splashPreview.removeAttribute('src');
    splashPreview.style.display = 'none';
  }
}

function renderEditor() {
  if (!editorLevel) return;
  editorLevel = normalizeLevel(editorLevel);
  if (levelNameInput) levelNameInput.value = editorLevel.name;
  if (levelMusicSelect) levelMusicSelect.value = String(editorLevel.musicTrack);
  if (levelThemeSelect) levelThemeSelect.value = editorLevel.theme;
  if (levelLoadSelect && editorLevel.id) levelLoadSelect.value = editorLevel.id;
  if (enemyDensityInput) enemyDensityInput.value = String(editorLevel.procedural.enemyDensity);
  if (obstacleDensityInput) obstacleDensityInput.value = String(editorLevel.procedural.obstacleDensity);
  if (pickupDensityInput) pickupDensityInput.value = String(editorLevel.procedural.pickupDensity);
  if (speedScaleInput) speedScaleInput.value = String(editorLevel.procedural.speedScale);
  renderAnchors();
  renderInspector();
  renderEditorStatus();
}

function renderAnchors() {
  if (!editorMap || !editorLevel) return;
  editorMap.querySelectorAll('.map-anchor').forEach(el => el.remove());
  for (const anchor of editorLevel.map) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `map-anchor ${anchor.kind}${anchor.id === selectedAnchorId ? ' selected' : ''}`;
    node.style.left = `${((anchor.x + 1) / 2) * 100}%`;
    node.style.top = `${anchor.y * 100}%`;
    node.dataset.label = shortLabel(anchor.type);
    node.title = `${anchor.kind}: ${anchor.type}`;
    node.addEventListener('pointerdown', e => beginAnchorDrag(e, anchor.id));
    editorMap.appendChild(node);
  }
}

function renderInspector() {
  if (!editorInspector || !editorLevel) return;
  const anchor = editorLevel.map.find(a => a.id === selectedAnchorId);
  if (!anchor) {
    editorInspector.textContent = 'Select an anchor to edit placement weight.';
    return;
  }
  editorInspector.innerHTML = `
    <div>${anchor.kind.toUpperCase()}</div>
    <div>${anchor.type}</div>
    <label>WEIGHT <input id="anchorWeightInput" type="range" min="0.25" max="6" step="0.25" value="${anchor.weight}"></label>
    <button id="deleteAnchorBtn" type="button">DELETE</button>
  `;
  document.getElementById('anchorWeightInput')?.addEventListener('input', e => {
    anchor.weight = Number(e.target.value) || 1;
    renderEditorStatus();
  });
  document.getElementById('deleteAnchorBtn')?.addEventListener('click', () => {
    deleteSelectedAnchor();
    renderEditor();
  });
}

function renderEditorStatus() {
  if (typeof updateSplashPreview === 'function' && editorLevel) {
    updateSplashPreview(editorLevel.splashImage || null);
  }

  if (!editorLevel) return;
  const counts = editorLevel.map.reduce((acc, anchor) => {
    acc[anchor.kind] = (acc[anchor.kind] || 0) + 1;
    return acc;
  }, {});
  setEditorStatus(`${editorLevel.map.length} anchors · ${counts.enemy || 0} enemies · ${counts.object || 0} objects · ${counts.item || 0} items · ${counts.turn || 0} turns${editorLevel.splashImage ? ' · splash ✓' : ''}`);
}

function syncEditorControls() {
  if (!editorLevel) return;
  editorLevel.name = levelNameInput?.value || editorLevel.name || 'Untitled Level';
  editorLevel.musicTrack = Number(levelMusicSelect?.value || editorLevel.musicTrack) || 1;
  editorLevel.theme = levelThemeSelect?.value || editorLevel.theme || 'moot';
  editorLevel.procedural.enemyDensity = Number(enemyDensityInput?.value || editorLevel.procedural.enemyDensity);
  editorLevel.procedural.obstacleDensity = Number(obstacleDensityInput?.value || editorLevel.procedural.obstacleDensity);
  editorLevel.procedural.pickupDensity = Number(pickupDensityInput?.value || editorLevel.procedural.pickupDensity);
  editorLevel.procedural.speedScale = Number(speedScaleInput?.value || editorLevel.procedural.speedScale);
  editorLevel = normalizeLevel(editorLevel);
}

function deleteCurrentEditorLevel() {
  if (!editorLevel?.id) return;
  const saved = levelStore.getLevel(editorLevel.id);
  if (!saved) {
    editorLevel = createBlankLevel();
    selectedAnchorId = null;
    renderEditor();
    setEditorStatus('Unsaved level discarded');
    return;
  }
  if (!window.confirm(`Delete saved level "${saved.name}"?`)) return;
  levelStore.deleteLevel(saved.id);
  editorLevel = levelStore.listLevels()[0] || createBlankLevel();
  selectedAnchorId = null;
  refreshLevelLoadSelect();
  renderEditor();
  setEditorStatus(`Deleted ${saved.name}`);
}

function exportCurrentEditorLevel() {
  if (!editorLevel) return;
  syncEditorControls();
  const payload = {
    type: '3d-harrier-level',
    exportedAt: new Date().toISOString(),
    level: normalizeLevel(editorLevel)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(payload.level.name)}.harrier-level.json`;
  link.click();
  URL.revokeObjectURL(url);
  setEditorStatus(`Exported ${payload.level.name}`);
}

function importEditorLevelFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    try {
      const parsed = JSON.parse(String(reader.result || 'null'));
      const source = parsed?.level || parsed;
      const normalized = normalizeLevel(source);
      editorLevel = createBlankLevel({
        ...normalized,
        id: undefined,
        name: `${normalized.name} Import`,
        createdAt: undefined,
        updatedAt: undefined
      });
      editorLevel = levelStore.saveLevel(editorLevel);
      selectedAnchorId = null;
      refreshLevelLoadSelect();
      renderEditor();
      setEditorStatus(`Imported ${editorLevel.name}`);
    } catch (error) {
      setEditorStatus(`Import failed: ${error.message}`);
    }
  });
  reader.addEventListener('error', () => {
    setEditorStatus('Import failed: could not read file');
  });
  reader.readAsText(file);
}

function addAnchor(kind, type, x, y) {
  if (!editorLevel) return;
  const id = `anchor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const base = { id, kind, type, x, y, weight: 1, lane: null };
  if (kind === 'turn') {
    base.direction = type === 'turnLeft' ? 'left' : 'right';
    base.strength = 4.5;
    base.duration = 6;
  }
  editorLevel.map.push(base);
  selectedAnchorId = id;
  renderEditor();
}

function beginAnchorDrag(e, id) {
  e.preventDefault();
  e.stopPropagation();
  selectedAnchorId = id;
  const move = event => {
    const anchor = editorLevel?.map.find(a => a.id === id);
    if (!anchor) return;
    const point = mapPointFromEvent(event);
    anchor.x = point.x;
    anchor.y = point.y;
    renderAnchors();
  };
  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    renderEditor();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  renderEditor();
}

function deleteSelectedAnchor() {
  if (!editorLevel || !selectedAnchorId) return false;
  const before = editorLevel.map.length;
  editorLevel.map = editorLevel.map.filter(anchor => anchor.id !== selectedAnchorId);
  selectedAnchorId = null;
  return editorLevel.map.length !== before;
}

function mapPointFromEvent(e) {
  const rect = editorMap.getBoundingClientRect();
  const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
  const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)));
  return { x: nx * 2 - 1, y: ny };
}

function parseDragData(raw) {
  try {
    const data = JSON.parse(raw);
    return data && data.kind && data.type ? data : null;
  } catch {
    return null;
  }
}

function setEditorStatus(text) {
  if (editorStatus) editorStatus.textContent = text || '';
}

function shortLabel(type) {
  return String(type).replace(/[A-Z]/g, m => ` ${m}`).slice(0, 14).trim().toUpperCase();
}

function labelFromId(value = '') {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toUpperCase();
}

function safeFileName(value = 'level') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'level';
}

function kindColor(kind) {
  if (kind === 'enemy') return '#ff667a';
  if (kind === 'item') return '#66e6ff';
  if (kind === 'turn') return '#a366ff';
  return '#ffcc66';
}

// Start the menu world drifting slowly; game state will crank it up.
world.setSpeedScale(0.45);

// ---------- Resize / off-axis params ----------
let screenW_cm = 34;
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const aspect = h / w;
  headTracker.setScreenH(screenW_cm * aspect);
}
window.addEventListener('resize', onResize);
onResize();

// ---------- Reticle / aim tracking ----------
let reticleX = window.innerWidth / 2;
let reticleY = window.innerHeight / 2;
window.addEventListener('mousemove', e => {
  reticleX = e.clientX;
  reticleY = e.clientY;
});

// ---------- Menu wiring ----------
startBtn.addEventListener('click', async () => {
  audio.ensure();
  const value = stageSelect?.value || '1';
  if (value.startsWith('custom:')) {
    const id = value.slice(7);
    const customLevel = levelStore.getLevel(id);
    if (!customLevel) {
      console.warn('Custom level not found:', id);
      return;
    }
    menu.classList.add('hidden');
    startGame(levelToStageDef(customLevel));
  } else {
    menu.classList.add('hidden');
    startGame(Number(value) || 1);
  }
});
stageSelect?.addEventListener('change', renderStageBriefing);
document.getElementById('levelSetSelect')?.addEventListener('change', () => {
  populateStageSelector();
});

resetProgressBtn?.addEventListener('click', () => {
  if (!window.confirm('Reset high score, best stage, and clear count?')) return;
  saveData = saveStore.reset();
  highScore = saveData.highScore || 0;
  refreshSaveUi('1');
});

easyModeBtn?.addEventListener('click', () => {
  easyMode = !easyMode;
  localStorage.setItem('harrierEasyMode', easyMode ? '1' : '0');
  updateEasyModeButton();
});

cameraFollowBtn && cameraFollowBtn.addEventListener('click', () => {
  setCameraFollowMode(!cameraFollowMode);
});

enableCamBtn?.addEventListener('click', async () => {
  await startHeadTracking();
});

async function startHeadTracking() {
  if (input.mobileAvailable) {
    camStatus.textContent = 'camera disabled on mobile; use gyro view tilt';
    return false;
  }
  if (headTracker.active) return true;
  if (enableCamBtn) {
    enableCamBtn && (enableCamBtn.disabled = true);
    enableCamBtn && (enableCamBtn.textContent = 'STARTING…');
  }
  camStatus.textContent = 'requesting camera…';
  try {
    await headTracker.start();
    video.classList.add('show');
    if (enableCamBtn) {
      enableCamBtn && (enableCamBtn.textContent = 'HEAD TRACKING: ON');
      enableCamBtn && enableCamBtn.classList.add('on');
    }
    camStatus.textContent = 'tracking active';
    return true;
  } catch (err) {
    if (enableCamBtn) {
      enableCamBtn && (enableCamBtn.disabled = false);
      enableCamBtn && (enableCamBtn.textContent = 'ENABLE HEAD TRACKING');
    }
    camStatus.textContent = 'error: ' + err.message;
    return false;
  }
}

orbitBtn && orbitBtn.addEventListener('click', () => {
  setCinematicMode(!headTracker.autoOrbit);
});

function setCinematicMode(on) {
  headTracker.setAutoOrbit(on);
  if (orbitBtn) {
    orbitBtn && (orbitBtn.textContent = on ? 'CINEMATIC MODE: ON' : 'CINEMATIC MODE');
    orbitBtn && orbitBtn.classList.toggle('on', on);
  }
  return !!on;
}

touchStickModeBtn && touchStickModeBtn.addEventListener('click', () => {
  input.setMobileMode('sticks');
  updateMobileModeButtons();
});

enableGyroBtn?.addEventListener('click', async () => {
  await setGyroMode(!input.gyroEnabled);
});

async function requestGyro() {
  if (enableGyroBtn) {
    enableGyroBtn && (enableGyroBtn.disabled = true);
    enableGyroBtn && (enableGyroBtn.textContent = 'REQUESTING VIEW TILT…');
  }
  const ok = await input.enableGyro();
  if (enableGyroBtn) {
    enableGyroBtn && (enableGyroBtn.disabled = false);
    enableGyroBtn && (enableGyroBtn.textContent = ok ? 'GYRO VIEW: ON' : 'GYRO UNAVAILABLE');
    enableGyroBtn && enableGyroBtn.classList.toggle('on', ok);
    if (!ok) setTimeout(() => { enableGyroBtn && (enableGyroBtn.textContent = 'GYRO VIEW TILT'); }, 1400);
  }
  return ok;
}

async function setGyroMode(on) {
  if (!on) {
    input.disableGyro();
    if (enableGyroBtn) {
      enableGyroBtn && (enableGyroBtn.textContent = 'GYRO VIEW TILT');
      enableGyroBtn?.classList.remove('on');
    }
    return false;
  }
  return await requestGyro();
}

function setCameraFollowMode(on) {
  cameraFollowMode = !!on;
  localStorage.setItem('harrierCameraFollow', cameraFollowMode ? '1' : '0');
  updateCameraFollowButton();
  return cameraFollowMode;
}

function updateMobileModeButtons() {
  touchStickModeBtn?.classList.toggle('on', input.mobileMode === 'sticks');
  const label = document.getElementById('touchModeLabel');
  if (label) label.textContent = 'DUAL STICKS';
}

function updateEasyModeButton() {
  if (!easyModeBtn) return;
  easyModeBtn.textContent = easyMode ? 'EASY MODE: ON' : 'EASY MODE: OFF';
  easyModeBtn.classList.toggle('on', easyMode);
}

function updateCameraFollowButton() {
  if (!cameraFollowBtn) return;
  cameraFollowBtn && (cameraFollowBtn.textContent = cameraFollowMode ? 'CAMERA FOLLOW: ON' : 'CAMERA FOLLOW: OFF');
  cameraFollowBtn && cameraFollowBtn.classList.toggle('on', cameraFollowMode);
}

// ---------- Pause ----------
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
      if (gameState === 'playing') {
        pauseGame();
      } else if (gameState === 'paused') {
      resumeGame();
    }
  }
  if (e.code === 'KeyR' && gameState === 'playing') {
    headTracker.calibrate();
  }
  handleDevHotkey(e);
});

touchPauseBtn?.addEventListener('click', () => {
  if (gameState === 'playing') pauseGame();
});

function getAudioSettingsSnapshot() {
  if (audio && typeof audio.getSettings === 'function') {
    return audio.getSettings();
  }
  return {
    music: Number.isFinite(audio?.musicLevel) ? audio.musicLevel : 0.65,
    sfx: Number.isFinite(audio?.sfxLevel) ? audio.sfxLevel : 1.0
  };
}

function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  input.setMobileOverlayVisible(false);
  hud.showPause(true, resumeGame, returnToMainMenu, {
    ...getAudioSettingsSnapshot(),
    onMusic: value => audio.setMusicVolume?.(value),
    onSfx: value => audio.setSfxVolume?.(value),
    cameraFollow: cameraFollowMode,
    gyro: input.gyroEnabled,
    headTracking: headTracker.active,
    headTrackingAvailable: !input.mobileAvailable,
    cinematic: headTracker.autoOrbit,
    onCameraFollow: value => setCameraFollowMode(value),
    onGyro: value => setGyroMode(value),
    onHeadTracking: () => startHeadTracking(),
    onCinematic: value => setCinematicMode(value)
  });
}

function handleDevHotkey(e) {
  if (!DEV.enabled || !e.shiftKey || e.repeat) return;
  if (e.code === 'KeyI') {
    player.invuln = player.invuln > 999 ? 0 : 999999;
    hud.showTitle(`DEV INVULNERABLE ${player.invuln > 0 ? 'ON' : 'OFF'}`, 900);
    e.preventDefault();
  } else if (e.code === 'KeyN') {
    stage._enterStageClear?.();
    hud.showTitle('DEV STAGE CLEAR', 900);
    e.preventDefault();
  } else if (e.code === 'KeyB') {
    spawnDevBoss();
    hud.showTitle('DEV BOSS SPAWN', 900);
    e.preventDefault();
  } else if (e.code === 'KeyK') {
    const boss = stage.getBoss?.();
    if (boss) {
      killDevBoss();
      hud.showTitle('DEV BOSS CLEAR', 900);
      e.preventDefault();
    }
  } else if (e.code === 'KeyP') {
    setPerfOverlay(!perfOverlayEnabled);
    hud.showTitle(`PERF OVERLAY ${perfOverlayEnabled ? 'ON' : 'OFF'}`, 700);
    e.preventDefault();
  }
}

function resumeGame() {
  if (gameState !== 'paused') return;
  gameState = 'playing';
  hud.showPause(false);
  input.setMobileOverlayVisible(true);
}

function returnToMainMenu() {
  gameState = 'menu';
  audio.stopMusic();
  hud.hideAll();
  input.setMobileOverlayVisible(false);
  menu.classList.remove('hidden');
  refreshSaveUi();
  stage.reset();
  projectiles.reset();
  enemyProjectiles.reset();
  explosions.reset();
  shockwaves.reset();
  slowWorldTimer = 0;
  resetPlayerLoadout();
  centerPlayerForStageStart();
  world.setSpeedScale(0.45);
}

// ---------- Game flow ----------
function resetPlayerLoadout() {
  player.alive = true;
  player.weapon = 'single';
  player.weaponTimer = 0;
  player.weaponMaxTimer = 0;
  player.bombs = 2;
  player.speedBoostTimer = 0;
  player.speedBoostMaxTimer = 0;
  player.speedBoostMultiplier = 1;
  player.group.visible = true;
  hud.setWeapon('single', 0);
  hud.setAmmo('single', 0, 0);
  hud.setBombs(player.bombs);
  hud.setPowerups();
}

function centerPlayerForStageStart() {
  player.position.set(0, 0, -8);
  player.velocity.set(0, 0, 0);
  player.invuln = 2.0;
  player.group.visible = true;
  player.group.position.copy(player.position);
}

function holdPlayerDuringTransition(dt) {
  player.velocity.multiplyScalar(Math.max(0, 1 - dt * 12));
  player.position.x += (0 - player.position.x) * Math.min(1, dt * 4);
  player.position.y += (0 - player.position.y) * Math.min(1, dt * 4);
  player.position.z = -8;
  player.group.position.copy(player.position);
  player.group.rotation.x *= Math.max(0, 1 - dt * 8);
  player.group.rotation.z *= Math.max(0, 1 - dt * 8);
  player.group.visible = true;
}

function startGame(startStageId = 1) {
  hud.hideAll();
  currentRunStartStage = typeof startStageId === 'object' ? 1 : Number(startStageId) || 1;
  score = 0;
  if (easyMode) { easyHealth = EASY_HEALTH_MAX; hud.setHealthBar(easyHealth); } else { lives = MAX_LIVES; hud.setHealth(lives, MAX_LIVES); }
  stagesCleared = 0;
  stageHits = 0;
  hud.setScore(0);
  if (!easyMode) hud.setHealth(lives, MAX_LIVES);
  centerPlayerForStageStart();
  resetPlayerLoadout();
  projectiles.reset();
  enemyProjectiles.reset();
  explosions.reset();
  shockwaves.reset();
  slowWorldTimer = 0;
  stage.reset();
  stage.setEasyMode(easyMode);
  stage.start(startStageId);
  if (DEV.invulnerable) player.invuln = 999999;
  gameState = 'playing';
  input.setMobileOverlayVisible(true);
}

function spawnDevBoss(config = null) {
  const fallback = STAGES.find(stageDef => stageDef.boss)?.boss
    || STAGES.find(stageDef => stageDef.bossRush?.length)?.bossRush?.[0]
    || { id: 'godarni', name: 'GODARNI', musicTrack: 6 };
  const bossConfig = config || stage.stageDef?.boss || stage.stageDef?.bossRush?.[0] || fallback;
  stage._clearActors?.();
  stage._destroyBoss?.();
  if (enemyProjectiles) enemyProjectiles.reset();
  stage.bossRushMode = false;
  stage.activeBossConfig = bossConfig;
  stage.state = 'bossFight';
  stage.stateElapsed = 0;
  stage._startBossFight?.();
  audio.playBossCue?.('intro');
  return snapshot();
}

function killDevBoss() {
  const boss = stage.getBoss?.();
  if (boss) {
    boss.alive = false;
    stage._updateBossFight?.(0.016, player);
  }
  return snapshot();
}

if (DEV.enabled) {
  window.__gameDebug = {
    stage,
    player,
    getState: snapshot,
    startStage(id = 1) { menu.classList.add('hidden'); startGame(Number(id)); return snapshot(); },
    addScore(points = 1000) { score += Number(points) || 0; hud.setScore(score); return snapshot(); },
    setInvulnerable(on = true) { player.invuln = on ? 999999 : 0; return snapshot(); },
    invincible(on = true) { return this.setInvulnerable(on); },
    skipStage() { stage._enterStageClear?.(); return snapshot(); },
    spawnBoss(config = null) { return spawnDevBoss(config); },
    killBoss() { return killDevBoss(); },
    setMobileMode(mode = 'sticks') { input.mobileAvailable = true; input.setMobileMode(mode); updateMobileModeButtons(); input.setMobileOverlayVisible(true); return snapshot(); },
    runStageSmoke(id = 1, seconds = 10) { return runStageSmoke(id, seconds); },
    runBossSmoke(id = Number(stageSelect?.value || 3), seconds = 3) { return runBossSmoke(id, seconds); },
    runBossMatrixSmoke(options = {}) { return runBossMatrixSmoke(options); },
    runBonusSmoke(options = {}) { return runBonusSmoke(options); },
    runCampaignSmoke(options = {}) { return runCampaignSmoke(options); },
    runPerformanceSmoke(options = {}) { return runPerformanceSmoke(options); },
    runEnduranceSmoke(options = {}) { return runEnduranceSmoke(options); },
    runFlowSmoke(options = {}) { return runFlowSmoke(options); },
    runPersistenceSmoke(options = {}) { return runPersistenceSmoke(options); },
    runEditorSmoke(options = {}) { return runEditorSmoke(options); },
    runInputSmoke(options = {}) { return runInputSmoke(options); },
    setPerfOverlay(on = true) { setPerfOverlay(on); return getPerfSnapshot(); },
    getPerfSnapshot,
    completeCampaign() { finishCampaign(); return snapshot(); },
    gameOver(points = score) { score = Number(points) || score; hud.setScore(score); finishGameOver(); return snapshot(); },
    pause: pauseGame,
    resume: resumeGame,
    mainMenu: returnToMainMenu,
    setEasyMode(on = true) { easyMode = !!on; localStorage.setItem('harrierEasyMode', easyMode ? '1' : '0'); updateEasyModeButton(); stage.setEasyMode(easyMode); return snapshot(); },
    inputSnapshot,
    snapshot
  };
  window.__harrierDebug = window.__gameDebug;
}

function runStageSmoke(id = 1, seconds = 10) {
  menu.classList.add('hidden');
  startGame(Number(id) || 1);
  player.invuln = 999999;
  return new Promise(resolve => {
    setTimeout(() => {
      const result = { ok: gameState === 'playing' && lives > 0, ...snapshot() };
      window.__qaResult = result;
      resolve(result);
    }, Math.max(0, Number(seconds) || 0) * 1000);
  });
}

function runBossSmoke(id = 3, seconds = 3) {
  const requestedId = Number(id) || 3;
  const bossStageDef = STAGES.find(stageDef => stageDef.id === requestedId && (stageDef.boss || stageDef.bossRush?.length))
    || STAGES.find(stageDef => stageDef.boss || stageDef.bossRush?.length);
  if (!bossStageDef) {
    const result = { ok: false, reason: 'no boss stage found', ...snapshot() };
    window.__qaResult = result;
    return Promise.resolve(result);
  }
  menu.classList.add('hidden');
  startGame(bossStageDef.id);
  player.invuln = 999999;
  if (bossStageDef.bossRush?.length) {
    stage._enterBossRushIntro?.();
    stage._startNextBossRushFight?.();
  } else {
    stage._enterBossIntro?.();
    stage._startBossFight?.();
  }
  return new Promise(resolve => {
    setTimeout(() => {
      const boss = stage.getBoss?.();
      const result = { ok: !!boss && boss.alive && stage.getState() === 'bossFight', ...snapshot() };
      window.__qaResult = result;
      resolve(result);
    }, Math.max(0, Number(seconds) || 0) * 1000);
  });
}

async function runBossMatrixSmoke(options = {}) {
  const stepMs = Math.max(0, Number(options.stepMs ?? 25) || 0);
  const result = {
    ok: false,
    checked: [],
    errors: []
  };

  menu.classList.add('hidden');
  player.invuln = 999999;

  for (const stageDef of STAGES) {
    if (stageDef.boss) {
      startGame(stageDef.id);
      player.invuln = 999999;
      stage._enterBossIntro?.();
      stage._startBossFight?.();
      await waitMs(stepMs);
      inspectBossForMatrix(result, stageDef.id, stageDef.boss, 'stage');
      forceBossClearForMatrix(result, stageDef.id, 'stageClear');
      await waitMs(stepMs);
    }

    if (stageDef.bossRush?.length) {
      startGame(stageDef.id);
      player.invuln = 999999;
      stage._enterBossRushIntro?.();
      await waitMs(stepMs);
      for (let i = 0; i < stageDef.bossRush.length; i++) {
        stage._startNextBossRushFight?.();
        await waitMs(stepMs);
        inspectBossForMatrix(result, stageDef.id, stageDef.bossRush[i], 'rush', i + 1);
        forceBossClearForMatrix(result, stageDef.id, 'bossRushRest');
        await waitMs(stepMs);
      }
      stage._startNextBossRushFight?.();
      await waitMs(stepMs);
      if (stage.getState() !== 'stageClear') {
        result.errors.push(`stage ${stageDef.id} boss rush did not resolve to stageClear`);
      }
    }
  }

  const uniqueIds = new Set(result.checked.map(entry => entry.id));
  result.ok = result.errors.length === 0
    && result.checked.length > 0
    && uniqueIds.size >= QA_PERFORMANCE_LIMITS.minBossRushBosses;
  result.uniqueBosses = [...uniqueIds];
  result.snapshot = snapshot();
  window.__qaResult = result;
  return result;
}

async function runBonusSmoke(options = {}) {
  const stepMs = Math.max(0, Number(options.stepMs ?? 25) || 0);
  const originalSave = saveStore.load();
  const originalScore = score;
  const originalLives = lives;
  const originalStage = Number(stage.stage) || 1;
  const result = {
    ok: false,
    checked: [],
    errors: []
  };

  try {
    menu.classList.add('hidden');
    const bonusStages = STAGES.filter(stageDef => stageDef.mode === 'bonus');
    if (!bonusStages.length) result.errors.push('no bonus stages found');
    for (const stageDef of bonusStages) {
      startGame(stageDef.id);
      await waitMs(stepMs);
      lives = 3;
      hud.setHealth(lives, MAX_LIVES);
      player.invuln = 0;
      centerPlayerForStageStart();
      stage.state = 'bonusRun';
      stage.elapsed = 0;
      stage.bonusMode.spawnTarget();
      const target = stage.bonusMode.targets[stage.bonusMode.targets.length - 1];
      if (!target) {
        result.errors.push(`stage ${stageDef.id} bonus target did not spawn`);
        continue;
      }
      target.position.copy(player.position);
      target.speedZ = 0;
      const beforeScore = score;
      const beforeLives = lives;
      stage.update(0.016, player);
      await waitMs(stepMs);
      const entry = {
        stageId: stageDef.id,
        targetSet: stageDef.bonus?.targetSet || 'default',
        scoreDelta: score - beforeScore,
        livesBefore: beforeLives,
        livesAfter: lives,
        enemies: stage.getEnemies().length,
        obstacles: stage.getObstacles().length,
        targetsRemaining: stage.bonusMode.targets.length
      };
      result.checked.push(entry);
      if (!(entry.scoreDelta > 0)) result.errors.push(`stage ${stageDef.id} bonus target did not award score`);
      if (entry.livesAfter !== entry.livesBefore) result.errors.push(`stage ${stageDef.id} bonus target damaged the player`);
      if (entry.enemies !== 0 || entry.obstacles !== 0) result.errors.push(`stage ${stageDef.id} bonus run spawned combat hazards`);
    }
  } catch (error) {
    result.errors.push(error?.message || String(error));
  } finally {
    saveData = saveStore.restore(originalSave);
    highScore = saveData.highScore || 0;
    score = originalScore;
    lives = originalLives;
    hud.setScore(score);
    hud.setHealth(lives, MAX_LIVES);
    refreshSaveUi(String(originalStage));
    returnToMainMenu();
  }

  result.ok = result.errors.length === 0
    && result.checked.length === STAGES.filter(stageDef => stageDef.mode === 'bonus').length
    && result.checked.every(entry => entry.scoreDelta > 0 && entry.livesAfter === entry.livesBefore);
  result.snapshot = snapshot();
  window.__qaResult = result;
  return result;
}

function inspectBossForMatrix(result, stageId, config, route, index = null) {
  const boss = stage.getBoss?.();
  const id = config?.id || boss?.name || 'unknown';
  const label = index ? `stage ${stageId} ${route} boss ${index}` : `stage ${stageId} ${route} boss`;
  if (!boss) {
    result.errors.push(`${label} did not spawn`);
    return;
  }
  const hitSpheres = typeof boss.getHitSpheres === 'function' ? boss.getHitSpheres() : [];
  const collisionSpheres = typeof boss.getCollisionSpheres === 'function' ? boss.getCollisionSpheres() : [];
  const shootables = stage.getShootables?.() || [];
  const vulnerableSpheres = hitSpheres.filter(sphere => sphere.vulnerable !== false);
  const blockedSpheres = hitSpheres.filter(sphere => sphere.vulnerable === false);
  const entry = {
    id,
    name: boss.name || config?.name || id,
    stageId,
    route,
    index,
    hitSpheres: hitSpheres.length,
    vulnerableSpheres: vulnerableSpheres.length,
    blockedSpheres: blockedSpheres.length,
    collisionSpheres: collisionSpheres.length,
    shootable: shootables.includes(boss),
    weakPointRing: !!boss.weakPointRing,
    health: boss.health,
    maxHealth: boss.maxHealth
  };
  result.checked.push(entry);
  if (!boss.alive) result.errors.push(`${label} spawned dead`);
  if (!(boss.health > 0) || !(boss.maxHealth > 0)) result.errors.push(`${label} has invalid health`);
  if (!hitSpheres.length) result.errors.push(`${label} exposes no hit spheres`);
  if (!vulnerableSpheres.length) result.errors.push(`${label} exposes no vulnerable hit sphere`);
  if (!collisionSpheres.length) result.errors.push(`${label} exposes no collision spheres`);
  if (!entry.shootable) result.errors.push(`${label} is not included in stage shootables`);
  if (!entry.weakPointRing) result.errors.push(`${label} has no weak-point ring`);
  if (blockedSpheres.length) {
    const healthBefore = boss.health;
    boss.hit?.(1, { enemy: boss, sphere: blockedSpheres[0], point: blockedSpheres[0].center });
    if (boss.health !== healthBefore) result.errors.push(`${label} non-vulnerable ${blockedSpheres[0].part || 'part'} accepted damage`);
  }
  if (vulnerableSpheres.length && boss.canBeHit?.({ enemy: boss, sphere: vulnerableSpheres[0], point: vulnerableSpheres[0].center })) {
    const healthBefore = boss.health;
    boss.hit?.(1, { enemy: boss, sphere: vulnerableSpheres[0], point: vulnerableSpheres[0].center });
    if (!(boss.health < healthBefore)) result.errors.push(`${label} vulnerable ${vulnerableSpheres[0].part || 'part'} did not accept damage`);
  }
}

function forceBossClearForMatrix(result, stageId, expectedState) {
  const boss = stage.getBoss?.();
  if (boss) boss.alive = false;
  stage._updateBossFight?.(0.016, player);
  if (stage.getState() !== expectedState) {
    result.errors.push(`stage ${stageId} boss clear expected ${expectedState}, found ${stage.getState()}`);
  }
}

function waitMs(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function runCampaignSmoke(options = {}) {
  const stepMs = Math.max(0, Number(options.stepMs ?? 25) || 0);
  const result = {
    ok: false,
    visited: [],
    bossStages: [],
    bonusStages: [],
    bossRushBosses: 0,
    errors: []
  };

  menu.classList.add('hidden');
  startGame(1);
  player.invuln = 999999;

  for (const stageDef of STAGES) {
    stage.start(stageDef.id);
    player.invuln = 999999;
    await waitMs(stepMs);
    result.visited.push(stageDef.id);
    if (stageDef.mode === 'bonus') result.bonusStages.push(stageDef.id);

    if (stageDef.bossRush?.length) {
      stage._enterBossRushIntro?.();
      result.bossRushBosses = stageDef.bossRush.length;
      for (let i = 0; i < stageDef.bossRush.length; i++) {
        stage._startNextBossRushFight?.();
        await waitMs(stepMs);
        const boss = stage.getBoss?.();
        if (!boss) {
          result.errors.push(`stage ${stageDef.id} boss rush entry ${i + 1} did not spawn`);
          continue;
        }
        boss.alive = false;
        stage._updateBossFight?.(0.016, player);
        await waitMs(stepMs);
      }
      stage._startNextBossRushFight?.();
    } else if (stageDef.boss) {
      result.bossStages.push(stageDef.id);
      stage._enterBossIntro?.();
      stage._startBossFight?.();
      await waitMs(stepMs);
      const boss = stage.getBoss?.();
      if (!boss) {
        result.errors.push(`stage ${stageDef.id} boss did not spawn`);
      } else {
        boss.alive = false;
        stage._updateBossFight?.(0.016, player);
      }
    } else {
      stage._enterStageClear?.();
    }

    await waitMs(stepMs);
  }

  finishCampaign();
  await waitMs(stepMs);
  Object.assign(result, {
    ok: result.errors.length === 0
      && result.visited.length === STAGES.length
      && result.visited.length >= QA_PERFORMANCE_LIMITS.minCampaignStages
      && result.bossRushBosses >= QA_PERFORMANCE_LIMITS.minBossRushBosses
      && gameState === 'ending',
    snapshot: snapshot()
  });
  window.__qaResult = result;
  return result;
}

async function runPerformanceSmoke(options = {}) {
  const seconds = Math.max(1, Number(options.seconds ?? 8) || 8);
  const stageId = Number(options.stageId ?? 18) || 18;
  const warmupMs = Math.max(0, Number(options.warmupMs ?? 3200) || 0);
  menu.classList.add('hidden');
  startGame(stageId);
  player.invuln = 999999;
  await waitMs(warmupMs);
  resetPerfStats();
  await waitMs(seconds * 1000);
  const caps = stage.getActorCaps?.() || {};
  const stats = getPerfSnapshot();
  const result = {
    ok: stats.frames > 0
      && stats.minFps >= QA_PERFORMANCE_LIMITS.minFps
      && stats.actorPeaks.enemies <= (caps.enemies ?? Infinity)
      && stats.actorPeaks.obstacles <= (caps.obstacles ?? Infinity)
      && stats.actorPeaks.pickups <= (caps.pickups ?? Infinity)
      && stats.actorPeaks.enemyProjectiles <= QA_PERFORMANCE_LIMITS.maxEnemyProjectiles
      && stats.actorPeaks.playerProjectiles <= QA_PERFORMANCE_LIMITS.maxPlayerProjectiles,
    stageId,
    seconds,
    warmupMs,
    stats,
    renderer: stats.renderer,
    caps,
    snapshot: snapshot()
  };
  window.__qaResult = result;
  return result;
}

async function runEnduranceSmoke(options = {}) {
  const cycles = Math.max(2, Math.min(20, Number(options.cycles ?? 3) || 3));
  const seconds = Math.max(1, Number(options.seconds ?? 4) || 4);
  const stageId = Number(options.stageId ?? 18) || 18;
  const stepMs = Math.max(0, Number(options.stepMs ?? 30) || 0);
  const warmupMs = Math.max(0, Number(options.warmupMs ?? 3200) || 0);
  const result = {
    ok: false,
    stageId,
    cycles,
    seconds,
    warmupMs,
    samples: [],
    errors: []
  };

  menu.classList.add('hidden');
  for (let cycle = 0; cycle < cycles; cycle++) {
    resetPerfStats();
    startGame(stageId);
    player.invuln = 999999;
    await waitMs(warmupMs);
    resetPerfStats();
    await waitMs(seconds * 1000);
    const stats = getPerfSnapshot();
    result.samples.push({
      cycle: cycle + 1,
      stats,
      renderer: stats.renderer,
      snapshot: snapshot()
    });
    if (stats.frames <= 0) result.errors.push(`cycle ${cycle + 1} rendered no frames`);
    if (stats.minFps < QA_PERFORMANCE_LIMITS.minFps) result.errors.push(`cycle ${cycle + 1} min FPS ${stats.minFps} below ${QA_PERFORMANCE_LIMITS.minFps}`);
    returnToMainMenu();
    await waitMs(stepMs);
  }

  const first = result.samples[0]?.renderer?.memory || {};
  const last = result.samples[result.samples.length - 1]?.renderer?.memory || {};
  result.memoryDelta = {
    geometries: (last.geometries || 0) - (first.geometries || 0),
    textures: (last.textures || 0) - (first.textures || 0)
  };
  if (result.memoryDelta.geometries > QA_PERFORMANCE_LIMITS.maxEnduranceGeometryGrowth) {
    result.errors.push(`geometry count grew by ${result.memoryDelta.geometries}`);
  }
  if (result.memoryDelta.textures > QA_PERFORMANCE_LIMITS.maxEnduranceTextureGrowth) {
    result.errors.push(`texture count grew by ${result.memoryDelta.textures}`);
  }
  result.ok = result.errors.length === 0;
  result.snapshot = snapshot();
  window.__qaResult = result;
  return result;
}

async function runFlowSmoke(options = {}) {
  const stepMs = Math.max(0, Number(options.stepMs ?? 30) || 0);
  const originalSave = saveStore.load();
  const originalScore = score;
  const originalLives = lives;
  const originalStage = Number(stage.stage) || 1;
  const result = {
    ok: false,
    checks: {},
    errors: []
  };

  try {
    menu.classList.add('hidden');
    startGame(2);
    player.invuln = 999999;
    score = 2345;
    hud.setScore(score);
    finishGameOver();
    await waitMs(stepMs);
    result.checks.gameOver = gameState === 'gameover' && saveStore.load().highScore >= 2345;
    if (!result.checks.gameOver) result.errors.push('game over did not persist high score');

    continueFromGameOver();
    await waitMs(stepMs);
    result.checks.continue = gameState === 'playing' && Number(stage.stage) === 2;
    if (!result.checks.continue) result.errors.push('continue did not restart failed stage');

    score = 3456;
    hud.setScore(score);
    finishCampaign();
    await waitMs(stepMs);
    const completedSave = saveStore.load();
    result.checks.ending = gameState === 'ending' && completedSave.highScore >= 3456 && completedSave.completionCount >= (originalSave.completionCount || 0) + 1;
    if (!result.checks.ending) result.errors.push('ending did not persist completion/high score');

    result.checks.inputSnapshot = !!window.__gameDebug?.inputSnapshot?.();
    if (!result.checks.inputSnapshot) result.errors.push('input snapshot unavailable');
    result.checks.settings = typeof audio.getSettings === 'function' && typeof setCameraFollowMode === 'function' && typeof startHeadTracking === 'function';
    if (!result.checks.settings) result.errors.push('settings callbacks unavailable');
  } catch (error) {
    result.errors.push(error?.message || String(error));
  } finally {
    saveData = saveStore.restore(originalSave);
    highScore = saveData.highScore || 0;
    score = originalScore;
    lives = originalLives;
    hud.setScore(score);
    hud.setHealth(lives, MAX_LIVES);
    refreshSaveUi(String(originalStage));
    returnToMainMenu();
  }

  result.ok = result.errors.length === 0 && Object.values(result.checks).every(Boolean);
  result.snapshot = snapshot();
  window.__qaResult = result;
  return result;
}

async function runPersistenceSmoke(options = {}) {
  const stepMs = Math.max(0, Number(options.stepMs ?? 20) || 0);
  const originalSave = saveStore.load();
  const originalSettings = audio.getSettings();
  const originalEasy = easyMode;
  const originalCameraFollow = cameraFollowMode;
  const originalStage = Number(stage.stage) || 1;
  const result = {
    ok: false,
    checks: {},
    errors: []
  };

  try {
    const expectedSave = saveStore.recordRunComplete(98765, 18);
    await waitMs(stepMs);
    const loadedSave = saveStore.load();
    result.checks.highScoreRoundTrip = loadedSave.highScore >= 98765;
    if (!result.checks.highScoreRoundTrip) result.errors.push('high score did not round-trip through localStorage');
    result.checks.bestStageRoundTrip = loadedSave.bestStageReached >= 18;
    if (!result.checks.bestStageRoundTrip) result.errors.push('best stage did not round-trip through localStorage');
    result.checks.completionRoundTrip = loadedSave.completionCount >= expectedSave.completionCount;
    if (!result.checks.completionRoundTrip) result.errors.push('completion count did not round-trip through localStorage');

    const musicLevel = 0.37;
    const sfxLevel = 0.41;
    audio.setMusicVolume(musicLevel);
    audio.setSfxVolume(sfxLevel);
    await waitMs(stepMs);
    const reloadedAudio = new AudioBus();
    result.checks.musicSettingRoundTrip = Math.abs(reloadedAudio.getSettings().music - musicLevel) < 0.001;
    if (!result.checks.musicSettingRoundTrip) result.errors.push('music setting did not round-trip through localStorage');
    result.checks.sfxSettingRoundTrip = Math.abs(reloadedAudio.getSettings().sfx - sfxLevel) < 0.001;
    if (!result.checks.sfxSettingRoundTrip) result.errors.push('sfx setting did not round-trip through localStorage');

    easyMode = true;
    localStorage.setItem('harrierEasyMode', '1');
    cameraFollowMode = false;
    localStorage.setItem('harrierCameraFollow', '0');
    result.checks.easyModeRoundTrip = localStorage.getItem('harrierEasyMode') === '1';
    if (!result.checks.easyModeRoundTrip) result.errors.push('easy mode setting did not persist');
    result.checks.cameraFollowRoundTrip = localStorage.getItem('harrierCameraFollow') === '0';
    if (!result.checks.cameraFollowRoundTrip) result.errors.push('camera follow setting did not persist');
  } catch (error) {
    result.errors.push(error?.message || String(error));
  } finally {
    saveData = saveStore.restore(originalSave);
    highScore = saveData.highScore || 0;
    audio.setMusicVolume(originalSettings.music);
    audio.setSfxVolume(originalSettings.sfx);
    easyMode = originalEasy;
    localStorage.setItem('harrierEasyMode', easyMode ? '1' : '0');
    cameraFollowMode = originalCameraFollow;
    localStorage.setItem('harrierCameraFollow', cameraFollowMode ? '1' : '0');
    updateEasyModeButton();
    updateCameraFollowButton();
    stage.setEasyMode(easyMode);
    refreshSaveUi(String(originalStage));
    returnToMainMenu();
  }

  result.ok = result.errors.length === 0 && Object.values(result.checks).every(Boolean);
  result.snapshot = snapshot();
  window.__qaResult = result;
  return result;
}

async function runEditorSmoke(options = {}) {
  const stepMs = Math.max(0, Number(options.stepMs ?? 20) || 0);
  const storageKey = 'harrierCustomLevels';
  const originalLevelsRaw = window.localStorage?.getItem(storageKey);
  const originalEditorLevel = editorLevel ? normalizeLevel(editorLevel) : null;
  const originalSelectedAnchorId = selectedAnchorId;
  const result = {
    ok: false,
    checks: {},
    errors: []
  };

  try {
    const level = createBlankLevel({
      name: 'QA Editor Smoke',
      musicTrack: 7,
      theme: 'biomech',
      procedural: {
        enemyDensity: 1.4,
        obstacleDensity: 1.2,
        pickupDensity: 1.3,
        speedScale: 1.33,
        formations: ['line', 'v', 'arc']
      },
      map: [
        { kind: 'object', type: 'column', x: -0.55, y: 0.28, weight: 2 },
        { kind: 'item', type: 'bomb', x: 0.15, y: 0.46, weight: 1.5 },
        { kind: 'enemy', type: 'laneDiver', x: 0.62, y: 0.68, weight: 3 }
      ]
    });

    editorLevel = level;
    selectedAnchorId = level.map[0]?.id || null;
    renderEditor();
    await waitMs(stepMs);
    const saved = levelStore.saveLevel(editorLevel);
    const loaded = levelStore.getLevel(saved.id);
    result.checks.saveLoad = !!loaded && loaded.name === 'QA Editor Smoke' && loaded.map.length === 3;
    if (!result.checks.saveLoad) result.errors.push('editor level did not save/load with all anchors');

    const stageDef = levelToStageDef(loaded);
    result.checks.stageConversion = !!stageDef.custom
      && stageDef.name === loaded.name
      && stageDef.musicTrack === 7
      && stageDef.worldTheme === 'biomech'
      && stageDef.spawn.enemyTypes.some(entry => entry.type === 'laneDiver')
      && stageDef.obstacles.entries.some(entry => entry.type === 'column')
      && stageDef.mapAnchors.length === 3;
    if (!result.checks.stageConversion) result.errors.push('editor level did not convert to a playable custom stage definition');

    const duplicate = levelStore.saveLevel(createBlankLevel({ ...loaded, id: undefined, name: `${loaded.name} Copy`, createdAt: undefined }));
    result.checks.duplicate = !!duplicate.id && duplicate.id !== loaded.id && duplicate.name.endsWith('Copy');
    if (!result.checks.duplicate) result.errors.push('editor duplicate did not create a distinct saved level');

    const payload = {
      type: '3d-harrier-level',
      exportedAt: new Date().toISOString(),
      level: normalizeLevel(loaded)
    };
    const imported = createBlankLevel({
      ...normalizeLevel(payload.level),
      id: undefined,
      name: `${payload.level.name} Import`,
      createdAt: undefined,
      updatedAt: undefined
    });
    const savedImport = levelStore.saveLevel(imported);
    result.checks.importPayload = payload.type === '3d-harrier-level'
      && savedImport.name.endsWith('Import')
      && savedImport.map.length === loaded.map.length;
    if (!result.checks.importPayload) result.errors.push('editor import/export payload did not normalize correctly');

    levelStore.deleteLevel(saved.id);
    levelStore.deleteLevel(duplicate.id);
    levelStore.deleteLevel(savedImport.id);
    result.checks.delete = !levelStore.getLevel(saved.id) && !levelStore.getLevel(duplicate.id) && !levelStore.getLevel(savedImport.id);
    if (!result.checks.delete) result.errors.push('editor delete did not remove saved smoke levels');

    result.summary = {
      savedId: saved.id,
      duplicateId: duplicate.id,
      importedId: savedImport.id,
      enemyTypes: stageDef.spawn.enemyTypes,
      obstacleEntries: stageDef.obstacles.entries,
      mapAnchors: stageDef.mapAnchors.length
    };
  } catch (error) {
    result.errors.push(error?.message || String(error));
  } finally {
    if (originalLevelsRaw === null || originalLevelsRaw === undefined) {
      window.localStorage?.removeItem(storageKey);
    } else {
      window.localStorage?.setItem(storageKey, originalLevelsRaw);
    }
    editorLevel = originalEditorLevel || levelStore.listLevels()[0] || createBlankLevel();
    selectedAnchorId = originalSelectedAnchorId;
    refreshLevelLoadSelect();
    renderEditor();
  }

  result.ok = result.errors.length === 0 && Object.values(result.checks).every(Boolean);
  result.snapshot = snapshot();
  window.__qaResult = result;
  return result;
}

async function runInputSmoke(options = {}) {
  const stepMs = Math.max(0, Number(options.stepMs ?? 20) || 0);
  const original = {
    gameState,
    mobileAvailable: input.mobileAvailable,
    mobileMode: input.mobileMode,
    overlay: input.mobileOverlayVisible,
    cameraFollow: cameraFollowMode,
    cinematic: headTracker.autoOrbit,
    gyroEnabled: input.gyroEnabled,
    gyroPermission: input.gyroPermission,
    camStatus: camStatus?.textContent || ''
  };
  const result = {
    ok: false,
    checks: {},
    gamepads: 0,
    errors: []
  };

  try {
    result.checks.inputSnapshot = !!inputSnapshot();
    gameState = 'playing';
    input.mobileAvailable = true;
    input.setMobileMode('sticks');
    input.setMobileOverlayVisible(true);
    updateMobileModeButtons();
    await waitMs(stepMs);
    result.checks.mobileOverlay = input.mobileMode === 'sticks'
      && input.mobileOverlayVisible === true
      && document.body.classList.contains('mobile-controls-active');
    if (!result.checks.mobileOverlay) result.errors.push('mobile overlay did not enter sticks mode');

    const headResult = await startHeadTracking();
    result.checks.headTrackingMobileGuard = headResult === false && /mobile|gyro/i.test(camStatus?.textContent || '');
    if (!result.checks.headTrackingMobileGuard) result.errors.push('head tracking mobile guard did not return the gyro fallback path');

    const cameraOff = setCameraFollowMode(false) === false;
    const cameraOn = setCameraFollowMode(true) === true;
    result.checks.cameraFollowToggle = cameraOff && cameraOn;
    if (!result.checks.cameraFollowToggle) result.errors.push('camera follow toggle failed');

    const cinematicOn = setCinematicMode(true) === true;
    const cinematicOff = setCinematicMode(false) === false;
    result.checks.cinematicToggle = cinematicOn && cinematicOff;
    if (!result.checks.cinematicToggle) result.errors.push('cinematic toggle failed');

    const pads = typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
    result.gamepads = pads.length;
    result.checks.gamepadApi = typeof navigator.getGamepads === 'function';
    if (!result.checks.gamepadApi) result.errors.push('gamepad API unavailable');

    result.checks.gyroViewOnly = input.gyro?.x === 0 && input.gyro?.y === 0 && typeof input.enableGyro === 'function' && typeof input.disableGyro === 'function';
    if (!result.checks.gyroViewOnly) result.errors.push('gyro should remain view-only and expose enable/disable hooks');

    result.checks.pauseSettings = typeof audio.getSettings === 'function'
      && typeof audio.setMusicVolume === 'function'
      && typeof audio.setSfxVolume === 'function'
      && typeof setGyroMode === 'function';
    if (!result.checks.pauseSettings) result.errors.push('pause/settings callbacks unavailable');
  } catch (error) {
    result.errors.push(error?.message || String(error));
  } finally {
    input.mobileAvailable = original.mobileAvailable;
    input.setMobileMode(original.mobileMode);
    input.setMobileOverlayVisible(original.overlay);
    input.gyroEnabled = original.gyroEnabled;
    input.gyroPermission = original.gyroPermission;
    document.body.classList.toggle('gyro-enabled', !!original.gyroEnabled);
    setCameraFollowMode(original.cameraFollow);
    setCinematicMode(original.cinematic);
    if (camStatus) camStatus.textContent = original.camStatus;
    gameState = original.gameState;
    updateMobileModeButtons();
  }

  result.ok = result.errors.length === 0 && Object.values(result.checks).every(Boolean);
  result.snapshot = inputSnapshot();
  window.__qaResult = result;
  return result;
}

function snapshot() {
  return { gameState, score, lives, easyMode, stage: stage.stage, stageName: stage.stageName, stageState: stage.getState(), stageHits, stagesCleared, campaignStages: getCampaignStageCount(), bestStageReached: saveData.bestStageReached, highScore, enemies: stage.getEnemies().length, obstacles: stage.getObstacles().length, pickups: stage.getPickups().length, playerProjectiles: projectiles.getActiveCount?.() ?? 0, enemyProjectiles: enemyProjectiles.getActiveCount?.() ?? 0, actorCaps: stage.getActorCaps?.() || null, perf: getPerfSnapshot(), boss: stage.getBoss()?.name || null };
}

function inputSnapshot() {
  return {
    move: { ...input.move },
    aim: { ...input.aim },
    fire: input.fire,
    bomb: input.bomb,
    mode: input.mobileMode,
    mobileAvailable: input.mobileAvailable,
    gyroEnabled: input.gyroEnabled,
    gyroPermission: input.gyroPermission,
    gyroView: { ...input.gyroView },
    touchAimActive: input.touchAimActive,
    overlay: input.mobileOverlayVisible,
    gamepadAimActive: input.gamepadAimActive,
    gamepads: typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()).filter(Boolean).length : 0
  };
}

function createPerfStats() {
  return {
    frames: 0,
    elapsed: 0,
    minFps: Infinity,
    avgFps: 0,
    maxDtMs: 0,
    actorPeaks: {
      enemies: 0,
      obstacles: 0,
      pickups: 0,
      playerProjectiles: 0,
      enemyProjectiles: 0
    }
  };
}

function resetPerfStats() {
  Object.assign(perfStats, createPerfStats());
}

function updatePerfStats(rawDt) {
  perfStats.frames++;
  perfStats.elapsed += rawDt;
  const fps = rawDt > 0 ? 1 / rawDt : 0;
  perfStats.minFps = Math.min(perfStats.minFps, fps);
  perfStats.avgFps = perfStats.elapsed > 0 ? perfStats.frames / perfStats.elapsed : 0;
  perfStats.maxDtMs = Math.max(perfStats.maxDtMs, rawDt * 1000);
  perfStats.actorPeaks.enemies = Math.max(perfStats.actorPeaks.enemies, stage.getEnemies().length);
  perfStats.actorPeaks.obstacles = Math.max(perfStats.actorPeaks.obstacles, stage.getObstacles().length);
  perfStats.actorPeaks.pickups = Math.max(perfStats.actorPeaks.pickups, stage.getPickups().length);
  perfStats.actorPeaks.playerProjectiles = Math.max(perfStats.actorPeaks.playerProjectiles, projectiles.getActiveCount?.() ?? 0);
  perfStats.actorPeaks.enemyProjectiles = Math.max(perfStats.actorPeaks.enemyProjectiles, enemyProjectiles.getActiveCount?.() ?? 0);
}

function getPerfSnapshot() {
  return {
    frames: perfStats.frames,
    elapsed: Number(perfStats.elapsed.toFixed(3)),
    minFps: Number((Number.isFinite(perfStats.minFps) ? perfStats.minFps : 0).toFixed(1)),
    avgFps: Number(perfStats.avgFps.toFixed(1)),
    maxDtMs: Number(perfStats.maxDtMs.toFixed(1)),
    actorPeaks: { ...perfStats.actorPeaks },
    renderer: getRendererStats()
  };
}

function getRendererStats() {
  const info = renderer.info || {};
  const memory = info.memory || {};
  const render = info.render || {};
  return {
    memory: {
      geometries: Number(memory.geometries) || 0,
      textures: Number(memory.textures) || 0
    },
    render: {
      calls: Number(render.calls) || 0,
      triangles: Number(render.triangles) || 0,
      points: Number(render.points) || 0,
      lines: Number(render.lines) || 0
    },
    pixelRatio: Number(renderer.getPixelRatio?.().toFixed?.(2) || renderer.getPixelRatio?.() || 1)
  };
}

function getActorCounts() {
  return {
    enemies: stage.getEnemies().length,
    obstacles: stage.getObstacles().length,
    pickups: stage.getPickups().length,
    playerProjectiles: projectiles.getActiveCount?.() ?? 0,
    enemyProjectiles: enemyProjectiles.getActiveCount?.() ?? 0
  };
}

function setPerfOverlay(on) {
  perfOverlayEnabled = !!on;
  try { localStorage.setItem(PERF_OVERLAY_STORAGE_KEY, perfOverlayEnabled ? '1' : '0'); } catch {}
  hud.showPerfOverlay(perfOverlayEnabled);
}

function updatePerfHud(rawDt) {
  if (!perfOverlayEnabled) return;
  perfHudAccumulator += rawDt;
  if (perfHudAccumulator < 0.18) return;
  perfHudAccumulator = 0;
  hud.setPerf({
    ...getPerfSnapshot(),
    fps: rawDt > 0 ? 1 / rawDt : 0,
    frameMs: rawDt * 1000,
    actors: getActorCounts(),
    gameState,
    stageState: stage.getState?.() || ''
  });
}

// ---------- Bomb / pickup callbacks ----------
function detonateBomb() {
  if (!player.consumeBomb()) return;
  hud.setBombs(player.bombs);
  hud.flashBomb();
  audio.playBomb();
  shockwaves.spawn(player.position.clone(), 0xffffff, 110, 0.7);
  const targets = stage.getShootables();
  for (const target of targets) {
    if (!target.alive || target.destructible === false) continue;
    if (target.isBoss || target.maxHealth) {
      const killed = typeof target.hit === 'function' ? target.hit(Math.max(8, Math.round((target.maxHealth || 40) * 0.16))) : false;
      if (killed) onEnemyKilled(target);
      continue;
    }
    target.alive = false;
    onEnemyKilled(target);
  }
}

function onPickupCollected(pickup) {
  audio.playPickup();
  if (pickup.type === 'multishot') {
    player.setWeapon('multishot', 18);
  } else if (pickup.type === 'laser') {
    player.setWeapon('laser', 14);
  } else if (pickup.type === 'bomb') {
    player.addBomb();
    hud.setBombs(player.bombs);
  } else if (pickup.type === 'health') {
    if (easyMode) {
      easyHealth = EASY_HEALTH_MAX;
      hud.setHealthBar(easyHealth);
    } else if (lives < MAX_LIVES) {
      lives = Math.min(MAX_LIVES, lives + 1);
      hud.setHealth(lives, MAX_LIVES);
    }
  } else if (pickup.type === 'slow') {
    slowWorldTimer = 10;
  } else if (pickup.type === 'invincible') {
    player.activateInvincibility(10);
  }
}

function checkPickupCollisions() {
  if (!player.alive) return;
  const pickups = stage.getPickups();
  for (const p of pickups) {
    if (!p.alive) continue;
    const dx = p.position.x - player.position.x;
    const dy = p.position.y - player.position.y;
    const dz = p.position.z - player.position.z;
    const r = p.radius + 1.5;
    if (dx*dx + dy*dy + dz*dz < r * r) {
      p.alive = false;
      onPickupCollected(p);
    }
  }
}

function onPlayerHit() {
  stageHits++;
  lives--;
  hud.setHealth(lives, MAX_LIVES);
  explosions.spawn(player.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff5566);
  audio.playExplosion();
  if (lives <= 0) {
    player.die(audio);
    setTimeout(() => {
      if (gameState === 'playing' || gameState === 'paused') {
        finishGameOver();
      }
    }, 1300);
  }
}

function onEnemyKilled(enemy) {
  score += enemy.scoreValue ?? 100;
  hud.setScore(score);
  explosions.spawn(enemy.position.clone(), 0xffaa33);
  audio.playExplosion();
}

function continueFromGameOver() {
  const stageId = Number(stage.stage) || Number(stageSelect?.value || currentRunStartStage || 1);
  menu.classList.add('hidden');
  startGame(stageId);
}

function finishGameOver() {
  gameState = 'gameover';
  saveData = saveStore.recordScore(score, stage.stage);
  highScore = saveData.highScore || highScore;
  refreshSaveUi();
  input.setMobileOverlayVisible(false);
  const subtitle = `HI ${String(highScore).padStart(6, '0')} · BEST ${String(saveData.bestStageReached || 1).padStart(2, '0')}`;
  hud.showGameOver(score, continueFromGameOver, 'GAME OVER', subtitle, returnToMainMenu, { restartLabel: 'CONTINUE' });
}

function finishCampaign() {
  gameState = 'ending';
  saveData = saveStore.recordRunComplete(score, stage.stage);
  highScore = saveData.highScore;
  refreshSaveUi();
  input.setMobileOverlayVisible(false);
  hud.showEnding({
    score,
    highScore,
    completionCount: saveData.completionCount,
    bestStageReached: saveData.bestStageReached
  }, () => {
    menu.classList.add('hidden');
    startGame(currentRunStartStage || Number(stageSelect?.value || 1));
  }, returnToMainMenu);
}

// ---------- Aim resolution ----------
// Hitscan ray from the CURRENT rendering eye through the reticle's
// position on the screen plane (z=0). Using renderEye (not a fixed
// neutral eye) keeps the sight line consistent with what the user
// visually sees through the off-axis camera, regardless of head tracking
// or cinematic orbit. The bullet trajectory is cosmetic — Player._fire
// raycasts this ray against every enemy and ends the tracer at the hit.
const aimWorld     = new THREE.Vector3();
const aimRayOrigin = new THREE.Vector3();
const aimRayDir    = new THREE.Vector3();
const AIM_TARGET_Z = -100;

function updateAim() {
  let ax, ay, gamepad = false;
  if (input.gamepadAimActive) {
    ax = input.aim.x;
    ay = input.aim.y;
    reticleX = (ax + 1) * 0.5 * window.innerWidth;
    reticleY = (1 - (ay + 1) * 0.5) * window.innerHeight;
    gamepad = true;
  } else {
    ax =  (reticleX / window.innerWidth)  * 2 - 1;
    ay = -((reticleY / window.innerHeight) * 2 - 1);
  }

  const aspect = window.innerHeight / window.innerWidth;
  const screenH_cm = screenW_cm * aspect;
  const sx = ax * screenW_cm * 0.5;
  const sy = ay * screenH_cm * 0.5;

  // Ray from renderEye through (sx, sy, 0)
  aimRayOrigin.copy(renderEye);
  aimRayDir.set(sx - renderEye.x, sy - renderEye.y, 0 - renderEye.z).normalize();

  // World point at target depth along the ray (for HUD / reticle world pos)
  const tToTarget = (AIM_TARGET_Z - renderEye.z) / aimRayDir.z;
  aimWorld.copy(renderEye).addScaledVector(aimRayDir, tToTarget);

  input.aimWorld     = aimWorld;
  input.aimRayOrigin = aimRayOrigin;
  input.aimRayDir    = aimRayDir;
  input.aimScreen    = { x: ax, y: ay };

  hud.setReticlePosition(reticleX, reticleY, gamepad);
}

// ---------- Render loop ----------
let lastT = performance.now();
function loop() {
  const now = performance.now();
  const rawDt = (now - lastT) / 1000;
  let dt = rawDt;
  lastT = now;
  if (dt > 0.1) dt = 0.1;
  updatePerfStats(rawDt);

  headTracker.update(now);
  input.setMobileOverlayVisible(gameState === 'playing');

  const aspect = window.innerHeight / window.innerWidth;
  const screenH_cm = screenW_cm * aspect;

  // Pick head influence + clamp based on state and whether cinematic is on.
  // With aim hitscanned through a fixed neutral eye, the camera can swing
  // more freely without breaking gameplay.
  const isGame = (gameState === 'playing' || gameState === 'paused' || gameState === 'gameover' || gameState === 'ending');
  const orbit  = headTracker.autoOrbit;
  let inf, clamp;
  if (orbit && isGame)  { inf = HEAD_ORBIT_GAME_INFLUENCE; clamp = HEAD_ORBIT_GAME_CLAMP_CM; }
  else if (orbit)       { inf = HEAD_ORBIT_MENU_INFLUENCE; clamp = HEAD_ORBIT_MENU_CLAMP_CM; }
  else if (isGame)      { inf = HEAD_TRACK_GAME_INFLUENCE; clamp = HEAD_TRACK_GAME_CLAMP_CM; }
  else                  { inf = HEAD_TRACK_MENU_INFLUENCE; clamp = HEAD_TRACK_MENU_CLAMP_CM; }

  const rawEye = headTracker.eye;
  const gyroX = (!headTracker.active && input.gyroEnabled) ? input.gyroView.x * 13 : 0;
  const gyroY = (!headTracker.active && input.gyroEnabled) ? input.gyroView.y * 7 : 0;
  const followActive = cameraFollowMode && (gameState === 'playing' || gameState === 'paused');
  const targetFollowX = followActive ? player.position.x * 0.16 : 0;
  const targetFollowY = followActive ? player.position.y * 0.13 : 0;
  const followEase = Math.min(1, dt * 4.5);
  cameraFollowEye.x += (targetFollowX - cameraFollowEye.x) * followEase;
  cameraFollowEye.y += (targetFollowY - cameraFollowEye.y) * followEase;

  // Camera dollies forward with the player during sprint - chases after with a delay
  if (typeof sprintForwardOffset !== 'undefined') {
    cameraSprintZ = THREE.MathUtils.lerp(cameraSprintZ || 0, sprintForwardOffset * 0.75, 0.035);
  }

  renderEye.set(
    Math.max(-clamp, Math.min(clamp, rawEye.x * inf + gyroX + cameraFollowEye.x)),
    Math.max(-clamp, Math.min(clamp, rawEye.y * inf + gyroY + cameraFollowEye.y)),
    rawEye.z
  );
  setOffAxisProjection(camera, renderEye, screenW_cm, screenH_cm, 1, 800);

  // Camera dollies forward during sprint - apply AFTER off-axis projection set camera.position
  if (camera && typeof cameraSprintZ === 'number') {
    if (Math.abs(cameraSprintZ) < 0.05) cameraSprintZ = 0;
    camera.position.z -= cameraSprintZ; // shift forward from the off-axis baseline (don't replace it)
  }

  if (gameState === 'playing') {
    input.update();
    updateAim();
    if (input.bombPressed) detonateBomb();
    let stageState = stage.getState();
    if (stageState === 'stageRun' || stageState === 'bonusRun' || stageState === 'bossFight') {
      player.update(dt, input, projectiles, audio, stage.getShootables(), onEnemyKilled);

      // Sprint mechanic - charge forward on the rail
      if (input.sprintPressed && sprintCooldown <= 0 && !sprintActive) {
        sprintActive = true;
        sprintTimer = SPRINT_DURATION;
        sprintCooldown = SPRINT_COOLDOWN;
        sprintForwardOffset = 0;
        if (audio && audio.playSfx) audio.playSfx('boost');
      }
      if (sprintActive) {
        sprintTimer -= dt;
        // Push player forward fast during the burst
        const targetOffset = 80; // how far forward the player charges (units)
        sprintForwardOffset = THREE.MathUtils.lerp(sprintForwardOffset, targetOffset, 0.15);
        if (sprintTimer <= 0) {
          sprintActive = false;
        }
      } else {
        // After sprint ends, the player springs back to normal Z position over ~1.5s
        sprintForwardOffset = THREE.MathUtils.lerp(sprintForwardOffset, 0, 0.025);
      }
      if (sprintCooldown > 0) sprintCooldown = Math.max(0, sprintCooldown - dt);

      // Apply the sprint forward offset to the player's Z position
      // (relative to its fixed base z = -8)
      if (player) {
        player.position.z = -8 - sprintForwardOffset;
      }
    } else {
      holdPlayerDuringTransition(dt);
    }
    if (slowWorldTimer > 0) slowWorldTimer = Math.max(0, slowWorldTimer - dt);
    if (easyMode && easyHealth > 0 && easyHealth < EASY_HEALTH_MAX) {
      easyHealth = Math.min(EASY_HEALTH_MAX, easyHealth + EASY_HEALTH_REGEN * dt);
      hud.setHealthBar(easyHealth);
    }
    const groundScale = player.position.y < -5.4 ? 0.68 : 1;
    const worldScale = (easyMode ? 0.75 : 1) * (slowWorldTimer > 0 ? 0.42 : 1) * groundScale;
    const simDt = dt * worldScale;
    projectiles.update(simDt);
    enemyProjectiles.update(simDt);
    stage.update(simDt, player);
    stageState = stage.getState();
    if (stageState === 'stageRun' || stageState === 'bossFight') {
      checkPlayerEnemyCollisions(player, stage.getEnemies(), audio, onPlayerHit);
      checkPlayerObstacleCollisions(player, stage.getObstacles(), audio, onPlayerHit);
      enemyProjectiles.checkPlayerCollisions(player, audio, onPlayerHit);
      checkPickupCollisions();
    } else if (stageState === 'bonusRun') {
      checkPickupCollisions();
    }
    explosions.update(easyMode ? dt * 0.75 : dt);
    shockwaves.update(easyMode ? dt * 0.75 : dt, camera);
    world.update(easyMode ? dt * 0.75 : dt);

    // Apply subtle camera tilt during turns
    if (world && typeof world.getTurnInfluence === 'function' && gameState === 'playing') {
      const turnInfluence = world.getTurnInfluence(player.position.z);
      const targetTilt = turnInfluence * 0.52; // max ~7 degrees
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z || 0, targetTilt, 0.08);
    } else if (camera.rotation.z !== 0) {
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0, 0.1);
    }
    hud.setWeapon(player.weapon, player.weaponTimer);
    hud.setAmmo(player.weapon, player.weaponTimer, player.weaponMaxTimer);
    hud.setPowerups({ speed: player.speedBoostTimer, slow: slowWorldTimer, invincible: player.invuln, sprintActive, sprintCooldown });
    if (DEV.showHitSpheres) {
      hitSphereDebug.update({
        player,
        shootables: stage.getShootables(),
        obstacles: stage.getObstacles(),
        pickups: stage.getPickups()
      });
    } else {
      hitSphereDebug.hide();
    }
  } else if (gameState === 'menu' || gameState === 'paused' || gameState === 'gameover' || gameState === 'ending') {
    // Keep the world drifting so the title/pause/gameover screens have motion.
    world.update(dt);
    shockwaves.update(dt, camera);
    hitSphereDebug.hide();
  }

  renderer.render(scene, camera);
  updatePerfHud(rawDt);
  requestAnimationFrame(loop);
}
loop();

if (DEV.enabled && DEV.startStage) {
  requestAnimationFrame(() => {
    if (stageSelect) stageSelect.value = String(DEV.startStage);
    if (DEV.qaSeconds) {
      runStageSmoke(DEV.startStage, DEV.qaSeconds);
    } else {
      menu.classList.add('hidden');
      startGame(DEV.startStage);
      if (DEV.fastStageClear) stage._enterStageClear?.();
    }
  });
}

// === CLEAN OPTIONS MODAL (added after walk-back) ===
(function() {
  function openOptions() {
    let modal = document.getElementById('optionsModal');
    if (!modal) {
      // create modal if missing
      modal = document.createElement('div');
      modal.id = 'optionsModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:200;';
      modal.innerHTML = `
        <div style="background:#111;border:3px solid #ff5566;padding:30px;min-width:320px;color:white;">
          <h2 style="margin-top:0">OPTIONS</h2>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button id="opt-camera">CAMERA FOLLOW</button>
            <button id="opt-gyro">GYRO VIEW</button>
            <button id="opt-head">HEAD TRACKING</button>
            <button id="opt-cine">CINEMATIC MODE</button>
            <button id="opt-mobile">MOBILE STICKS</button>
          </div>
          <button id="opt-close" style="margin-top:20px;width:100%">CLOSE</button>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.style.display = 'flex';

    // wire buttons
    const close = document.getElementById('opt-close');
    if (close) close.onclick = () => modal.style.display = 'none';

    // delegate to existing buttons if they exist
    const map = {
      'opt-camera': 'cameraFollowBtn',
      'opt-gyro': 'enableGyroBtn',
      'opt-head': 'enableCamBtn',
      'opt-cine': 'orbitBtn',
      'opt-mobile': 'touchStickModeBtn'
    };
    Object.entries(map).forEach(([optId, realId]) => {
      const opt = document.getElementById(optId);
      const real = document.getElementById(realId);
      if (opt && real) opt.onclick = () => real.click();
    });
  }

  // attach to options button
  const optionsBtn = document.getElementById('optionsBtn');
  if (optionsBtn) {
    optionsBtn.onclick = openOptions;
  }
})();

// === IMPROVED OPTIONS MODAL WIRING ===
(function() {
  const modal = document.getElementById('optionsModal');
  const openBtn = document.getElementById('optionsBtn');
  
  if (!openBtn) return;

  openBtn.onclick = () => {
    if (modal) modal.style.display = 'flex';
  };

  // Wait for modal to exist
  setTimeout(() => {
    const closeBtn = document.getElementById('closeOptionsBtn');
    if (closeBtn && modal) {
      closeBtn.onclick = () => modal.style.display = 'none';
    }

    // Wire modal buttons to real functions
    const wire = (modalId, fn) => {
      const btn = document.getElementById(modalId);
      if (btn) btn.onclick = () => fn();
    };

    wire('modalCameraFollowBtn', () => {
      const current = window.cameraFollowMode || false;
      setCameraFollowMode(!current);
    });

    wire('modalEnableGyroBtn', () => {
      const current = input && input.gyroEnabled;
      setGyroMode(!current);
    });

    wire('modalEnableCamBtn', () => {
      const real = document.getElementById('enableCamBtn');
      if (real) real.click();
    });

    wire('modalOrbitBtn', () => {
      const current = headTracker && headTracker.autoOrbit;
      setCinematicMode(!current);
    });

    wire('modalTouchStickModeBtn', () => {
      const real = document.getElementById('touchStickModeBtn');
      if (real) real.click();
    });

    const tools = document.getElementById('modalToolsBtn');
    if (tools) {
      tools.onclick = () => location.search = '?dev=1';
    }
  }, 300);
})();

// === FINAL RELIABLE MODAL WIRING (click delegation) ===
(function() {
  const openBtn = document.getElementById('optionsBtn');
  if (!openBtn) return;

  openBtn.onclick = () => {
    const modal = document.getElementById('optionsModal');
    if (modal) modal.style.display = 'flex';
  };

  // Delegate modal buttons to hidden original buttons
  const delegate = (modalId, originalId) => {
    const m = document.getElementById(modalId);
    const orig = document.getElementById(originalId);
    if (m && orig) {
      m.onclick = () => orig.click();
    }
  };

  // These IDs match the modal HTML we injected earlier
  delegate('modalTouchStickModeBtn', 'touchStickModeBtn');
  delegate('modalCameraFollowBtn', 'cameraFollowBtn');
  delegate('modalEnableGyroBtn', 'enableGyroBtn');
  delegate('modalEnableCamBtn', 'enableCamBtn');
  delegate('modalOrbitBtn', 'orbitBtn');

  const tools = document.getElementById('modalToolsBtn');
  if (tools) {
    tools.onclick = () => location.search = '?dev=1';
  }
})();


// === FINAL DELEGATION MODAL (most reliable) ===
(function initOptionsModalFinal() {
  const openBtn = document.getElementById('optionsBtn');
  if (!openBtn) return;

  openBtn.onclick = function() {
    const modal = document.getElementById('optionsModal');
    if (modal) modal.style.display = 'flex';
  };

  // This function will keep trying until the modal buttons exist
  function attachDelegates() {
    const modal = document.getElementById('optionsModal');
    if (!modal) {
      setTimeout(attachDelegates, 200);
      return;
    }

    const close = document.getElementById('m-close');
    if (close) close.onclick = () => modal.style.display = 'none';

    // Map modal button IDs to the hidden original buttons
    const mapping = {
      'm-touch': 'touchStickModeBtn',
      'm-cam':   'cameraFollowBtn',
      'm-gyro':  'enableGyroBtn',
      'm-head':  'enableCamBtn',
      'm-cine':  'orbitBtn'
    };

    Object.keys(mapping).forEach(modalId => {
      const modalBtn = document.getElementById(modalId);
      const origBtn  = document.getElementById(mapping[modalId]);
      
      if (modalBtn && origBtn) {
        modalBtn.onclick = function() {
          origBtn.click(); // This triggers the real handler
        };
      }
    });
  }

  // Start trying to attach
  setTimeout(attachDelegates, 400);
})();
