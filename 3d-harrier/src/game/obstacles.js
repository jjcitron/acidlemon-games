import * as THREE from 'three';
import { disposeObject3D } from './dispose.js';

const DEFAULTS = {
  rock: { radius: 3.2, health: 2, destructible: true, scoreValue: 50 },
  mushroom: { radius: 3.0, health: 1, destructible: true, scoreValue: 50 },
  deadTree: { radius: 2.5, health: 2, destructible: true, scoreValue: 75 },
  tree: { radius: 3.0, health: 2, destructible: true, scoreValue: 75 },
  column: { radius: 3.2, health: 999, destructible: false, scoreValue: 0 },
  idaHead: { radius: 3.2, health: 3, destructible: true, scoreValue: 120 },
  binzubin: { radius: 2.8, health: 999, destructible: false, scoreValue: 0 },
  underpass: { radius: 3.5, health: 999, destructible: false, scoreValue: 0 },
  bridge: { radius: 3.5, health: 999, destructible: false, scoreValue: 0 },
  tunnelRing: { radius: 3.5, health: 999, destructible: false, scoreValue: 0 },
  skyscraper: { radius: 4.0, health: 999, destructible: false, scoreValue: 0 },
  archway: { radius: 3.5, health: 999, destructible: false, scoreValue: 0 }
};

export class Obstacle {
  constructor(scene, position, type, options = {}) {
    this.scene = scene;
    this.position = position.clone();
    this.type = type;
    const defaults = DEFAULTS[type] || DEFAULTS.rock;
    this.radius = options.radius ?? defaults.radius;
    this.health = options.health ?? defaults.health;
    this.destructible = options.destructible ?? defaults.destructible;
    this.scoreValue = options.scoreValue ?? defaults.scoreValue;
    this.speedZ = options.speedZ ?? 90;
    this.alive = true;
    this.t = Math.random() * 10;
    this.collisionSpheres = options.collisionSpheres || null;
    this.telegraphs = [];

    this.group = new THREE.Group();
    this._build(type);
    this._buildCollisionTelegraph();
    this.group.position.copy(this.position);
    this.scene.add(this.group);
  }

  _build(type) {
    if (type === 'mushroom') return this._buildMushroom();
    if (type === 'deadTree') return this._buildDeadTree();
    if (type === 'tree') return this._buildTree();
    if (type === 'column') return this._buildColumn();
    if (type === 'idaHead') return this._buildIdaHead();
    if (type === 'binzubin') return this._buildBinzubin();
    if (type === 'underpass') return this._buildUnderpass();
    if (type === 'bridge') return this._buildBridge();
    if (type === 'tunnelRing') return this._buildTunnelRing();
    if (type === 'skyscraper') return this._buildSkyscraper();
    if (type === 'archway') return this._buildArchway();
    return this._buildRock();
  }

  _buildRock() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb58a54, roughness: 0.85, flatShading: true });
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 0), mat);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    this.group.add(mesh);
    this._setCollision([{ offset: [0, 0, 0], radius: 3.2 }]);
    this._enableShadows();
  }

  _buildMushroom() {
    const stemMat = new THREE.MeshStandardMaterial({ color: 0xe2c094, roughness: 0.65 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xd62b52, roughness: 0.48, emissive: 0x3a0010, emissiveIntensity: 0.35 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.2, 5.4, 12), stemMat);
    stem.position.y = -1.7;
    this.group.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(3.0, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), capMat);
    cap.position.y = 1.2;
    cap.scale.y = 0.55;
    this.group.add(cap);
    this._setCollision([{ offset: [0, 0.6, 0], radius: 3.0 }]);
    this._enableShadows();
  }

  _buildDeadTree() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b1008, roughness: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 11, 7), mat);
    trunk.position.y = 0;
    trunk.rotation.z = (Math.random() - 0.5) * 0.22;
    this.group.add(trunk);
    for (let i = 0; i < 5; i++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 4.8, 6), mat);
      branch.position.y = -2.5 + i * 1.3;
      branch.rotation.z = (i % 2 ? -1 : 1) * (0.72 + Math.random() * 0.38);
      branch.rotation.x = (Math.random() - 0.5) * 0.45;
      this.group.add(branch);
    }
    this._setCollision([
      { offset: [0, -3.0, 0], radius: 1.8 },
      { offset: [0, 1.0, 0], radius: 2.6 },
      { offset: [0, 4.0, 0], radius: 2.2 }
    ]);
    this._enableShadows();
  }

  _buildTree() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2b1708, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x43a23a, roughness: 0.68 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 9, 8), trunkMat);
    trunk.position.y = -1.4;
    this.group.add(trunk);
    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(3.1 - i * 0.45, 4.0, 9), leafMat);
      crown.position.y = 1.8 + i * 2.0;
      this.group.add(crown);
    }
    this._setCollision([
      { offset: [0, -3.5, 0], radius: 1.7 },
      { offset: [0, 2.0, 0], radius: 3.0 },
      { offset: [0, 5.0, 0], radius: 2.4 }
    ]);
    this._enableShadows();
  }

  _buildColumn() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xe0b46e, roughness: 0.72 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.6, 30, 10), mat);
    shaft.position.y = 0;
    this.group.add(shaft);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.5, 4.5), mat);
    cap.position.y = 15.6;
    this.group.add(cap);
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.2, 4.3), mat);
    base.position.y = -15.4;
    this.group.add(base);
    this._setCollision([
      { offset: [0, -9, 0], radius: 3.2 },
      { offset: [0, 0, 0], radius: 3.2 },
      { offset: [0, 9, 0], radius: 3.2 }
    ]);
    this._enableShadows();
  }

  _buildIdaHead() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xb8aaa0, roughness: 0.82, flatShading: true });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(5.0, 5.8, 3.4), mat);
    this.group.add(head);
    for (const x of [-1.0, 1.0]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.2), eyeMat);
      eye.position.set(x, 0.75, -1.78);
      this.group.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.36, 0.2), eyeMat);
    mouth.position.set(0, -0.75, -1.78);
    this.group.add(mouth);
    this._setCollision([{ offset: [0, 0, 0], radius: 3.2 }]);
    this._enableShadows();
  }

  _buildBinzubin() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8dffff,
      roughness: 0.25,
      metalness: 0.35,
      emissive: 0x0b6680,
      emissiveIntensity: 1.15
    });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.8, 0), mat);
    this.group.add(mesh);
    this.spin = new THREE.Vector3(1.1 + Math.random() * 1.4, 1.4 + Math.random() * 1.6, 0.8 + Math.random());
    this._setCollision([{ offset: [0, 0, 0], radius: 2.8 }]);
    this._enableShadows();
  }


  // ----- UNDERPASS: a low overhead bar the player must duck under -----
  // Player y range is -8 to 12, so the bar lives at y=8-12 (top portion)
  // and the safe zone is y < 5
  _buildUnderpass() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x666677, roughness: 0.7, metalness: 0.4,
      emissive: 0x110022, emissiveIntensity: 0.15
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00, roughness: 0.5, emissive: 0xffaa00, emissiveIntensity: 0.4
    });
    // Wide horizontal beam at the top
    const beam = new THREE.Mesh(new THREE.BoxGeometry(48, 3.5, 4), mat);
    beam.position.y = 10;
    this.group.add(beam);
    // Hazard stripes underneath
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(48, 0.4, 4.2), stripeMat);
    stripe.position.y = 8.2;
    this.group.add(stripe);
    // Side support pillars
    for (const x of [-22, 22]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 26, 3.0), mat);
      pillar.position.set(x, -3, 0);
      this.group.add(pillar);
    }
    // Collision: only the overhead beam + supports — safe to duck under (y < 6)
    this._setCollision([
      { offset: [0, 10, 0], radius: 4.5 },     // central beam mass
      { offset: [-16, 10, 0], radius: 4.0 },   // left beam segment
      { offset: [16, 10, 0], radius: 4.0 },    // right beam segment
      { offset: [-22, -3, 0], radius: 4.5 },   // left pillar
      { offset: [22, -3, 0], radius: 4.5 }     // right pillar
    ]);
    this._enableShadows();
  }

  // ----- BRIDGE: cityscape bridge with a deck overhead (player ducks under) -----
  _buildBridge() {
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2f, roughness: 0.85 });
    const cableMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c8, roughness: 0.4, metalness: 0.6 });
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x8a6f5a, roughness: 0.8 });
    // Bridge deck (overhead, wide)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(60, 2, 6), deckMat);
    deck.position.y = 9;
    this.group.add(deck);
    // Suspension towers on each side
    for (const x of [-26, 26]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.5, 24, 3.5), towerMat);
      tower.position.set(x, -3, 0);
      this.group.add(tower);
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.0, 4.5), towerMat);
      top.position.set(x, 9.5, 0);
      this.group.add(top);
    }
    // Suspension cables (decorative)
    for (let i = 0; i < 6; i++) {
      const cx = -26 + (i + 1) * 7.5;
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 12, 5), cableMat);
      cable.position.set(cx, 3, 0);
      this.group.add(cable);
    }
    // Collision: the deck + towers
    this._setCollision([
      { offset: [0, 9, 0], radius: 5.5 },
      { offset: [-18, 9, 0], radius: 4.5 },
      { offset: [18, 9, 0], radius: 4.5 },
      { offset: [-26, -3, 0], radius: 4.8 },
      { offset: [26, -3, 0], radius: 4.8 }
    ]);
    this._enableShadows();
  }

  // ----- TUNNEL RING: a circular portal the player must fly through center -----
  _buildTunnelRing() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4477aa, roughness: 0.3, metalness: 0.5,
      emissive: 0x113355, emissiveIntensity: 0.5
    });
    // The ring itself
    const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 1.6, 12, 32), mat);
    ring.position.y = 2;
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
    // Inner glow accent (visual cue for safe passage)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x66ccff, transparent: true, opacity: 0.35, side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(new THREE.TorusGeometry(11, 0.4, 8, 32), glowMat);
    glow.position.y = 2;
    glow.rotation.x = Math.PI / 2;
    this.group.add(glow);
    // Collision: ring around the perimeter, leaving the center clear
    // 8 collision spheres around the circumference
    const N = 8;
    const spheres = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      spheres.push({ offset: [Math.cos(a) * 11, 2 + Math.sin(a) * 11, 0], radius: 2.6 });
    }
    this._setCollision(spheres);
    this._enableShadows();
  }

  // ----- SKYSCRAPER: tall building that occupies a single lane -----
  _buildSkyscraper() {
    const palette = [0x3a3a4a, 0x4a4a5a, 0x2a2a3a];
    const c = palette[Math.floor(Math.random() * palette.length)];
    const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.25 });
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffeb88 });
    const w = 6 + Math.random() * 2.5;
    const h = 30 + Math.random() * 18;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    body.position.y = h / 2 - 8;
    this.group.add(body);
    // Window grid (just two faces for performance)
    const cols = Math.max(3, Math.floor(w / 1.3));
    const rows = Math.max(8, Math.floor(h / 2.2));
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.random() > 0.35) continue;
        const wn = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.85), winMat);
        wn.position.set(-w / 2 + 0.6 + col * (w / cols), -8 + 1 + row * (h / rows), w / 2 + 0.02);
        this.group.add(wn);
      }
    }
    // Tall collision column
    this._setCollision([
      { offset: [0, h / 2 - 8, 0], radius: w * 0.6 },
      { offset: [0, h / 4 - 8, 0], radius: w * 0.55 },
      { offset: [0, -8 + h / 6, 0], radius: w * 0.55 }
    ]);
    this._enableShadows();
  }

  // ----- ARCHWAY: arched gateway with safe center, like a triumph arch -----
  _buildArchway() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.78 });
    // Side legs
    for (const x of [-11, 11]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 20, 4), mat);
      leg.position.set(x, 2, 0);
      this.group.add(leg);
    }
    // Top span
    const top = new THREE.Mesh(new THREE.BoxGeometry(28, 5, 4), mat);
    top.position.y = 11;
    this.group.add(top);
    // Decorative crown
    const crown = new THREE.Mesh(new THREE.BoxGeometry(30, 1.6, 4.5), mat);
    crown.position.y = 14.2;
    this.group.add(crown);
    // Collision: arches + legs, leaves center clear
    this._setCollision([
      { offset: [-11, 2, 0], radius: 3.5 },
      { offset: [-11, -4, 0], radius: 3.5 },
      { offset: [-11, 8, 0], radius: 3.5 },
      { offset: [11, 2, 0], radius: 3.5 },
      { offset: [11, -4, 0], radius: 3.5 },
      { offset: [11, 8, 0], radius: 3.5 },
      { offset: [0, 12, 0], radius: 4.5 },
      { offset: [-9, 11, 0], radius: 3.0 },
      { offset: [9, 11, 0], radius: 3.0 }
    ]);
    this._enableShadows();
  }

  _setCollision(spheres) {
    this.collisionSpheres = spheres.map(s => ({
      offset: new THREE.Vector3(s.offset[0], s.offset[1], s.offset[2]),
      radius: s.radius
    }));
  }

  _enableShadows() {
    this.group.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  _buildCollisionTelegraph() {
    const color = this.destructible ? 0xffe48a : 0x7ff5ff;
    const spheres = this.collisionSpheres || [{ offset: new THREE.Vector3(), radius: this.radius }];
    for (const sphere of spheres) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: this.destructible ? 0.18 : 0.26,
        wireframe: true,
        depthWrite: false
      });
      const marker = new THREE.Mesh(new THREE.SphereGeometry(sphere.radius, 14, 8), mat);
      marker.position.copy(sphere.offset);
      marker.userData.telegraph = true;
      marker.userData.baseOpacity = mat.opacity;
      marker.userData.baseRadius = sphere.radius;
      marker.userData.phase = Math.random() * Math.PI * 2;
      this.telegraphs.push(marker);
      this.group.add(marker);

      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: this.destructible ? 0.26 : 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(sphere.radius * 1.04, Math.max(0.045, sphere.radius * 0.025), 6, 36), ringMat);
      ring.position.copy(sphere.offset);
      ring.rotation.x = Math.PI / 2;
      ring.userData.telegraph = true;
      ring.userData.warningRing = true;
      ring.userData.baseOpacity = ringMat.opacity;
      ring.userData.baseRadius = sphere.radius;
      ring.userData.phase = marker.userData.phase + 0.75;
      this.telegraphs.push(ring);
      this.group.add(ring);
    }
  }

  update(dt) {
    this.t += dt;
    this.position.z += this.speedZ * dt;
    if (this.spin) {
      this.group.rotation.x += this.spin.x * dt;
      this.group.rotation.y += this.spin.y * dt;
      this.group.rotation.z += this.spin.z * dt;
    } else {
      this.group.rotation.y += Math.sin(this.t * 0.7) * 0.08 * dt;
    }
    this._updateCollisionTelegraph();
    this.group.position.copy(this.position);
  }

  _updateCollisionTelegraph() {
    if (!this.telegraphs.length) return;
    const approach = Math.max(0, Math.min(1, (this.position.z + 280) / 280));
    const dangerBoost = this.destructible ? 0.75 : 1.08;
    const visible = approach > 0.16;
    for (const marker of this.telegraphs) {
      marker.visible = visible;
      if (!visible) continue;
      const base = marker.userData.baseOpacity || 0.2;
      const phase = marker.userData.phase || 0;
      const pulse = (Math.sin(this.t * (this.destructible ? 6.5 : 9.5) + phase) + 1) * 0.5;
      const scale = (marker.userData.warningRing ? 1.03 : 1.0) + pulse * (marker.userData.warningRing ? 0.13 : 0.07) + approach * 0.05;
      marker.scale.setScalar(scale);
      marker.material.opacity = Math.min(0.72, base * (0.82 + pulse * 0.55 + approach * dangerBoost));
      if (marker.userData.warningRing) marker.rotation.z += 0.035 + approach * 0.055;
    }
  }

  hit(damage = 1) {
    if (!this.destructible) return false;
    this.health -= damage;
    return this.health <= 0;
  }

  getCollisionSpheres() {
    return (this.collisionSpheres || [{ offset: new THREE.Vector3(), radius: this.radius }]).map(s => ({
      center: this.position.clone().add(s.offset),
      radius: s.radius
    }));
  }

  destroy() {
    this.scene.remove(this.group);
    disposeObject3D(this.group);
  }
}

export function checkPlayerObstacleCollisions(player, obstacles, audio, onPlayerHit) {
  if (!(player.alive && player.invuln <= 0)) return;
  for (const obstacle of obstacles) {
    if (!obstacle.alive) continue;
    for (const sphere of obstacle.getCollisionSpheres()) {
      const dx = sphere.center.x - player.position.x;
      const dy = sphere.center.y - player.position.y;
      const dz = sphere.center.z - player.position.z;
      const r = sphere.radius + 1.2;
      if (dx * dx + dy * dy + dz * dz < r * r) {
        if (player.hit(audio)) onPlayerHit(obstacle);
        return;
      }
    }
  }
}
