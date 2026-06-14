class Scene { constructor(game){ this.game=game; } onEnter(){} onExit(){} update(dt){} draw(ctx){} }
class SceneStack { constructor(game){ this.game=game; this.stack=[]; } push(scene){ this.stack.push(scene); scene.onEnter(); } pop(){ const s=this.stack.pop(); if(s) s.onExit(); return s; } replace(scene){ while(this.stack.length) this.pop(); this.push(scene); } current(){ return this.stack[this.stack.length-1]; } update(dt){ this.current()?.update(dt); } draw(ctx){ for(const s of this.stack) s.draw(ctx); } }
window.Scene=Scene; window.SceneStack=SceneStack;
