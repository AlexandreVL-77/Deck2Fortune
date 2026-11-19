import './styles.css';
import './booster.css';
import { GameState } from './systems/GameState.js';
import { ShopSystem } from './systems/ShopSystem.js';
import { renderCards, renderDrawer, bindUI } from './ui/interface.js';
import { ThreeWorld } from './scenes/ThreeWorld.js';
const state=new GameState();
const world=new ThreeWorld(document.getElementById('game'),state);
const home=document.getElementById('home-screen'),hud=document.getElementById('hud');
const shopPanel=document.getElementById('home-shop-panel');
const loading=document.getElementById('loading-screen');
function updateHomeStats(){
  document.getElementById('home-captain').textContent=state.captainName;
  document.getElementById('home-ship').textContent=state.shipName;
  document.getElementById('home-gold').textContent=state.gold;
  document.getElementById('home-hp').textContent=Math.ceil(state.hp);
  document.getElementById('home-owned-boosters').textContent=state.ownedBoosters;
  const meleeInfo=document.getElementById('home-melee-info'),rangedInfo=document.getElementById('home-ranged-info');
  if(meleeInfo)meleeInfo.textContent=`${state.melee.name} · ${state.melee.damage} dégâts`;
  if(rangedInfo)rangedInfo.textContent=`${state.ranged.name} · ${state.ranged.damage} dégâts`;
}
function enterGame(){loading.hidden=true;document.body.classList.remove('is-loading');shopPanel.hidden=true;home.classList.add('home-hidden');hud.classList.remove('hidden');world.setHome(false);renderCards(state);renderDrawer(state);}
function launchGame(reset=false){if(reset){state.newWorld();state.emit();world.resetWorld();}loading.hidden=false;document.body.classList.add('is-loading');window.setTimeout(enterGame,7200);}
function returnToMenu(){
  state.camera={x:world.target.x,z:world.target.z};state.saveProgress();
  hud.classList.add('hidden');home.classList.remove('home-hidden');world.setHome(true);
  document.getElementById('continue-game').hidden=false;updateHomeStats();
}
document.getElementById('start-game').addEventListener('click',()=>launchGame(true));
document.getElementById('continue-game').addEventListener('click',()=>launchGame(false));
document.getElementById('quit-adventure').addEventListener('click',returnToMenu);
document.getElementById('home-shop-button').addEventListener('click',()=>{shopPanel.hidden=false;});
document.getElementById('close-home-shop').addEventListener('click',()=>{shopPanel.hidden=true;});
function homePurchase(action,reveal=false){
  const result=action();
  updateHomeStats();
  document.getElementById('home-shop-feedback').textContent=result.message;
  if(result.ok&&reveal){shopPanel.hidden=true;world.showBoosterReveal(result.cards);}
}
document.getElementById('home-buy-booster').addEventListener('click',()=>homePurchase(()=>new ShopSystem(state).buyBooster(),true));
document.getElementById('home-buy-repair').addEventListener('click',()=>homePurchase(()=>new ShopSystem(state).buyRepair()));
document.getElementById('home-upgrade-melee').addEventListener('click',()=>homePurchase(()=>new ShopSystem(state).upgradeWeapon('melee')));
document.getElementById('home-upgrade-ranged').addEventListener('click',()=>homePurchase(()=>new ShopSystem(state).upgradeWeapon('ranged')));
document.getElementById('continue-game').hidden=!localStorage.getItem('deck2fortune.world');
bindUI(state,world);state.subscribe(updateHomeStats);renderCards(state);renderDrawer(state);updateHomeStats();
window.deck2fortune={world,state};
