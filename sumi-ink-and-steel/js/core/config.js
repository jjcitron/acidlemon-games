class DataManager {
  constructor(){ this.data = {}; }
  async loadJson(path, fallbackKey){
    try { const r = await fetch(path, {cache:'no-store'}); if(!r.ok) throw new Error(r.status+' '+path); return await r.json(); }
    catch(err){ if(window.PHASE2_DATA && window.PHASE2_DATA[fallbackKey]) return window.PHASE2_DATA[fallbackKey]; console.error('Data load failed', fallbackKey, err); throw err; }
  }
  async loadAll(){
    this.data.config = await this.loadJson('data/config.json','config');
    this.data.elements = await this.loadJson('data/elements.json','elements');
    this.data.enemiesRaw = await this.loadJson('data/enemies.json','enemies');
    this.data.modifications = await this.loadJson('data/modifications.json','modifications');
    this.data.story = await this.loadJson('data/story.json','story');
    this.data.levelSequence = await this.loadJson('data/levels/level_sequence.json','level_sequence');
    this.data.levels = {};
    const levelIds = this.data.levelSequence?.levels || ['chapter1_dojo'];
    const roomIds = this.data.levelSequence?.rooms || [];
    const loadIds = [...new Set([...levelIds, ...roomIds])];
    for(const id of loadIds){
      this.data.levels[id] = await this.loadJson('data/levels/'+id+'.json','level_'+id);
    }
    this.applyEditorPreview();
    const queryLevel = new URLSearchParams(location.search).get('level');
    let editorPlay=null;
    try{ editorPlay=JSON.parse(localStorage.getItem('sumiEditorPlay')||'null'); }catch(e){}
    const startId = queryLevel || editorPlay?.levelId || this.data.levelSequence?.start || levelIds[0] || 'chapter1_dojo';
    this.setLevel(startId);
    this.data.enemies = this.resolveExtends(this.data.enemiesRaw);
    window.CONFIG = this.toLegacyConfig();
    return this.data;
  }
  applyEditorPreview(){
    const qs=new URLSearchParams(location.search);
    let recentEditorPlay=false;
    try{ const ep=JSON.parse(localStorage.getItem('sumiEditorPlay')||'null'); recentEditorPlay=!!(ep?.at && Date.now()-ep.at<10*60*1000); }catch(e){}
    if(qs.get('editorPreview')!=='1' && qs.get('testEditor')!=='1' && !recentEditorPlay) return;
    try{
      const raw=localStorage.getItem('sumiEditorProject');
      if(!raw) return;
      const ed=JSON.parse(raw);
      if(ed.config) this.data.config = Math2.deepMerge(this.data.config||{}, ed.config);
      if(ed.level_sequence) this.data.levelSequence = ed.level_sequence;
      if(ed.levels){
        this.data.levels = {...(this.data.levels||{}), ...ed.levels};
        for(const [id,lvl] of Object.entries(this.data.levels)){ if(lvl) lvl.id=lvl.id||id; }
      }
      if(ed.enemies) this.data.enemiesRaw = Math2.deepMerge(this.data.enemiesRaw||{}, ed.enemies);
      console.info('Loaded editor preview project from localStorage');
    }catch(err){ console.error('Editor preview load failed', err); }
  }

  resolveExtends(raw){
    const out={};
    const resolve=(id)=>{ if(out[id]) return out[id]; const item=raw[id]; if(!item) throw new Error('Unknown enemy '+id); out[id]=item.extends ? Math2.deepMerge(resolve(item.extends), item) : {...item}; return out[id]; };
    Object.keys(raw).forEach(resolve); return out;
  }
  toLegacyConfig(){
    const c=this.data.config;
    return { W:c.viewport.w, H:c.viewport.h, WORLD:c.world, PLAYER:{speed:c.player.move_speed, hp:c.player.max_hp}, COLORS:c.colors, ASSETS:c.assets };
  }
  setLevel(id){
    const level = this.data.levels?.[id] || this.data.levels?.[this.data.levelSequence?.start] || this.data.level;
    this.data.level = level;
    this.data.currentLevelId = level?.id || id;
    return level;
  }
  nextLevelId(id){
    const levels=(this.data.levelSequence?.levels || []).filter(lid=>!this.data.levels?.[lid]?.is_room);
    const i=levels.indexOf(id || this.data.currentLevelId);
    return i>=0 && i<levels.length-1 ? levels[i+1] : null;
  }
  enemy(id){ return this.data.enemies[id]; }
  element(id){ return this.data.elements[id]; }
}
window.DataManager = DataManager;
