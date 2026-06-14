
class StoryInterludeScene extends Scene {
  constructor(game, levelId, nextId, stats={}){ super(game); this.levelId=levelId; this.nextId=nextId; this.stats=stats; this.t=0; }
  onEnter(){
    const meta=this.game.data.data.story?.chapters?.[this.levelId] || {};
    const reward=meta.reward;
    if(reward) this.game.progression.unlockReward(reward);
    this.game.progression.save();
  }
  update(dt){
    this.t+=dt;
    if(this.game.input.wasPressed('Enter')){ if(this.nextId) this.game.goToLevel(this.nextId); else this.game.scenes.replace(new EndingScene(this.game)); }
    if(this.game.input.wasPressed('U')) this.game.scenes.push(new UpgradeScene(this.game,this));
  }
  draw(ctx){
    const meta=this.game.data.data.story?.chapters?.[this.levelId] || {};
    this.game.drawBackdrop(ctx,false);
    ctx.save(); ctx.fillStyle='rgba(0,0,0,.64)'; ctx.fillRect(0,0,CONFIG.W,CONFIG.H);
    this.game.ui.plaque(ctx,150,78,980,520);
    ctx.textAlign='center'; ctx.fillStyle=CONFIG.COLORS.gold; ctx.font='22px Georgia'; ctx.fillText(meta.act || 'Interlude',640,126);
    ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='42px Georgia'; ctx.fillText(meta.interlude_title || 'Story Continues',640,176);
    ctx.font='18px Georgia'; this.wrap(ctx,meta.interlude || '',640,226,820,28);
    const y=356; ctx.textAlign='left'; ctx.font='18px Georgia'; ctx.fillStyle=CONFIG.COLORS.cream;
    const installed=this.game.progression.installedMods.join(', ') || 'none';
    ctx.fillText('Chapter cleared: '+(this.game.data.data.levels?.[this.levelId]?.name || this.levelId),260,y);
    ctx.fillText('Enemies defeated: '+(this.stats.kills||this.game.progression.runStats.kills||0),260,y+32);
    ctx.fillText('Waves cleared: '+(this.stats.waves||0),260,y+64);
    ctx.fillText('Humanity: '+this.game.progression.humanity,260,y+96);
    ctx.fillText('Installed: '+installed,260,y+128);
    if(meta.portal){ ctx.fillStyle='#b06cff'; ctx.font='24px Georgia'; ctx.fillText('PORTAL EVENT: FEUDAL JAPAN HAS FALLEN INTO 2090.',260,y+176); }
    ctx.textAlign='center'; ctx.fillStyle=CONFIG.COLORS.gold; ctx.font='20px Georgia'; ctx.fillText('Enter: continue    U: edit powers/enhancements',640,558);
    ctx.restore();
  }
  wrap(ctx,text,x,y,maxW,lineH){ const words=text.split(' '); let line=''; for(const word of words){ const test=line+word+' '; if(ctx.measureText(test).width>maxW){ ctx.fillText(line,x,y); line=word+' '; y+=lineH; } else line=test; } ctx.fillText(line,x,y); }
}
class EndingScene extends Scene {
  update(dt){ if(this.game.input.wasPressed('Enter')) this.game.scenes.replace(new IntroScene(this.game)); if(this.game.input.wasPressed('U')) this.game.scenes.push(new UpgradeScene(this.game,this)); }
  draw(ctx){ const ending=this.game.data.data.story?.ending || {title:'VICTORY',text:'The end.'}; this.game.drawBackdrop(ctx,false); ctx.save(); ctx.fillStyle='rgba(0,0,0,.70)'; ctx.fillRect(0,0,CONFIG.W,CONFIG.H); this.game.ui.plaque(ctx,230,160,820,360); ctx.textAlign='center'; ctx.fillStyle=CONFIG.COLORS.gold; ctx.font='36px Georgia'; ctx.fillText(ending.title,640,240); ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='20px Georgia'; this.wrap(ctx,ending.text,640,300,700,30); ctx.font='18px Georgia'; ctx.fillText('Enter: title    U: edit powers',640,470); ctx.restore(); }
  wrap(ctx,text,x,y,maxW,lineH){ const words=text.split(' '); let line=''; for(const word of words){ const test=line+word+' '; if(ctx.measureText(test).width>maxW){ ctx.fillText(line,x,y); line=word+' '; y+=lineH; } else line=test; } ctx.fillText(line,x,y); }
}
window.StoryInterludeScene=StoryInterludeScene; window.EndingScene=EndingScene;
