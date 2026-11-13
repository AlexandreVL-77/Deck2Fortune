import './styles.css';
import { GameState } from './systems/GameState.js';
import { renderCards, renderDrawer, bindUI } from './ui/interface.js';
import { ThreeWorld } from './scenes/ThreeWorld.js';
const state=new GameState();
const world=new ThreeWorld(document.getElementById('game'),state);
const home=document.getElementById('home-screen'),hud=document.getElementById('hud');
function updateHomeStats(){
  document.getElementById('home-captain').textContent=state.captainName;
  document.getElementById('home-ship').textContent=state.shipName;
  document.getElementById('home-gold').textContent=state.gold;
  document.getElementById('home-hp').textContent=Math.ceil(state.hp);
}
function enterGame(){home.classList.add('home-hidden');hud.classList.remove('hidden');world.setHome(false);renderCards(state);renderDrawer(state);}
document.getElementById('start-game').addEventListener('click',()=>{state.newWorld();state.emit();world.resetWorld();enterGame();});
document.getElementById('continue-game').addEventListener('click',enterGame);
document.getElementById('continue-game').hidden=!localStorage.getItem('deck2fortune.world');
bindUI(state,world);state.subscribe(updateHomeStats);renderCards(state);renderDrawer(state);updateHomeStats();
window.deck2fortune={world,state};
