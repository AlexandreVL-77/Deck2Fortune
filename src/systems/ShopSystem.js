const BOOSTER_PRICE=45;
const REPAIR_PRICE=30;
const WEAPON_UPGRADE_PRICE=80;
const MAX_WEAPON_DAMAGE=20;
const LOOT=[
  {type:'gold',amount:25,label:'25 pièces d’or'},
  {type:'heal',amount:6,label:'Réparation de coque'},
  {type:'weapon',id:'boardingAxe',label:'Hache d’abordage'},
  {type:'weapon',id:'flintlock',label:'Pistolet à silex'}
];
export class ShopSystem {
  constructor(state){this.state=state;}
  buyBooster(){
    if(!this.state.spendGold(BOOSTER_PRICE))return {ok:false,message:'Pas assez de pièces !'};
    const reward=LOOT[Math.floor(Math.random()*LOOT.length)];
    if(reward.type==='gold')this.state.gold+=reward.amount;
    if(reward.type==='heal')this.state.hp=Math.min(this.state.maxHp,this.state.hp+reward.amount);
    if(reward.type==='weapon'){
      const slot=reward.id==='boardingAxe'?'melee':'ranged';
      this.state[slot]={...this.state[slot],...({boardingAxe:{name:'Hache d’abordage',damage:9,luck:78,maxCooldown:2,cooldown:0},flintlock:{name:'Pistolet à silex',damage:5,luck:85,maxCooldown:1,cooldown:0}}[reward.id])};
    }
    this.state.ownedBoosters++;this.state.emit();
    return {ok:true,message:`Booster ouvert : ${reward.label} !`,reward:reward.label};
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
