import './styles.css';
import './booster.css';
import { GameState } from './systems/GameState.js';
import { ShopSystem } from './systems/ShopSystem.js';
import { renderCards, renderDrawer, bindUI } from './ui/interface.js';
import { ThreeWorld } from './scenes/ThreeWorld.js';

const state = new GameState();
const home = document.getElementById('home-screen');
const hud = document.getElementById('hud');
const shopPanel = document.getElementById('home-shop-panel');
const loading = document.getElementById('loading-screen');
let world = null;

function ensureWorld() {
  if (!world) {
    world = new ThreeWorld(document.getElementById('game'), state);
    bindUI(state, world);
  }
  return world;
}

function updateHomeStats() {
  document.getElementById('home-captain').textContent = state.captainName;
  document.getElementById('home-ship').textContent = state.shipName;
  document.getElementById('home-gold').textContent = state.gold;
  document.getElementById('home-hp').textContent = Math.ceil(state.hp);
  document.getElementById('home-owned-boosters').textContent = state.ownedBoosters;
  const meleeInfo = document.getElementById('home-melee-info');
  const rangedInfo = document.getElementById('home-ranged-info');
  if (meleeInfo) meleeInfo.textContent = `${state.melee.name} · ${state.melee.damage} dégâts`;
  if (rangedInfo) rangedInfo.textContent = `${state.ranged.name} · ${state.ranged.damage} dégâts`;
}

function enterGame() {
  const activeWorld = ensureWorld();
  loading.hidden = true;
  document.body.classList.remove('is-loading');
  shopPanel.hidden = true;
  home.classList.add('home-hidden');
  hud.classList.remove('hidden');
  activeWorld.setHome(false);
  renderCards(state);
  renderDrawer(state);
}

function launchGame(reset = false) {
  loading.hidden = false;
  document.body.classList.add('is-loading');

  const animation = loading.querySelector('.loading-animation');
  const beginWorld = () => {
    // Give the browser a real paint opportunity after the original GIF is ready.
    window.setTimeout(() => {
      const activeWorld = ensureWorld();
      if (reset) {
        state.newWorld();
        state.emit();
        activeWorld.resetWorld();
      } else {
        activeWorld.setHome(false);
      }
      // Only a short hand-off after the world is ready; no artificial 7.2s wait.
      window.setTimeout(enterGame, 180);
    }, 90);
  };

  if (animation && !animation.complete) {
    animation.addEventListener('load', beginWorld, { once: true });
    animation.addEventListener('error', () => {
      console.error('Impossible de charger assets/loading/planet-ship.gif');
      beginWorld();
    }, { once: true });
  } else {
    if (animation && animation.naturalWidth === 0) {
      console.error('GIF de chargement introuvable ou illisible:', animation.currentSrc);
    }
    requestAnimationFrame(() => requestAnimationFrame(beginWorld));
  }
}

function returnToMenu() {
  state.camera = { x: world.target.x, z: world.target.z };
  state.saveProgress();
  hud.classList.add('hidden');
  home.classList.remove('home-hidden');
  world.setHome(true);
  document.getElementById('continue-game').hidden = false;
  updateHomeStats();
}

document.getElementById('start-game').addEventListener('click', () => launchGame(true));
document.getElementById('continue-game').addEventListener('click', () => launchGame(false));
document.getElementById('quit-adventure').addEventListener('click', returnToMenu);
document.getElementById('home-shop-button').addEventListener('click', () => { shopPanel.hidden = false; });
document.getElementById('close-home-shop').addEventListener('click', () => { shopPanel.hidden = true; });

function homePurchase(action, reveal = false) {
  const result = action();
  updateHomeStats();
  document.getElementById('home-shop-feedback').textContent = result.message;
  if (result.ok && reveal) {
    shopPanel.hidden = true;
    ensureWorld().showBoosterReveal(result.cards);
  }
}

document.getElementById('home-buy-booster').addEventListener('click', () => homePurchase(() => new ShopSystem(state).buyBooster(), true));
document.getElementById('home-buy-repair').addEventListener('click', () => homePurchase(() => new ShopSystem(state).buyRepair()));
document.getElementById('home-upgrade-melee').addEventListener('click', () => homePurchase(() => new ShopSystem(state).upgradeWeapon('melee')));
document.getElementById('home-upgrade-ranged').addEventListener('click', () => homePurchase(() => new ShopSystem(state).upgradeWeapon('ranged')));

document.getElementById('continue-game').hidden = !localStorage.getItem('deck2fortune.world');
state.subscribe(updateHomeStats);
renderCards(state);
renderDrawer(state);
updateHomeStats();
window.deck2fortune = { get world() { return world; }, state };
