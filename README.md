# acidlemon games

Two browser games I built as proof of concepts and to be a beginner again. They're prototypes, not products, and the source is here because there's nothing worth gatekeeping. If you want to read how they work, fork the level editors, or build something better, go ahead.

Write-up: [acidlemon.com](https://acidlemon.com)

## The games

### [Sumi: Ink and Steel](./sumi-ink-and-steel/) — 2D samurai brawler
A side-on action game in a late-Edo bloody-woodblock style (Yoshitoshi / Kuniyoshi). Every character sprite was generated through a fully local ComfyUI + Flux pipeline running on a laptop GPU. Vanilla HTML5 Canvas, no framework, no build step, data-driven levels.

- **Play it (full audio):** https://samurai-action-game.vercel.app/
- **Level editor:** the title screen has a Level Editor link, or go to `/editor`. Build connected rooms, paint backgrounds, draw the walkable floor, place enemies and doors, save to your browser (localStorage), and export/import levels as JSON.

### [3D Harrier](./3d-harrier/) — head-tracked rail shooter
An homage to the 1985 arcade game *Space Harrier*, with original geometry and original audio. The display layer is the interesting part: the webcam tracks your head and re-projects the scene with off-axis projection, so your monitor becomes a window into the world. Three.js, MediaPipe FaceLandmarker for head tracking, no build step. Includes a stage editor with browser-local saves.

- **Play it (full audio + head tracking):** https://3d-harrier.vercel.app/

## Running locally

Both are static, no build step. Serve the folder over HTTP (camera and JSON fetch need `http://`, not `file://`):

```bash
cd sumi-ink-and-steel   # or: cd 3d-harrier
python -m http.server 8000
# open http://localhost:8000
```

## What's not in this repo

To keep the repo light, the heavy generated media is omitted:

- **Audio** (music and sound effects) and **video** captures are not included. Both games run without them; the live links above have the full audio.
- Intermediate art-generation scratch (the raw ComfyUI / generation output) is left out. The final in-game art is included.

This is a fresh, single-commit snapshot of the source. The day-to-day commit history lives in the private working repos.

## Where this is going

The thing that pulled me into computers was being able to crack open a game like Doom and build my own levels. So both of these ship with a level editor, and the next step is accounts and logins so people can publish and play each other's levels, not just build them locally. These are throwaways, but they might be good starts.

## License / legal

Personal prototypes. *3D Harrier* is an unofficial fan homage inspired by *Space Harrier* (© Sega, 1985) — no original Sega assets, audio, or code are used; all geometry, music, and behaviors are original works. *Sumi: Ink and Steel* art and code are original.
