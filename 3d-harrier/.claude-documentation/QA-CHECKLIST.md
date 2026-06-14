# 3D Harrier QA Checklist

Use this checklist before treating a gameplay/content pass as complete.

## Load And Menu

- Open `http://127.0.0.1:8780/`.
- Open `http://127.0.0.1:8780/qa-runner.html` and run QA Smoke before final signoff.
- For unattended smoke, open `http://127.0.0.1:8780/qa-runner.html?autorun=1`; export or inspect `localStorage.harrierQaLastReport` after it finishes and confirm `acceptance.ok` is true.
- For a headless browser run, execute `node scripts/run-browser-qa.mjs`; confirm it exits 0 and writes `C:\tmp\harrier-browser-qa-report.json`.
- Before final signoff, execute `node scripts/run-browser-qa.mjs --profile signoff`; this runs the longer performance and 15-cycle endurance profile.
- Confirm the QA report includes `visual.ok: true` from the WebGL canvas pixel probe, with nonblank varied samples.
- Confirm the canvas renders and the menu is visible.
- Confirm Play/Edit tabs switch without console errors.
- Confirm Play tab shows stage selector, start, easy mode, mobile mode, camera follow, gyro, head tracking, and cinematic controls.
- Confirm the selected stage briefing updates when the stage selector changes and shows splash art, route type, difficulty band, visual hook, encounter hook, track, speed, and boss/bonus/rush tags.
- Confirm Play tab shows high score, best stage, clear count, and stage options labeled CLEAR/BEST/NEXT as progress changes.
- Confirm Reset Progress clears high score, best stage, clear count, and stage selector labels after confirmation.
- Confirm Editor tab can create anchors, save a level, load it, duplicate/delete it, export/import JSON, and start Playtest.
- Confirm `node scripts/smoke-check.mjs` passes after changing stage media, themes, editor catalog entries, enemies, pickups, or obstacle types.

## Campaign

- Start Stage 1 normally and survive at least 30 seconds without accidental immediate death.
- In dev mode, open `http://127.0.0.1:8780/?dev=1&stage=1`.
- Use `window.__gameDebug.getState()` and confirm debug hooks only exist in dev mode.
- In dev mode, confirm Shift+I toggles invulnerability, Shift+N clears the stage, Shift+B spawns a boss, and Shift+K clears the active boss without console errors.
- Open `http://127.0.0.1:8780/?dev=1&stage=1&hitSpheres=1` and confirm player/enemy/obstacle/pickup hit spheres render as wireframes.
- Run `window.__gameDebug.runStageSmoke(1, 10)` and confirm the returned `ok` value is true.
- Run `window.__gameDebug.runBossSmoke(3, 3)` and confirm a live boss is reported.
- Run `await window.__gameDebug.runCampaignSmoke()` and confirm it visits 18 stages, reports no errors, and ends in `gameState: "ending"`.
- Confirm each in-run stage splash shows the selected stage artwork plus difficulty band, threat rating, and encounter hook.
- Run `await window.__gameDebug.runBossMatrixSmoke()` and confirm every boss route reports hit spheres, vulnerable hit spheres, collision spheres, shootable inclusion, weak-point rings, blocked body/hull damage rules, and clear-state transitions.
- Run `await window.__gameDebug.runBonusSmoke()` and confirm every bonus stage collects a target for score, leaves lives unchanged, and spawns no combat hazards.
- Run `await window.__gameDebug.runFlowSmoke()` and confirm game over, continue, ending, high-score persistence, input snapshot, and settings callbacks all pass without leaving save data mutated.
- Run `await window.__gameDebug.runPersistenceSmoke()` and confirm high score, best stage, completion count, audio volume, easy mode, and camera follow settings round-trip through localStorage and then restore.
- Run `await window.__gameDebug.runEditorSmoke()` and confirm a level with object/item/enemy anchors saves, reloads, duplicates, deletes, normalizes import/export payloads, and converts into a playable custom stage without mutating existing saved levels.
- Run `await window.__gameDebug.runInputSmoke()` and confirm mobile overlay, head-tracking mobile fallback, camera-follow/cinematic toggles, gamepad API detection, gyro view-only guard, and pause-setting callbacks pass.
- Run `await window.__gameDebug.runPerformanceSmoke({ stageId: 18, seconds: 8 })` and confirm FPS/actor peaks are reported after warmup and `ok` is true.
- Run `await window.__gameDebug.runEnduranceSmoke({ stageId: 18, cycles: 3, seconds: 5 })` for a quick recycle check and `await window.__gameDebug.runEnduranceSmoke({ stageId: 18, cycles: 15, seconds: 60 })` before final signoff; confirm post-warmup geometry/texture deltas stay inside QA tolerances.
- Confirm performance smoke reports renderer draw calls, triangles/points/lines, geometry count, texture count, and pixel ratio for draw-call/memory audits.
- Or use `qa-runner.html` to run the campaign, boss matrix, bonus, flow, persistence, editor, input, performance, visual-probe, and quick endurance smoke helpers while capturing runtime errors in the iframe.
- Start each stage directly in dev mode at least once: stages 1 through 18.
- Verify stages 5 and 12 are bonus stages and cannot damage the player.
- Verify stage 18 completion shows mission complete and updates high score/completion count.
- In dev mode, run `window.__gameDebug.completeCampaign()` and confirm the ending/credits overlay appears with score, high score, clears, Play Again, and Main Menu.
- Verify Stage 18 enters a boss rush after the timed gauntlet, shows rest beats between bosses, and ends only after the final rush boss.

## Bosses

- Use `window.__gameDebug.spawnBoss()` on boss stages.
- Verify each boss intro and boss-rush target shows a dedicated warning/name card before the health bar presentation.
- Verify boss HUD appears, boss takes hits, and boss death transitions to stage clear.
- Verify Shura/Barbarian-style shielded face bosses only take damage during exposed windows.
- Verify Stanley Carrier-style bosses telegraph vulnerable reactor windows.
- Verify boss weak-point rings are visible only while each boss is damageable.
- Verify dragon bodies and carrier hulls collide/read as hazards but only their marked weak points take weapon damage.
- Verify bombs damage bosses without instantly killing them from full health.
- Verify regular bombs still clear normal enemies and destructible obstacles.

## Controls And Runtime Flow

- Keyboard/mouse: move, aim, fire, bomb, pause/resume.
- Gamepad if available: move, aim, fire, bomb, pause.
- Mobile viewport: dual-stick overlay appears only while playing.
- Pause menu settings adjust music, SFX, camera follow, gyro/head tracking/cinematic where available.
- Game over retry restarts cleanly without stale enemies/projectiles.
- Game over records high score/best stage and the CONTINUE action restarts from the failed stage.
- Main menu return stops music and clears world actors.

## Performance And Polish

- Watch for frame drops during late-stage swarms and boss fights.
- Confirm enemy projectiles stay readable across bright, dark, frost, tunnel, and finalvoid themes, with fireballs/bullets/missiles distinguishable by silhouette as well as color.
- Confirm missile shots play a short warning cue without overwhelming rapid-fire combat.
- Confirm FighterJet/LaneDiver fast passes play a short warning cue.
- Confirm boss intros and boss-rush entries play a distinct cue as boss music starts.
- Confirm `node scripts/smoke-check.mjs` verifies every path in `AUDIO_SAMPLE_GROUPS` exists before browser audio QA.
- Confirm obstacle wireframe collision outlines and warning rings pulse clearly enough to make columns, trees, heads, and rocks readable at speed.
- Confirm enemy, obstacle, pickup, and enemy-projectile active counts remain capped in dev snapshots during dense stages.
- Confirm stage-aware pickup balance keeps early stages weapon-forward and makes bombs more common in late campaign/finale stages.
- Confirm renderer memory and draw-call counts in QA reports do not climb unbounded across repeated late-stage performance/endurance smokes.
- Confirm enemies, projectiles, pickups, obstacles, bosses, and bonus targets dispose cleanly after removal through the shared `disposeObject3D()` path.
- Confirm no console errors during a 15-minute mixed run.
- Confirm every stage has a recognizable palette/scenery/enemy hook and that each difficulty band introduces a new behavior focus in `stage.metadata`.

## Smoke Commands

```bash
node scripts/smoke-check.mjs
node scripts/run-browser-qa.mjs
node scripts/run-browser-qa.mjs --profile signoff
node --check src/main.js
```
