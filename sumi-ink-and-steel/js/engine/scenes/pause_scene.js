class PauseScene extends Scene { update(dt){ if(this.game.input.wasPressed('P')) this.game.scenes.pop(); if(this.game.input.wasPressed('S')){ this.game.save.save('slot1','Phase 2 Save'); this.game.ui.toast('Saved slot 1'); } }
  draw(ctx){ const below=this.game.scenes.stack[this.game.scenes.stack.length-2]; if(below) below.draw(ctx); this.game.ui.overlay(ctx,'PAUSED','P resume / S save slot 1'); }
}
window.PauseScene=PauseScene;
