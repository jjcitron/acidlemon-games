# 3D Harrier — Multi-Level Extension Plan

**Created:** 2026-05-27
**Status:** Draft, awaiting greenlight to start Phase 2
**Prerequisite reading:** [`../DESIGN-DECISIONS.md`](../DESIGN-DECISIONS.md)

This plan covers extending the game from the current Stage 1 endless loop to a full 18-stage campaign with multiple enemy types and 5–6 bosses. Existing Phase 1 systems stay; this builds on top.

---

## 1. Goal

Ship a playable game with all 18 stages, distinct themes, 8–10 enemy archetypes total, and 5–6 boss fights. The head-tracked 3D window remains the core display feature throughout.

---

## 2. Where We Are Now

Phase 1 is done:
- Stage 1 (MOOT) endless loop with one enemy (Mammoth)
- Full combat: 3 weapons (single/multi/laser), bomb, pickups (multi/laser/bomb/health)
- Lighting, shadows, jetpack glow, running animation
- HUD: HP bar, ammo bar, score, weapon, bomb count
- Audio: procedural SFX + m4a music loop (one track currently)

What's missing for a "real game":
1. Multiple distinct stages with palette + scenery variation
2. Stage progression: clear condition, transitions, title cards, score keeping
3. More enemy archetypes (target 8–10)
4. Boss fights (target 5–6)
5. Per-stage music switching (table exists, only one stage wired)
6. Difficulty curve across the whole game (within-stage ramp exists)

---

## 3. Stage Data Format

Stages become JSON files in `src/stages/`. The engine reads them; per-stage code is the exception, not the rule.

```json
{
  "id": 1,
  "name": "MOOT",
  "duration_sec": 75,
  "music": "sound/track_01.m4a",
  "palette": {
    "sky_top":    "#05143d",
    "sky_mid":    "#8a4a55",
    "sky_bottom": "#c28058",
    "fog":        "#c28058",
    "fog_near":   45,
    "fog_far":    240,
    "ground_a":   "#0d8030",
    "ground_b":   "#16ad48",
    "hemi_sky":   "#8870a8",
    "hemi_ground":"#402818"
  },
  "scenery": ["palm"],
  "enemies": [
    { "type": "mammoth", "weight": 1.0 }
  ],
  "spawn": {
    "interval_base": 1.3,
    "min_interval": 0.45,
    "ramp_seconds": 50,
    "formations": ["line", "v", "arc", "single"]
  },
  "boss": null,
  "next_stage": 2
}
```

Boss stages add `"boss": { "id": "dom", "duration_sec": 90, "music": "sound/track_06.m4a" }` and the engine runs the boss flow after the duration elapses.

---

## 4. Variation Strategy

Making 18 stages feel distinct without modeling 18 unique environments:

**A. Palette swaps** (cheap, high impact): sky + fog + hemi + ground colors per stage. Same scenery and enemy geometry, recolored.

**B. Scenery rotation:** pool of 5–6 scenery archetypes (palm, column, rock, mushroom, arch, crystal). Each stage selects 2–3 from the pool.

**C. Enemy roster rotation:** stages pull from a shared pool of 8–10 enemy types. New types introduced progressively, older ones return in remix combos.

**D. Bosses:** 5–6 distinct boss fights at stages 3, 7, 11, 14, 17, 18. Each is unique geometry + behavior + music.

**E. Music:** the 8 royalty-free tracks already supplied, mapped by mood. See section 8.

---

## 5. Stage-By-Stage Outline

Stage names are factual references from the source material; the game uses original geometry inspired by but not copying the originals. Verify final names against the reference video before committing each stage.

| # | Name | Theme | New element | Boss? |
|---|---|---|---|---|
| 1 | MOOT | Green field, palms, gold horizon | (baseline) | — |
| 2 | GEEZA | Same biome, denser fights | Charger enemy | — |
| 3 | AMAR | Mountain palette | (boss intro flow) | **Dom** (twin dragon heads) |
| 4 | CEIHA | Water/lake palette (cyan + violet) | Mushroom obstacle, Drone enemy | — |
| 5 | OLISIS | Alien purple + green | Pillar obstacles, Stalker | — |
| 6 | LAKELAD | Reflective ground, lily pads | (drone-heavy) | — |
| 7 | VARGAS | Volcanic | — | **Squilla** (scorpion) |
| 8 | ASAKUZA | Pillar canyon | Whirler enemy | — |
| 9 | MINIA | Twilight palette | All-Mammoth gauntlet at speed | — |
| 10 | DRAIL | Green-blue, crystal obstacles | — | — |
| 11 | ARUZART | Steel/grey | — | **Vana** (serpent) |
| 12 | SYLPHI | Sky-high palette, floating arches | Sniper enemy | — |
| 13 | LUKARK | Cave/dark (jetpack glow dominant) | — | — |
| 14 | IASIS | Crystal cavern | — | **Ida** (prism) |
| 15 | STONEHEAD | Floating stone heads | Drone Heavy enemy | — |
| 16 | ULTERIA | Alien spire | — | — |
| 17 | ABASH | Sky fortress | — | **Vortex** (swirling pattern) |
| 18 | HAYA-OH | Final, dark void | — | **Haya-Oh** (two-headed dragon, multi-phase) |

---

## 6. Enemy Roster (target 8 archetypes)

Built so far: **Mammoth** — one-eyed creature, tusks, wings.

Phase 2–5 additions, each in its own class extending a common `Enemy` base:

1. **Charger** — head-on rush, no wobble; hard dodge. Tetrahedron body + thrusters.
2. **Drone** — hovers, pivots, fires back at player. Floating disk with eye.
3. **Stalker** — appears from sides, swoops in. Elongated body with fins.
4. **Whirler** — spins toward player, erratic path. Spiked icosahedron.
5. **Sniper** — fires forward bullets from a distance. Turret on stalk.
6. **Drone Heavy** — like Drone, 3 HP, bigger silhouette. Glow inside.
7. **Crystal** — destructible obstacle for score. Faceted shapes.
8. **Pillar** — static obstacle: dodge or destroy. Cylinder geometry.

All castShadow. All Tier 0 procedural (Three.js primitives) initially. Hero enemies (Mammoth, the boss-rush types) earn Tier 1/2 upgrades later.

---

## 7. Boss Design Framework

Common shape for every boss:
- Multi-phase fight (2–3 phases, weak points exposed per phase)
- Pattern-driven attacks: telegraph + projectile spawn
- Distinct silhouette, music, arena framing
- Phase health bar across top during the fight
- 600–1500 points on kill

Bosses in order of build:

| Boss | Stage | Style | Tier |
|---|---|---|---|
| Dom | 3 | Twin dragon heads, weak point center | T1 procedural (Phase 3 build), upgrade to T2 later |
| Squilla | 7 | Scorpion, pincers + tail sting | T2 (AI image-to-3D recommended) |
| Vana | 11 | Serpent, multi-segment damage | T2 |
| Ida | 14 | Crystal prism, refracts player shots | T1 procedural is fine |
| Vortex | 17 | Swirling, weak when stationary | T1 procedural |
| Haya-Oh | 18 | Two-headed dragon, multi-phase, ending | **T2 minimum, T3 (commissioned artist) ideal** |

Asset tier recap (from earlier roadmap):
- **T0:** primitives assembled in code
- **T1:** Blender Python procedural script
- **T2:** AI image-to-3D services (Meshy, Tripo, Luma)
- **T3:** commissioned human artist

---

## 8. Music Map

8 tracks, mapped by mood. Assignment is editable in `STAGE_TRACKS` (in `main.js`):

| Track | Stages |
|---|---|
| track_01 | 1, 2 (early game energy) |
| track_02 | 4, 5, 6 (mid game biomes) |
| track_03 | 8, 9, 10 |
| track_04 | 12, 13 |
| track_05 | 15, 16 |
| track_06 | Boss stages 3, 7, 11 (recurring "boss A" theme) |
| track_07 | Boss stages 14, 17 ("boss B") |
| track_08 | Stage 18 final boss |

If more tracks are commissioned later, extend the table.

---

## 9. Difficulty Curve

Each stage runs 60–90 sec. Within-stage difficulty already ramps via spawn rate + enemy speed; cross-stage difficulty escalates:

- **Stages 1–3:** 1–2 enemy types, gentle ramp
- **Stages 4–7:** 2–3 types, faster ramp, first hard boss at 7
- **Stages 8–13:** 3–4 types per stage, midgame plateau, two bosses
- **Stages 14–17:** full roster, fast ramps, two more bosses
- **Stage 18:** gauntlet + final boss

Player reward curve:
- +1 life every 3 stages cleared (5 extra lives across 18)
- Bomb pickups become more common in late stages
- Multishot/laser duration scales up slightly past stage 10

---

## 10. Implementation Phases

**Phase 2 — Stage system + stages 2-3 (3–5 sessions)**
- StageManager loads JSON, swaps palette + scenery + enemies on stage change
- World exposes `setPalette({...})` that animates sky/fog/hemi/ground over ~1.5 s for smooth transitions
- Stages 2 and 3 implemented; first new enemy (Charger)
- Stage clear flow: enemies stop spawning, brief pause, fade, title card, next stage starts
- Stage 3 boss is a skeleton trigger (just a stage-clear) until Phase 3 fills it in

**Phase 3 — First boss (2–3 sessions)**
- `Boss` base class: multi-phase, boss HP bar, pattern dispatch
- Stage 3 boss "Dom" implementation (T1 procedural)
- Boss music swap on engagement
- Game-over loop respects boss-stage state

**Phase 4 — Stages 4–9 + second boss (5–7 sessions)**
- Six more stages with palette diversity
- Three more enemy types: Drone, Stalker, Whirler
- Stage 7 boss "Squilla"
- Pickup balance pass: tune spawn weights per stage difficulty band

**Phase 5 — Stages 10–17 + 3 bosses (5–7 sessions)**
- Eight more stages
- Three more enemy types: Sniper, Drone Heavy, Crystal/Pillar
- Bosses: Vana, Ida, Vortex
- Difficulty tuning across the full curve

**Phase 6 — Finale + ship (3–4 sessions)**
- Stage 18 + Haya-Oh final boss
- Ending sequence
- Performance pass (LOD on distant enemies, audio mixing, profile)
- Save high score (localStorage)
- Deploy to itch.io or static host

**Total: ~20–26 focused sessions** over weeks/months of calendar time, depending on whether assets are commissioned in parallel.

---

## 11. Asset Commission Decisions (open)

To be decided before the relevant phase starts:

1. **Hero player model** — currently Tier 0. T1 (Blender script) or T2 (AI image-to-3D) upgrade? Recommend evaluating before Phase 3 so the upgrade lands with the first boss.
2. **Boss assets** — T2 for all 6? Or T3 commissioned for Haya-Oh only? Budget: $50–200 per T2, $300–800 for T3.
3. **More music** — 8 tracks for 18 stages is workable but tight (3 tracks repeat 3+ times). 2–4 additional tracks would help variety.
4. **SFX upgrade** — current procedural is fine but a real sound designer could elevate things.

---

## 12. Open Questions

Not blocking but worth resolving before they bite:

- Should bosses have a cinematic intro (camera pulls back, name banner)?
- High score persistence: localStorage at minimum?
- Mobile / touch support? Input is desktop-only right now.
- Continue system: limited continues per game-over, or unlimited as today?
- Score attack or speedrun mode? Could be a Phase 6 add.
- Should head-tracking calibration be a step in onboarding, or stay buried as `R`?

---

## 13. Resumption Procedure

If we pick this up months later:

1. Read `../DESIGN-DECISIONS.md` to refresh on architecture and rationale
2. Read this plan
3. `git log --oneline` to see commit history → resumption point
4. Run `python -m http.server 8765` in the repo root and load `http://localhost:8765/` to verify the current build works
5. `src/main.js` render loop is the orchestration center — start there
6. Pick up at whichever Phase is next (currently Phase 2)

---

## Status: Phase 1 complete. Awaiting greenlight on Phase 2.
