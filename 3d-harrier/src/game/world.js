import * as THREE from 'three';
import { getTheme } from './content/stages.js';
import { disposeObject3D } from './dispose.js';

// Scrolling rail-shooter world. Stage content can swap palette, scenery,
// tunnel ceiling, and speed without rebuilding the whole scene.
export class World {
  constructor(scene, lights = {}) {
    this.scene = scene;
    this.lights = lights;
    this.scrollOffset = 0;
    this.scrollSpeed = 8.5;
    this.scenerySpeedZ = 165;
    this.streakSpeedZ = 200;
    this._speedScale = 1;
    this._sceneryTypes = ['palm'];
    this._tunnelMode = null;
    this._courseCurve = { amplitude: 1.8, frequency: 0.005, secondaryAmplitude: 0.18, secondaryFrequency: 0.009, phase: 0, travelScale: 0.14 };
    this._curveTravel = 0;
    this._activeTurns = []; // { startZ, endZ, direction, strength }

    this._makeFog(0xc28058, 85, 350);
    this._makeSky();
    this._makeSunGlow();
    this._makeGround();
    this._scenery = [];
    this._scenerySpawnZ = -420;
    this._makeSpeedStreaks();
  }

  _makeFog(color, near, far) {
    this.scene.fog = new THREE.Fog(color, near, far);
    this.scene.background = new THREE.Color(color);
  }

  _makeSky() {
    const geo = new THREE.SphereGeometry(700, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x05143d) },
        midColor: { value: new THREE.Color(0x8a4a55) },
        bottomColor: { value: new THREE.Color(0xc28058) },
        offset: { value: 70 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 bottomColor;
        uniform float offset;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          vec3 col;
          if (h >= 0.0) {
            col = mix(midColor, topColor, smoothstep(0.0, 1.0, pow(h, 0.6)));
          } else {
            col = mix(midColor, bottomColor, smoothstep(0.0, 0.6, -h));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);
  }

  _makeSunGlow() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255, 230, 165, .85)');
    g.addColorStop(0.28, 'rgba(255, 160, 90, .36)');
    g.addColorStop(1, 'rgba(255, 80, 80, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    this.sunGlowTex = new THREE.CanvasTexture(c);
    this.sunGlowTex.colorSpace = THREE.SRGBColorSpace;
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sunGlowTex,
      color: 0xffd08a,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    }));
    this.sunGlow.position.set(48, 62, -255);
    this.sunGlow.scale.set(150, 150, 1);
    this.sunGlow.renderOrder = -0.5;
    this.scene.add(this.sunGlow);
  }

  _makeCheckerTexture(colorA, colorB, sq = 16, size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const s = size / sq;
    for (let i = 0; i < sq; i++) {
      for (let j = 0; j < sq; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? colorA : colorB;
        ctx.fillRect(i * s, j * s, s, s);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearMipmapNearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  }

  _makeGround(colorA = '#0d8030', colorB = '#16ad48') {
    this.groundTex = this._makeCheckerTexture(colorA, colorB);
    this.groundTex.repeat.set(60, 200);
    const mat = new THREE.MeshLambertMaterial({ map: this.groundTex, fog: true });
    const geo = new THREE.PlaneGeometry(600, 1400);
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -12, -500);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;
  }

  _makeCeiling(colorA = '#25304a', colorB = '#52617f', y = 20) {
    this.removeCeiling();
    this.ceilingTex = this._makeCheckerTexture(colorA, colorB);
    this.ceilingTex.repeat.set(60, 200);
    const mat = new THREE.MeshLambertMaterial({ map: this.ceilingTex, fog: true, side: THREE.DoubleSide });
    const geo = new THREE.PlaneGeometry(600, 1400);
    const ceiling = new THREE.Mesh(geo, mat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, y, -500);
    this.scene.add(ceiling);
    this.ceiling = ceiling;
  }

  removeCeiling() {
    if (!this.ceiling) return;
    this.scene.remove(this.ceiling);
    disposeObject3D(this.ceiling);
    this.ceiling = null;
    this.ceilingTex = null;
  }

  _makeSpeedStreaks() {
    const N = 420;
    const positions = new Float32Array(N * 3);
    const baseX = new Float32Array(N);
    const curveAt = new Float32Array(N);
    const speeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      baseX[i] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 36 + 1;
      positions[i * 3 + 2] = -5 - Math.random() * 220;
      curveAt[i] = this.getCourseOffset(positions[i * 3 + 2]);
      positions[i * 3 + 0] = baseX[i] + curveAt[i];
      speeds[i] = this.streakSpeedZ * (0.7 + Math.random() * 0.6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.42,
      transparent: true,
      opacity: 0.74,
      sizeAttenuation: true,
      depthWrite: false,
      fog: false
    });
    this.streaks = new THREE.Points(geo, mat);
    this._streakSpeeds = speeds;
    this._streakPositions = positions;
    this._streakBaseX = baseX;
    this._streakCurveAt = curveAt;
    this.scene.add(this.streaks);
  }

  _updateSpeedStreaks(dt) {
    if (!this.streaks) return;
    const pos = this._streakPositions;
    const sp = this._streakSpeeds;
    for (let i = 0; i < sp.length; i++) {
      pos[i * 3 + 2] += sp[i] * dt;
      if (pos[i * 3 + 2] > 8) {
        pos[i * 3 + 2] = -200 - Math.random() * 30;
        this._streakBaseX[i] = (Math.random() - 0.5) * 70;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 36 + 1;
      }
      this._streakCurveAt[i] = this.getCourseOffset(pos[i * 3 + 2]);
      pos[i * 3 + 0] = this._streakBaseX[i] + this._streakCurveAt[i];
    }
    this.streaks.geometry.attributes.position.needsUpdate = true;
  }

  spawnScenery() {
    for (let i = 0; i < 36; i++) {
      const type = this._sceneryTypes[Math.floor(Math.random() * this._sceneryTypes.length)] || 'palm';
      const g = this._buildScenery(type);
      const scale = 0.85 + Math.random() * 1.5;
      g.scale.setScalar(scale);

      const side = Math.random() < 0.5 ? -1 : 1;
      const z = -50 - Math.random() * 250;
      g.userData.baseX = side * (22 + Math.random() * 30);
      g.position.set(g.userData.baseX + this.getCourseOffset(z), -12, z);
      this.scene.add(g);
      this._scenery.push(g);
    }
  }

  _buildScenery(type) {
    if (type === 'rock') return this._makeRock();
    if (type === 'deadTree') return this._makeDeadTree();
    if (type === 'tree') return this._makeTree();
    if (type === 'mushroom') return this._makeMushroom();
    if (type === 'column') return this._makeColumn();
    if (type === 'idaHead') return this._makeIdaHead();
    if (type === 'binzubin') return this._makeBinzubin();
    return this._makePalm();
  }

  _makePalm() {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f6b22, roughness: 0.7 });
    const trunkH = 8 + Math.random() * 4;
    const leafBaseLen = 4.0 + Math.random() * 1.5;
    const leafCount = 5 + Math.floor(Math.random() * 3);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, trunkH, 8), trunkMat);
    trunk.position.y = trunkH / 2;
    g.add(trunk);

    const crownY = trunkH;
    for (let k = 0; k < leafCount; k++) {
      const a = (k / leafCount) * Math.PI * 2 + Math.random() * 0.2;
      const len = leafBaseLen * (0.85 + Math.random() * 0.3);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, len, 6), leafMat);
      leaf.position.set(Math.cos(a) * 1.4, crownY + 0.5, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 0.6;
      leaf.rotation.x = Math.sin(a) * 0.6;
      g.add(leaf);
    }
    this._enableShadows(g);
    return g;
  }

  _makeTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.85, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0x4c331d, roughness: 0.9 })
    );
    trunk.position.y = 4.5;
    g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(3.2 - i * 0.45, 4.2, 9),
        new THREE.MeshStandardMaterial({ color: 0x285c30, roughness: 0.75 })
      );
      crown.position.y = 7 + i * 2.1;
      g.add(crown);
    }
    this._enableShadows(g);
    return g;
  }

  _makeDeadTree() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d2b1d, roughness: 0.95 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.7, 9, 7), mat);
    trunk.position.y = 4.5;
    trunk.rotation.z = (Math.random() - 0.5) * 0.25;
    g.add(trunk);
    for (let i = 0; i < 4; i++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.5, 6), mat);
      branch.position.y = 5.4 + i * 0.9;
      branch.rotation.z = (i % 2 ? -1 : 1) * (0.65 + Math.random() * 0.35);
      branch.rotation.x = (Math.random() - 0.5) * 0.5;
      g.add(branch);
    }
    this._enableShadows(g);
    return g;
  }

  _makeRock() {
    const g = new THREE.Group();
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(3.0 + Math.random() * 1.6, 0),
      new THREE.MeshStandardMaterial({ color: 0x7e725f, roughness: 0.9 })
    );
    rock.position.y = 2.2;
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(rock);
    this._enableShadows(g);
    return g;
  }

  _makeMushroom() {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 1.1, 4.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xd9c7a2, roughness: 0.7 })
    );
    stem.position.y = 2.3;
    g.add(stem);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      new THREE.MeshStandardMaterial({ color: 0xb9445a, roughness: 0.55, emissive: 0x180309, emissiveIntensity: 0.25 })
    );
    cap.position.y = 4.7;
    cap.scale.y = 0.55;
    g.add(cap);
    this._enableShadows(g);
    return g;
  }

  _makeColumn() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a8b70, roughness: 0.82 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.55, 17, 10), mat);
    shaft.position.y = 8.5;
    g.add(shaft);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 4), mat);
    cap.position.y = 17.7;
    g.add(cap);
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.0, 4.5), mat);
    base.position.y = 0.5;
    g.add(base);
    this._enableShadows(g);
    return g;
  }

  _makeIdaHead() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x77716c, roughness: 0.92, flatShading: true });
    const head = new THREE.Mesh(new THREE.BoxGeometry(4.4, 5.0, 3.0), mat);
    head.position.y = 5;
    g.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const x of [-0.9, 0.9]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.18), eyeMat);
      eye.position.set(x, 5.7, -1.55);
      g.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.18), eyeMat);
    mouth.position.set(0, 4.3, -1.55);
    g.add(mouth);
    this._enableShadows(g);
    return g;
  }

  _makeBinzubin() {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.7, 0),
      new THREE.MeshStandardMaterial({ color: 0x66e6ff, roughness: 0.35, metalness: 0.35, emissive: 0x0b6680, emissiveIntensity: 0.55 })
    );
    mesh.position.y = 7 + Math.random() * 9;
    g.add(mesh);
    g.userData.spin = new THREE.Vector3(Math.random() * 1.4, Math.random() * 1.8, Math.random() * 1.2);
    this._enableShadows(g);
    return g;
  }

  _enableShadows(group) {
    group.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  removeScenery() {
    for (const g of this._scenery) {
      this.scene.remove(g);
      disposeObject3D(g);
    }
    this._scenery = [];
  }

  update(dt) {
    this.scrollOffset += dt * this.scrollSpeed;
    this._curveTravel += dt * this.scenerySpeedZ;
    if (this.groundTex) this.groundTex.offset.y = -this.scrollOffset;
    if (this.ceilingTex) this.ceilingTex.offset.y = this.scrollOffset;

    // Clean up old turns (older than 20 seconds = well past the player)
    if (this._activeTurns && this._activeTurns.length) {
      const now = performance.now();
      this._activeTurns = this._activeTurns.filter(t => (now - (t.createdAt || 0)) < 20000);
    }

    for (const g of this._scenery) {
      g.position.z += dt * this.scenerySpeedZ;
      if (g.userData.baseX === undefined) g.userData.baseX = g.position.x - this.getCourseOffset(g.position.z);
      g.position.x = g.userData.baseX + this.getCourseOffset(g.position.z);
      if (g.userData.spin) {
        g.rotation.x += g.userData.spin.x * dt;
        g.rotation.y += g.userData.spin.y * dt;
        g.rotation.z += g.userData.spin.z * dt;
      }
      if (g.position.z > 20) {
        g.position.z -= 340;
        g.userData.baseX = (Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 30);
        g.position.x = g.userData.baseX + this.getCourseOffset(g.position.z);
      }
    }

    this._updateSpeedStreaks(dt);
  }

  setSpeedScale(s) {
    this._speedScale = s;
    this.scrollSpeed = 8.5 * s;
    this.scenerySpeedZ = 165 * s;
    this.streakSpeedZ = 200 * s;
    if (this._streakSpeeds) {
      for (let i = 0; i < this._streakSpeeds.length; i++) {
        this._streakSpeeds[i] = 200 * s * (0.7 + Math.random() * 0.6);
      }
    }
  }

  setTheme(themeNameOrObject, transitionSeconds = 0) {
    const theme = typeof themeNameOrObject === 'string' ? getTheme(themeNameOrObject) : themeNameOrObject;
    if (!theme) return;

    this._makeFog(theme.fogColor, theme.fogNear, theme.fogFar);
    if (this.sky && this.sky.material && this.sky.material.uniforms) {
      this.sky.material.uniforms.topColor.value.setHex(theme.skyTop);
      this.sky.material.uniforms.midColor.value.setHex(theme.skyMid);
      this.sky.material.uniforms.bottomColor.value.setHex(theme.skyBottom);
    }

    if (this.groundTex) this.groundTex.dispose();
    this.groundTex = this._makeCheckerTexture(theme.groundA, theme.groundB);
    this.groundTex.repeat.set(60, 200);
    if (this.ground && this.ground.material) {
      if (this.ground.material.map) this.ground.material.map.dispose();
      this.ground.material.map = this.groundTex;
      this.ground.material.needsUpdate = true;
    }

    if (theme.light && this.lights) {
      if (this.lights.hemi) {
        this.lights.hemi.color.setHex(theme.light.hemiSky);
        this.lights.hemi.groundColor.setHex(theme.light.hemiGround);
        this.lights.hemi.intensity = theme.light.hemiIntensity;
      }
      if (this.lights.sun) {
        this.lights.sun.color.setHex(theme.light.sunColor);
        this.lights.sun.intensity = theme.light.sunIntensity;
      }
    }
    if (this.sunGlow?.material) {
      this.sunGlow.material.color.setHex(theme.light?.sunColor || 0xffd08a);
      this.sunGlow.material.opacity = Math.max(0.45, Math.min(0.9, (theme.light?.sunIntensity || 1) * 0.62));
    }
  }

  setSceneryTypes(types = ['palm']) {
    this._sceneryTypes = types.length ? types.slice() : ['palm'];
    this.removeScenery();
    this.spawnScenery();
  }

  setTunnelMode(options = null) {
    this._tunnelMode = options;
    if (!options || !options.ceiling) {
      this.removeCeiling();
      return;
    }
    const palette = options.ceilingPalette || ['#25304a', '#52617f'];
    this._makeCeiling(palette[0], palette[1], options.ceilingY || 20);
  }

  setCourseCurve(curve = null) {
    this._courseCurve = curve || { amplitude: 1.8, frequency: 0.005, secondaryAmplitude: 0.18, secondaryFrequency: 0.009, phase: 0, travelScale: 0.14 };
  }

  getTurnInfluence(z) {
    let influence = 0;
    for (const turn of this._activeTurns || []) {
      const minZ = Math.min(turn.startZ, turn.endZ);
      const maxZ = Math.max(turn.startZ, turn.endZ);
      if (z >= minZ && z <= maxZ) {
        const range = maxZ - minZ;
        const progress = (z - minZ) / range;
        const eased = Math.sin(progress * Math.PI);
        influence += (turn.direction === 'left' ? -1 : 1) * eased * (turn.strength / 4);
      }
    }
    return Math.max(-1, Math.min(1, influence));
  }

  getCourseOffset(z) {
    const c = this._courseCurve;
    if (!c) return 0;

    let offset = 0;
    const a = c.amplitude || 0;
    const f = c.frequency || 0.014;
    const a2 = c.secondaryAmplitude || 0;
    const f2 = c.secondaryFrequency || 0.031;
    const phase = c.phase || 0;
    const travel = this._curveTravel * (c.travelScale ?? 0.55);

    // Base sine curve
    offset = Math.sin((z + travel) * f + phase) * a + Math.sin((z + travel * 0.7) * f2 + phase * 1.7) * a2;

    // Apply active turns with smooth easing
    for (const turn of this._activeTurns || []) {
      const minZ = Math.min(turn.startZ, turn.endZ);
      const maxZ = Math.max(turn.startZ, turn.endZ);
      if (z >= minZ && z <= maxZ) {
        const range = maxZ - minZ;
        const progress = (z - minZ) / range;
        const eased = Math.sin(progress * Math.PI);
        const turnOffset = turn.strength * 4.0 * (turn.direction === 'left' ? -1 : 1) * eased;
        offset += turnOffset;
      }
    }

    return offset;
  }

  addTurn(startZ, endZ, direction, strength = 3) {
    if (!this._activeTurns) this._activeTurns = [];
    // Tag with creation time + a TTL so we can clean them up properly later
    const turn = { 
      startZ, 
      endZ, 
      direction, 
      strength,
      createdAt: performance.now()
    };
    this._activeTurns.push(turn);
  }
}
