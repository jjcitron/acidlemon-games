import * as THREE from 'three';

const MAX_ENEMY_PROJECTILES = 120;

const PROJECTILE_STYLE = {
  fireball: { shape: 'sphere', color: 0xff6a22, halo: 0x4fffff, contrast: 0xffffff, trail: 0xff3300, emissive: 0xff3300, radius: 0.85, speed: 34, damageRadius: 1.25 },
  bullet: { shape: 'diamond', color: 0xfff3a0, halo: 0xff4cff, contrast: 0x4fffff, trail: 0xfff3a0, emissive: 0xffaa22, radius: 0.34, speed: 58, damageRadius: 0.85 },
  missile: { shape: 'cone', color: 0x9ce6ff, halo: 0xfff2a0, contrast: 0xffffff, trail: 0xff5533, emissive: 0x55aaff, radius: 0.55, speed: 45, damageRadius: 1.05 }
};

const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1);

export class EnemyProjectiles {
  constructor(scene, audio = null) {
    this.scene = scene;
    this.audio = audio;
    this.pool = [];
    this.active = [];
    this.materials = {};
    this.haloMaterials = {};
    this.contrastMaterials = {};
    this.trailMaterials = {};
    this.shapeGeometries = {
      sphere: new THREE.SphereGeometry(1, 12, 8),
      diamond: new THREE.OctahedronGeometry(1, 0),
      cone: new THREE.ConeGeometry(0.9, 2.25, 8)
    };
    this.shapeGeometries.cone.rotateX(Math.PI / 2);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.lightCursor = 0;
    this.lights = [];
    this.lastWarningAt = 0;
    this._velocityDir = new THREE.Vector3();

    for (const [type, style] of Object.entries(PROJECTILE_STYLE)) {
      this.materials[type] = new THREE.MeshBasicMaterial({
        color: style.color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.haloMaterials[type] = new THREE.MeshBasicMaterial({
        color: style.halo,
        transparent: true,
        opacity: 0.48,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.contrastMaterials[type] = new THREE.MeshBasicMaterial({
        color: style.contrast,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.trailMaterials[type] = new THREE.MeshBasicMaterial({
        color: style.trail,
        transparent: true,
        opacity: type === 'bullet' ? 0.22 : 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
    }

    const coreGeo = new THREE.SphereGeometry(1, 8, 6);
    const haloGeo = new THREE.IcosahedronGeometry(1, 1);
    const ringGeo = new THREE.TorusGeometry(1, 0.045, 6, 28);
    const trailGeo = new THREE.ConeGeometry(1, 2.8, 8);
    trailGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX_ENEMY_PROJECTILES; i++) {
      const group = new THREE.Group();
      const mesh = new THREE.Mesh(this.shapeGeometries.sphere, this.materials.fireball);
      const core = new THREE.Mesh(coreGeo, this.coreMaterial);
      const halo = new THREE.Mesh(haloGeo, this.haloMaterials.fireball);
      const ringA = new THREE.Mesh(ringGeo, this.contrastMaterials.fireball);
      const ringB = new THREE.Mesh(ringGeo, this.contrastMaterials.fireball);
      ringA.rotation.x = Math.PI / 2;
      ringB.rotation.y = Math.PI / 2;
      const trail = new THREE.Mesh(trailGeo, this.trailMaterials.fireball);
      trail.position.z = -1.2;
      group.add(trail, mesh, core, halo, ringA, ringB);
      group.visible = false;
      this.scene.add(group);
      this.pool.push({
        group,
        mesh,
        core,
        halo,
        ringA,
        ringB,
        trail,
        active: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 5,
        radius: 1,
        visualRadius: 1,
        type: 'fireball',
        lightSlot: null
      });
    }

    for (let i = 0; i < 6; i++) {
      const light = new THREE.PointLight(0xff6633, 0, 22, 1.7);
      this.scene.add(light);
      this.lights.push({ light, owner: null });
    }
  }

  spawn(type, position, velocity, options = {}) {
    const style = PROJECTILE_STYLE[type] || PROJECTILE_STYLE.fireball;
    const p = this.pool.find(entry => !entry.active);
    if (!p) return null;

    p.active = true;
    p.type = type;
    p.position.copy(position);
    p.velocity.copy(velocity);
    p.life = 0;
    p.maxLife = options.maxLife ?? 5;
    p.radius = options.damageRadius ?? style.damageRadius;
    p.visualRadius = options.visualRadius ?? style.radius;
    p.mesh.geometry = this.shapeGeometries[style.shape] || this.shapeGeometries.sphere;
    p.mesh.material = this.materials[type] || this.materials.fireball;
    p.mesh.scale.setScalar(p.visualRadius);
    p.core.scale.setScalar(Math.max(0.16, p.visualRadius * 0.38));
    p.halo.material = this.haloMaterials[type] || this.haloMaterials.fireball;
    p.halo.scale.setScalar(p.visualRadius * 1.85);
    p.ringA.material = this.contrastMaterials[type] || this.contrastMaterials.fireball;
    p.ringB.material = this.contrastMaterials[type] || this.contrastMaterials.fireball;
    p.ringA.scale.setScalar(p.visualRadius * (type === 'bullet' ? 2.25 : 1.72));
    p.ringB.scale.setScalar(p.visualRadius * (type === 'missile' ? 2.35 : 1.95));
    p.trail.material = this.trailMaterials[type] || this.trailMaterials.fireball;
    p.trail.visible = type !== 'bullet';
    p.trail.scale.set(p.visualRadius * 0.75, p.visualRadius * 0.75, p.visualRadius * (type === 'missile' ? 1.8 : 1.05));
    p.trail.position.z = -p.visualRadius * (type === 'missile' ? 2.05 : 1.35);
    p.group.position.copy(position);
    this._orientToVelocity(p);
    p.group.visible = true;

    if (type === 'missile') this._warnMissile();

    const slot = this._acquireLight(style.emissive, options.lightIntensity ?? 3.0);
    p.lightSlot = slot;
    slot.owner = p;
    slot.light.position.copy(position);

    this.active.push(p);
    return p;
  }

  _acquireLight(color, intensity) {
    const slot = this.lights[this.lightCursor];
    this.lightCursor = (this.lightCursor + 1) % this.lights.length;
    if (slot.owner) slot.owner.lightSlot = null;
    slot.owner = null;
    slot.light.color.setHex(color);
    slot.light.intensity = intensity;
    return slot;
  }

  update(dt) {
    for (const p of this.active) {
      if (!p.active) continue;
      p.life += dt;
      p.position.addScaledVector(p.velocity, dt);
      p.group.position.copy(p.position);
      this._orientToVelocity(p);
      p.mesh.rotation.z += dt * (p.type === 'missile' ? 2.2 : 7);
      p.halo.rotation.x -= dt * 4;
      p.halo.rotation.y += dt * 6;
      p.ringA.rotation.z += dt * 5.8;
      p.ringB.rotation.x += dt * 4.2;
      const pulse = 1 + Math.sin((p.life * 18) + p.position.z) * 0.12;
      p.mesh.scale.setScalar(p.visualRadius * pulse);
      p.core.scale.setScalar(Math.max(0.16, p.visualRadius * 0.38) * (1.1 + (pulse - 1) * 1.8));
      p.halo.scale.setScalar(p.visualRadius * (1.65 + Math.max(0, pulse - 1) * 1.8));
      p.ringA.scale.setScalar(p.visualRadius * (1.7 + Math.max(0, pulse - 1) * 2.6));
      p.ringB.scale.setScalar(p.visualRadius * (p.type === 'missile' ? 2.2 : 1.95));
      p.trail.material.opacity = p.type === 'missile' ? 0.24 + Math.max(0, pulse - 1) * 1.2 : 0.2;
      if (p.lightSlot && p.lightSlot.owner === p) {
        p.lightSlot.light.position.copy(p.position);
        p.lightSlot.light.intensity *= 0.995;
      }
      if (p.life >= p.maxLife || p.position.z > 16 || Math.abs(p.position.x) > 42 || p.position.y < -18 || p.position.y > 24) {
        this._release(p);
      }
    }
    this.active = this.active.filter(p => p.active);
  }

  _warnMissile() {
    const now = performance.now() * 0.001;
    if (now - this.lastWarningAt < 0.42) return;
    this.lastWarningAt = now;
    this.audio?.playWarning?.('missile');
  }

  _orientToVelocity(projectile) {
    const dir = projectile.velocity;
    if (!dir || dir.lengthSq() < 0.0001) return;
    this._velocityDir.copy(dir).normalize();
    projectile.group.quaternion.setFromUnitVectors(LOCAL_FORWARD, this._velocityDir);
  }

  checkPlayerCollisions(player, audio, onPlayerHit) {
    if (!(player.alive && player.invuln <= 0)) return;
    for (const p of this.active) {
      if (!p.active) continue;
      const dx = p.position.x - player.position.x;
      const dy = p.position.y - player.position.y;
      const dz = p.position.z - player.position.z;
      const r = p.radius + 1.1;
      if (dx * dx + dy * dy + dz * dz < r * r) {
        this._release(p);
        if (player.hit(audio)) onPlayerHit();
        return;
      }
    }
  }

  _release(p) {
    if (p.lightSlot && p.lightSlot.owner === p) {
      p.lightSlot.light.intensity = 0;
      p.lightSlot.owner = null;
    }
    p.lightSlot = null;
    p.active = false;
    p.group.visible = false;
  }

  reset() {
    for (const p of this.pool) this._release(p);
    for (const slot of this.lights) {
      slot.owner = null;
      slot.light.intensity = 0;
    }
    this.active = [];
  }

  getActiveCount() {
    return this.active.length;
  }
}

export function aimedVelocity(from, to, type = 'bullet', speedScale = 1) {
  const style = PROJECTILE_STYLE[type] || PROJECTILE_STYLE.bullet;
  return to.clone().sub(from).normalize().multiplyScalar(style.speed * speedScale);
}
