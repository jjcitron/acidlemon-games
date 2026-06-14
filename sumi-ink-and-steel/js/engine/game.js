class Game {
  constructor(){ this.canvas=document.getElementById('gameCanvas'); this.ctx=this.canvas.getContext('2d'); this.input=new Input(); this.data=new DataManager(); this.assets=new Assets(); this.events=new EventBus(); this.ui=new UI(); this.audio=new AudioSystem(); this.progression=new ProgressionSystem(); this.save=new SaveSystem(this); this.particles=new ParticleSystem(); this.combat=new CombatSystem(this); this.elements=null; this.scenes=new SceneStack(this); this.player=null; this.enemies=[]; this.world={left:70,right:2490,top:320,bottom:640,w:2560,h:720}; this.camera=new Camera(1280,720,2560,720); this.last=0; this.hitstop=0; this.wave=1; this.comboCount=0; this.comboTime=0; this.transition=null; this.transitionBusy=false; this.bgScratches=[]; for(let i=0;i<360;i++) this.bgScratches.push({x:rand(0,2560),y:rand(0,720),l:rand(20,160),a:rand(.03,.16)}); }
  async init(){ await this.data.loadAll(); this.progression.hydrate(this.data.data); await this.assets.loadAll(this.data.data); this.world={...this.data.data.level.world}; this.camera=new Camera(CONFIG.W,CONFIG.H,this.world.w,this.world.h); await this.assets.loadLevelBackgrounds(this.data.data.level); if(new URLSearchParams(location.search).get('skipIntro')==='1') this.startNewGame(new URLSearchParams(location.search).get('level') || this.data.data.currentLevelId); else this.scenes.replace(new IntroScene(this)); requestAnimationFrame(t=>this.loop(t)); }
  loop(t){ const dt=Math.min(.033,(t-this.last)/1000||.016); this.last=t; this.input.update?.(); this.scenes.update(dt); this.scenes.draw(this.ctx); this.updateTransition(dt); this.drawTransitionOverlay(this.ctx); if(this.input.wasPressed('M')) this.ui.toast('Audio '+(this.audio.toggle()?'on':'off')); if(['Enter','J','K','Space','E','T'].some(k=>this.input.wasPressed(k))) this.audio.start(); this.input.endFrame(); requestAnimationFrame(tt=>this.loop(tt)); }
  startNewGame(levelId=null, opts={}){ this.wave=1; if(levelId) this.data.setLevel(levelId); else this.data.setLevel(this.data.data.levelSequence?.start || 'chapter1_dojo'); const shouldPlayOpening=!opts.skipOpening && this.data.data.currentLevelId==='chapter1_dojo' && new URLSearchParams(location.search).get('skipOpening')!=='1'; if(shouldPlayOpening){ this.scenes.replace(new OpeningCutsceneScene(this,this.data.data.currentLevelId)); return; } this.assets.loadLevelBackgrounds(this.data.data.level).then(()=>this.scenes.replace(new ChapterScene(this, opts.openingLine ? {openingLine:opts.openingLine} : null))); }
  loadGame(slot){ const data=this.save.load(slot); if(data){ this.wave=data.wave||1; this.scenes.replace(new ChapterScene(this,data)); } else this.ui.toast('Save '+slot+' is empty'); }
  sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }
  async goToLevel(levelId, loadData=null){
    if(this.transitionBusy) return;
    this.transitionBusy=true;
    this.audio?.play('ui');
    this.transition={phase:'in',t:0,duration:.45,message:loadData?.fromLevel?'crossing a threshold':'crossing into another world'};
    await this.sleep(460);
    this.wave=loadData?.wave || 1; this.data.setLevel(levelId); await this.assets.loadLevelBackgrounds(this.data.data.level); this.scenes.replace(new ChapterScene(this, loadData));
    this.transition={phase:'out',t:0,duration:.52,message:this.data.data.level?.title || levelId.replaceAll('_',' ')};
    await this.sleep(540);
    this.transition=null; this.transitionBusy=false;
  }
  updateTransition(dt){ if(this.transition) this.transition.t=Math.min(this.transition.duration, this.transition.t+dt); }
  drawTransitionOverlay(ctx){
    const tr=this.transition; if(!tr) return;
    const p=Math.min(1,tr.t/Math.max(.001,tr.duration)); const ease=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const cover=tr.phase==='in'?ease:(1-ease); if(cover<=0.001) return;
    const w=CONFIG.W*(1.05*cover), x=tr.phase==='in'?-CONFIG.W+w:CONFIG.W-w;
    ctx.save(); ctx.globalAlpha=Math.min(1,.2+cover*.9);
    const img=this.assets.get('transition_panel');
    if(img) ctx.drawImage(img,x,0,CONFIG.W,CONFIG.H); else { const g=ctx.createLinearGradient(x,0,x+CONFIG.W,CONFIG.H); g.addColorStop(0,'#0e1730'); g.addColorStop(.55,'#1b2a4e'); g.addColorStop(1,'#733018'); ctx.fillStyle=g; ctx.fillRect(x,0,CONFIG.W,CONFIG.H); }
    ctx.fillStyle='rgba(5,4,3,.34)'; ctx.fillRect(x,0,CONFIG.W,CONFIG.H);
    ctx.strokeStyle='rgba(247,237,207,.72)'; ctx.lineWidth=6; ctx.strokeRect(x+18,18,CONFIG.W-36,CONFIG.H-36);
    ctx.globalAlpha=Math.min(1,cover*1.2); ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='26px Georgia'; ctx.textAlign='center'; ctx.fillText('墨の境を渡る',x+CONFIG.W/2,CONFIG.H-92); ctx.font='15px Georgia'; ctx.fillText((tr.message||'crossing').toUpperCase(),x+CONFIG.W/2,CONFIG.H-62);
    ctx.restore();
  }
  nextWaveOrRestart(){ this.wave++; this.scenes.replace(new ChapterScene(this,{wave:this.wave})); }
  drawBackdrop(ctx){ ctx.clearRect(0,0,CONFIG.W,CONFIG.H); this.drawBackground(ctx,false); }
  drawBackground(ctx, useCamera=true){
    const camX=useCamera?this.camera.x:0;
    const camY=useCamera?this.camera.y:0;
    const worldW=this.world?.w || 5400;
    if(this.assets?.backgroundKeys?.length >= 1){
      this.drawGeneratedChapter1Background(ctx, camX, worldW, camY);
      return;
    }
    // Fallback procedural background if generated plates are unavailable.
    const g=ctx.createLinearGradient(0,0,0,CONFIG.H);
    g.addColorStop(0,'#161126'); g.addColorStop(.34,'#2d1830'); g.addColorStop(.62,'#733018'); g.addColorStop(1,'#120b09');
    ctx.fillStyle=g; ctx.fillRect(0,0,CONFIG.W,CONFIG.H);
    ctx.save(); ctx.translate(-camX,0); ctx.fillStyle='#3a2116'; ctx.fillRect(0,300,worldW,420); ctx.restore();
  }
  drawGeneratedChapter1Background(ctx, camX, worldW, camY=0){
    ctx.clearRect(0,0,CONFIG.W,CONFIG.H);
    const keys=this.assets.backgroundKeys;
    const segments=this.chapter1Segments(keys);
    const sky=ctx.createLinearGradient(0,0,0,CONFIG.H);
    sky.addColorStop(0,'#0b1020'); sky.addColorStop(.5,'#151a2c'); sky.addColorStop(1,'#170b08');
    ctx.fillStyle=sky; ctx.fillRect(0,0,CONFIG.W,CONFIG.H);

    // Far parallax underpaint: low-alpha copies bridge the images and prevent postcard seams.
    for(const seg of segments){
      const img=this.assets.get(seg.key); if(!img) continue;
      const x=seg.start - camX*.34;
      const w=(seg.end-seg.start)*.95;
      ctx.save(); ctx.globalAlpha=.26; ctx.filter='blur(1.6px) saturate(.82) brightness(.62)';
      ctx.drawImage(img, x-230, -camY*.18, w+460, Math.max(640, CONFIG.H+camY*.18));
      ctx.restore();
    }

    // Main plates overlap. At overlap zones, both plates are visible through a wide crossfade.
    for(let i=0;i<segments.length;i++){
      const seg=segments[i]; const img=this.assets.get(seg.key); if(!img) continue;
      const dx=seg.start-camX, dw=seg.end-seg.start;
      ctx.save();
      ctx.globalAlpha=this.segmentVisibilityAlpha(dx,dw);
      ctx.drawImage(img, dx, -camY, dw, Math.max(CONFIG.H, this.world?.h || CONFIG.H));
      ctx.restore();
    }

    // Wide transition veils at world seams, using palette colors from the adjoining zones.
    const seams=(this.data?.data?.level?.background_segments||[]).slice(1).map(s=>s.start);
    for(const seam of seams){
      const sx=seam-camX;
      if(sx<-420 || sx>CONFIG.W+420) continue;
      const grad=ctx.createLinearGradient(sx-360,0,sx+360,0);
      grad.addColorStop(0,'rgba(9,8,12,0)');
      grad.addColorStop(.5,'rgba(9,8,12,.32)');
      grad.addColorStop(1,'rgba(9,8,12,0)');
      ctx.fillStyle=grad; ctx.fillRect(sx-360,0,720,CONFIG.H);
      ctx.save(); ctx.globalAlpha=.18; ctx.strokeStyle='#ead8ac'; ctx.lineWidth=1;
      for(let y=40;y<690;y+=27){ ctx.beginPath(); ctx.moveTo(sx-330,y); ctx.bezierCurveTo(sx-140,y+12,sx+120,y-12,sx+330,y+8); ctx.stroke(); }
      ctx.restore();
    }

    // Explicit walkable-path glaze and edges. This makes the allowed floor read as a space,
    // not a rectangle over background buildings.
    ctx.save(); ctx.translate(-camX,-camY);
    this.drawWalkablePathOverlay(ctx, worldW);
    ctx.restore();

    // Rain/ash/scratch layer, world-space.
    ctx.save(); ctx.translate(-camX,-camY);
    ctx.strokeStyle='#f3e7c8';
    for(const s of this.bgScratches){
      const x=s.x%worldW; ctx.globalAlpha=s.a*.58; ctx.lineWidth=.75; ctx.beginPath(); ctx.moveTo(x,s.y); ctx.lineTo(x-10,s.y+s.l*.72); ctx.stroke();
    }
    ctx.globalAlpha=1; ctx.restore();

    const vg=ctx.createRadialGradient(640,360,150,640,360,780);
    vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(.74,'rgba(0,0,0,.10)'); vg.addColorStop(1,'rgba(0,0,0,.50)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,CONFIG.W,CONFIG.H);
  }
  chapter1Segments(keys){
    const segs=this.data?.data?.level?.background_segments;
    if(segs?.length){
      return segs.map(s=>({key:keys[s.key_index ?? s.keyIndex ?? 0], start:s.start, end:s.end, name:s.name||s.id||''})).filter(s=>s.key);
    }
    const worldW=this.world?.w || 6720;
    const step=worldW/Math.max(1,keys.length);
    return keys.map((key,i)=>({key,start:Math.max(0,i*step-220),end:Math.min(worldW,(i+1)*step+220),name:'segment_'+i}));
  }
  segmentVisibilityAlpha(dx,dw){
    const fade=360;
    let a=1;
    if(dx>0) a=Math.min(a, Math.max(0, (CONFIG.W-dx)/fade));
    if(dx+dw<CONFIG.W) a=Math.min(a, Math.max(0, (dx+dw)/fade));
    return Math.max(0, Math.min(1,a));
  }
  walkableZones(){ return this.data?.data?.level?.walkable_zones || []; }
  pointInPolygon(pt, poly){
    let inside=false; const x=pt.x, y=pt.y;
    // Treat edge/boundary points as inside so clamped actors never jitter on polygon borders.
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const ax=poly[j][0], ay=poly[j][1], bx=poly[i][0], by=poly[i][1];
      const q=this.closestPointOnSegment(x,y,ax,ay,bx,by);
      if(Math.hypot(q.x-x,q.y-y) <= 1.25) return true;
    }
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
      const intersect=((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi+0.00001)+xi);
      if(intersect) inside=!inside;
    }
    return inside;
  }
  closestPointOnSegment(px,py,ax,ay,bx,by){
    const abx=bx-ax, aby=by-ay; const len=abx*abx+aby*aby || 1;
    let t=((px-ax)*abx+(py-ay)*aby)/len; t=Math.max(0,Math.min(1,t));
    return {x:ax+abx*t,y:ay+aby*t};
  }
  nearestPointOnPolygon(pt, poly){
    let best={x:poly[0][0],y:poly[0][1],d:Infinity};
    for(let i=0;i<poly.length;i++){
      const a=poly[i], b=poly[(i+1)%poly.length];
      const q=this.closestPointOnSegment(pt.x,pt.y,a[0],a[1],b[0],b[1]);
      const d=(q.x-pt.x)*(q.x-pt.x)+(q.y-pt.y)*(q.y-pt.y);
      if(d<best.d) best={x:q.x,y:q.y,d};
    }
    return best;
  }
  walkableBand(x){
    const zones=this.walkableZones();
    if(zones.length){
      const spans=zones.filter(z=>z.points?.length).map(z=>{
        const xs=z.points.map(p=>p[0]), ys=z.points.map(p=>p[1]); return {minx:Math.min(...xs), maxx:Math.max(...xs), top:Math.min(...ys), bottom:Math.max(...ys)};
      }).filter(s=>x>=s.minx-12 && x<=s.maxx+12);
      if(spans.length){ const top=Math.min(...spans.map(s=>s.top)), bottom=Math.max(...spans.map(s=>s.bottom)); return {top,bottom}; }
    }
    let top=520, bottom=650; return {top,bottom};
  }
  clampToWalkable(entity){
    if(!entity) return;
    entity.x=clamp(entity.x,this.world.left,this.world.right);
    entity.y=clamp(entity.y,this.world.top,this.world.bottom);
    const zones=this.walkableZones().filter(z=>z.points?.length);
    if(!zones.length){ const b=this.walkableBand(entity.x); entity.y=clamp(entity.y,b.top,b.bottom); return; }
    const pt={x:entity.x,y:entity.y};
    for(const z of zones){ if(this.pointInPolygon(pt,z.points)) return; }
    let best=null;
    for(const z of zones){ const q=this.nearestPointOnPolygon(pt,z.points); if(!best || q.d<best.d) best=q; }
    if(best){ entity.x=clamp(best.x,this.world.left,this.world.right); entity.y=clamp(best.y,this.world.top,this.world.bottom); }
  }
  drawWalkablePathOverlay(ctx, worldW){
    const zones=this.walkableZones().filter(z=>z.points?.length);
    ctx.save();
    if(zones.length){
      for(const z of zones){
        ctx.beginPath(); z.points.forEach((p,i)=>{ if(i) ctx.lineTo(p[0],p[1]); else ctx.moveTo(p[0],p[1]); }); ctx.closePath();
        ctx.globalAlpha=.052; ctx.fillStyle='#0a0503'; ctx.fill();
        ctx.globalAlpha=.09; ctx.strokeStyle='rgba(238,216,170,.18)'; ctx.lineWidth=2; ctx.stroke();
      }
      ctx.restore(); return;
    }
    ctx.globalAlpha=.055; ctx.fillStyle='#0a0503';
    for(let x=70;x<worldW;x+=240){ const b=this.walkableBand(x); const y=(b.top+b.bottom)*.58; ctx.beginPath(); ctx.ellipse(x,y+50,150,23,Math.sin(x)*.05,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
  }

  drawLevelEditorOverlay(ctx){
    if(!window.LEVEL_EDITOR_ACTIVE) return;
    const camX=this.camera?.x||0, camY=this.camera?.y||0; const zones=this.walkableZones();
    ctx.save(); ctx.translate(-camX,-camY);
    zones.forEach((z,zi)=>{
      if(!z.points?.length) return;
      ctx.beginPath(); z.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.closePath();
      ctx.fillStyle='rgba(255,200,40,.12)'; ctx.fill(); ctx.strokeStyle='rgba(255,240,190,.95)'; ctx.lineWidth=3; ctx.stroke();
      z.points.forEach((p,pi)=>{ ctx.fillStyle=pi===window.LEVEL_EDITOR_POINT?'#ff2a1a':'#f7edcf'; ctx.beginPath(); ctx.arc(p[0],p[1],8,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#050403'; ctx.stroke(); });
    });
    ctx.restore();
    ctx.save(); this.ui.plaque(ctx,820,28,430,92); ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='15px Georgia'; ctx.textAlign='left';
    ctx.fillText('PATH EDITOR ACTIVE',842,56); ctx.font='12px Georgia';
    ctx.fillText('Open editor.html for full editing/export. In game: polygons are enforced.',842,80);
    ctx.fillText('Press E to hide/show path overlay.',842,100); ctx.restore();
  }

  drawPlateFeather(ctx, dx, dw, i){
    // Legacy helper retained for fallback callers; main renderer now uses wide seam veils.
    const left=ctx.createLinearGradient(dx,0,dx+220,0);
    left.addColorStop(0,'rgba(8,5,4,.28)'); left.addColorStop(1,'rgba(8,5,4,0)');
    ctx.fillStyle=left; ctx.fillRect(dx,0,220,CONFIG.H);
    const right=ctx.createLinearGradient(dx+dw-240,0,dx+dw,0);
    right.addColorStop(0,'rgba(8,5,4,0)'); right.addColorStop(1,'rgba(8,5,4,.28)');
    ctx.fillStyle=right; ctx.fillRect(dx+dw-240,0,240,CONFIG.H);
  }

  drawDojoArea(ctx,x0,x1){
    ctx.fillStyle='#0d0907'; ctx.fillRect(x0+20,205,1080,122);
    ctx.fillStyle='#2f1910'; for(let i=0;i<6;i++){ const x=x0+40+i*190; ctx.beginPath(); ctx.moveTo(x,206); ctx.lineTo(x+95,138); ctx.lineTo(x+210,206); ctx.fill(); }
    ctx.strokeStyle='#050403'; ctx.lineWidth=9; for(let x=x0+90;x<x1;x+=170){ ctx.beginPath(); ctx.moveTo(x,205); ctx.lineTo(x,326); ctx.stroke(); }
    ctx.fillStyle='#c7832e'; for(let x=x0+180;x<x1;x+=290){ ctx.fillRect(x,232,42,70); ctx.fillStyle='rgba(255,94,22,.5)'; ctx.beginPath(); ctx.arc(x+21,226,28,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#c7832e'; }
    ctx.fillStyle='rgba(5,4,3,.35)'; ctx.fillRect(x0+140,330,820,18);
    ctx.fillStyle='#e8d6a3'; ctx.font='18px Georgia'; ctx.fillText('HIDEO DOJO',x0+420,258);
  }
  drawGardenArea(ctx,x0,x1){
    ctx.fillStyle='#1d2a1e'; for(let x=x0+40;x<x1;x+=115){ ctx.beginPath(); ctx.arc(x,285+Math.sin(x)*12,48,0,Math.PI*2); ctx.fill(); }
    ctx.strokeStyle='#050403'; ctx.lineWidth=5; for(let x=x0+80;x<x1;x+=160){ ctx.beginPath(); ctx.moveTo(x,230); ctx.lineTo(x-18,325); ctx.stroke(); }
    ctx.fillStyle='#5a8f72'; for(let x=x0+120;x<x1;x+=230){ ctx.beginPath(); ctx.ellipse(x,352,72,22,0,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#b13a24'; for(let x=x0+240;x<x1;x+=310){ ctx.fillRect(x,238,34,76); ctx.fillStyle='rgba(255,90,30,.55)'; ctx.beginPath(); ctx.arc(x+17,232,24,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#b13a24'; }
  }
  drawVillageArea(ctx,x0,x1){
    for(let i=0;i<7;i++){ const x=x0+80+i*210; const h=110+((i%3)*28); ctx.fillStyle=i%2?'#26130d':'#34180d'; ctx.fillRect(x,300-h,150,h); ctx.fillStyle='#120906'; ctx.beginPath(); ctx.moveTo(x-20,300-h); ctx.lineTo(x+75,235-h); ctx.lineTo(x+170,300-h); ctx.fill(); ctx.fillStyle='rgba(255,76,18,.55)'; ctx.beginPath(); ctx.moveTo(x+30,300-h); ctx.lineTo(x+55,250-h-rand(10,50)); ctx.lineTo(x+82,300-h); ctx.fill(); }
    ctx.strokeStyle='rgba(255,128,33,.65)'; ctx.lineWidth=4; for(let x=x0+60;x<x1;x+=130){ ctx.beginPath(); ctx.moveTo(x,302); ctx.lineTo(x+rand(-30,30),230+rand(-40,30)); ctx.stroke(); }
    ctx.fillStyle='rgba(5,4,3,.45)'; for(let x=x0+120;x<x1;x+=260){ ctx.fillRect(x,548,120,28); }
  }
  drawForestArea(ctx,x0,x1){
    ctx.fillStyle='#07120e'; for(let x=x0;x<x1;x+=70){ ctx.beginPath(); ctx.moveTo(x,316); ctx.lineTo(x+32,170+Math.sin(x)*55); ctx.lineTo(x+68,316); ctx.fill(); }
    ctx.strokeStyle='#050403'; ctx.lineWidth=8; for(let x=x0+40;x<x1;x+=130){ ctx.beginPath(); ctx.moveTo(x,250); ctx.lineTo(x-12,470); ctx.stroke(); }
    ctx.fillStyle='rgba(232,216,170,.12)'; for(let x=x0+120;x<x1;x+=360){ ctx.beginPath(); ctx.ellipse(x,420,120,24,-.08,0,Math.PI*2); ctx.fill(); }
  }
}
window.addEventListener('load',()=>{ window.game=new Game(); window.game.init().catch(err=>{ console.error(err); }); });
