class Entity {
  constructor(x,y){ this.x=x; this.y=y; this.vx=0; this.vy=0; this.facing=1; this.hp=10; this.maxHp=10; this.dead=false; this.hitFlash=0; this.invuln=0; this.radius=28; }
  body(){ return {x:this.x-this.radius, y:this.y-this.radius*.65, w:this.radius*2, h:this.radius*1.3}; }
  depthScale(game=null){ const w=game?.world || CONFIG.WORLD; const t=clamp((this.y - w.top) / Math.max(1,(w.bottom-w.top)),0,1); return 0.62 + t * 0.72; }
  takeHit(dmg,kx,ky,game){ if(this.dead || this.invuln>0) return false; this.hp-=dmg; this.vx+=kx; this.vy+=ky; this.hitFlash=.12; this.invuln=.08; game?.particles.burst(this.x,this.y-55,dmg>18?CONFIG.COLORS.vermillion:CONFIG.COLORS.cream,dmg>18?18:9,dmg>18?230:140); if(this.hp<=0){ this.dead=true; this.hp=0; game?.particles.burst(this.x,this.y-45,CONFIG.COLORS.ink,28,260); } return true; }
  physics(dt, world=CONFIG.WORLD){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.vx=approach(this.vx,0,dt*850); this.vy=approach(this.vy,0,dt*850); this.x=clamp(this.x,world.left,world.right); this.y=clamp(this.y,world.top,world.bottom); this.hitFlash=Math.max(0,this.hitFlash-dt); this.invuln=Math.max(0,this.invuln-dt); }
}
window.Entity=Entity;
