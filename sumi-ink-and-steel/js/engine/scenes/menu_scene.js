class MenuScene extends Scene {
  update(dt){ const input=this.game.input; if(input.wasPressed('Enter','Space','J','K','U','E')) this.game.startNewGame(); if(input.wasPressed('1')) this.game.loadGame('slot1'); if(input.wasPressed('2')) this.game.loadGame('slot2'); if(input.wasPressed('3')) this.game.loadGame('slot3'); }
  draw(ctx){ this.game.drawBackdrop(ctx); this.game.ui.drawMenu(ctx,this.game); }
}
window.MenuScene=MenuScene;
