
class ProgressionSystem {
  constructor(){
    this.currentChapter='chapter1_dojo';
    this.installedMods=[];
    this.unlockedMods=new Set(['fire']);
    this.flags={};
    this.humanity=100;
    this.runStats={kills:0,waves:0,chapters:0};
  }
  hydrate(data){
    const mods=data?.modifications || {};
    const saved=this.loadLocal();
    this.installedMods=[...(saved?.installedMods || mods.installed || ['fire'])];
    this.unlockedMods=new Set(saved?.unlockedMods || mods.unlocked || ['fire']);
    this.flags={...(saved?.flags||{})};
    this.humanity=saved?.humanity ?? mods.humanity ?? 100;
    this.runStats={kills:0,waves:0,chapters:0,...(saved?.runStats||{})};
  }
  loadLocal(){ try{ return JSON.parse(localStorage.getItem('sumi_progression')||'null'); }catch(e){ return null; } }
  save(){ localStorage.setItem('sumi_progression', JSON.stringify({installedMods:this.installedMods,unlockedMods:[...this.unlockedMods],flags:this.flags,humanity:this.humanity,runStats:this.runStats})); }
  isUnlocked(id){ return this.unlockedMods.has(id); }
  isInstalled(id){ return this.installedMods.includes(id); }
  toggleMod(id){
    if(!this.isUnlocked(id)){ return false; }
    if(this.isInstalled(id)) this.installedMods=this.installedMods.filter(x=>x!==id);
    else this.installedMods.push(id);
    this.recomputeHumanity(); this.save(); return true;
  }
  unlockReward(id){
    if(!id) return;
    this.unlockedMods.add(id);
    // Elemental rewards become installed immediately as powers. Cyber rewards unlock for explicit player choice.
    if(['fire','wind','lightning','shadow','humanity_vow'].includes(id) && !this.isInstalled(id)) this.installedMods.push(id);
    this.flags['unlocked_'+id]=true;
    this.recomputeHumanity(); this.save();
  }
  allUpgradeItems(game){
    const out=[]; const branches=game?.data?.data?.modifications?.branches || {};
    for(const list of Object.values(branches)) for(const item of list) out.push(item);
    return out;
  }
  effectTotals(game){
    const totals={attack_bonus:0,hp_max:0,meter_max:0,meter_regen:0,speed_mult:1,dodge_cooldown_mult:1,humanity:0};
    const byId={}; for(const item of this.allUpgradeItems(game)) byId[item.id]=item;
    for(const id of this.installedMods){ const e=byId[id]?.effect || {}; for(const [k,v] of Object.entries(e)){ if(k.endsWith('_mult')) totals[k]*=v; else totals[k]=(totals[k]||0)+v; } }
    return totals;
  }
  recomputeHumanity(){
    // Base is 100 minus cyber costs plus restorative vows.
    let h=100;
    const data=window.game?.data?.data; const branches=data?.modifications?.branches || {};
    const byId={}; for(const list of Object.values(branches)) for(const item of list) byId[item.id]=item;
    for(const id of this.installedMods) h += byId[id]?.effect?.humanity || 0;
    this.humanity=Math.max(0,Math.min(100,h));
  }
}
window.ProgressionSystem = ProgressionSystem;
