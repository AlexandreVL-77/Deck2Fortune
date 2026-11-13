import './styles.css';
import { GameState } from './systems/GameState.js';
import { renderCards, renderDrawer, bindUI } from './ui/interface.js';
import { ThreeWorld } from './scenes/ThreeWorld.js';
const state=new GameState();
const world=new ThreeWorld(document.getElementById('game'),state);
const home=document.getElementById('home-screen'),hud=document.getElementById('hud');
function enterGame(){home.classList.add('home-hidden');hud.classList.remove('hidden');world.setHome(false);renderCards(state);renderDrawer(state);}
document.getElementById('start-game').addEventListener('click',enterGame);
document.getElementById('continue-game').addEventListener('click',enterGame);
bindUI(state,world);renderCards(state);renderDrawer(state);
window.deck2fortune={world,state};