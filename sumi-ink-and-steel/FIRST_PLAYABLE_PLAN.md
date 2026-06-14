# First Playable Slice — Sumi: Ink and Steel

Goal: turn the art-pipeline prototype into an immediately playable browser combat sandbox.

Scope:
- Vanilla HTML5 Canvas, no build step.
- One arena: burning dojo courtyard / ink-wash street.
- Masayoshi Stage 0 as playable hero.
- 2.5D beat-em-up movement: X plus lane/depth Y, with Y affecting draw order and scale.
- Controls:
  - Arrow keys / WASD: move.
  - J: light attack, 3-hit combo.
  - K: heavy attack / finisher.
  - Space: dodge dash.
  - L: elemental Fire imbue if meter is available.
  - P/Esc: pause.
- Enemy: yakuza brawler, simple approach/attack AI.
- Combat loop: hitboxes, knockback, hitstop, particles, screen shake, special meter, HP, wave clear.
- UI: woodcut title plaque, health/meter, combo callout, controls.

Acceptance criteria:
- Loads without console errors.
- Player can move in a bounded 2.5D arena.
- Player attacks can damage and defeat enemies.
- Enemies can damage player.
- Dodge grants a brief invulnerable dash.
- Fire imbue consumes meter and adds an AOE flame slash.
- Existing Masayoshi sprite is used directly in-game.
