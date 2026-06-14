# 3D Harrier — Design Decisions Log

**Created:** 2026-05-27
**Status:** Phase 1 complete (playable Stage 1 endless loop, full combat + pickups + lighting)
**Repo:** https://github.com/jjcitron/3d-harrier (private)

This document captures every meaningful design and engineering decision made so far, with the reasoning behind each. Read this before changing anything significant — most of these decisions have non-obvious tradeoffs documented inline.

---

## 1. Origin & Concept

Started as a tech demo of head-tracked 3D off-axis projection: the webcam tracks the user's head and re-projects the scene so the monitor feels like a real window into a 3D space. Evolved into a Space Harrier-inspired rail shooter on top of that window. The depth illusion is a core display feature, not a gimmick layered on later.

**Framing:** unofficial fan project, inspired by *Space Harrier* (Sega, 1985). Original geometry, original audio, factual stage-name references only. No assets ripped or reproduced from the original.

---

## 2. Stack & Architecture

Single-page browser app, no build step. Vanilla JS modules, Three.js r160, MediaPipe FaceLandmarker (WASM).

```
src/
  engine/
    offaxis.js         asymmetric frustum from eye position
    headtracking.js    face landmarker -> head pose in cm
    input.js           keyboard + mouse + gamepad unified
    audio.js           WebAudio chiptune + SFX + file music loader
  game/
    world.js           ground, sky, scenery, speed streaks
    player.js          flying figure, weapons, jetpack, running anim
    entities.js        enemies, pickups, projectiles, explosions, shockwaves
    hud.js             DOM HUD elements
    stageManager.js    spawn timing for enemies + pickups
  main.js              orchestrator, render loop, game state machine
  style.css

sound/                 8 royalty-free music tracks (.m4a)
index.html             shell with importmap + script entry
spaceharrier.mp4       reference video (gitignored)
.claude-documentation/ design docs + plans
```

**Decision: no build step.** Importmap covers Three.js. Saves overhead, keeps source readable. Will revisit if/when complexity demands a bundler.

---

## 3. Display Layer (the head-tracking window)

**Decision: head tracking is the WINDOW, not the camera.** The game camera flies forward on rails (constant world scroll). Head movement adds a small parallax shift on top of that — like looking through a real window into a moving world.

Why: free-look head camera would fight the rail-shooter design. Window effect adds a depth cue without changing gameplay.

**Off-axis math:** screen plane at world z=0, eye at head x/y/z. Asymmetric frustum keeps the screen edges anchored to the physical monitor edges. Implementation in `src/engine/offaxis.js`.

**Head pose estimation (`src/engine/headtracking.js`):**
- MediaPipe Tasks Vision FaceLandmarker, GPU delegate
- IPD baseline 6.3 cm → depth
- Eye midpoint → x/y
- Webcam HFOV assumed 65° (typical laptop)
- Defaults tuned for gameplay: sensitivity 1.0, smoothing lerp 0.22 (was 2.2/0.5 for the standalone demo)

**Gameplay clamps (in `main.js`):**
| Mode | Influence | Clamp |
|---|---|---|
| Live tracking, in game | 0.35× | ±6 cm |
| Cinematic orbit, in game | 0.9× | ±18 cm |
| Live tracking, menu | 1.0× | ±30 cm |
| Cinematic orbit, menu | 1.0× | ±40 cm |

**Cinematic / Auto-orbit:** Lissajous-pattern automatic eye motion so users with both eyes open who can't strongly perceive monocular parallax still get the illusion. Toggleable from menu.

---

## 4. Aim — Three Iterations

This was the single most-iterated subsystem. Documenting all three so we don't reintroduce earlier bugs.

**V1 — Mouse → world via `camera.unproject`.** Broken: off-axis camera's projection matrix shifts with head, so reticle's unprojected world point drifted with head motion.

**V2 — Mouse → world via fixed neutral eye `(0, 0, 50)`.** Stable but: bullet origin (gun muzzle) is offset ~58 units from the eye, so the muzzle-to-target ray diverged from the eye-to-reticle ray. Bullets missed enemies under the reticle by several units depending on enemy depth.

**V3 (current) — Hitscan from the same eye that's rendering (`renderEye`).** The visual reticle position maps exactly to a world ray. Player fires → engine raycasts that ray against all enemies → visual tracer fires from muzzle to the actual hit point. The bullet's drawn trajectory is cosmetic; the kill is registered along the sight line.

**Why V3 works:** with hitscan, the drawn bullet path doesn't have to match the sight line. The user sees a bullet come out of the gun visually; the kill registers along whatever ray the eye projected through the reticle. Standard FPS pattern. Aim is now pixel-perfect regardless of head tracking state.

---

## 5. Controls

| Action | KB+M | Gamepad |
|---|---|---|
| Move | WASD / arrows | Left stick |
| Aim | Mouse | Right stick (auto-active on movement) |
| Fire | Left click / Space | RT or A |
| Bomb | Right click / B | LT or L1 |
| Pause | Esc | (Esc) |
| Recenter head | R | — |

**Aim mode auto-switch:** gamepad RS movement registers gamepad aim (yellow reticle), mouse movement reverts to mouse aim (red reticle), with a 1.5 s timeout.

---

## 6. Audio Strategy

**Decision: original procedural WebAudio for all SFX, user-supplied royalty-free m4a tracks for music. Zero ripped or copyrighted audio.**

**SFX** (`src/engine/audio.js`): procedurally synthesized.
- Per-weapon shoot SFX (single = square sweep, multi = three detuned blips, laser = saw zap)
- Hit, explosion, death, pickup (ascending arpeggio), bomb (sub sine + filtered noise)
- Chiptune music loop fallback (138 BPM, 16-step bassline + lead + arps + kick + hat)

**Music:** 8 royalty-free m4a tracks the user created (`sound/track_01.m4a` through `track_08.m4a`). Loaded via `HTMLAudioElement` with `loop=true`. `STAGE_TRACKS` table in `main.js` maps stages to tracks (currently all stages → track_01; Phase 2 will diversify).

---

## 7. Visual Style

**Decision: dusk / golden-hour palette.** Iterated from initial daylight blue to darker dusk so dynamic lights (jetpack, muzzle, tracers, pickups, beam) drive the visual instead of fighting ambient fill.

**Sky** (3-color gradient shader, `src/game/world.js`):
- Zenith: near-black (#05143d)
- Mid: deep rose (#8a4a55)
- Horizon: dusty gold (#c28058)

**Fog:** warm haze (#c28058) from 45 → 240 units. Pulled close so the world rushes out of darkness, selling speed.

**Lighting:**
- Hemisphere light intensity 0.32 (low ambient so dynamic lights dominate)
- Directional sun 0.95 intensity, warm tint, casts shadows
- PCFSoftShadowMap at 2048×2048
- Sun shadow camera framed to the action area

---

## 8. World

- **Ground:** 600×1400 plane, MeshLambertMaterial (receives shadows + tints from sky). Checker texture 60×200 repeats. Scrolls at 8.5 UV/sec for speed feel.
- **Sky dome:** 700-radius sphere with custom 3-color gradient shader.
- **Scenery:** 36 procedural palm trees, scale 1.0–2.4× per instance, scroll past at 165 u/sec, recycle when they pass camera.
- **Speed streaks:** 220 white point particles flying past at 200 u/sec. Single BufferGeometry, single draw call. Additive blending.

---

## 9. Player

Procedural figure ~3 units tall. Built in `src/game/player.js`.

Parts:
- Head (sphere + visor torus)
- Torso (cylinder)
- Belt (torus)
- **Legs (hip-pivot groups so they can swing for running animation)**
- Boots
- Arms (held forward)
- Gun (box + cylindrical barrel)
- Muzzle glow (emissive, visible briefly on fire)

**Jetpack:**
- Constant blue PointLight (intensity 2.4–4.6 scaled by velocity, range 22)
- Two additive-blended exhaust cones below boots
- Flames grow longer / brighter while accelerating, flicker each frame with noise

**Running animation:**
- Legs swing about hip pivot at 12 Hz cadence (sin × 0.85 rad) when `position.y < -5`
- In the air, legs lerp back to neutral flying pose

**Movement:** target velocity = input × maxSpeed (32 u/sec), lerped via damping = 9. Bounded x: ±22, y: −8 to +12. Lean rotation.z = −velocity.x × 0.022 for slight banking.

---

## 10. Combat

| Weapon | Tracer | Fire rate | Behavior |
|---|---|---|---|
| Single | yellow ball, additive | 0.12 s | Single hitscan |
| Multishot | smaller orange pellets (0.55×), additive | 0.11 s | 3-way spread, ±0.09 rad |
| Laser | red beam only (no ball), additive shimmer | 0.04 s | Pierces all enemies along ray |

**Tracer lighting** (`src/game/entities.js → Projectiles`):
- Pool of 5 PointLights, round-robin assigned to active tracers
- Color-matched to weapon, intensity 6, range 30
- Older tracers lose their light if all slots are taken (newer = brighter)

**Laser beam:** cylinder with additive blending, fade animated with global `sin(t × 22)` for an energy-pulse feel. With 0.04 s cooldown and 0.15 s beam duration, beams strongly overlap into a sweeping red line that follows the aim.

**Bomb:** stockable (start 2, max 3). Detonation kills every alive enemy, white flash, expanding white shockwave torus (scales to 110× over 0.7 s), deep boom SFX.

---

## 11. Enemies

Currently one type: **Mammoth** — one-eyed creature with tusks, snout, flapping wings. Procedural.
- Approaches player on +z at 38–70 u/sec (ramps with difficulty)
- Side-to-side wobble, vertical bob, wing flap
- 1 HP, 100 score on kill
- Cast shadows
- Faces the player so the eye reads as menacing

Phase 2+ will add more types — see extension plan.

---

## 12. Pickups

Four types, spawned every 11–17 s, drift toward player at 30 u/sec.

| Type | Weight | Shape | Color | Effect |
|---|---|---|---|---|
| Multishot | 30% | Icosahedron + icosahedron wire shell | Orange | `setWeapon('multishot', 18s)` |
| Laser | 30% | Same shape | Red | `setWeapon('laser', 14s)` |
| Bomb | 20% | Sphere body + cone fuse + cube wire shell | Magenta | +1 bomb stock (cap 3) |
| Health | 20% | Green cross + icosahedron wire shell | Green | +1 life (cap 3) |

Every pickup carries a camera-facing canvas-texture text sprite label ("MULTI", "LASER", "BOMB", "HEALTH") so they read at speed. Collected by collision (radius 2.4).

---

## 13. HUD

DOM-based overlays. Color-coded for fast reading.

- **Top-left:** STAGE 01 MOOT (yellow)
- **Top-center:** SCORE
- **Top-right:** segmented red HP bar (3 segments)
- **Below HP:** ammo bar, hidden for single weapon; orange for multi, red for laser
- **Bottom-left:** weapon name + countdown (color-coded)
- **Bottom-right:** bomb stock
- Reticle, title overlay, pause, game over, white flash, all DOM

---

## 14. Game State

States: `'menu' | 'playing' | 'paused' | 'gameover'`. Simple transitions.

Menu has: START GAME, ENABLE HEAD TRACKING (optional), CINEMATIC MODE (toggle).

Music starts on game start (currently always track_01). Cinematic and head tracking work on the menu too for the standalone demo feel.

---

## 15. Performance Notes

Target 60 fps on a modest laptop. No measured profile yet but choices to protect perf:

- Object pooling: bullets, beams, tracer lights, scenery (recycle, no per-frame allocs)
- 5 tracer lights max + sun + hemi + jetpack + muzzle ≈ 9 lights; OK for Three.js
- Shadow map 2048 — can drop to 1024 if shadows become a bottleneck
- Speed streaks in a single BufferGeometry, single draw call
- Music via HTMLAudio (decoded by browser, not main thread)

---

## 16. Known Limitations

- Single enemy type. Phase 2 adds more.
- One stage (endless, ramping). Phase 2 adds stage transitions.
- No bosses. Phase 3.
- All stages play track_01 currently — STAGE_TRACKS table exists but only stage 1 is real.
- Audio gain is hardcoded (master 0.4, music 0.18, sfx 0.5). No volume slider.
- No save / high score persistence.
- Aim's `aimWorld` HUD position uses fixed z=−100; hitscan is exact at any depth but the HUD reticle world coord is approximate (cosmetic).
- LiveServer not bundled — needs `python -m http.server 8765`.

---

## 17. Locations Cheat Sheet

| What | Where |
|---|---|
| Engine source | `src/engine/` |
| Game source | `src/game/` |
| Entry | `src/main.js` |
| Styles | `src/style.css` |
| Music | `sound/track_NN.m4a` |
| This doc | `.claude-documentation/DESIGN-DECISIONS.md` |
| Plans | `.claude-documentation/plans/` |
| Reference video | `spaceharrier.mp4` (gitignored) |
| Repo | `jjcitron/3d-harrier` (private) |

---

## 18. Commit History Summary (so far)

- `e7798b9` initial head-tracking demo + roadmap
- `b475b91` Phase 1 MVP: refactor + playable Stage 1
- `d1df8ba` speed feel + head subtlety
- `46a4646` hitscan aim + cinematic head clamps
- `e3d689c` shadows, sky gradient, varied trees, gun light, m4a music
- `5767ff2` weapons (multishot/laser) + smart bomb
- `477b73e` health bar, ammo bar, glowing tracers, per-weapon visuals, pickup labels
- `1245330` darker scene, jetpack glow, health pickups, running legs

Use `git log --oneline` for current state.
