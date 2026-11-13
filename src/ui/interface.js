import { CombatSystem } from '../systems/CombatSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
const $=id=>document.getElementById(id);
let toastTimer;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800);}
export function renderCards(state){
  $('cards').innerHTML=state.hand.map((c,i)=>`<button class="card ${i===state.selectedCard?'selected':''}" data-card="${i}"><span class="card-icon">${c.icon}</span><strong>${c.name}</strong><small>${c.type==='attack'?`${c.power} dégâts · portée ${c.range}`:c.description}</small></button>`).join('');
  $('hp').textContent=`${state.hp} / ${state.maxHp}`;$('gold').textContent=state.gold;$('ship').textContent=state.shipName;
  $('enemy-name').textContent=state.enemy.name;$('enemy-hp').textContent=`${state.enemy.hp} ♥`;
  $('enemy-bar-fill').style.width=`${state.enemy.hp/state.enemy.maxHp*100}%`;
  $('melee-label').textContent=`${state.melee.name} · ${state.melee.cooldown?'recharge '+state.melee.cooldown:'prêt'}`;
  $('ranged-label').textContent=`${state.ranged.name} · ${state.ranged.cooldown?'recharge '+state.ranged.cooldown:'prêt'}`;
  $('combat-panel').classList.toggle('hidden',!state.inCombat);
}
export function renderDrawer(state){
  const drawer=$('drawer');if(drawer.dataset.tab==='shop'){
    drawer.innerHTML=`<div class="drawer-title">✦ La cale aux trésors</div><p class="drawer-note">Les capitaines y échangent des boosters scellés. Chaque paquet réserve une surprise.</p><div class="shop-item"><span>Booster du large<br><small>Carte, équipement ou butin</small></span><button id="buy-booster">45 ✦</button></div><p class="drawer-note">Boosters ouverts : ${state.ownedBoosters}</p>`;
    $('buy-booster').onclick=()=>{const result=new ShopSystem(state).buyBooster();toast(result.message);renderCards(state);renderDrawer(state);};
  } else if(drawer.dataset.tab==='crew'){
    drawer.innerHTML=`<div class="drawer-title">♟ Ton équipage</div><div class="crew-item"><span>🧑‍✈️ Milo la Brise<br><small>Capitaine · courageux et curieux</small></span><b>Actif</b></div><div class="crew-item"><span>⚔️ ${state.melee.name}<br><small>Arme de corps-à-corps</small></span><b>${state.melee.damage} ATQ</b></div><div class="crew-item"><span>🔭 ${state.ranged.name}<br><small>Arme à distance</small></span><b>${state.ranged.damage} ATQ</b></div>`;
  } else drawer.innerHTML='';
  drawer.classList.toggle('hidden',!drawer.dataset.tab||drawer.dataset.tab==='map');
}
export function bindUI(state,game){
  const combat=new CombatSystem(state);
  state.subscribe(()=>{renderCards(state);renderDrawer(state);});
  $('cards').addEventListener('click',e=>{
    const btn=e.target.closest('[data-card]');if(!btn)return;
    const index=Number(btn.dataset.card);
    if(state.selectedCard!==index){state.selectedCard=index;renderCards(state);return;}
    const result=combat.playCard(index);toast(result.message);
  });
  $('end-turn').onclick=()=>{combat.endTurn();toast(state.hp===0?'Ton navire est à la dérive…':'Au tour des corsaires !');};
  $('flee').onclick=()=>{state.endCombat();toast('Tu as pris le large.');};
  document.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
    $('drawer').dataset.tab=btn.dataset.tab;renderDrawer(state);
  });
  window.addEventListener('pirate-toast',e=>toast(e.detail));
}
