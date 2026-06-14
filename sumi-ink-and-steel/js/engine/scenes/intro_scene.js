
class IntroScene extends Scene {
  constructor(game){ super(game); this.t=0; this.card=0; }
  update(dt){
    this.t += dt;
    const cards=this.game.data.data.story?.intro_cards || [];
    this.card = Math.min(cards.length-1, Math.floor(this.t/2.4));
    if(this.game.input.wasPressed('Enter')){ const q=new URLSearchParams(location.search).get('level'); this.game.startNewGame(q || this.game.data.data.currentLevelId); }
    if(this.game.input.wasPressed('U')) this.game.scenes.push(new UpgradeScene(this.game, this));
  }
  draw(ctx){
    const g=this.game;
    g.drawBackdrop(ctx,false);
    ctx.save();
    const pulse=(Math.sin(this.t*1.7)+1)/2;
    ctx.fillStyle='rgba(0,0,0,.34)'; ctx.fillRect(0,0,CONFIG.W,CONFIG.H);
    ctx.fillStyle='rgba(120,20,35,.18)'; ctx.beginPath(); ctx.ellipse(640,330,360+pulse*40,210+pulse*20,0,0,Math.PI*2); ctx.fill();
    ctx.textAlign='center';
    ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='56px Georgia'; ctx.fillText('SUMI',640,112);
    ctx.font='28px Georgia'; ctx.fillStyle=CONFIG.COLORS.gold; ctx.fillText('INK AND STEEL',640,152);
    ctx.font='17px Georgia'; ctx.fillStyle=CONFIG.COLORS.cream; ctx.fillText(this.game.data.data.story?.logline || '',640,188);
    const cards=this.game.data.data.story?.intro_cards || [];
    for(let i=0;i<cards.length;i++){
      const delay=i*1.15, local=this.t-delay;
      if(local<0) continue;
      const targetX=190+i*300;
      const x=targetX + Math.max(0,1-local)*((i%2?1:-1)*520);
      const y=255 + Math.sin(local*2+i)*10;
      ctx.save(); ctx.globalAlpha=Math.min(1,local);
      this.cardPanel(ctx,x,y,250,230,cards[i],i);
      ctx.restore();
    }
    ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='19px Georgia';
    ctx.fillText('Enter: begin the vow',640,650);
    ctx.restore();
  }
  cardPanel(ctx,x,y,w,h,card,i){
    ctx.fillStyle='rgba(16,10,6,.88)'; ctx.fillRect(x-w/2,y,w,h); ctx.strokeStyle=i<2?CONFIG.COLORS.vermillion:'#39b7d2'; ctx.lineWidth=3; ctx.strokeRect(x-w/2+3,y+3,w-6,h-6);
    ctx.fillStyle=i<2?CONFIG.COLORS.indigo:'#091b2b'; ctx.fillRect(x-w/2+18,y+18,w-36,78);
    ctx.strokeStyle='rgba(247,237,207,.5)'; ctx.beginPath(); ctx.moveTo(x-w/2+28,y+86); ctx.lineTo(x+w/2-28,y+28); ctx.stroke();
    ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='21px Georgia'; ctx.textAlign='center'; ctx.fillText(card.title,x,y+128);
    ctx.font='14px Georgia'; this.wrap(ctx,card.text,x,y+158,w-38,18);
  }
  wrap(ctx,text,x,y,maxW,lineH){ const words=text.split(' '); let line=''; for(const word of words){ const test=line+word+' '; if(ctx.measureText(test).width>maxW){ ctx.fillText(line,x,y); line=word+' '; y+=lineH; } else line=test; } ctx.fillText(line,x,y); }
}
window.IntroScene=IntroScene;
