// The app registry. This is the single source of truth for which titles exist, where they live,
// and how their sign-in email is branded. Redirect targets and CORS origins are resolved from
// here — never from request input — so a stolen magic-link token can't be pointed at a host we
// don't own.

export const APPS = {
  'sumi': {
    label: 'Sumi — Ink and Steel',
    origin: 'https://sumi-game.acidlemon.com',
    accent: '#7a1f18',
    kinds: ['level'],
  },
  'space-runner-3d': {
    label: 'Space Runner 3D',
    origin: 'https://spacerunner3d.acidlemon.com',
    accent: '#1f4d7a',
    kinds: ['level'],
  },
  'clash-of-steel-blades': {
    label: 'Clash of Steel Blades',
    origin: 'https://clashofsteelblades.acidlemon.com',
    accent: '#4a4a52',
    kinds: ['fighter'],
  },
  'cyberhell': {
    label: 'Cyberhell',
    origin: 'https://cyberhell.acidlemon.com',
    accent: '#a5122f',
    kinds: ['pack'],
  },
};

export const APP_IDS = Object.keys(APPS);

export function isApp(app) {
  return Object.prototype.hasOwnProperty.call(APPS, String(app || ''));
}

export function appOrNull(app) {
  return isApp(app) ? APPS[app] : null;
}

// Allowed CORS origins: every registered title, plus any extra origins named in
// ACIDLEMON_EXTRA_ORIGINS (comma-separated) for preview deploys and local dev.
export function allowedOrigins() {
  const extra = String(process.env.ACIDLEMON_EXTRA_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...APP_IDS.map((id) => APPS[id].origin), ...extra];
}
