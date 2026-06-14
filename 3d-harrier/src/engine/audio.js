// SFX are procedurally synthesized via WebAudio. Background music is loaded
// from MP3 tracks supplied by the project owner. A chiptune fallback covers
// the case where file playback is blocked or fails.

export const AUDIO_SAMPLE_GROUPS = {
  shootSingle: [
    'sound/effects/Recon Fast Blaster/MA_Designed_ReconFastBlaster_1.wav',
    'sound/effects/Recon Fast Blaster/MA_Designed_ReconFastBlaster_2.wav',
    'sound/effects/Recon Fast Blaster/MA_Designed_ReconFastBlaster_3.wav'
  ],
  shootMulti: [
    'sound/effects/MA_IVLIOR_Heavy_Machine_Gun_1.wav',
    'sound/effects/MA_IVLIOR_Heavy_Machine_Gun_2.wav',
    'sound/effects/MA_IVLIOR_Heavy_Machine_Gun_3.wav',
    'sound/effects/MA_IVLIOR_Heavy_Machine_Gun_4.wav'
  ],
  shootLaser: [
    'sound/effects/Resistance Blaster/MA_Designed_ResistanceBlaster_1.wav',
    'sound/effects/Resistance Blaster/MA_Designed_ResistanceBlaster_2.wav',
    'sound/effects/Resistance Blaster/MA_Designed_ResistanceBlaster_3.wav',
    'sound/effects/Resistance Blaster/MA_Designed_ResistanceBlaster_4.wav'
  ],
  pickup: [
    'sound/effects/MA_OriginalSound_FutureUserInterfaceGlitches_1.wav',
    'sound/effects/MA_OriginalSound_FutureUserInterfaceGlitches_2.wav',
    'sound/effects/MA_OriginalSound_FutureUserInterfaceGlitches_3.wav',
    'sound/effects/MA_OriginalSound_FutureUserInterfaceGlitches_4.wav',
    'sound/effects/MA_OriginalSound_FutureUserInterfaceGlitches_5.wav'
  ],
  bomb: [
    'sound/effects/MA_SoundCreator_Boom_Sound_1.wav',
    'sound/effects/MA_SoundCreator_Boom_Sound_2.wav',
    'sound/effects/MA_Originals_CinematicSwooshImpacts_Boom01.wav',
    'sound/effects/MA_Originals_CinematicSwooshImpacts_Boom02.wav'
  ],
  explosion: [
    'sound/effects/MA_Originals_CinematicSwooshImpacts_Boom01.wav',
    'sound/effects/MA_Originals_CinematicSwooshImpacts_Boom02.wav',
    'sound/effects/MA_Originals_CinematicSwooshImpacts_Boom03.wav'
  ],
  playerHit: [
    'sound/effects/Powerful Hits And Braams/MA_Originals_PowerfulHitsAndBraams_1.wav',
    'sound/effects/Powerful Hits And Braams/MA_Originals_PowerfulHitsAndBraams_2.wav',
    'sound/effects/MA_Originals_ScaryHybridHitsAndBraams/MA_Originals_ScaryHybridHitsAndBraams_1.wav',
    'sound/effects/MA_Originals_ScaryHybridHitsAndBraams/MA_Originals_ScaryHybridHitsAndBraams_2.wav'
  ],
  enemyHit: [
    'sound/effects/Radio Electric Disturbance/MA_Originals_RadioElectricDisturbance_1.wav',
    'sound/effects/Radio Electric Disturbance/MA_Originals_RadioElectricDisturbance_2.wav',
    'sound/effects/Radio Electric Disturbance/MA_Originals_RadioElectricDisturbance_3.wav',
    'sound/effects/MA_OriginalSound_FutureUserInterfaceGlitches_5.wav'
  ]
};

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.musicPlaying = false;
    this.musicEl = null;
    this.musicBaseVolume = 0.5;
    this.musicLevel = this._savedLevel('harrierMusicVolume', 0.65);
    this.sfxLevel = this._savedLevel('harrierSfxVolume', 1.0);
    this.musicVolume = 0.32;
    this.musicFileScale = 0.62;
    this.buffers = {};
    this.sampleLoadStarted = false;
    this.sampleLoadPromise = null;
    this.lastSampleAt = {};
    this.lastWarningAt = {};
    this.sampleGroups = AUDIO_SAMPLE_GROUPS;
    this.musicPreload = new Map();
  }

  preloadMusic(url) {
    if (!url || this.musicPreload.has(url)) return this.musicPreload.get(url) || Promise.resolve(null);
    const promise = new Promise(resolve => {
      const el = new Audio();
      el.preload = 'auto';
      el.src = url;
      const done = () => resolve(el);
      el.addEventListener('canplaythrough', done, { once: true });
      el.addEventListener('loadedmetadata', done, { once: true });
      el.addEventListener('error', () => resolve(null), { once: true });
      try { el.load(); } catch { resolve(null); }
    });
    this.musicPreload.set(url, promise);
    return promise;
  }

  // Play a music file in loop. Stops any current music first.
  // Falls back to the procedural chiptune if file playback fails.
  async loadAndPlayMusic(url, volume = 0.5) {
    this.stopMusic();
    this.ensure();
    try {
      this.musicEl = new Audio(url);
      this.musicEl.loop = true;
      this.musicBaseVolume = volume;
      this._applyMusicVolume();
      await this.musicEl.play();
      this.musicPlaying = true;
    } catch (err) {
      console.warn('file music failed, falling back to chiptune:', err.message);
      this.musicEl = null;
      this.startMusic();
    }
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.95;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.12 * this.musicLevel;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 1.35 * this.sfxLevel;
    this.sfxGain.connect(this.master);
    this.preloadSamples();
  }

  _savedLevel(key, fallback) {
    try {
      const raw = window.localStorage?.getItem(key);
      const value = raw === null ? fallback : Number(raw);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
    } catch {
      return fallback;
    }
  }

  _storeLevel(key, value) {
    try { window.localStorage?.setItem(key, String(value)); } catch {}
  }

  _applyMusicVolume() {
    const volume = Math.max(0, Math.min(1, this.musicBaseVolume * this.musicFileScale * this.musicLevel));
    this.musicVolume = volume;
    if (this.musicEl) this.musicEl.volume = volume;
    if (this.musicGain) this.musicGain.gain.value = 0.12 * this.musicLevel;
  }

  setMusicVolume(level) {
    const value = Number(level);
    this.musicLevel = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : this.musicLevel;
    this._storeLevel('harrierMusicVolume', this.musicLevel);
    this._applyMusicVolume();
  }

  setSfxVolume(level) {
    const value = Number(level);
    this.sfxLevel = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : this.sfxLevel;
    this._storeLevel('harrierSfxVolume', this.sfxLevel);
    if (this.sfxGain) this.sfxGain.gain.value = 1.35 * this.sfxLevel;
  }

  getSettings() {
    return { music: this.musicLevel, sfx: this.sfxLevel };
  }

  preloadSamples() {
    if (!this.ctx || this.sampleLoadStarted) return this.sampleLoadPromise;
    this.sampleLoadStarted = true;
    const urls = [...new Set(Object.values(this.sampleGroups).flat())];
    this.sampleLoadPromise = Promise.allSettled(urls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const data = await res.arrayBuffer();
      this.buffers[url] = await this.ctx.decodeAudioData(data);
    })).then(results => {
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed) console.warn(`${failed} sound effect files failed to load`);
    });
    return this.sampleLoadPromise;
  }

  _playSample(group, { volume = 1, rate = 1, maxDuration = 0, cooldown = 0 } = {}) {
    this.ensure();
    const now = this.ctx.currentTime;
    if (cooldown > 0 && now - (this.lastSampleAt[group] || 0) < cooldown) return true;
    const urls = this.sampleGroups[group] || [];
    const ready = urls.filter(url => this.buffers[url]);
    if (!ready.length) return false;
    this.lastSampleAt[group] = now;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[ready[Math.floor(Math.random() * ready.length)]];
    src.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.sfxGain);
    src.start(now);
    if (maxDuration > 0) {
      g.gain.setValueAtTime(volume, now);
      g.gain.linearRampToValueAtTime(0.001, now + maxDuration);
      src.stop(now + maxDuration + 0.02);
    }
    return true;
  }

  startMusic() {
    this.ensure();
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.musicStart = this.ctx.currentTime + 0.1;
    this.lastBeat = 0;
    this._scheduleAhead();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicEl) {
      this.musicEl.pause();
      this.musicEl.currentTime = 0;
      this.musicEl = null;
    }
  }

  _scheduleAhead() {
    if (!this.musicPlaying) return;
    const bpm = 138;
    const beatDur = 60 / bpm;
    const lookahead = 0.25;
    const now = this.ctx.currentTime;
    while (this.musicStart + this.lastBeat * beatDur < now + lookahead) {
      this._scheduleBeat(this.lastBeat, this.musicStart + this.lastBeat * beatDur, beatDur);
      this.lastBeat++;
    }
    setTimeout(() => this._scheduleAhead(), 60);
  }

  _scheduleBeat(idx, t, beatDur) {
    const step = idx % 16;
    // Driving bassline (root-fifth pattern, minor key)
    const bass = [55,55,82,55, 65,65,98,65, 73,73,110,73, 65,65,98,55];
    this._note(bass[step], 'sawtooth', t, beatDur * 0.5, 0.18, this.musicGain);

    // Off-beat ghost notes
    if (step % 2 === 1) {
      this._note(bass[step] * 2, 'square', t + beatDur * 0.5, beatDur * 0.2, 0.05, this.musicGain);
    }

    // Lead motif every 4 beats
    if (idx % 4 === 0) {
      const lead = [440, 523, 587, 659, 587, 523, 440, 392];
      const li = (idx / 4) % lead.length;
      this._note(lead[li], 'triangle', t, beatDur * 2.0, 0.14, this.musicGain);
    }

    // Hi arpeggio fills
    if (step === 6 || step === 14) {
      [880, 988, 1175, 1318].forEach((f, i) => {
        this._note(f, 'square', t + i * beatDur * 0.06, beatDur * 0.12, 0.045, this.musicGain);
      });
    }

    // Kick on 1 and 3
    if (step === 0 || step === 8) {
      this._kick(t);
    }
    // Hat on every off
    if (step % 2 === 1) {
      this._hat(t, 0.04, 0.06);
    }
  }

  _note(freq, wave, t, dur, vol, out) {
    if (!freq) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + 0.2);
  }

  _hat(t, dur = 0.04, vol = 0.06) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(hp).connect(g).connect(this.musicGain);
    src.start(t);
  }

  playShoot(weapon = 'single') {
    this.ensure();
    if (weapon === 'laser' && this._playSample('shootLaser', { volume: 0.34, rate: 1.15, maxDuration: 0.16, cooldown: 0.035 })) return;
    if (weapon === 'multishot') this._playSample('shootMulti', { volume: 0.72, rate: 1.7, maxDuration: 0.18, cooldown: 0.035 });
    else if (this._playSample('shootSingle', { volume: 0.42, rate: 1.2, maxDuration: 0.18, cooldown: 0.06 })) return;
    const t = this.ctx.currentTime;
    if (weapon === 'laser') {
      // Sharp short zap, higher pitch
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(2200, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.05);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.connect(g).connect(this.sfxGain);
      o.start(t); o.stop(t + 0.08);
      return;
    }
    if (weapon === 'multishot') {
      // Three slightly detuned blips for the spread
      for (let i = 0; i < 3; i++) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        const base = 1100 + (i - 1) * 120;
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(180, t + 0.09);
        g.gain.setValueAtTime(0.28, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g).connect(this.sfxGain);
        o.start(t); o.stop(t + 0.12);
      }
      return;
    }
    // Default single shot
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1300, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.12);
  }

  playPickup() {
    this.ensure();
    const samplePlayed = this._playSample('pickup', { volume: 0.9, rate: 1.18, maxDuration: 0.5, cooldown: 0.04 });
    const t = this.ctx.currentTime;
    // Loud neon pickup: bright arpeggio plus a quick sparkle/noise tick so
    // collection is audible over music and rapid fire.
    const notes = [784, 1047, 1568, 2093, 3136];
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = i % 2 ? 'square' : 'triangle';
      o.frequency.setValueAtTime(f, t + i * 0.035);
      g.gain.setValueAtTime(samplePlayed ? 0.22 : 0.46, t + i * 0.035);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.035 + 0.16);
      o.connect(g).connect(this.sfxGain);
      o.start(t + i * 0.035);
      o.stop(t + i * 0.035 + 0.18);
    });
    const len = Math.floor(this.ctx.sampleRate * 0.12);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(samplePlayed ? 0.12 : 0.26, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(hp).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  playBomb() {
    this.ensure();
    if (this._playSample('bomb', { volume: 0.85, rate: 0.95, maxDuration: 1.25, cooldown: 0.12 })) return;
    const t = this.ctx.currentTime;
    // Deep boom: low sine sweep + filtered noise burst
    const sub = this.ctx.createOscillator();
    const sg  = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.7);
    sg.gain.setValueAtTime(0.7, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    sub.connect(sg).connect(this.sfxGain);
    sub.start(t); sub.stop(t + 0.8);

    const dur = 0.9;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(800, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  playExplosion() {
    this.ensure();
    if (this._playSample('explosion', { volume: 0.54, rate: 1.08, maxDuration: 0.65, cooldown: 0.045 })) return;
    const t = this.ctx.currentTime;
    const dur = 0.45;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  playHit() {
    this.ensure();
    if (this._playSample('playerHit', { volume: 0.58, rate: 1.0, maxDuration: 0.55, cooldown: 0.14 })) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.35);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.38);
  }

  playDeath() {
    this.ensure();
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      const base = 520 - i * 70;
      o.frequency.setValueAtTime(base, t + i * 0.09);
      o.frequency.exponentialRampToValueAtTime(base * 0.5, t + i * 0.09 + 0.1);
      g.gain.setValueAtTime(0.16, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.13);
      o.connect(g).connect(this.sfxGain);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.16);
    }
  }

  playEnemyHit() {
    this.ensure();
    if (this._playSample('enemyHit', { volume: 0.34, rate: 1.35, maxDuration: 0.18, cooldown: 0.055 })) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(780, t);
    o.frequency.exponentialRampToValueAtTime(220, t + 0.08);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.12);
  }

  playWarning(kind = 'missile') {
    this.ensure();
    const now = this.ctx.currentTime;
    const cooldown = kind === 'fast' ? 0.55 : 0.42;
    if (now - (this.lastWarningAt[kind] || 0) < cooldown) return;
    this.lastWarningAt[kind] = now;
    const t = now;
    const high = kind === 'missile' ? 1680 : 1320;
    const low = kind === 'missile' ? 720 : 620;
    for (let i = 0; i < 2; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(i ? low : high, t + i * 0.085);
      o.frequency.exponentialRampToValueAtTime((i ? low : high) * 0.76, t + i * 0.085 + 0.07);
      g.gain.setValueAtTime(0.18, t + i * 0.085);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.085 + 0.075);
      o.connect(g).connect(this.sfxGain);
      o.start(t + i * 0.085);
      o.stop(t + i * 0.085 + 0.09);
    }
  }

  playBossCue(kind = 'intro') {
    this.ensure();
    const t = this.ctx.currentTime;
    const notes = kind === 'rush' ? [180, 240, 360, 520] : [140, 210, 320];
    notes.forEach((freq, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = i === 0 ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(freq, t + i * 0.08);
      o.frequency.exponentialRampToValueAtTime(freq * 0.72, t + i * 0.08 + 0.18);
      g.gain.setValueAtTime(0.24, t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.22);
      o.connect(g).connect(this.sfxGain);
      o.start(t + i * 0.08);
      o.stop(t + i * 0.08 + 0.24);
    });
  }
}
