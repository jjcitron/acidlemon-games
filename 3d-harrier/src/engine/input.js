// Unified input: keyboard + mouse + gamepad + mobile touch. Gyro is view-only.
// Output every frame:
//   move:  {x: -1..1, y: -1..1}  movement vector
//   aim:   {x: -1..1, y: -1..1}  normalized screen coords
//   fire:  bool                  held state
//   bombPressed: bool            rising edge this frame

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.gamepadAimActive = false;
    this.gamepadAimUntil = 0;

    this.move = { x: 0, y: 0 };
    this.aim = { x: 0, y: 0 };
    this.fire = false;
    this.firePressed = false;
    this.bomb = false;
    this.bombPressed = false;
    this.sprint = false;
    this.sprintPressed = false;
    this.touchSprint = false;
    this.aimWorld = null;

    // Mobile mode: dual sticks only. Gyro is deliberately NOT movement input;
    // it is optional view/parallax tilt handled by main.js so it cannot make
    // the game unplayable.
    this.mobileMode = 'sticks';
    this.mobileOverlayVisible = false;
    this.mobileAvailable = matchMedia('(pointer: coarse), (max-width: 900px)').matches;
    this.touchMove = { x: 0, y: 0 };
    this.touchAim = { x: 0, y: 0 };
    this.touchAimActive = false;
    this.touchFire = false;
    this.touchBomb = false;
    this.gyroEnabled = localStorage.getItem('harrierGyroEnabled') === '1';
    this.gyroPermission = 'unknown';
    this.gyro = { x: 0, y: 0 };
    this.gyroView = { x: 0, y: 0 };
    this.gyroNeutral = { beta: 0, gamma: 0, set: false };
    this.touchIds = { move: null, aim: null };

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.rightMouseDown = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightMouseDown = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());

    this._bindMobileControls();
    this._bindGyro();
    this.setMobileMode(this.mobileMode);
  }

  setMobileMode(mode) {
    this.mobileMode = 'sticks';
    localStorage.setItem('harrierMobileMode', this.mobileMode);
    document.body.classList.add('mobile-mode-sticks');
    document.body.classList.remove('mobile-mode-gyro');
    this._resetTouchState();
  }

  setMobileOverlayVisible(on) {
    this.mobileOverlayVisible = !!on;
    document.body.classList.toggle('mobile-controls-active', this.mobileOverlayVisible && this.mobileAvailable);
  }

  async enableGyro() {
    try {
      const DMO = window.DeviceMotionEvent;
      const DO = window.DeviceOrientationEvent;
      if (DO && typeof DO.requestPermission === 'function') {
        const result = await DO.requestPermission();
        this.gyroPermission = result;
        if (result !== 'granted') return false;
      } else if (DMO && typeof DMO.requestPermission === 'function') {
        const result = await DMO.requestPermission();
        this.gyroPermission = result;
        if (result !== 'granted') return false;
      } else {
        this.gyroPermission = 'granted';
      }
      this.gyroEnabled = true;
      this.gyroNeutral.set = false;
      localStorage.setItem('harrierGyroEnabled', '1');
      document.body.classList.add('gyro-enabled');
      return true;
    } catch (err) {
      console.warn('Gyro permission failed', err);
      this.gyroPermission = 'denied';
      return false;
    }
  }

  disableGyro() {
    this.gyroEnabled = false;
    this.gyro = { x: 0, y: 0 };
    this.gyroView = { x: 0, y: 0 };
    localStorage.setItem('harrierGyroEnabled', '0');
    document.body.classList.remove('gyro-enabled');
  }

  update() {
    let mx = 0, my = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp'])    my += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  my -= 1;
    if (mx !== 0 && my !== 0) { mx *= 0.707; my *= 0.707; }

    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    let padFire = false;
    let padBomb = false;
    for (const pad of pads) {
      if (!pad) continue;
      const lx = dz(pad.axes[0]);
      const ly = -dz(pad.axes[1]);
      if (Math.abs(lx) > Math.abs(mx)) mx = lx;
      if (Math.abs(ly) > Math.abs(my)) my = ly;

      const rx = dz(pad.axes[2]);
      const ry = -dz(pad.axes[3]);
      if (Math.abs(rx) > 0.2 || Math.abs(ry) > 0.2) {
        this.aim.x = rx;
        this.aim.y = ry;
        this.gamepadAimActive = true;
        this.gamepadAimUntil = performance.now() + 1500;
      }

      const rt = (pad.buttons[7] && pad.buttons[7].value) || 0;
      const a  = (pad.buttons[0] && pad.buttons[0].pressed) || false;
      const lt = (pad.buttons[6] && pad.buttons[6].value) || 0;
      const lb = (pad.buttons[4] && pad.buttons[4].pressed) || false;
      if (rt > 0.4 || a) padFire = true;
      if (lt > 0.5 || lb) padBomb = true;
    }

    if (this.mobileOverlayVisible) {
      const tx = this.touchMove.x;
      const ty = this.touchMove.y;
      if (Math.abs(tx) > Math.abs(mx)) mx = tx;
      if (Math.abs(ty) > Math.abs(my)) my = ty;
      if (this.touchAimActive) {
        this.aim.x = this.touchAim.x;
        this.aim.y = this.touchAim.y;
        this.gamepadAimActive = true;
        this.gamepadAimUntil = performance.now() + 250;
      }
    }

    if (performance.now() > this.gamepadAimUntil) this.gamepadAimActive = false;

    this.move.x = Math.max(-1, Math.min(1, mx));
    this.move.y = Math.max(-1, Math.min(1, my));

    const fireNow = this.mouseDown || padFire || (this.mobileOverlayVisible && this.touchFire);
    this.firePressed = fireNow && !this.fire;
    this.fire = fireNow;

    const bombNow = this.rightMouseDown || this.keys['KeyB'] || padBomb || (this.mobileOverlayVisible && this.touchBomb);
    this.bombPressed = bombNow && !this.bomb;
    this.bomb = bombNow;

    // Sprint: Space (keyboard), LS click (gamepad button 10), mobile sprint button
    let padSprint = false;
    for (const pad of pads) {
      if (!pad) continue;
      if (pad.buttons[10] && pad.buttons[10].pressed) padSprint = true;
    }
    const sprintNow = this.keys['Space'] || padSprint || this.touchSprint;
    this.sprintPressed = sprintNow && !this.sprint;
    this.sprint = sprintNow;
  }

  _bindMobileControls() {
    this.leftPad = document.getElementById('touchLeftPad');
    this.leftKnob = document.getElementById('touchLeftKnob');
    this.rightPad = document.getElementById('touchRightPad');
    this.rightKnob = document.getElementById('touchRightKnob');
    this.bombButton = document.getElementById('touchBombBtn');
    this.sprintButton = document.getElementById('touchSprintBtn');

    const onPadDown = (side, e) => {
      e.preventDefault();
      const pointerId = e.pointerId;
      if (side === 'move') this.touchIds.move = pointerId;
      else this.touchIds.aim = pointerId;
      try { e.currentTarget.setPointerCapture(pointerId); } catch (_) { /* synthetic/desktop tests may not capture */ }
      this._updatePad(side, e.clientX, e.clientY);
      if (side === 'aim') this.touchFire = true;
    };
    const onPadMove = (side, e) => {
      const id = side === 'move' ? this.touchIds.move : this.touchIds.aim;
      if (id !== e.pointerId) return;
      e.preventDefault();
      this._updatePad(side, e.clientX, e.clientY);
    };
    const onPadUp = (side, e) => {
      const id = side === 'move' ? this.touchIds.move : this.touchIds.aim;
      if (id !== e.pointerId) return;
      e.preventDefault();
      if (side === 'move') { this.touchIds.move = null; this.touchMove = { x: 0, y: 0 }; this._setKnob(this.leftKnob, 0, 0); }
      else { this.touchIds.aim = null; this.touchAimActive = false; this.touchFire = false; this._setKnob(this.rightKnob, 0, 0); }
    };

    if (this.leftPad) {
      this.leftPad.addEventListener('pointerdown', e => onPadDown('move', e));
      this.leftPad.addEventListener('pointermove', e => onPadMove('move', e));
      this.leftPad.addEventListener('pointerup', e => onPadUp('move', e));
      this.leftPad.addEventListener('pointercancel', e => onPadUp('move', e));
    }
    if (this.rightPad) {
      this.rightPad.addEventListener('pointerdown', e => onPadDown('aim', e));
      this.rightPad.addEventListener('pointermove', e => onPadMove('aim', e));
      this.rightPad.addEventListener('pointerup', e => onPadUp('aim', e));
      this.rightPad.addEventListener('pointercancel', e => onPadUp('aim', e));
    }
    if (this.bombButton) {
      this.bombButton.addEventListener('pointerdown', e => { e.preventDefault(); this.touchBomb = true; });
      const release = e => { e.preventDefault(); this.touchBomb = false; };
      this.bombButton.addEventListener('pointerup', release);
      this.bombButton.addEventListener('pointercancel', release);
      this.bombButton.addEventListener('pointerleave', release);
    }
    if (this.sprintButton) {
      this.sprintButton.addEventListener('pointerdown', e => { e.preventDefault(); this.touchSprint = true; });
      const releaseSprint = e => { e.preventDefault(); this.touchSprint = false; };
      this.sprintButton.addEventListener('pointerup', releaseSprint);
      this.sprintButton.addEventListener('pointercancel', releaseSprint);
      this.sprintButton.addEventListener('pointerleave', releaseSprint);
    }

    this.canvas.addEventListener('pointerdown', e => this._fullTouchDown(e));
    this.canvas.addEventListener('pointermove', e => this._fullTouchMove(e));
    window.addEventListener('pointerup', e => this._fullTouchUp(e));
    window.addEventListener('pointercancel', e => this._fullTouchUp(e));
  }

  _fullTouchDown(_e) {
    // Removed: prior touch+gyro mode used full-screen drag plus tilt movement.
    // Mobile gameplay now stays on dual sticks; gyro is view-only.
  }

  _fullTouchMove(_e) {
    // See _fullTouchDown.
  }

  _fullTouchUp(_e) {
    // See _fullTouchDown.
  }

  _updatePad(side, clientX, clientY) {
    const pad = side === 'move' ? this.leftPad : this.rightPad;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const r = Math.min(rect.width, rect.height) * 0.5;
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let x = (clientX - cx) / r;
    let y = (clientY - cy) / r;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const dead = 0.08;
    const nx = Math.abs(x) < dead ? 0 : x;
    const ny = Math.abs(y) < dead ? 0 : y;
    if (side === 'move') {
      this.touchMove.x = nx;
      this.touchMove.y = -ny;
      this._setKnob(this.leftKnob, x, y);
    } else {
      this.touchAim.x = nx;
      this.touchAim.y = -ny;
      this.touchAimActive = Math.hypot(nx, ny) > dead;
      this._setKnob(this.rightKnob, x, y);
    }
  }

  _setAimFromClient(clientX, clientY) {
    this.touchAim.x = (clientX / window.innerWidth) * 2 - 1;
    this.touchAim.y = -((clientY / window.innerHeight) * 2 - 1);
    this.touchAimActive = true;
    window.dispatchEvent(new CustomEvent('harrier-touch-aim', { detail: { x: clientX, y: clientY } }));
  }

  _setKnob(knob, x, y) {
    if (!knob) return;
    knob.style.transform = `translate(calc(-50% + ${x * 44}px), calc(-50% + ${y * 44}px))`;
  }

  _bindGyro() {
    window.addEventListener('deviceorientation', e => {
      if (!this.gyroEnabled) return;
      const beta = Number(e.beta || 0);   // front/back tilt
      const gamma = Number(e.gamma || 0); // left/right tilt
      if (!this.gyroNeutral.set) {
        this.gyroNeutral = { beta, gamma, set: true };
      }
      // View-only: about 20 degrees reaches full parallax tilt. Never feeds movement.
      this.gyroView.x = clamp((gamma - this.gyroNeutral.gamma) / 20, -1, 1);
      this.gyroView.y = clamp(-(beta - this.gyroNeutral.beta) / 20, -1, 1);
      if (Math.abs(this.gyroView.x) < 0.04) this.gyroView.x = 0;
      if (Math.abs(this.gyroView.y) < 0.04) this.gyroView.y = 0;
      this.gyro.x = 0;
      this.gyro.y = 0;
    });
  }

  _resetTouchState() {
    this.touchMove = { x: 0, y: 0 };
    this.touchAim = { x: 0, y: 0 };
    this.touchAimActive = false;
    this.touchFire = false;
    this.touchBomb = false;
    this.touchIds = { move: null, aim: null };
    this._setKnob(this.leftKnob, 0, 0);
    this._setKnob(this.rightKnob, 0, 0);
  }
}

function dz(v, t = 0.15) {
  if (v === undefined || v === null) return 0;
  if (Math.abs(v) < t) return 0;
  const sign = Math.sign(v);
  return sign * (Math.abs(v) - t) / (1 - t);
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
