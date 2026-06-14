class Input {
  constructor(){
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.lastDir = {x:1,y:0};
    this.touchAxis = {x:0,y:0};
    this.gamepadAxis = {x:0,y:0};
    this.gamepadPrev = new Map();
    this.gamepadInfo = {connected:false,label:'',index:null};
    this.actionMap = {
      start:'Enter', light:'J', heavy:'K', jump:'Space', dodge:'Shift', interact:'E', talk:'T', special:'U', pause:'P', audio:'M', element:'Q', elem1:'1', elem2:'2', elem3:'3', elem4:'4'
    };
    window.addEventListener('keydown', e => { const k=this.norm(e.key); if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Spacebar','F5'].includes(e.key)) e.preventDefault(); if(!this.down.has(k)) this.pressed.add(k); this.down.add(k); });
    window.addEventListener('keyup', e => { const k=this.norm(e.key); this.down.delete(k); this.released.add(k); });
    window.addEventListener('blur', () => { this.down.clear(); this.pressed.clear(); this.released.clear(); this.touchAxis={x:0,y:0}; this.gamepadAxis={x:0,y:0}; });
    window.addEventListener('gamepadconnected', e => { this.gamepadInfo={connected:true,label:e.gamepad.id,index:e.gamepad.index}; this._toastController('Controller connected: '+this.shortPadName(e.gamepad.id)); });
    window.addEventListener('gamepaddisconnected', e => { this.gamepadInfo={connected:false,label:'',index:null}; this.gamepadPrev.delete(e.gamepad.index); this.gamepadAxis={x:0,y:0}; this._toastController('Controller disconnected'); });
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>this.createTouchControls()); else this.createTouchControls();
  }
  norm(k){ if(k===' ') return 'Space'; if(k==='Spacebar') return 'Space'; if(k==='Escape') return 'P'; return k.length===1 ? k.toUpperCase() : k; }
  isDown(...keys){ return keys.some(k => this.down.has(k)); }
  wasPressed(...keys){ return keys.some(k => this.pressed.has(k)); }
  wasReleased(...keys){ return keys.some(k => this.released.has(k)); }
  axis(){
    let x=0,y=0;
    if(this.isDown('A','ArrowLeft')) x--;
    if(this.isDown('D','ArrowRight')) x++;
    if(this.isDown('W','ArrowUp')) y--;
    if(this.isDown('S','ArrowDown')) y++;
    x += this.touchAxis.x + this.gamepadAxis.x;
    y += this.touchAxis.y + this.gamepadAxis.y;
    if(Math.abs(x)<.08) x=0; if(Math.abs(y)<.08) y=0;
    if(x||y){ const l=Math.hypot(x,y); if(l>1){ x/=l; y/=l; } this.lastDir={x,y}; }
    return {x,y};
  }
  update(){ this.pollGamepads(); }
  endFrame(){ this.pressed.clear(); this.released.clear(); }
  _press(key){ key=this.norm(key); if(!this.down.has(key)) this.pressed.add(key); this.down.add(key); }
  _release(key){ key=this.norm(key); if(this.down.has(key)) this.released.add(key); this.down.delete(key); }
  _tap(key){ this._press(key); }

  pollGamepads(){
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    if(!pads.length){ this.gamepadAxis={x:0,y:0}; return; }
    const pad = pads.find(p=>p.index===this.gamepadInfo.index) || pads[0];
    this.gamepadInfo={connected:true,label:pad.id,index:pad.index};
    const dead=.22;
    const lx=this.applyDeadzone(pad.axes[0]||0, dead), ly=this.applyDeadzone(pad.axes[1]||0, dead);
    const dpadX=(this.buttonValue(pad,15)>0.5?1:0) - (this.buttonValue(pad,14)>0.5?1:0);
    const dpadY=(this.buttonValue(pad,13)>0.5?1:0) - (this.buttonValue(pad,12)>0.5?1:0);
    this.gamepadAxis={x:Math.abs(dpadX)>0?dpadX:lx, y:Math.abs(dpadY)>0?dpadY:ly};
    const map={
      0:'Space',      // Xbox A: jump / confirm
      1:'Shift',      // Xbox B: dodge / cancel
      2:'J',          // Xbox X: light attack
      3:'K',          // Xbox Y: heavy attack
      4:'Q',          // LB: hold element modifier
      5:'U',          // RB: special
      6:'T',          // LT: talk
      7:'E',          // RT: interact / enter / exit room
      8:'M',          // View: audio toggle
      9:'P'           // Menu: pause
    };
    let prev=this.gamepadPrev.get(pad.index);
    if(!prev){ prev={buttons:[]}; this.gamepadPrev.set(pad.index,prev); }
    for(const [idx,key] of Object.entries(map)){
      const i=Number(idx); const isDown=this.buttonValue(pad,i)>0.45; const was=!!prev.buttons[i];
      if(isDown && !was) this._press(key);
      if(!isDown && was) this._release(key);
      prev.buttons[i]=isDown;
    }
  }
  buttonValue(pad,i){ const b=pad.buttons?.[i]; if(!b) return 0; return typeof b==='number'?b:(b.value || (b.pressed?1:0)); }
  applyDeadzone(v,d){ if(Math.abs(v)<d) return 0; const sign=Math.sign(v); return sign*((Math.abs(v)-d)/(1-d)); }
  shortPadName(id){ return (id||'gamepad').replace(/\s*\([^)]*\)/g,'').slice(0,36); }
  _toastController(msg){ setTimeout(()=>{ if(window.game?.ui?.toast) window.game.ui.toast(msg); },80); }

  createTouchControls(){
    if(document.getElementById('touchControls')) return;
    const wrap=document.createElement('div');
    wrap.id='touchControls';
    wrap.setAttribute('aria-label','Touchscreen controls');
    wrap.innerHTML=`
      <button id="touchStart" class="touch-start" data-action="start">Start / Continue</button>
      <div id="touchMove" class="touch-stick" aria-label="Virtual movement stick"><div class="touch-stick-knob"></div><span>MOVE</span></div>
      <div id="touchButtons" class="touch-buttons">
        <button data-action="talk" class="small">Talk</button>
        <button data-action="interact" class="small">Door</button>
        <button data-action="special" class="small">Special</button>
        <button data-action="dodge">Dodge</button>
        <button data-action="light" class="primary">Light</button>
        <button data-action="heavy" class="primary">Heavy</button>
        <button data-action="jump">Jump</button>
      </div>
      <div id="touchElementRow" class="touch-element-row">
        <button data-action="element">Hold Element</button>
        <button data-action="elem1">1</button><button data-action="elem2">2</button><button data-action="elem3">3</button><button data-action="elem4">4</button>
      </div>`;
    document.body.appendChild(wrap);
    this.bindTouchStick(wrap.querySelector('#touchMove'));
    this.bindTouchButtons(wrap);
  }
  bindTouchStick(el){
    if(!el) return;
    const knob=el.querySelector('.touch-stick-knob');
    let active=null, rect=null;
    const setAxis=(clientX,clientY)=>{
      rect=rect||el.getBoundingClientRect();
      const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
      let dx=clientX-cx, dy=clientY-cy;
      const max=rect.width*.39; const len=Math.hypot(dx,dy);
      if(len>max){ dx=dx/len*max; dy=dy/len*max; }
      this.touchAxis={x:dx/max,y:dy/max};
      if(knob) knob.style.transform=`translate(${dx}px, ${dy}px)`;
    };
    const clear=()=>{ active=null; rect=null; this.touchAxis={x:0,y:0}; if(knob) knob.style.transform='translate(0,0)'; };
    el.addEventListener('pointerdown',e=>{ active=e.pointerId; rect=el.getBoundingClientRect(); el.setPointerCapture(e.pointerId); setAxis(e.clientX,e.clientY); e.preventDefault(); },{passive:false});
    el.addEventListener('pointermove',e=>{ if(e.pointerId===active){ setAxis(e.clientX,e.clientY); e.preventDefault(); } },{passive:false});
    el.addEventListener('pointerup',e=>{ if(e.pointerId===active){ clear(); e.preventDefault(); } },{passive:false});
    el.addEventListener('pointercancel',e=>{ if(e.pointerId===active) clear(); },{passive:false});
  }
  bindTouchButtons(root){
    root.querySelectorAll('button[data-action]').forEach(btn=>{
      const key=this.actionMap[btn.dataset.action]; if(!key) return;
      const down=e=>{ this._press(key); btn.classList.add('active'); e.preventDefault(); };
      const up=e=>{ this._release(key); btn.classList.remove('active'); e.preventDefault(); };
      btn.addEventListener('pointerdown',down,{passive:false});
      btn.addEventListener('pointerup',up,{passive:false});
      btn.addEventListener('pointercancel',up,{passive:false});
      btn.addEventListener('pointerleave',e=>{ if(btn.classList.contains('active')) up(e); },{passive:false});
    });
  }
}
window.Input = Input;
