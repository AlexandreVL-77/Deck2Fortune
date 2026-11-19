import { hexDistance, DIRECTIONS, makeTile } from './HexGrid.js';
import { createHand } from '../data/cards.js';

const compassDirection=(from,to)=>{
  const dq=to.q-from.q,dr=to.r-from.r;
  const targetX=Math.sqrt(3)*(dq+dr/2),targetZ=1.5*dr;
  const directions=[
    [1,0,'est'],[1,-1,'nord-est'],[0,-1,'nord-ouest'],
    [-1,0,'ouest'],[-1,1,'sud-ouest'],[0,1,'sud-est']
  ];
  return directions.map(([q,r,label])=>({label,dot:targetX*Math.sqrt(3)*(q+r/2)+targetZ*1.5*r}))
    .sort((a,b)=>b.dot-a.dot)[0].label;
};

export class CombatSystem {
  constructor(state) { this.state = state; }
  playCard(index) {
    const s=this.state,card=s.hand[index];
    if(!card)return{ok:false,message:'Aucune carte à jouer.'};
    if(card.type==='utility')return this.playUtility(index,card);
    if(!s.inCombat)return{ok:false,message:'Cette carte se joue pendant un combat.'};
    if(card.type==='attack'){
      const dist=hexDistance(s.player,s.enemy);
      if(dist>card.range)return{ok:false,message:'L’ennemi est hors de portée.'};
      const weapon=card.weapon==='melee'?s.melee:s.ranged;
      if(weapon.cooldown>0)return{ok:false,message:`${weapon.name} recharge encore.`};
      const effectiveLuck=Math.min(100,weapon.luck*(s.luckBoostTurns>0?2:1));
      const hit=Math.random()*100<effectiveLuck;
      if(hit)s.damageEnemy(card.power??weapon.damage);
      this.setCooldown(weapon);this.replaceCard(index);
      return{ok:true,message:hit?'Touché ! Belle manœuvre.':'Raté ! Le vent a dévié le tir.'};
    }
    if(card.type==='move'){
      const steps=Math.min(card.distance??1,hexDistance(s.player,s.enemy));
      for(let step=0;step<steps;step++){
        let best=s.player,bestDistance=hexDistance(s.player,s.enemy);
        for(const [dq,dr] of DIRECTIONS){
          const candidate={q:s.player.q+dq,r:s.player.r+dr},distance=hexDistance(candidate,s.enemy);
          if(distance<bestDistance){best=candidate;bestDistance=distance;}
        }
        if(best===s.player)break;s.player=best;
      }
      this.replaceCard(index);s.emit();return{ok:true,message:'Manœuvre effectuée.'};
    }
    if(card.type==='blessing'){
      s.luckBoostTurns=2;s.negativeEffects=[];this.replaceCard(index);s.emit();
      return{ok:true,message:'La mer te bénit : Luck doublée pendant 2 tours !'};
    }
    if(card.type==='heal'){
      const missing=s.maxHp-s.hp;
      const restored=card.healRatio?Math.ceil(missing*card.healRatio):(card.power||0);
      s.hp=Math.min(s.maxHp,s.hp+restored);
      if(card.luckPenalty){
        for(const weapon of [s.melee,s.ranged])weapon.luck=Math.max(0,weapon.luck-card.luckPenalty);
      }
      this.replaceCard(index);s.emit();
      return{ok:true,message:card.luckPenalty?`Rhum de fortune : +${restored} coque, Luck -${card.luckPenalty}%.`:'Coque réparée.'};
    }
    return{ok:false,message:'Action inconnue.'};
  }
  playUtility(index,card){
    const s=this.state;
    if(card.effect==='compass'){
      let nearest=null,best=Infinity;
      for(let q=s.player.q-18;q<=s.player.q+18;q++)for(let r=s.player.r-18;r<=s.player.r+18;r++){
        const tile=makeTile(s.seed,q,r,true);
        if(tile.kind!=='island'&&tile.kind!=='archipelago'&&tile.kind!=='volcano')continue;
        const distance=hexDistance(s.player,tile);
        if(distance>0&&distance<best){best=distance;nearest=tile;}
      }
      if(!nearest)return{ok:false,message:'La boussole ne trouve aucun trésor dans ces eaux.'};
      const direction=compassDirection(s.player,nearest);
      const currentTile=makeTile(s.seed,s.player.q,s.player.r,true);
      const nearIsland=['island','archipelago','volcano'].includes(currentTile.kind)||DIRECTIONS.some(([dq,dr])=>{
        const tile=makeTile(s.seed,s.player.q+dq,s.player.r+dr,true);
        return tile.kind==='island'||tile.kind==='archipelago'||tile.kind==='volcano';
      });
      if(nearIsland)s.gold+=15;
      this.consumeUtility(index);s.emit();
      return{ok:true,message:`Le trésor se trouve au ${direction} · ${nearIsland?'+15 Or !':'cap indiqué'}`};
    }
    if(card.effect==='reveal'){
      s.revealedClouds=s.revealedClouds||new Set();
      let revealed=0;
      for(let q=s.player.q-card.radius;q<=s.player.q+card.radius;q++){
        for(let r=s.player.r-card.radius;r<=s.player.r+card.radius;r++){
          const tile={q,r};
          if(hexDistance(s.player,tile)>card.radius)continue;
          if(makeTile(s.seed,q,r).kind==='storm'){s.revealedClouds.add(q+','+r);revealed++;}
        }
      }
      this.consumeUtility(index);s.emit();
      return{ok:true,message:`Longue-vue : ${revealed} case(s) sous les nuages révélée(s) !`};
    }
    return{ok:false,message:'Effet de carte inconnu.'};
  }
  consumeUtility(index){
    const s=this.state;
    if(s.inCombat)s.discardCard(index);
    else s.hand=createHand(s.deck);
  }
  setCooldown(weapon){weapon.cooldown=weapon.maxCooldown;}
  replaceCard(index){this.state.discardCard(index);this.state.emit();}
  enemyTurn(){
    const s=this.state;if(!s.inCombat||s.sunk)return;
    const dist=hexDistance(s.player,s.enemy);
    if(dist<=2&&Math.random()<.72)s.damagePlayer(4);
    for(const weapon of [s.melee,s.ranged])weapon.cooldown=Math.max(0,weapon.cooldown-1);
    if(s.luckBoostTurns>0)s.luckBoostTurns--;
    s.turn++;s.emit();
  }
  endTurn(){this.enemyTurn();}
}
