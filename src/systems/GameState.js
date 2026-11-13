import { createHand } from '../data/cards.js';
import { WEAPONS } from '../data/weapons.js';

const IDENTITY_KEY = 'deck2fortune.identity';
const GOLD_KEY = 'deck2fortune.gold';
const WORLD_KEY = 'deck2fortune.world';
function loadWorld(){try{return JSON.parse(localStorage.getItem(WORLD_KEY)||'null');}catch{return null;}}
function makeSeed(){return Math.floor(Math.random()*0x7fffffff)||1;}
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

function loadGold() {
  try {
    const stored = localStorage.getItem(GOLD_KEY);
    if (stored === null) return 120;
    const value = Number(stored);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 120;
  } catch { return 120; }
}

export class GameState {
  constructor() {
    const identity = loadIdentity();
    const saved=loadWorld(); this._gold=loadGold(); this.hp=saved?.hp??24; this.maxHp=24;
    this.shipName=identity.shipName; this.captainName=identity.captainName;
    this.seed=saved?.seed||makeSeed(); this.player=saved?.player||{q:0,r:0}; this.camera=saved?.camera||{x:0,z:0}; this.visited=new Set(saved?.visited||[]); this.inStorm=!!saved?.inStorm; this.sunk=!!saved?.sunk; this.enemy={q:2,r:-1,hp:18,maxHp:18,name:'Corsaire des Brumes'};
    this.hand=createHand(); this.selectedCard=0; this.inCombat=false; this.turn=1;
    this.melee={...WEAPONS.cutlass}; this.ranged={...WEAPONS.musket};
    this.ownedBoosters=0; this.cosmetics={ship:'seagull',captain:'milo',weapon:'brass'};
    this.stormDamageRate=1.6;
    this.listeners=new Set();
  }
  get gold(){return this._gold;}
  set gold(value){
    this._gold=Math.max(0,Math.floor(Number(value)||0));
    try { localStorage.setItem(GOLD_KEY,String(this._gold)); } catch {}
  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  emit(){this.saveProgress();this.listeners.forEach(fn=>fn(this));}
  saveProgress(){try{localStorage.setItem(WORLD_KEY,JSON.stringify({seed:this.seed,player:this.player,camera:this.camera,hp:this.hp,visited:[...this.visited],inStorm:this.inStorm,sunk:this.sunk}));}catch{}}
  newWorld(){this.seed=makeSeed();this.player={q:0,r:0};this.camera={x:0,z:0};this.hp=this.maxHp;this.visited=new Set();this.inStorm=false;this.sunk=false;this.inCombat=false;this.enemy.hp=this.enemy.maxHp;this.saveProgress();}
  saveIdentity(shipName,captainName){
    const ship=String(shipName||'').trim().slice(0,24);
    const captain=String(captainName||'').trim().slice(0,24);
    if(!ship||!captain)return false;
    this.shipName=ship; this.captainName=captain;
    try { localStorage.setItem(IDENTITY_KEY,JSON.stringify({shipName:ship,captainName:captain})); } catch {}
    this.emit();
    return true;
  }
  enterStorm(){if(this.sunk)return;this.inStorm=true;this.emit();}
  leaveStorm(){if(!this.inStorm)return;this.inStorm=false;this.emit();}
  damageHull(amount){
    if(this.sunk||amount<=0)return;
    this.hp=Math.max(0,this.hp-amount);
    if(this.hp===0){this.sunk=true;this.inStorm=false;}
    this.emit();
  }
  startCombat(){if(this.sunk)return;this.inCombat=true;this.emit();}
  endCombat(){this.inCombat=false;this.enemy.hp=18;this.emit();}
  spendGold(amount){if(this.gold<amount)return false;this.gold-=amount;this.emit();return true;}
  damageEnemy(amount){if(this.sunk)return;this.enemy.hp=Math.max(0,this.enemy.hp-amount);if(this.enemy.hp===0){this.gold+=35;this.inCombat=false;}this.emit();}
  damagePlayer(amount){this.damageHull(amount);}
}
