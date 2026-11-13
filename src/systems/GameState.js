import { createHand } from '../data/cards.js';
import { WEAPONS } from '../data/weapons.js';
export class GameState {
  constructor() {
    this.gold=120; this.hp=24; this.maxHp=24; this.shipName='La Mouette';
    this.player={q:0,r:0}; this.enemy={q:2,r:-1,hp:18,maxHp:18,name:'Corsaire des Brumes'};
    this.hand=createHand(); this.selectedCard=0; this.inCombat=false; this.turn=1;
    this.melee={...WEAPONS.cutlass}; this.ranged={...WEAPONS.musket};
    this.ownedBoosters=0; this.cosmetics={ship:'seagull',captain:'milo',weapon:'brass'};
    this.listeners=new Set();
  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  emit(){this.listeners.forEach(fn=>fn(this));}
  startCombat(){this.inCombat=true;this.emit();}
  endCombat(){this.inCombat=false;this.enemy.hp=18;this.emit();}
  spendGold(amount){if(this.gold<amount)return false;this.gold-=amount;this.emit();return true;}
  damageEnemy(amount){this.enemy.hp=Math.max(0,this.enemy.hp-amount);if(this.enemy.hp===0){this.gold+=35;this.inCombat=false;}this.emit();}
  damagePlayer(amount){this.hp=Math.max(0,this.hp-amount);this.emit();}
}
