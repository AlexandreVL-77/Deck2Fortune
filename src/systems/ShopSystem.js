const BOOSTER_PRICE=45;
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
}
