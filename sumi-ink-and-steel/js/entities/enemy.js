class Enemy extends Entity {
  constructor(x,y,type,game){
    super(x,y);
    this.type = type;
    this.data = game.data.enemy(type);
    this.game = game;
    this.maxHp = this.data.max_hp;
    this.hp = this.maxHp;
    this.radius = 31;
    this.state = 'approach';
    this.stateTime = 0;
    this.attackCd = Math.random() * (this.data.attack_cooldown_max_sec - this.data.attack_cooldown_min_sec) + this.data.attack_cooldown_min_sec;
    this.attackDone = false;
    this.ai = new BrawlerAI();
    this.hitFlash = 0;
    this.facing = -1;
    this.atlasFacingSign = -1; // phase3s1_mirrorx1: yakuza atlas PNGs are mirrored on X, so invert draw sign to keep AI-facing correct
    this.depthScale = (game) => Entity.prototype.depthScale.call(this, game);
    
    // Atlas setup
    this.atlasImage = game.assets.getEnemyImage(type);
    const meta = game.assets.getEnemyMeta(type);
    this.useAtlas = !!(this.atlasImage && meta && meta.animations);
    this.anim = this.useAtlas ? new AnimationPlayer(meta) : null;

    if (this.anim) this.anim.play('idle');
    this.deathAnimStarted = false;
    this.deathHoldTimer = 0;
    this.hitAnimTimer = 0;
    this.hitAnimRestart = false;
    this.pistolCd = this.data.flintlock ? 1.2 : 0;
    this.pistolTelegraph = 0;
    this.pistolFired = false;
  }
  
  update(dt,game){
    if(this.dead){
      this.physics(dt,game.world);
      if(this.anim){
        if(!this.deathAnimStarted){ this.anim.play('death', true); this.deathAnimStarted = true; }
        this.anim.update(dt);
      }
      this.deathHoldTimer += dt;
      return;
    }
    
    if(this.data.flintlock && this.updateFlintlock(dt, game)) return;
    
    if(this.hitAnimTimer > 0){ this.hitAnimTimer = Math.max(0, this.hitAnimTimer - dt); }
    this.ai.update(this,dt,game);
    this.physics(dt,game.world);
    
    if(this.anim){
      if(this.dead) this.anim.play('death');
      else if(this.hitAnimTimer > 0){
        this.anim.play('hit', this.hitAnimRestart);
        this.hitAnimRestart = false;
      }
      else if(this.state === 'attack'){
        // Use the full authored attack cycle instead of tiny sub-clips. Ninja variants
        // have behavior-specific ranged/bomb/poison animations, while melee enemies use attack.
        const behavior = this.data?.behavior || '';
        let clip = 'attack';
        if(behavior === 'bomb') clip = 'bomb_throw';
        else if(behavior === 'poison') clip = 'poison_dart';
        else if(behavior === 'ranged' || behavior === 'caster_ward' || behavior === 'caster_curse' || behavior === 'aerial') clip = 'ranged_throw';
        this.anim.play(clip);
      }
      else if(this.state === 'approach' || this.state === 'chase'){
        // BrawlerAI moves enemies directly, so vx is not a reliable walk detector.
        // If the AI is in approach/chase, force the walking cycle even when knockback velocity is zero.
        this.anim.play('walk');
      }
      else if(this.state === 'hit') this.anim.play('hit');
      else this.anim.play('idle');
      
      this.anim.update(dt);
    }
  }
  
  draw(ctx,assets,game){
    const s = this.depthScale(game);
    this.shadow(ctx,game);
    ctx.save();
    ctx.globalAlpha = 1; // keep dead yakuza bodies solid on the ground
    
    if(this.useAtlas && this.atlasImage && this.anim){
      // Yakuza atlas is drawn slightly smaller than the full 192x256 cell so the full-body enemy
      // reads as a bulky human opponent beside Masayoshi, not a giant cut-off poster.
      this.anim.draw(ctx, this.atlasImage, this.x, this.y, this.facing * (this.atlasFacingSign || 1), s * 0.78 * (this.spawnScale || 1));
    } else {
      this.drawPolygon(ctx,assets,game,s);
    }
    
    this.drawFlintlockTell(ctx,game,s);
    
    if(this.hitFlash > 0){
      ctx.globalAlpha = Math.min(0.75, this.hitFlash / 0.12);
      ctx.strokeStyle = '#f7edcf';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(this.x, this.y-82*s, 42*s, 70*s, 0.1, 0, Math.PI*2); ctx.stroke();
      ctx.globalAlpha = Math.min(0.28, this.hitFlash / 0.36);
      ctx.fillStyle = CONFIG.COLORS.vermillion;
      ctx.beginPath(); ctx.arc(this.x-this.facing*12, this.y-78*s, 28*s, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    
    // HP bar
    if(this.hp > 0 && this.hp < this.maxHp){
      ctx.fillStyle = '#150b08';
      ctx.fillRect(this.x-28, this.y-168, 56, 6);
      ctx.fillStyle = '#9b2d2d';
      ctx.fillRect(this.x-28, this.y-168, 56 * (this.hp / this.maxHp), 6);
    }
  }
  
  drawPolygon(ctx,assets,game,s){
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.facing * s, s);
    ctx.globalAlpha = 1; // keep dead yakuza bodies solid on the ground
    
    ctx.fillStyle = this.data.body_color || '#34221a';
    ctx.strokeStyle = '#050403';
    ctx.lineWidth = 5;
    this.poly(ctx, [[-28,-118],[28,-122],[43,-25],[20,2],[-24,0],[-45,-28]]);
    
    ctx.fillStyle = '#b88f69';
    this.poly(ctx, [[-22,-164],[22,-166],[34,-132],[16,-112],[-20,-116],[-34,-138]]);
    
    ctx.fillStyle = '#070606';
    this.poly(ctx, [[-29,-171],[18,-184],[40,-150],[-10,-146]]);
    
    ctx.fillStyle = this.data.sash_color || '#6b1e19';
    ctx.fillRect(-38, -78, 76, 13);
    
    ctx.strokeStyle = this.state==='attack' ? '#e8d8aa' : '#050403';
    ctx.lineWidth = this.state==='attack' ? 8 : 5;
    ctx.beginPath();
    ctx.moveTo(20, -90);
    ctx.lineTo(76, -66);
    ctx.stroke();
    
    ctx.strokeStyle = '#050403';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-20, 46);
    ctx.moveTo(18, -2);
    ctx.lineTo(32, 46);
    ctx.stroke();
    
    ctx.restore();
  }
  
  poly(ctx,pts){
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  
  shadow(ctx,game){
    const s = this.depthScale(game);
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#030201';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y+5, 38*s, 12*s, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  

  updateFlintlock(dt,game){
    const p=game.player;
    const dx=p.x-this.x, dy=p.y-this.y;
    const lane=Math.abs(dy) < 62;
    const dist=Math.abs(dx);
    this.pistolCd=Math.max(0,this.pistolCd-dt);
    if(this.state==='shoot'){
      this.stateTime += dt;
      this.facing = dx>=0 ? 1 : -1;
      this.vx=approach(this.vx,0,dt*900); this.vy=approach(this.vy,0,dt*900);
      this.physics(dt,game.world);
      if(this.anim){ this.anim.play(this.stateTime < (this.data.pistol_windup_sec||1.0)*0.65 ? 'attack_windup':'attack_strike'); this.anim.update(dt); }
      if(!this.pistolFired && this.stateTime >= (this.data.pistol_windup_sec||1.0)){
        this.pistolFired=true;
        game.audio?.play('enemySwing');
        game.particles.burst(this.x+this.facing*44,this.y-112,'#f7edcf',16,210);
        game.particles.shake=Math.max(game.particles.shake,10);
        const hitLane=Math.abs(p.y-this.y)<58;
        const forward=(p.x-this.x)*this.facing>0;
        if(hitLane && forward && Math.abs(p.x-this.x)<(this.data.pistol_range||420) && p.invuln<=0){
          p.takeHit(this.data.pistol_damage||18,this.facing*260,-26,game);
          game.ui.toast('Flintlock shot');
        } else game.ui.toast('Shot dodged');
      }
      if(this.stateTime > (this.data.pistol_windup_sec||1.0)+0.55){
        this.state='approach'; this.stateTime=0; this.pistolCd=this.data.pistol_cooldown_sec||3.5; this.pistolFired=false;
      }
      return true;
    }
    if(this.pistolCd<=0 && lane && dist>120 && dist<(this.data.pistol_range||420)){
      this.state='shoot'; this.stateTime=0; this.pistolFired=false; this.facing=dx>=0?1:-1; game.audio?.play('enemyWindup'); game.ui.toast('Pistol tell — dodge!'); return true;
    }
    return false;
  }

  drawFlintlockTell(ctx,game,s){
    if(!this.data.flintlock || this.state!=='shoot' || this.pistolFired) return;
    const t=Math.min(1,this.stateTime/(this.data.pistol_windup_sec||1));
    ctx.save();
    ctx.globalAlpha=0.25+0.55*t;
    ctx.strokeStyle=t>.75?'#ff2828':'#f7edcf';
    ctx.lineWidth=2+4*t;
    ctx.setLineDash([18,10]);
    ctx.beginPath();
    ctx.moveTo(this.x+this.facing*28,this.y-105);
    ctx.lineTo(this.x+this.facing*(this.data.pistol_range||420),this.y-105);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,40,40,.16)';
    ctx.fillRect(Math.min(this.x,this.x+this.facing*(this.data.pistol_range||420)),this.y-134,Math.abs(this.data.pistol_range||420),58);
    ctx.restore();
  }

  takeHit(dmg,kx,ky,game){
    const elemId = game?.elements?.currentElement || null;
    const pstate = game?.player?.state || '';
    const heavy = pstate==='heavy' || elemId==='earth';
    if((this.data.guard || this.guardTimer>0) && !heavy && !this.dead){ game?.audio?.play('gateLocked'); game?.ui?.toast((this.data.role_text||'Guarded enemy')+' — heavy/Earth breaks guard'); this.hitFlash=.16; return false; }
    if(this.data.parry && !heavy && Math.random()<0.45 && game?.player?.invuln<=0){ game.player.takeHit(8,-(kx||this.facing*120),-12,game); game?.ui?.toast('Parried — stop mashing light attacks'); return false; }
    if(elemId && (this.data.weaknesses||[]).includes(elemId)) dmg*=1.55;
    if(elemId && (this.data.resistances||[]).includes(elemId)) dmg*=0.55;
    if(this.data.armor && !heavy) dmg=Math.max(1,dmg-this.data.armor);
    const wasAlive = !this.dead;
    const didHit = super.takeHit(dmg,kx,ky,game);
    if(!didHit) return false;
    this.hitAnimTimer = 0.34;
    this.hitAnimRestart = true;
    this.stateTime = 0;
    if(this.dead && wasAlive){
      this.state = 'death';
      this.deathAnimStarted = false;
      this.deathHoldTimer = 0;
      this.hitAnimTimer = 0;
      if(this.anim) this.anim.play('death', true);
      game?.audio?.play('enemyDeath');
    } else {
      this.state = 'hit';
      game?.audio?.play('enemyHit');
    }
    return true;
  }

  takeDamage(amount){
    return this.takeHit(amount, 0, 0, this.game || null);
  }
}
