import * as THREE from 'three';

export class HitSphereDebug {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = 0;
    this.materials = {
      player: mat(0x66e6ff),
      hit: mat(0xff667a),
      collision: mat(0xffcc66),
      pickup: mat(0x7dfff2)
    };
  }

  update({ player, shootables = [], obstacles = [], pickups = [] } = {}) {
    this.active = 0;
    if (player?.position) this._show(player.position, 1.2, 'player');

    for (const actor of shootables) {
      if (!actor?.alive) continue;
      const spheres = typeof actor.getHitSpheres === 'function'
        ? actor.getHitSpheres()
        : [{ center: actor.position, radius: actor.radius }];
      this._showMany(spheres, 'hit');
    }

    for (const obstacle of obstacles) {
      if (!obstacle?.alive || typeof obstacle.getCollisionSpheres !== 'function') continue;
      this._showMany(obstacle.getCollisionSpheres(), 'collision');
    }

    for (const pickup of pickups) {
      if (!pickup?.alive) continue;
      this._show(pickup.position, pickup.radius || 2, 'pickup');
    }

    for (let i = this.active; i < this.pool.length; i++) this.pool[i].visible = false;
  }

  hide() {
    this.active = 0;
    for (const mesh of this.pool) mesh.visible = false;
  }

  _showMany(spheres, kind) {
    for (const sphere of spheres || []) {
      this._show(sphere.center, sphere.radius, kind);
    }
  }

  _show(center, radius = 1, kind = 'hit') {
    if (!center) return;
    const mesh = this._mesh();
    mesh.material = this.materials[kind] || this.materials.hit;
    mesh.position.copy(center);
    mesh.scale.setScalar(Math.max(0.01, radius));
    mesh.visible = true;
  }

  _mesh() {
    let mesh = this.pool[this.active++];
    if (mesh) return mesh;
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 8),
      this.materials.hit
    );
    mesh.renderOrder = 90;
    mesh.visible = false;
    this.scene.add(mesh);
    this.pool.push(mesh);
    return mesh;
  }
}

function mat(color) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.58,
    depthTest: false,
    depthWrite: false
  });
}
