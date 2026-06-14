import * as THREE from 'three';
import { raycastEnemies, raycastEnemiesAll } from './entities.js';

const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const _armStart = new THREE.Vector3();
const _armMid = new THREE.Vector3();
const _armEnd = new THREE.Vector3();
const _armDir = new THREE.Vector3();
const _headAimStart = new THREE.Vector3();
const _headAimEnd = new THREE.Vector3();
const _weaponAimStart = new THREE.Vector3();
const _weaponAimEnd = new THREE.Vector3();
const _aimDirLocal = new THREE.Vector3();
const _aimQuat = new THREE.Quaternion();
const _aimEuler = new THREE.Euler();
const _worldPoint = new THREE.Vector3();

export const WEAPON = {
  SINGLE:    'single',
  MULTISHOT: 'multishot',
  LASER:     'laser'
};

// The flying figure — a stand-in built from primitives.
// Holds its weapon out in the -z direction; faces into the scene.

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.position = new THREE.Vector3(0, 0, -8);
    this.velocity = new THREE.Vector3();
    this.alive = true;
    this.invuln = 0;
    this.fireCooldown = 0;

    // Weapon + bomb state
    this.weapon = WEAPON.SINGLE;
    this.weaponTimer = 0;
    this.weaponMaxTimer = 0;
    this.bombs = 2;
    this.maxBombs = 3;
    this.speedBoostTimer = 0;
    this.speedBoostMaxTimer = 0;
    this.speedBoostMultiplier = 1;

    // Movement clamp (game units)
    this.bounds = { xMin: -22, xMax: 22, yMin: -8, yMax: 12 };
    this.maxSpeed = 32;
    this.damping = 9;

    this.group = new THREE.Group();
    this._build();
    scene.add(this.group);
  }

  _build() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xeeddbb, roughness: 0.58 });
    const suit = new THREE.MeshStandardMaterial({ color: 0x2266dd, roughness: 0.42, metalness: 0.2 });
    const suitDark = new THREE.MeshStandardMaterial({ color: 0x1648aa, roughness: 0.46, metalness: 0.18 });
    const belt = new THREE.MeshStandardMaterial({ color: 0xddaa33, roughness: 0.3, metalness: 0.7 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0xddaa33, roughness: 0.4, metalness: 0.6 });
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x102a66, roughness: 0.36, metalness: 0.28 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.25, metalness: 0.9 });
    const gunGlow = new THREE.MeshStandardMaterial({ color: 0xff4422, emissive: 0xff2200, emissiveIntensity: 1.0 });
    const aimArmMat = new THREE.MeshBasicMaterial({ color: 0x66d9ff });
    const aimJointMat = new THREE.MeshBasicMaterial({ color: 0x9fefff });
    const headAimMat = new THREE.MeshBasicMaterial({ color: 0xffdd55 });

    const scale = 1.2;
    const limbMat = suit;
    const makeJoint = (radius) => new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 12, 8), jointMat);
    const makeSegment = (radius, length, mat = limbMat, radial = 10) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius * scale, length * scale, 4, radial), mat);
      mesh.rotation.x = Math.PI / 2; // local -Z limb direction for arms/weapon reach
      mesh.position.z = -length * scale * 0.5;
      return mesh;
    };
    const makeVerticalSegment = (radius, length, mat = limbMat, radial = 10) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * scale, radius * scale, length * scale, radial), mat);
      mesh.position.y = -length * scale * 0.5;
      return mesh;
    };
    const makeTrapezoidPrism = (topWidth, bottomWidth, height, depth, mat) => {
      const tw = topWidth * scale * 0.5;
      const bw = bottomWidth * scale * 0.5;
      const h = height * scale * 0.5;
      const d = depth * scale * 0.5;
      const vertices = new Float32Array([
        -tw, h, -d,  tw, h, -d,  bw,-h, -d, -bw,-h, -d, // front, upside-down trapezoid
        -tw, h,  d, -bw,-h,  d,  bw,-h,  d,  tw, h,  d, // back
        -tw, h,  d, -tw, h, -d, -bw,-h, -d, -bw,-h,  d, // left side
         tw, h, -d,  tw, h,  d,  bw,-h,  d,  bw,-h, -d, // right side
        -tw, h,  d,  tw, h,  d,  tw, h, -d, -tw, h, -d, // top shoulder edge
        -bw,-h, -d,  bw,-h, -d,  bw,-h,  d, -bw,-h,  d  // bottom waist edge
      ]);
      const indices = [];
      for (let i = 0; i < 6; i++) {
        const o = i * 4;
        indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, mat);
    };

    // Anatomical torso stack: neck, chest/ribcage, stomach/lower back, hips.
    // Each major part has its own transform so movement is readable instead
    // of the whole hero acting like one cylinder.
    this.hipsGroup = new THREE.Group();
    this.hipsGroup.position.set(0, 0.05 * scale, 0.02 * scale);
    this.hips = new THREE.Mesh(new THREE.SphereGeometry(0.58 * scale, 16, 10), suitDark);
    this.hips.scale.set(1.18, 0.55, 0.78);
    this.hipsGroup.add(this.hips);
    this.group.add(this.hipsGroup);

    this.stomachGroup = new THREE.Group();
    this.stomachGroup.position.set(0, 0.72 * scale, 0);
    this.stomach = new THREE.Mesh(new THREE.CylinderGeometry(0.36 * scale, 0.42 * scale, 0.86 * scale, 16), suitDark);
    this.stomach.scale.set(1.0, 1.0, 0.72);
    this.stomachGroup.add(this.stomach);
    this.lowerBack = new THREE.Mesh(new THREE.CylinderGeometry(0.20 * scale, 0.23 * scale, 0.78 * scale, 12), jointMat);
    this.lowerBack.position.set(0, 0.02 * scale, 0.34 * scale);
    this.lowerBack.scale.set(0.95, 1.0, 0.7);
    this.stomachGroup.add(this.lowerBack);
    this.group.add(this.stomachGroup);

    this.chestGroup = new THREE.Group();
    this.chestGroup.position.set(0, 1.38 * scale, -0.02 * scale);
    this.chest = makeTrapezoidPrism(1.42, 0.76, 0.92, 0.82, suit);
    this.chest.position.y = 0.02 * scale;
    this.chestGroup.add(this.chest);
    const chestPlate = makeTrapezoidPrism(0.92, 0.48, 0.46, 0.08, belt);
    chestPlate.position.set(0, 0.08 * scale, -0.45 * scale);
    chestPlate.rotation.x = -0.08;
    this.chestGroup.add(chestPlate);
    this.group.add(this.chestGroup);

    this.neckGroup = new THREE.Group();
    this.neckGroup.position.set(0, 1.96 * scale, -0.01 * scale);
    this.neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.18 * scale, 0.30 * scale, 4, 10), skin);
    this.neck.scale.set(0.9, 1.05, 0.9);
    this.neckGroup.add(this.neck);
    this.group.add(this.neckGroup);

    this.headGroup = new THREE.Group();
    this.headGroup.position.y = 2.28 * scale;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.48 * scale, 18, 14), skin);
    head.scale.set(0.95, 1.08, 0.86);
    this.headGroup.add(head);
    const faceGuard = new THREE.Mesh(new THREE.BoxGeometry(0.72 * scale, 0.16 * scale, 0.12 * scale), new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.8, roughness: 0.15 }));
    faceGuard.position.set(0, 0.07 * scale, -0.40 * scale);
    this.headGroup.add(faceGuard);
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.44 * scale, 0.08 * scale, 6, 24), new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.8, roughness: 0.15 }));
    visor.position.y = 0.05 * scale;
    visor.rotation.x = Math.PI / 2;
    visor.scale.z = 0.72;
    this.headGroup.add(visor);
    this.headAimFin = new THREE.Mesh(new THREE.ConeGeometry(0.16 * scale, 0.56 * scale, 4), headAimMat);
    this.headAimFin.position.set(0, 0.16 * scale, 0.43 * scale);
    this.headAimFin.rotation.x = Math.PI / 2;
    this.headAimFin.rotation.z = Math.PI / 4;
    this.headGroup.add(this.headAimFin);
    this.headAimRod = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * scale, 0.055 * scale, 1, 10), headAimMat);
    this.group.add(this.headAimRod);
    this.group.add(this.headGroup);

    this.beltMesh = new THREE.Mesh(new THREE.TorusGeometry(0.62 * scale, 0.09 * scale, 8, 28), belt);
    this.beltMesh.position.y = 0.32 * scale;
    this.beltMesh.rotation.x = Math.PI / 2;
    this.group.add(this.beltMesh);

    // Arms: shoulder -> upper arm -> elbow -> forearm -> hand. These are
    // separate nested pivots so aiming and banking can articulate visibly.
    this.arms = [];
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.82 * scale, 1.78 * scale, -0.30 * scale);
      shoulder.add(makeJoint(0.19));

      const upper = new THREE.Group();
      upper.position.set(0, 0, 0);
      const upperMesh = makeSegment(0.15, 0.72, limbMat, 12);
      upper.add(upperMesh);
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.set(side * 0.10 * scale, -0.02 * scale, -0.72 * scale);
      elbow.add(makeJoint(0.15));
      const foreMesh = makeSegment(0.13, 0.64, limbMat, 12);
      elbow.add(foreMesh);
      upper.add(elbow);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 12, 8), skin);
      hand.scale.set(1.0, 0.75, 1.25);
      hand.position.set(0, 0, -0.66 * scale);
      elbow.add(hand);

      shoulder.rotation.set(-Math.PI / 2.35, side * 0.28, side * 0.18);
      elbow.rotation.x = -0.20;
      shoulder.visible = false; // replaced by the explicit aim-driven visible arm rig below
      this.group.add(shoulder);
      this.arms.push({ shoulder, upper, elbow, hand, side });
    }

    // Direct visible arm rig: these cylinders are endpoint-driven every frame.
    // This avoids tiny hidden pivot rotations and makes both arms visibly follow
    // the aim direction from the trapezoid shoulder corners to the weapon grip.
    this.aimArms = [];
    const makeAimLimb = (radius, mat = aimArmMat) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * scale, radius * scale, 1, 12), mat);
      mesh.castShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.20 * scale, 14, 10), aimJointMat);
      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 14, 10), aimJointMat);
      const handJoint = new THREE.Mesh(new THREE.SphereGeometry(0.17 * scale, 14, 10), aimJointMat);
      shoulderJoint.castShadow = elbowJoint.castShadow = handJoint.castShadow = true;
      const upperMesh = makeAimLimb(0.24);
      const foreMesh = makeAimLimb(0.21);
      this.group.add(shoulderJoint, elbowJoint, handJoint);
      this.aimArms.push({ side, shoulderJoint, elbowJoint, handJoint, upperMesh, foreMesh });
    }

    // Weapon group sits between the articulated hands, not as the body.
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(0, 1.34 * scale, -1.08 * scale);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.24 * scale, 1.05 * scale), gunMat);
    gun.position.set(0, 0, -0.42 * scale);
    this.weaponGroup.add(gun);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.085 * scale, 0.085 * scale, 0.72 * scale, 12), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -1.02 * scale);
    this.weaponGroup.add(barrel);
    this.muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16 * scale, 12, 8), gunGlow);
    this.muzzle.position.set(0, 0, -1.42 * scale);
    this.muzzle.visible = false;
    this.weaponGroup.add(this.muzzle);
    this.weaponAimGuide = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * scale, 0.055 * scale, 1, 10), headAimMat);
    this.group.add(this.weaponAimGuide);
    this.group.add(this.weaponGroup);

    // Legs: hip -> upper leg -> knee -> lower leg -> foot. Bigger feet make
    // ground-skimming run cycles readable from the behind-camera view.
    this.legs = [];
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const hip = new THREE.Group();
      hip.position.set(side * 0.38 * scale, 0.00 * scale, 0.02 * scale);
      hip.add(makeJoint(0.18));

      const thigh = new THREE.Group();
      const thighMesh = makeVerticalSegment(0.18, 0.78, suitDark, 10);
      thigh.add(thighMesh);
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.78 * scale, -0.03 * scale);
      knee.add(makeJoint(0.15));
      const calfMesh = makeVerticalSegment(0.15, 0.68, limbMat, 10);
      knee.add(calfMesh);
      thigh.add(knee);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.18 * scale, 0.58 * scale), bootMat);
      foot.position.set(0, -0.76 * scale, -0.16 * scale);
      foot.rotation.x = 0.20;
      knee.add(foot);

      hip.rotation.x = 0.10;
      hip.rotation.z = side * 0.035;
      knee.rotation.x = 0.18;
      this.group.add(hip);
      this.legs.push({ hip, thigh, knee, foot, side });
    }

    // Neck-attached jetpack: mounted high between the shoulders so it reads
    // as strapped to the neck/back instead of floating on the lower torso.
    this.jetpackGroup = new THREE.Group();
    this.jetpackGroup.position.set(0, 1.86 * scale, 0.48 * scale);
    const pack = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.28 * scale, 0.78 * scale, 16), gunMat);
    pack.rotation.z = Math.PI / 2;
    pack.scale.set(0.85, 1.42, 0.82);
    pack.position.set(0, -0.16 * scale, 0);
    this.jetpackGroup.add(pack);
    const neckClamp = new THREE.Mesh(new THREE.TorusGeometry(0.30 * scale, 0.045 * scale, 8, 20), belt);
    neckClamp.rotation.x = Math.PI / 2;
    neckClamp.position.set(0, 0.14 * scale, -0.16 * scale);
    this.jetpackGroup.add(neckClamp);
    const spineGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * scale, 0.035 * scale, 0.82 * scale, 8), belt);
    spineGlow.position.set(0, -0.40 * scale, -0.16 * scale);
    this.jetpackGroup.add(spineGlow);
    this.group.add(this.jetpackGroup);

    this.jetpackLight = new THREE.PointLight(0x6699ff, 3.0, 22, 1.6);
    this.jetpackLight.position.set(0, 0.42 * scale, 0.62 * scale);
    this.group.add(this.jetpackLight);

    const exhaustGeo = new THREE.ConeGeometry(0.30 * scale, 1.65 * scale, 12);
    const exhaustMat = new THREE.MeshBasicMaterial({
      color: 0x9ccaff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.exhaustL = new THREE.Mesh(exhaustGeo, exhaustMat);
    this.exhaustL.position.set(-0.26 * scale, 0.22 * scale, 0.64 * scale);
    this.exhaustL.rotation.x = Math.PI;
    this.group.add(this.exhaustL);
    this.exhaustR = new THREE.Mesh(exhaustGeo, exhaustMat.clone());
    this.exhaustR.position.set(0.26 * scale, 0.22 * scale, 0.64 * scale);
    this.exhaustR.rotation.x = Math.PI;
    this.group.add(this.exhaustR);

    this.group.traverse(o => {
      if (o.isMesh) o.castShadow = true;
    });

    this.muzzleLight = new THREE.PointLight(0xffb466, 0, 28, 1.8);
    this.scene.add(this.muzzleLight);

    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(2.6 * scale, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0x7df7ff,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        wireframe: true
      })
    );
    this.shield.visible = false;
    this.group.add(this.shield);
  }

  getMuzzleWorldPos(out = new THREE.Vector3()) {
    if (this.muzzle) return this.muzzle.getWorldPosition(out);
    out.copy(this.position);
    out.y += 1.5;
    out.z -= 2.8;
    return out;
  }

  setWeapon(name, duration) {
    this.weapon = name;
    this.weaponTimer = duration;
    this.weaponMaxTimer = duration;
  }

  addBomb() {
    this.bombs = Math.min(this.maxBombs, this.bombs + 1);
    return this.bombs;
  }

  activateSpeedBoost(duration = 10, multiplier = 1.55) {
    this.speedBoostTimer = duration;
    this.speedBoostMaxTimer = duration;
    this.speedBoostMultiplier = multiplier;
  }

  activateInvincibility(duration = 10) {
    this.invuln = Math.max(this.invuln, duration);
  }

  consumeBomb() {
    if (this.bombs <= 0) return false;
    this.bombs--;
    return true;
  }

  update(dt, input, projectiles, audio, enemies, onEnemyKilled) {
    if (!this.alive) {
      this.group.position.copy(this.position);
      return;
    }

    // Weapon timer
    if (this.weapon !== WEAPON.SINGLE) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) {
        this.weapon = WEAPON.SINGLE;
        this.weaponTimer = 0;
      }
    }
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);
      if (this.speedBoostTimer <= 0) this.speedBoostMultiplier = 1;
    }

    // Movement: lerp velocity toward target, integrate
    const currentMaxSpeed = this.maxSpeed * (this.speedBoostTimer > 0 ? this.speedBoostMultiplier : 1);
    const targetVx = input.move.x * currentMaxSpeed;
    const targetVy = input.move.y * currentMaxSpeed;
    const k = Math.min(1, this.damping * dt);
    this.velocity.x += (targetVx - this.velocity.x) * k;
    this.velocity.y += (targetVy - this.velocity.y) * k;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    if (this.position.x < this.bounds.xMin) { this.position.x = this.bounds.xMin; this.velocity.x = 0; }
    if (this.position.x > this.bounds.xMax) { this.position.x = this.bounds.xMax; this.velocity.x = 0; }
    if (this.position.y < this.bounds.yMin) { this.position.y = this.bounds.yMin; this.velocity.y = 0; }
    if (this.position.y > this.bounds.yMax) { this.position.y = this.bounds.yMax; this.velocity.y = 0; }

    const nowS = performance.now() * 0.001;
    const accelRatio = currentMaxSpeed > 0 ? Math.min(1, Math.hypot(this.velocity.x, this.velocity.y) / currentMaxSpeed) : 0;
    const runCycle = Math.sin(nowS * (10 + accelRatio * 8));
    const strafeLean = THREE.MathUtils.clamp(-this.velocity.x * 0.032, -0.85, 0.85);
    const climbLean = THREE.MathUtils.clamp(this.velocity.y * 0.018, -0.42, 0.42);
    const strideLean = runCycle * accelRatio * 0.09;

    // Lean visuals — stronger side-to-side banking with a little shoulder
    // counter-motion so dodging left/right reads as body movement, not just
    // a sliding primitive.
    this.group.rotation.z = strafeLean + strideLean + (this.turnLean || 0);
    this.group.rotation.x = climbLean - accelRatio * 0.05;
    if (this.chestGroup) {
      this.chestGroup.rotation.z = -strafeLean * 0.24;
      this.chestGroup.rotation.x = accelRatio * 0.08 + climbLean * 0.18;
      this.chestGroup.rotation.y = strafeLean * 0.08;
    }
    if (this.stomachGroup) {
      this.stomachGroup.rotation.z = -strafeLean * 0.16;
      this.stomachGroup.rotation.x = -accelRatio * 0.05;
    }
    if (this.hipsGroup) {
      this.hipsGroup.rotation.z = strafeLean * 0.18 - strideLean * 0.45;
      this.hipsGroup.rotation.y = -strafeLean * 0.06;
    }
    if (this.neckGroup) {
      this.neckGroup.rotation.z = -strafeLean * 0.08;
      this.neckGroup.rotation.x = climbLean * 0.12;
    }
    if (this.jetpackGroup) {
      this.jetpackGroup.rotation.z = -strafeLean * 0.10;
      this.jetpackGroup.rotation.x = climbLean * 0.08 - accelRatio * 0.03;
    }
    if (this.beltMesh) {
      this.beltMesh.rotation.z = -strafeLean * 0.22;
    }

    // Bob
    this.group.position.copy(this.position);
    this.group.position.y += Math.sin(nowS * 5.0) * (0.12 + accelRatio * 0.12);
    this._updateAimPose(dt, input, accelRatio, strafeLean, runCycle);
    this.group.updateMatrixWorld(true);

    // Running animation — when the player skims the ground, swing the legs
    // about the hip pivot at a fast run cadence. In the air, lerp legs back
    // to the neutral flying pose.
    const grounded = this.position.y < -5;
    const legEase = Math.min(1, dt * 8);
    for (const leg of this.legs) {
      const phase = leg.side > 0 ? Math.PI : 0;
      const swing = Math.sin(nowS * 12 + phase) * (grounded ? 0.82 : 0.20 * accelRatio);
      const kneeBend = grounded ? 0.36 + Math.max(0, -Math.sin(nowS * 12 + phase)) * 0.58 : 0.18 + accelRatio * 0.12;
      const hipTarget = grounded ? swing : -0.12 + accelRatio * 0.18;
      leg.hip.rotation.x += (hipTarget - leg.hip.rotation.x) * legEase;
      leg.hip.rotation.z += ((-strafeLean * 0.18 + leg.side * 0.03) - leg.hip.rotation.z) * legEase;
      leg.knee.rotation.x += (kneeBend - leg.knee.rotation.x) * legEase;
      leg.foot.rotation.x += ((grounded ? -swing * 0.35 : 0.18) - leg.foot.rotation.x) * legEase;
    }

    // Jetpack flicker — bigger/brighter under movement and angled opposite
    // the dodge vector, so strafing/up-down thrust visibly pushes the hero.
    const accelMag = accelRatio;
    const flameLen  = 0.90 + accelMag * 0.85 + (Math.sin(nowS * 33) * 0.08) + Math.random() * 0.08;
    const flameOpac = 0.58 + accelMag * 0.32 + Math.random() * 0.10;
    const jetSkewX = currentMaxSpeed > 0 ? THREE.MathUtils.clamp(this.velocity.x / currentMaxSpeed, -1, 1) * 0.42 : 0;
    const jetSkewY = currentMaxSpeed > 0 ? THREE.MathUtils.clamp(this.velocity.y / currentMaxSpeed, -1, 1) * 0.22 : 0;
    this.exhaustL.scale.y = flameLen * (1 + Math.max(0, -jetSkewX) * 0.22);
    this.exhaustR.scale.y = flameLen * (1 + Math.max(0, jetSkewX) * 0.22);
    this.exhaustL.rotation.z = -jetSkewX - 0.08 * runCycle;
    this.exhaustR.rotation.z = -jetSkewX - 0.08 * runCycle;
    this.exhaustL.rotation.x = Math.PI + jetSkewY;
    this.exhaustR.rotation.x = Math.PI + jetSkewY;
    this.exhaustL.material.opacity = flameOpac;
    this.exhaustR.material.opacity = flameOpac;
    this.jetpackLight.intensity = 2.8 + accelMag * 3.1 + Math.sin(nowS * 30) * 0.45;

    // Fire — hitscan
    this.fireCooldown -= dt;
    this.muzzle.visible = false;
    if (this.muzzleLight) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 28);
    }
    if (input.fire && this.fireCooldown <= 0 && input.aimRayOrigin && input.aimRayDir) {
      this._fire(projectiles, input.aimRayOrigin, input.aimRayDir, enemies, audio, onEnemyKilled);
      this.fireCooldown = this._cooldownForWeapon();
    }

    // Invuln flash
    if (this.invuln > 0) {
      this.invuln -= dt;
      const tokenShield = this.invuln > 2.0;
      this.group.visible = tokenShield || (Math.floor(performance.now() / 60) % 2) === 0;
      if (this.shield) {
        this.shield.visible = tokenShield;
        this.shield.rotation.x += dt * 1.4;
        this.shield.rotation.y -= dt * 1.9;
        this.shield.material.opacity = 0.18 + Math.sin(nowS * 9) * 0.07;
      }
    } else {
      this.group.visible = true;
      if (this.shield) this.shield.visible = false;
    }
  }

  _placeLimbCylinder(mesh, start, end) {
    _armDir.copy(end).sub(start);
    const len = _armDir.length();
    if (len <= 0.0001) return;
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(UP, _armDir.multiplyScalar(1 / len));
  }

  _updateAimPose(dt, input, accelRatio, strafeLean, runCycle) {
    const ease = Math.min(1, dt * 9);
    _aimDirLocal.set(0, 0, -1);
    if (input?.aimWorld && this.weaponGroup) {
      _worldPoint.copy(input.aimWorld);
      this.group.worldToLocal(_worldPoint);
      _aimDirLocal.copy(_worldPoint).sub(this.weaponGroup.position).normalize();
      if (!_aimDirLocal.lengthSq()) _aimDirLocal.set(0, 0, -1);
    }

    // Limit the animation target so the weapon stays readable and never
    // twists through the torso at extreme mouse positions.
    _aimDirLocal.x = THREE.MathUtils.clamp(_aimDirLocal.x, -0.48, 0.48);
    _aimDirLocal.y = THREE.MathUtils.clamp(_aimDirLocal.y, -0.34, 0.38);
    _aimDirLocal.z = Math.min(-0.35, _aimDirLocal.z);
    _aimDirLocal.normalize();

    _aimQuat.setFromUnitVectors(FORWARD, _aimDirLocal);
    _aimEuler.setFromQuaternion(_aimQuat, 'YXZ');
    const screenAimX = THREE.MathUtils.clamp(input?.aimScreen?.x ?? _aimDirLocal.x * 1.7, -1, 1);
    const screenAimY = THREE.MathUtils.clamp(input?.aimScreen?.y ?? _aimDirLocal.y * 2.1, -1, 1);
    const aimYaw = THREE.MathUtils.clamp(_aimEuler.y, -0.58, 0.58);
    const aimPitch = THREE.MathUtils.clamp(_aimEuler.x, -0.42, 0.42);
    const visualYaw = THREE.MathUtils.clamp(screenAimX * 0.95, -0.95, 0.95);
    const visualPitch = THREE.MathUtils.clamp(screenAimY * 0.70, -0.70, 0.70);

    if (this.weaponGroup) {
      this.weaponGroup.position.x += ((screenAimX * 1.10) - this.weaponGroup.position.x) * ease;
      this.weaponGroup.position.y += ((1.30 + screenAimY * 0.88) * 1.2 - this.weaponGroup.position.y) * ease;
      this.weaponGroup.position.z += ((0.34 - Math.abs(screenAimX) * 0.05) * 1.2 - this.weaponGroup.position.z) * ease;
      this.weaponGroup.rotation.y += (visualYaw * 0.56 - this.weaponGroup.rotation.y) * ease;
      this.weaponGroup.rotation.x += (-visualPitch * 0.52 - this.weaponGroup.rotation.x) * ease;
      this.weaponGroup.rotation.z += ((-screenAimX * 0.82 - strafeLean * 0.10) - this.weaponGroup.rotation.z) * ease;
    }
    if (this.headGroup) {
      this.headGroup.position.x += ((screenAimX * 0.42) - this.headGroup.position.x) * ease;
      this.headGroup.position.y += ((2.28 + screenAimY * 0.30) * 1.2 - this.headGroup.position.y) * ease;
      this.headGroup.rotation.y += ((visualYaw * 1.16) - this.headGroup.rotation.y) * ease;
      this.headGroup.rotation.x += ((-visualPitch * 0.78) - this.headGroup.rotation.x) * ease;
      this.headGroup.rotation.z += ((-screenAimX * 0.62 - strafeLean * 0.16) - this.headGroup.rotation.z) * ease;
    }
    if (this.chestGroup) {
      this.chestGroup.rotation.y += ((screenAimX * 0.22) - this.chestGroup.rotation.y) * ease;
      this.chestGroup.rotation.x += ((-screenAimY * 0.12 + accelRatio * 0.04) - this.chestGroup.rotation.x) * ease;
      this.chestGroup.rotation.z += ((-screenAimX * 0.16 - strafeLean * 0.18) - this.chestGroup.rotation.z) * ease;
    }
    if (this.headAimRod && this.headGroup) {
      _headAimStart.set(this.headGroup.position.x, this.headGroup.position.y, 0.58);
      _headAimEnd.set(this.headGroup.position.x + screenAimX * 0.66, this.headGroup.position.y + screenAimY * 0.54, 0.62);
      this._placeLimbCylinder(this.headAimRod, _headAimStart, _headAimEnd);
    }
    if (this.weaponAimGuide && this.weaponGroup) {
      _weaponAimStart.set(this.weaponGroup.position.x, this.weaponGroup.position.y, 0.86);
      _weaponAimEnd.set(this.weaponGroup.position.x + screenAimX * 0.74, this.weaponGroup.position.y + screenAimY * 0.56, 0.92);
      this._placeLimbCylinder(this.weaponAimGuide, _weaponAimStart, _weaponAimEnd);
    }
    if (this.arms) {
      for (const arm of this.arms) {
        const side = arm.side;
        const shoulderX = -Math.PI / 2.28 + aimPitch * 0.86 + accelRatio * 0.04;
        const shoulderY = aimYaw * 1.08 + side * 0.28;
        const shoulderZ = side * (0.22 + accelRatio * 0.05) - strafeLean * 0.22 + runCycle * accelRatio * side * 0.045;
        const elbowX = -0.30 + aimPitch * 0.34 - accelRatio * 0.04;
        const elbowY = aimYaw * 0.32;
        arm.shoulder.rotation.x += (shoulderX - arm.shoulder.rotation.x) * ease;
        arm.shoulder.rotation.y += (shoulderY - arm.shoulder.rotation.y) * ease;
        arm.shoulder.rotation.z += (shoulderZ - arm.shoulder.rotation.z) * ease;
        arm.elbow.rotation.x += (elbowX - arm.elbow.rotation.x) * ease;
        arm.elbow.rotation.y += (elbowY - arm.elbow.rotation.y) * ease;
        arm.hand.rotation.z += ((-side * 0.08) - arm.hand.rotation.z) * ease;
      }
    }
    if (this.aimArms) {
      const handX = screenAimX * 1.34;
      const handY = 1.58 + screenAimY * 0.98 + accelRatio * 0.04;
      const handZ = 0.78;
      for (const arm of this.aimArms) {
        const side = arm.side;
        // Keep the shoulders glued to the top corners of the trapezoid, but
        // draw the arms on the camera-facing side of the body. From the game's
        // behind-camera view this makes the pose readable instead of hiding
        // the hands/forearms behind the torso.
        _armStart.set(side * 0.90, 1.82, 0.78);
        _armEnd.set(handX + side * 0.18, handY, handZ);
        _armMid.set(
          side * (0.82 - Math.abs(screenAimX) * 0.20) + screenAimX * 0.86,
          1.66 + screenAimY * 0.70 + runCycle * accelRatio * 0.025,
          0.92 + Math.abs(screenAimX) * 0.08
        );
        arm.shoulderJoint.position.copy(_armStart);
        arm.elbowJoint.position.copy(_armMid);
        arm.handJoint.position.copy(_armEnd);
        this._placeLimbCylinder(arm.upperMesh, _armStart, _armMid);
        this._placeLimbCylinder(arm.foreMesh, _armMid, _armEnd);
      }
    }
  }

  _cooldownForWeapon() {
    switch (this.weapon) {
      case WEAPON.LASER:     return 0.04; // very fast — beams overlap into a sweeping line
      case WEAPON.MULTISHOT: return 0.11;
      default:               return 0.12;
    }
  }

  _fire(projectiles, aimOrigin, aimDir, enemies, audio, onEnemyKilled) {
    const muzzle = this.getMuzzleWorldPos();

    if (this.weapon === WEAPON.LASER) {
      this._fireLaser(projectiles, muzzle, aimOrigin, aimDir, enemies, onEnemyKilled, audio);
    } else if (this.weapon === WEAPON.MULTISHOT) {
      this._fireMultishot(projectiles, muzzle, aimOrigin, aimDir, enemies, onEnemyKilled, audio);
    } else {
      this._fireSingle(projectiles, muzzle, aimOrigin, aimDir, enemies, onEnemyKilled, audio);
    }

    this.muzzle.visible = true;
    if (this.muzzleLight) {
      this.muzzleLight.position.copy(muzzle);
      this.muzzleLight.intensity = this.weapon === WEAPON.LASER ? 16 : 10;
      this.muzzleLight.color.set(
        this.weapon === WEAPON.LASER ? 0xff3344 :
        this.weapon === WEAPON.MULTISHOT ? 0xffaa66 :
        0xffb466
      );
    }
    if (audio) audio.playShoot(this.weapon);
  }

  _hitEndPoint(hit, aimOrigin, aimDir, distance = 420) {
    if (hit?.point && typeof hit.point.clone === 'function') return hit.point.clone();
    const t = Number.isFinite(hit?.t) ? hit.t : distance;
    return aimOrigin.clone().addScaledVector(aimDir, t);
  }

  _fireSingle(projectiles, muzzle, aimOrigin, aimDir, enemies, onEnemyKilled, audio) {
    const hit = enemies ? raycastEnemies(aimOrigin, aimDir, enemies) : null;
    const endPoint = this._hitEndPoint(hit, aimOrigin, aimDir);
    projectiles.spawnTracer(muzzle, endPoint, 0.07, 'normal');
    if (hit) {
      if (audio) audio.playEnemyHit();
      if (hit.enemy.hit(1, hit)) {
        hit.enemy.alive = false;
        if (onEnemyKilled) onEnemyKilled(hit.enemy);
      }
    }
  }

  _fireMultishot(projectiles, muzzle, aimOrigin, aimDir, enemies, onEnemyKilled, audio) {
    // Three-way spread around the world-up axis
    const SPREAD = 0.09; // radians
    const Y_AXIS = new THREE.Vector3(0, 1, 0);
    const dirs = [
      aimDir.clone(),
      aimDir.clone().applyAxisAngle(Y_AXIS,  SPREAD),
      aimDir.clone().applyAxisAngle(Y_AXIS, -SPREAD)
    ];
    for (const dir of dirs) {
      const hit = enemies ? raycastEnemies(aimOrigin, dir, enemies) : null;
      const endPoint = this._hitEndPoint(hit, aimOrigin, dir);
      projectiles.spawnTracer(muzzle, endPoint, 0.07, 'multi');
      if (hit) {
        if (audio) audio.playEnemyHit();
        if (hit.enemy.hit(1, hit)) {
          hit.enemy.alive = false;
          if (onEnemyKilled) onEnemyKilled(hit.enemy);
        }
      }
    }
  }

  _fireLaser(projectiles, muzzle, aimOrigin, aimDir, enemies, onEnemyKilled, audio) {
    // Pierces every enemy along the ray. Visual: red beam only, no tracer
    // sphere — at the fast laser fire rate beams overlap into a continuous
    // sweeping red line that follows your aim.
    const hits = enemies ? raycastEnemiesAll(aimOrigin, aimDir, enemies) : [];
    const farEnd = aimOrigin.clone().addScaledVector(aimDir, 420);
    projectiles.spawnBeam(muzzle, farEnd, 0.15);
    for (const h of hits) {
      if (audio) audio.playEnemyHit();
      if (h.enemy.hit(1, h)) {
        h.enemy.alive = false;
        if (onEnemyKilled) onEnemyKilled(h.enemy);
      }
    }
  }

  hit(audio) {
    if (this.invuln > 0 || !this.alive) return false;
    this.invuln = 1.3;
    if (audio) audio.playHit();
    return true;
  }

  die(audio) {
    this.alive = false;
    if (audio) audio.playDeath();
  }
}
