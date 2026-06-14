# 3D Harrier

A head-tracked rail shooter inspired by the 1985 Sega arcade game *Space Harrier*. Original geometry, original audio. **Unofficial fan project — not affiliated with Sega.**

## What's interesting about it

The display layer is a **head-tracked 3D window**: the webcam tracks your head and re-projects the scene with off-axis projection, turning your monitor into a literal window into the game world. Close one eye and lean — the depth illusion locks in. Both eyes + still head also works via the "auto-orbit" cinematic mode.

The game layer is a rail shooter sitting on top of that window: flying-figure player, scrolling checkered ground, enemy waves, boss fights, bonus rounds, scoring, stage progression, and mobile/gamepad support.

## Status

Playable no-build Three.js campaign prototype:

- 18 selectable campaign stage shells with distinct palettes, scenery, enemy rosters, obstacles, speed scaling, and explicit visual/encounter hooks for content QA.
- Boss encounters on key stages plus two bonus rounds.
- Stage briefing preview with splash art, route type, difficulty band, visual hook, encounter hook, track, speed, and boss/bonus/rush tags.
- In-run stage splash cards show each stage's difficulty band, threat rating, and encounter hook over the stage artwork.
- Boss and boss-rush entries use dedicated warning/name cards before the health HUD takes over.
- Stage-aware pickup balance that shifts from early weapon support toward more bombs and survival tools in late stages and the finale.
- SFX sample groups are exported as an audio manifest and checked by smoke tests so missing effect files are caught before browser QA.
- Boss hit rules carry raycast hit-sphere metadata, so multi-part bosses can expose collision bodies while accepting weapon damage only on marked weak points.
- Enemy fireballs, bullets, and missiles use distinct silhouettes, contrast rings, halos, and trails for readability across stage themes.
- Obstacles render animated collision telegraphs and warning rings so hard bounds stay readable during high-speed stages.
- Menu-based level editor with local browser saves, drag/drop object/item/enemy anchors, music/theme selection, import/export, delete, duplicate, and playtest.
- Keyboard/mouse, gamepad, and mobile dual-stick controls.
- Easy mode, pause/retry/main-menu flow, pickup feedback, music/SFX, and head-tracking/cinematic display options.

Current execution plan: [`.claude-documentation/plans/2026-05-27-complete-game-execution-plan.md`](.claude-documentation/plans/2026-05-27-complete-game-execution-plan.md)

## Run locally

```bash
python -m http.server 8765
# open http://localhost:8765
```

Camera APIs require localhost or HTTPS — won't work from `file://`.

For campaign QA, open `http://localhost:8765/qa-runner.html` and run QA Smoke. Use `http://localhost:8765/qa-runner.html?autorun=1` for an automatic run. It loads the game in dev mode, runs the campaign, boss-matrix, bonus-stage, game-flow, persistence, editor, input, performance, WebGL visual-probe, and endurance smoke helpers, captures runtime errors, reports actor/renderer stats plus a plan acceptance summary, and stores the latest report in `localStorage` as `harrierQaLastReport`.

For a no-dependency headless browser run on Windows with Chrome or Edge installed:

```bash
node scripts/run-browser-qa.mjs
node scripts/run-browser-qa.mjs --profile signoff
```

The script starts the local dev server, launches a headless browser through Chrome DevTools Protocol, waits for the QA runner report, and writes `C:\tmp\harrier-browser-qa-report.json`. The default `quick` profile is for iteration; `--profile signoff` runs the longer performance/endurance profile.

## Controls

| Input | Action |
|---|---|
| WASD / arrow keys | Move player |
| Mouse | Aim |
| Left click / Space | Fire |
| Right click / B | Bomb |
| Esc | Pause / resume |
| R | Recenter head tracking |
| Gamepad left stick | Move |
| Gamepad right stick | Aim |
| Gamepad RT / A | Fire |
| Gamepad LT / L1 | Bomb |
| Mobile left stick | Move |
| Mobile right stick | Aim + autofire |
| Mobile BOMB / PAUSE buttons | Bomb / pause |

## Stack

- Three.js r160
- MediaPipe FaceLandmarker (WASM, GPU-accelerated)
- WebAudio SFX + HTMLAudioElement music
- Vanilla JS ES modules — no framework, no build step

## Tech write-up

The off-axis projection math, head-pose estimation from inter-pupillary distance, and stereo-vs-parallax tradeoffs are documented inline in the source and in `.claude-documentation/DESIGN-DECISIONS.md`.

## Legal

Inspired by, but not derived from, *Space Harrier* (© Sega, 1985). No original assets, audio, or code are used. All geometry, music, and behaviors are original works built for this project. Stage and enemy names are factual references to the source work.
