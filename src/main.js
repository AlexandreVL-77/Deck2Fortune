import Phaser from 'phaser';
import './styles.css';
import { GameScene } from './scenes/GameScene.js';
import { GameState } from './systems/GameState.js';
import { renderCards, renderDrawer, bindUI } from './ui/interface.js';

const state = new GameState();
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#69cbd0',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 390,
    height: 844
  },
  scene: [new GameScene(state)],
  render: { antialias: true, pixelArt: false, roundPixels: true }
};
const game = new Phaser.Game(config);
window.pirateHex = { game, state };

bindUI(state, game);
renderCards(state);
renderDrawer(state);
