import { createBlankLevel, normalizeLevel } from './levelSchema.js';

const STORAGE_KEY = 'harrierCustomLevels';

export class LocalLevelStore {
  listLevels() {
    return Object.values(this._readAll())
      .map(normalizeLevel)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  getLevel(id) {
    const raw = this._readAll()[id];
    return raw ? normalizeLevel(raw) : null;
  }

  saveLevel(level) {
    const normalized = normalizeLevel({ ...level, updatedAt: new Date().toISOString() });
    const all = this._readAll();
    all[normalized.id] = normalized;
    this._writeAll(all);
    return normalized;
  }

  deleteLevel(id) {
    const all = this._readAll();
    delete all[id];
    this._writeAll(all);
  }

  createLevel(overrides = {}) {
    return createBlankLevel(overrides);
  }

  _readAll() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  _writeAll(levels) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(levels));
    } catch (err) {
      console.warn('Unable to save custom levels:', err);
    }
  }
}

export const levelStore = new LocalLevelStore();
