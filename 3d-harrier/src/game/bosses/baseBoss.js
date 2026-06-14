import * as THREE from 'three';
import { aimedVelocity } from '../enemyProjectiles.js';
import { disposeObject3D } from '../dispose.js';

export class BossBase {
  constructor(scene, position, options = {}) {
    this.scene = scene; this.position = position.clone(); this.alive = true;
    this.name = options.name || 'BOSS'; this.maxHealth = options.health || 40; this.health = this.maxHealth;
    this.radius = options.radius || 5; this.scoreValue = options.scoreValue || 2000; this.t = 0; this.phase = 0; this.fireTimer = 1;
    this.isBoss = true;
    this.group = new THREE.Group(); this.group.position.copy(this.position); this.scene.add(this.group);
    this.weakPointRing = null;
  }
  update(dt, player, ctx = {}) { this.t += dt; this.group.position.copy(this.position); this._updateWeakPointRing(dt); }
  hit(damage = 1, hitInfo = null) { if (!this.canBeHit(hitInfo)) return false; this.health = Math.max(0, this.health - damage); this.flashHit(); if (this.health <= 0) { this.alive = false; return true; } return false; }
  canBeHit(hitInfo = null) { return hitInfo?.sphere?.vulnerable !== false; }
  enterPhase(phase) { this.phase = phase; }
  isComplete() { return !this.alive || this.health <= 0; }
  flashHit(){ this.group.traverse(o=>{ if(o.isMesh && o.material && 'emissiveIntensity' in o.material) o.material.emissiveIntensity = Math.min(1.5,(o.material.emissiveIntensity||0)+0.45); }); }
  getHitSpheres(){ return [{center:this.position.clone(), radius:this.radius}]; }
  getCollisionSpheres(){ return this.getHitSpheres(); }
  destroy(){ this.scene.remove(this.group); disposeObject3D(this.group); }
  _mat(color, opts={}){ return new THREE.MeshStandardMaterial({color, roughness:opts.roughness??0.55, metalness:opts.metalness??0.12, emissive:opts.emissive??0x000000, emissiveIntensity:opts.emissiveIntensity??0, flatShading:!!opts.flatShading}); }
  _addWeakPointRing(offset=new THREE.Vector3(0,0,-2), radius=2.2, color=0xffffaa){ const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false}); this.weakPointRing=new THREE.Mesh(new THREE.TorusGeometry(radius,.08,8,40),mat); this.weakPointRing.position.copy(offset); this.group.add(this.weakPointRing); return this.weakPointRing; }
  _updateWeakPointRing(){ if(!this.weakPointRing)return; const open=this.canBeHit(); this.weakPointRing.visible=open; if(!open)return; const pulse=1+Math.sin(this.t*12)*.08; this.weakPointRing.scale.set(pulse,pulse,pulse); this.weakPointRing.rotation.z+=.08; }
  _facePlayer(player){ if(!player) return; const dx=player.position.x-this.position.x, dy=player.position.y-this.position.y; this.group.rotation.y=Math.atan2(dx,this.position.z-player.position.z)-Math.PI; this.group.rotation.x=-Math.atan2(dy,Math.max(1,this.position.z-player.position.z))*0.35; }
  _fireAt(player, ctx, type='fireball', scale=1, offset=new THREE.Vector3()){ if(!ctx.enemyProjectiles || !player) return; const from=this.position.clone().add(offset); ctx.enemyProjectiles.spawn(type, from, aimedVelocity(from, player.position, type, scale), { lightIntensity: 5 }); }
}
