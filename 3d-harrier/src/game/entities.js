import * as THREE from 'three';
import { disposeObject3D } from './dispose.js';

const MAX_PROJECTILES = 80;

// Visual-only tracer pool. Hit registration is hitscan; bullets are cosmetic
// streaks from muzzle to wherever the sight-ray actually hit (or a far-end
// fallback if the player missed). Lerps over `duration` then recycles.
// Multiple shared materials per weapon color — pool entries swap as needed.
export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    // Additive blending so tracers GLOW over the scene instead of looking
    // like flat dots — they accumulate over whatever's behind them.
    // Each tag also gets a base scale so weapons feel mechanically distinct:
    // regular = medium yellow, multi = small orange pellets (machine-gun
    // feel), laser = beam only (no tracer sphere).
    this.materials = {
      normal: new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      multi:  new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      laser:  new THREE.MeshBasicMaterial({ color: 0xff5566, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    };
    this.tracerScale = {
      normal: 1.0,
      multi:  0.55,
      laser:  1.0
    };
    const geo = new THREE.SphereGeometry(0.55, 10, 8);
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const m = new THREE.Mesh(geo, this.materials.normal);
      m.visible = false;
      scene.add(m);
      this.pool.push({
        mesh: m,
        startPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
        elapsed: 0,
        duration: 0.08,
        active: false,
        light: null
      });
    }

    // Tracer light pool — small set of PointLights that get attached to
    // active tracers so bullets and lasers actually light up the scene as
    // they fly. Round-robin assignment; older tracers lose their light
    // when a newer one fires. Pool size kept low to stay within sane GPU
    // light-count budgets (sun + hemi + these + pickup lights).
    this.lightPool = [];
    this.lightCursor = 0;
    for (let i = 0; i < 5; i++) {
      const l = new THREE.PointLight(0xffe066, 0, 30, 1.6);
      scene.add(l);
      this.lightPool.push({ light: l, owner: null });
    }

    // Beam pool — for laser visuals. Red stretched cylinders that fade
    // with additive blending. With the fast laser fire rate beams overlap
    // strongly, so sweeping your aim leaves a flowing red line.
    this.beamPool = [];
    this.beamActive = [];
    const beamGeo = new THREE.CylinderGeometry(0.34, 0.34, 1, 8, 1, true);
    for (let i = 0; i < 14; i++) {
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff5566,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const m = new THREE.Mesh(beamGeo, beamMat);
      m.visible = false;
      scene.add(m);
      this.beamPool.push({
        mesh: m,
        elapsed: 0,
        duration: 0.12,
        active: false,
        light: null
      });
    }
  }

  _colorForTag(tag) {
    if (tag === 'multi') return 0xffcc55;
    if (tag === 'laser') return 0xff3344;
    return 0xffe066;
  }

  // Round-robin acquire from the tracer-light pool. Older tracer loses
  // its light if all slots are taken — visually the most recent ones
  // get the brightest light treatment.
  _acquireLight(color, intensity) {
    const slot = this.lightPool[this.lightCursor];
    this.lightCursor = (this.lightCursor + 1) % this.lightPool.length;
    if (slot.owner) slot.owner.light = null;
    slot.owner = null;
    slot.light.color.setHex(color);
    slot.light.intensity = intensity;
    return slot;
  }

  spawnTracer(origin, endPoint, duration = 0.08, colorTag = 'normal') {
    const p = this.pool.find(x => !x.active);
    if (!p) return;
    p.active = true;
    p.startPos.copy(origin);
    p.endPos.copy(endPoint);
    p.elapsed = 0;
    p.duration = duration;
    p.baseScale = this.tracerScale[colorTag] || 1.0;
    p.mesh.material = this.materials[colorTag] || this.materials.normal;
    p.mesh.position.copy(origin);
    p.mesh.visible = true;

    // Attach a tracer light so the bullet visibly lights what it flies past
    const color = this._colorForTag(colorTag);
    const slot = this._acquireLight(color, 6);
    slot.owner = p;
    p.light = slot;
    slot.light.position.copy(origin);

    this.active.push(p);
  }

  spawnBeam(origin, endPoint, duration = 0.15) {
    const b = this.beamPool.find(x => !x.active);
    if (!b) return;
    b.active = true;
    b.elapsed = 0;
    b.duration = duration;
    const mid = new THREE.Vector3().addVectors(origin, endPoint).multiplyScalar(0.5);
    const len = origin.distanceTo(endPoint);
    b.mesh.position.copy(mid);
    b.mesh.lookAt(endPoint);
    b.mesh.rotateX(Math.PI / 2);
    b.mesh.scale.set(1, len, 1);
    b.mesh.material.opacity = 0.9;
    b.mesh.visible = true;

    // Light planted at the impact end so the beam visibly burns whatever
    // it hit. Held for the beam's duration, then released.
    const slot = this._acquireLight(0xff3344, 12);
    slot.owner = b;
    b.light = slot;
    slot.light.position.copy(endPoint);

    this.beamActive.push(b);
  }

  update(dt) {
    const now = performance.now() * 0.001;
    for (const p of this.active) {
      if (!p.active) continue;
      p.elapsed += dt;
      const t = Math.min(1, p.elapsed / p.duration);
      p.mesh.position.copy(p.startPos).lerp(p.endPos, t);
      const baseScale = p.baseScale || 1.0;
      const flash = baseScale * (1 + (1 - t) * 0.7);
      p.mesh.scale.setScalar(flash);
      if (p.light && p.light.owner === p) {
        p.light.light.position.copy(p.mesh.position);
        p.light.light.intensity = p.light.light.intensity * (1 - t * 0.5);
      }
      if (t >= 1) {
        if (p.light && p.light.owner === p) {
          p.light.light.intensity = 0;
          p.light.owner = null;
        }
        p.light = null;
        p.active = false;
        p.mesh.visible = false;
      }
    }
    this.active = this.active.filter(p => p.active);

    for (const b of this.beamActive) {
      if (!b.active) continue;
      b.elapsed += dt;
      const t = Math.min(1, b.elapsed / b.duration);
      // Shimmer: global-time sin gives the beam an "alive" pulsing energy
      // feel — overlapping beams shimmer together as one flowing red line.
      const shimmer = 0.7 + 0.3 * Math.sin(now * 22);
      b.mesh.material.opacity = shimmer * (1 - t * 0.85);
      if (b.light && b.light.owner === b) {
        b.light.light.intensity = 12 * shimmer * (1 - t);
      }
      if (t >= 1) {
        if (b.light && b.light.owner === b) {
          b.light.light.intensity = 0;
          b.light.owner = null;
        }
        b.light = null;
        b.active = false;
        b.mesh.visible = false;
      }
    }
    this.beamActive = this.beamActive.filter(b => b.active);
  }

  reset() {
    for (const p of this.pool) { p.active = false; p.mesh.visible = false; p.light = null; }
    for (const b of this.beamPool) { b.active = false; b.mesh.visible = false; b.light = null; }
    for (const s of this.lightPool) { s.owner = null; s.light.intensity = 0; }
    this.active = [];
    this.beamActive = [];
  }

  getActiveCount() {
    return this.active.length + this.beamActive.length;
  }
}

// ----- Mammoth-stand-in enemy -----
// Stylized one-eyed creature with tusks and wings.
// Original geometry — inspired by Space Harrier's recurring mammoth motif,
// but built from primitives, not derived from any original asset.
export class Mammoth {
  constructor(scene, position) {
    this.scene = scene;
    this.position = position.clone();
    this.alive = true;
    this.health = 1;
    this.radius = 2.0;
    this.t = Math.random() * 6;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleAmp = 6 + Math.random() * 6;
    this.speedZ = 26;

    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
    this.group.position.copy(this.position);
  }

  _build() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc6633, roughness: 0.55 });
    const accent  = new THREE.MeshStandardMaterial({ color: 0x8a3e1a, roughness: 0.7 });
    const tuskMat = new THREE.MeshStandardMaterial({ color: 0xefe7c8, roughness: 0.3 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x6a3315, roughness: 0.6, side: THREE.DoubleSide });
    const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupil = new THREE.MeshBasicMaterial({ color: 0x110011 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 14), bodyMat);
    body.scale.set(1.25, 0.95, 1.1);
    this.group.add(body);

    // Snout / forward extension
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), accent);
    snout.position.set(0, -0.15, -1.0);
    snout.scale.set(0.95, 0.8, 1.1);
    this.group.add(snout);

    // Tusks
    const tuskGeo = new THREE.ConeGeometry(0.17, 1.5, 10);
    const lT = new THREE.Mesh(tuskGeo, tuskMat);
    lT.position.set(-0.55, -0.45, -1.55);
    lT.rotation.x = -Math.PI / 2 - 0.2;
    lT.rotation.z = 0.18;
    this.group.add(lT);
    const rT = new THREE.Mesh(tuskGeo, tuskMat);
    rT.position.set(0.55, -0.45, -1.55);
    rT.rotation.x = -Math.PI / 2 - 0.2;
    rT.rotation.z = -0.18;
    this.group.add(rT);

    // One central eye
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), eyeWhite);
    w.position.set(0, 0.55, -0.65);
    this.group.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), pupil);
    p.position.set(0, 0.55, -1.1);
    this.group.add(p);

    // Wings — large flat planes, flap on update
    const wingGeo = new THREE.PlaneGeometry(2.2, 0.9);
    this.wingL = new THREE.Mesh(wingGeo, wingMat);
    this.wingL.position.set(-1.4, 0.3, 0.4);
    this.group.add(this.wingL);
    this.wingR = new THREE.Mesh(wingGeo, wingMat);
    this.wingR.position.set(1.4, 0.3, 0.4);
    this.group.add(this.wingR);

    this.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  update(dt, player) {
    this.t += dt;

    // Approach the player on the z axis with a side-to-side wobble
    this.position.z += this.speedZ * dt;
    this.position.x += Math.sin(this.t * 1.8 + this.wobblePhase) * this.wobbleAmp * dt;
    this.position.y += Math.sin(this.t * 2.4 + this.wobblePhase * 0.5) * 1.5 * dt;

    this.group.position.copy(this.position);

    // Face roughly toward the player so the eye stays menacing
    const dx = player.position.x - this.position.x;
    const dy = player.position.y - this.position.y;
    this.group.rotation.y = Math.atan2(dx, this.position.z - player.position.z) - Math.PI;
    this.group.rotation.x = -Math.atan2(dy, Math.max(1, this.position.z - player.position.z));

    // Wing flap
    const flap = Math.sin(this.t * 14) * 0.55;
    this.wingL.rotation.z = 0.4 + flap;
    this.wingR.rotation.z = -0.4 - flap;
    this.wingL.rotation.y = -0.3;
    this.wingR.rotation.y =  0.3;
  }

  hit() {
    this.health--;
    return this.health <= 0;
  }

  destroy() {
    this.scene.remove(this.group);
    disposeObject3D(this.group);
  }
}

// Player-vs-enemy only. Bullet-vs-enemy is hitscan inside Player._fire.
export function checkPlayerEnemyCollisions(player, enemies, audio, onPlayerHit) {
  if (!(player.alive && player.invuln <= 0)) return;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.position.x - player.position.x;
    const dy = e.position.y - player.position.y;
    const dz = e.position.z - player.position.z;
    const r = e.radius + 1.2;
    if (dx*dx + dy*dy + dz*dz < r * r) {
      if (player.hit(audio)) onPlayerHit();
      break;
    }
  }
}

// Ray-sphere intersect. Returns nearest enemy hit by an aim ray, or null.
// Used by Player._fire for hitscan firing.
export function raycastEnemies(rayOrigin, rayDir, enemies) {
  let bestT = Infinity;
  let bestEnemy = null;
  let bestSphere = null;
  for (const e of enemies) {
    if (!e.alive) continue;
    const spheres = typeof e.getHitSpheres === 'function' ? e.getHitSpheres() : [{ center: e.position, radius: e.radius }];
    for (const sphere of spheres) {
      const center = sphere.center || e.position;
      const radius = sphere.radius || e.radius;
      const ox = rayOrigin.x - center.x;
      const oy = rayOrigin.y - center.y;
      const oz = rayOrigin.z - center.z;
      const b = ox * rayDir.x + oy * rayDir.y + oz * rayDir.z;
      const c = ox*ox + oy*oy + oz*oz - radius * radius;
      const disc = b*b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < bestT) {
        bestT = t;
        bestEnemy = e;
        bestSphere = sphere;
      }
    }
  }
  return bestEnemy ? { enemy: bestEnemy, t: bestT, sphere: bestSphere, point: rayOrigin.clone().addScaledVector(rayDir, bestT) } : null;
}

// All-hits variant for piercing weapons (laser). Sorted by distance.
export function raycastEnemiesAll(rayOrigin, rayDir, enemies) {
  const hits = [];
  for (const e of enemies) {
    if (!e.alive) continue;
    const spheres = typeof e.getHitSpheres === 'function' ? e.getHitSpheres() : [{ center: e.position, radius: e.radius }];
    let bestForEnemy = Infinity;
    let bestSphere = null;
    for (const sphere of spheres) {
      const center = sphere.center || e.position;
      const radius = sphere.radius || e.radius;
      const ox = rayOrigin.x - center.x;
      const oy = rayOrigin.y - center.y;
      const oz = rayOrigin.z - center.z;
      const b = ox * rayDir.x + oy * rayDir.y + oz * rayDir.z;
      const c = ox*ox + oy*oy + oz*oz - radius * radius;
      const disc = b*b - c;
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < bestForEnemy) {
        bestForEnemy = t;
        bestSphere = sphere;
      }
    }
    if (bestForEnemy < Infinity) hits.push({ enemy: e, t: bestForEnemy, sphere: bestSphere, point: rayOrigin.clone().addScaledVector(rayDir, bestForEnemy) });
  }
  hits.sort((a, b) => a.t - b.t);
  return hits;
}

// ----- Pickup -----
// Glowing collectible that drifts toward the player. Types: 'multishot',
// 'laser', 'bomb'. Distinct colors AND distinct shapes — bomb is visually
// different from weapons (sphere body + fuse, cube wire shell). Floating
// text label above each so the player can read what it is at speed.
const PICKUP_COLOR = {
  multishot: 0xfff000,
  laser:     0x00f6ff,
  bomb:      0xff2cff,
  health:    0x39ff14,
  speed:     0xff7a22,
  slow:      0x7c9cff,
  invincible: 0x7dfff2
};
const PICKUP_LABEL = {
  multishot: 'MULTI',
  laser:     'LASER',
  bomb:      'BOMB',
  health:    'HEALTH',
  speed:     'SPEED',
  slow:      'SLOW',
  invincible: 'SHIELD'
};
const PICKUP_LABEL_COLOR = {
  multishot: '#fff45a',
  laser:     '#62f9ff',
  bomb:      '#ff72ff',
  health:    '#7cff6a',
  speed:     '#ffb15a',
  slow:      '#9fb6ff',
  invincible: '#93fff6'
};

function makePickupLabel(text, cssColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 40px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.95)';
  ctx.lineWidth = 9;
  ctx.strokeText(text, 128, 36);
  ctx.fillStyle = cssColor;
  ctx.fillText(text, 128, 36);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(7, 1.95, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export class Pickup {
  constructor(scene, position, type) {
    this.scene = scene;
    this.position = position.clone();
    this.type = type;
    this.alive = true;
    this.radius = 4.2;
    this.speedZ = 30;
    this.t = Math.random() * 6;

    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
    this.group.position.copy(this.position);
  }

  _build() {
    const c = PICKUP_COLOR[this.type] || 0xffffff;

    if (this.type === 'bomb')             this._buildBomb(c);
    else if (this.type === 'health')      this._buildHealth(c);
    else if (this.type === 'speed')       this._buildSpeed(c);
    else if (this.type === 'slow')        this._buildSlow(c);
    else if (this.type === 'invincible')  this._buildInvincible(c);
    else                                  this._buildWeapon(c);

    this.light = new THREE.PointLight(c, 8.5, 42, 1.35);
    this.group.add(this.light);

    // Floating text label — names the pickup clearly at speed
    this.label = makePickupLabel(PICKUP_LABEL[this.type] || '???', PICKUP_LABEL_COLOR[this.type] || '#ffffff');
    this.label.position.set(0, 3.3, 0);
    this.group.add(this.label);
  }

  _buildHealth(c) {
    // Green cross — instantly readable as "medical/health" not a weapon
    const mat = new THREE.MeshStandardMaterial({
      color: c, roughness: 0.4, metalness: 0.2,
      emissive: c, emissiveIntensity: 1.8
    });
    const vert  = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.4, 0.7), mat);
    const horiz = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.7), mat);
    this.group.add(vert);
    this.group.add(horiz);
    this.core = vert;

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.1, 1),
      new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.group.add(shell);
    this.shell = shell;
  }

  _buildWeapon(c) {
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.4, 0),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.group.add(core);
    this.core = core;

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.2, 1),
      new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.group.add(shell);
    this.shell = shell;
  }

  _buildSpeed(c) {
    const mat = new THREE.MeshStandardMaterial({
      color: c, roughness: 0.32, metalness: 0.35,
      emissive: c, emissiveIntensity: 1.55
    });
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.4, 4), mat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.z = -0.45;
    this.group.add(arrow);
    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.85, 2.0, 8),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    trail.rotation.x = Math.PI / 2;
    trail.position.z = 0.9;
    this.group.add(trail);
    this.core = arrow;
    this.shell = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.2, 1),
      new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.group.add(this.shell);
  }

  _buildSlow(c) {
    const mat = new THREE.MeshStandardMaterial({
      color: c, roughness: 0.35, metalness: 0.25,
      emissive: c, emissiveIntensity: 1.35
    });
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.5, 14), mat);
    top.rotation.x = Math.PI;
    top.position.y = 0.72;
    const bottom = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.5, 14), mat);
    bottom.position.y = -0.72;
    this.group.add(top);
    this.group.add(bottom);
    this.core = top;
    this.shell = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.12, 8, 32),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.shell.rotation.x = Math.PI / 2;
    this.group.add(this.shell);
  }

  _buildInvincible(c) {
    const mat = new THREE.MeshStandardMaterial({
      color: c, roughness: 0.22, metalness: 0.45,
      emissive: c, emissiveIntensity: 1.55
    });
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), mat);
    shield.scale.set(1.0, 1.25, 0.34);
    shield.rotation.x = Math.PI / 2;
    this.group.add(shield);
    this.core = shield;
    this.shell = new THREE.Mesh(
      new THREE.SphereGeometry(2.25, 18, 12),
      new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.group.add(this.shell);
  }

  _buildBomb(c) {
    // Spherical bomb body with a small "fuse" cone — classic cartoon bomb
    // silhouette, instantly readable as "consumable" vs "weapon."
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0x331a40, roughness: 0.5, metalness: 0.4, emissive: 0x551166, emissiveIntensity: 1.2 })
    );
    this.group.add(core);
    this.core = core;

    const fuse = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.9, 8),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    fuse.position.y = 1.7;
    this.group.add(fuse);

    // Cube wire shell — angular, very different from the icosahedron used
    // for weapon pickups. Rotates differently in update().
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.group.add(shell);
    this.shell = shell;
  }

  update(dt, player) {
    this.t += dt;
    this.position.z += this.speedZ * dt;
    this.position.y += Math.sin(this.t * 2) * 0.6 * dt;
    this.group.position.copy(this.position);
    this.group.rotation.y += dt * 1.4;
    this.shell.rotation.y -= dt * 0.8;
    this.shell.rotation.x += dt * 0.9;
    // Hard neon pulse: pickups must pop from the themed world palettes.
    const pulse = 1.15 + Math.sin(this.t * 8) * 0.22;
    this.core.scale.setScalar(pulse);
    if (this.light) this.light.intensity = 7.5 + Math.sin(this.t * 10) * 2.5;
    if (this.shell?.material) this.shell.material.opacity = 0.72 + Math.sin(this.t * 9) * 0.22;
  }

  destroy() {
    this.scene.remove(this.group);
    disposeObject3D(this.group);
  }
}

// ----- Shockwaves -----
// Expanding ring rendered as a flat torus that scales out and fades. Used
// for bomb detonation. Camera-facing so it reads from any head angle.
export class Shockwaves {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.pool = [];
    const geo = new THREE.TorusGeometry(1, 0.18, 12, 48);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.visible = false;
      this.scene.add(ring);
      this.pool.push({ ring, elapsed: 0, duration: 0.6, maxScale: 90, active: false });
    }
  }

  spawn(position, color = 0xffffff, maxScale = 90, duration = 0.6) {
    const a = this.pool.find(entry => !entry.active);
    if (!a) return;
    a.active = true;
    a.elapsed = 0;
    a.duration = duration;
    a.maxScale = maxScale;
    a.ring.material.color.setHex(color);
    a.ring.material.opacity = 1;
    a.ring.position.copy(position);
    a.ring.scale.setScalar(1);
    a.ring.visible = true;
    this.active.push(a);
  }

  update(dt, camera) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.elapsed += dt;
      const t = Math.min(1, a.elapsed / a.duration);
      const ease = 1 - Math.pow(1 - t, 2);
      a.ring.scale.setScalar(1 + ease * a.maxScale);
      a.ring.material.opacity = 1 - t;
      if (camera) a.ring.lookAt(camera.position);
      if (t >= 1) {
        a.active = false;
        a.ring.visible = false;
        a.ring.material.opacity = 0;
        this.active.splice(i, 1);
      }
    }
  }

  reset() {
    for (const a of this.pool) {
      a.active = false;
      a.ring.visible = false;
      a.ring.material.opacity = 0;
    }
    this.active = [];
  }
}

// ----- Explosion (simple cheap effect) -----
export class Explosions {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.pool = [];
    this.particleGeo = new THREE.IcosahedronGeometry(0.65, 0);
    for (let i = 0; i < 28; i++) {
      const group = new THREE.Group();
      const dirs = [];
      for (let j = 0; j < 16; j++) {
        const mesh = new THREE.Mesh(
          this.particleGeo,
          new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        group.add(mesh);
        dirs.push(new THREE.Vector3());
      }
      group.visible = false;
      this.scene.add(group);
      this.pool.push({ group, dirs, life: 0, max: 0.6, active: false });
    }
  }

  spawn(position, color = 0xffaa33) {
    const a = this.pool.find(entry => !entry.active);
    if (!a) return;
    a.active = true;
    a.life = 0.6;
    a.max = 0.6;
    a.group.position.copy(position);
    a.group.visible = true;
    a.group.children.forEach((mesh, i) => {
      mesh.position.set(0, 0, 0);
      mesh.scale.setScalar(0.7 + Math.random() * 0.45);
      mesh.material.color.setHex(color);
      mesh.material.opacity = 1;
      a.dirs[i].set(
        (Math.random() - 0.5),
        (Math.random() - 0.5),
        (Math.random() - 0.5)
      ).normalize().multiplyScalar(8 + Math.random() * 12);
    });
    this.active.push(a);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.life -= dt;
      const t = 1 - a.life / a.max;
      a.group.children.forEach((c, j) => {
        c.position.addScaledVector(a.dirs[j], dt);
        c.scale.setScalar(Math.max(0.01, 1 - t));
        c.material.opacity = Math.max(0, 1 - t);
      });
      if (a.life <= 0) {
        a.active = false;
        a.group.visible = false;
        a.group.children.forEach(c => { c.material.opacity = 0; });
        this.active.splice(i, 1);
      }
    }
  }

  reset() {
    for (const a of this.pool) {
      a.active = false;
      a.group.visible = false;
      a.group.children.forEach(c => { c.material.opacity = 0; c.position.set(0, 0, 0); });
    }
    this.active = [];
  }
}
