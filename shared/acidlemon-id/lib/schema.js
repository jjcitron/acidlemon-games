// Record shapes and blob paths for the shared identity store. See SCHEMA.md for the canonical
// logical schema (users / user_apps / saves) and how these paths map onto it.
import { APPS, isApp } from './apps.js';

export const SAVE_KINDS = ['level', 'fighter', 'pack'];

// Clash of Steel Blades fighter kit. Groundwork only: the slots are fixed now so saves written
// today stay readable when the real mixer UI lands. Textures/meshes are named by id only —
// resolving an id to art is the title's job, not identity's.
export const FIGHTER_KIT_SLOTS = ['head', 'torso', 'arms', 'legs', 'weapon', 'style'];

// ---- paths -----------------------------------------------------------------
export const paths = {
  user: (uid) => `id/users/${uid}.json`,
  userApp: (uid, app) => `id/user-apps/${uid}/${app}.json`,
  userAppPrefix: (uid) => `id/user-apps/${uid}/`,
  save: (app, uid, kind, id) => `id/saves/${app}/${uid}/${kind}/${id}.json`,
  savePrefix: (app, uid, kind) =>
    kind ? `id/saves/${app}/${uid}/${kind}/` : `id/saves/${app}/${uid}/`,
  loginToken: (token) => `id/tokens/${token}.json`,
  loginCooldown: (uid) => `id/tokens/by-user/${uid}.json`,
};

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

export function validateSave({ app, kind, payload }) {
  if (!isApp(app)) return 'Unknown app.';
  if (!isKind(kind)) return `kind must be one of ${SAVE_KINDS.join(', ')}.`;
  if (!kindAllowed(app, kind)) return `${APPS[app].label} does not store "${kind}" saves.`;
  if (payload === null || typeof payload !== 'object') return 'payload must be an object.';
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) return 'payload is too large.';
  if (kind === 'fighter') return validateFighterKit(payload);
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
