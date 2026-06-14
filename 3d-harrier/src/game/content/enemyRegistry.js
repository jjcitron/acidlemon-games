import { Mammoth } from '../entities.js';
import { DomBasic, DomBlue, DomRed, DroneHeavy, FighterJet, LaneDiver, Looper, LowrysPod, MineLayer, Mukadensu, OctopusPod, Pakomen, ShieldCarrier, Skegg, SniperDrone, Splitter, TetraPanel, Tomos } from '../enemies/coreEnemies.js';

const ENEMY_BUILDERS = {
  mammoth(scene, position) { return new Mammoth(scene, position); },
  mukadensu(scene, position) { return new Mukadensu(scene, position); },
  makuden(scene, position) { return new Mukadensu(scene, position); },
  tomos(scene, position) { return new Tomos(scene, position); },
  skegg(scene, position) { return new Skegg(scene, position, 'skegg'); },
  canary(scene, position) { return new Skegg(scene, position, 'canary'); },
  looper(scene, position) { return new Looper(scene, position); },
  domBasic(scene, position) { return new DomBasic(scene, position); },
  domRed(scene, position) { return new DomRed(scene, position); },
  domBlue(scene, position) { return new DomBlue(scene, position); },
  pakomen(scene, position) { return new Pakomen(scene, position); },
  fighterJet(scene, position) { return new FighterJet(scene, position); },
  droneHeavy(scene, position) { return new DroneHeavy(scene, position); },
  lowrys(scene, position) { return new LowrysPod(scene, position); },
  tetra(scene, position) { return new TetraPanel(scene, position); },
  octopus(scene, position) { return new OctopusPod(scene, position); },
  laneDiver(scene, position) { return new LaneDiver(scene, position); },
  shieldCarrier(scene, position) { return new ShieldCarrier(scene, position); },
  mineLayer(scene, position) { return new MineLayer(scene, position); },
  splitter(scene, position) { return new Splitter(scene, position); },
  sniperDrone(scene, position) { return new SniperDrone(scene, position); }
};

export function createEnemy(type, scene, position) {
  const builder = ENEMY_BUILDERS[type] || ENEMY_BUILDERS.mammoth;
  return builder(scene, position);
}

export function pickWeightedEnemy(entries) {
  if (!entries || entries.length === 0) return 'mammoth';
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight || 0), 0);
  if (total <= 0) return entries[0].type;
  let r = Math.random() * total;
  for (const entry of entries) {
    r -= Math.max(0, entry.weight || 0);
    if (r <= 0) return entry.type;
  }
  return entries[entries.length - 1].type;
}
