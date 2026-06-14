class Assets {
  constructor(){ this.images={}; this.json={}; this.failed={}; this.srcKeys={}; }
  loadImage(name, src){ return new Promise(resolve => { const img=new Image(); img.onload=()=>{this.images[name]=img; resolve(img);}; img.onerror=()=>{console.warn('Asset failed', name, src); this.failed[name]=src; resolve(null);}; img.src=src; }); }
  async loadJson(path, fallback=null){ try{ const r=await fetch(path,{cache:'no-store'}); if(!r.ok) throw new Error(r.status); return await r.json(); } catch(e){ return fallback; } }
  async loadAll(data){
    const cfg=data.config;
    await Promise.all([this.loadImage('player_atlas', cfg.assets.player_atlas), this.loadImage('sourcePanel', cfg.assets.source_panel)]);
    if(cfg.assets.npc_sheet) await this.loadImage('npc_sheet', cfg.assets.npc_sheet);
    if(cfg.assets.npc_sheet_feudal) await this.loadImage('npc_sheet_feudal', cfg.assets.npc_sheet_feudal);
    if(cfg.assets.npc_sheet_cyber) await this.loadImage('npc_sheet_cyber', cfg.assets.npc_sheet_cyber);
    if(cfg.assets.enemy_roster_contact) await this.loadImage('enemy_roster_contact', cfg.assets.enemy_roster_contact);
    if(cfg.assets.transition_panel) await this.loadImage('transition_panel', cfg.assets.transition_panel);
    this.backgroundKeys = [];
    const bgs = cfg.assets.chapter1_backgrounds || [];
    for(let i=0;i<bgs.length;i++){
      const key = 'chapter1_bg_' + i;
      const img = await this.loadImage(key, bgs[i]);
      if(img) this.backgroundKeys.push(key);
    }
    this.json.player_atlas = await this.loadJson(cfg.assets.player_atlas_json, window.PHASE2_DATA?.player_atlas || null);
    this.itemKeys = {};
    const itemSprites = cfg.assets.item_sprites || {};
    for(const [kind, src] of Object.entries(itemSprites)){
      const key = 'item_' + kind;
      await this.loadImage(key, src);
      this.itemKeys[kind] = key;
    }
    this.itemSheetKeys = {};
    this.itemSheetMeta = cfg.assets.item_sprite_meta || { frame_w:192, frame_h:192, frames:1, fps:1 };
    const itemSheets = cfg.assets.item_sprite_sheets || {};
    for(const [kind, src] of Object.entries(itemSheets)){
      const key = 'item_sheet_' + kind;
      const img = await this.loadImage(key, src);
      if(img) this.itemSheetKeys[kind] = key;
    }
    // Load enemy atlases
    const enemies = data.enemies || {};
    const loaded = {};
    const atlasCache = window.PHASE2_DATA?.enemy_atlases || {};
    for(const [etype, edata] of Object.entries(enemies)){
      const img = edata.sprite_image;
      const jsonPath = edata.sprite_atlas;
      if(img && !loaded[img]){
        const key = 'enemy_' + img.replace(/[^a-z0-9]/gi,'_');
        await this.loadImage(key, img);
        loaded[img] = key;
      }
      if(jsonPath && !loaded[jsonPath]){
        const jkey = 'enemy_json_' + jsonPath.replace(/[^a-z0-9]/gi,'_');
        // Try fetch, fallback to bootstrap embedded data
        const fbKey = jsonPath.replace('assets/sprites/','').replace('/atlas.json','');
        const fallbackEntry = atlasCache[fbKey] || null;
        const fallback = fallbackEntry?.meta || fallbackEntry || null;
        const jdata = await this.loadJson(jsonPath, fallback);
        if(jdata && !jdata.procedural){ this.json[jkey] = jdata; }
        loaded[jsonPath] = jkey;
      }
    }
    this.enemyImageKeys = {};
    this.enemyJsonKeys = {};
    for(const [etype, edata] of Object.entries(enemies)){
      if(edata.sprite_image) this.enemyImageKeys[etype] = loaded[edata.sprite_image];
      if(edata.sprite_atlas) this.enemyJsonKeys[etype] = loaded[edata.sprite_atlas];
    }
  }

  async loadLevelBackgrounds(level){
    this.backgroundKeys = [];
    const raw = level?.backgrounds || (level?.background_segments||[]).map(s=>s.src).filter(Boolean) || [];
    const fallback = CONFIG?.ASSETS?.chapter1_backgrounds || [];
    const list = raw.length ? raw : fallback;
    for(let i=0;i<list.length;i++){
      const src = (typeof list[i]==='string' ? list[i] : list[i].src);
      if(!src) continue;
      const clean = src.split('?')[0];
      let key = this.srcKeys[clean];
      if(!key){ key='level_bg_' + clean.replace(/[^a-z0-9]/gi,'_'); await this.loadImage(key, clean + (clean.includes('?')?'':'?v=editor2')); this.srcKeys[clean]=key; }
      if(this.images[key]) this.backgroundKeys.push(key);
    }
  }

  get(name){ return this.images[name] || null; }
  getEnemyImage(type){ return this.images[this.enemyImageKeys?.[type]] || null; }
  getEnemyMeta(type){ return this.json[this.enemyJsonKeys?.[type]] || null; }
  getItemImage(kind){ return this.images[this.itemKeys?.[kind]] || null; }
  getItemSheet(kind){ return this.images[this.itemSheetKeys?.[kind]] || null; }
  getItemSheetMeta(){ return this.itemSheetMeta || { frame_w:192, frame_h:192, frames:1, fps:1 }; }
}
window.Assets = Assets;
