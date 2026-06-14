const DEFAULT_SAVE = {
  highScore: 0,
  bestStageReached: 1,
  completionCount: 0
};

const SAVE_KEY = 'harrierSaveV1';
const LEGACY_HIGH_SCORE_KEY = 'dimensionalHighScore';

export class SaveStore {
  load() {
    const save = this._readCurrent();
    const legacyHighScore = Number(window.localStorage?.getItem(LEGACY_HIGH_SCORE_KEY) || 0);
    if (legacyHighScore > save.highScore) save.highScore = legacyHighScore;
    return save;
  }

  recordStageReached(stageId) {
    const save = this.load();
    const id = Number(stageId);
    if (Number.isFinite(id)) save.bestStageReached = Math.max(save.bestStageReached || 1, id);
    this._write(save);
    return save;
  }

  recordScore(score, stageId = null) {
    const save = this.load();
    save.highScore = Math.max(save.highScore || 0, Number(score) || 0);
    const id = Number(stageId);
    if (Number.isFinite(id)) save.bestStageReached = Math.max(save.bestStageReached || 1, id);
    this._write(save);
    try { window.localStorage?.setItem(LEGACY_HIGH_SCORE_KEY, String(save.highScore)); } catch {}
    return save;
  }

  recordRunComplete(score, finalStageId) {
    const save = this.recordScore(score, finalStageId);
    save.completionCount = (save.completionCount || 0) + 1;
    this._write(save);
    return save;
  }

  reset() {
    const save = { ...DEFAULT_SAVE };
    this._write(save);
    try { window.localStorage?.removeItem(LEGACY_HIGH_SCORE_KEY); } catch {}
    return save;
  }

  restore(save = DEFAULT_SAVE) {
    const next = { ...DEFAULT_SAVE, ...(save && typeof save === 'object' ? save : {}) };
    this._write(next);
    try { window.localStorage?.setItem(LEGACY_HIGH_SCORE_KEY, String(next.highScore || 0)); } catch {}
    return next;
  }

  _readCurrent() {
    try {
      const parsed = JSON.parse(window.localStorage?.getItem(SAVE_KEY) || 'null');
      return { ...DEFAULT_SAVE, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  _write(save) {
    try { window.localStorage?.setItem(SAVE_KEY, JSON.stringify({ ...DEFAULT_SAVE, ...save })); } catch {}
  }
}

export const saveStore = new SaveStore();
