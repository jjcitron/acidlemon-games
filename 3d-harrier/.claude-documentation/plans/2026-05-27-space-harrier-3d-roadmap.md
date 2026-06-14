# Space Harrier 3D — Build Roadmap

**Created:** 2026-05-27
**Status:** Phase 1 in progress
**Repo:** https://github.com/jjcitron/3d-harrier (private)
**Context:** Build a Space Harrier-inspired rail shooter on top of the head-tracked 3D window demo. Original geometry inspired by the 1985 arcade game.

---

## Decisions Confirmed (2026-05-27)

| Decision | Choice |
|---|---|
| Scope | **3-stage MVP** as launching pad for stages 4-18. Phase 3 in this roadmap is the new target. |
| Camera | **Behind-player** (third-person, classic Space Harrier feel) |
| Controls | KB+M and gamepad both supported (see table below). Head-tracking is the camera-window effect, not gameplay camera control. |
| Repo | Created at `jjcitron/3d-harrier` (private GitHub) |

### Control Scheme

| Action | Keyboard + Mouse | Gamepad |
|---|---|---|
| Move player (8-way) | WASD or arrow keys | Left stick |
| Aim reticle | Mouse position | Right stick |
| Fire | Left mouse click (hold for auto-fire) | RT (right trigger) |
| Camera window depth | Webcam head-tracking (optional, recommended) | Same |
| Pause | Esc | Start |

**Important: head-tracking ≠ camera control.** The rail camera flies forward behind the player on a fixed path. Head-tracking adds a small off-axis parallax modulation on top of that camera so the screen feels like a window into the game world. Trying to use head-tracking to free-look would fight the rail-shooter design — confirmed with user we want the window effect, not free-look.

---

---

## 1. Reality Check & Recommendation

The original ask — "18 levels, every enemy and boss, all sprites re-rendered in 3D" — is a 3-to-6 month indie project, not a session. I'm not going to pretend otherwise. The roadmap below is structured so we can ship **playable, polished slices** in order of value, and you can stop at any phase with something genuinely demonstrable.

**Recommended path:** Build to **Phase 3 (first 3 stages + first boss, polished)** as the "real" deliverable. Phases 4-6 (remaining stages, full enemy roster, final boss, polish, audio) are stretch goals that depend on whether you want to commission art/music or accept procedurally-generated stand-ins.

**Why this scoping wins:**
- Stage 1 alone — with the head-tracked off-axis camera as the display layer — is already a more interesting demo than 90% of "I built a clone" projects on the web
- Phase 3 (3 stages + 1 boss) is enough variety to feel like a real game and gives you a strong portfolio/showcase piece
- The remaining 15 stages are mostly variations on terrain palette + enemy reskins; once the engine is solid they're content work, not engineering work

---

## 2. Architecture

The existing head-tracked 3D window demo is the **rendering camera** — we keep its off-axis projection and head/orbit input. On top of it we add a game layer.

```
┌──────────────────────────────────────────────────────────┐
│  Display Layer (already built — index.html)              │
│  - Off-axis projection from head position                │
│  - MediaPipe FaceLandmarker tracking                     │
│  - Auto-orbit fallback                                   │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Game Camera Layer (NEW)                                 │
│  - Game-world camera at fixed Z (or scripted dolly)      │
│  - Head-tracked eye becomes a small parallax offset      │
│    around the game camera, NOT the primary camera        │
│  - Optional toggle: "cockpit" view vs "behind-player"    │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Game World (NEW)                                        │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Ground     │  │ Player Rig   │  │ Spawn System     │ │
│  │ (scrolling │  │ - movement   │  │ - timed waves    │ │
│  │  checker)  │  │ - shoot      │  │ - per-stage data │ │
│  └────────────┘  │ - hitbox     │  └──────────────────┘ │
│                  └──────────────┘                        │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Enemies    │  │ Projectiles  │  │ Collision        │ │
│  │ - AI       │  │ - player     │  │ - cylinder/AABB  │ │
│  │ - models   │  │ - enemy      │  │ - lane-based     │ │
│  └────────────┘  └──────────────┘  └──────────────────┘ │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ HUD        │  │ Audio Bus    │  │ Stage Manager    │ │
│  │ - score    │  │ - SFX        │  │ - load/unload    │ │
│  │ - lives    │  │ - music      │  │ - transitions    │ │
│  │ - stage    │  └──────────────┘  └──────────────────┘ │
│  └────────────┘                                          │
└──────────────────────────────────────────────────────────┘
```

**Key design call: head-tracking is the WINDOW, not the camera.** The game camera flies forward through the level on rails. Your head position becomes a small parallax offset on top of that — so when you lean, you look "into" the game world like it's a diorama, while the game itself plays out independently. This preserves the head-tracking magic without breaking the rail-shooter feel.

**Stack:**
- **Render:** Three.js r160 (already loaded)
- **Game loop:** rAF-driven, fixed-step at 60Hz logical, variable visual interp
- **Input:** keyboard (WASD/arrows + space/click), optional gamepad
- **State:** plain JS — no React/Vue needed for a single-canvas game
- **Asset format:** glTF 2.0 (.glb) for models, .ogg/.wav for audio, JSON for stage scripts
- **No build step initially** — keep it `index.html + main.js + modules` until complexity demands a bundler. Vite if/when we add one.

**File layout (planned):**
```
3d screen/
  index.html                  # entry, headtracking, game mount
  src/
    engine/
      headtracking.js         # extracted from current inline script
      offaxis.js              # projection math
      input.js
      audio.js
      collision.js
    game/
      player.js
      enemy.js
      projectile.js
      ground.js
      hud.js
      stage-manager.js
    stages/
      stage-01.json           # spawn timeline, palette, boss ref
      stage-02.json
      ...
    enemies/
      mammoth.js              # behavior
      column.js
      ...
    bosses/
      stage-05-boss.js
      ...
  assets/
    models/                   # .glb files
    audio/                    # .ogg files
    textures/                 # checker grids, sky gradients, etc.
  reference/
    spaceharrier.mp4          # already here, used during dev
```

---

## 3. Asset Pipeline (the critical section)

This is where most "I'll build a Space Harrier clone" projects die. Be ruthless about the asset tier and never let one slip up a tier without justification.

### Tier 0: Procedural Three.js geometry (Claude can do this)
**What:** Built from primitives (BoxGeometry, CylinderGeometry, IcosahedronGeometry, etc.) assembled in code. Solid colors or gradient materials. Low-poly stylized.

**Good for:**
- Ground plane + scrolling checkered texture
- Player projectiles (glowing spheres / cylinders)
- Stage scenery (columns, palm trunks, simple rocks, mushrooms)
- "Stand-in" enemy models for prototyping (a sphere with eye for the mammoth, a cone for the boss until we replace it)
- Particle effects (explosions, hit flashes)

**Time cost:** Minutes to ~1 hour per asset. I can produce dozens per session.

**Quality ceiling:** Looks like late-90s low-poly art. With the head-tracking 3D window effect, this actually reads as **stylized/cool**, not cheap — provided the silhouettes are strong and the colors are bold. Think *Rez*, *Thumper*, *REZ Infinite*, not *Quake 1*.

### Tier 1: Blender procedural via Python (Claude can do this, with caveats)
**What:** Blender headless scripts (`blender --background --python script.py`) that generate more complex meshes — booleans, subdivisions, modifier stacks, baked UVs, exported as .glb.

**Good for:**
- Slightly more refined versions of Tier 0 assets when primitive assembly hits its limits
- Mesh-deformed terrain features (twisted columns, organic rocks)
- Toon-shaded characters with rigged limbs (player flying figure)
- Simple animations baked to glTF (idle bob, wing flap)

**Time cost:** ~30 min to a few hours per asset for me to write and iterate the script. The output is procedural so it's reproducible and editable.

**Quality ceiling:** Decent stylized low-poly. Still not artist-quality character work, but several steps above Tier 0. The Python API can't replace an artist's eye for proportion, but it can produce clean geometry that an artist could later refine.

**Caveat:** Blender Python is slow to iterate when you can't *see* the output. I'd need you to render preview frames and feedback ("the mammoth's eye is too big"). Tight loop with you in the loop on each major asset.

### Tier 2: AI image-to-3D services (you commission, I integrate)
**What:** Services like **Meshy.ai**, **Tripo3D**, **Luma Genie**, **Rodin** that turn a text prompt or reference image into a riggable 3D mesh.

**Good for:**
- Hero enemies (the recurring one-eyed mammoth, dragon bosses, the player character)
- Distinctive bosses that need personality (Dom, Ida, the Haya-Oh dragon)
- Anything where Tier 1 procedural can't capture the character

**Cost:** Most have free tiers (5-20 generations) and paid plans $15-50/month for higher quality + commercial use. Quality varies wildly — expect to generate 5-10 versions per asset to get one usable result.

**Time cost:** ~10-30 min per asset of generation + my time to clean up the mesh, rig it, integrate. Maybe 2-4 hours total per hero asset.

**You decide:** which service, whether to pay, whether to provide reference images (you sketching, or AI-generated reference via Midjourney/Imagen/etc.).

### Tier 3: Hand-modeled by an artist (commission a human)
**What:** A 3D artist on Fiverr/Upwork/ArtStation models, rigs, and animates the asset to spec.

**Good for:**
- The final hero asset (player character — the iconic flying figure)
- The Haya-Oh final boss if you want it to land emotionally
- Any single asset that the head-tracking demo will be judged on

**Cost:** $50-500 per asset depending on complexity and artist tier. Final-boss-level asset: budget $300-800.

**Time cost:** 3-10 days turnaround per commission.

### My recommendation on the mix:
- **Phase 1-2:** 100% Tier 0 (procedural Three.js). Ship working game.
- **Phase 3:** Tier 0 for terrain/scenery, Tier 1 (Blender script) for the player rig and a few enemies, Tier 2 for the first boss if you want it to wow.
- **Phase 4+:** Decide per-asset. The hero/recurring assets earn Tier 2/3 upgrades; one-off background enemies stay Tier 0/1.

**Anti-pattern to avoid:** Trying to make every enemy "look right" at Tier 0 before moving on. Ship ugly first, polish in passes. A working game with placeholder cubes beats a half-finished game with one beautiful boss.

---

## 4. Stage-by-Stage Breakdown

The original game has 18 stages. Stage names below are from my memory of the game and need verification against your `spaceharrier.mp4` and the wiki before final commit — I've marked uncertainty with `(?)`.

Each stage in the original is roughly 60-90 seconds of forward flight, ending in either a boss fight or continuation to the next themed area. About 1 in 3 stages has a boss; the rest are enemy/obstacle gauntlets.

| # | Name (per memory) | Theme | Distinctive | Boss? |
|---|---|---|---|---|
| 1 | Moot | Green checkered ground, palm trees, blue sky | Tutorial stage; gentle enemy density | No |
| 2 | Geeza | Continuation, more enemies/obstacles | Higher density | No |
| 3 | Amar (?) | Variant terrain palette | Stone columns become primary obstacle | Yes — twin-dragon boss type |
| 4 | Ceiha (?) | New palette | Mushroom-like organic obstacles | No |
| 5 | Olisis (?) | Darker/alien | | Yes |
| 6 | Lakelad (?) | Water/lake feel | Reflective ground | No |
| 7 | Vargas | | | No |
| 8 | Asakuza | | | Yes |
| 9 | Minia | | | No |
| 10 | Drail (?) | | | Yes — Squilla type |
| 11 | Aruzart (?) | | | No |
| 12 | Sylphi (?) | | | No |
| 13 | Lukark (?) | | | Yes |
| 14 | Iasis (?) | | | No |
| 15 | Stonehead (?) | Floating stone heads | | Yes — Ida type |
| 16 | Ulteria (?) | | | No |
| 17 | Abash (?) | | | No |
| 18 | Haya-Oh | Final | | YES — two-headed dragon final boss |

**Verification task** (early in Phase 1): scrub through `spaceharrier.mp4`, take screenshots at stage transitions, confirm names and palette per stage. Write the verified table into `stages/stages.json` as canonical data the engine reads.

**Stage data format** (`stages/stage-01.json`):
```json
{
  "id": 1,
  "name": "Moot",
  "duration_sec": 75,
  "palette": {
    "ground_a": "#22aa44",
    "ground_b": "#1a8836",
    "sky_top": "#3388ff",
    "sky_bottom": "#88ccff",
    "fog": "#aaccff"
  },
  "scenery": [
    { "type": "palm", "rate": 0.4, "lanes": [-2, 2] },
    { "type": "stone_pillar", "rate": 0.15, "lanes": "any" }
  ],
  "spawns": [
    { "t": 3.0, "enemy": "mammoth", "lane": -1, "pattern": "straight" },
    { "t": 5.5, "enemy": "mammoth", "lane": 1, "pattern": "straight" },
    { "t": 9.0, "enemy": "mammoth_wave", "count": 4, "pattern": "v-formation" },
    ...
  ],
  "boss": null,
  "next_stage": 2
}
```

This makes stages **data, not code**. Once we have the engine, adding stages is a JSON file + maybe one new enemy/boss script.

---

## 5. Enemy & Boss Catalog

Rough enemy taxonomy from the original game, with asset tier recommendation per type:

| Enemy archetype | Frequency | Behavior | Tier |
|---|---|---|---|
| One-eyed mammoth (recurring grunt) | Every stage | Fly toward player, sometimes wave formation | **Tier 1** — single hero model, recolored per stage |
| Stone pillars / columns | Many stages | Static obstacles to dodge | **Tier 0** — procedural cylinders + caps |
| Palm trees | Stage 1, recurring | Static decoration + dodge | **Tier 0** |
| Mushrooms | Multiple stages | Static obstacle | **Tier 0** |
| Stone arches | Recurring | Fly-through opportunity | **Tier 0** |
| Robotic enemies (variants) | Mid-game | Different flight patterns | **Tier 1** — share base mesh, swap heads |
| Skull/alien-fetus enemy | Specific stages | Homing or charge | **Tier 1 or 2** |
| Dragon bosses (Dom, Ida, etc.) | ~6 stages | Multi-segment, weak points | **Tier 2** — image-to-3D, this is a "wow" moment |
| Squilla-type boss | Mid-game | Erratic movement | **Tier 1 or 2** |
| Haya-Oh (final boss) | Stage 18 | Two-headed dragon, multi-phase | **Tier 2 or 3** — this carries the ending, worth the spend |

**Implementation pattern (each enemy is a small JS class):**
```js
class Mammoth {
  constructor(scene, lane, spawnZ) { ... }
  update(dt, player) {
    // move toward player, side-to-side wobble
    // if close enough, dive at player lane
  }
  onHit() { /* explode, score */ }
  getHitbox() { return { x, y, z, r }; }
}
```

Behavior data lives in the class; visual data (the .glb model path, scale, recolor) lives in `enemies/registry.json` so reskins are pure data.

---

## 6. Audio Strategy (read this before deciding anything else)

Space Harrier's music is **its most iconic feature** and the biggest legal/creative landmine.

**What you CANNOT do:**
- Rip audio from the ROM and ship it. The music is owned by Sega; even fan projects get C&D'd when they distribute ROM-extracted audio.
- Stream the original soundtrack from a music platform inside your game.

**What you CAN do (in rough order of cost/quality):**

| Option | Cost | Quality | Risk |
|---|---|---|---|
| **Original chiptune in your own style** | Free (your time / I write a basic loop) | Charming but won't be "the" song | Zero |
| **Commission a composer for an original soundtrack inspired by the era** | $200-2000 | High; can sound era-appropriate | Zero — work-for-hire, you own it |
| **Use royalty-free / Creative Commons synthwave or chiptune** | Free | Decent generic vibe, won't match the iconic feel | Zero (verify license) |
| **AI-generated music (Suno, Udio, Stable Audio)** | $10-30/mo | Variable; some commercial licenses ok | Medium — check terms of service for commercial use, attribution, and AI training disputes |
| **Cover by a fan musician on YouTube (with their permission)** | Negotiated | Often very high | Low if you have written permission |
| **The original soundtrack** | N/A | Iconic | **HIGH — do not** |

**My recommendation:** For Phase 1-3, use a single original looping chiptune track (I can write one with WebAudio in ~50 lines for that arcade vibe — square waves, simple bassline, no copyright entanglement). For Phase 4+, decide whether to commission a real composer. Don't ship the demo with ripped audio under any circumstance.

**SFX:** Easy. Royalty-free libraries like Freesound.org, OpenGameArt.org. Player shoot, explosion, hit, death, stage-clear jingle. I can wire them up via WebAudio in an afternoon.

---

## 7. Build Phases & Order

### Phase 1 — Engine MVP (1 session, ~4-6 hrs of focused work)
**Goal:** A playable single endless-runner stage with no level structure. Just the core loop.

Deliverables:
- Refactor `index.html` into engine + game modules
- Game camera + head-tracking parallax overlay (head-tracking as secondary, not primary)
- Scrolling checkered ground (Moot palette)
- Player controllable figure (Tier 0 — stylized humanoid from primitives)
- Player can shoot
- One enemy type (mammoth stand-in — sphere with eye)
- Collision (player hit / enemy hit)
- Score + lives HUD
- Stage clear after N seconds → restart loop
- Original chiptune loop + 4 SFX

Exit criteria: you can play it for 60 seconds and not be embarrassed showing a friend.

### Phase 2 — Stage System + 3 Stages (1-2 sessions)
**Goal:** Real stage-by-stage progression, data-driven.

Deliverables:
- Stage manager + JSON loading
- 3 stages with distinct palettes (verified from the mp4)
- 3-4 enemy archetypes (mammoth, column, palm, one new behavior)
- Wave-formation spawning
- Transitions between stages (brief "STAGE X" title card)
- Continue/game over screen

Exit criteria: stages feel meaningfully different; gameplay progresses in difficulty.

### Phase 3 — First Boss + Polish Pass (1-2 sessions)
**Goal:** The first "real game" milestone.

Deliverables:
- One boss fight at end of Stage 3 (Tier 2 model recommended — commission via image-to-3D)
- Boss multi-phase health, weak points, dodge patterns
- Camera shake, hit flashes, explosion particles
- Better player model (Tier 1 — Blender-scripted, rigged, idle/shoot/hit animations)
- Pause menu, restart, sound mixing
- Title screen with "ENABLE CAMERA" head-tracking onboarding

Exit criteria: showable as a portfolio piece. **Recommended stop point if budget/time matters.**

### Phase 4 — Stages 4-9 + Mid-Game Boss (3-5 sessions)
**Goal:** Half the game, second boss.

Deliverables:
- 6 more stages with new palettes and at least 3 new enemy archetypes
- Mid-game boss (different mechanics from first)
- Better enemy variety (homing, charging, formation patterns)
- Audio expansion: 2-3 stage music tracks, boss music

### Phase 5 — Stages 10-17 (3-5 sessions)
**Goal:** Full stage roster minus finale.

Deliverables:
- 8 more stages (likely heavy palette/enemy reuse — by this point you've established the visual language and are filling out variations)
- 1-2 more bosses
- Difficulty curve tuning across the full game
- Achievement/scoring polish

### Phase 6 — Finale + Polish (2-4 sessions)
**Goal:** Ship-ready.

Deliverables:
- Stage 18 + Haya-Oh boss (Tier 2/3 — this is the asset that matters most)
- Ending sequence (you can be creative — original game's ending is brief)
- Final audio pass (commissioned soundtrack consideration)
- Performance pass (LOD on distant enemies, draw-call audit, mobile/laptop battery test)
- Itch.io page or static-host deployment

**Total honest estimate:** 12-22 focused sessions over weeks-to-months of calendar time. Faster if you commission assets aggressively; slower if everything stays procedural.

---

## 8. Time Estimates (honest)

Per phase, what's a realistic clock:

| Phase | Claude-only (Tier 0/1) | With Tier 2 commissions | With Tier 3 artist |
|---|---|---|---|
| 1 | 4-6 hrs | n/a | n/a |
| 2 | 8-12 hrs | +2 hrs integration | n/a |
| 3 | 8-12 hrs | +4 hrs + 1-3 day wait | +1-2 wk wait |
| 4 | 15-25 hrs | +6 hrs + waits | +2-4 wk |
| 5 | 15-25 hrs | +6 hrs + waits | +2-4 wk |
| 6 | 8-12 hrs | +4 hrs + waits | +2-4 wk |

"Hours" means focused, uninterrupted dev sessions. Calendar time is 2-4x longer because you context-switch between this and your actual job (Atrilyx Agent, Databricks, etc. — your stated priorities).

---

## 9. Claude vs Human Work Split

### What I do well (autonomous):
- All game engine code, game loop, collision, input, HUD
- Tier 0 procedural geometry (every primitive-based asset)
- Tier 1 Blender Python scripts (with you reviewing renders)
- Stage JSON authoring + scripting spawn patterns
- WebAudio integration, music synthesis (basic), SFX wiring
- Performance profiling and optimization
- Refactoring, testing, deployment scripts

### What needs you in the loop:
- Approving asset choices (does this enemy "feel right"?)
- Watching the source video and validating palettes/behaviors per stage
- Decisions on tier upgrades ("should this boss be Tier 2 or 3?")
- Commissioning external services (Meshy, Tripo, artists)
- Final aesthetic calls — taste is yours
- Any music composition beyond basic chiptune
- Playtesting and difficulty feedback

### What needs a human OTHER than you:
- Character modeling at Tier 3 (a 3D artist on Fiverr/Upwork)
- Original composed soundtrack (a chiptune/synthwave composer)
- Voice acting (if you add any — original game has digitized "GET READY!" voice)

---

## 10. Tools & Services To Decide On

Before Phase 2 starts, decide:

1. **Image-to-3D service for hero enemies** — pick one to test in Phase 3:
   - **Meshy.ai** — strong on stylized characters, free tier available
   - **Tripo3D** — solid for hard-surface and creatures
   - **Luma Genie** — quality varies, free tier
   - **Rodin (Hyper3D)** — newer, has improved a lot
   - Action: when we hit Phase 3, you sign up for 1-2, send me a free-tier credential or you generate the asset and hand me the .glb

2. **Music direction**
   - Option A: I write chiptune in-engine, you accept the limited fidelity
   - Option B: You browse Suno/Udio and pick AI-generated loops (read their commercial-use terms)
   - Option C: Commission a composer; budget $200-500 for 3-5 tracks
   - Decide before Phase 4 starts

3. **Deployment target**
   - Itch.io (free, indie-friendly, supports HTML5 games out of the box)
   - GitHub Pages (free, technical-portfolio framing)
   - Custom domain (you have joelcitron.com — could host there)
   - Decide before Phase 6

4. **License for the project**
   - This is a fan-clone of a Sega-owned property. If kept non-commercial and clearly labeled "fan project / not affiliated with Sega," risk is low but non-zero (Nintendo famously DMCAs; Sega is historically more permissive).
   - If you ever consider monetization, **stop** — rename it, file off all Sega-identifying naming, and rebrand. Trademark and trade-dress claims become real.

---

## 11. Legal & IP Notes (read carefully)

I am not a lawyer. This is the standard fan-game guidance:

- **Stage and enemy NAMES** (Moot, Haya-Oh, etc.) — factual references to the original work, generally OK to use in non-commercial fan context, but a publisher could still send a cease-and-desist
- **Sprites from spriters-resource.com** — copyrighted Sega assets. **Do not use directly.** Use only as visual reference for your original geometry. The whole point of "re-rendered in 3D" is that we build new assets inspired by the originals — that's the safer creative path
- **Music** — never ship ROM-ripped audio. Detailed above
- **The mp4 in your folder** — fine for personal reference. Don't redistribute
- **Distribution** — if you ever post the game publicly (itch.io, your domain, social), put **"unofficial fan project, not affiliated with Sega"** in the description and the in-game credits
- **Commercial use** — assume it's off-limits unless you transform the work enough that none of the original Sega IP is recognizable, at which point it's not really a Space Harrier clone anymore

**Don't let this paralyze you.** Tens of thousands of fan projects exist; the vast majority never get touched. The point is: stay non-commercial, credit the original, and don't ship ripped assets.

---

## 12. What I'll Do Next (if you greenlight Phase 1)

When you say "start Phase 1," I will:

1. Watch the mp4 (extract frames with ffmpeg) to verify Stage 1 palette and pacing
2. Refactor the current `index.html` into modular files (engine separate from game)
3. Build the game-camera + head-parallax layer on top of the existing off-axis projection
4. Implement scrolling checkered ground with proper distance-fading
5. Procedural player figure + movement (arrow keys / WASD)
6. Procedural mammoth-stand-in enemy + spawn timer
7. Projectile + collision + score
8. Title screen → play → game over loop
9. Test for 60 seconds and report what feels off; tune
10. Commit checkpoint, hand back for your review

Then we either iterate on Phase 1 polish or move to Phase 2.

---

## Decisions resolved (see top of doc for the table)

All 4 open decisions answered 2026-05-27. Phase 1 build is underway.

---

## Status: Phase 1 in progress (started 2026-05-27)
