// DOM-based HUD. Cheap and simple — score, lives, stage label, reticle, overlays.

export class HUD {
  constructor() {
    this._build();
  }

  _build() {
    const css = `
#hud-score, #hud-stage, #hud-weapon, #hud-bombs, #hud-power {
  position: fixed;
  color: white;
  font-family: 'Courier New', monospace;
  font-size: 22px;
  letter-spacing: 3px;
  text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000;
  pointer-events: none;
  z-index: 50;
}
#hud-score { top: 14px; left: 50%; transform: translateX(-50%); }
#hud-stage { top: 14px; left: 18px; color: #ffe066; }
#hud-weapon { bottom: 14px; left: 18px; font-size: 18px; }
#hud-weapon.multi  { color: #ffaa66; }
#hud-weapon.laser  { color: #ff5566; }
#hud-weapon.single { color: #cccccc; }
#hud-bombs { bottom: 14px; right: 18px; font-size: 22px; color: #ff66dd; }
#hud-power {
  bottom: 44px;
  left: 18px;
  font-size: 16px;
  color: #93fff6;
  display: none;
}
#hud-power.show { display: block; }

#hud-health {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 50;
  pointer-events: none;
  display: flex;
  gap: 5px;
  align-items: center;
}
#hud-health .label {
  color: #ff4d66;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  letter-spacing: 3px;
  margin-right: 6px;
  text-shadow: 2px 2px 0 #000;
}
#hud-health .seg {
  width: 28px;
  height: 14px;
  background: #2a0010;
  border: 1px solid #6b2233;
  border-radius: 2px;
  box-sizing: border-box;
}
#hud-health .seg.filled {
  background: linear-gradient(180deg, #ff8a9c, #c01a35);
  border-color: #ff5566;
  box-shadow: 0 0 10px rgba(255, 80, 100, 0.55), inset 0 0 4px rgba(255,255,255,0.25);
}

#hud-health .bar {
  width: 120px;
  height: 14px;
  background: #2a0010;
  border: 1px solid #6b2233;
  border-radius: 2px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}
#hud-health .bar .fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(180deg, #ff8a9c, #c01a35);
  box-shadow: 0 0 10px rgba(255, 80, 100, 0.55), inset 0 0 4px rgba(255,255,255,0.25);
  transition: width 0.1s linear;
}
#hud-health.low .bar .fill {
  background: #ff3333;
  animation: healthflash 0.6s infinite ease-in-out;
}
@keyframes healthflash {
  0%,100% { opacity: 1; }
  50% { opacity: 0.25; }
}

#hud-ammo {
  position: fixed;
  top: 40px;
  right: 18px;
  z-index: 50;
  pointer-events: none;
  width: 192px;
  height: 10px;
  background: rgba(10, 10, 20, 0.65);
  border: 1px solid #444;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.25s ease;
  overflow: hidden;
}
#hud-ammo.visible { opacity: 1; }
#hud-ammo .fill {
  height: 100%;
  width: 100%;
  transition: width 0.08s linear;
}
#hud-ammo.multi .fill {
  background: linear-gradient(90deg, #ff7733, #ffb066);
  box-shadow: 0 0 10px rgba(255, 130, 60, 0.7);
}
#hud-ammo.laser .fill {
  background: linear-gradient(90deg, #ff3344, #ff8899);
  box-shadow: 0 0 10px rgba(255, 80, 100, 0.8);
}

#hud-flash {
  position: fixed; inset: 0;
  background: #ffffff;
  opacity: 0;
  pointer-events: none;
  z-index: 80;
  transition: opacity 0.45s ease-out;
}
#hud-flash.fire { opacity: 0.85; transition: opacity 0s; }

#hud-reticle {
  position: fixed;
  width: 32px; height: 32px;
  border: 2px solid #ff5566;
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 40;
  box-shadow: 0 0 12px rgba(255,80,100,0.6), inset 0 0 6px rgba(255,80,100,0.3);
}
#hud-reticle::before, #hud-reticle::after {
  content: ''; position: absolute; background: #ff5566;
}
#hud-reticle::before { left: 50%; top: 30%; width: 2px; height: 12px; transform: translateX(-50%); }
#hud-reticle::after  { top: 50%; left: 30%; height: 2px; width: 12px; transform: translateY(-50%); }
#hud-reticle.gp::before, #hud-reticle.gp::after { background: #ffe066; }
#hud-reticle.gp { border-color: #ffe066; box-shadow: 0 0 12px rgba(255,224,102,0.6); }

#hud-title {
  position: fixed; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px;
  font-family: 'Courier New', monospace;
  color: white; letter-spacing: 10px;
  text-align: center;
  text-shadow: 5px 5px 0 #ff5566, 10px 10px 0 #663388;
  pointer-events: none; opacity: 0;
  transition: opacity 0.4s ease;
  z-index: 60;
}
#hud-title.show { opacity: 1; }
#hud-title .main { font-size: 84px; }
#hud-title .subtitle {
  max-width: min(92vw, 980px);
  font-size: 22px;
  line-height: 1.35;
  letter-spacing: 2px;
  color: #fff2aa;
  text-shadow: 2px 2px 0 #220818, 0 0 16px rgba(255, 225, 120, .45);
}

#hud-stage-splash {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 45%, rgba(20,18,45,.58), rgba(0,0,0,.88) 72%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.45s ease;
  z-index: 62;
  overflow: hidden;
}
#hud-stage-splash.show { opacity: 1; }
#hud-stage-splash img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  filter: saturate(1.15) contrast(1.08) brightness(.88);
  transform: scale(1.02);
}
#hud-stage-splash .shade {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,.50) 62%, rgba(0,0,0,.82));
}
#hud-stage-splash .copy {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  margin-top: min(46vh, 360px);
  color: white;
  font-family: 'Courier New', monospace;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 4px 4px 0 #000, 0 0 18px rgba(255,80,100,.7);
}
#hud-stage-splash .kicker { font-size: 22px; letter-spacing: 8px; color: #ffe066; }
#hud-stage-splash .name { font-size: clamp(36px, 7vw, 82px); letter-spacing: 9px; font-weight: bold; }
#hud-stage-splash .meta {
  max-width: min(90vw, 920px);
  font-size: clamp(13px, 2vw, 20px);
  letter-spacing: 2px;
  line-height: 1.35;
  color: #93fff6;
  text-shadow: 2px 2px 0 #000, 0 0 14px rgba(80,220,255,.5);
}

#hud-boss-intro {
  position: fixed; inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.22s ease;
  z-index: 64;
  overflow: hidden;
  font-family: 'Courier New', monospace;
  text-align: center;
  text-transform: uppercase;
}
#hud-boss-intro.show { opacity: 1; }
#hud-boss-intro .sweep {
  position: absolute; inset: 0;
  background:
    linear-gradient(90deg, transparent 0 16%, rgba(255, 45, 75, .18) 38%, rgba(255, 224, 102, .2) 50%, rgba(255, 45, 75, .18) 62%, transparent 84%),
    radial-gradient(circle at 50% 50%, rgba(255, 80, 100, .18), transparent 46%);
  transform: skewY(-6deg) scaleY(.72);
}
#hud-boss-intro .copy {
  position: relative;
  width: min(980px, 92vw);
  padding: 22px 0 24px;
  border-top: 2px solid rgba(255, 224, 102, .78);
  border-bottom: 2px solid rgba(255, 85, 102, .84);
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, .64) 18%, rgba(0, 0, 0, .70) 82%, transparent);
  color: white;
  text-shadow: 4px 4px 0 #000, 0 0 18px rgba(255,80,100,.8);
}
#hud-boss-intro .kicker {
  color: #ffe066;
  font-size: clamp(14px, 1.7vw, 20px);
  letter-spacing: 8px;
}
#hud-boss-intro .name {
  margin-top: 8px;
  font-size: clamp(42px, 7vw, 96px);
  line-height: 1;
  letter-spacing: 9px;
  font-weight: bold;
}
#hud-boss-intro .meta {
  margin-top: 12px;
  color: #93fff6;
  font-size: clamp(13px, 1.8vw, 20px);
  letter-spacing: 3px;
  line-height: 1.35;
  text-shadow: 2px 2px 0 #000, 0 0 14px rgba(80,220,255,.55);
}

#hud-gameover {
  position: fixed; inset: 0;
  display: none;
  flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.7);
  font-family: 'Courier New', monospace;
  color: white; z-index: 70;
}
#hud-gameover.show { display: flex; }
#hud-gameover .title {
  font-size: 70px; letter-spacing: 10px;
  text-shadow: 5px 5px 0 #ff5566;
}
#hud-gameover .final { font-size: 26px; margin-top: 22px; letter-spacing: 4px; }
#hud-gameover .buttons, #hud-pause .buttons {
  display: flex; gap: 16px; flex-wrap: wrap; justify-content: center;
  margin-top: 36px;
}
#hud-gameover button, #hud-pause button {
  padding: 14px 36px;
  font-size: 18px;
  font-family: inherit;
  letter-spacing: 4px;
  background: transparent;
  color: white;
  border: 2px solid #ff5566;
  cursor: pointer;
}
#hud-gameover button:hover, #hud-pause button:hover { background: #ff5566; }

#hud-ending {
  position: fixed; inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 50% 22%, rgba(255, 224, 120, .18), transparent 34%),
    linear-gradient(180deg, rgba(6, 8, 20, .82), rgba(0, 0, 0, .94));
  font-family: 'Courier New', monospace;
  color: white;
  z-index: 74;
  overflow: hidden;
}
#hud-ending.show { display: flex; }
#hud-ending .stars {
  position: absolute; inset: -20%;
  background-image:
    radial-gradient(circle, rgba(255,255,255,.9) 0 1px, transparent 1.5px),
    radial-gradient(circle, rgba(120,230,255,.65) 0 1px, transparent 1.5px);
  background-size: 90px 90px, 140px 140px;
  background-position: 0 0, 34px 52px;
  animation: hud-ending-drift 18s linear infinite;
  opacity: .55;
}
@keyframes hud-ending-drift { from { transform: translateY(0); } to { transform: translateY(90px); } }
#hud-ending .panel {
  position: relative;
  width: min(760px, 88vw);
  text-align: center;
  text-transform: uppercase;
  text-shadow: 3px 3px 0 #000, 0 0 18px rgba(255, 80, 100, .5);
}
#hud-ending .kicker {
  color: #ffe066;
  font-size: 18px;
  letter-spacing: 7px;
  margin-bottom: 18px;
}
#hud-ending .title {
  font-size: clamp(42px, 8vw, 86px);
  letter-spacing: 10px;
  color: #fff;
  text-shadow: 5px 5px 0 #ff5566, 10px 10px 0 #663388;
}
#hud-ending .summary {
  margin-top: 24px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
#hud-ending .stat {
  border: 1px solid rgba(255,255,255,.34);
  background: rgba(10, 12, 24, .58);
  padding: 14px 10px;
}
#hud-ending .stat span {
  display: block;
  color: #93fff6;
  font-size: 12px;
  letter-spacing: 3px;
  margin-bottom: 7px;
}
#hud-ending .stat strong {
  font-size: 24px;
  letter-spacing: 3px;
}
#hud-ending .credits {
  margin: 28px auto 0;
  max-width: 620px;
  color: rgba(255,255,255,.76);
  font-size: 13px;
  line-height: 1.65;
  letter-spacing: 2px;
}
#hud-ending .buttons {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 34px;
}
#hud-ending button {
  padding: 14px 30px;
  font-size: 16px;
  font-family: inherit;
  letter-spacing: 4px;
  background: transparent;
  color: white;
  border: 2px solid #ff5566;
  cursor: pointer;
}
#hud-ending button:hover { background: #ff5566; }
@media (max-width: 640px) {
  #hud-ending .summary { grid-template-columns: 1fr; }
  #hud-ending .kicker { font-size: 13px; letter-spacing: 4px; }
  #hud-ending .credits { font-size: 11px; }
}

#hud-pause {
  position: fixed; inset: 0;
  display: none; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.72);
  font-family: 'Courier New', monospace;
  color: white; z-index: 65;
}
#hud-pause.show { display: flex; }
#hud-pause .title { font-size: 56px; letter-spacing: 12px; text-shadow: 5px 5px 0 #663388; }
#hud-pause .settings {
  width: min(520px, 86vw);
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
#hud-pause .setting-row {
  display: grid;
  grid-template-columns: 150px 1fr 58px;
  gap: 14px;
  align-items: center;
  color: #ffe066;
  font-size: 15px;
  letter-spacing: 3px;
  text-shadow: 2px 2px 0 #000;
}
#hud-pause input[type="range"] {
  width: 100%;
  accent-color: #ff5566;
}
#hud-pause .setting-value {
  color: white;
  text-align: right;
}
#hud-pause .setting-button-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
#hud-pause .setting-button-row button {
  min-height: 46px;
  padding: 10px 12px;
  font-size: 13px;
  letter-spacing: 2px;
  border-color: #66e6ff;
}
#hud-pause .setting-button-row button.on {
  background: #663388;
  border-color: #aa88ff;
}
#hud-pause .setting-status {
  min-height: 16px;
  color: rgba(255,255,255,.7);
  font-size: 11px;
  letter-spacing: 2px;
  text-align: center;
}

#hud-boss {
  position: fixed; top: 62px; left: 50%; transform: translateX(-50%);
  width: min(620px, 70vw); z-index: 55; pointer-events: none; display: none;
  font-family: 'Courier New', monospace; color: #fff; text-align: center; letter-spacing: 4px;
  text-shadow: 2px 2px 0 #000;
}
#hud-boss.show { display: block; }
#hud-boss .name { font-size: 18px; margin-bottom: 6px; color: #ffcc66; }
#hud-boss .bar { height: 14px; border: 2px solid #ff5566; background: rgba(20,0,12,.7); box-shadow: 0 0 14px rgba(255,80,100,.35); }
#hud-boss .fill { height: 100%; width: 100%; background: linear-gradient(90deg, #ff3344, #ffcc66); box-shadow: inset 0 0 8px rgba(255,255,255,.35); }

#hud-perf {
  position: fixed;
  left: 14px;
  top: 76px;
  z-index: 90;
  min-width: 250px;
  max-width: 360px;
  display: none;
  pointer-events: none;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.35;
  letter-spacing: 1px;
  color: #b8fff8;
  background: rgba(0, 7, 16, 0.72);
  border: 1px solid rgba(102, 230, 255, 0.42);
  box-shadow: 0 0 22px rgba(0, 180, 255, 0.18);
  padding: 9px 10px;
  white-space: pre;
  text-shadow: 1px 1px 0 #000;
}
#hud-perf.show { display: block; }
#hud-perf .warn { color: #ffe066; }
#hud-perf .bad { color: #ff6f8a; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    this.score = el('div', 'hud-score'); this.score.textContent = 'SCORE 000000';
    this.stage = el('div', 'hud-stage'); this.stage.textContent = 'STAGE 01 MOOT';
    this.weapon = el('div', 'hud-weapon'); this.weapon.classList.add('single'); this.weapon.textContent = '◆ SINGLE';
    this.bombs = el('div', 'hud-bombs'); this.bombs.textContent = '✦ 2';
    this.power = el('div', 'hud-power');

    this.health = el('div', 'hud-health');
    this.health.innerHTML = '<span class="label">HP</span>';
    this._healthSegContainer = document.createElement('div');
    this._healthSegContainer.style.cssText = 'display:flex;gap:5px;';
    this.health.appendChild(this._healthSegContainer);

    this.ammo = el('div', 'hud-ammo');
    this.ammoFill = document.createElement('div');
    this.ammoFill.className = 'fill';
    this.ammo.appendChild(this.ammoFill);

    this.reticle = el('div', 'hud-reticle');
    this.title = el('div', 'hud-title');
    this.stageSplash = el('div', 'hud-stage-splash');
    this.stageSplash.innerHTML = '<img alt="" /><div class="shade"></div><div class="copy"><div class="kicker"></div><div class="name"></div><div class="meta"></div></div>';
    this.stageSplashImage = this.stageSplash.querySelector('img');
    this.stageSplashKicker = this.stageSplash.querySelector('.kicker');
    this.stageSplashName = this.stageSplash.querySelector('.name');
    this.stageSplashMeta = this.stageSplash.querySelector('.meta');
    this.bossIntro = el('div', 'hud-boss-intro');
    this.bossIntro.innerHTML = '<div class="sweep"></div><div class="copy"><div class="kicker"></div><div class="name"></div><div class="meta"></div></div>';
    this.bossIntroKicker = this.bossIntro.querySelector('.kicker');
    this.bossIntroName = this.bossIntro.querySelector('.name');
    this.bossIntroMeta = this.bossIntro.querySelector('.meta');
    this.pause = el('div', 'hud-pause');
    this.pause.innerHTML = `
      <div class="title">PAUSED</div>
      <div class="settings">
        <label class="setting-row" for="hud-music-volume">
          <span>MUSIC</span>
          <input id="hud-music-volume" type="range" min="0" max="100" step="1" />
          <span id="hud-music-value" class="setting-value">65%</span>
        </label>
        <label class="setting-row" for="hud-sfx-volume">
          <span>SFX</span>
          <input id="hud-sfx-volume" type="range" min="0" max="100" step="1" />
          <span id="hud-sfx-value" class="setting-value">100%</span>
        </label>
        <div class="setting-button-row">
          <button id="hud-camera-follow" type="button">CAMERA FOLLOW: ON</button>
          <button id="hud-gyro" type="button">GYRO VIEW: OFF</button>
          <button id="hud-head-tracking" type="button">HEAD TRACKING</button>
          <button id="hud-cinematic" type="button">CINEMATIC: OFF</button>
        </div>
        <div id="hud-settings-status" class="setting-status"></div>
      </div>
      <div class="buttons">
        <button id="hud-resume" type="button">RESUME</button>
        <button id="hud-menu" type="button">MAIN MENU</button>
      </div>
    `;
    this.flash = el('div', 'hud-flash');
    this.boss = el('div', 'hud-boss');
    this.boss.innerHTML = '<div class="name"></div><div class="bar"><div class="fill"></div></div>';
    this.bossName = this.boss.querySelector('.name');
    this.bossFill = this.boss.querySelector('.fill');
    this.perf = el('div', 'hud-perf');
    this.perfLastText = '';
    this.gameover = el('div', 'hud-gameover');
    this.gameover.innerHTML = `
      <div class="title">GAME OVER</div>
      <div class="final" id="hud-final">SCORE 000000</div>
      <div class="buttons">
        <button id="hud-restart" type="button">RETRY</button>
        <button id="hud-gameover-menu" type="button">MAIN MENU</button>
      </div>
    `;
    this.ending = el('div', 'hud-ending');
    this.ending.innerHTML = `
      <div class="stars"></div>
      <div class="panel">
        <div class="kicker">THE DIMENSIONAL FRONTIER IS CLEAR</div>
        <div class="title">MISSION COMPLETE</div>
        <div class="summary">
          <div class="stat"><span>SCORE</span><strong id="hud-ending-score">000000</strong></div>
          <div class="stat"><span>HIGH SCORE</span><strong id="hud-ending-hi">000000</strong></div>
          <div class="stat"><span>CLEARS</span><strong id="hud-ending-clears">0</strong></div>
        </div>
        <div class="credits" id="hud-ending-credits">
          Original code, procedural geometry, music integration, and effects for this prototype.
          Unofficial fan project, not affiliated with Sega.
        </div>
        <div class="buttons">
          <button id="hud-ending-restart" type="button">PLAY AGAIN</button>
          <button id="hud-ending-menu" type="button">MAIN MENU</button>
        </div>
      </div>
    `;

    [this.score, this.stage, this.weapon, this.bombs, this.power, this.health, this.ammo, this.reticle, this.title, this.stageSplash, this.bossIntro, this.pause, this.flash, this.boss, this.perf, this.gameover, this.ending].forEach(e => document.body.appendChild(e));

    this.reticle.style.left = (window.innerWidth / 2) + 'px';
    this.reticle.style.top  = (window.innerHeight / 2) + 'px';
  }

  setScore(s) { this.score.textContent = 'SCORE ' + String(s).padStart(6, '0'); }

  setHealth(current, max = 3) {
    this.health.classList.remove('low');
    this._healthSegContainer.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const seg = document.createElement('div');
      seg.className = i < current ? 'seg filled' : 'seg';
      this._healthSegContainer.appendChild(seg);
    }
  }
  setHealthBar(pct) {
    const p = Math.max(0, Math.min(100, pct));
    this._healthSegContainer.innerHTML = '';
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = p + '%';
    bar.appendChild(fill);
    this._healthSegContainer.appendChild(bar);
    const isLow = p < 15;
    this.health.classList.toggle('low', isLow);
  }
  // Back-compat: lives -> health bar
  setLives(n) { this.setHealth(n, 3); }

  setAmmo(weapon, remaining, total) {
    if (!weapon || weapon === 'single' || total <= 0) {
      this.ammo.classList.remove('visible', 'multi', 'laser');
      return;
    }
    this.ammo.classList.add('visible');
    this.ammo.classList.remove('multi', 'laser');
    this.ammo.classList.add(weapon === 'multishot' ? 'multi' : 'laser');
    const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
    this.ammoFill.style.width = pct + '%';
  }

  setStage(num, name) { this.stage.textContent = `STAGE ${String(num).padStart(2, '0')} ${name || ''}`.trim(); }

  setWeapon(name, timeRemaining) {
    this.weapon.classList.remove('single', 'multi', 'laser');
    if (name === 'multishot') {
      this.weapon.classList.add('multi');
      this.weapon.textContent = `◆ MULTI ${Math.ceil(Math.max(0, timeRemaining))}s`;
    } else if (name === 'laser') {
      this.weapon.classList.add('laser');
      this.weapon.textContent = `◆ LASER ${Math.ceil(Math.max(0, timeRemaining))}s`;
    } else {
      this.weapon.classList.add('single');
      this.weapon.textContent = '◆ SINGLE';
    }
  }

  setBombs(n) {
    this.bombs.textContent = '✦ ' + n;
  }

  setPowerups(powerups = {}) {
    const parts = [];
    if (powerups.speed > 0) parts.push(`SPD ${Math.ceil(powerups.speed)}s`);
    if (powerups.slow > 0) parts.push(`SLOW ${Math.ceil(powerups.slow)}s`);
    if (powerups.invincible > 2) parts.push(`SHIELD ${Math.ceil(powerups.invincible)}s`);
    if (powerups.sprintActive) parts.push(`SPRINT!`);
    else if (powerups.sprintCooldown > 0 && powerups.sprintCooldown < 30) parts.push(`SPRINT ${Math.ceil(powerups.sprintCooldown)}s`);
    this.power.textContent = parts.join('  ');
    this.power.classList.toggle('show', parts.length > 0);
  }

  showPerfOverlay(on) {
    if (!this.perf) return;
    this.perf.classList.toggle('show', !!on);
  }

  setPerf(stats = {}) {
    if (!this.perf) return;
    const renderer = stats.renderer || {};
    const render = renderer.render || {};
    const memory = renderer.memory || {};
    const actors = stats.actors || {};
    const text = [
      `FPS ${fmt(stats.fps)} AVG ${fmt(stats.avgFps)} MIN ${fmt(stats.minFps)}`,
      `FRAME ${fmt(stats.frameMs)}ms MAX ${fmt(stats.maxDtMs)}ms`,
      `DRAW ${render.calls || 0}  TRI ${Math.round(render.triangles || 0)}`,
      `GEO ${memory.geometries || 0}  TEX ${memory.textures || 0}  DPR ${renderer.pixelRatio || 1}`,
      `ACT E${actors.enemies || 0} O${actors.obstacles || 0} P${actors.pickups || 0}`,
      `PROJ PL${actors.playerProjectiles || 0} EN${actors.enemyProjectiles || 0}`,
      `STATE ${stats.gameState || ''}/${stats.stageState || ''}`
    ].join('\n');
    if (text !== this.perfLastText) {
      this.perf.textContent = text;
      this.perfLastText = text;
    }
  }

  flashBomb() {
    this.flash.classList.add('fire');
    requestAnimationFrame(() => {
      this.flash.classList.remove('fire');
    });
  }

  setReticlePosition(x, y, gamepad = false) {
    this.reticle.style.left = x + 'px';
    this.reticle.style.top  = y + 'px';
    this.reticle.classList.toggle('gp', gamepad);
  }

  showTitle(text, ms = 1600, subtitle = '') {
    this.title.textContent = '';
    const main = document.createElement('div');
    main.className = 'main';
    main.textContent = text;
    this.title.appendChild(main);
    if (subtitle) {
      const sub = document.createElement('div');
      sub.className = 'subtitle';
      sub.textContent = subtitle;
      this.title.appendChild(sub);
    }
    this.title.classList.add('show');
    clearTimeout(this._titleTimer);
    this._titleTimer = setTimeout(() => this.title.classList.remove('show'), ms);
  }

  showStageSplash(stageDef, ms = 2600) {
    if (!this.stageSplash || !stageDef) return;
    const splash = stageDef.splashImage || '';
    if (this.stageSplashImage) {
      this.stageSplashImage.src = splash;
      this.stageSplashImage.style.display = splash ? 'block' : 'none';
    }
    if (this.stageSplashKicker) this.stageSplashKicker.textContent = `${stageDef.mode === 'bonus' ? 'BONUS' : 'STAGE'} ${String(stageDef.id).padStart(2, '0')}`;
    if (this.stageSplashName) this.stageSplashName.textContent = stageDef.mediaName || stageDef.name || '';
    if (this.stageSplashMeta) {
      const metadata = stageDef.metadata || {};
      const band = metadata.difficultyBand ? metadata.difficultyBand.toUpperCase() : '';
      const threat = Number.isFinite(metadata.difficultyRating) ? `THREAT ${metadata.difficultyRating}/10` : '';
      const hook = metadata.encounterHook || metadata.visualHook || '';
      this.stageSplashMeta.textContent = [band, threat, hook].filter(Boolean).join(' / ');
    }
    this.stageSplash.classList.add('show');
    clearTimeout(this._stageSplashTimer);
    this._stageSplashTimer = setTimeout(() => this.stageSplash.classList.remove('show'), ms);
  }

  showBossIntro(bossConfig = {}, options = {}, ms = 1600) {
    if (!this.bossIntro) { this.showTitle(`${bossConfig?.name || 'BOSS'} APPROACHES`, ms); return false; }
    const total = Number(options.total) || 0;
    const index = Number(options.index) || 0;
    const kicker = options.kicker || (total ? 'BOSS RUSH TARGET' : 'BOSS WARNING');
    const name = bossConfig?.name || bossConfig?.id || 'BOSS';
    const meta = [
      total && index ? `${index}/${total}` : '',
      options.subtitle || '',
      bossConfig?.final ? 'FINAL TARGET' : ''
    ].filter(Boolean).join(' / ');
    if (this.bossIntroKicker) this.bossIntroKicker.textContent = kicker;
    if (this.bossIntroName) this.bossIntroName.textContent = name;
    if (this.bossIntroMeta) this.bossIntroMeta.textContent = meta;
    this.bossIntro.classList.add('show');
    clearTimeout(this._bossIntroTimer);
    this._bossIntroTimer = setTimeout(() => this.bossIntro.classList.remove('show'), ms);
    return true;
  }

  showPause(on, onResume = null, onMainMenu = null, settings = null) {
    this.pause.classList.toggle('show', !!on);
    const resume = document.getElementById('hud-resume');
    const menu = document.getElementById('hud-menu');
    if (resume && onResume) resume.onclick = onResume;
    if (menu && onMainMenu) menu.onclick = onMainMenu;
    const music = document.getElementById('hud-music-volume');
    const sfx = document.getElementById('hud-sfx-volume');
    const musicValue = document.getElementById('hud-music-value');
    const sfxValue = document.getElementById('hud-sfx-value');
    if (settings && music && sfx && musicValue && sfxValue) {
      const setMusicLabel = value => { musicValue.textContent = `${Math.round(value)}%`; };
      const setSfxLabel = value => { sfxValue.textContent = `${Math.round(value)}%`; };
      const musicPct = Math.round((settings.music ?? 0.65) * 100);
      const sfxPct = Math.round((settings.sfx ?? 1) * 100);
      music.value = String(musicPct);
      sfx.value = String(sfxPct);
      setMusicLabel(musicPct);
      setSfxLabel(sfxPct);
      music.oninput = () => {
        const value = Number(music.value);
        setMusicLabel(value);
        settings.onMusic?.(value / 100);
      };
      sfx.oninput = () => {
        const value = Number(sfx.value);
        setSfxLabel(value);
        settings.onSfx?.(value / 100);
      };
    }
    if (settings) this._bindPauseViewSettings(settings);
  }

  _bindPauseViewSettings(settings) {
    const cameraFollow = document.getElementById('hud-camera-follow');
    const gyro = document.getElementById('hud-gyro');
    const head = document.getElementById('hud-head-tracking');
    const cinematic = document.getElementById('hud-cinematic');
    const status = document.getElementById('hud-settings-status');
    const setStatus = text => { if (status) status.textContent = text || ''; };
    const sync = () => {
      cameraFollow.textContent = settings.cameraFollow ? 'CAMERA FOLLOW: ON' : 'CAMERA FOLLOW: OFF';
      cameraFollow.classList.toggle('on', !!settings.cameraFollow);
      gyro.textContent = settings.gyro ? 'GYRO VIEW: ON' : 'GYRO VIEW: OFF';
      gyro.classList.toggle('on', !!settings.gyro);
      head.textContent = settings.headTracking ? 'HEAD TRACKING: ON' : (settings.headTrackingAvailable ? 'ENABLE HEAD TRACKING' : 'HEAD TRACKING: DESKTOP ONLY');
      head.classList.toggle('on', !!settings.headTracking);
      head.disabled = !settings.headTrackingAvailable || !!settings.headTracking;
      cinematic.textContent = settings.cinematic ? 'CINEMATIC: ON' : 'CINEMATIC: OFF';
      cinematic.classList.toggle('on', !!settings.cinematic);
    };
    if (!(cameraFollow && gyro && head && cinematic)) return;
    sync();
    cameraFollow.onclick = () => {
      settings.cameraFollow = settings.onCameraFollow?.(!settings.cameraFollow) ?? !settings.cameraFollow;
      sync();
    };
    gyro.onclick = async () => {
      setStatus(settings.gyro ? '' : 'requesting gyro permission...');
      settings.gyro = await settings.onGyro?.(!settings.gyro);
      setStatus(settings.gyro ? '' : 'gyro unavailable');
      sync();
    };
    head.onclick = async () => {
      if (!settings.headTrackingAvailable || settings.headTracking) return;
      setStatus('requesting camera...');
      settings.headTracking = await settings.onHeadTracking?.();
      setStatus(settings.headTracking ? 'tracking active' : 'camera unavailable');
      sync();
    };
    cinematic.onclick = () => {
      settings.cinematic = settings.onCinematic?.(!settings.cinematic) ?? !settings.cinematic;
      sync();
    };
  }

  showGameOver(finalScore, onRestart, title = 'GAME OVER', subtitle = '', onMainMenu = null, options = {}) {
    if (this.ending) this.ending.classList.remove('show');
    this.gameover.querySelector('.title').textContent = title;
    const final = 'SCORE ' + String(finalScore).padStart(6, '0') + (subtitle ? ' · ' + subtitle : '');
    document.getElementById('hud-final').textContent = final;
    this.gameover.classList.add('show');
    document.getElementById('hud-restart').textContent = options.restartLabel || (title === 'MISSION COMPLETE' ? 'PLAY AGAIN' : 'RETRY');
    document.getElementById('hud-restart').onclick = () => {
      this.gameover.classList.remove('show');
      onRestart?.();
    };
    const menuBtn = document.getElementById('hud-gameover-menu');
    if (menuBtn) menuBtn.onclick = () => {
      this.gameover.classList.remove('show');
      if (onMainMenu) onMainMenu();
    };
  }

  showEnding(summary = {}, onRestart = null, onMainMenu = null) {
    if (!this.ending) return this.showGameOver(summary.score || 0, onRestart, 'MISSION COMPLETE', '', onMainMenu);
    if (typeof onMainMenu !== 'function' && typeof arguments[4] === 'function') onMainMenu = arguments[4];
    this.gameover.classList.remove('show');
    const score = Number(summary.score) || 0;
    const highScore = Number(summary.highScore) || score;
    const clears = Number(summary.completionCount) || 0;
    const scoreEl = document.getElementById('hud-ending-score');
    const hiEl = document.getElementById('hud-ending-hi');
    const clearsEl = document.getElementById('hud-ending-clears');
    if (scoreEl) scoreEl.textContent = String(score).padStart(6, '0');
    if (hiEl) hiEl.textContent = String(highScore).padStart(6, '0');
    if (clearsEl) clearsEl.textContent = String(clears);
    this.ending.classList.add('show');
    const restart = document.getElementById('hud-ending-restart');
    const menu = document.getElementById('hud-ending-menu');
    if (restart) restart.onclick = () => {
      this.ending.classList.remove('show');
      onRestart?.();
    };
    if (menu) menu.onclick = () => {
      this.ending.classList.remove('show');
      if (typeof onMainMenu === 'function') onMainMenu();
    };
  }

  showBoss(boss) {
    if (!this.boss) return;
    if (!boss) { this.boss.classList.remove('show'); return; }
    this.bossName.textContent = boss.name || 'BOSS';
    this.updateBoss(boss);
    this.boss.classList.add('show');
  }

  updateBoss(boss) {
    if (!this.bossFill || !boss) return;
    const pct = Math.max(0, Math.min(100, (boss.health / Math.max(1, boss.maxHealth)) * 100));
    this.bossFill.style.width = pct + '%';
    if (this.bossName) this.bossName.textContent = boss.name || 'BOSS';
  }

  hideAll() {
    this.gameover.classList.remove('show');
    if (this.ending) this.ending.classList.remove('show');
    this.pause.classList.remove('show');
    this.title.classList.remove('show');
    if (this.stageSplash) this.stageSplash.classList.remove('show');
    if (this.bossIntro) this.bossIntro.classList.remove('show');
    if (this.boss) this.boss.classList.remove('show');
    if (this.power) this.power.classList.remove('show');
  }
}

function el(tag, id) {
  const e = document.createElement(tag);
  e.id = id;
  return e;
}

function fmt(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '0.0';
}
