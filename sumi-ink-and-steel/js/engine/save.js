class SaveSystem {
  constructor(game){ this.game=game; this.prefix='sumi_save_'; }
  activeChapterScene(){
    for(let i=this.game.scenes.stack.length-1;i>=0;i--){
      const s=this.game.scenes.stack[i];
      if(s && s.constructor && s.constructor.name === 'ChapterScene') return s;
    }
    return null;
  }
  save(slot='slot1', name='Brush Save'){
    const scene=this.activeChapterScene(); const p=scene?.player || this.game.player;
    const enemies=(scene?.enemies || this.game.enemies || []).map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,dead:e.dead,vx:e.vx,vy:e.vy,state:e.state,attackCd:e.attackCd}));
    const data={version:2,timestamp:Date.now(),name,chapter:this.game.data.data.currentLevelId||'chapter1_dojo',wave:scene?.wave||this.game.wave||1,modifications:this.game.progression.installedMods,unlockedMods:[...this.game.progression.unlockedMods],humanity:this.game.progression.humanity,flags:this.game.progression.flags,stats:{hp:p?.hp||120,meter:p?.meter||0,x:p?.x||230,y:p?.y||520},enemies};
    localStorage.setItem(this.prefix+slot, JSON.stringify(data)); return data;
  }
  load(slot='slot1'){ const raw=localStorage.getItem(this.prefix+slot); return raw ? JSON.parse(raw) : null; }
  list(){ return ['slot1','slot2','slot3'].map(slot=>({slot,data:this.load(slot)})); }
  clear(slot){ localStorage.removeItem(this.prefix+slot); }
}
window.SaveSystem = SaveSystem;
