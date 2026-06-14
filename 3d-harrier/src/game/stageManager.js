import * as THREE from 'three';
import { Pickup } from './entities.js';
import { Obstacle } from './obstacles.js';
import { BonusMode } from './bonusMode.js';
import { getStage } from './content/stages.js';
import { getNextStageId } from './content/campaign.js';
import { createEnemy, pickWeightedEnemy } from './content/enemyRegistry.js';
import { createBoss } from './content/bossRegistry.js';
import { ACTOR_CAPS, getPickupWeightsForStage, pickWeighted } from './content/balance.js';

export class StageManager {
  constructor(scene, hud, audio, options = {}) {
    this.scene = scene; this.hud = hud; this.audio = audio;
    this.world = options.world || null;
    this.enemyProjectiles = options.enemyProjectiles || null;
    this.onStageStart = options.onStageStart || null;
    this.onStageClear = options.onStageClear || null;
    this.onCampaignComplete = options.onCampaignComplete || null;
    this.onBonusScore = options.onBonusScore || null;
    this.enemies = []; this.obstacles = []; this.pickups = [];
    this.bonusMode = new BonusMode(scene);
    this.boss = null;
    this.elapsed = 0; this.stateElapsed = 0; this.nextSpawnTime = 1.4; this.nextObstacleTime = 3; this.nextPickupTime = 9 + Math.random() * 5; this.difficulty = 0; this.state = 'idle';
    this.introDuration = 1.6;
    this.easyMode = false;
    this.enemyCountScale = 1;
    this.mapAnchorQueue = [];
    this.bossRushQueue = [];
    this.bossRushIndex = 0;
    this.bossRushMode = false;
    this.activeBossConfig = null;
    this.stage = 1; this.stageName = 'MOOT'; this.stageDef = getStage(1);
  }
  start(stageId = 1) { this._loadStage(stageId); }
  setEasyMode(on) { this.easyMode = !!on; this.enemyCountScale = this.easyMode ? 0.75 : 1; }
  update(dt, player) {
    this.stateElapsed += dt;
    if (this.state === 'intro') { if (this.stateElapsed >= this.introDuration) { this.state = this.stageDef.mode === 'bonus' ? 'bonusRun' : 'stageRun'; this.stateElapsed = 0; } this._updateActors(dt, player); return; }
    if (this.state === 'bonusRun') { this.elapsed += dt; this.difficulty = Math.min(1, this.elapsed / Math.max(1, this.stageDef.duration)); this.bonusMode.update(dt, player, (points)=>{ if(this.onBonusScore) this.onBonusScore(points); }); if (this.elapsed >= this.stageDef.duration) this._enterStageClear(); return; }
    if (this.state === 'bossIntro') { this._updateActors(dt, player); if (this.stateElapsed >= 1.7) this._startBossFight(); return; }
    if (this.state === 'bossRushIntro') { this._updateActors(dt, player); if (this.stateElapsed >= 1.7) this._startNextBossRushFight(); return; }
    if (this.state === 'bossRushRest') { this._updateActors(dt, player); if (this.stateElapsed >= 1.4) this._startNextBossRushFight(); return; }
    if (this.state === 'bossFight') { this._updateBossFight(dt, player); return; }
    if (this.state === 'stageClear') { this._updateActors(dt, player); if (this.stateElapsed >= 2.2) { const nextStageId = getNextStageId(this.stageDef); if (nextStageId) this._loadStage(nextStageId); else this._enterEnding(); } return; }
    if (this.state !== 'stageRun') return;
    this.elapsed += dt; this.difficulty = Math.min(1, this.elapsed / Math.max(1, this.stageDef.duration));
    this.spawnMapAnchors();
    if (this.elapsed >= this.nextSpawnTime) { this.spawnWave(); const spawn = this.stageDef.spawn || {}; const base = spawn.intervalBase || 1.3, min = spawn.intervalMin || 0.45; this.nextSpawnTime = this.elapsed + Math.max(min, base * (1 - this.difficulty * 0.55)); }
    if (this.elapsed >= this.nextPickupTime) { this.spawnPickup(); this.nextPickupTime = this.elapsed + this._pickupInterval(); }
    if (this.elapsed >= this.nextObstacleTime) { this.spawnObstacleCluster(); this.nextObstacleTime = this.elapsed + this._obstacleInterval(); }
    if (this.stageDef.turnDensity && this.elapsed >= (this.nextTurnTime || 8)) { this._spawnProceduralTurn(); this.nextTurnTime = this.elapsed + 10 + Math.random() * 8; }
    this._updateActors(dt, player);
    this._enforceActorCaps();
    if (this.elapsed >= this.stageDef.duration) { if (this.stageDef.bossRush?.length) this._enterBossRushIntro(); else if (this.stageDef.boss) this._enterBossIntro(); else this._enterStageClear(); }
  }
  _loadStage(stageId) {
    this._clearActors(); this.bonusMode.reset(); this._destroyBoss();
    this.stageDef = typeof stageId === 'object' && stageId ? stageId : getStage(stageId); this.stage = this.stageDef.custom ? 'ED' : this.stageDef.id; this.stageName = this.stageDef.name;
    this.elapsed = 0; this.stateElapsed = 0; this.difficulty = 0; this.nextSpawnTime = 1.2; this.nextObstacleTime = this._obstacleFirstDelay(); this.nextPickupTime = this._pickupFirstDelay(); this.state = 'intro';
    this.mapAnchorQueue = this._prepareMapAnchors(this.stageDef);
    this.bossRushQueue = [];
    this.bossRushIndex = 0;
    this.bossRushMode = false;
    this.activeBossConfig = null;
    this.introDuration = this.stageDef.splashImage ? 2.8 : 1.6;
    this.hud.setStage(this.stage, this.stageName); this.hud.showBoss(null); this.hud.showStageSplash?.(this.stageDef, this.introDuration * 1000 - 200); this.hud.showTitle(`${this.stageDef.mode === 'bonus' ? 'BONUS' : 'STAGE'} ${this.stage} ${this.stageName}`, Math.min(1600, this.introDuration * 1000));
    if (this.world) { this.world.setTheme(this.stageDef.worldTheme, 0.4); this.world.setSceneryTypes(this.stageDef.sceneryTypes || ['palm']); this.world.setTunnelMode(this.stageDef.tunnel || null); this.world.setCourseCurve(this.stageDef.course || null); this.world.setSpeedScale(this.stageDef.speedScale || 1); }
    if (this.stageDef.mode === 'bonus') this.bonusMode.start(this.stageDef.bonus || {});
    if (this.onStageStart) this.onStageStart(this.stageDef);
  }
  _enterBossIntro() { this.bossRushMode = false; this.activeBossConfig = this.stageDef.boss; this.state = 'bossIntro'; this.stateElapsed = 0; this._clearActors(); this.audio?.playBossCue?.('intro'); this.hud.showBossIntro?.(this.activeBossConfig, { kicker:'BOSS WARNING', subtitle:`${this.stageDef.name} / WEAK POINTS ACTIVE` }, 1700) || this.hud.showTitle(`${this.stageDef.boss.name || 'BOSS'} APPROACHES`, 1600); if (this.onStageStart) this.onStageStart({ ...this.stageDef, musicTrack: this.stageDef.boss.musicTrack || this.stageDef.musicTrack }); }
  _enterBossRushIntro() { this.bossRushMode = true; this.bossRushQueue = (this.stageDef.bossRush || []).slice(); this.bossRushIndex = 0; this.activeBossConfig = null; this.state = 'bossRushIntro'; this.stateElapsed = 0; this._clearActors(); this.audio?.playBossCue?.('rush'); this.hud.showBossIntro?.({ name:'BOSS RUSH' }, { kicker:'FINAL ROUTE', subtitle:`${this.bossRushQueue.length} TARGETS / NO RETREAT` }, 1700) || this.hud.showTitle('BOSS RUSH', 1700); if (this.onStageStart) this.onStageStart({ ...this.stageDef, musicTrack: this.stageDef.bossRushMusicTrack || this.stageDef.musicTrack }); }
  _startBossFight() { this.state = 'bossFight'; this.stateElapsed = 0; this.boss = createBoss(this.activeBossConfig || this.stageDef.boss, this.scene); this.hud.showBoss(this.boss); }
  _startNextBossRushFight() { if (this.bossRushIndex >= this.bossRushQueue.length) { this.bossRushMode = false; this._enterStageClear(); return; } this.activeBossConfig = this.bossRushQueue[this.bossRushIndex++]; this.state = 'bossFight'; this.stateElapsed = 0; this._destroyBoss(); if (this.enemyProjectiles) this.enemyProjectiles.reset(); this.audio?.playBossCue?.('intro'); this.hud.showBossIntro?.(this.activeBossConfig, { kicker:'RUSH TARGET', index:this.bossRushIndex, total:this.bossRushQueue.length, subtitle:'WEAK POINTS ACTIVE' }, 1100) || this.hud.showTitle(`${this.activeBossConfig.name || 'BOSS'} ${this.bossRushIndex}/${this.bossRushQueue.length}`, 1100); this.boss = createBoss(this.activeBossConfig, this.scene); this.hud.showBoss(this.boss); }
  _updateBossFight(dt, player) { const ctx = { enemyProjectiles:this.enemyProjectiles, audio:this.audio, difficulty:1, stage:this.stageDef, time:this.elapsed, bossRush:this.bossRushMode, bossRushIndex:this.bossRushIndex }; if (this.boss && this.boss.alive) { this.boss.update(dt, player, ctx); this.hud.updateBoss(this.boss); } if (!this.boss || !this.boss.alive) { this.hud.showBoss(null); if (this.bossRushMode) this._enterBossRushRest(); else this._enterStageClear(); } }
  _enterBossRushRest() { this.state = 'bossRushRest'; this.stateElapsed = 0; this._destroyBoss(); if (this.enemyProjectiles) this.enemyProjectiles.reset(); this.hud.showTitle(this.bossRushIndex >= this.bossRushQueue.length ? 'RUSH CLEAR' : 'NEXT BOSS', 1200); }
  _enterStageClear() { this.state = 'stageClear'; this.stateElapsed = 0; this.hud.showBoss(null); this.hud.showTitle(`${this.stageDef.mode === 'bonus' ? 'BONUS' : 'STAGE'} ${this.stage} CLEAR`, 1800); this._clearActors(); this.bonusMode.reset(); this._destroyBoss(); if (this.onStageClear) this.onStageClear(this.stageDef); }
  _enterEnding() { this.state = 'ending'; this.stateElapsed = 0; this._clearActors(); this.bonusMode.reset(); this._destroyBoss(); if (this.onCampaignComplete) this.onCampaignComplete(this.stageDef); }
  _updateActors(dt, player) { const ctx = { enemyProjectiles:this.enemyProjectiles, audio:this.audio, difficulty:this.difficulty, stage:this.stageDef, time:this.elapsed }; for (const e of this.enemies) { e.update(dt, player, ctx); this._applyCourseDrift(e); } for (const o of this.obstacles) { o.update(dt, player); this._applyCourseDrift(o); } for (const p of this.pickups) { p.update(dt, player); this._applyCourseDrift(p); } this._applyCourseDrift(player); for (let i=this.enemies.length-1;i>=0;i--){const e=this.enemies[i]; if(!e.alive||e.position.z>8){ if(!e.alive && typeof e.spawnOnDeath==='function'){ for(const child of e.spawnOnDeath()){ child._courseOffset=this._courseOffset(child.position.z); this.enemies.push(child); } } e.destroy(); this.enemies.splice(i,1);}} for (let i=this.pickups.length-1;i>=0;i--){const p=this.pickups[i]; if(!p.alive||p.position.z>8){p.destroy(); this.pickups.splice(i,1);}} for (let i=this.obstacles.length-1;i>=0;i--){const o=this.obstacles[i]; if(!o.alive||o.position.z>12){o.destroy(); this.obstacles.splice(i,1);}} }
  _clearActors(){ for(const e of this.enemies) e.destroy(); for(const o of this.obstacles) o.destroy(); for(const p of this.pickups) p.destroy(); if(this.enemyProjectiles) this.enemyProjectiles.reset(); this.enemies=[]; this.obstacles=[]; this.pickups=[]; }
  _destroyBoss(){ if(this.boss){ this.boss.destroy(); this.boss=null; } }
  _pickupFirstDelay(){ const c=this.stageDef.pickups||{}; return (c.firstMin??9)+Math.random()*Math.max(0,(c.firstMax??14)-(c.firstMin??9)); }
  _pickupInterval(){ const c=this.stageDef.pickups||{}; return (c.intervalMin??11)+Math.random()*Math.max(0,(c.intervalMax??17)-(c.intervalMin??11)); }
  _obstacleFirstDelay(){ const c=this.stageDef.obstacles||{}; if(!c.enabled) return Infinity; return c.firstDelay??3; }
  _obstacleInterval(){ const c=this.stageDef.obstacles||{}; if(!c.enabled) return Infinity; return Math.max(c.intervalMin??1.6,(c.intervalBase??3)*(1-this.difficulty*.35)); }
  spawnPickup(){ if(this.pickups.length>=ACTOR_CAPS.pickups)return; const type=pickWeighted(getPickupWeightsForStage(this.stageDef))||'multishot'; const z=-380; const pickup=new Pickup(this.scene,new THREE.Vector3((Math.random()-.5)*30+this._courseOffset(z),(Math.random()-.5)*8+2,z),type); pickup._courseOffset=this._courseOffset(z); this.pickups.push(pickup); }
  spawnMapAnchors(){ if(!this.mapAnchorQueue || !this.mapAnchorQueue.length) return; while(this.mapAnchorQueue.length && this.mapAnchorQueue[0].time <= this.elapsed){ const entry=this.mapAnchorQueue.shift(); this._spawnMapAnchor(entry.anchor); } }
  _spawnMapAnchor(anchor){ if(!anchor) return; const z=-400; const curve=this._courseOffset(z); const x=(anchor.x||0)*24+curve; if(anchor.kind==='enemy'){ if(this.enemies.length>=ACTOR_CAPS.enemies)return; const count=Math.min(Math.max(1,Math.min(4,Math.round(anchor.weight||1))),ACTOR_CAPS.enemies-this.enemies.length); const spawn=this.stageDef.spawn||{}; const speed=(spawn.speedMin??42)+((spawn.speedMax??88)-(spawn.speedMin??42))*this.difficulty; for(let i=0;i<count;i++){ const offset=(i-(count-1)/2)*3.4; const enemy=createEnemy(anchor.type,this.scene,new THREE.Vector3(x+offset,2+Math.sin((anchor.x||0)*Math.PI)*4,z-i*8)); enemy.speedZ=speed+(Math.random()-.5)*8; enemy._courseOffset=this._courseOffset(enemy.position.z); this.enemies.push(enemy); } return; } if(anchor.kind==='object'){ if(this.obstacles.length>=ACTOR_CAPS.obstacles)return; const y=this._objectY(anchor.type); const obstacle=new Obstacle(this.scene,new THREE.Vector3(x,y,z),anchor.type,{speedZ:92+this.difficulty*42}); obstacle._courseOffset=curve; this.obstacles.push(obstacle); return; } if(anchor.kind==='item'){ if(this.pickups.length>=ACTOR_CAPS.pickups)return; const pickup=new Pickup(this.scene,new THREE.Vector3(x,2+Math.cos((anchor.x||0)*Math.PI)*4,z),anchor.type); pickup._courseOffset=curve; this.pickups.push(pickup); } if(anchor.kind==='turn' && this.world){ const playerZ = this.player ? this.player.position.z : -200; const zStart = playerZ - 40; const duration = anchor.duration || 5; const strength = (anchor.strength || 5) * 1.5; const endZ = zStart - (duration * 80); this.world.addTurn(zStart, endZ, anchor.direction || 'left', strength); } }
  _prepareMapAnchors(stageDef){ const anchors=Array.isArray(stageDef?.mapAnchors)?stageDef.mapAnchors:[]; const duration=Math.max(1,stageDef?.duration||60); return anchors.map(anchor=>({anchor,time:1.5+(1-(anchor.y??.5))*Math.max(1,duration-4)})).sort((a,b)=>a.time-b.time); }
  _spawnProceduralTurn(){
    if (!this.world || typeof this.world.addTurn !== 'function') return;
    const playerZ = this.player ? this.player.position.z : -10;
    const zStart = playerZ - 40;
    const duration = 4 + Math.random() * 3;
    const strength = (4 + Math.random() * 3) * (this.stageDef.turnDensity || 1);
    const endZ = zStart - (duration * 70);
    const direction = Math.random() < 0.5 ? 'left' : 'right';
    this.world.addTurn(zStart, endZ, direction, strength);
  }
  _objectY(type){ if(type==='column'||type==='binzubin'||type==='idaHead')return 2; if(type==='rock'||type==='mushroom')return -6; if(type==='underpass'||type==='bridge'||type==='archway'||type==='tunnelRing')return 0; if(type==='skyscraper')return 0; return -4; }
  spawnWave(){ const spawn=this.stageDef.spawn||{}; if(!spawn.enemyTypes || spawn.enemyTypes.length===0 || this.enemies.length>=ACTOR_CAPS.enemies) return; const formations=spawn.formations||['line','v','arc','single']; const formation=formations[Math.floor(Math.random()*formations.length)]; const baseCount=1+Math.floor(this.difficulty*3); let count=formation==='single'?1:(baseCount+1+Math.floor(Math.random()*2)); count=Math.min(Math.max(1,Math.round(count*this.enemyCountScale)),ACTOR_CAPS.enemies-this.enemies.length); const speedZ=(spawn.speedMin??38)+((spawn.speedMax??70)-(spawn.speedMin??38))*this.difficulty; const z0=-400; const baseX=(Math.random()-.5)*28+this._courseOffset(z0), baseY=(Math.random()-.5)*12+2; for(let i=0;i<count;i++){ let x=baseX,y=baseY,z=z0-i*7; if(formation==='line') x=baseX+(i-count/2)*4; else if(formation==='v'){const half=(count-1)/2; x=baseX+(i-half)*3; z=z0-Math.abs(i-half)*9;} else if(formation==='arc'){const a=(i/Math.max(1,count-1)-.5)*Math.PI*.7; x=baseX+Math.sin(a)*12; y=baseY+Math.cos(a)*4-2;} const enemy=createEnemy(pickWeightedEnemy(spawn.enemyTypes),this.scene,new THREE.Vector3(x,y,z)); enemy.speedZ=speedZ+(Math.random()-.5)*6; enemy._courseOffset=this._courseOffset(z); this.enemies.push(enemy);} }
  spawnObstacleCluster(){ const c=this.stageDef.obstacles||{}; if(!c.enabled || this.obstacles.length>=ACTOR_CAPS.obstacles) return; const lanes=c.lanes||[-16,-8,0,8,16]; const count=Math.min(Math.random()<.68?1:2,ACTOR_CAPS.obstacles-this.obstacles.length); const used=new Set(); const speedZ=(c.speedMin??86)+((c.speedMax??120)-(c.speedMin??86))*this.difficulty; for(let i=0;i<count;i++){ const entry=this._pickWeightedConfig(c.entries); let laneIndex=Math.floor(Math.random()*lanes.length), guard=0; while(used.has(laneIndex)&&guard<8){laneIndex=Math.floor(Math.random()*lanes.length);guard++;} used.add(laneIndex); const z=-420-i*24; const curve=this._courseOffset(z); const obstacle=new Obstacle(this.scene,new THREE.Vector3(lanes[laneIndex]+(Math.random()-.5)*1.4+curve,entry.y??0,z),entry.type,{radius:entry.radius,health:entry.health,destructible:entry.destructible,scoreValue:entry.scoreValue,speedZ:speedZ+(Math.random()-.5)*8}); obstacle._courseOffset=curve; this.obstacles.push(obstacle);} }
  _courseOffset(z){ return this.world && typeof this.world.getCourseOffset === 'function' ? this.world.getCourseOffset(z) : 0; }
  _applyCourseDrift(actor){ if(!actor || !this.world || typeof this.world.getCourseOffset !== 'function') return; const next=this.world.getCourseOffset(actor.position.z); if(actor._courseOffset === undefined) actor._courseOffset=next; const dx=next-actor._courseOffset; if(dx){ actor.position.x += dx; if(actor.group) actor.group.position.x += dx; } actor._courseOffset=next; }
  _pickWeightedConfig(entries=[{type:'rock',weight:1}]){ const total=entries.reduce((s,e)=>s+Math.max(0,e.weight||0),0); if(total<=0)return entries[0]; let r=Math.random()*total; for(const e of entries){r-=Math.max(0,e.weight||0); if(r<=0)return e;} return entries[entries.length-1]; }
  _enforceActorCaps(){ this._trimActors(this.enemies,ACTOR_CAPS.enemies); this._trimActors(this.obstacles,ACTOR_CAPS.obstacles); this._trimActors(this.pickups,ACTOR_CAPS.pickups); }
  _trimActors(list,max){ while(list.length>max){ let index=0; for(let i=1;i<list.length;i++){ if((list[i].position?.z??0)<(list[index].position?.z??0)) index=i; } list[index].destroy?.(); list.splice(index,1); } }
  reset(){ this._clearActors(); this.bonusMode.reset(); this._destroyBoss(); this.elapsed=0; this.stateElapsed=0; this.introDuration=1.6; this.nextSpawnTime=1.4; this.nextObstacleTime=3; this.nextPickupTime=9+Math.random()*5; this.difficulty=0; this.state='idle'; this.mapAnchorQueue=[]; this.bossRushQueue=[]; this.bossRushIndex=0; this.bossRushMode=false; this.activeBossConfig=null; this.stageDef=getStage(1); this.stage=this.stageDef.id; this.stageName=this.stageDef.name; this.hud.showBoss(null); }
  getEnemies(){return this.enemies;} getObstacles(){return this.obstacles;} getShootables(){ return (this.boss && this.state==='bossFight') ? this.enemies.concat(this.obstacles,[this.boss]) : this.enemies.concat(this.obstacles); } getPickups(){return this.pickups;} getState(){return this.state;} getBoss(){return this.boss;} getActorCaps(){return {...ACTOR_CAPS};}
}
