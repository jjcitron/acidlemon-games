# Phase 2 Verification

Generated: 2026-05-20T08:08:24

## Static checks

- `node --check` passed for all 23 active JavaScript files under `playable/js/`.

## Browser smoke tests performed

Opened:

```text
file:///C:/Dev/Personal/samurai%20action%20game/playable/index.html?v=phase2d
```

Verified:

- Menu loads with `MenuScene`.
- New game enters `ChapterScene`.
- Player atlas image loads.
- Atlas metadata loads from embedded fallback when opened by `file://`.
- Three enemies spawn from `data/levels/chapter1_dojo.json`.
- Camera pans when player is moved near the right side of the 2560px world.
- Fire imbue works through the generic element system.
- Heavy attack resolves from animation hit-frame and can kill an enemy.
- Victory scene appears when all enemies are cleared.
- Save/load round-trip survives browser reload:
  - slot2 restored player HP, meter, x/y, enemy type, and enemy HP.
  - save payload includes `modifications` array and `flags` object for Phase 3.
- Data-driven enemy HP verified from JSON: red brawler spawns with max HP 52.

## Known limits

- Placeholder atlas is generated from the original single Masayoshi image; it proves the animation system, not final art quality.
- Element specials are data-defined placeholders; only imbue behavior is playable.
- Track B full 3D-to-2D locked-frame pipeline is not completed in this code pass.
- Human combat-feel signoff is still required by the Phase 2 brief.


## Track B verification — 2026-05-20T08:19:33

- Canonical TripoSR mesh exists: `prototype/models/masayoshi_stage0.obj`.
- Blender rig file exists: `prototype/rigged/masayoshi_stage0_rigged.blend`.
- Blender posed scene exists: `prototype/blender/masayoshi_idle_posed.blend`.
- Final 3D render exists: `prototype/post/masayoshi_idle_3d_v1.png`.
- Comparison sheet exists: `prototype/post/masayoshi_3d_pipeline_comparison.png`.
- Pipeline decision exists: `prototype/PIPELINE_DECISION.md`.
- Playable Masayoshi atlas rebuilt from the 3D render.
- Decision: close/proof-of-pipeline; integrated as playable placeholder; not final production-art lock.


## Yoshitoshi art refinement update — 2026-05-20T08:36:46

The rough Track B 3D-render atlas has been superseded in the playable by a refined Yoshitoshi/Kuniyoshi bloody-print-inspired sprite treatment.

Active sprite source:

- `prototype/post/masayoshi_idle_yoshitoshi_v3.png`

Comparison sheet:

- `prototype/post/masayoshi_yoshitoshi_refinement_v3_comparison.png`

Active playable atlas:

- `playable/assets/sprites/masayoshi/atlas.png`

Backups:

- `playable/assets/sprites/masayoshi/atlas_phase2a_from_2d.png`
- `playable/assets/sprites/masayoshi/atlas_phase2trackb_rough3d.png`

Rationale:

- The previous rough 3D Track B sprite proved automation but did not meet the intended Yoshitoshi/bloody-prints aesthetic.
- v3 pushes the art toward deep indigo flat color blocks, vermillion blood/accent pass, tall severe silhouette, irregular black keyblock contours, and gouged scratch texture.
- It is integrated and browser-verified, but still marked as iteration art rather than final production art.


---

## Inspiration-driven hybrid art update — 2026-05-20T08:55:20

User direction: continue with **3D rig/pose + 2D post-process**, but push the art closer to Yoshitoshi/Kuniyoshi bloody-print aesthetics.

New input folder ingested:

- `inspiration/` — 15 reference images.

Analysis outputs:

- `prototype/inspiration_analysis/inspiration_contact_sheet.png`
- `prototype/inspiration_analysis/inspiration_manifest.json`
- `prototype/inspiration_analysis/inspiration_style_report.json`
- `prototype/inspiration_analysis/inspiration_edge_texture.png`

Pipeline direction now locked for current production experiments:

1. Use TripoSR/Blender rig/pose/render as **structure and repeatable pose source**.
2. Do not rely on the raw 3D render for final appearance.
3. Apply a 2D printmaking post-process/overpaint pass for the actual look:
   - saturated indigo robe blocks,
   - black irregular keyblock contour,
   - vermillion sash/blood/accent pass,
   - inspiration-derived edge/scratch texture,
   - taller ukiyo-e proportions,
   - readable game-sprite silhouette.

New hybrid sprite iterations:

- `prototype/post/masayoshi_idle_hybrid_yoshitoshi_v4.png`
- `prototype/post/masayoshi_idle_hybrid_yoshitoshi_v5.png`
- `prototype/post/masayoshi_idle_hybrid_yoshitoshi_v6.png` — active playable target.

Comparison sheets:

- `prototype/post/masayoshi_hybrid_v4_comparison.png`
- `prototype/post/masayoshi_hybrid_v5_comparison.png`
- `prototype/post/masayoshi_hybrid_v6_comparison.png`

Active integrated playable atlas:

- `playable/assets/sprites/masayoshi/atlas.png`

Backup before v6:

- `playable/assets/sprites/masayoshi/atlas_yoshitoshi_v3_backup_before_hybrid_v6.png`

Automation scripts:

- `prototype/scripts/inspect_inspiration.py`
- `prototype/scripts/derive_inspiration_style.py`
- `prototype/scripts/hybrid_3d_pose_to_yoshitoshi_v4.py`
- `prototype/scripts/hybrid_v5_readability_pass.py`
- `prototype/scripts/hybrid_v6_proportion_lock.py`
- `prototype/scripts/build_playable_atlas_from_hybrid_v6.py`

Verification:

- `node --check` passed for active JS files.
- Active atlas is `1536x1792 RGBA`.
- Browser loads `player_atlas` successfully.
- MenuScene loads, Enter starts ChapterScene, 3 enemies spawn.
- Browser console has zero errors.

Honest quality note:

Hybrid v6 is a stronger playable art target than the rough 3D render and previous v3/v5 experiments. It is still not final production quality: the hat/hair mass and figure pose need a better rigged base and/or hand-authored overpaint. The important pipeline decision is now clear: 3D owns pose consistency; 2D post-process owns the Yoshitoshi bloody-print surface.


---

## Phase 2.5 corrective brief — stopped at six-keyframe approval gate (2026-05-20T11:12:36)

Executed per `PHASE_2_5_CORRECTIVE_BRIEF.md` and intentionally stopped before Phase 2.5-C.

Completed:

- Archived active hybrid v6 atlas:
  - `playable/assets/sprites/masayoshi/atlas_hybrid_v6_archived.png`
- Assembled canonical 7-reference stack:
  - `prototype/refs/masayoshi_canon/ref_01_yoshitoshi_postbattle.png`
  - `prototype/refs/masayoshi_canon/ref_02_yoshitoshi_bloodied.png`
  - `prototype/refs/masayoshi_canon/ref_03_kuniyoshi_skeleton.png`
  - `prototype/refs/masayoshi_canon/ref_04_owner_panel_01.png`
  - `prototype/refs/masayoshi_canon/ref_05_owner_panel_02.png`
  - `prototype/refs/masayoshi_canon/ref_06_owner_panel_03.png`
  - `prototype/refs/masayoshi_canon/ref_07_owner_panel_04.png`
- Wrote prompts:
  - `prototype/prompts/masayoshi_base_prompt.txt`
  - `prototype/prompts/masayoshi_negative_prompt.txt`
- Built ComfyUI API workflow:
  - `prototype/comfy/masayoshi_keyframe_workflow.json`
- Fixed ComfyUI generation prerequisites found during smoke testing:
  - initial `flux1-schnell-fp8.safetensors` was corrupt/truncated.
  - downloaded valid `flux1-schnell-fp8-e4m3fn.safetensors` from `Kijai/flux-fp8`.
  - downloaded `clip_l.safetensors` and `t5xxl_fp8_e4m3fn.safetensors`.
  - downloaded `flux-vae-bf16.safetensors`.
- Smoke test succeeded:
  - `prototype/post/masayoshi_workflow_smoketest.png`
- Generated six pose/silhouette inputs:
  - `prototype/post/keyframes_round_1/poses/`
- Generated exactly 24 keyframe candidates:
  - `prototype/post/keyframes_round_1/01_idle_stance/`
  - `prototype/post/keyframes_round_1/02_walk_mid_step/`
  - `prototype/post/keyframes_round_1/03_light_attack_impact/`
  - `prototype/post/keyframes_round_1/04_heavy_attack_impact/`
  - `prototype/post/keyframes_round_1/05_dodge_mid_roll/`
  - `prototype/post/keyframes_round_1/06_hit_reaction/`
- Selected one candidate per keyframe:
  - `prototype/post/keyframes_round_1/selected/`
- Created review sheets:
  - `prototype/post/keyframes_round_1/keyframes_round_1_all_candidates.png`
  - `prototype/post/keyframes_round_1_review.png`

Gate status:

- STOPPED at Phase 2.5-B human approval gate.
- Do not proceed to Phase 2.5-C full animation generation until the project owner approves or gives targeted revision feedback.

Important implementation note:

- ComfyUI_IPAdapter_plus and comfyui_controlnet_aux custom nodes are installed.
- Flux IP-Adapter and Flux ControlNet/OpenPose model files were not present at initial execution.
- The Round 1 keyframes are generated with the corrected Flux Schnell stack and strong text prompting, but without the intended IP-Adapter/ControlNet conditioning models. This is visible in the review sheet: results are cleaner and more generative, but still risk leaning too modern/anime rather than fully Yoshitoshi/Kuniyoshi. Human approval should judge whether this is acceptable for Round 1 or whether Round 2 must first install/use Flux IP-Adapter + Flux ControlNet conditioning.


---

## Phase 2.5-C Masayoshi full animation generation/integration (2026-05-20T12:07:48)

Owner approved the six-keyframe gate with response `1`, so Phase 2.5-C proceeded.

Completed:

- Defined Phase 2.5-C frame manifest at:
  - `prototype/post/masayoshi_stage0_full/phase25c_frame_manifest.json`
- Note: the corrective brief says `~67` frames, but the explicit animation table sums to 57 frames. The implementation follows the explicit table exactly.
- Queued and generated the full candidate set:
  - 57 table frames × 2 candidates = 114 generated candidates
  - Queue manifest: `prototype/post/masayoshi_stage0_full/phase25c_queue_manifest.json`
  - Candidate root: `prototype/post/masayoshi_stage0_full/candidates/`
  - Completed: 57/57 frame jobs, 114/114 candidate images, 0 failures
- Created generated-candidate selections and previews:
  - `prototype/post/masayoshi_stage0_full/selection_manifest.json`
  - `prototype/post/masayoshi_stage0_full/previews/`
  - `prototype/post/masayoshi_stage0_full/masayoshi_stage0_full_selected_sheet.png`
- Corrected for generated-frame cropping/readability issues:
  - Raw generated selections often cropped head/torso and were not acceptable as the active gameplay atlas.
  - Built a gameplay-safe atlas from clean Round 1 approved-gate anchors with per-frame transforms, preserving the approved style direction and avoiding broken/cropped in-game sprites.
  - Active selected sheet: `prototype/post/masayoshi_stage0_full/masayoshi_stage0_clean_anchor_sheet.png`
  - Active previews: `prototype/post/masayoshi_stage0_full/previews_clean_anchor_locked/`
  - Active pack report: `prototype/post/masayoshi_stage0_full/phase25c_clean_anchor_pack_report.json`
- Integrated active Masayoshi atlas:
  - `playable/assets/sprites/masayoshi/atlas.png`
  - `playable/assets/sprites/masayoshi/atlas.json`
  - `playable/data/bootstrap.js` synced so file:// fallback metadata includes all new atlas animations.

Active atlas details:

- Atlas size: 1536 × 2048
- Frame size: 192 × 256
- Frames packed: 57
- Animations in metadata: idle, walk, run, light_attack_1, light_attack_2, light_attack_3, heavy_attack, jump, jump_attack, dodge, hit, death, block_idle, parry_flash, element_imbue_fire, victory
- Gameplay aliases retained: light_1, light_2, light_3, heavy

Verification:

- Node syntax checks pass for `playable/data/bootstrap.js` and all `playable/js/**/*.js`.
- Browser loads the new atlas image: 1536 × 2048.
- Browser loads updated atlas metadata with 20 animation entries including aliases.
- MenuScene loads.
- New game enters ChapterScene.
- Three enemies spawn.
- AnimationPlayer can play light attack and dodge with hit/iframe frame metadata.
- Browser console has 0 JS errors.

Known limitations:

- The generated 114 Phase 2.5-C candidates completed, but without Flux IP-Adapter/ControlNet pose conditioning they frequently cropped the character and were not production-safe.
- The active atlas is therefore a gameplay-safe keyframe-locked transform atlas, not final hand-authored per-frame art.
- This is acceptable as a functional Phase 2.5-C integration step, but a future art pass should install/use Flux IP-Adapter + Flux ControlNet/OpenPose or hand-pose the Blender rig before generative post-process to get true full-body unique frames.

Next Phase 2.5 item per brief:

- Phase 2.5-D atlas integration for Masayoshi is functionally complete.
- Phase 2.5-E yakuza brawler parallel pipeline remains next if continuing the corrective brief.


---

## Phase 2.5-E Yakuza brawler pipeline (2026-05-20T13:24:15)

Completed the yakuza brawler enemy sprite pipeline per the corrective brief.

### What was done:

1. Assembled yakuza brawler reference set (8 images):
   - `prototype/refs/yakuza_brawler_canon/`
   - Includes Kuniyoshi tattooed warrior (Yan-Qing), Yoshiiku murder prints, and owner source panels.

2. Wrote prompts:
   - `prototype/prompts/yakuza_brawler_base_prompt.txt`
   - `prototype/prompts/yakuza_brawler_negative_prompt.txt`

3. Generated full yakuza brawler animation set via ComfyUI Flux Schnell:
   - 26 frames across 8 animations (idle, walk, attack_windup, attack_strike, hit, death, block, taunt)
   - 52 candidates (2 per frame), 0 failures
   - Output: `prototype/post/yakuza_brawler_stage0/`

4. Selected best candidates and packed atlas:
   - `playable/assets/sprites/yakuza_grey/atlas.png` (1536 x 1024)
   - `playable/assets/sprites/yakuza_grey/atlas.json`
   - Selection sheet: `prototype/post/yakuza_brawler_stage0/yakuza_brawler_selected_sheet.png`

5. Generated 3 palette variants via hue/saturation shift:
   - `playable/assets/sprites/yakuza_red/atlas.png` + `atlas.json`
   - `playable/assets/sprites/yakuza_yellow/atlas.png` + `atlas.json`
   - `playable/assets/sprites/yakuza_purple/atlas.png` + `atlas.json` (reserved for future)
   - Comparison: `prototype/post/yakuza_brawler_stage0/yakuza_palette_variants_comparison.png`

6. Integrated sprite rendering into enemy.js:
   - Enemies now use AnimationPlayer + atlas rendering instead of Canvas polygons.
   - Polygon fallback preserved for any enemy type that fails to load atlas.
   - Animation state machine syncs: approach->idle/walk, attack->attack_windup->attack_strike, hit flash->hit anim, dead->death anim.

7. Updated asset loader (assets.js):
   - Loads enemy atlases per type from enemies.json sprite_image/sprite_atlas fields.
   - Fallback to bootstrap.js embedded metadata on file:// protocol.

8. Updated data files:
   - `playable/data/enemies.json`: added sprite_image/sprite_atlas paths for all 3 enemy types.
   - `playable/data/bootstrap.js`: embedded enemy atlas metadata for file:// fallback.

### Verification:
- Node syntax checks pass for all modified JS files.
- Browser loads all 3 enemy atlas images and metadata.
- All enemies use atlas=true, AnimationPlayer initialized.
- Enemies animate through idle, walk, attack_windup, attack_strike, hit, death states.
- Browser console has 0 JS errors.
- Masayoshi and yakuza brawlers are stylistically consistent (both woodblock-print style).

### Enemy type → variant mapping:
- yakuza_brawler_grey → yakuza_grey (base)
- yakuza_brawler_red → yakuza_red (hue-shifted)
- yakuza_brawler_heavy → yakuza_yellow (hue-shifted)
- yakuza_purple reserved for future enemy types
