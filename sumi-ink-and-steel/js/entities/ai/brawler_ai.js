class BrawlerAI {
  rangedBehaviors(){ return ['ranged','bomb','poison','caster_ward','caster_curse','kunoichi','aerial']; }

  update(enemy, dt, game){
    const p=game.player, dx=p.x-enemy.x, dy=p.y-enemy.y, dist=Math.hypot(dx,dy*1.7);
    const behavior=enemy.data.behavior || 'basic';
    const ranged=this.rangedBehaviors();
    enemy.stateTime+=dt;
    enemy.attackCd=Math.max(0,enemy.attackCd-dt);
    enemy.specialCd=Math.max(0,(enemy.specialCd||0)-dt);

    if((behavior==='teleport' || behavior==='vanish' || behavior==='trickster') && enemy.specialCd<=0 && dist<260 && Math.random()<dt*.75){
      enemy.x=p.x-p.facing*95;
      enemy.y=clamp(p.y+rand(-34,34), game.world.top+40, game.world.bottom-20);
      enemy.facing=p.facing;
      enemy.specialCd=behavior==='teleport'?2.0:3.0;
      game.particles.burst(enemy.x,enemy.y-70,enemy.data.sash_color||'#8d4dff',18,180);
      game.audio?.play('enemyWindup');
    }

    if(enemy.state==='attack'){
      enemy.facing = dx>=0 ? 1 : -1;
      enemy.vx=approach(enemy.vx,0,dt*900);
      enemy.vy=approach(enemy.vy,0,dt*900);
      const windup=enemy.data.attack_windup_sec || 0.34;
      const recovery=enemy.data.attack_recovery_sec || 0.48;
      if(!enemy.attackDone && enemy.stateTime>windup){
        enemy.attackDone=true;
        if(ranged.includes(behavior)){
          this.fireRanged(enemy,p,behavior,dx,dy,game);
        } else {
          game.combat.enemyAttack(enemy,p);
        }
      }
      if(enemy.stateTime>windup+recovery){
        enemy.state='approach';
        enemy.stateTime=0;
        enemy.attackCd=ranged.includes(behavior) ? (enemy.data.ranged_cooldown_sec||rand(1.4,2.3)) : rand(enemy.data.attack_cooldown_min_sec,enemy.data.attack_cooldown_max_sec);
        enemy.attackDone=false;
      }
      return;
    }

    if(ranged.includes(behavior) && dist<(enemy.data.attack_range||300) && enemy.attackCd<=0){
      enemy.state='attack';
      enemy.stateTime=0;
      enemy.attackDone=false;
      enemy.facing=dx>=0?1:-1;
      game.audio?.play('enemyWindup');
      return;
    }

    if(dist<enemy.data.attack_range && enemy.attackCd<=0){
      enemy.state='attack';
      enemy.stateTime=0;
      enemy.attackDone=false;
      enemy.facing=dx>=0?1:-1;
      game.audio?.play('enemyWindup');
      return;
    }

    let speed=enemy.data.move_speed;
    if(behavior==='aggressive') speed*=1.18;
    if(behavior==='defensive'||behavior==='armored') speed*=.78;
    let desireX=Math.abs(dx)>58?Math.sign(dx):0, desireY=Math.abs(dy)>16?Math.sign(dy):0;
    if(ranged.includes(behavior) && dist<190){ desireX=-Math.sign(dx); desireY=Math.sign(dy)||1; }
    enemy.x+=desireX*speed*dt;
    enemy.y+=desireY*speed*enemy.data.depth_y_speed_ratio*dt;
    if(desireX) enemy.facing=desireX;
    enemy.state='approach';
  }

  fireRanged(enemy,p,behavior,dx,dy,game){
    game.audio?.play('enemySwing');
    const hitLane=Math.abs(dy)<95 || behavior==='aerial';
    const launchColor=enemy.data.sash_color||'#f7edcf';
    game.particles.burst(enemy.x+enemy.facing*46,enemy.y-96,launchColor,14,190);
    if(hitLane && p.invuln<=0){
      const dmg=enemy.data.ranged_damage||enemy.data.attack_damage||6;
      p.takeHit(dmg,enemy.facing*130,-12,game);
      if(behavior==='poison'){
        p.poisonTimer=Math.max(p.poisonTimer||0, enemy.data.dot_duration||4);
        p.poisonDmg=enemy.data.dot_damage||2;
        game.ui.toast('Poisoned — find Water or keep moving');
      }
      if(behavior==='caster_ward'){
        enemy.guardTimer=3.0;
        game.ui.toast('Onmyoji warded itself');
      }
      if(behavior==='caster_curse'){
        p.meter=Math.max(0,p.meter-12);
        game.ui.toast('Curse talisman drained Spirit');
      }
      game.particles.burst(p.x,p.y-80,launchColor,18,200);
    }
  }
}
window.BrawlerAI=BrawlerAI;
