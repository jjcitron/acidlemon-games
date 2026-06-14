# 3D Harrier - Full Game Content Build Plan

Created: 2026-05-27
Status: Draft for Phase 2+ buildout

## Inputs Reviewed

- `fullgame.mp4`: 24:27 full arcade run. I generated sampled contact sheets at 30 second and 10 second intervals in `.codex-video-samples/` to verify pacing, palette reuse, stage cards, bonus stages, and boss-rush structure.
- Local sprite sheets:
  - `Arcade - Space Harrier - Enemies & Bosses - Enemies.png`
  - `Arcade - Space Harrier - Enemies & Bosses - Bosses.png`
- Current code:
  - `src/main.js`
  - `src/game/stageManager.js`
  - `src/game/world.js`
  - `src/game/entities.js`
  - `src/game/player.js`
  - `src/game/hud.js`
  - `src/engine/audio.js`
- External references:
  - StrategyWiki Space Harrier overview and walkthrough pages
  - The Spriters Resource Space Harrier sheets

## Current Code Reality

The current game is a strong Phase 1 foundation, but it is intentionally hardcoded around a single Stage 1 endless loop.

- `StageManager` currently owns one endless stage with randomized Mammoth waves, pickup timing, and difficulty ramp.
- `World` is hardcoded to the current green/dusk Stage 1 palette and palm scenery.
- `entities.js` has the combat infrastructure: projectile pools, hit-scan enemy raycasts, Mammoth enemy, pickups, explosions, and bomb shockwaves.
- `main.js` already has a `STAGE_TRACKS` table and music loader, but the game only ever starts `stage.stage === 1`.
- There is no enemy projectile system yet, no stage-clear flow, no boss state, no bonus stage mode, no campaign ending, and no shared enemy base class.

The plan should keep the existing feel and systems, then add a campaign/data layer around them.

## Design Principle

Do not chase pixel-perfect reconstruction. Use the original for silhouette, color, movement, and encounter structure. The 3D remake should read as:

- fast,
- readable at distance,
- low-poly/stylized,
- faithful in enemy identity and encounter rhythm,
- modernized in player weapons, pickups, bombs, head-tracked presentation, and pacing.

That means procedural Three.js geometry is acceptable for most assets. Spend detail budget on silhouettes, motion, telegraphs, weak points, and boss readability.

## Architecture Target

### 1. Content Registries

Add a content layer instead of hardcoding per-stage behavior inside `StageManager`.

Recommended files:

```text
src/game/content/stages.js
src/game/content/enemyRegistry.js
src/game/content/bossRegistry.js
src/game/content/sceneryRegistry.js
src/game/enemies/baseEnemy.js
src/game/enemies/coreEnemies.js
src/game/bosses/baseBoss.js
src/game/bosses/bosses.js
src/game/obstacles.js
src/game/enemyProjectiles.js
```

Use JS modules first, not JSON, because this project has no build step and imported JSON is still awkward across browsers. The data can remain plain objects, so moving to JSON later is easy.

### 2. Stage Manager State Machine

Replace the endless-loop manager with a campaign manager:

```text
intro -> stageRun -> bossIntro -> bossFight -> stageClear -> nextStage
intro -> bonusRun -> bonusClear -> nextStage
stage18Intro -> bossRush -> ending
```

Each stage definition should include:

- id and display name
- duration
- music track
- world theme
- scenery set
- obstacle set
- enemy roster
- timeline events
- weighted random spawn rules
- boss config or bonus config
- next stage id

### 3. Enemy Base Class

Every enemy should expose the same surface:

```js
update(dt, ctx)
hit(damage, hitInfo)
destroy()
getHitSpheres()
getCollisionSpheres()
canBeHit(hitInfo)
```

`ctx` should carry player position, enemy projectile pool, time, stage difficulty, and shared helpers.

### 4. Enemy Projectile System

Add pooled enemy shots:

- fireballs: slow glowing orbs, used by dragons and faces
- bullets: small fast shots, used by Tomos/Tetras/Lowrys/Octopus
- missiles: homing-ish or aimed rockets, used by Dom/Valkyrie/Jet

Enemy projectiles collide with the player, not player projectiles. This keeps the current player hit-scan weapon model intact.

### 5. World Theme API

`World` needs:

```js
world.setTheme(theme, transitionSeconds)
world.setSceneryTypes(types)
world.setTunnelMode({ ceiling, ceilingY, ceilingPalette })
world.setSpeedScale(scale)
```

The current Stage 1 world becomes theme data. Later stages should mostly be palette, scenery, obstacle density, and speed changes.

## Enemy And Obstacle Roster

Build these as reusable archetypes. Several original enemies can share one underlying class with different visual builders and movement parameters.

| Archetype | Original reference | 3D treatment | Build priority |
|---|---|---|---|
| Current Mammoth | Current game custom enemy | Keep as the current early-game grunt; optionally rename internally to `WingedMammoth` if we add the original land mammoth later. | Already built |
| Mukadensu/Makuden | small flying ships | Small beetle/ship body, red eye, wing fins; supports behind-player and distant formations. | High |
| Tomos | opening orb pods | Hinged grey orb/petal shell; invulnerable closed, vulnerable when open and firing. | High |
| Skegg/Canary | winged insect forms | Shared insect base: flapping wings, green/yellow body, fireball attack. | High |
| Ida head | stone face/head | Floating stone head; can be obstacle, orbiting enemy, or boss shield unit. | High |
| Looper | flying mushroom/jelly obstacle | Squashable mushroom/balloon hazard; destructible path blocker. | High |
| Columns/towers | pillars, Doom Towers, Incaic poles | Tall procedural columns with caps; most are indestructible. | High |
| Binzubin | rotating icosahedron hazard | Rotating faceted polyhedra, floor/ceiling lanes, bright telegraph material in dark stages. | High |
| Pakomen | saucer/wide flyer | Flat saucer with sinusoidal path and bullets. | Medium |
| Valkyrie/Jet | fighter planes | One fighter base class, fast strafes, aimed missiles. | Medium |
| Dom family | robot variants | Shared robot rig; green basic, gray stacker, red fast missile unit, blue/flying jump unit. | High |
| Lowrys | blue peanut-like pods | Swarm boss/formation, curved capsule mesh, bullet barrage. | Medium |
| Tetras | triangular panel units | Triangle/pyramid modules that orbit and open panels to become vulnerable. | Medium |
| Octopus pods | vertical pod squadron | Repeating pod units in square/column formations with projectile bursts. | Medium |
| Land mammoth | one-eyed mammoth terrain creature | Large ground obstacle/enemy; can reuse some current Mammoth visual language but slower and heavier. | Low |

## Boss Framework

Bosses need more than high health. Each should have:

- intro pose/name card
- phase table
- weak point definitions
- projectile pattern scheduler
- health bar
- score reward
- timeout behavior for bosses/formations that can leave
- cleanup transition back to campaign

Reusable boss bases:

- `SegmentedDragonBoss`: Squilla, Godarni, Salpedon, Varda/Valda
- `ShieldedFaceBoss`: Barbarian, Shura/Syura
- `FormationBoss`: Lowrys, Tetras, Tomos swarm, Octopus squadron
- `DomBoss`: multi-Dom waves and Super Dom
- `CarrierBoss`: Stanley mothership
- `WiWiJumboBoss`: final humanoid plus shield/pets/terrain throws

## Verified Arcade Stage Plan

This is the content map to implement. The exact wave timings should be authored loosely from StrategyWiki and tuned against the local video.

| Stage | Name | Core content | Boss / mode |
|---|---|---|---|
| 1 | MOOT | Preserve current first-level feel. Add finite clear condition and optionally layer in Mukadensu/Tomos references once the new enemies exist. | Squilla if we want arcade structure; otherwise clear into Stage 2. |
| 2 | GEEZA | Desert/stone palette, dry trees, rocks, Ida heads, columns, Skegg-style formations. | Barbarian-style shielded face. |
| 3 | AMAR | Mushrooms, Loopers, trees, Mukadensu, Canaries, speed-up sections. | Godarni two-headed dragon. |
| 4 | CEICIEL | Ceiling/tunnel mode, pillars, Binzubin hazards, Mukadensu. | Six Dom robots as a boss-wave introduction. |
| 5 | BONUS | Uriah-style dragon ride over natural vegetation. Player steers laterally and smashes targets for score. | Bonus scoring only. |
| 6 | OLISIS | Floating continent/tech palette, Pakomen, Valkyries, Jets, Dom variants. | Lowrys pod swarm. |
| 7 | LUCASIA | Cold/rock palette, mammoth ground hazards, Pakomen, Mukadensu, Tomos, Dom variants. | Tetras orbiting triangle formation. |
| 8 | IDA | Ida-head heavy stage, Dom variants, Mukadensu, foreground Tomos. | Shura/Syura stone face with orbiting rocks. |
| 9 | REVI | Fast ceiling/tunnel reprise with Binzubins and Mukadensu. | Super Dom with blue Dom escorts. |
| 10 | MINIA | Mushroom/Looper reprise plus Valkyrie and Mukadensu waves. | Tomos swarm boss. |
| 11 | DARMS | Dom-only gauntlet: green, gray stackers, blue/flying, red fast missile units. | Salpedon skeletal two-headed dragon. |
| 12 | BONUS | Second Uriah ride over metallic/man-made objects. | Bonus scoring only. |
| 13 | DRAIL | Greenery into tower maze, fighter planes, Dom, Mukadensu, Pakomen. | Octopus squadron/pod formation. |
| 14 | ASUTE | Dark, high-speed tunnel; Binzubins rapidly alternate floor/ceiling; Mukadensu. | Barbarian reprise. |
| 15 | VISEL | Mixed late-game gauntlet: columns, Tomos, Makuden, red/blue Doms, Ida. | Varda/Valda skeletal single dragon. |
| 16 | NATURA | Dom-only advanced gauntlet with every Dom type. | Stanley mothership: indestructible carrier, survive spawned enemies. |
| 17 | NARK | Dense columns/terrain, Binzubins, Ida rotations, Makuden, blue/red Doms. | Wi Wi Jumbo with shield, pets, and thrown terrain. |
| 18 | ABSYMBEL | Boss rush. Short rest between bosses. | Godarni, Barbarian, Squilla, Ida, Salpedon, Syura, Valda. |

Note: Haya-Oh is not part of the original arcade stage 18 structure. It is a Master System-specific final boss. Decide whether to add it as an optional post-Arcade "EX Final" after Absymbel.

## Implementation Milestones

### Milestone 1 - Campaign Shell

Goal: keep current Stage 1 gameplay but make it finite and campaign-aware.

Deliverables:

- Stage registry in JS.
- `StageManager` state machine.
- Stage intro/clear transition.
- Current Stage 1 encoded as data.
- Music switching by stage.
- Score/lives persist across stage transitions.
- Start from Stage 1 and advance into a placeholder Stage 2.

Acceptance:

- Current gameplay still feels the same.
- Stage 1 ends cleanly after a configured duration.
- Stage 2 title card appears and new music/theme can start.

### Milestone 2 - World Themes And Obstacles

Goal: make stages visually distinct before enemy roster explodes.

Deliverables:

- `world.setTheme()`.
- Ground/sky/fog/lighting palette transitions.
- Scenery/obstacle manager separate from enemy manager.
- Core obstacles: rocks, trees, columns, Ida heads, mushrooms, Binzubins.
- Tunnel/ceiling mode for CEICIEL/REVI/ASUTE.

Acceptance:

- Stages 2, 3, and 4 can be played as obstacle courses with clear visual identity.
- Obstacles can be destructible or indestructible per config.

### Milestone 3 - Core Enemy Roster

Goal: build the enemies required to make the first four real stages feel like Space Harrier.

Deliverables:

- `EnemyBase`.
- Enemy projectile pool.
- Mukadensu/Makuden.
- Tomos open/closed pod.
- Skegg/Canary insect.
- Looper hazard.
- Dom basic.
- Basic formation/path helpers.

Acceptance:

- Stages 1-4 can use recognizable waves without bespoke per-stage code.
- Enemy fire can damage the player and is readable.

### Milestone 4 - First Boss Set

Goal: add the reusable boss foundations.

Deliverables:

- `BossBase`.
- Boss HUD health bar.
- Segmented dragon boss base.
- Shielded face boss base.
- Dom boss-wave mode.
- Squilla, Barbarian, Godarni, Dom Wave.

Acceptance:

- Stages 1-4 have proper end events.
- Dragon weak point is head-only.
- Shielded face requires removing or bypassing orbiting guards.
- Bosses can timeout or clear depending on config.

### Milestone 5 - Midgame Content: Stages 5-8

Goal: introduce the first bonus stage and the tech/cold/Ida biomes.

Deliverables:

- Bonus mode with Uriah-style ride.
- Natural bonus object sets.
- Pakomen.
- Valkyrie/Jet fighter base.
- Dom variants: gray stacker, red fast, blue/flying.
- Lowrys, Tetras, Shura/Syura bosses.

Acceptance:

- Stage 5 breaks up combat with a scoring ride.
- Stages 6-8 feel materially different from the early game.
- Dom family behavior is reusable for later Dom-heavy stages.

### Milestone 6 - Late Midgame: Stages 9-13

Goal: reuse and recombine existing systems, add the second bonus stage and formation bosses.

Deliverables:

- Stage 9 fast tunnel.
- Stage 10 mushroom/Valkyrie/Mukadensu mix.
- Stage 11 Dom-only gauntlet.
- Stage 12 metallic bonus mode.
- Stage 13 tower maze and Octopus squadron.
- Super Dom, Tomos swarm, Salpedon, Octopus bosses.

Acceptance:

- Most of the enemy roster is now complete.
- Stage authoring is mostly data/timelines, not new engine code.

### Milestone 7 - Endgame: Stages 14-17

Goal: high-speed tunnel, mixed gauntlets, carrier fight, and final non-rush boss.

Deliverables:

- ASUTE dark tunnel with glowing Binzubins.
- VISEL mixed late-game gauntlet.
- NATURA Dom-only advanced gauntlet.
- NARK dense terrain gauntlet.
- Barbarian reprise tuning.
- Varda/Valda skeletal dragon.
- Stanley indestructible carrier/survival boss.
- Wi Wi Jumbo shield/pets/terrain throw boss.

Acceptance:

- Stages 14-17 feel like the campaign peak, not just faster early stages.
- Wi Wi Jumbo is the final "new" boss before the rush.

### Milestone 8 - Stage 18 And Ending

Goal: full-game completion loop.

Deliverables:

- Boss rush controller.
- Rest beats between bosses.
- Per-boss simplified setup for rush mode.
- Ending sequence after final boss.
- Optional EX Haya-Oh final if desired.
- Continue/restart behavior.
- Local high score persistence.

Acceptance:

- Player can complete all 18 stages in one session.
- Game returns to menu/credits cleanly.
- Score and stage progression remain stable through boss rush.

### Milestone 9 - Polish And Tuning

Goal: make it feel finished enough to show.

Deliverables:

- Balance pass on spawn density, boss health, projectile speeds, pickup rates.
- Visual clarity pass on enemy bullets and weak points.
- Audio pass: stage music mapping, boss cues, warning sounds for missiles/Doms.
- Performance pass: object pooling audit, geometry disposal, shadow budget, light count.
- Basic debug tools: start at stage, invulnerability toggle, spawn/boss test hotkeys gated behind a dev flag.

Acceptance:

- No major frame drops in late-game swarms.
- Every enemy type is readable at speed.
- Every stage has at least one recognizable visual hook.

## Suggested Build Order For Enemy Models

Model in dependency order, not stage order:

1. Mukadensu/Makuden
2. Tomos
3. Columns, rocks, trees, mushrooms, Ida heads
4. Binzubin
5. Skegg/Canary
6. Dom base plus color variants
7. Segmented dragon base
8. Shielded face base
9. Pakomen
10. Valkyrie/Jet
11. Lowrys/Tetras/Octopus formation units
12. Stanley
13. Wi Wi Jumbo

This front-loads the shared pieces that unlock the most stages.

## Technical Risks

- Enemy projectile readability: modern lighting can make bullets hard to see. Use bright additive materials and consistent colors by projectile type.
- Hit-scan plus weak points: current `raycastEnemies` assumes a single sphere per enemy. Bosses and multi-part enemies need multiple hit spheres and per-part hit rules.
- Object churn: late stages and boss rush can generate many meshes. Pool enemy projectiles and common enemies; dispose geometry/materials on destroy.
- Stage data complexity: do not author every original wave perfectly. Use representative wave blocks and timed remix tables.
- Bonus stages: Uriah ride is a separate control/game mode. Keep it simple: lock vertical motion, let player steer x, smash targets, no death.

## Non-Blocking Product Decisions

1. Should Stage 1 remain mostly the current custom Mammoth/pickup level, or should it be retrofitted with arcade-style Mukadensu, Tomos, and Squilla while preserving the feel?
2. Do we want both Uriah bonus stages, or should they become modern upgrade/scoring intermissions?
3. Should the game end with arcade-accurate Absymbel boss rush, or should Haya-Oh be added as an optional EX final boss after the rush?
4. Later route design: consider branching left/right path choices around large obstacle clusters instead of keeping every stage on one fixed forward rail. Do not pull this into the current Phase 2 scope; revisit after the campaign shell, obstacle collision layer, and core enemy roster are stable.
