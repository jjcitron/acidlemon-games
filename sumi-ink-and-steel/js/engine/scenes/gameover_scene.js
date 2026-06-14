class GameOverScene extends Scene { constructor(game, victory=false){ super(game); this.victory=victory; } update(dt){ if(this.game.input.wasPressed('R')){ if(this.victory) this.game.startNewGame(); else this.game.startNewGame(); } if(this.game.input.wasPressed('Enter')) this.game.scenes.replace(new MenuScene(this.game)); }
  draw(ctx){ const below=this.game.lastChapterScene; if(below) below.draw(ctx); this.game.ui.overlay(ctx,this.victory?(this.game.levelComplete?'CHAPTER CLEARED':'WAVE CLEARED'):'FALLEN',this.victory?(this.game.levelComplete?'R replay chapter / Enter menu':'R next wave / Enter menu'):'R restart / Enter menu'); }
}
class VictoryScene extends GameOverScene { constructor(game){ super(game,true); } }
window.GameOverScene=GameOverScene; window.VictoryScene=VictoryScene;
