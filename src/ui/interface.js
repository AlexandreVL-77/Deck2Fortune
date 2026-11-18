import { CombatSystem } from '../systems/CombatSystem.js';
import { ShopSystem } from '../systems/ShopSystem.js';
import { CARD_LIBRARY, DECK_MIN_SIZE, DECK_MAX_SIZE } from '../data/cards.js';
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
function cardArt(card){if(card.image)return `<img class="card-art-image" src="${card.image}" alt="${card.name}" loading="lazy">`;if(art[card.id])return art[card.id];return art.cutlass;}
function cardTypeLabel(card){return card.type==='attack'?'ATTAQUE':card.type==='move'?'MOUVEMENT':card.type==='blessing'?'BÉNÉDICTION':'SOUTIEN';}
export function renderCards(state){
  const handInfo=document.querySelector('.hand-heading small');if(handInfo)handInfo.textContent=state.inCombat?`Pioche ${state.drawPile.length} · Défausse ${state.discardPile.length}`:'4 cartes · touche pour sélectionner';
  $('cards').innerHTML=state.hand.map((c,i)=>`<button class="card ${i===state.selectedCard?'selected':''}" data-card="${i}" aria-label="${c.name}"><span class="card-type">${cardTypeLabel(c)}</span><span class="card-art">${cardArt(c)}</span><strong>${c.name}</strong><small>${c.type==='attack'?`${c.power} dégâts · portée ${c.range}`:c.description}</small></button>`).join('');
  $('hp').textContent=`${Math.ceil(state.hp)} / ${state.maxHp}`;
  const stormWarning=$('storm-warning');if(stormWarning)stormWarning.classList.toggle('visible',state.inStorm&&!state.sunk);
  $('hud').classList.toggle('ship-sunk',!!state.sunk);$('gold').textContent=state.gold;$('ship').textContent=state.shipName;
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
    drawer.innerHTML=`<div class="drawer-title"><span class="drawer-symbol">✧</span> La cale aux trésors</div><p class="drawer-note">Dépense ton or pour entretenir ton navire et renforcer ton équipement.</p>
      <div class="shop-item"><span><b>Booster du large</b><br><small>5 cartes à collectionner · 1 rare garantie</small></span><button id="buy-booster">45 ✦</button></div>
      <div class="shop-item"><span><b>Réparation de coque</b><br><small>Restaure jusqu’à 8 points de coque</small></span><button id="buy-repair">30 ✦</button></div>
      <div class="shop-item"><span><b>Renforcer l’arme de mêlée</b><br><small>${state.melee.name} · +2 dégâts (max. 20)</small></span><button id="upgrade-melee">80 ✦</button></div>
      <div class="shop-item"><span><b>Renforcer l’arme à distance</b><br><small>${state.ranged.name} · +2 dégâts (max. 20)</small></span><button id="upgrade-ranged">80 ✦</button></div>
      <p class="drawer-note">Boosters ouverts : ${state.ownedBoosters} · Solde : ${state.gold} pièces</p>`;
    const buy=(action,reveal=false)=>{const result=action();toast(result.message);if(result.ok&&reveal)game.showBoosterReveal(result.cards);renderCards(state);renderDrawer(state);};
    $('buy-booster').onclick=()=>buy(()=>new ShopSystem(state).buyBooster(),true);
    $('buy-repair').onclick=()=>buy(()=>new ShopSystem(state).buyRepair());
    $('upgrade-melee').onclick=()=>buy(()=>new ShopSystem(state).upgradeWeapon('melee'));
    $('upgrade-ranged').onclick=()=>buy(()=>new ShopSystem(state).upgradeWeapon('ranged'));
  } else if(drawer.dataset.tab==='crew'){
    drawer.innerHTML=`<div class="drawer-title"><span class="drawer-symbol">♟</span> Ton équipage</div>
      <div class="crew-item"><div style="display:flex;align-items:center;gap:9px"><span class="crew-avatar">♜</span><span><b id="crew-captain-name"></b><br><small>Capitaine · courageux et curieux</small></span></div><b>ACTIF</b></div>
      <form id="identity-form" class="identity-form">
        <div class="identity-heading">PERSONNALISER TON IDENTITÉ</div>
        <label for="ship-name-input">Nom du bateau</label>
        <input id="ship-name-input" name="shipName" type="text" maxlength="24" required autocomplete="off" placeholder="Ex. Le Flibustier">
        <label for="captain-name-input">Nom du capitaine</label>
        <input id="captain-name-input" name="captainName" type="text" maxlength="24" required autocomplete="off" placeholder="Ex. Capitaine Barbe-Rousse">
        <button class="identity-save" type="submit">ENREGISTRER LES NOMS <span>✦</span></button>
        <small class="identity-hint">Tes choix sont sauvegardés sur cet appareil.</small>
      </form>
      <div class="crew-item"><span>⚔ ${state.melee.name}<br><small>Arme de corps-à-corps</small></span><b>${state.melee.damage} ATQ</b></div>
      <div class="crew-item"><span>➶ ${state.ranged.name}<br><small>Arme à distance</small></span><b>${state.ranged.damage} ATQ</b></div>`;
    $('crew-captain-name').textContent=state.captainName;
    $('ship-name-input').value=state.shipName;
    $('captain-name-input').value=state.captainName;
    $('identity-form').addEventListener('submit',event=>{
      event.preventDefault();
      const ship=$('ship-name-input').value.trim();
      const captain=$('captain-name-input').value.trim();
      if(!ship||!captain){toast('Les deux noms sont nécessaires.');return;}
      if(state.saveIdentity(ship,captain))toast('Ton identité de capitaine est enregistrée !');
    });
  } else if(drawer.dataset.tab==='deck'){
    let draft=[...state.deck];
    const renderDeck=()=>{
      const counts=draft.reduce((map,id)=>{map[id]=(map[id]||0)+1;return map;},{});
      const rows=CARD_LIBRARY.map(card=>{
        const have=state.cardCollection[card.id]||0, inDeck=counts[card.id]||0;
        const artMarkup=card.image?'<img class="deck-card-art" src="'+card.image+'" alt="'+card.name+'" loading="lazy">':'<span class="deck-card-emoji">'+card.icon+'</span>';
        const rarity=card.rarity==='epic'?'ÉPIQUE':card.rarity==='rare'?'RARE':'COMMUNE';
        return '<article class="deck-card-row '+(inDeck?'in-deck ':'')+(!have?'not-owned':'')+'">'+artMarkup+'<div class="deck-card-info"><b>'+card.name+'</b><small>'+card.description+'</small><span class="deck-rarity '+card.rarity+'">'+rarity+' · Possédées : '+have+'</span></div><div class="deck-card-controls"><button data-remove="'+card.id+'" '+(inDeck?'':'disabled')+' aria-label="Retirer '+card.name+'">−</button><b>'+inDeck+'</b><button data-add="'+card.id+'" '+(inDeck<have&&draft.length<DECK_MAX_SIZE?'':'disabled')+' aria-label="Ajouter '+card.name+'">＋</button></div></article>';
      }).join('');
      drawer.innerHTML='<div class="drawer-title">✦ Création de deck</div><p class="drawer-note">Construis ton paquet avec les cartes de ta collection. Les doublons sont autorisés si tu possèdes plusieurs exemplaires.</p><div class="deck-count"><b>'+draft.length+' / '+DECK_MAX_SIZE+'</b><span>cartes · minimum '+DECK_MIN_SIZE+'</span><i class="deck-count-meter"><i style="width:'+(draft.length/DECK_MAX_SIZE*100)+'%"></i></i></div><div class="deck-card-list">'+rows+'</div><button id="save-deck" class="identity-save" '+(draft.length<DECK_MIN_SIZE?'disabled':'')+'>SAUVEGARDER LE DECK <span>✦</span></button><small class="identity-hint">Deck sauvegardé sur cet appareil · utilisé en combat.</small>';
      drawer.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{draft.push(button.dataset.add);renderDeck();});
      drawer.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{const index=draft.lastIndexOf(button.dataset.remove);if(index>=0)draft.splice(index,1);renderDeck();});
      $('save-deck').onclick=()=>{if(state.setDeck(draft))toast('Deck sauvegardé ! Il sera utilisé au prochain combat.');else toast('Vérifie les cartes possédées et la taille du deck.');};
    };
    renderDeck();
  } else if(drawer.dataset.tab==='arsenal'){
    const collection=CARD_LIBRARY.map(card=>`<div class="crew-item"><span>${card.icon} <b>${card.name}</b><br><small>${card.type==='attack'?'Attaque':card.type==='move'?'Navigation':card.type==='blessing'?'Bénédiction':'Soutien'}</small></span><b>×${state.cardCollection[card.id]||0}</b></div>`).join('');
    const total=Object.values(state.cardCollection).reduce((sum,count)=>sum+count,0);
    drawer.innerHTML=`<div class="drawer-title">⚔ Arsenal du capitaine</div><div class="crew-item"><span><b>${state.melee.name}</b><br><small>Arme de mêlée · coups rapprochés</small></span><b>${state.melee.damage} ATQ</b></div><div class="crew-item"><span><b>${state.ranged.name}</b><br><small>Arme à distance · tir précis</small></span><b>${state.ranged.damage} ATQ</b></div><p class="drawer-note">Améliore ton équipement au fil de tes explorations.</p><div class="drawer-title" style="margin-top:12px">Collection de cartes · ${total}</div>${collection}`;
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
    const playedCard=state.hand[index];
    const result=combat.playCard(index);
    if(result.ok&&playedCard?.type==='move')game.syncShipToPlayer();
    toast(result.message);
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
