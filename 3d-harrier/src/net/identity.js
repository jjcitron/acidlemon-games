// Space Runner 3D's binding to the shared Acidlemon identity service.
//
// This is a consumer, not an auth implementation. There is exactly one magic-link flow across all
// four titles and it lives in `shared/acidlemon-id`. Nothing here signs, verifies, or stores a
// credential; it forwards to that service and translates its 401 into "prompt to sign in".
//
// The client module is fetched from the service origin rather than vendored, so there is no second
// copy to drift. Space Runner is a static site with no build step, so a relative path into the
// monorepo would not exist in the deployed artifact — hence the dynamic import.
//
// Scope notes:
//   - Purely additive. No existing Space Runner file imports this, so the WS1 stage-signoff QA
//     candidate behaves identically with this file present.
//   - Session and play telemetry are NOT this module's business. Those stay on WS1 /api/event.
//     Identity never emits a play event.
//   - SaveStore (src/game/save.js) keeps owning local progress — high score, best stage. This
//     module handles the *authored* artifact (a built stage), which is what sign-in gates.

export const APP_ID = 'space-runner-3d';
const KIND = 'level';
const DEFAULT_ORIGIN = 'https://id.acidlemon.com';

export class Identity {
  // `origin` exists so `vercel dev` / preview deploys can point somewhere else. Production uses
  // the shared service at id.acidlemon.com.
  constructor({ origin = DEFAULT_ORIGIN } = {}) {
    this.origin = String(origin).replace(/\/$/, '');
    this.id = null;
  }

  async #client() {
    if (this.id) return this.id;
    const { AcidlemonId } = await import(`${this.origin}/client/acidlemon-id.js`);
    this.id = new AcidlemonId({ app: APP_ID, base: this.origin });
    return this.id;
  }

  // Call once on load. Resolves the shared cookie and, if the player just came back from a magic
  // link, folds whatever they built as a guest into their account. Never throws: if the service
  // is unreachable the player simply stays a guest and keeps building locally.
  async boot() {
    try {
      const id = await this.#client();
      return await id.boot([KIND]);
    } catch {
      this.unreachable = true;
      return null;
    }
  }

  get signedIn() {
    return !!this.id?.signedIn;
  }

  get email() {
    return this.id?.user?.email || null;
  }

  // Every title this player has touched — the cross-title hook. Empty for a guest.
  get apps() {
    return this.id?.user?.apps || [];
  }

  // Guest-safe save. Returns { ok } when it landed, or { needsSignIn: true } when the player has
  // to click a link first. Either way the stage is already in local storage.
  async saveStage(stage, id) {
    return (await this.#client()).save(KIND, stage, id);
  }

  // Stash a stage locally with no API call at all — this is the guest-create path. Only the
  // client module itself is fetched; nothing is sent to /api.
  async stashStage(stage, id) {
    return (await this.#client()).stashGuest(KIND, stage, id);
  }

  async listStages() {
    return (await this.#client()).listSaves(KIND);
  }

  // Stages built before signing in, still only in this browser.
  async guestStages() {
    return (await this.#client()).guestSaves(KIND);
  }

  // `next` is where the emailed link should land them back.
  async requestLink(email, next = '/') {
    return (await this.#client()).requestLink(email, next);
  }

  async logout() {
    return (await this.#client()).logout();
  }
}
