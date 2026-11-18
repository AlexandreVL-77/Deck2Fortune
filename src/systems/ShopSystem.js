import { CARD_LIBRARY } from '../data/cards.js';

const BOOSTER_PRICE=45;
const REPAIR_PRICE=30;
const WEAPON_UPGRADE_PRICE=80;
const MAX_WEAPON_DAMAGE=20;
const RARE_CARDS=new Set(['broadside','cutlass','pistol']);

function drawCard(guaranteedRare=false){
  const pool=guaranteedRare?CARD_LIBRARY.filter(card=>RARE_CARDS.has(card.id)):CARD_LIBRARY;
  const card=pool[Math.floor(Math.random()*pool.length)];
  return {...card};
}

export class ShopSystem {
  constructor(state){this.state=state;}
  buyBooster(){
    if(!this.state.spendGold(BOOSTER_PRICE))return {ok:false,message:'Pas assez de pièces !'};
    const cards=Array.from({length:4},()=>drawCard());
    cards.push(drawCard(true));
    cards.forEach(card=>{this.state.cardCollection[card.id]=(this.state.cardCollection[card.id]||0)+1;});
    this.state.ownedBoosters++;
    this.state.emit();
    return {ok:true,message:'Booster ouvert : 5 cartes ajoutées à ta collection !',cards};
  }
  buyRepair(){
    if(this.state.hp>=this.state.maxHp)return {ok:false,message:'Ta coque est déjà en parfait état.'};
    if(!this.state.spendGold(REPAIR_PRICE))return {ok:false,message:'Pas assez de pièces pour réparer.'};
    const restored=Math.min(8,this.state.maxHp-this.state.hp);
    this.state.hp+=restored;this.state.emit();
    return {ok:true,message:`Coque réparée : +${Math.ceil(restored)} PV !`};
  }
  upgradeWeapon(slot){
    if(slot!=='melee'&&slot!=='ranged')return {ok:false,message:'Amélioration inconnue.'};
    const weapon=this.state[slot];
    if(weapon.damage>=MAX_WEAPON_DAMAGE)return {ok:false,message:'Cette arme a atteint son niveau maximal.'};
    if(!this.state.spendGold(WEAPON_UPGRADE_PRICE))return {ok:false,message:'Pas assez de pièces pour cette amélioration.'};
    weapon.damage=Math.min(MAX_WEAPON_DAMAGE,weapon.damage+2);
    this.state.emit();
    return {ok:true,message:`${weapon.name} amélioré : ${weapon.damage} dégâts !`};
  }
}
