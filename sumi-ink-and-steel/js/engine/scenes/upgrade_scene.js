
class UpgradeScene extends Scene {
  constructor(game, returnScene=null){ super(game); this.returnScene=returnScene; this.index=0; this.items=[]; }
  onEnter(){ this.refresh(); }
  refresh(){
    const mods=this.game.data.data.modifications || {branches:{}}; this.items=[];
    for(const [branch,list] of Object.entries(mods.branches||{})) for(const m of list) this.items.push({...m, branch});
    this.index=Math.max(0,Math.min(this.index,this.items.length-1));
  }
  update(dt){
    if(this.game.input.wasPressed('ArrowDown','S')) this.index=(this.index+1)%this.items.length;
    if(this.game.input.wasPressed('ArrowUp','W')) this.index=(this.index-1+this.items.length)%this.items.length;
    if(this.game.input.wasPressed('Enter','J','K')){ const item=this.items[this.index]; if(item){ this.game.progression.toggleMod(item.id); this.game.ui.toast((this.game.progression.isInstalled(item.id)?'Installed ':'Removed ')+item.name); } }
    if(this.game.input.wasPressed('P','Escape','U')) this.game.scenes.pop();
  }
  draw(ctx){
    const below=this.game.scenes.stack[this.game.scenes.stack.length-2]; if(below) below.draw(ctx); else this.game.drawBackdrop(ctx,false);
    ctx.save(); ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(0,0,CONFIG.W,CONFIG.H); this.game.ui.plaque(ctx,130,56,1020,590);
    ctx.fillStyle=CONFIG.COLORS.cream; ctx.textAlign='center'; ctx.font='36px Georgia'; ctx.fillText('EDIT MASAYOSHI — POWERS AND ENHANCEMENTS',640,112);
    ctx.font='16px Georgia'; ctx.fillStyle=CONFIG.COLORS.gold; ctx.fillText('Up/Down select • Enter toggle • U/P close • Installed effects apply immediately on next chapter/start',640,142);
    ctx.textAlign='left'; ctx.font='18px Georgia';
    const startY=190;
    for(let i=0;i<this.items.length;i++){
      const it=this.items[i], y=startY+i*46, on=this.game.progression.isInstalled(it.id), unlocked=this.game.progression.isUnlocked(it.id);
      ctx.fillStyle=i===this.index?'rgba(216,167,66,.24)':'rgba(247,237,207,.05)'; ctx.fillRect(180,y-26,900,40);
      ctx.strokeStyle=i===this.index?CONFIG.COLORS.gold:'rgba(247,237,207,.12)'; ctx.strokeRect(180,y-26,900,40);
      ctx.fillStyle=on?'#39d2b4':(unlocked?CONFIG.COLORS.cream:'#736b61');
      ctx.fillText((on?'[ON] ':'[  ] ')+it.name+' — '+it.branch,205,y);
      ctx.fillStyle=unlocked?'rgba(247,237,207,.78)':'rgba(247,237,207,.42)'; ctx.font='13px Georgia'; ctx.fillText(unlocked?it.desc:'Locked: clear chapters to unlock.',500,y); ctx.font='18px Georgia';
    }
    ctx.fillStyle=CONFIG.COLORS.cream; ctx.font='17px Georgia';
    ctx.fillText('Humanity: '+this.game.progression.humanity+' / 100',205,590);
    ctx.fillText('Unlocked: '+Array.from(this.game.progression.unlockedMods).join(', '),420,590);
    ctx.restore();
  }
}
window.UpgradeScene=UpgradeScene;
