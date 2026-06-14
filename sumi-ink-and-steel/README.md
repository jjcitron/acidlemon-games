# Samurai Action Game

Playable browser prototype for the samurai action game.

## Local testing

```bash
python -m http.server 8000
```

Open http://127.0.0.1:8000/

## Vercel

This repository is arranged as a static site: `index.html` is at the repo root and all runtime assets are under `assets/`, `data/`, and `js/`.

In Vercel, deploy with the default static settings:
- Framework Preset: Other
- Build Command: none
- Output Directory: `.`
commit to push to vercel
