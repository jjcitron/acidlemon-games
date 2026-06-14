class CombatSystem {
  constructor(game){ this.game=game; }
  playerAttack(player, heavy=false, opts={}){
    const cfg=this.game.data.data.config.combat, elem=this.game.elements.active();
    const jump=!!opts.jump;
    const reach=(heavy?cfg.heavy_reach:cfg.light_reach) + (jump?34:0);
    const height=(heavy?cfg.heavy_height:cfg.light_height) + (jump?38:0);
    const visualY=player.y-(player.z||0);
    const hb={x:player.facing>0?player.x+10:player.x-reach-10,y:visualY-(jump?122:92),w:reach,h:height}; let hit=0;
    this.game.particles.slash(player.x+player.facing*(jump?58:45),visualY-(jump?82:65),player.facing,!!elem, elem?.color);
    this.game.audio?.play(heavy?'heavy':'slash');
    for(const e of this.game.enemies){
      if(e.dead) continue;
      const eb={x:e.x-34,y:e.y-116,w:68,h:112};
      const laneTol=cfg.lane_tolerance+(jump?34:0);
      if(Math.abs(e.y-player.y)<laneTol && rectsOverlap(hb,eb)){
        const dmg=(heavy?24:12+player.combo*3)+(jump?5:0)+this.game.elements.bonusDamage()+((this.game.progression?.effectTotals(this.game)||{}).attack_bonus||0);
        if(e.takeHit(dmg,player.facing*(heavy?380:260),heavy?-90:-55,this.game)){
          hit++; player.meter=clamp(player.meter+(heavy?10:7),0,player.meterMax);
          this.game.hitstop=Math.max(this.game.hitstop, heavy?this.game.data.data.config.player.hitstop_heavy_sec:this.game.data.data.config.player.hitstop_light_sec);
          this.game.comboCount++; this.game.comboTime=1.1;
        }
      }
    }
    if(elem?.imbue_aoe){ const aoe=elem.imbue_aoe; const rect={x:player.x+(player.facing>0?25:-aoe.width+25),y:player.y-125,w:aoe.width,h:aoe.height}; for(const e of this.game.enemies){ if(!e.dead && rectsOverlap(rect,{x:e.x-30,y:e.y-100,w:60,h:100}) && Math.abs(e.y-player.y)<85) e.takeHit(aoe.damage,player.facing*120,-20,this.game); } }
    if(hit) this.game.ui.toast(jump?(heavy?'Leaping heavy carve':'Jump combo slash'):(heavy?'Carved heavy strike':'Ink slash '+player.combo)); return hit;
  }
  enemyAttack(enemy, player){ this.game.audio?.play('enemySwing'); const cfg=this.game.data.data.config.combat; const hb={x:enemy.facing>0?enemy.x:enemy.x-62,y:enemy.y-96,w:62,h:62}; if(Math.abs(player.y-enemy.y)<cfg.enemy_attack_lane_tolerance && rectsOverlap(hb,{x:player.x-28,y:player.y-(player.z||0)-115,w:56,h:105}) && player.invuln<=0){ player.takeHit(enemy.data.attack_damage,enemy.facing*180,-18,this.game); this.game.audio?.play('playerHit'); this.game.hitstop=.05; this.game.ui.toast('Masayoshi hit'); return true; } return false; }
}
window.CombatSystem=CombatSystem;
