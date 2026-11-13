import { createHand } from '../data/cards.js';
import { WEAPONS } from '../data/weapons.js';

const IDENTITY_KEY = 'deck2fortune.identity';
const DEFAULT_IDENTITY = { shipName: 'La Mouette', captainName: 'Milo la Brise' };

function loadIdentity() {
  try {
    const saved = JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null');
    return {
      shipName: typeof saved?.shipName === 'string' && saved.shipName.trim() ? saved.shipName.trim().slice(0, 24) : DEFAULT_IDENTITY.shipName,
      captainName: typeof saved?.captainName === 'string' && saved.captainName.trim() ? saved.captainName.trim().slice(0, 24) : DEFAULT_IDENTITY.captainName
    };
  } catch {
    return { ...DEFAULT_IDENTITY };
  }
}

export class GameState {
  constructor() {
    const identity = loadIdentity();
    this.gold=120; this.hp=24; this.maxHp=24;
    this.shipName=identity.shipName; this.captainName=identity.captainName;
    this.player={q:0,r:0}; this.enemy={q:2,r:-1,hp:18,maxHp:18,name:'Corsaire des Brumes'};
    this.hand=createHand(); this.selectedCard=0; this.inCombat=false; this.turn=1;
    this.melee={...WEAPONS.cutlass}; this.ranged={...WEAPONS.musket};
    this.ownedBoosters=0; this.cosmetics={ship:'seagull',captain:'milo',weapon:'brass'};
    this.listeners=new Set();
  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  emit(){this.listeners.forEach(fn=>fn(this));}
  saveIdentity(shipName,captainName){
    const ship=String(shipName||'').trim().slice(0,24);
    const captain=String(captainName||'').trim().slice(0,24);
    if(!ship||!captain)return false;
    this.shipName=ship; this.captainName=captain;
    try { localStorage.setItem(IDENTITY_KEY,JSON.stringify({shipName:ship,captainName:captain})); } catch {}
    this.emit();
    return true;
  }
  startCombat(){this.inCombat=true;this.emit();}
  endCombat(){this.inCombat=false;this.enemy.hp=18;this.emit();}
  spendGold(amount){if(this.gold<amount)return false;this.gold-=amount;this.emit();return true;}
  damageEnemy(amount){this.enemy.hp=Math.max(0,this.enemy.hp-amount);if(this.enemy.hp===0){this.gold+=35;this.inCombat=false;}this.emit();}
  damagePlayer(amount){this.hp=Math.max(0,this.hp-amount);this.emit();}
}
