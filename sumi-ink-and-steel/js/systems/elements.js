class ElementSystem {
  constructor(game){ this.game=game; this.currentElement=null; this.pendingElement=null; this.imbueTimer=0; this.unlocked=new Set(Object.entries(game.data.data.elements).filter(([k,v])=>v.unlocked || game.progression?.isUnlocked(k) || game.progression?.isInstalled(k)).map(([k])=>k)); }
  update(dt, player){ this.imbueTimer=Math.max(0,this.imbueTimer-dt); if(this.imbueTimer<=0) this.currentElement=null; }
  active(){ return this.currentElement ? this.game.data.element(this.currentElement) : null; }
  selectByKey(key){ const id=Object.entries(this.game.data.data.elements).find(([_,e])=>e.key===key)?.[0]; if(id) this.pendingElement=id; return id; }
  confirm(player){ const id=this.pendingElement; this.pendingElement=null; if(!id) return false; if(!this.unlocked.has(id)){ this.game.ui.toast(this.game.data.element(id).display+' locked'); return false; } const e=this.game.data.element(id); if(player.meter < e.meter_cost){ this.game.ui.toast('Not enough Spirit'); return false; } player.meter -= e.meter_cost; this.currentElement=id; this.imbueTimer=e.duration; this.game.particles.burst(player.x,player.y-75,e.color,30,260); this.game.audio?.play('key'); this.game.ui.toast(e.name+' — '+e.display+' imbued'); return true; }
  special(player){ const id=this.currentElement || this.pendingElement || 'fire'; if(!this.unlocked.has(id)) return false; const e=this.game.data.element(id); const cost=(e.special_cost||45); if(player.meter<cost){ this.game.ui.toast('Not enough Spirit for '+e.display+' special'); return false; } player.meter-=cost; const g=this.game; g.audio?.play('boss'); g.particles.burst(player.x,player.y-80,e.color,55,420); this.currentElement=id; this.imbueTimer=Math.max(this.imbueTimer,2.0);
    if(id==='fire'){ for(const en of g.enemies) if(!en.dead && Math.abs(en.x-player.x)<430 && Math.abs(en.y-player.y)<130) en.takeHit(24,Math.sign(en.x-player.x||1)*320,-45,g); g.ui.toast('Phoenix Slash — flame trail'); }
    else if(id==='ice'){ for(const en of g.enemies) if(!en.dead && Math.abs(en.x-player.x)<300 && Math.abs(en.y-player.y)<150){ en.slowTimer=4; en.takeHit(12,0,-20,g); } g.ui.toast('Frost Field — enemies slowed'); }
    else if(id==='wind'){ for(const en of g.enemies) if(!en.dead && Math.abs(en.x-player.x)<280) en.takeHit(14,Math.sign(en.x-player.x||1)*180,-170,g); g.ui.toast('Cyclone — launch them'); }
    else if(id==='lightning'){ const target=g.enemies.find(en=>!en.dead); if(target){ player.x=target.x-player.facing*70; player.y=target.y; target.takeHit(28,player.facing*260,-50,g); for(const en of g.enemies) if(en!==target&&!en.dead&&Math.abs(en.x-target.x)<220) en.takeHit(13,player.facing*120,-20,g); } g.ui.toast('Thunder Step'); }
    else if(id==='earth'){ player.invuln=Math.max(player.invuln,2.2); g.ui.toast('Stone Skin — invulnerable'); }
    else if(id==='water'){ player.invuln=Math.max(player.invuln,.7); player.hp=clamp(player.hp+18,0,player.maxHp); player.comboTimer=2.5; g.ui.toast('River Step — flow and heal'); }
    else if(id==='shadow'){ player.meterMax=Math.max(40,player.meterMax-(e.meter_cap_cost||10)); for(const en of g.enemies) if(!en.dead && Math.abs(en.x-player.x)<360) en.takeHit(34,Math.sign(en.x-player.x||1)*240,-60,g); g.ui.toast('Kage devours your Spirit cap'); }
    return true; }
  bonusDamage(){ return this.active()?.imbue_damage_bonus || 0; }
  color(){ return this.active()?.color || null; }
}
window.ElementSystem = ElementSystem;
