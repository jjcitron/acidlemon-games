import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve('.');
const failures = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.isFile() && path.endsWith('.js')) out.push(path);
  }
  return out;
}

for (const file of walk(join(root, 'src'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`syntax: ${file}\n${result.stderr || result.stdout}`);
}

const stagesModule = await import(pathToFileURL(join(root, 'src/game/content/stages.js')));
const { STAGES, STAGE_MEDIA, STAGE_THEMES } = stagesModule;
const levelSchemaModule = await import(pathToFileURL(join(root, 'src/game/content/levelSchema.js')));
const { EDITOR_CATALOG, EDITOR_THEMES } = levelSchemaModule;
const balanceModule = await import(pathToFileURL(join(root, 'src/game/content/balance.js')));
const { ACTOR_CAPS, EXTRA_LIFE_STAGE_CADENCE, PICKUP_WEIGHTS, PICKUP_WEIGHT_BANDS, QA_PERFORMANCE_LIMITS, getPickupWeightsForStage } = balanceModule;
const audioModule = await import(pathToFileURL(join(root, 'src/engine/audio.js')));
const { AUDIO_SAMPLE_GROUPS } = audioModule;
if (STAGES.length !== 24) failures.push(`expected 24 stages, found ${STAGES.length}`);
if (Object.keys(STAGE_MEDIA || {}).length !== 8) failures.push(`expected 8 stage media entries, found ${Object.keys(STAGE_MEDIA || {}).length}`);

const ids = STAGES.map(stage => stage.id);
for (let i = 1; i <= 18; i++) {
  if (!ids.includes(i)) failures.push(`missing stage ${i}`);
}

const stageVisualHooks = new Set();
const stageThemes = new Set();
const behaviorByBand = new Map();
const expectedBands = ['opening', 'mid campaign', 'escalation', 'late campaign', 'finale'];

for (const stage of STAGES) {
  if (!stage.name || !stage.duration || !stage.worldTheme || !stage.spawn || !stage.pickups) {
    failures.push(`stage ${stage.id} missing required stage fields`);
  }
  if (!(stage.worldTheme in STAGE_THEMES)) failures.push(`stage ${stage.id} references missing theme ${stage.worldTheme}`);
  if (!Number.isInteger(stage.musicTrack) || stage.musicTrack < 1 || stage.musicTrack > 8) failures.push(`stage ${stage.id} has invalid musicTrack ${stage.musicTrack}`);
  if (stage.musicPath && !existsSync(join(root, stage.musicPath))) failures.push(`stage ${stage.id} missing music file ${stage.musicPath}`);
  if (stage.splashImage && !existsSync(join(root, stage.splashImage))) failures.push(`stage ${stage.id} missing splash image ${stage.splashImage}`);
  if (stage.boss?.musicTrack && (stage.boss.musicTrack < 1 || stage.boss.musicTrack > 8)) failures.push(`stage ${stage.id} boss has invalid musicTrack ${stage.boss.musicTrack}`);
  for (const boss of stage.bossRush || []) {
    if (boss.musicTrack && (boss.musicTrack < 1 || boss.musicTrack > 8)) failures.push(`stage ${stage.id} boss rush ${boss.id} has invalid musicTrack ${boss.musicTrack}`);
  }
  if (stage.id < 18 && stage.nextStageId !== stage.id + 1) {
    failures.push(`stage ${stage.id} nextStageId should be ${stage.id + 1}, found ${stage.nextStageId}`);
  }
  stageThemes.add(stage.worldTheme);
  const meta = stage.metadata || {};
  if (!expectedBands.includes(meta.difficultyBand)) failures.push(`stage ${stage.id} has missing/invalid difficulty band`);
  if (!Number.isFinite(meta.difficultyRating) || meta.difficultyRating < 1 || meta.difficultyRating > 10) failures.push(`stage ${stage.id} has invalid difficulty rating ${meta.difficultyRating}`);
  if (!meta.visualHook || meta.visualHook.length < 12) failures.push(`stage ${stage.id} is missing a recognizable visual hook`);
  if (!meta.encounterHook || meta.encounterHook.length < 12) failures.push(`stage ${stage.id} is missing an encounter hook`);
  if (!Array.isArray(meta.behaviorFocus) || !meta.behaviorFocus.length) failures.push(`stage ${stage.id} is missing behavior focus metadata`);
  if (meta.visualHook) stageVisualHooks.add(meta.visualHook);
  if (!behaviorByBand.has(meta.difficultyBand)) behaviorByBand.set(meta.difficultyBand, new Set());
  for (const behavior of meta.behaviorFocus || []) behaviorByBand.get(meta.difficultyBand).add(behavior);
}

if (stageThemes.size < 12) failures.push(`expected at least 12 distinct stage themes, found ${stageThemes.size}`);
if (stageVisualHooks.size < 14) failures.push(`expected most stages to have distinct visual hooks, found ${stageVisualHooks.size}`);
const seenBehavior = new Set();
for (const band of expectedBands) {
  const focus = behaviorByBand.get(band) || new Set();
  if (!focus.size) {
    failures.push(`difficulty band ${band} has no behavior focus metadata`);
    continue;
  }
  const introduced = [...focus].filter(behavior => !seenBehavior.has(behavior));
  if (!introduced.length) failures.push(`difficulty band ${band} does not introduce a new behavior focus`);
  for (const behavior of focus) seenBehavior.add(behavior);
}

for (const [id, media] of Object.entries(STAGE_MEDIA || {})) {
  if (!media.music || !existsSync(join(root, media.music))) failures.push(`stage media ${id} missing music file ${media.music}`);
  if (!media.splash || !existsSync(join(root, media.splash))) failures.push(`stage media ${id} missing splash image ${media.splash}`);
}

for (const id of [5, 12]) {
  const stage = STAGES.find(entry => entry.id === id);
  if (stage?.mode !== 'bonus') failures.push(`stage ${id} should be a bonus stage`);
}

const finalStage = STAGES.find(stage => stage.id === 18);
if (!finalStage?.bossRush?.some(boss => boss.final)) failures.push('stage 18 should include a final boss in its boss rush');
if ((finalStage?.bossRush || []).length < QA_PERFORMANCE_LIMITS.minBossRushBosses) failures.push('stage 18 should include a multi-boss rush');

const registryText = readFileSync(join(root, 'src/game/content/enemyRegistry.js'), 'utf8');
const registered = new Set([...registryText.matchAll(/^\s*([A-Za-z0-9_]+)\(scene,\s*position\)/gm)].map(match => match[1]));
for (const stage of STAGES) {
  for (const enemy of stage.spawn?.enemyTypes || []) {
    if (!registered.has(enemy.type)) failures.push(`stage ${stage.id} references unregistered enemy ${enemy.type}`);
  }
}

const obstacleText = readFileSync(join(root, 'src/game/obstacles.js'), 'utf8');
const obstacleDefaults = obstacleText.split('export class Obstacle')[0] || obstacleText;
const registeredObstacles = new Set([...obstacleDefaults.matchAll(/^\s{2}([A-Za-z0-9_]+):\s*\{/gm)].map(match => match[1]));
if (!obstacleText.includes('_updateCollisionTelegraph') || !obstacleText.includes('warningRing') || !obstacleText.includes('AdditiveBlending')) failures.push('obstacles should animate collision telegraphs for readability');
const supportedPickups = new Set(['multishot', 'laser', 'bomb', 'health', 'speed', 'slow', 'invincible']);
for (const entry of EDITOR_CATALOG.objects || []) {
  if (!registeredObstacles.has(entry.id)) failures.push(`editor object catalog references unknown obstacle ${entry.id}`);
}
for (const entry of EDITOR_CATALOG.items || []) {
  if (!supportedPickups.has(entry.id)) failures.push(`editor item catalog references unsupported pickup ${entry.id}`);
}
for (const entry of EDITOR_CATALOG.enemies || []) {
  if (!registered.has(entry.id)) failures.push(`editor enemy catalog references unregistered enemy ${entry.id}`);
}
for (const theme of EDITOR_THEMES || []) {
  if (!(theme in STAGE_THEMES)) failures.push(`editor theme catalog references missing theme ${theme}`);
}

for (const required of [
  'src/game/content/campaign.js',
  'src/game/content/balance.js',
  'src/game/save.js',
  'src/game/dev.js',
  'src/game/debugViz.js',
  'src/game/dispose.js',
  'scripts/run-browser-qa.mjs',
  'qa-runner.html',
  '.claude-documentation/QA-CHECKLIST.md'
]) {
  if (!existsSync(join(root, required))) failures.push(`missing ${required}`);
}

const browserQaText = readFileSync(join(root, 'scripts/run-browser-qa.mjs'), 'utf8');
if (!browserQaText.includes('remote-debugging-port') || !browserQaText.includes('harrierQaLastReport')) failures.push('browser QA script should drive a headless browser and read the QA report');
if (!browserQaText.includes('WebSocket') || !browserQaText.includes('Runtime.evaluate')) failures.push('browser QA script should use CDP without extra dependencies');
if (!browserQaText.includes('--profile') || !browserQaText.includes('signoff')) failures.push('browser QA script should support quick/signoff profiles');

const mainText = readFileSync(join(root, 'src/main.js'), 'utf8');
const indexText = readFileSync(join(root, 'index.html'), 'utf8');
if (!indexText.includes('saveSummary')) failures.push('missing save summary menu element');
if (!indexText.includes('resetProgressBtn')) failures.push('missing reset progress menu button');
if (!indexText.includes('stageBriefing')) failures.push('missing stage briefing preview element');
for (const editorControl of ['deleteLevelBtn', 'exportLevelBtn', 'importLevelBtn', 'importLevelInput']) {
  if (!indexText.includes(editorControl)) failures.push(`missing editor control ${editorControl}`);
}
if (!mainText.includes('runStageSmoke')) failures.push('missing browser runStageSmoke helper');
if (!mainText.includes('runCampaignSmoke')) failures.push('missing browser runCampaignSmoke helper');
if (!mainText.includes('runBossMatrixSmoke')) failures.push('missing browser runBossMatrixSmoke helper');
if (!mainText.includes('runBonusSmoke')) failures.push('missing browser runBonusSmoke helper');
if (!mainText.includes('runPerformanceSmoke')) failures.push('missing browser runPerformanceSmoke helper');
if (!mainText.includes('runEnduranceSmoke')) failures.push('missing browser runEnduranceSmoke helper');
if (!mainText.includes('getRendererStats')) failures.push('missing renderer stats snapshot for performance QA');
if (!mainText.includes('renderer.info')) failures.push('renderer stats should read renderer.info');
if (!mainText.includes('runFlowSmoke')) failures.push('missing browser runFlowSmoke helper');
if (!mainText.includes('runPersistenceSmoke')) failures.push('missing browser runPersistenceSmoke helper');
if (!mainText.includes('runEditorSmoke')) failures.push('missing browser runEditorSmoke helper');
if (!mainText.includes('runInputSmoke')) failures.push('missing browser runInputSmoke helper');
if (!mainText.includes('handleDevHotkey')) failures.push('missing dev-gated QA hotkeys');
for (const code of ['KeyI', 'KeyN', 'KeyB', 'KeyK']) {
  if (!mainText.includes(code)) failures.push(`missing dev hotkey ${code}`);
}
if (!mainText.includes('headTrackingMobileGuard')) failures.push('input smoke should verify head-tracking mobile fallback');
if (!mainText.includes('gamepadApi')) failures.push('input smoke should verify gamepad API availability');
if (!mainText.includes('gyroViewOnly')) failures.push('input smoke should verify gyro remains view-only');
if (!mainText.includes('saveStore.restore')) failures.push('flow smoke should restore save data after mutating persistence');
if (!mainText.includes('highScoreRoundTrip')) failures.push('persistence smoke should verify high-score round-trip');
if (!mainText.includes('musicSettingRoundTrip')) failures.push('persistence smoke should verify audio setting round-trip');
if (!mainText.includes('cameraFollowRoundTrip')) failures.push('persistence smoke should verify camera setting round-trip');
if (!mainText.includes('stageConversion')) failures.push('editor smoke should verify level-to-stage conversion');
if (!mainText.includes('importPayload')) failures.push('editor smoke should verify import/export payload normalization');
if (!mainText.includes('stage.bonusMode.spawnTarget')) failures.push('bonus smoke should spawn and collect a bonus target');
if (!mainText.includes('bonus target damaged the player')) failures.push('bonus smoke should verify bonus targets cannot damage the player');
if (!mainText.includes('bonus run spawned combat hazards')) failures.push('bonus smoke should verify bonus stages do not spawn combat hazards');
if (!mainText.includes('continueFromGameOver')) failures.push('flow smoke should exercise continue from game over');
if (!mainText.includes('getPerfSnapshot')) failures.push('missing dev performance stats snapshot');
if (!mainText.includes('QA_PERFORMANCE_LIMITS')) failures.push('performance smoke should use shared QA performance limits');
if (!mainText.includes('warmupMs')) failures.push('performance smoke should warm up past stage intro before measuring');
if (!mainText.includes('memoryDelta')) failures.push('endurance smoke should report renderer memory deltas');
if (!mainText.includes('maxEnduranceGeometryGrowth')) failures.push('endurance smoke should enforce geometry growth tolerance');
if (!mainText.includes('EXTRA_LIFE_STAGE_CADENCE')) failures.push('extra-life cadence should use shared balance constants');
if (!mainText.includes('NO HIT') || !mainText.includes('EXTRA LIFE')) failures.push('stage clear summary should report no-hit and extra-life bonuses');
if (!mainText.includes('HitSphereDebug')) failures.push('missing hit sphere debug wiring');
if (!mainText.includes('completeCampaign')) failures.push('missing browser completeCampaign helper');
if (!mainText.includes('inspectBossForMatrix')) failures.push('boss matrix smoke should inspect every boss route');
if (!mainText.includes('weakPointRing')) failures.push('boss matrix smoke should verify weak-point rings');
if (!mainText.includes('blockedSpheres')) failures.push('boss matrix smoke should verify blocked weak-point/body hit rules');
if (!mainText.includes('spawnDevBoss') || !mainText.includes('killDevBoss')) failures.push('debug boss helpers should use safe dev boss spawn/kill paths');
if (!mainText.includes('finishGameOver')) failures.push('missing game-over save/continue flow');
if (!mainText.includes('restartLabel: \'CONTINUE\'')) failures.push('game-over primary action should be continue');
if (!mainText.includes('refreshSaveUi')) failures.push('missing save-state menu refresh');
if (!mainText.includes('BEST STAGE')) failures.push('missing save summary text');
if (!mainText.includes('renderStageBriefing')) failures.push('missing stage briefing renderer');
if (!mainText.includes('labelFromId')) failures.push('stage briefing should format enemy/scenery ids for display');
if (!mainText.includes("gameState = 'ending'")) failures.push('campaign completion should enter ending state');
for (const editorFunction of ['deleteCurrentEditorLevel', 'exportCurrentEditorLevel', 'importEditorLevelFromFile', 'safeFileName']) {
  if (!mainText.includes(editorFunction)) failures.push(`missing editor ${editorFunction}`);
}
if (!mainText.includes('3d-harrier-level')) failures.push('editor export should tag level JSON payloads');
if (!mainText.includes('FileReader')) failures.push('editor import should read JSON files');

const saveText = readFileSync(join(root, 'src/game/save.js'), 'utf8');
if (!saveText.includes('recordScore')) failures.push('missing high-score persistence for non-completion runs');
if (!saveText.includes('reset()')) failures.push('missing save reset support');
if (!saveText.includes('restore(')) failures.push('missing save restore support for browser QA smoke');

const stageManagerText = readFileSync(join(root, 'src/game/stageManager.js'), 'utf8');
if (!stageManagerText.includes('ACTOR_CAPS')) failures.push('missing stage actor caps');
if (!stageManagerText.includes('getPickupWeightsForStage')) failures.push('pickup selection should use stage-aware pickup balance weights');
if (!stageManagerText.includes('showBossIntro') || !stageManagerText.includes('RUSH TARGET')) failures.push('stage manager should present boss and boss-rush name cards');

const disposeText = readFileSync(join(root, 'src/game/dispose.js'), 'utf8');
if (!disposeText.includes('disposeObject3D')) failures.push('missing shared Object3D disposal helper');
if (!disposeText.includes('isTexture')) failures.push('disposal helper should dispose material textures');
for (const file of [
  'src/game/entities.js',
  'src/game/bonusMode.js',
  'src/game/obstacles.js',
  'src/game/world.js',
  'src/game/enemies/baseEnemy.js',
  'src/game/bosses/baseBoss.js'
]) {
  const text = readFileSync(join(root, file), 'utf8');
  if (!text.includes('disposeObject3D')) failures.push(`${file} should use shared disposal helper`);
}

const enemyProjectileText = readFileSync(join(root, 'src/game/enemyProjectiles.js'), 'utf8');
if (!enemyProjectileText.includes('haloMaterials')) failures.push('missing enemy projectile halo visuals');
if (!enemyProjectileText.includes('shapeGeometries') || !enemyProjectileText.includes('contrastMaterials') || !enemyProjectileText.includes('trailMaterials')) failures.push('enemy projectiles should have type-specific readable silhouettes');
if (!enemyProjectileText.includes("shape: 'sphere'") || !enemyProjectileText.includes("shape: 'diamond'") || !enemyProjectileText.includes("shape: 'cone'")) failures.push('enemy projectile styles should use distinct sphere/diamond/cone silhouettes');

const audioText = readFileSync(join(root, 'src/engine/audio.js'), 'utf8');
if (!audioText.includes('AUDIO_SAMPLE_GROUPS')) failures.push('audio sample groups should be exported as a manifest');
if (!audioText.includes('playWarning')) failures.push('missing warning SFX method');
if (!audioText.includes('playBossCue')) failures.push('missing boss cue SFX method');
const requiredSampleGroups = ['shootSingle', 'shootMulti', 'shootLaser', 'pickup', 'bomb', 'explosion', 'playerHit', 'enemyHit'];
for (const group of requiredSampleGroups) {
  const samples = AUDIO_SAMPLE_GROUPS?.[group] || [];
  if (!samples.length) failures.push(`audio sample group ${group} should not be empty`);
  for (const sample of samples) {
    if (!existsSync(join(root, sample))) failures.push(`audio sample group ${group} missing file ${sample}`);
  }
}

const hudText = readFileSync(join(root, 'src/game/hud.js'), 'utf8');
if (!hudText.includes('hud-ending')) failures.push('missing ending credits overlay');
if (!hudText.includes('showEnding')) failures.push('missing HUD showEnding method');
if (!hudText.includes('subtitle =') || !hudText.includes('#hud-title .subtitle')) failures.push('HUD title should support stage-clear subtitles');
if (!hudText.includes('stageSplashMeta') || !hudText.includes('#hud-stage-splash .meta') || !hudText.includes('THREAT')) failures.push('stage splash should surface stage metadata');
if (!hudText.includes('showBossIntro') || !hudText.includes('#hud-boss-intro') || !hudText.includes('BOSS WARNING')) failures.push('boss intro should use a dedicated name-card overlay');

const coreEnemiesText = readFileSync(join(root, 'src/game/enemies/coreEnemies.js'), 'utf8');
if (!coreEnemiesText.includes("playWarning?.('fast')")) failures.push('missing fast-enemy warning cue');

const entitiesText = readFileSync(join(root, 'src/game/entities.js'), 'utf8');
if (!entitiesText.includes('bestSphere')) failures.push('raycast should preserve hit-sphere metadata for weak-point rules');
if (!entitiesText.includes('point: rayOrigin.clone().addScaledVector')) failures.push('raycast should expose impact points for accurate tracer endpoints');

const playerText = readFileSync(join(root, 'src/game/player.js'), 'utf8');
if (!playerText.includes('hit.enemy.hit(1, hit)')) failures.push('single-shot hits should pass hit metadata into enemy hit rules');
if (!playerText.includes('h.enemy.hit(1, h)')) failures.push('laser hits should pass hit metadata into enemy hit rules');

const bossText = readFileSync(join(root, 'src/game/bosses/bosses.js'), 'utf8');
if (!bossText.includes("part:'head'") || !bossText.includes("part:'body'") || !bossText.includes('vulnerable:false')) failures.push('segmented dragon should distinguish vulnerable head from non-vulnerable body');
if (!bossText.includes("part:'reactor'") || !bossText.includes("part:'hull'")) failures.push('carrier boss should distinguish reactor weak point from hull');

const qaRunnerText = readFileSync(join(root, 'qa-runner.html'), 'utf8');
if (!qaRunnerText.includes('runCampaignSmoke')) failures.push('QA runner should execute runCampaignSmoke');
if (!qaRunnerText.includes('runBossMatrixSmoke')) failures.push('QA runner should execute runBossMatrixSmoke');
if (!qaRunnerText.includes('runBonusSmoke')) failures.push('QA runner should execute runBonusSmoke');
if (!qaRunnerText.includes('runPerformanceSmoke')) failures.push('QA runner should execute runPerformanceSmoke');
if (!qaRunnerText.includes('runEnduranceSmoke')) failures.push('QA runner should execute runEnduranceSmoke');
if (!qaRunnerText.includes('QA_PROFILES') || !qaRunnerText.includes('signoff')) failures.push('QA runner should expose quick/signoff QA profiles');
if (!qaRunnerText.includes('rendererStats')) failures.push('QA runner should report renderer stats');
if (!qaRunnerText.includes('bossMatrix')) failures.push('QA runner should report boss matrix status');
if (!qaRunnerText.includes('bonusSmoke')) failures.push('QA runner should report bonus smoke status');
if (!qaRunnerText.includes('runFlowSmoke')) failures.push('QA runner should execute runFlowSmoke');
if (!qaRunnerText.includes('runPersistenceSmoke')) failures.push('QA runner should execute runPersistenceSmoke');
if (!qaRunnerText.includes('runEditorSmoke')) failures.push('QA runner should execute runEditorSmoke');
if (!qaRunnerText.includes('runInputSmoke')) failures.push('QA runner should execute runInputSmoke');
if (!qaRunnerText.includes('flowSmoke')) failures.push('QA runner should report flow smoke status');
if (!qaRunnerText.includes('persistenceSmoke')) failures.push('QA runner should report persistence smoke status');
if (!qaRunnerText.includes('editorSmoke')) failures.push('QA runner should report editor smoke status');
if (!qaRunnerText.includes('inputSmoke')) failures.push('QA runner should report input smoke status');
if (!qaRunnerText.includes('enduranceSmoke')) failures.push('QA runner should report endurance smoke status');
if (!qaRunnerText.includes('captureVisualProbe') || !qaRunnerText.includes('readPixels') || !qaRunnerText.includes('visual_runtime')) failures.push('QA runner should include WebGL canvas pixel visual probe');
if (!qaRunnerText.includes('buildAcceptanceSummary')) failures.push('QA runner should build a plan acceptance summary');
if (!qaRunnerText.includes('campaign_18_stage_ending')) failures.push('QA acceptance summary should cover campaign ending');
if (!qaRunnerText.includes('level_editor')) failures.push('QA acceptance summary should cover level editor requirements');
if (!qaRunnerText.includes('flow_and_persistence')) failures.push('QA acceptance summary should cover flow and persistence');
if (!qaRunnerText.includes('acceptanceSummary')) failures.push('QA runner should display acceptance summary status');
if (!qaRunnerText.includes('runtimeErrors')) failures.push('QA runner should capture runtime errors');
if (!qaRunnerText.includes('autorun')) failures.push('QA runner should support autorun mode');
if (!qaRunnerText.includes('harrierQaLastReport')) failures.push('QA runner should persist the latest report');

if (ACTOR_CAPS.enemies < 24 || ACTOR_CAPS.enemies > 48) failures.push(`enemy actor cap looks out of balance: ${ACTOR_CAPS.enemies}`);
if (ACTOR_CAPS.obstacles < 12 || ACTOR_CAPS.obstacles > 30) failures.push(`obstacle actor cap looks out of balance: ${ACTOR_CAPS.obstacles}`);
if (ACTOR_CAPS.pickups < 6 || ACTOR_CAPS.pickups > 16) failures.push(`pickup actor cap looks out of balance: ${ACTOR_CAPS.pickups}`);
if (EXTRA_LIFE_STAGE_CADENCE < 2 || EXTRA_LIFE_STAGE_CADENCE > 5) failures.push(`extra-life cadence looks out of balance: ${EXTRA_LIFE_STAGE_CADENCE}`);
if ((PICKUP_WEIGHTS || []).length !== supportedPickups.size) failures.push('pickup weights should cover every supported pickup type');
for (const entry of PICKUP_WEIGHTS || []) {
  if (!supportedPickups.has(entry.type)) failures.push(`pickup weights include unsupported pickup ${entry.type}`);
  if (!(entry.weight > 0)) failures.push(`pickup ${entry.type} should have positive weight`);
}
for (const [band, weights] of Object.entries(PICKUP_WEIGHT_BANDS || {})) {
  if ((weights || []).length !== supportedPickups.size) failures.push(`pickup weight band ${band} should cover every supported pickup type`);
  for (const entry of weights || []) {
    if (!supportedPickups.has(entry.type)) failures.push(`pickup weight band ${band} includes unsupported pickup ${entry.type}`);
    if (!(entry.weight > 0)) failures.push(`pickup weight band ${band} has non-positive ${entry.type} weight`);
  }
}
const openingBombWeight = getWeight(getPickupWeightsForStage({ id: 1, metadata: { difficultyBand: 'opening' } }), 'bomb');
const lateBombWeight = getWeight(getPickupWeightsForStage({ id: 14, metadata: { difficultyBand: 'late campaign' } }), 'bomb');
const finaleBombWeight = getWeight(getPickupWeightsForStage({ id: 18, metadata: { difficultyBand: 'finale' } }), 'bomb');
if (!(lateBombWeight > openingBombWeight && finaleBombWeight > lateBombWeight)) failures.push('bomb pickup weights should increase from opening to late campaign to finale');
if (QA_PERFORMANCE_LIMITS.minFps < 15 || QA_PERFORMANCE_LIMITS.minFps > 60) failures.push(`QA min FPS looks invalid: ${QA_PERFORMANCE_LIMITS.minFps}`);
if (QA_PERFORMANCE_LIMITS.maxEnemyProjectiles < 40 || QA_PERFORMANCE_LIMITS.maxEnemyProjectiles > 200) failures.push(`QA enemy projectile cap looks invalid: ${QA_PERFORMANCE_LIMITS.maxEnemyProjectiles}`);
if (QA_PERFORMANCE_LIMITS.minCampaignStages !== 18) failures.push('QA campaign stage count should be 18');
if (QA_PERFORMANCE_LIMITS.minBossRushBosses < 5) failures.push('QA boss rush minimum should require a multi-boss rush');
if (QA_PERFORMANCE_LIMITS.maxEnduranceGeometryGrowth < 0 || QA_PERFORMANCE_LIMITS.maxEnduranceGeometryGrowth > 80) failures.push('QA endurance geometry growth tolerance looks invalid');
if (QA_PERFORMANCE_LIMITS.maxEnduranceTextureGrowth < 0 || QA_PERFORMANCE_LIMITS.maxEnduranceTextureGrowth > 40) failures.push('QA endurance texture growth tolerance looks invalid');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`smoke-check passed: ${STAGES.length} stages, ${registered.size} registered enemy builders`);

function getWeight(entries, type) {
  return (entries || []).find(entry => entry.type === type)?.weight || 0;
}
