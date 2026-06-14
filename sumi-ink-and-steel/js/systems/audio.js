class AudioSystem {
  constructor(){
    this.ctx=null; this.master=null; this.musicGain=null; this.sfxGain=null; this.enabled=true; this.started=false;
    this.nextNote=0; this.step=0; this.timer=null; this.drones=[];
    this.scale=[0,2,3,5,7,10,12,14,15,19];
    this.sfxCooldowns={}; this.fileMusic=null; this.fileMusicIndex=0; this.fileMusicStarted=false;
    this.sfxBuffers={}; this.sfxLoading={}; this.sfxRotations={}; this.sfxWarmStarted=false;
  }
  ensure(){
    if(this.ctx) return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    this.ctx=new AC();
    this.master=this.ctx.createGain(); this.master.gain.value=.78; this.master.connect(this.ctx.destination);
    this.musicGain=this.ctx.createGain(); this.musicGain.gain.value=.36; this.musicGain.connect(this.master);
    this.sfxGain=this.ctx.createGain(); this.sfxGain.gain.value=.95; this.sfxGain.connect(this.master);
  }
  start(){
    this.ensure(); if(this.ctx && this.ctx.state==='suspended') this.ctx.resume();
    this.startFileMusic(); this.warmSfx();
    if(!this.ctx) return;
    if(this.started) return;
    this.started=true; this.nextNote=this.ctx.currentTime+.05; this.startDrones(); this.scheduleLoop();
  }
  startFileMusic(){
    if(!this.enabled || this.fileMusicStarted) return;
    const tracks=CONFIG?.ASSETS?.music_tracks || [];
    if(!tracks.length || typeof Audio==='undefined') return;
    const src=tracks[this.fileMusicIndex % tracks.length];
    const a=new Audio(src); a.loop=false; a.volume=.38; a.preload='auto';
    a.addEventListener('ended',()=>{ this.fileMusicStarted=false; this.fileMusicIndex++; this.startFileMusic(); });
    a.addEventListener('error',()=>{ console.warn('Music track failed', src); this.fileMusicStarted=false; this.fileMusicIndex++; if(this.fileMusicIndex<tracks.length) this.startFileMusic(); });
    this.fileMusic=a;
    const play=a.play();
    if(play?.then) play.then(()=>{ this.fileMusicStarted=true; }).catch(()=>{ this.fileMusicStarted=false; }); else this.fileMusicStarted=true;
  }
  toggle(){ this.enabled=!this.enabled; if(!this.enabled){ if(this.master) this.master.gain.value=0; if(this.fileMusic) this.fileMusic.pause(); } else { if(this.master) this.master.gain.value=.78; this.startFileMusic(); this.warmSfx(); } return this.enabled; }
  startDrones(){
    if(!this.ctx || this.drones.length) return;
    const notes=[55,82.41,110];
    for(const f of notes){
      const o=this.ctx.createOscillator(), g=this.ctx.createGain(), filt=this.ctx.createBiquadFilter();
      o.type='sawtooth'; o.frequency.value=f; filt.type='lowpass'; filt.frequency.value=520; filt.Q.value=.8;
      g.gain.value=.035; o.connect(filt); filt.connect(g); g.connect(this.musicGain); o.start(); this.drones.push({o,g,filt});
    }
  }
  cooldown(name, sec=null){
    const map=CONFIG?.ASSETS?.sfx || {};
    const spec=map[name];
    const defaultSec= name==='ui' || name==='pickup' ? .035 : (name==='enemyWindup' ? .12 : .055);
    const cd=sec ?? (Array.isArray(spec)?(spec[0]?.cooldown):spec?.cooldown) ?? defaultSec;
    const now=this.ctx?.currentTime||0; if((this.sfxCooldowns[name]||0)>now) return false; this.sfxCooldowns[name]=now+cd; return true;
  }
  osc(freq, dur, type='sine', gain=.2, dest=null, delay=0, bend=0){
    if(!this.enabled) return; this.ensure(); if(!this.ctx) return; const t=this.ctx.currentTime+delay;
    const o=this.ctx.createOscillator(), g=this.ctx.createGain(); o.type=type; o.frequency.setValueAtTime(freq,t);
    if(bend) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*bend),t+dur*.88);
    g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(gain,t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(dest||this.sfxGain||this.master); o.start(t); o.stop(t+dur+.04);
  }
  noise(dur=.12,gain=.12,filter=900,delay=0,type='bandpass'){
    if(!this.enabled) return; this.ensure(); if(!this.ctx) return; const t=this.ctx.currentTime+delay;
    const len=Math.max(1,Math.floor(this.ctx.sampleRate*dur)); const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate); const arr=buf.getChannelData(0);
    for(let i=0;i<len;i++) arr[i]=(Math.random()*2-1)*(1-i/len);
    const src=this.ctx.createBufferSource(); src.buffer=buf; const bp=this.ctx.createBiquadFilter(); bp.type=type; bp.frequency.value=filter; bp.Q.value=3;
    const g=this.ctx.createGain(); g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    src.connect(bp); bp.connect(g); g.connect(this.sfxGain||this.master); src.start(t); src.stop(t+dur+.03);
  }
  sfxEntries(name){
    const spec=CONFIG?.ASSETS?.sfx?.[name];
    if(!spec) return [];
    return (Array.isArray(spec) ? spec : [spec]).map(x=>typeof x==='string'?{src:x}:x).filter(x=>x?.src);
  }
  pickSfx(name){
    const entries=this.sfxEntries(name); if(!entries.length) return null;
    const i=this.sfxRotations[name]||0; this.sfxRotations[name]=(i+1)%entries.length;
    return entries[i%entries.length];
  }
  sfxKey(entry){ return (entry.src||'').split('?')[0]; }
  async loadSfx(entry){
    if(!this.ctx || !entry?.src) return null;
    const key=this.sfxKey(entry); if(this.sfxBuffers[key]) return this.sfxBuffers[key];
    if(this.sfxLoading[key]) return this.sfxLoading[key];
    this.sfxLoading[key]=fetch(entry.src, {cache:'force-cache'})
      .then(r=>{ if(!r.ok) throw new Error(r.status+' '+entry.src); return r.arrayBuffer(); })
      .then(buf=>this.ctx.decodeAudioData(buf))
      .then(audioBuf=>{ this.sfxBuffers[key]=audioBuf; return audioBuf; })
      .catch(err=>{ console.warn('SFX failed', entry.src, err); return null; });
    return this.sfxLoading[key];
  }
  warmSfx(){
    if(this.sfxWarmStarted || !this.ctx) return;
    this.sfxWarmStarted=true;
    const map=CONFIG?.ASSETS?.sfx || {};
    for(const name of Object.keys(map)) for(const entry of this.sfxEntries(name)) this.loadSfx(entry);
  }
  playFileSfx(name){
    const entry=this.pickSfx(name); if(!entry || !this.enabled) return false;
    const key=this.sfxKey(entry), volume=entry.volume ?? 1, rate=entry.rate ?? 1;
    const buffer=this.sfxBuffers[key];
    if(buffer && this.ctx){
      const src=this.ctx.createBufferSource(), gain=this.ctx.createGain();
      src.buffer=buffer; src.playbackRate.value=rate; gain.gain.value=volume;
      src.connect(gain); gain.connect(this.sfxGain||this.master); src.start(); return true;
    }
    this.loadSfx(entry);
    if(typeof Audio!=='undefined'){
      const a=new Audio(entry.src); a.volume=Math.min(1,Math.max(0,volume*.72)); a.playbackRate=rate; a.preload='auto';
      const p=a.play(); if(p?.catch) p.catch(()=>{}); return true;
    }
    return false;
  }
  play(name){
    this.start(); if(!this.ctx || !this.cooldown(name)) return;
    const usedFile=this.playFileSfx(name);
    const sweeten = ['pickup','key','gateLocked','talk','ui'].includes(name);
    if(!usedFile || sweeten) this.playSynth(name, usedFile ? .28 : 1);
  }
  playSynth(name, scale=1){
    const O=(freq,dur,type='sine',gain=.2,dest=null,delay=0,bend=0)=>this.osc(freq,dur,type,gain*scale,dest,delay,bend);
    const N=(dur=.12,gain=.12,filter=900,delay=0,type='bandpass')=>this.noise(dur,gain*scale,filter,delay,type);
    if(name==='slash') { N(.105,.55,2400,0,'highpass'); O(520,.10,'triangle',.18,null,0,.62); O(1200,.045,'sine',.12,null,.015,.5); }
    else if(name==='heavy') { N(.18,.72,950,0,'bandpass'); O(95,.22,'sawtooth',.28,null,0,.45); O(310,.12,'square',.12,null,.035,.65); }
    else if(name==='dodge') { N(.08,.35,3200,0,'highpass'); O(250,.08,'triangle',.12,null,0,1.6); }
    else if(name==='enemyWindup') { O(180,.11,'square',.13,null,0,.7); N(.07,.18,1200); }
    else if(name==='enemySwing') { N(.12,.55,1700,0,'highpass'); O(240,.09,'sawtooth',.14,null,0,.55); }
    else if(name==='enemyHit') { N(.11,.58,720); O(130,.10,'square',.2,null,0,.7); }
    else if(name==='enemyDeath') { N(.28,.72,430); O(120,.34,'sawtooth',.28,null,0,.42); O(55,.42,'triangle',.19,null,.035,.5); }
    else if(name==='playerHit') { N(.16,.70,540); O(74,.24,'sawtooth',.30,null,0,.55); }
    else if(name==='pickup') { O(520,.09,'triangle',.22); O(780,.12,'triangle',.19,null,.06); O(1040,.2,'sine',.16,null,.13); }
    else if(name==='key') { O(392,.09,'triangle',.22); O(587,.12,'triangle',.2,null,.06); O(880,.22,'sine',.19,null,.13); N(.16,.15,5000,.05,'highpass'); }
    else if(name==='gateOpen') { O(98,.35,'sawtooth',.26); O(196,.38,'triangle',.19,null,.08); N(.28,.35,750); }
    else if(name==='gateLocked') { O(90,.14,'square',.24); O(70,.12,'square',.17,null,.09); }
    else if(name==='talk') { O(330,.08,'triangle',.16); O(440,.08,'triangle',.12,null,.08); }
    else if(name==='boss') { N(.35,.75,300); O(55,.6,'sawtooth',.35); O(110,.5,'square',.18,null,.06); }
    else if(name==='ui') { O(330,.06,'triangle',.12); O(495,.08,'triangle',.1,null,.05); }
  }
  scheduleLoop(){
    if(!this.started || !this.ctx) return;
    const now=this.ctx.currentTime;
    while(this.nextNote < now + 1.1){
      const beat=this.nextNote, deg=this.scale[this.step%this.scale.length], base=55;
      const f=base*Math.pow(2,deg/12);
      // taiko pulse + shamisen-like plucks + ominous drone
      if(this.step%2===0){ this.noise(.055,.18,150,beat-now,'lowpass'); this.osc(70,.08,'sine',.055,this.musicGain,beat-now,.6); }
      if(this.step%4===1){ this.osc(f*4,.11,'triangle',.075,this.musicGain,beat-now,.72); this.osc(f*8,.045,'square',.025,this.musicGain,beat-now+.02,.55); }
      if(this.step%8===5){ this.noise(.13,.07,2600,beat-now+.02,'highpass'); }
      if(this.step%16===0){ this.osc(55,.75,'sine',.09,this.musicGain,beat-now,.9); }
      this.nextNote += .30; this.step++;
    }
    this.timer=setTimeout(()=>this.scheduleLoop(),120);
  }
}
window.AudioSystem=AudioSystem;
