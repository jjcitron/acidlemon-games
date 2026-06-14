import * as THREE from 'three';
import { CarrierBoss, DomWaveBoss, FormationBoss, SegmentedDragonBoss, ShieldedFaceBoss, WiWiJumboBoss } from '../bosses/bosses.js';
export function createBoss(config, scene) {
  const id = typeof config === 'string' ? config : config?.id;
  const name = typeof config === 'string' ? undefined : config?.name;
  const pos = new THREE.Vector3(0, 2, -88);
  if (id === 'domWave') return new DomWaveBoss(scene, pos, name || 'DOM WAVE');
  if (id === 'shura' || id === 'barbarian') return new ShieldedFaceBoss(scene, pos, name || 'SHURA MIRROR');
  if (id === 'carrier' || id === 'stanley') return new CarrierBoss(scene, pos, name || 'STANLEY CARRIER');
  if (id === 'lowrys') return new FormationBoss(scene, pos, name || 'LOWRYS SWARM');
  if (id === 'tetras') return new FormationBoss(scene, pos, name || 'TETRAS');
  if (id === 'wiwi') return new WiWiJumboBoss(scene, pos);
  return new SegmentedDragonBoss(scene, pos, name || 'GODARNI');
}
