# 3D Harrier Complete Game Execution Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task after the user approves execution.

Goal: finish the current 3D Harrier prototype into a complete playable campaign with 18 stages, distinct world themes, reusable enemy/boss systems, bonus stages, ending, high scores, and a final QA/polish pass.

Architecture: keep the no-build vanilla ES module + Three.js app. Stabilize the current data-driven StageManager work, then extend content through registries: stages, enemy archetypes, obstacles, bosses, bonus mode, and campaign flow. Prioritize a complete playable game over perfect arcade reconstruction; use procedural Three.js geometry first, then upgrade hero/boss assets only where they matter.

Tech Stack: Three.js r160 via importmap, MediaPipe FaceLandmarker, WebAudio + HTMLAudioElement music, DOM HUD, browser localStorage, Python static server for local testing.

---

## Current State From Inspection

Documentation says Phase 1 was complete and Phase 2 was planned. The codebase is now ahead of those docs:

- `src/game/content/stages.js` contains 4 playable stage definitions: MOOT, GEEZA, AMAR, CEICIEL.
- `src/game/stageManager.js` has a finite campaign shell: `intro -> stageRun -> stageClear -> nextStage`.
- `src/game/world.js` already supports stage themes, scenery sets, ceiling/tunnel mode, and speed scaling.
- `src/game/enemyProjectiles.js` exists and supports pooled fireballs, bullets, and missiles.
- `src/game/enemies/baseEnemy.js` and `src/game/enemies/coreEnemies.js` exist with Mukadensu, Tomos, Skegg/Canary, Looper, and DomBasic.
- `src/game/obstacles.js` exists with rocks, mushrooms, trees, columns, Ida heads, and Binzubins.
- `index.html` has a start-stage selector for the 4 current stages.
- Music files `sound/track_01.m4a` through `track_08.m4a` exist.

Gaps:

- Campaign loops from Stage 4 back to Stage 1; no stages 5-18 yet.
- No boss framework or boss fights.
- No bonus-stage mode.
- No ending, credits, continue flow, or high-score persistence.
- No automated tests or smoke-test harness.
- README and some docs are stale relative to the actual code.
- Browser smoke test loaded with no console errors, but after starting from Stage 1 the visible state reached Game Over with score 0 during inspection; first execution task should verify whether this is a real instant-death bug or just idle/no-input death.

---

## Completion Strategy

Build in vertical slices:

1. Stabilize current 4-stage foundation.
2. Add boss framework and first boss.
3. Add bonus mode.
4. Fill all 18 stages with data and reusable content.
5. Add remaining boss families.
6. Add ending/high scores/settings.
7. Final QA, balance, performance, docs.

Do not stop to hand-model every enemy. Use strong silhouette procedural geometry, readable telegraphs, and motion first. Upgrade only player, dragons/final boss, and any repeated hero asset after the full game is playable.

---

## Phase 0: Stabilize and Test the Existing Foundation

Objective: make the current 4-stage build reliable before adding more content.

Files:
- Modify: `src/main.js`
- Modify: `src/game/stageManager.js`
- Modify: `src/game/content/stages.js`
- Create: `test/smoke.html` or `scripts/smoke-check.mjs`
- Modify: `README.md`

Tasks:

1. Run current local smoke test.
   - Command: `python -m http.server 8765`
   - Open: `http://localhost:8765/`
   - Expected: menu loads; no console errors.

2. Verify start-game survivability.
   - Start Stage 1 and do not touch controls for 10 seconds.
   - Expected: player should not instantly die before meaningful hazards arrive.
   - If it dies immediately, inspect player/enemy/obstacle/projectile collision positions and invulnerability timing.

3. Add a dev flag object.
   - Create a central `DEV` object in `src/main.js` or `src/game/dev.js`.
   - Include `invulnerable`, `fastStageClear`, `showHitSpheres`, `startStage`.
   - Gate all shortcuts behind URL query params, e.g. `?dev=1&stage=4`.

4. Add smoke-test helpers to the browser runtime.
   - Expose only in dev mode: `window.__gameDebug = { stage, player, getState, setInvulnerable, skipStage }`.
   - Verification: browser console can call `__gameDebug.getState()`.

5. Fix stale docs.
   - Update `README.md` status from Phase 1 in progress to current 4-stage campaign shell.
   - Link this plan.

Acceptance:
- Stage 1 can be started and played for at least 30 seconds without accidental immediate death.
- No console errors on page load or game start.
- Dev shortcuts exist and are gated behind `?dev=1`.

---

## Phase 1: Finish the Campaign State Machine

Objective: replace the temporary 4-stage loop with a complete campaign flow that can support bosses, bonus stages, boss rush, ending, and restart.

Files:
- Modify: `src/game/stageManager.js`
- Modify: `src/game/content/stages.js`
- Modify: `src/main.js`
- Modify: `src/game/hud.js`
- Create: `src/game/content/campaign.js`

Tasks:

1. Define campaign states.
   - Add states: `intro`, `stageRun`, `bossIntro`, `bossFight`, `stageClear`, `bonusIntro`, `bonusRun`, `bonusClear`, `bossRushIntro`, `ending`.
   - Keep current `intro`, `stageRun`, `stageClear` behavior intact.

2. Split stage definitions from campaign sequence.
   - `stages.js`: pure per-stage data.
   - `campaign.js`: ordered sequence, next-stage lookup, boss-rush list, ending trigger.

3. Add next-stage resolution.
   - If `stageDef.nextStageId` is null and not final, use campaign sequence.
   - If final stage complete, enter ending instead of looping.

4. Persist score/lives/loadout across stage transitions.
   - Current score/lives already live in `main.js`; formalize stage-clear rewards and extra lives.

5. Add clear bonuses.
   - Stage clear bonus: time/survival bonus, no-hit bonus where applicable.
   - Show through `hud.showTitle()` or a new clear panel.

Acceptance:
- Stage 4 no longer hard-loops unless explicitly configured.
- Campaign state object can represent stages 1-18 even before all content is authored.
- Starting from any stage in the selector works in dev and regular menu modes.

---

## Phase 2: Author All 18 Stage Shells

Objective: make every stage reachable with distinct theme/scenery/enemy mixes, even before all bosses are final.

Files:
- Modify: `src/game/content/stages.js`
- Modify: `src/game/world.js`
- Modify: `index.html`

Tasks:

1. Add `STAGE_THEMES` for stages 5-18.
   - Include bonus natural, tech, cold, Ida-heavy, dark tunnel, tower maze, void/final.

2. Add `STAGES` entries 5-18.
   - Each entry must include: `id`, `name`, `duration`, `musicTrack`, `worldTheme`, `sceneryTypes`, `speedScale`, `spawn`, `obstacles`, `pickups`, `nextStageId`, and optional `mode`/`boss`.

3. Wire stage selector to all 18 stages.
   - It already populates from `STAGES`; verify no hardcoded 4-stage assumptions remain.

4. Mark placeholder content clearly.
   - If a stage uses existing enemy types until new ones are ready, include comments in stage data.

Acceptance:
- User can start any stage from the menu.
- Each stage has a distinct palette and obstacle/scenery profile.
- Completing stages advances through 18 then enters placeholder ending.

---

## Phase 3: Enemy Roster Completion

Objective: build enough reusable enemy archetypes to make the campaign feel varied.

Files:
- Modify: `src/game/enemies/coreEnemies.js`
- Modify: `src/game/content/enemyRegistry.js`
- Modify: `src/game/content/stages.js`

Tasks:

1. Normalize `EnemyBase` contract.
   - Ensure all enemies implement `update(dt, player, ctx)`, `hit(damage, hitInfo)`, `destroy()`, `getHitSpheres()`, `getCollisionSpheres()`, `canBeHit(hitInfo)`.

2. Add shared helpers.
   - Formation movement helper.
   - Fire scheduler helper.
   - Aim-at-player projectile helper already exists as `aimedVelocity`; reuse it.

3. Add missing enemy archetypes:
   - `Pakomen`: saucer, sine path, bullet bursts.
   - `FighterJet`: fast strafes, missile warning, exits quickly.
   - `DomVariant`: gray stacker, red fast missile, blue flying.
   - `LowrysPod`: swarm pod with formation bullets.
   - `TetraPanel`: triangular panels, closed/invulnerable then open/vulnerable.
   - `OctopusPod`: vertical pod formation unit.

4. Register every enemy in `enemyRegistry.js`.

5. Update stage rosters progressively.

Acceptance:
- Each major stage band introduces at least one new behavior.
- Enemy projectiles are readable and damage the player fairly.
- Current hitscan player weapons can hit all enemies through `getHitSpheres()`.

---

## Phase 4: Boss Framework and Boss HUD

Objective: add reusable boss infrastructure before writing individual boss fights.

Files:
- Create: `src/game/bosses/baseBoss.js`
- Create: `src/game/bosses/bosses.js`
- Create: `src/game/content/bossRegistry.js`
- Modify: `src/game/hud.js`
- Modify: `src/game/stageManager.js`
- Modify: `src/main.js`

Tasks:

1. Create `BossBase`.
   - Properties: `position`, `group`, `health`, `maxHealth`, `phase`, `alive`, `scoreValue`.
   - Methods: `update`, `hit`, `destroy`, `getHitSpheres`, `getCollisionSpheres`, `enterPhase`, `isComplete`.

2. Add boss health HUD.
   - Top-center boss name and segmented/continuous health bar.
   - Hide outside boss fights.

3. Add `bossIntro` and `bossFight` stage states.
   - Clear regular enemies/projectiles on boss intro.
   - Swap to boss music if configured.
   - Spawn boss from `bossRegistry`.

4. Make `stage.getShootables()` include boss hit spheres during boss fight.

5. Make bomb behavior boss-aware.
   - Bomb should damage boss significantly, not instantly kill unless configured.

Acceptance:
- A dummy boss can spawn, take hits, show health, die, award score, and transition to stage clear.

---

## Phase 5: Build Core Bosses

Objective: create the boss set needed for a complete campaign.

Files:
- Modify: `src/game/bosses/bosses.js`
- Modify: `src/game/content/bossRegistry.js`
- Modify: `src/game/content/stages.js`

Build order:

1. `SegmentedDragonBoss`
   - Used for Squilla/Godarni/Salpedon/Varda/Valda-style fights.
   - Multi-segment spline or chained spheres.
   - Head weak point; body collision hazard.

2. `ShieldedFaceBoss`
   - Used for Barbarian/Shura-style fights.
   - Orbiting rock shields; damage opens when shields are down or face exposes weak point.

3. `DomWaveBoss`
   - Spawns Dom formations as a boss wave.
   - Good first boss because it reuses existing DomBasic.

4. `FormationBoss`
   - Used for Lowrys, Tetras, Tomos swarm, Octopus squadron.

5. `CarrierBoss`
   - Stanley-style survival carrier; indestructible hull, destructible spawned units.

6. `WiWiJumboBoss`
   - Final new boss before boss rush: shield, pets, terrain throws.

Acceptance:
- Stages with bosses have a clear intro, readable attack patterns, health bar, death sequence, score reward, and transition.
- Boss rush can reuse simplified versions of bosses without duplicating code.

---

## Phase 6: Bonus Stages

Objective: implement two Uriah-style scoring intermissions without overbuilding.

Files:
- Create: `src/game/bonusMode.js`
- Modify: `src/game/stageManager.js`
- Modify: `src/game/content/stages.js`
- Modify: `src/game/hud.js`

Tasks:

1. Add stage `mode: 'bonus'` for stages 5 and 12.

2. Implement `BonusMode`.
   - Player rides/locks to a dragon-like helper or alternate camera framing.
   - No death; collision with targets awards points.
   - Target sets: natural for Stage 5, metallic for Stage 12.

3. Add bonus scoring HUD.

4. Transition cleanly back to normal stage flow.

Acceptance:
- Bonus stages break up combat, cannot kill the player, and award score reliably.

---

## Phase 7: Ending, High Scores, Settings, and UX

Objective: make the game feel complete outside raw gameplay.

Files:
- Modify: `src/main.js`
- Modify: `src/game/hud.js`
- Modify: `src/style.css`
- Create: `src/game/save.js`

Tasks:

1. Add ending sequence.
   - After Stage 18/boss rush, show ending/credits and final score.
   - Return to menu cleanly.

2. Add high-score persistence.
   - Use `localStorage`.
   - Store high score, best stage reached, completion count.

3. Add continue/restart flow.
   - Decide default: unlimited continues for development, limited or score-reset continues for ship.

4. Add settings UI.
   - Music volume, SFX volume, cinematic mode, head-tracking recenter instructions.

5. Add title polish.
   - Better menu copy, legal text, controls, stage start only behind dev flag if desired.

Acceptance:
- Completing the game produces a satisfying end state.
- Restart/new run does not leak state from previous run.
- High score survives page reload.

---

## Phase 8: Final QA, Balance, and Performance

Objective: verify the full campaign top-to-bottom and polish readability/performance.

Files:
- Modify many gameplay files as issues are found.
- Create: `.claude-documentation/QA-CHECKLIST.md`

Tasks:

1. Add QA checklist.
   - Load menu.
   - Start Stage 1.
   - Start each stage directly in dev mode.
   - Boss spawn/death for every boss.
   - Bonus stage scoring.
   - Game over/restart.
   - Ending.
   - Head tracking enable/failure path.
   - Gamepad smoke test if available.

2. Add performance checklist.
   - Watch frame time in late swarms.
   - Audit object creation in hot paths.
   - Dispose geometries/materials on destroy.
   - Cap active projectile/enemy counts.

3. Balance pass.
   - Projectile speed/damage.
   - Spawn density.
   - Boss health.
   - Pickup rates.
   - Extra life cadence.

4. Visual clarity pass.
   - Enemy bullets must contrast with every theme.
   - Boss weak points must be obvious.
   - Obstacles must telegraph collision size.

5. Audio pass.
   - Map all 8 tracks intentionally.
   - Boss cues.
   - Warning sounds for missiles/fast enemies.

Acceptance:
- Full 18-stage campaign can be completed in one session.
- No console errors during a full run.
- No obvious memory/performance degradation after 15+ minutes.
- Every stage has at least one recognizable visual hook.

---

## Recommended Immediate Next Tasks

1. Fix or confirm the possible instant/early Game Over observed during browser smoke testing.
2. Add dev/debug tools and a smoke-test harness.
3. Change Stage 4 `nextStageId` from `1` to a Stage 5 shell.
4. Add Stage 5-18 shells with placeholder enemies and distinct themes.
5. Implement `BossBase` + dummy boss, then first real boss.

---

## Verification Commands

Run locally:

```bash
cd "C:/Dev/Personal/3d screen"
python -m http.server 8765
```

Open:

```text
http://localhost:8765/
http://localhost:8765/?dev=1&stage=4
```

Browser verification:

```js
// Dev mode only
window.__gameDebug.getState()
window.__gameDebug.setInvulnerable(true)
window.__gameDebug.skipStage()
```

Expected final result:

- User can play from Stage 1 through Stage 18.
- Stages have unique themes/enemy mixes.
- Bosses and bonus stages work.
- Ending and high scores work.
- Game is locally smoke-tested with no console errors.
