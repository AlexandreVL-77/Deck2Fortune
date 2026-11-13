import './styles.css';
import { GameState } from './systems/GameState.js';
import { ShopSystem } from './systems/ShopSystem.js';
import { renderCards, renderDrawer, bindUI } from './ui/interface.js';
import { ThreeWorld } from './scenes/ThreeWorld.js';
const state=new GameState();
const world=new ThreeWorld(document.getElementById('game'),state);
const home=document.getElementById('home-screen'),hud=document.getElementById('hud');
const shopPanel=document.getElementById('home-shop-panel');
function updateHomeStats(){
  document.getElementById('home-captain').textContent=state.captainName;
  document.getElementById('home-ship').textContent=state.shipName;
  document.getElementById('home-gold').textContent=state.gold;
  document.getElementById('home-hp').textContent=Math.ceil(state.hp);
  document.getElementById('home-owned-boosters').textContent=state.ownedBoosters;
}
function enterGame(){shopPanel.hidden=true;home.classList.add('home-hidden');hud.classList.remove('hidden');world.setHome(false);renderCards(state);renderDrawer(state);}
function returnToMenu(){
  state.camera={x:world.target.x,z:world.target.z};state.saveProgress();
  hud.classList.add('hidden');home.classList.remove('home-hidden');world.setHome(true);
  document.getElementById('continue-game').hidden=false;updateHomeStats();
}
document.getElementById('start-game').addEventListener('click',()=>{state.newWorld();state.emit();world.resetWorld();enterGame();});
document.getElementById('continue-game').addEventListener('click',enterGame);
document.getElementById('quit-adventure').addEventListener('click',returnToMenu);
document.getElementById('home-shop-button').addEventListener('click',()=>{shopPanel.hidden=false;});
document.getElementById('close-home-shop').addEventListener('click',()=>{shopPanel.hidden=true;});
document.getElementById('home-buy-booster').addEventListener('click',()=>{
  const result=new ShopSystem(state).buyBooster();
  updateHomeStats();
  if(result.ok){shopPanel.hidden=true;world.showBoosterReveal(result.reward);}
  else document.getElementById('home-buy-booster').textContent='45 ✦ · OR INSUFFISANT';
});
document.getElementById('continue-game').hidden=!localStorage.getItem('deck2fortune.world');
bindUI(state,world);state.subscribe(updateHomeStats);renderCards(state);renderDrawer(state);updateHomeStats();
window.deck2fortune={world,state};
