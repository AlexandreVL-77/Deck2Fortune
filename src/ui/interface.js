import { CombatSystem } from '../systems/CombatSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
const $=id=>document.getElementById(id);
let toastTimer;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800);}
const art={
  broadside:'<svg viewBox="0 0 32 32"><path d="M5 19h22l-3 5H8z"/><path d="M8 18l2-8h12l2 8M13 10V6h6v4"/><path d="M4 14l4-2m16 2 4-2M13 24l-2 3m8-3 2 3"/></svg>',
  grapple:'<svg viewBox="0 0 32 32"><path d="M16 4v13m0 0c-1 7-10 7-10 1m10-1c1 7 10 7 10 1M16 17l-5-5m5 5 5-5"/><path d="M12 4h8"/></svg>',
  sidestep:'<svg viewBox="0 0 32 32"><path d="M4 22h24l-4 5H9z"/><path d="M13 21V7l8 7-8 7M5 8h5M4 12h4"/></svg>',
  cutlass:'<svg viewBox="0 0 32 32"><path d="M7 25L23 7l4 2L11 27z"/><path d="M18 12l5 4M7 25l-2 3m3-6 3 3"/></svg>',
  repair:'<svg viewBox="0 0 32 32"><path d="M6 21l7-12 13 8-7 11z"/><path d="M15 14l7 5M16 5v6m-3-3h6"/></svg>',
  pistol:'<svg viewBox="0 0 32 32"><path d="M5 10h21v6H15l-2 7H8l2-7H5z"/><path d="M20 16l3 4m-12-10v-3"/></svg>'
};
function cardArt(card){return art[card.id]||art.cutlass;}
export function renderCards(state){
  $('cards').innerHTML=state.hand.map((c,i)=>`<button class="card ${i===state.selectedCard?'selected':''}" data-card="${i}" aria-label="${c.name}"><span class="card-type">${c.type==='attack'?'ATTAQUE':c.type==='move'?'MOUVEMENT':'SOUTIEN'}</span><span class="card-art">${cardArt(c)}</span><strong>${c.name}</strong><small>${c.type==='attack'?`${c.power} dégâts · portée ${c.range}`:c.description}</small></button>`).join('');
  $('hp').textContent=`${state.hp} / ${state.maxHp}`;$('gold').textContent=state.gold;$('ship').textContent=state.shipName;
  const fill=$('health-fill');if(fill)fill.style.width=`${state.hp/state.maxHp*100}%`;
  $('enemy-name').textContent=state.enemy.name;$('enemy-hp').textContent=`${state.enemy.hp} ♥`;
  $('enemy-bar-fill').style.width=`${state.enemy.hp/state.enemy.maxHp*100}%`;
  $('melee-label').textContent=`⚔ ${state.melee.name} · ${state.melee.cooldown?'recharge '+state.melee.cooldown:'prêt'}`;
  $('ranged-label').textContent=`➶ ${state.ranged.name} · ${state.ranged.cooldown?'recharge '+state.ranged.cooldown:'prêt'}`;
  $('combat-panel').classList.toggle('hidden',!state.inCombat);
  $('drawer').classList.toggle('hidden',!state.inCombat&&(!$('drawer').dataset.tab||$('drawer').dataset.tab==='map'));
}
export function renderDrawer(state){
  const drawer=$('drawer');if(drawer.dataset.tab==='shop'){
    drawer.innerHTML=`<div class="drawer-title"><span class="drawer-symbol">✧</span> La cale aux trésors</div><p class="drawer-note">Les capitaines y échangent des boosters scellés. Chaque paquet cache une surprise.</p><div class="shop-item"><span><b>Booster du large</b><br><small>Carte, équipement ou butin</small></span><button id="buy-booster">45 ✦</button></div><p class="drawer-note">Boosters ouverts : ${state.ownedBoosters}</p>`;
    $('buy-booster').onclick=()=>{const result=new ShopSystem(state).buyBooster();toast(result.message);renderCards(state);renderDrawer(state);};
  } else if(drawer.dataset.tab==='crew'){
    drawer.innerHTML=`<div class="drawer-title"><span class="drawer-symbol">♟</span> Ton équipage</div><div class="crew-item"><div style="display:flex;align-items:center;gap:9px"><span class="crew-avatar">♜</span><span><b>Milo la Brise</b><br><small>Capitaine · courageux et curieux</small></span></div><b>ACTIF</b></div><div class="crew-item"><span>⚔ ${state.melee.name}<br><small>Arme de corps-à-corps</small></span><b>${state.melee.damage} ATQ</b></div><div class="crew-item"><span>➶ ${state.ranged.name}<br><small>Arme à distance</small></span><b>${state.ranged.damage} ATQ</b></div>`;
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
    document.querySelector('.map-hint').style.opacity=btn.dataset.tab==='map'?'1':'0';
  });
  window.addEventListener('pirate-toast',e=>toast(e.detail));
}