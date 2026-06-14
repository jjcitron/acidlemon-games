
class ChapterScene extends Scene {
  constructor(game, loadData=null){
    super(game);
    this.loadData=loadData;
    this.waveIndex=loadData?.waveIndex || 0;
    this.enemies=[]; this.items=[]; this.clearedWaves=new Set(loadData?.clearedWaves || []);
    this.spawnedItemWaves=new Set(loadData?.spawnedItemWaves || []); this.spawnedWaves=new Set(loadData?.spawnedWaves || []);
    this.keys=new Set(loadData?.keys || []); this.openedGates=new Set(loadData?.openedGates || []); this.talkedNpcs=new Set(loadData?.talkedNpcs || []);
    this.storyShown=new Set(); this.bannerTime=0; this.bannerText=''; this.levelComplete=false; this.completionTimer=0; this.completionText=''; this.exploreMode=false; this.exploreHintTime=0; this.backgroundNpcs=[]; this.nearGate=null; this.routePrompt=null; this.routeTravelCooldown=0; this.activeRoute=null; this.openingLine=loadData?.openingLine||''; this.openingLineTime=this.openingLine?4:0;
  }
  onEnter(){
    const lvl=this.game.data.data.level; this.level=lvl; this.game.world={...lvl.world}; this.game.camera=new Camera(CONFIG.W,CONFIG.H,this.game.world.w,this.game.world.h);
    let st=this.loadData?.stats || lvl.player_start;
    const qs=new URLSearchParams(location.search);
    let editorPlay=null;
    if(qs.get('testEditor')==='1'){ try{ editorPlay=JSON.parse(localStorage.getItem('sumiEditorPlay')||'null'); }catch(e){} }
    if(editorPlay && editorPlay.levelId===lvl.id){ st={...st,x:Math.max(lvl.world.left||0, (editorPlay.camX||0)+240), y:Math.max(lvl.world.top||0, (editorPlay.camY||0)+Math.min(610, CONFIG.H-110))}; this.waveIndex=Math.max(0, Math.min((lvl.waves||[]).length-1, editorPlay.waveIndex||0)); }
    this.player=new Player(st.x||lvl.player_start.x, st.y||lvl.player_start.y, this.game);
    if(st.hp) this.player.hp=st.hp; if(st.meter!==undefined) this.player.meter=st.meter;
    this.game.player=this.player; this.game.elements=new ElementSystem(this.game); this.game.clampToWalkable(this.player); this.game.chapterTitle=lvl.name; this.game.levelComplete=false;
    this.items=(this.loadData?.items || lvl.placed_items || []).map(i=>({...i,collected:!!i.collected,bob:Math.random()*10}));
    this.backgroundNpcs=(lvl.background_npcs || []).map(n=>({...n, phase:n.phase||Math.random()*6.28, bubbleTime:0, talkPulse:0, style:n.style || (lvl.id.includes('neon')||lvl.id.includes('chrome')||lvl.id.includes('skyway')||lvl.id.includes('time_engine')?'cyber':'feudal')}));
    if(this.loadData?.enemies){
      this.enemies=this.loadData.enemies.map(saved=>{ const e=new Enemy(saved.x,saved.y,saved.type,this.game); e.hp=saved.hp; e.maxHp=saved.maxHp||e.maxHp; e.dead=!!saved.dead; e.vx=saved.vx||0; e.vy=saved.vy||0; e.state=saved.state||'approach'; e.attackCd=saved.attackCd||1; e.spawnWaveId=saved.spawnWaveId; this.game.clampToWalkable(e); return e; });
      this.game.enemies=this.enemies;
    } else { this.enemies=[]; this.game.enemies=this.enemies; this.showStory(0,true); this.bannerText='Explore — talk with NPCs using T and hunt keys before the next gate'; this.bannerTime=4.8; this.exploreMode=true; if(editorPlay && editorPlay.levelId===lvl.id){ this.spawnWave(this.waveIndex); this.bannerText='EDITOR PLAYTEST — spawned selected wave so placed enemy labels are visible now'; this.bannerTime=4.8; } }
    this.game.lastChapterScene=this; this.game.audio?.start();
  }
  currentSubarea(){ const x=this.player?.x || 0; const areas=this.level.subareas || []; return areas.find(a=>x>=a.start && x<a.end) || areas[areas.length-1] || {name:'Road',objective:'Survive'}; }
  hasAuthoredLevelExit(){ return !!((this.level.route_nodes||[]).some(n=>n.type==='level_exit') || this.level.level_exit || (this.level.parent_level && this.game.data.data.levels?.[this.level.parent_level]?.level_exit)); }
  aliveEnemies(){ return this.enemies.filter(e=>!e.dead); }
  activeWave(){ return this.level.waves[this.waveIndex] || null; }
  bossEnemy(){ return this.enemies.find(e=>!e.dead && e.data?.boss) || this.enemies.find(e=>e.data?.boss); }
  showStory(index,force=false){ const s=this.level.story?.[index]; if(!s || (!force && this.storyShown.has(index))) return; this.storyShown.add(index); this.bannerText=s.title+' — '+s.text; this.bannerTime=5.2; this.game.ui.toast(s.title); }
  hasKey(key){ return !key || this.keys.has(key); }
  addKey(key,label='Gate key'){ if(!key || this.keys.has(key)) return; this.keys.add(key); this.game.audio?.play('key'); this.game.ui.toast(label+' acquired'); this.bannerText=label+' acquired — a sealed gate can now open'; this.bannerTime=3.5; }
  nearestTalkNpc(){ let best=null; for(const n of this.backgroundNpcs){ const d=Math.hypot((this.player.x-n.x),(this.player.y-n.y)*1.4); if(d<(n.talkRadius||240) && (!best || d<best.d)) best={n,d}; } return best?.n||null; }
  talkToNpc(n){ if(!n) return; n.bubbleTime=3.8; n.jibber=n.talk || n.jibber || '...'; this.talkedNpcs.add(n.id); this.game.audio?.play('talk'); if(n.gives_key && !this.keys.has(n.gives_key)){ this.addKey(n.gives_key, n.style==='cyber'?'Access sigil':'Iron gate key'); n.gives_key_claimed=true; } else { this.game.ui.toast(n.style==='cyber'?'Cyber civilian: '+(n.talk||'stay low'):'Villager: '+(n.talk||'be careful')); } }
  spawnWave(index){ const w=this.level.waves[index]; if(!w || this.spawnedWaves.has(w.id)) return; this.waveIndex=index; this.exploreMode=false; if(w.boss) this.game.audio?.play('boss');
    const spawned=[];
    for(const def of w.enemies){
      const enemyData=this.game.data.enemy(def.type);
      if(!enemyData){ console.error('Unknown wave enemy type', def.type, w.id); this.bannerText='Missing enemy data: '+def.type; this.bannerTime=4.0; continue; }
      const e=new Enemy(def.x,def.y,def.type,this.game);
      if(def.hp_mult){ e.maxHp=Math.max(1, Math.round(e.maxHp*def.hp_mult)); e.hp=e.maxHp; }
      if(def.scale){ e.spawnScale=def.scale; e.radius=Math.round(e.radius*def.scale); }
      this.game.clampToWalkable(e); e.spawnWaveId=w.id; spawned.push(e);
    }
    this.enemies.push(...spawned); this.spawnedWaves.add(w.id);
    this.game.enemies=this.enemies; this.bannerText=w.banner || (w.boss?'BOSS FIGHT':'Wave '+(index+1)); this.bannerTime=w.boss?5.0:3.0; this.game.wave=index+1; this.game.ui.toast(this.bannerText); }
  spawnExploreItemsForWave(w){ if(!w || this.spawnedItemWaves.has(w.id)) return; this.spawnedItemWaves.add(w.id); const area=this.level.subareas.find(a=>a.id===w.subarea) || this.currentSubarea(); const center=Math.max(area.start+180, Math.min(w.gate_x-140, (area.start+area.end)*.5));
    if(w.drops_key){ const b=this.game.walkableBand(center); this.items.push({id:w.id+'_key',kind:'key',key:w.drops_key,x:center,y:b.top+(b.bottom-b.top)*.48,collected:false,bob:Math.random()*10}); this.bannerText='The key carrier fell — collect the red gate key'; this.bannerTime=4.2; }
    const positions=[center-210, center+100]; const kinds=(this.waveIndex===0)?['health','special']:(this.waveIndex===1?['spirit','health']:['special','health']);
    for(let i=0;i<kinds.length;i++){ const x=clamp(positions[i], area.start+120, area.end-140); const b=this.game.walkableBand(x); const y=b.top+(b.bottom-b.top)*(i?.62:.42); this.items.push({id:w.id+'_'+kinds[i]+'_'+i,kind:kinds[i],x,y,collected:false,bob:Math.random()*10}); }
    this.exploreMode=true; this.exploreHintTime=6.0; this.game.ui.toast(w.drops_key?'Key dropped — search the floor':'Explorer mode: search the area'); }
  collectItem(item){ if(item.collected) return; item.collected=true; if(item.kind==='key'){ this.addKey(item.key,'Gate key'); this.game.particles.burst(item.x,item.y-35,CONFIG.COLORS.vermillion,36,270); return; }
    this.game.audio?.play('pickup'); const p=this.player;
    if(item.kind==='health'){ p.hp=clamp(p.hp+38,0,p.maxHp); this.game.ui.toast('Medicine gourd + health'); this.game.particles.burst(item.x,item.y-30,CONFIG.COLORS.jade,22,170); }
    else if(item.kind==='spirit'){ p.meter=clamp(p.meter+45,0,p.meterMax); this.game.ui.toast('Spirit charm + meter'); this.game.particles.burst(item.x,item.y-30,CONFIG.COLORS.gold,24,190); }
    else if(item.kind==='special'){ p.meter=p.meterMax; this.game.elements.unlocked.add('fire'); this.game.elements.currentElement='fire'; this.game.elements.imbueTimer=7.5; this.game.ui.toast('Fire talisman — special power ready now'); this.game.particles.burst(item.x,item.y-35,CONFIG.COLORS.fire,34,250); }
  }
  updateItems(dt){ this.exploreHintTime=Math.max(0,this.exploreHintTime-dt); for(const item of this.items){ if(item.collected) continue; item.bob=(item.bob||0)+dt*4; const dx=this.player.x-item.x, dy=this.player.y-item.y; if(Math.hypot(dx,dy)<52) this.collectItem(item); } }
  enforceGates(){ this.nearGate=null; const gates=this.level.gates||[]; for(const gate of gates){ if(this.openedGates.has(gate.id) || this.hasKey(gate.key)){ if(!this.openedGates.has(gate.id)){ this.openedGates.add(gate.id); this.game.audio?.play('gateOpen'); } continue; }
      if(Math.abs(this.player.x-gate.x)<180) this.nearGate=gate; if(this.player.x>gate.x-34){ this.player.x=gate.x-34; this.game.clampToWalkable(this.player); if(this.bannerTime<=0.2){ this.bannerText='Locked: '+(gate.hint||'Find the key before passing'); this.bannerTime=2.6; this.game.audio?.play('gateLocked'); } }
    } }
  maybeProgress(){ const w=this.activeWave(); if(!w) return; if(!this.spawnedWaves.has(w.id)){ if(this.player.x >= w.trigger_x){ this.showStory(this.waveIndex,true); this.spawnWave(this.waveIndex); } return; }
    const alive=this.aliveEnemies(); if(alive.length===0 && !this.clearedWaves.has(w.id)){ this.clearedWaves.add(w.id); if(this.game.progression?.runStats){ this.game.progression.runStats.waves=(this.game.progression.runStats.waves||0)+1; this.game.progression.runStats.kills=(this.game.progression.runStats.kills||0)+(w.enemies?.length||0); }
      this.spawnExploreItemsForWave(w); const next=this.level.waves[this.waveIndex+1]; if(next){ this.waveIndex++; const area=(this.level.subareas||[]).find(a=>a.id===next.subarea); this.bannerText=w.boss?'Boss defeated — search for supplies':'Area clear — search for keys, then push forward to '+(area?.name || 'the next scene'); this.bannerTime=4.0; }
      else if(!this.levelComplete){ if(this.hasAuthoredLevelExit()){ this.levelComplete=true; this.game.levelComplete=true; const hereHasExit=(this.level.route_nodes||[]).some(n=>n.type==='level_exit'); this.bannerText=hereHasExit?'Area secure — find the marked LEVEL EXIT door and press E':'Area secure — use the marked route door to continue exploring'; this.bannerTime=5.0; this.game.ui.toast(hereHasExit?'Find the level exit door':'Use a route door to continue'); } else { this.levelComplete=true; this.game.levelComplete=true; this.bannerText=this.level.completion_text || 'Chapter clear'; this.bannerTime=4.0; setTimeout(()=>{ if(this.game.scenes.current()===this){ const next=this.game.data.nextLevelId(this.level.id); const stats={kills:this.game.progression?.runStats?.kills||0,waves:this.clearedWaves.size,hp:Math.round(this.player.hp),meter:Math.round(this.player.meter),keys:this.keys.size}; this.game.progression.runStats.chapters=(this.game.progression.runStats.chapters||0)+1; this.game.progression.save(); this.game.scenes.replace(new StoryInterludeScene(this.game,this.level.id,next,stats)); } }, 1300); } } return; } }
  nearestRouteNode(){
    let best=null;
    for(const node of (this.level.route_nodes||[])){
      const dx=Math.abs(this.player.x-node.x), dy=Math.abs(this.player.y-node.y);
      // Generous rectangular trigger: players naturally stand on the main road below/above the painted arrow,
      // so route entry must work before their feet are exactly centered on the marker.
      const inGate=(node.type==='top_exit' && dx<260 && this.player.y>=node.y-80 && this.player.y<=node.y+300)
        || (node.type==='bottom_exit' && dx<250 && this.player.y<=node.y+55 && this.player.y>=node.y-260)
        || (node.type==='level_exit' && dx<280 && dy<210)
        || (node.type==='side_room' && dx<230 && dy<180);
      const d=Math.hypot(dx,dy*1.12);
      if(inGate && (!best || d<best.d)) best={node,d};
    }
    return best?.node||null;
  }
  routeZoneFor(node){
    if(!node) return null;
    const wanted=node.type==='top_exit'?'top_exit':(node.type==='bottom_exit'?'bottom_exit':'side_room');
    const zones=(this.level.walkable_zones||[]).filter(z=>z.kind===wanted && z.points?.length);
    if(!zones.length) return null;
    let best=null;
    for(const z of zones){
      const xs=z.points.map(p=>p[0]), ys=z.points.map(p=>p[1]);
      const cx=xs.reduce((a,b)=>a+b,0)/xs.length, cy=ys.reduce((a,b)=>a+b,0)/ys.length;
      const d=(cx-node.x)*(cx-node.x)+(cy-node.y)*(cy-node.y);
      if(!best || d<best.d) best={z,cx,cy,d,miny:Math.min(...ys),maxy:Math.max(...ys),minx:Math.min(...xs),maxx:Math.max(...xs)};
    }
    return best;
  }
  routeInputRequested(node){
    const input=this.game.input;
    // Route/room changes are deliberate now: stand on the visible exit marker, then tap E.
    // This prevents accidental room ping-pong when the player lands near the return marker.
    return input.wasPressed('E');
  }
  travelToLinkedRoom(node){
    const target=node.target_level || node.destination || node.target;
    if(node.final_exit || (node.type==='level_exit' && !target)){
      this.startLevelCompletion(node);
      return true;
    }
    if(!target) return false;
    if(!this.game.data.data.levels?.[target]){ this.bannerText='Missing linked room: '+target; this.bannerTime=3.0; this.game.ui.toast('Missing room '+target); return true; }
    const p=this.player;
    const stats={x:node.target_x ?? node.spawn_x ?? 220, y:node.target_y ?? node.spawn_y ?? 600, hp:p.hp, meter:p.meter};
    const loadData={stats, waveIndex:node.target_wave || 0, fromLevel:this.level.id, fromRoute:node.id, keys:[...this.keys], openedGates:[...this.openedGates], talkedNpcs:[...this.talkedNpcs]};
    this.routeTravelCooldown=.8;
    this.game.ui.toast((node.label || ('Entering '+target.replaceAll('_',' '))).replace(' — press E',''));
    this.game.particles.burst(p.x,p.y-22,CONFIG.COLORS.gold,30,260);
    this.game.goToLevel(target, loadData);
    return true;
  }
  startLevelCompletion(node){
    if(this.completionTimer>0) return true;
    this.levelComplete=true; this.game.levelComplete=true;
    this.completionText=this.level.completion_text || node.label || 'Chapter Complete';
    this.completionTimer=3.0;
    this.routeTravelCooldown=3.2;
    this.bannerText=this.completionText;
    this.bannerTime=3.0;
    this.game.ui.toast(this.completionText);
    this.game.audio?.play('gateOpen');
    this.game.particles.burst(this.player.x,this.player.y-38,CONFIG.COLORS.gold,46,320);
    this.player.vx=0; this.player.vy=0; this.player.state='idle'; this.player.anim?.play?.('idle');
    return true;
  }
  handleRouteExits(dt){
    this.routeTravelCooldown=Math.max(0,this.routeTravelCooldown-dt);
    const node=this.nearestRouteNode();
    this.routePrompt=node;
    if(!node || this.routeTravelCooldown>0) return;
    if(!this.routeInputRequested(node)) return;
    if(node.type==='level_exit' && !this.levelComplete){ this.bannerText='Defeat the final yakuza before using the level exit'; this.bannerTime=2.4; this.game.ui.toast('Exit locked until the arena is secure'); return; }
    if(node.type==='level_exit' || node.final_exit || node.target_level || node.destination || node.target){ this.travelToLinkedRoom(node); return; }
    const wantsTop=node.type==='top_exit', wantsBottom=node.type==='bottom_exit';
    const rz=this.routeZoneFor(node);
    if(!rz) return;
    const p=this.player;
    if(wantsTop){ p.x=rz.cx; p.y=Math.min(rz.cy, rz.miny+50); this.activeRoute={type:'top_exit',label:node.label||'Upper path'}; this.bannerText='Entered the upper path — this route is now playable, not just an arrow'; }
    else if(wantsBottom){ p.x=rz.cx; p.y=rz.maxy-26; this.activeRoute={type:'bottom_exit',label:node.label||'Lower path'}; this.bannerText='Entered the lower/foreground path — explore this room for pickups and keys'; }
    else { const dir=this.game.input.isDown('A','ArrowLeft')?-1:1; p.x=clamp(rz.cx+dir*110,rz.minx+28,rz.maxx-28); p.y=rz.cy; this.activeRoute={type:'side_room',label:node.label||'Side room'}; this.bannerText='Entered the side room — search off the main road'; }
    p.vx=0; p.vy=0; p.state='idle'; p.anim.play('idle');
    this.game.clampToWalkable(p);
    this.routeTravelCooldown=.55;
    this.bannerTime=2.8;
    this.game.ui.toast(this.activeRoute.label);
    this.game.particles.burst(p.x,p.y-22,CONFIG.COLORS.gold,26,220);
  }


  update(dt){ const g=this.game; if(this.completionTimer>0){ this.completionTimer=Math.max(0,this.completionTimer-dt); g.particles.update(dt); g.ui.update(dt); if(this.completionTimer<=0) g.scenes.replace(new MenuScene(g)); return; } if(g.input.wasPressed('P')){ g.scenes.push(new PauseScene(g)); return; } if(g.input.wasPressed('E') && g.input.isDown('Shift')){ window.LEVEL_EDITOR_ACTIVE=!window.LEVEL_EDITOR_ACTIVE; g.ui.toast(window.LEVEL_EDITOR_ACTIVE?'Path overlay on':'Path overlay off'); }
    this.openingLineTime=Math.max(0,this.openingLineTime-dt);
    if(g.input.wasPressed('T')) this.talkToNpc(this.nearestTalkNpc()); if(this.bannerTime>0) this.bannerTime=Math.max(0,this.bannerTime-dt); if(g.hitstop>0){ g.hitstop-=dt; g.particles.update(dt*.35); return; }
    this.player.update(dt,g); g.clampToWalkable(this.player); this.handleRouteExits(dt); this.enforceGates(); const active=this.activeWave(); if(active && this.spawnedWaves.has(active.id) && this.aliveEnemies().length>0){ this.player.x=clamp(this.player.x, this.game.world.left, active.gate_x); g.clampToWalkable(this.player); }
    for(const e of this.enemies){ e.update(dt,g); g.clampToWalkable(e); } this.enemies=this.enemies.filter(e=>true); g.enemies=this.enemies; this.updateItems(dt); this.updateBackgroundNpcs(dt); this.maybeProgress(); g.camera.update(this.player,dt); g.particles.update(dt); g.ui.update(dt); g.comboTime=Math.max(0,g.comboTime-dt); if(g.comboTime<=0) g.comboCount=0; if(this.player.hp<=0) g.scenes.replace(new GameOverScene(g,false)); }
  updateBackgroundNpcs(dt){ for(const n of this.backgroundNpcs){ n.phase=(n.phase||0)+dt*(2.1+((n.variant||0)%3)*0.35); n.talkPulse=(n.talkPulse||0)+dt; const near=this.player && Math.abs(this.player.x-n.x)<(n.talkRadius||220) && Math.abs(this.player.y-n.y)<230; if(near) n.bubbleTime=Math.max(n.bubbleTime||0, 1.4+((n.variant||0)%3)*0.35); else n.bubbleTime=Math.max(0,(n.bubbleTime||0)-dt); } }
  drawBackgroundNpcs(ctx){ const feudalSheet=this.game.assets.get('npc_sheet_feudal') || this.game.assets.get('npc_sheet'); const cyberSheet=this.game.assets.get('npc_sheet_cyber'); const sorted=[...this.backgroundNpcs].sort((a,b)=>a.y-b.y); const near=this.nearestTalkNpc(); for(const n of sorted){ const sheet=(n.style==='cyber'?cyberSheet:feudalSheet); const sway=Math.sin(n.phase||0)*3.5, bob=Math.sin((n.phase||0)*1.7)*1.8; const world=this.game.world||CONFIG.WORLD; const depthScale=0.62+clamp((n.y-world.top)/Math.max(1,(world.bottom-world.top)),0,1)*0.72; const scale=depthScale*(n.scale||1); ctx.save(); ctx.translate(n.x+sway,n.y+bob); ctx.globalAlpha=.92; ctx.fillStyle='rgba(3,2,1,.34)'; ctx.beginPath(); ctx.ellipse(0,18*scale,42*scale,11*scale,0,0,Math.PI*2); ctx.fill();
      if(sheet){ const cols=3, rows=2, sw=sheet.width/cols, sh=sheet.height/rows; const v=(n.variant||0)%6, sx=(v%cols)*sw, sy=Math.floor(v/cols)*sh; ctx.drawImage(sheet,sx,sy,sw,sh,-82*scale,-230*scale,164*scale,252*scale); }
      else { this.drawFeudalNpc(ctx,n,scale); }
      if(near===n){ ctx.globalAlpha=1; ctx.fillStyle='rgba(196,30,58,.92)'; ctx.strokeStyle='#050403'; ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(-72*scale,-270*scale,144*scale,30,8); ctx.fill(); ctx.stroke(); ctx.fillStyle='#f7edcf'; ctx.font=(13*scale)+'px Georgia'; ctx.textAlign='center'; ctx.fillText('T: talk',0,-250*scale); }
      if((n.bubbleTime||0)>0){ const alpha=Math.min(.95,n.bubbleTime); ctx.globalAlpha=alpha; ctx.fillStyle=n.style==='cyber'?'rgba(9,27,43,.9)':'rgba(247,237,207,.88)'; ctx.strokeStyle=n.style==='cyber'?'#00d9ff':'#050403'; ctx.lineWidth=2; const text=n.jibber||'...'; const w=Math.min(260, 42+text.length*6.5); ctx.beginPath(); ctx.roundRect(-w/2,-236*scale,w,32,7); ctx.fill(); ctx.stroke(); ctx.fillStyle=n.style==='cyber'?'#d7fbff':'#050403'; ctx.font='12px Georgia'; ctx.textAlign='center'; ctx.fillText(text,0,-215*scale); }
      ctx.restore(); } }
  drawCyberNpc(ctx,n,s){ ctx.strokeStyle='#050403'; ctx.lineWidth=3*s; const neon=['#00d9ff','#ff2ac4','#d8a742','#39ff88']; const c=neon[(n.variant||0)%neon.length]; ctx.fillStyle='#101b2f'; ctx.beginPath(); ctx.moveTo(-24*s,-130*s); ctx.lineTo(28*s,-128*s); ctx.lineTo(38*s,20*s); ctx.lineTo(-34*s,20*s); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle=c; ctx.fillRect(-18*s,-94*s,36*s,8*s); ctx.fillRect(-28*s,-52*s,56*s,6*s); ctx.fillStyle='#d7bd84'; ctx.beginPath(); ctx.arc(0,-153*s,18*s,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.strokeStyle=c; ctx.lineWidth=5*s; ctx.beginPath(); ctx.moveTo(-28*s,-86*s); ctx.lineTo(-56*s,-38*s); ctx.moveTo(28*s,-86*s); ctx.lineTo(56*s,-42*s); ctx.moveTo(-15*s,18*s); ctx.lineTo(-26*s,62*s); ctx.moveTo(15*s,18*s); ctx.lineTo(28*s,62*s); ctx.stroke(); }
  drawFeudalNpc(ctx,n,s){ const robes=['#1B2A4E','#5a2b18','#6f1f28','#61502c','#233b34','#78321d']; ctx.strokeStyle='#050403'; ctx.lineWidth=3*s; ctx.fillStyle=robes[(n.variant||0)%robes.length]; ctx.beginPath(); ctx.moveTo(0,-82*s); ctx.lineTo(34*s,34*s); ctx.lineTo(-34*s,34*s); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle='#d7bd84'; ctx.beginPath(); ctx.arc(0,-101*s,16*s,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
  drawItems(ctx){
    for(const item of this.items){
      if(item.collected) continue;
      const bob=Math.sin(item.bob||0)*5;
      const sheet=this.game.assets.getItemSheet?.(item.kind);
      const img=this.game.assets.getItemImage(item.kind);
      const meta=this.game.assets.getItemSheetMeta?.() || {frame_w:192, frame_h:192, frames:1, fps:1};
      ctx.save();
      ctx.translate(item.x,item.y+bob);
      ctx.globalAlpha=.32;
      ctx.fillStyle='#030201';
      ctx.beginPath();
      ctx.ellipse(0,10,36,12,0,0,Math.PI*2);
      ctx.fill();
      if(sheet){
        const fw=meta.frame_w||192, fh=meta.frame_h||192, frames=meta.frames||1, fps=meta.fps||8;
        const frame=Math.floor((item.bob||0)*fps/4)%frames;
        ctx.globalAlpha=1;
        ctx.drawImage(sheet,frame*fw,0,fw,fh,-58,-116,116,116);
      } else if(img){
        ctx.globalAlpha=1;
        ctx.drawImage(img,-58,-116,116,116);
      } else {
        const color=item.kind==='health'?CONFIG.COLORS.jade:(item.kind==='special'?CONFIG.COLORS.fire:CONFIG.COLORS.gold);
        ctx.globalAlpha=1; ctx.strokeStyle='#050403'; ctx.lineWidth=3; ctx.fillStyle=color;
        ctx.beginPath(); ctx.ellipse(0,-36,18,30,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha=.75;
      ctx.strokeStyle='rgba(247,237,207,.8)';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(0,-48,38,Math.PI*.14,Math.PI*.43);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawRouteNodes(ctx){
    for(const node of (this.level.route_nodes||[])){
      const near=this.player && Math.abs(this.player.x-node.x)<150 && Math.abs(this.player.y-node.y)<115;
      const isTop=node.type==='top_exit', isBottom=node.type==='bottom_exit', isLevel=node.type==='level_exit', isSide=node.type==='side_room';
      ctx.save(); ctx.translate(node.x,node.y); ctx.globalAlpha=near?0.95:0.42;
      ctx.strokeStyle=near?CONFIG.COLORS.gold:(isTop?'#d7fbff':(isBottom?'#f7b267':'#f7edcf'));
      ctx.fillStyle=isTop?'rgba(20,44,74,.38)':(isBottom?'rgba(92,37,18,.35)':'rgba(5,4,3,.38)'); ctx.lineWidth=3;
      ctx.beginPath(); ctx.ellipse(0,0,isSide?54:68,isSide?20:24,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      if(isTop){ ctx.moveTo(-32,6); ctx.lineTo(0,-42); ctx.lineTo(32,6); ctx.moveTo(0,-42); ctx.lineTo(0,30); }
      else if(isBottom){ ctx.moveTo(-32,-6); ctx.lineTo(0,42); ctx.lineTo(32,-6); ctx.moveTo(0,-30); ctx.lineTo(0,42); }
      else { ctx.moveTo(-34,0); ctx.lineTo(34,0); ctx.moveTo(18,-16); ctx.lineTo(34,0); ctx.lineTo(18,16); }
      ctx.stroke();
      if(near){ const label=(node.label || (node.target_level?'Linked route':'Explore route')).replace(' — press E',''); const action=isLevel?'LEVEL EXIT':(node.target_level?'ROUTE LINK':'ROUTE MARKER'); ctx.fillStyle='rgba(247,237,207,.94)'; ctx.strokeStyle='#050403'; ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(-196,-92,392,46,7); ctx.fill(); ctx.stroke(); ctx.fillStyle='#050403'; ctx.font='13px Georgia'; ctx.textAlign='center'; ctx.fillText(label,0,-74); ctx.fillStyle=CONFIG.COLORS.vermillion; ctx.fillText(action,0,-56); }
      ctx.restore();
    }
  }

  drawGates(ctx){ for(const gate of (this.level.gates||[])){ if(this.openedGates.has(gate.id) || this.hasKey(gate.key)) continue; ctx.save(); ctx.translate(gate.x,0); ctx.globalAlpha=.95; ctx.strokeStyle='#050403'; ctx.lineWidth=8; ctx.fillStyle='rgba(196,30,58,.72)'; ctx.fillRect(-28,430,56,240); ctx.fillRect(-92,420,184,32); ctx.strokeRect(-28,430,56,240); ctx.strokeRect(-92,420,184,32); ctx.strokeStyle='#f7edcf'; ctx.lineWidth=2; for(let y=452;y<650;y+=23){ ctx.beginPath(); ctx.moveTo(-18,y); ctx.lineTo(18,y+10); ctx.stroke(); } ctx.fillStyle='#f7edcf'; ctx.font='15px Georgia'; ctx.textAlign='center'; ctx.fillText('LOCKED',0,407); ctx.restore(); } }
  drawBossHud(ctx){ const b=this.bossEnemy(); if(!b || b.dead) return; ctx.save(); this.game.ui.plaque(ctx,310,32,660,62); ctx.fillStyle='#150b08'; ctx.fillRect(365,68,550,13); ctx.fillStyle=CONFIG.COLORS.vermillion; ctx.fillRect(365,68,550*(b.hp/b.maxHp),13); ctx.strokeStyle='#f7edcf'; ctx.strokeRect(365,68,550,13); ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='18px Georgia'; ctx.textAlign='center'; ctx.fillText('BOSS — '+(b.type||'Champion').replaceAll('_',' ').toUpperCase(),640,58); ctx.restore(); }
  drawOpeningLine(ctx){ if(!this.openingLine || this.openingLineTime<=0 || !this.player) return; const sx=this.player.x-(this.game.camera?.x||0), sy=this.player.y-(this.game.camera?.y||0); ctx.save(); ctx.globalAlpha=Math.min(1,this.openingLineTime); ctx.textAlign='center'; ctx.font='20px Georgia'; ctx.fillStyle='rgba(5,4,3,.76)'; ctx.beginPath(); ctx.roundRect(sx-96,sy-238,192,34,8); ctx.fill(); ctx.strokeStyle=CONFIG.COLORS.gold; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle=CONFIG.COLORS.cream; ctx.fillText(this.openingLine,sx,sy-215); ctx.restore(); }
  drawBanner(ctx){ const area=this.currentSubarea(); ctx.save(); if(this.bannerTime>0){ ctx.globalAlpha=Math.min(1,this.bannerTime); this.game.ui.plaque(ctx,230,120,820,84); ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='20px Georgia'; ctx.textAlign='center'; ctx.fillText(this.bannerText,640,165); }
    this.game.ui.plaque(ctx,28,592,710,100); ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='18px Georgia'; ctx.textAlign='left'; const routeName=this.activeRoute?(' — '+this.activeRoute.label):''; ctx.fillText(area.name + routeName + (this.exploreMode && this.aliveEnemies().length===0 ? ' — Explore' : ''),48,622); ctx.font='14px Georgia'; ctx.fillText(area.objective || '',48,648); ctx.fillStyle=CONFIG.COLORS.gold; let prompt='Keys: '+this.keys.size+'    Move / J light / K heavy / Shift dodge / Space jump / P pause'; if(this.nearGate&&!this.hasKey(this.nearGate.key)) prompt='LOCKED GATE: defeat key carriers.'; if(this.routePrompt){ prompt=this.routePrompt.type==='level_exit'?'LEVEL EXIT nearby':'Route marker nearby'; } ctx.fillText(prompt,48,672); ctx.restore(); this.drawBossHud(ctx); }
  drawCompletionOverlay(ctx){ if(this.completionTimer<=0) return; ctx.save(); ctx.globalAlpha=.78; ctx.fillStyle='#050403'; ctx.fillRect(0,0,CONFIG.W,CONFIG.H); ctx.globalAlpha=Math.min(1,3.1-this.completionTimer); this.game.ui.plaque(ctx,250,270,780,132); ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='32px Georgia'; ctx.textAlign='center'; ctx.fillText(this.completionText || 'Chapter Complete',640,326); ctx.fillStyle=CONFIG.COLORS.gold; ctx.font='18px Georgia'; ctx.fillText('Returning to the menu...',640,366); ctx.restore(); }
  draw(ctx){ const g=this.game, shake=g.particles.shake; ctx.save(); ctx.clearRect(0,0,CONFIG.W,CONFIG.H); ctx.translate(rand(-shake,shake),rand(-shake,shake)); g.drawBackground(ctx); g.drawLevelEditorOverlay(ctx); ctx.save(); g.camera.applyTo(ctx); this.drawGates(ctx); this.drawRouteNodes(ctx); this.drawBackgroundNpcs(ctx); this.drawItems(ctx); const actors=[...this.enemies,this.player].sort((a,b)=>a.y-b.y); for(const a of actors) a.draw(ctx,g.assets,g); g.particles.draw(ctx); ctx.restore(); ctx.restore(); g.ui.drawHud(ctx,g); this.drawBanner(ctx); this.drawOpeningLine(ctx); this.drawCompletionOverlay(ctx); }
}
window.ChapterScene=ChapterScene;
