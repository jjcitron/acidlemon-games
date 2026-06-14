class Player extends Entity {
  constructor(x,y,game){
    super(x,y);
    this.game=game;
    const pc=game.data.data.config.player;
    const eff=game.progression?.effectTotals(game)||{};
    this.maxHp=pc.max_hp+(eff.hp_max||0);
    this.hp=this.maxHp;
    this.meterMax=pc.meter_max+(eff.meter_max||0);
    this.meter=pc.meter_start;
    this.radius=33;
    this.state='idle';
    this.combo=0;
    this.comboTimer=0;
    this.dodgeCd=0;
    this.z=0;
    this.vz=0;
    this.airborne=false;
    this.jumpAttackHeavy=false;
    this.jumpAttackStarted=false;
    this.anim=new AnimationPlayer(game.assets.json.player_atlas || {frame_w:192,frame_h:256,animations:{idle:{frames:[0],fps:1,loop:true}}});
  }

  update(dt,game){
    const pc=game.data.data.config.player;
    this.comboTimer=Math.max(0,this.comboTimer-dt);
    if(this.comboTimer<=0) this.combo=0;
    this.dodgeCd=Math.max(0,this.dodgeCd-dt);
    if(this.poisonTimer>0){ this.poisonTimer=Math.max(0,this.poisonTimer-dt); this.hp=Math.max(1,this.hp-(this.poisonDmg||2)*dt); }
    game.elements.update(dt,this);
    this.anim.update(dt);
    if(this.anim.iframeActive()) this.invuln=Math.max(this.invuln,.05);

    this.updateJumpPhysics(dt,game);

    if((this.state==='attack'||this.state==='heavy') && this.anim.isHitFrame()){
      game.combat.playerAttack(this,this.state==='heavy');
      this.anim.markHitFired();
    }
    if(this.state==='jump_attack' && this.anim.isHitFrame()){
      game.combat.playerAttack(this,!!this.jumpAttackHeavy,{jump:true});
      this.anim.markHitFired();
    }
    if((this.state==='attack'||this.state==='heavy'||this.state==='dodge') && this.anim.done){ this.state='idle'; this.anim.play('idle'); }
    if(this.state==='jump_attack' && this.anim.done && this.airborne){ this.anim.play('jump'); }
    if(this.state==='jump_attack' && this.anim.done && !this.airborne){ this.state='idle'; this.anim.play('idle'); }

    if(this.state==='idle'||this.state==='walk'){
      if(game.input.isDown('Q')){ for(let i=1;i<=7;i++) if(game.input.wasPressed(String(i))) game.elements.selectByKey(String(i)); }
      if(game.input.wasReleased('Q')) game.elements.confirm(this);
      if(game.input.wasPressed('U')) game.elements.special(this);
      const ax=game.input.axis();
      if(ax.x||ax.y){
        const eff=game.progression?.effectTotals(game)||{};
        const speed=pc.move_speed*(eff.speed_mult||1);
        this.x+=ax.x*speed*dt;
        this.y+=ax.y*speed*pc.depth_y_speed_ratio*dt;
        this.facing=ax.x?Math.sign(ax.x):this.facing;
        this.state='walk';
        this.anim.play('walk');
      } else {
        this.state='idle';
        this.anim.play('idle');
      }
      const light=game.input.wasPressed('J'), heavy=game.input.wasPressed('K'), jump=game.input.wasPressed('Space');
      if(jump){
        this.startJump(ax, light||heavy, heavy, game);
      } else {
        if(light) this.startAttack(false);
        if(heavy) this.startAttack(true);
        if(game.input.wasPressed('Shift') && this.dodgeCd<=0) this.startDodge(pc,game);
      }
      if(game.input.wasPressed('L')){ game.elements.pendingElement='fire'; game.elements.confirm(this); }
      if(game.input.wasPressed('F5')) game.save.save('slot1','Quick Save');
    } else if(this.state==='jump'){
      const light=game.input.wasPressed('J'), heavy=game.input.wasPressed('K');
      if(light || heavy) this.startJumpAttack(heavy,game);
    }

    this.physics(dt,game.world);
    this.meter=clamp(this.meter+dt*(pc.meter_regen_per_sec+((game.progression?.effectTotals(game)||{}).meter_regen||0)),0,this.meterMax);
  }

  updateJumpPhysics(dt,game){
    if(!this.airborne) return;
    const pc=game.data.data.config.player;
    this.z += this.vz * dt;
    this.vz -= (pc.jump_gravity || 1850) * dt;
    const ax=game.input.axis();
    if(ax.x||ax.y){
      const air=pc.jump_air_control || 170;
      this.x += ax.x * air * dt;
      this.y += ax.y * air * (pc.depth_y_speed_ratio||.78) * dt;
      if(ax.x) this.facing=Math.sign(ax.x);
    }
    if(this.z<=0){
      this.z=0; this.vz=0; this.airborne=false;
      if(this.state==='jump') { this.state='idle'; this.anim.play('idle'); }
      if(this.state==='jump_attack' && this.anim.done){ this.state='idle'; this.anim.play('idle'); }
      this.game.particles.burst(this.x,this.y-8,CONFIG.COLORS.cream,8,95);
    }
  }

  startDodge(pc,game){
    game.audio?.play('dodge');
    const d=game.input.lastDir;
    this.vx=d.x*pc.dodge_speed || this.facing*pc.dodge_speed;
    this.vy=d.y*pc.dodge_y_speed;
    this.invuln=pc.dodge_iframes_sec;
    this.state='dodge';
    this.anim.play('dodge',true);
    this.dodgeCd=pc.dodge_cooldown_sec*((game.progression?.effectTotals(game)||{}).dodge_cooldown_mult||1);
    game.particles.burst(this.x,this.y-20,CONFIG.COLORS.cream,10,130);
  }

  startJump(axis, immediateAttack=false, heavy=false, game=this.game){
    const pc=game.data.data.config.player;
    this.airborne=true;
    this.z=2;
    this.vz=pc.jump_velocity || 720;
    const d=(axis && (axis.x||axis.y)) ? axis : game.input.lastDir;
    this.vx=(d.x||0)*(pc.jump_forward_speed||250);
    this.vy=(d.y||0)*(pc.jump_depth_speed||170);
    if(d.x) this.facing=Math.sign(d.x);
    this.invuln=Math.max(this.invuln, pc.jump_iframes_sec || 0.10);
    this.state='jump';
    this.anim.play('jump',true);
    game.audio?.play('dodge');
    game.particles.burst(this.x,this.y-10,CONFIG.COLORS.cream,12,145);
    if(immediateAttack) this.startJumpAttack(heavy,game);
  }

  startJumpAttack(heavy=false,game=this.game){
    if(this.state==='jump_attack' && !this.anim.done) return;
    this.jumpAttackHeavy=!!heavy;
    this.state='jump_attack';
    this.anim.play('jump_attack',true);
    this.game.audio?.play(heavy?'heavy':'slash');
    this.combo=(this.combo%3)+1;
    this.comboTimer=this.game.data.data.config.player.combo_window_sec;
    const ax=game.input.axis();
    if(ax.x||ax.y){ this.vx+=ax.x*120; this.vy+=ax.y*80; if(ax.x) this.facing=Math.sign(ax.x); }
  }

  startAttack(heavy){
    this.game.audio?.play(heavy?'heavy':'slash');
    this.state=heavy?'heavy':'attack';
    if(!heavy){ this.combo=(this.combo%3)+1; this.comboTimer=this.game.data.data.config.player.combo_window_sec; this.anim.play('light_'+this.combo,true); }
    else this.anim.play('heavy',true);
  }

  draw(ctx,assets,game){
    const s=this.depthScale(game), color=game.elements.color();
    this.shadow(ctx,game);
    ctx.save();
    ctx.globalAlpha=this.invuln>0 && Math.floor(performance.now()/70)%2 ? .45 : 1;
    this.anim.draw(ctx,assets.get('player_atlas'),this.x,this.y-(this.z||0),this.facing,s);
    if(this.airborne){ ctx.globalAlpha=.42; ctx.strokeStyle=CONFIG.COLORS.cream; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(this.x,this.y-(this.z||0)-62*s,38*s,Math.PI*.1,Math.PI*.86); ctx.stroke(); }
    if(color){ ctx.globalAlpha=.55; ctx.strokeStyle=color; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(this.x,this.y-(this.z||0)-88*s,56*s,0,Math.PI*2); ctx.stroke(); }
    if(this.hitFlash>0){
      ctx.globalAlpha=.55*this.hitFlash/.12;
      ctx.strokeStyle='#f7edcf'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.ellipse(this.x,this.y-(this.z||0)-92*s,48*s,82*s,-0.08,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=.22; ctx.fillStyle=CONFIG.COLORS.vermillion;
      ctx.beginPath(); ctx.arc(this.x+this.facing*22,this.y-(this.z||0)-88*s,34*s,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  shadow(ctx,game){ const s=this.depthScale(game); ctx.save(); ctx.globalAlpha=this.airborne?.18:.32; ctx.fillStyle='#030201'; ctx.beginPath(); ctx.ellipse(this.x,this.y+5,46*s*(this.airborne?.78:1),13*s*(this.airborne?.72:1),0,0,Math.PI*2); ctx.fill(); ctx.restore(); }
}
window.Player=Player;
