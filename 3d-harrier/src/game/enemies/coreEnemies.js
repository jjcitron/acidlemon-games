import * as THREE from 'three';
import { EnemyBase } from './baseEnemy.js';
import { aimedVelocity } from '../enemyProjectiles.js';

export class Mukadensu extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, { radius: 1.35, health: 1, scoreValue: 120, fireDelay: 1.0 + Math.random() });
    this.wobbleAmp = 4 + Math.random() * 5;
    this._build();
  }

  _build() {
    const bodyMat = this._material(0x58666d, { metalness: 0.35, roughness: 0.42 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    const wingMat = this._material(0x30405a, { metalness: 0.3, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 10), bodyMat);
    body.scale.set(1.15, 0.65, 1.65);
    this.group.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), eyeMat);
    eye.position.set(0, 0.08, -1.35);
    this.group.add(eye);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 0.8), wingMat);
      wing.position.set(side * 1.05, 0, -0.15);
      wing.rotation.z = side * 0.18;
      this.group.add(wing);
    }
    this._enableShadows();
  }

  update(dt, player, ctx = {}) {
    this.t += dt;
    this.position.z += this.speedZ * dt;
    this.position.x += Math.sin(this.t * 3.1 + this.wobblePhase) * this.wobbleAmp * dt;
    this.position.y += Math.sin(this.t * 2.4 + this.wobblePhase) * 1.2 * dt;
    this.group.position.copy(this.position);
    this.group.rotation.z = Math.sin(this.t * 7) * 0.18;
    this._facePlayer(player);
    this._maybeFire(dt, player, ctx, 'bullet', 1.05);
  }

  _maybeFire(dt, player, ctx, type, speedScale) {
    if (!ctx.enemyProjectiles || !player || this.position.z > -18 || this.position.z < -170) return;
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = 1.6 + Math.random() * 0.8;
    const from = this.position.clone().add(new THREE.Vector3(0, 0, -1.4));
    ctx.enemyProjectiles.spawn(type, from, aimedVelocity(from, player.position, type, speedScale));
  }
}

export class Tomos extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, { radius: 1.8, health: 2, scoreValue: 160, fireDelay: 1.2 });
    this.openAmount = 0;
    this._build();
  }

  _build() {
    const coreMat = this._material(0xcc8844, { emissive: 0x331100, emissiveIntensity: 0.3 });
    const shellMat = this._material(0x8b8f96, { metalness: 0.35, roughness: 0.5 });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), coreMat);
    this.group.add(this.core);
    this.petals = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.38, 1.55), shellMat);
      const a = (i / 4) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0);
      p.rotation.z = a;
      this.group.add(p);
      this.petals.push({ mesh: p, angle: a });
    }
    this._enableShadows();
  }

  canBeHit() {
    return this.openAmount > 0.45;
  }

  update(dt, player, ctx = {}) {
    this.t += dt;
    this.position.z += this.speedZ * dt;
    this.position.x += Math.sin(this.t * 1.5 + this.wobblePhase) * 2.0 * dt;
    this.openAmount = Math.max(0, Math.sin(this.t * 2.1));
    for (const p of this.petals) {
      const spread = 0.35 + this.openAmount * 0.9;
      p.mesh.position.set(Math.cos(p.angle) * (0.85 + this.openAmount * 0.65), Math.sin(p.angle) * (0.85 + this.openAmount * 0.65), 0);
      p.mesh.rotation.x = Math.sin(p.angle) * spread;
      p.mesh.rotation.y = -Math.cos(p.angle) * spread;
      p.mesh.rotation.z = p.angle;
    }
    this.core.scale.setScalar(0.85 + this.openAmount * 0.22);
    this.group.position.copy(this.position);
    this._facePlayer(player);
    if (this.openAmount > 0.7) this._maybeFire(dt, player, ctx);
  }

  _maybeFire(dt, player, ctx) {
    if (!ctx.enemyProjectiles || !player || this.position.z > -18 || this.position.z < -175) return;
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = 1.55 + Math.random() * 0.7;
    const from = this.position.clone().add(new THREE.Vector3(0, 0, -1.6));
    ctx.enemyProjectiles.spawn('fireball', from, aimedVelocity(from, player.position, 'fireball', 0.95));
  }
}

export class Skegg extends EnemyBase {
  constructor(scene, position, variant = 'skegg') {
    super(scene, position, { radius: 1.75, health: 1, scoreValue: variant === 'canary' ? 150 : 130, fireDelay: 1.4 + Math.random() });
    this.variant = variant;
    this._build();
  }

  _build() {
    const bodyColor = this.variant === 'canary' ? 0xd7c44a : 0x4ca35d;
    const bodyMat = this._material(bodyColor, { roughness: 0.6 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xccf0ff, roughness: 0.35, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10), bodyMat);
    body.scale.set(0.9, 1.1, 1.15);
    this.group.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), eyeMat);
    eye.position.set(0, 0.35, -1.05);
    this.group.add(eye);
    this.wings = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.15), wingMat);
      wing.position.set(side * 1.0, 0.15, 0.1);
      this.group.add(wing);
      this.wings.push({ mesh: wing, side });
    }
    this._enableShadows();
  }

  update(dt, player, ctx = {}) {
    this.t += dt;
    this.position.z += this.speedZ * dt;
    this.position.x += Math.sin(this.t * 2.1 + this.wobblePhase) * 4.0 * dt;
    this.position.y += Math.cos(this.t * 2.7 + this.wobblePhase) * 1.5 * dt;
    for (const wing of this.wings) {
      wing.mesh.rotation.y = wing.side * (0.25 + Math.sin(this.t * 16) * 0.55);
      wing.mesh.rotation.z = wing.side * 0.2;
    }
    this.group.position.copy(this.position);
    this._facePlayer(player);
    this._maybeFire(dt, player, ctx);
  }

  _maybeFire(dt, player, ctx) {
    if (!ctx.enemyProjectiles || !player || this.position.z > -18 || this.position.z < -170) return;
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = 1.9 + Math.random() * 0.9;
    const from = this.position.clone().add(new THREE.Vector3(0, 0, -1.2));
    ctx.enemyProjectiles.spawn('fireball', from, aimedVelocity(from, player.position, 'fireball', this.variant === 'canary' ? 1.05 : 0.9));
  }
}

export class Looper extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, { radius: 2.0, health: 1, scoreValue: 90, fireDelay: 999 });
    this._build();
  }

  _build() {
    const stemMat = this._material(0xd2b48c, { roughness: 0.75 });
    const capMat = this._material(0xb34a66, { emissive: 0x22020b, emissiveIntensity: 0.25 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 2.2, 10), stemMat);
    stem.position.y = -0.7;
    this.group.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.65, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), capMat);
    cap.position.y = 0.55;
    cap.scale.y = 0.55;
    this.group.add(cap);
    this._enableShadows();
  }

  update(dt, player, ctx = {}) {
    this.t += dt;
    this.position.z += this.speedZ * dt;
    this.position.x += Math.sin(this.t * 2.9 + this.wobblePhase) * 3.3 * dt;
    this.position.y += Math.sin(this.t * 3.8 + this.wobblePhase) * 2.2 * dt;
    const squash = 1 + Math.sin(this.t * 9) * 0.12;
    this.group.scale.set(1 / squash, squash, 1 / squash);
    this.group.position.copy(this.position);
    this.group.rotation.y += dt * 1.4;
  }
}

export class DomBasic extends EnemyBase {
  constructor(scene, position) {
    super(scene, position, { radius: 2.1, health: 3, scoreValue: 220, fireDelay: 1.0 + Math.random() * 0.6 });
    this._build();
  }

  _build() {
    const armor = this._material(0x4f9c52, { metalness: 0.25, roughness: 0.48 });
    const dark = this._material(0x263328, { metalness: 0.4, roughness: 0.35 });
    const visor = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.4, 1.25), armor);
    this.group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.0, 1.0), armor);
    head.position.y = 1.7;
    this.group.add(head);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.12), visor);
    eye.position.set(0, 1.78, -0.58);
    this.group.add(eye);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.8, 0.55), dark);
      arm.position.set(side * 1.45, 0.05, -0.05);
      this.group.add(arm);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.45, 0.65), dark);
      leg.position.set(side * 0.55, -1.9, 0.05);
      this.group.add(leg);
    }
    this._enableShadows();
  }

  update(dt, player, ctx = {}) {
    this.t += dt;
    this.position.z += this.speedZ * dt;
    this.position.x += Math.sin(this.t * 1.7 + this.wobblePhase) * 2.7 * dt;
    this.position.y += Math.sin(this.t * 2.2 + this.wobblePhase) * 0.8 * dt;
    this.group.position.copy(this.position);
    this.group.rotation.z = Math.sin(this.t * 3) * 0.08;
    this._facePlayer(player);
    this._maybeFire(dt, player, ctx);
  }

  _maybeFire(dt, player, ctx) {
    if (!ctx.enemyProjectiles || !player || this.position.z > -18 || this.position.z < -170) return;
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    this.fireTimer = 1.35 + Math.random() * 0.5;
    const from = this.position.clone().add(new THREE.Vector3(0, 0.35, -1.0));
    ctx.enemyProjectiles.spawn('missile', from, aimedVelocity(from, player.position, 'missile', 0.95), { visualRadius: 0.55, lightIntensity: 4.0 });
  }
}


export class Pakomen extends EnemyBase {
  constructor(scene, position) { super(scene, position, { radius: 2.1, health: 2, scoreValue: 180, fireDelay: 0.9 + Math.random() }); this._build(); }
  _build(){ const hull=this._material(0x8bb0c0,{metalness:.45,roughness:.35}); const rim=this._material(0x38465a,{metalness:.35}); const eye=new THREE.MeshBasicMaterial({color:0xffee66}); const saucer=new THREE.Mesh(new THREE.CylinderGeometry(2.3,1.6,.65,24),hull); saucer.rotation.x=Math.PI/2; this.group.add(saucer); const dome=new THREE.Mesh(new THREE.SphereGeometry(1.0,16,8,0,Math.PI*2,0,Math.PI*.55),rim); dome.position.y=.45; this.group.add(dome); const e=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),eye); e.position.set(0,.35,-1.45); this.group.add(e); this._enableShadows(); }
  update(dt, player, ctx={}){ this.t+=dt; this.position.z+=this.speedZ*dt; this.position.x += Math.sin(this.t*2.8+this.wobblePhase)*5.2*dt; this.position.y += Math.sin(this.t*1.8)*1.1*dt; this.group.position.copy(this.position); this.group.rotation.z += dt*3.5; this._facePlayer(player); this._maybe(dt,player,ctx); }
  _maybe(dt,player,ctx){ if(!ctx.enemyProjectiles||!player||this.position.z>-18||this.position.z<-175)return; this.fireTimer-=dt; if(this.fireTimer>0)return; this.fireTimer=1.25; for(const x of[-.7,.7]) ctx.enemyProjectiles.spawn('bullet',this.position.clone().add(new THREE.Vector3(x,0,-1.6)),aimedVelocity(this.position.clone().add(new THREE.Vector3(x,0,-1.6)),player.position,'bullet',1.0)); }
}

export class FighterJet extends EnemyBase {
  constructor(scene, position) { super(scene, position, { radius: 1.6, health: 1, scoreValue: 220, fireDelay: .65 + Math.random()*.4 }); this.side = Math.sign(position.x||1); this.warnedFast = false; this._build(); }
  _build(){ const mat=this._material(0x9aa7b5,{metalness:.55,roughness:.3}); const hot=new THREE.MeshBasicMaterial({color:0xff8844}); const body=new THREE.Mesh(new THREE.ConeGeometry(.75,3.8,10),mat); body.rotation.x=-Math.PI/2; this.group.add(body); const wing=new THREE.Mesh(new THREE.BoxGeometry(4.2,.15,1.0),mat); wing.position.z=.2; this.group.add(wing); const flame=new THREE.Mesh(new THREE.ConeGeometry(.35,1.0,8),hot); flame.position.z=1.9; flame.rotation.x=Math.PI/2; this.group.add(flame); this._enableShadows(); }
  update(dt,player,ctx={}){ this.t+=dt; this.position.z+=this.speedZ*1.45*dt; this.position.x += -this.side*14*dt + Math.sin(this.t*5)*2*dt; this.position.y += Math.sin(this.t*3)*.8*dt; if(!this.warnedFast && this.position.z>-120 && this.position.z<-18){ this.warnedFast=true; ctx.audio?.playWarning?.('fast'); } this.group.position.copy(this.position); this.group.rotation.z=-this.side*.55; this._maybe(dt,player,ctx); }
  _maybe(dt,player,ctx){ if(!ctx.enemyProjectiles||!player||this.position.z>-20||this.position.z<-160)return; this.fireTimer-=dt; if(this.fireTimer>0)return; this.fireTimer=1.8; const from=this.position.clone().add(new THREE.Vector3(0,0,-1.4)); ctx.enemyProjectiles.spawn('missile',from,aimedVelocity(from,player.position,'missile',1.15),{lightIntensity:4.4}); }
}

export class DroneHeavy extends DomBasic {
  constructor(scene, position){ super(scene, position); this.radius=2.6; this.health=4; this.scoreValue=280; this.group.scale.setScalar(1.18); this.group.traverse(o=>{ if(o.material && o.material.color) o.material.color.offsetHSL(.08,.12,.08); }); }
}
export class DomRed extends DomBasic { constructor(scene, position){ super(scene, position); this.health=2; this.scoreValue=260; this.group.scale.setScalar(.95); this.group.traverse(o=>{ if(o.material && o.material.color) o.material.color.setHex(0xb84a44); }); } }
export class DomBlue extends DomBasic { constructor(scene, position){ super(scene, position); this.health=3; this.scoreValue=260; this.group.traverse(o=>{ if(o.material && o.material.color) o.material.color.setHex(0x3f76c9); }); }
  update(dt,player,ctx={}){ super.update(dt,player,ctx); this.position.y += Math.sin(this.t*5)*2.5*dt; this.group.position.copy(this.position); }
}

export class LowrysPod extends EnemyBase {
  constructor(scene, position){ super(scene, position, {radius:1.65, health:2, scoreValue:190, fireDelay:.8+Math.random()}); this._build(); }
  _build(){ const mat=this._material(0x5b7dff,{emissive:0x111a66,emissiveIntensity:.35}); const pod=new THREE.Mesh(new THREE.CapsuleGeometry(.75,2.2,6,12),mat); pod.rotation.x=Math.PI/2; this.group.add(pod); this._enableShadows(); }
  update(dt,player,ctx={}){ this.t+=dt; this.position.z+=this.speedZ*dt; this.position.x+=Math.sin(this.t*3+this.origin.x)*3.5*dt; this.position.y+=Math.cos(this.t*2.2)*2*dt; this.group.position.copy(this.position); this.group.rotation.z+=dt*2; this._facePlayer(player); this._maybe(dt,player,ctx); }
  _maybe(dt,player,ctx){ if(!ctx.enemyProjectiles||!player||this.position.z>-18||this.position.z<-170)return; this.fireTimer-=dt; if(this.fireTimer>0)return; this.fireTimer=1.45; const from=this.position.clone().add(new THREE.Vector3(0,0,-1)); ctx.enemyProjectiles.spawn('bullet',from,aimedVelocity(from,player.position,'bullet',1.1)); }
}

export class TetraPanel extends EnemyBase {
  constructor(scene, position){ super(scene, position, {radius:1.9, health:2, scoreValue:210, fireDelay:1.0}); this.openAmount=0; this._build(); }
  _build(){ const mat=this._material(0x66e6ff,{emissive:0x004466,emissiveIntensity:.42,metalness:.25,flatShading:true}); this.panel=new THREE.Mesh(new THREE.TetrahedronGeometry(1.9),mat); this.group.add(this.panel); this._enableShadows(); }
  canBeHit(){ return this.openAmount > .25; }
  update(dt,player,ctx={}){ this.t+=dt; this.position.z+=this.speedZ*dt; this.position.x+=Math.sin(this.t*2.4)*4.2*dt; this.openAmount=(Math.sin(this.t*2)+1)/2; this.group.scale.setScalar(.75+this.openAmount*.45); this.group.position.copy(this.position); this.panel.rotation.x+=dt*3; this.panel.rotation.y+=dt*4; if(this.openAmount>.65) this._maybe(dt,player,ctx); }
  _maybe(dt,player,ctx){ if(!ctx.enemyProjectiles||!player||this.position.z>-18||this.position.z<-165)return; this.fireTimer-=dt; if(this.fireTimer>0)return; this.fireTimer=1.2; const from=this.position.clone(); ctx.enemyProjectiles.spawn('fireball',from,aimedVelocity(from,player.position,'fireball',.9)); }
}

export class OctopusPod extends EnemyBase {
  constructor(scene, position){ super(scene, position, {radius:2.0, health:2, scoreValue:230, fireDelay:.7+Math.random()}); this._build(); }
  _build(){ const body=this._material(0xa0459d,{emissive:0x330033,emissiveIntensity:.3}); const head=new THREE.Mesh(new THREE.SphereGeometry(1.25,14,10),body); head.scale.y=1.25; this.group.add(head); for(let i=0;i<6;i++){const a=i/6*Math.PI*2; const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.22,2.1,6),body); leg.position.set(Math.cos(a)*.8,-1.1,Math.sin(a)*.8); leg.rotation.z=Math.cos(a)*.6; leg.rotation.x=Math.sin(a)*.6; this.group.add(leg);} this._enableShadows(); }
  update(dt,player,ctx={}){ this.t+=dt; this.position.z+=this.speedZ*dt; this.position.y+=Math.sin(this.t*3)*1.8*dt; this.position.x+=Math.sin(this.t*1.6+this.wobblePhase)*2.4*dt; this.group.position.copy(this.position); this.group.rotation.y+=dt*1.8; this._facePlayer(player); this._maybe(dt,player,ctx); }
  _maybe(dt,player,ctx){ if(!ctx.enemyProjectiles||!player||this.position.z>-18||this.position.z<-170)return; this.fireTimer-=dt; if(this.fireTimer>0)return; this.fireTimer=1.1; for(const x of[-.8,.8]){ const from=this.position.clone().add(new THREE.Vector3(x,0,-1)); ctx.enemyProjectiles.spawn('bullet',from,aimedVelocity(from,player.position,'bullet',1.05)); } }
}

export class LaneDiver extends EnemyBase {
  constructor(scene, position){ super(scene, position, {radius:1.55, health:1, scoreValue:240, fireDelay:999}); this.side=Math.sign(position.x||1); this.warnedFast=false; this._build(); }
  _build(){ const mat=this._material(0xffcc55,{emissive:0x442200,emissiveIntensity:.35,metalness:.25,flatShading:true}); const core=new THREE.Mesh(new THREE.ConeGeometry(1.05,3.2,5),mat); core.rotation.x=-Math.PI/2; this.group.add(core); for(const side of[-1,1]){const fin=new THREE.Mesh(new THREE.BoxGeometry(1.7,.18,.7),mat); fin.position.set(side*.95,0,.55); fin.rotation.z=side*.35; this.group.add(fin);} this._enableShadows(); }
  update(dt,player,ctx={}){ this.t+=dt; this.position.z+=this.speedZ*1.65*dt; this.position.x+=-this.side*(18+ctx.difficulty*12)*dt; this.position.y+=Math.sin(this.t*5)*1.2*dt; if(!this.warnedFast && this.position.z>-125 && this.position.z<-18){ this.warnedFast=true; ctx.audio?.playWarning?.('fast'); } this.group.position.copy(this.position); this.group.rotation.z=-this.side*.75; this._facePlayer(player); }
}

export class ShieldCarrier extends EnemyBase {
  constructor(scene, position){ super(scene, position, {radius:2.4, health:4, scoreValue:360, fireDelay:1.0+Math.random()*.4}); this.openAmount=0; this._build(); }
  _build(){ const body=this._material(0x8f78d8,{emissive:0x170044,emissiveIntensity:.25,metalness:.35}); const shield=new THREE.MeshBasicMaterial({color:0x9fffea,transparent:true,opacity:.62,wireframe:true}); const core=new THREE.Mesh(new THREE.OctahedronGeometry(1.45,1),body); this.group.add(core); this.core=core; this.ring=new THREE.Mesh(new THREE.TorusGeometry(2.25,.16,8,36),shield); this.ring.rotation.x=Math.PI/2; this.group.add(this.ring); this._enableShadows(); }
  canBeHit(){ return this.openAmount>.42; }
  update(dt,player,ctx={}){ this.t+=dt; this.position.z+=this.speedZ*.85*dt; this.position.x+=Math.sin(this.t*1.8+this.wobblePhase)*2.4*dt; this.position.y+=Math.cos(this.t*2.4)*1.3*dt; this.openAmount=(Math.sin(this.t*2.3)+1)/2; this.ring.scale.setScalar(1.0+this.openAmount*.35); this.ring.rotation.z+=dt*(2.4+this.openAmount*2); this.ring.material.opacity=.25+this.openAmount*.55; this.group.position.copy(this.position); this._facePlayer(player); if(this.openAmount>.68) this._maybe(dt,player,ctx); }
  _maybe(dt,player,ctx){ if(!ctx.enemyProjectiles||!player||this.position.z>-18||this.position.z<-165)return; this.fireTimer-=dt; if(this.fireTimer>0)return; this.fireTimer=1.15; const from=this.position.clone().add(new THREE.Vector3(0,0,-1.4)); ctx.enemyProjectiles.spawn('fireball',from,aimedVelocity(from,player.position,'fireball',.95),{lightIntensity:4.6}); }
}

export class MineLayer extends EnemyBase {
  constructor(scene, position){ super(scene, position, {radius:1.8, health:2, scoreValue:260, fireDelay:.85+Math.random()*.5}); this._build(); }
  _build(){ const mat=this._material(0x2bd0a8,{emissive:0x004433,emissiveIntensity:.5,metalness:.25}); const body=new THREE.Mesh(new THREE.IcosahedronGeometry(1.45,0),mat); this.group.add(body); for(let i=0;i<4;i++){const spike=new THREE.Mesh(new THREE.ConeGeometry(.18,.9,6),mat); const a=i*Math.PI/2; spike.position.set(Math.cos(a)*1.2,Math.sin(a)*1.2,0); spike.rotation.z=a-Math.PI/2; this.group.add(spike);} this._enableShadows(); }
  update(dt,player,ctx={}){ this.t+=dt; this.position.z+=this.speedZ*.95*dt; this.position.x+=Math.sin(this.t*2.5+this.wobblePhase)*4.8*dt; this.group.position.copy(this.position); this.group.rotation.x+=dt*1.8; this.group.rotation.y+=dt*2.2; this._maybe(dt,player,ctx); }
  _maybe(dt,player,ctx){ if(!ctx.enemyProjectiles||this.position.z>-28||this.position.z<-175)return; this.fireTimer-=dt; if(this.fireTimer>0)return; this.fireTimer=1.35; const from=this.position.clone().add(new THREE.Vector3(0,0,1.4)); ctx.enemyProjectiles.spawn('missile',from,new THREE.Vector3(0,0,25),{visualRadius:.72,damageRadius:1.25,lightIntensity:3.8,maxLife:3.2}); }
}

export class Splitter extends EnemyBase {
  constructor(scene, position){ super(scene, position, {radius:2.15, health:2, scoreValue:320, fireDelay:1.2}); this.split=false; this._build(); }
  _build(){ const mat=this._material(0xd85a8a,{emissive:0x440018,emissiveIntensity:.32,flatShading:true}); for(const x of[-.8,.8]){ const pod=new THREE.Mesh(new THREE.SphereGeometry(1.05,12,8),mat); pod.position.x=x; this.group.add(pod); } this._enableShadows(); }
  update(dt,player,ctx={}){ this.t+=dt; this.position.z+=this.speedZ*dt; this.position.x+=Math.sin(this.t*2.0)*2.6*dt; this.position.y+=Math.sin(this.t*3.0)*1.2*dt; this.group.position.copy(this.position); this.group.rotation.z=Math.sin(this.t*5)*.22; this._facePlayer(player); }
  hit(damage=1){ return super.hit(damage); }
  spawnOnDeath(){ if(this.split) return []; this.split=true; return [-1,1].map(side=>{ const child=new LaneDiver(this.scene,this.position.clone().add(new THREE.Vector3(side*2,0,-3))); child.speedZ=this.speedZ*1.15; return child; }); }
}

export class SniperDrone extends EnemyBase {
  constructor(scene, position){ super(scene, position, {radius:1.7, health:2, scoreValue:340, fireDelay:1.25+Math.random()*.6}); this.charge=0; this._build(); }
  _build(){ const hull=this._material(0xb8d8ff,{metalness:.5,roughness:.28}); const eye=new THREE.MeshBasicMaterial({color:0xff3344}); const body=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.35,1.5,8),hull); body.rotation.x=Math.PI/2; this.group.add(body); this.eye=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8),eye); this.eye.position.z=-1.0; this.group.add(this.eye); this._enableShadows(); }
  update(dt,player,ctx={}){ this.t+=dt; this.position.z+=this.speedZ*.72*dt; this.position.x+=Math.sin(this.t*1.2+this.wobblePhase)*1.5*dt; this.position.y+=Math.cos(this.t*1.4)*1.0*dt; this.group.position.copy(this.position); this._facePlayer(player); this._maybe(dt,player,ctx); }
  _maybe(dt,player,ctx){ if(!ctx.enemyProjectiles||!player||this.position.z>-20||this.position.z<-155)return; this.fireTimer-=dt; this.charge=Math.max(0,1-this.fireTimer); this.eye.scale.setScalar(1+Math.max(0,this.charge)*.9); if(this.fireTimer>0)return; this.fireTimer=1.75; const from=this.position.clone().add(new THREE.Vector3(0,0,-1.4)); ctx.enemyProjectiles.spawn('bullet',from,aimedVelocity(from,player.position,'bullet',1.45),{visualRadius:.42,damageRadius:.95,lightIntensity:6}); }
}
