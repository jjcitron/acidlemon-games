class OpeningCutsceneScene extends Scene {
  constructor(game, levelId=null){
    super(game);
    this.levelId = levelId || game.data.data.currentLevelId;
    this.panel = 0;
    this.t = 0;
    this.fade = 0;
    this.done = false;
    this.images = [];
    this.panels = [
      { src:'assets/story/source_panel_01.jpg', text:'The dojo has stood for seven generations.' },
      { src:'assets/story/source_panel_02.jpg', text:'Tonight, men came with weapons that should not yet exist.' },
      { src:'assets/story/source_panel_03.jpg', text:'My master is dead.' },
      { src:'assets/story/source_panel_04.jpg', text:'I will find them.' }
    ];
  }
  onEnter(){
    this.images = this.panels.map(p => {
      const img = new Image();
      img.onload = () => { img.loaded = true; };
      img.onerror = () => { img.failed = true; console.warn('Opening panel failed', p.src); };
      img.src = p.src + '?v=phase3s3_opening1';
      return img;
    });
  }
  update(dt){
    this.t += dt;
    if(this.done){
      this.fade += dt;
      if(this.fade >= 1){
        this.game.startNewGame(this.levelId, { skipOpening:true, openingLine:'For the master.' });
      }
      return;
    }
    if(this.anyAdvancePressed()){
      if(this.panel < this.panels.length - 1){ this.panel++; this.t = 0; }
      else { this.done = true; this.fade = 0; }
    }
  }
  anyAdvancePressed(){
    const p = this.game.input.pressed;
    return p && p.size > 0;
  }
  draw(ctx){
    ctx.save();
    ctx.fillStyle = '#050403';
    ctx.fillRect(0,0,CONFIG.W,CONFIG.H);
    const panel = this.panels[this.panel];
    const img = this.images[this.panel];
    const maxW = CONFIG.W * 0.60;
    const maxH = CONFIG.H * 0.58;
    const cx = CONFIG.W / 2;
    const top = 62;
    ctx.fillStyle = 'rgba(247,237,207,.04)';
    ctx.fillRect(0,0,CONFIG.W,CONFIG.H);
    if(img?.loaded){
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const x = cx - w / 2;
      const y = top + (maxH - h) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.8)';
      ctx.shadowBlur = 18;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      ctx.strokeStyle = CONFIG.COLORS.gold;
      ctx.lineWidth = 3;
      ctx.strokeRect(x-6,y-6,w+12,h+12);
    } else {
      this.drawLoadingPanel(ctx, cx - maxW/2, top, maxW, maxH, img?.failed);
    }
    const typed = panel.text.slice(0, Math.floor(this.t / 0.03));
    ctx.textAlign = 'center';
    ctx.fillStyle = CONFIG.COLORS.cream;
    ctx.font = '28px Georgia';
    this.wrap(ctx, typed, cx, 548, CONFIG.W * 0.76, 34);
    ctx.font = '15px Georgia';
    ctx.fillStyle = 'rgba(247,237,207,.68)';
    ctx.fillText('Press any key to advance', cx, 670);
    if(this.done){
      ctx.globalAlpha = Math.min(1, this.fade / 1);
      ctx.fillStyle = '#000';
      ctx.fillRect(0,0,CONFIG.W,CONFIG.H);
    }
    ctx.restore();
  }
  drawLoadingPanel(ctx,x,y,w,h,failed){
    ctx.fillStyle = 'rgba(16,10,6,.92)';
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle = failed ? CONFIG.COLORS.vermillion : CONFIG.COLORS.gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(x+3,y+3,w-6,h-6);
    ctx.textAlign = 'center';
    ctx.fillStyle = CONFIG.COLORS.cream;
    ctx.font = '22px Georgia';
    ctx.fillText(failed ? 'Panel failed to load' : 'Loading panel...', x+w/2, y+h/2);
  }
  wrap(ctx,text,x,y,maxW,lineH){
    const words = text.split(' ');
    let line = '';
    for(const word of words){
      const test = line + word + ' ';
      if(ctx.measureText(test).width > maxW && line){ ctx.fillText(line.trim(), x, y); line = word + ' '; y += lineH; }
      else line = test;
    }
    if(line.trim()) ctx.fillText(line.trim(), x, y);
  }
}
window.OpeningCutsceneScene = OpeningCutsceneScene;
