class ParticleSystem {
  constructor(){ this.items=[]; this.shake=0; }
  burst(x,y,color,count=10,power=160){
    for(let i=0;i<count;i++){
      const a=rand(0,Math.PI*2), s=rand(power*.25,power);
      this.items.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rand(20,80),life:rand(.25,.75),max:1,size:rand(2,9),color});
    }
  }
  slash(x,y,dir,fire=false){
    const color = fire ? CONFIG.COLORS.fire : CONFIG.COLORS.cream;
    for(let i=0;i<22;i++) this.items.push({x:x+dir*rand(10,115),y:y+rand(-60,30),vx:dir*rand(60,180),vy:rand(-80,50),life:rand(.18,.38),max:1,size:rand(3,14),color, slash:true});
    this.shake = Math.max(this.shake, fire ? 11 : 6);
  }
  update(dt){
    this.shake = Math.max(0, this.shake - dt*28);
    for(const p of this.items){ p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=260*dt; }
    this.items=this.items.filter(p=>p.life>0);
  }
  draw(ctx){
    ctx.save();
    for(const p of this.items){
      ctx.globalAlpha=Math.max(0,p.life/.75);
      ctx.fillStyle=p.color;
      if(p.slash){ ctx.fillRect(p.x-p.size*2,p.y-p.size/2,p.size*4,p.size); }
      else { ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }
    }
    ctx.restore();
  }
}
window.ParticleSystem = ParticleSystem;
