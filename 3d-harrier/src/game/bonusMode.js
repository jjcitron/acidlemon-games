import * as THREE from 'three';
import { disposeObject3D } from './dispose.js';

export class BonusMode {
  constructor(scene) {
    this.scene = scene;
    this.targets = [];
    this.elapsed = 0;
    this.nextTargetTime = 0.35;
    this.scoreValue = 75;
  }
  start(config = {}) { this.reset(); this.config = config; }
  update(dt, player, onTargetCollected) {
    this.elapsed += dt;
    this.nextTargetTime -= dt;
    if (this.nextTargetTime <= 0) {
      this.spawnTarget();
      this.nextTargetTime = 0.28 + Math.random() * 0.38;
    }
    for (const target of this.targets) {
      target.position.z += target.speedZ * dt;
      target.rotation.x += dt * target.spin.x;
      target.rotation.y += dt * target.spin.y;
      const pulse = 1 + Math.sin(this.elapsed * 6 + target.position.x) * 0.08;
      target.scale.setScalar(target.baseScale * pulse);
      if (player) {
        const dx = target.position.x - player.position.x;
        const dy = target.position.y - player.position.y;
        const dz = target.position.z - player.position.z;
        if (dx*dx + dy*dy + dz*dz < 10.5) {
          target.userData.dead = true;
          if (onTargetCollected) onTargetCollected(this.scoreValue);
        }
      }
    }
    this._cleanup();
  }
  spawnTarget() {
    const natural = this.config?.targetSet !== 'metallic';
    const geo = natural ? new THREE.DodecahedronGeometry(1.5, 0) : new THREE.IcosahedronGeometry(1.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: natural ? 0xffd25a : 0x9ce6ff, roughness: 0.45, metalness: natural ? 0.05 : 0.45, emissive: natural ? 0x332000 : 0x003344, emissiveIntensity: 0.35, flatShading: true });
    const m = new THREE.Mesh(geo, mat);
    m.position.set((Math.random() - 0.5) * 34, (Math.random() - 0.5) * 15 + 1, -320);
    m.speedZ = 125 + Math.random() * 40;
    m.baseScale = 0.9 + Math.random() * 0.75;
    m.spin = new THREE.Vector3(1 + Math.random() * 4, 1 + Math.random() * 4, 0);
    m.castShadow = true;
    this.scene.add(m);
    this.targets.push(m);
  }
  _cleanup() {
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.userData.dead || t.position.z > 12) {
        this.scene.remove(t);
        disposeObject3D(t);
        this.targets.splice(i, 1);
      }
    }
  }
  reset() {
    for (const t of this.targets) {
      this.scene.remove(t);
      disposeObject3D(t);
    }
    this.targets = [];
    this.elapsed = 0;
    this.nextTargetTime = 0.35;
  }
}
