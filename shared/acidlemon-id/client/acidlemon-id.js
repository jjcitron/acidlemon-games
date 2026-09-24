// Browser client for the shared Acidlemon identity service. Drop this into any title:
//
//   import { AcidlemonId } from '.../acidlemon-id.js';
//   const id = new AcidlemonId({ app: 'space-runner-3d' });
//   await id.refresh();                                  // who am I? (null = guest)
//   const r = await id.save('level', payload, 'stage-3'); // { ok } | { needsSignIn: true }
//   if (r.needsSignIn) await id.requestLink(email);       // then they click the email
//
// Guest work is never lost: save() writes it to local storage first, so a failed or unauthenticated
// save still leaves the player's build on disk. After the magic link lands, flushGuest() folds it in.
//
// Every request is credentialed. The session cookie is scoped to .acidlemon.com, so one sign-in
// works across all four titles — but the browser only attaches it cross-origin when the request
// sets credentials:'include' AND the service echoes the exact origin back.

const DEFAULT_BASE = 'https://id.acidlemon.com';

export class AcidlemonId {
  constructor({ app, base = DEFAULT_BASE, storage } = {}) {
    if (!app) throw new Error('AcidlemonId needs an app id');
    this.app = app;
    this.base = String(base).replace(/\/$/, '');
    this.store = storage || globalThis.localStorage || null;
    this.user = null;
  }

  get signedIn() {
    return !!this.user;
  }

  async #call(path, { method = 'GET', body } = {}) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  // ---- identity ------------------------------------------------------------
  async refresh() {
    const { ok, data } = await this.#call('/api/auth/me');
    this.user = ok ? data : null;
    return this.user;
  }

  // `next` is the path to land on after the link is clicked, e.g. '/editor'.
  async requestLink(email, next = location.pathname + location.search) {
    const { ok, data } = await this.#call('/api/auth/request', {
      method: 'POST',
      body: { email, app: this.app, next },
    });
    return ok ? { ok: true } : { ok: false, error: data.error || 'Could not send the link.' };
  }

  async logout() {
    await this.#call('/api/auth/logout', { method: 'POST' });
    this.user = null;
  }

  // ---- guest storage -------------------------------------------------------
  #guestKey(kind) {
    return `acidlemon.guest.${this.app}.${kind}`;
  }

  guestSaves(kind) {
    if (!this.store) return [];
    try {
      const raw = JSON.parse(this.store.getItem(this.#guestKey(kind)) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  #writeGuest(kind, rows) {
    if (!this.store) return;
    try { this.store.setItem(this.#guestKey(kind), JSON.stringify(rows.slice(-50))); } catch {}
  }

  stashGuest(kind, payload, id) {
    const rows = this.guestSaves(kind);
    const localId = id || `guest-${rows.length + 1}`;
    const next = rows.filter((r) => r.id !== localId);
    next.push({ id: localId, kind, payload, updated_at: new Date().toISOString() });
    this.#writeGuest(kind, next);
    return localId;
  }

  clearGuest(kind) {
    if (!this.store) return;
    try { this.store.removeItem(this.#guestKey(kind)); } catch {}
  }

  // ---- saving --------------------------------------------------------------
  // Always stashes locally, then tries the server. A 401 comes back as needsSignIn so the caller
  // can show the magic-link form — the work is already safe on disk either way.
  async save(kind, payload, id) {
    const localId = this.stashGuest(kind, payload, id);
    const { status, ok, data } = await this.#call('/api/saves', {
      method: 'PUT',
      body: { app: this.app, kind, id: localId, payload },
    });
    if (ok) {
      this.clearGuestRow(kind, localId);
      return { ok: true, save: data.save };
    }
    if (status === 401) return { needsSignIn: true, localId };
    return { ok: false, error: data.error || 'Save failed.', localId };
  }

  clearGuestRow(kind, id) {
    this.#writeGuest(kind, this.guestSaves(kind).filter((r) => r.id !== id));
  }

  async listSaves(kind) {
    const q = kind ? `&kind=${encodeURIComponent(kind)}` : '';
    const { ok, data } = await this.#call(`/api/saves?app=${encodeURIComponent(this.app)}${q}`);
    return ok ? data.saves : [];
  }

  // Call once on load when signed in (e.g. after ?auth=ok). Pushes everything the guest built.
  async flushGuest(kinds) {
    if (!this.signedIn) return { attached: 0 };
    const list = kinds || ['level', 'fighter', 'pack'];
    const items = list.flatMap((kind) => this.guestSaves(kind));
    if (!items.length) return { attached: 0 };

    const { ok, data } = await this.#call('/api/saves/attach', {
      method: 'POST',
      body: { app: this.app, items },
    });
    if (!ok) return { attached: 0, error: data.error };
    for (const r of data.results || []) {
      if (r.ok) {
        const row = items.find((i) => i.id === r.id);
        if (row) this.clearGuestRow(row.kind, row.id);
      }
    }
    return { attached: data.attached || 0 };
  }

  // Convenience: refresh, then fold in any guest work if the magic link just landed.
  async boot(kinds) {
    await this.refresh();
    if (this.signedIn) await this.flushGuest(kinds);
    return this.user;
  }
}

export const FIGHTER_KIT_SLOTS = ['head', 'torso', 'arms', 'legs', 'weapon', 'style'];
