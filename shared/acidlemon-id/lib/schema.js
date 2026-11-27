// Record shapes and blob paths for the shared identity store. See SCHEMA.md for the canonical
// logical schema (users / user_apps / saves) and how these paths map onto it.
import { APPS, isApp } from './apps.js';

export const SAVE_KINDS = ['level', 'fighter', 'pack', 'collection'];

// Clash of Steel Blades fighter kit. Groundwork only: the slots are fixed now so saves written
// today stay readable when the real mixer UI lands. Textures/meshes are named by id only —
// resolving an id to art is the title's job, not identity's.
export const FIGHTER_KIT_SLOTS = ['head', 'torso', 'arms', 'legs', 'weapon', 'style'];

// ---- paths -----------------------------------------------------------------
export const paths = {
  user: (uid) => `id/users/${uid}.json`,
  prefs: (uid) => `id/prefs/${uid}.json`,
  userApp: (uid, app) => `id/user-apps/${uid}/${app}.json`,
  userAppPrefix: (uid) => `id/user-apps/${uid}/`,
  save: (app, uid, kind, id) => `id/saves/${app}/${uid}/${kind}/${id}.json`,
  savePrefix: (app, uid, kind) =>
    kind ? `id/saves/${app}/${uid}/${kind}/` : `id/saves/${app}/${uid}/`,
  leaderboardEntry: (app, uid) => `id/leaderboard/${app}/${uid}.json`,
  leaderboardPrefix: (app) => `id/leaderboard/${app}/`,
  loginToken: (token) => `id/tokens/${token}.json`,
  loginCooldown: (uid) => `id/tokens/by-user/${uid}.json`,
};

export const MAX_PREFS_BODY_BYTES = 4096;

export function defaultPreferences() {
  return {
    audio: { master: 1, music: 1, sfx: 1 },
    emailOptIn: false,
    releaseNotify: false,
    reducedMotion: false,
    updatedAt: null,
  };
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOnlyKeys = (value, allowed) => Object.keys(value).every((key) => allowed.includes(key));

// Preferences are intentionally a small, closed shape. updatedAt is accepted from a client for
// round-tripping, but the API always replaces it with its own timestamp before storage.
export function validatePreferences(value) {
  if (!isRecord(value)) return 'Preferences must be an object.';
  if (!hasOnlyKeys(value, ['audio', 'emailOptIn', 'releaseNotify', 'reducedMotion', 'updatedAt'])) {
    return 'Preferences contain an unsupported field.';
  }
  for (const key of ['audio', 'emailOptIn', 'releaseNotify', 'reducedMotion']) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return `Preferences need ${key}.`;
  }
  if (!isRecord(value.audio) || !hasOnlyKeys(value.audio, ['master', 'music', 'sfx'])) {
    return 'audio must contain only master, music, and sfx.';
  }
  for (const key of ['master', 'music', 'sfx']) {
    const amount = value.audio[key];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 1) {
      return `audio.${key} must be a number from 0 to 1.`;
    }
  }
  for (const key of ['emailOptIn', 'releaseNotify', 'reducedMotion']) {
    if (typeof value[key] !== 'boolean') return `${key} must be a boolean.`;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'updatedAt') && value.updatedAt !== null) {
    const timestamp = typeof value.updatedAt === 'string' ? new Date(value.updatedAt) : null;
    if (!timestamp || !Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value.updatedAt) {
      return 'updatedAt must be an ISO date string or null.';
    }
  }
  return null;
}

// ---- validation ------------------------------------------------------------
export function isKind(kind) {
  return SAVE_KINDS.includes(String(kind || ''));
}

// A kind is only valid for an app that declares it, so a Cyberhell client can't write a
// `fighter` row into Clash's namespace.
export function kindAllowed(app, kind) {
  return isApp(app) && isKind(kind) && APPS[app].kinds.includes(kind);
}

const MAX_PAYLOAD_BYTES = 512 * 1024;
export const MAX_GELT = 1_000_000;

export function validateSave({ app, kind, payload }) {
  if (!isApp(app)) return 'Unknown app.';
  if (!isKind(kind)) return `kind must be one of ${SAVE_KINDS.join(', ')}.`;
  if (!kindAllowed(app, kind)) return `${APPS[app].label} does not store "${kind}" saves.`;
  if (payload === null || typeof payload !== 'object') return 'payload must be an object.';
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) return 'payload is too large.';
  if (kind === 'fighter') return validateFighterKit(payload);
  if (kind === 'collection') return validateCollection(payload);
  return null;
}

// A collection is a single closed record of skin ids and the player's current purse.
const SKIN_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const isSkinId = (value) => typeof value === 'string' && SKIN_ID_RE.test(value);

function validateCollection(payload) {
  if (!isRecord(payload) || !hasOnlyKeys(payload, ['purse', 'equipped', 'owned', 'israel'])) {
    return 'Collection must contain only purse, equipped, owned, and israel.';
  }
  const { purse, equipped, owned, israel } = payload;
  if (!Number.isInteger(purse) || purse < 0 || purse > MAX_GELT) {
    return `purse must be an integer from 0 to ${MAX_GELT}.`;
  }
  if (!Array.isArray(owned) || owned.length > 64 || !Array.from(owned).every(isSkinId)
      || new Set(owned).size !== owned.length) {
    return 'owned must contain up to 64 unique skin ids.';
  }
  if (!isSkinId(equipped) || !owned.includes(equipped)) return 'equipped must be an owned skin id.';
  if (typeof israel !== 'boolean') return 'israel must be a boolean.';
  return null;
}

// Fighter kit shape: every slot optional (a guest may have mixed only a head), but unknown slots
// are rejected so the vocabulary stays closed while the customizer is still being designed.
export function validateFighterKit(payload) {
  const slots = payload?.slots;
  if (slots === undefined) return null;
  if (slots === null || typeof slots !== 'object') return 'fighter.slots must be an object.';
  for (const key of Object.keys(slots)) {
    if (!FIGHTER_KIT_SLOTS.includes(key)) {
      return `Unknown fighter slot "${key}". Allowed: ${FIGHTER_KIT_SLOTS.join(', ')}.`;
    }
    const v = slots[key];
    if (v !== null && typeof v !== 'string') return `fighter.slots.${key} must be a string id.`;
    if (typeof v === 'string' && v.length > 64) return `fighter.slots.${key} is too long.`;
  }
  return null;
}

export function emptyFighterKit() {
  return { slots: Object.fromEntries(FIGHTER_KIT_SLOTS.map((s) => [s, null])) };
}

// A save id is client-suppliable (so a guest row keeps its identity after attach), so it has to
// be constrained to something that can't escape its blob prefix.
const SAVE_ID_RE = /^[a-zA-Z0-9_-]{1,48}$/;
export function isSaveId(id) {
  return SAVE_ID_RE.test(String(id || ''));
}
