import * as THREE from 'three';
import { disposeObject3D } from '../dispose.js';

export class EnemyBase {
  constructor(scene, position, options = {}) {
    this.scene = scene;
    this.position = position.clone();
    this.origin = position.clone();
    this.alive = true;
    this.health = options.health ?? 1;
    this.radius = options.radius ?? 1.8;
    this.speedZ = options.speedZ ?? 38;
    this.scoreValue = options.scoreValue ?? 100;
    this.t = Math.random() * 10;
    this.fireTimer = options.fireDelay ?? (0.8 + Math.random() * 1.2);
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.group.position.copy(this.position);
  }

  update(dt, player, ctx = {}) {
    this.t += dt;
    this.position.z += this.speedZ * dt;
    this.group.position.copy(this.position);
    this._facePlayer(player);
  }

  _facePlayer(player) {
    if (!player) return;
    const dx = player.position.x - this.position.x;
    const dy = player.position.y - this.position.y;
    this.group.rotation.y = Math.atan2(dx, this.position.z - player.position.z) - Math.PI;
    this.group.rotation.x = -Math.atan2(dy, Math.max(1, this.position.z - player.position.z));
  }

  hit(damage = 1) {
    if (!this.canBeHit()) return false;
    this.health -= damage;
    this.flashHit();
    return this.health <= 0;
  }

  canBeHit() {
    return true;
  }

  flashHit() {
    this.group.traverse(o => {
      if (o.isMesh && o.material && 'emissiveIntensity' in o.material) {
        o.material.emissiveIntensity = Math.min(1.2, (o.material.emissiveIntensity || 0) + 0.35);
      }
    });
  }

  getHitSpheres() {
    return [{ center: this.position.clone(), radius: this.radius }];
  }

  getCollisionSpheres() {
    return this.getHitSpheres();
  }

  destroy() {
    this.scene.remove(this.group);
    disposeObject3D(this.group);
  }

  _enableShadows() {
    this.group.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  _material(color, options = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.55,
      metalness: options.metalness ?? 0.15,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0
    });
  }
}
