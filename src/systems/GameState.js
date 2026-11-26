import { createHand, CARD_LIBRARY, DEFAULT_DECK, DECK_MIN_SIZE, DECK_MAX_SIZE, LEST_CAPACITY, deckLest, shuffle } from '../data/cards.js';
import { WEAPONS } from '../data/weapons.js';

const IDENTITY_KEY = 'deck2fortune.identity';
const GOLD_KEY = 'deck2fortune.gold';
const TREASURE_KEY = 'deck2fortune.treasures';
function loadTreasures() {
  try {
    const list = JSON.parse(localStorage.getItem(TREASURE_KEY) || '[]');
    return Array.isArray(list) ? list.filter(t => t && typeof t.name === 'string' && Number.isFinite(t.value)).slice(0, 500).map(t => ({ name: t.name, icon: String(t.icon || '💎'), value: Math.max(0, Math.floor(t.value)) })) : [];
  } catch { return []; }
}
const WORLD_KEY = 'deck2fortune.world';
const DEFAULT_IDENTITY = { shipName: 'La Mouette', captainName: 'Milo la Brise' };

function finiteNumber(value, fallback, min = -1_000_000, max = 1_000_000) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}
function safeInteger(value, fallback, min = -1_000_000, max = 1_000_000) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback;
}
function loadWorld() {
  try {
    const value = JSON.parse(localStorage.getItem(WORLD_KEY) || 'null');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
function makeSeed() { return Math.floor(Math.random() * 0x7fffffff) || 1; }
function loadIdentity() {
  try {
    const saved = JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null');
    return {
      shipName: typeof saved?.shipName === 'string' && saved.shipName.trim() ? saved.shipName.trim().slice(0, 24) : DEFAULT_IDENTITY.shipName,
      captainName: typeof saved?.captainName === 'string' && saved.captainName.trim() ? saved.captainName.trim().slice(0, 24) : DEFAULT_IDENTITY.captainName
    };
  } catch { return { ...DEFAULT_IDENTITY }; }
}
function loadGold() {
  try {
    const stored = localStorage.getItem(GOLD_KEY);
    if (stored === null) return 120;
    return Math.floor(finiteNumber(stored, 120, 0, Number.MAX_SAFE_INTEGER));
  } catch { return 120; }
}
function restoreWeapon(saved, fallback) {
  if (!saved || typeof saved !== 'object') return { ...fallback };
  const maxCooldown = safeInteger(saved.maxCooldown, fallback.maxCooldown, 0, 99);
  return {
    ...fallback,
    name: typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim().slice(0, 32) : fallback.name,
    damage: finiteNumber(saved.damage, fallback.damage, 0, 999),
    range: safeInteger(saved.range, fallback.range ?? 1, 1, 20),
    luck: finiteNumber(saved.luck, fallback.luck, 0, 100),
    maxCooldown,
    cooldown: safeInteger(saved.cooldown, 0, 0, maxCooldown)
  };
}

export class GameState {
  constructor() {
    const identity = loadIdentity();
    const saved = loadWorld();
    this.maxHp = 24;
    this._gold = loadGold();
    this.treasures = loadTreasures();
    this.hp = finiteNumber(saved?.hp, this.maxHp, 0, this.maxHp);
    this.shipName = identity.shipName;
    this.captainName = identity.captainName;
    this.seed = safeInteger(saved?.seed, makeSeed(), 1, 0x7fffffff);
    this.player = {
      q: safeInteger(saved?.player?.q, 0),
      r: safeInteger(saved?.player?.r, 0)
    };
    this.camera = {
      x: finiteNumber(saved?.camera?.x, 0),
      z: finiteNumber(saved?.camera?.z, 0)
    };
    const visited = Array.isArray(saved?.visited) ? saved.visited : [];
    this.explored = new Set((Array.isArray(saved?.explored) ? saved.explored : []).filter(key => typeof key === 'string' && /^-?\d+,-?\d+$/.test(key)).slice(0, 30000));
    this.visited = new Set(visited.filter(key => typeof key === 'string' && /^-?\d+,-?\d+$/.test(key)).slice(0, 100000));
    this.explore();
    const revealed = Array.isArray(saved?.revealedClouds) ? saved.revealedClouds : [];
    this.revealedClouds = new Set(revealed.filter(key => typeof key === 'string' && /^-?\d+,-?\d+$/.test(key)).slice(0, 100000));
    this.sunk = !!saved?.sunk || this.hp <= 0;
    this.inStorm = !!saved?.inStorm && !this.sunk;
    this.enemy = { q: 2, r: -1, hp: 18, maxHp: 18, name: 'Corsaire des Brumes' };
    this.cardCollection = Object.fromEntries(CARD_LIBRARY.map(card => [card.id, safeInteger(saved?.cardCollection?.[card.id], 0, 0, Number.MAX_SAFE_INTEGER)]));
    CARD_LIBRARY.forEach(card => { if (this.cardCollection[card.id] === 0) this.cardCollection[card.id] = 1; });
    try {
      const savedDeck = JSON.parse(localStorage.getItem('deck2fortune.deck') || 'null');
      this.deck = Array.isArray(savedDeck) ? savedDeck.filter(id => CARD_LIBRARY.some(card => card.id === id)).slice(0, DECK_MAX_SIZE) : [...DEFAULT_DECK];
    } catch { this.deck = [...DEFAULT_DECK]; }
    if (this.deck.length < DECK_MIN_SIZE || deckLest(this.deck) > LEST_CAPACITY || this.deck.some(id => this.deck.filter(x => x === id).length > (this.cardCollection[id] || 0))) {
      this.deck = DEFAULT_DECK.filter(id => (this.cardCollection[id] || 0) > 0).slice(0, DECK_MAX_SIZE);
    }
    this.drawPile = [];
    this.discardPile = [];
    this.hand = createHand(this.deck);
    this.luckBoostTurns = 0;
    this.negativeEffects = [];
    this.selectedCard = 0;
    this.inCombat = false;
    this.turn = 1;
    this.melee = restoreWeapon(saved?.melee, WEAPONS.cutlass);
    this.ranged = restoreWeapon(saved?.ranged, WEAPONS.musket);
    this.ownedBoosters = safeInteger(saved?.ownedBoosters, 0, 0, Number.MAX_SAFE_INTEGER);
    this.cosmetics = { ship: 'seagull', captain: 'milo', weapon: 'brass' };
    this.stormDamageRate = 1.6;
    this.listeners = new Set();
  }
  setDeck(ids) {
    if (!Array.isArray(ids) || ids.length < DECK_MIN_SIZE || ids.length > DECK_MAX_SIZE || deckLest(ids) > LEST_CAPACITY) return false;
    const counts = {};
    for (const id of ids) {
      if (!CARD_LIBRARY.some(card => card.id === id)) return false;
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > (this.cardCollection[id] || 0)) return false;
    }
    this.deck = [...ids];
    try { localStorage.setItem('deck2fortune.deck', JSON.stringify(this.deck)); } catch {}
    if (!this.inCombat) {
      this.drawPile = []; this.discardPile = [];
      this.hand = createHand(this.deck); this.selectedCard = 0;
    }
    this.emit(); return true;
  }
  drawFromDeck(count = 1) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (!this.drawPile.length && this.discardPile.length) {
        this.drawPile = shuffle(this.discardPile); this.discardPile = [];
      }
      if (!this.drawPile.length) break;
      const id = this.drawPile.pop();
      const card = CARD_LIBRARY.find(item => item.id === id);
      if (card) drawn.push({...card});
    }
    return drawn;
  }
  discardCard(index) {
    const [card] = this.hand.splice(index, 1);
    if (card) this.discardPile.push(card.id);
    this.hand.push(...this.drawFromDeck(1));
    this.selectedCard = Math.min(this.selectedCard, Math.max(0, this.hand.length - 1));
  }
  get gold() { return this._gold; }
  set gold(value) {
    this._gold = Math.floor(finiteNumber(value, 0, 0, Number.MAX_SAFE_INTEGER));
    try { localStorage.setItem(GOLD_KEY, String(this._gold)); } catch {}
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() {
    this.saveProgress();
    this.listeners.forEach(fn => fn(this));
  }
  /** Marque les cases autour du navire comme cartographiées (rayon 3). */
  explore(q = this.player.q, r = this.player.r, radius = 6) {
    for (let dq = -radius; dq <= radius; dq++) for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) this.explored.add((q + dq) + ',' + (r + dr));
  }
  saveTreasures() { try { localStorage.setItem(TREASURE_KEY, JSON.stringify(this.treasures)); } catch {} }
  addTreasure(treasure) { this.treasures.push(treasure); this.saveTreasures(); this.emit(); }
  /** Vend un trésor (index) ou tous (index omis) ; renvoie l'or gagné. */
  sellTreasures(index = null) {
    const sold = index === null ? this.treasures.splice(0) : this.treasures.splice(index, 1);
    const total = sold.reduce((sum, t) => sum + t.value, 0);
    this.gold += total; this.saveTreasures(); this.emit();
    return total;
  }
  saveProgress() {
    try {
      localStorage.setItem(WORLD_KEY, JSON.stringify({
        seed: this.seed, player: this.player, camera: this.camera, hp: this.hp,
        visited: [...this.visited], explored: [...this.explored], revealedClouds: [...this.revealedClouds], inStorm: this.inStorm, sunk: this.sunk,
        ownedBoosters: this.ownedBoosters, cardCollection: this.cardCollection, melee: this.melee, ranged: this.ranged
      }));
    } catch {}
  }
  newWorld() {
    this.seed = makeSeed();
    this.player = { q: 0, r: 0 };
    this.camera = { x: 0, z: 0 };
    this.hp = this.maxHp;
    this.visited = new Set();
    this.explored = new Set();
    this.explore(0, 0);
    this.revealedClouds.clear();
    this.inStorm = false;
    this.sunk = false;
    this.inCombat = false;
    this.enemy.hp = this.enemy.maxHp;
    this.drawPile = []; this.discardPile = [];
    this.hand = createHand(this.deck);
    this.selectedCard = 0;
    this.saveProgress();
  }
  saveIdentity(shipName, captainName) {
    const ship = String(shipName || '').trim().slice(0, 24);
    const captain = String(captainName || '').trim().slice(0, 24);
    if (!ship || !captain) return false;
    this.shipName = ship;
    this.captainName = captain;
    try { localStorage.setItem(IDENTITY_KEY, JSON.stringify({ shipName: ship, captainName: captain })); } catch {}
    this.emit();
    return true;
  }
  enterStorm() { if (this.sunk) return; this.inStorm = true; this.emit(); }
  leaveStorm() { if (!this.inStorm) return; this.inStorm = false; this.emit(); }
  damageHull(amount) {
    const damage = finiteNumber(amount, 0, 0, 999);
    if (this.sunk || damage <= 0) return;
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp === 0) { this.sunk = true; this.inStorm = false; }
    this.emit();
  }
  startCombat() { if (this.sunk || this.inCombat) return; this.enemy.hp = this.enemy.maxHp; this.inCombat = true; this.drawPile = shuffle(this.deck); this.discardPile = []; this.hand = this.drawFromDeck(4); this.selectedCard = 0; this.turn = 1; this.luckBoostTurns = 0; this.emit(); }
  endCombat() { this.inCombat = false; this.enemy.hp = this.enemy.maxHp; this.drawPile = []; this.discardPile = []; this.luckBoostTurns = 0; this.emit(); }
  spendGold(amount) {
    const cost = finiteNumber(amount, -1, 0, Number.MAX_SAFE_INTEGER);
    if (cost < 0 || this.gold < cost) return false;
    this.gold -= cost;
    this.emit();
    return true;
  }
  damageEnemy(amount) {
    const damage = finiteNumber(amount, 0, 0, 999);
    if (this.sunk || damage <= 0) return;
    this.enemy.hp = Math.max(0, this.enemy.hp - damage);
    if (this.enemy.hp === 0) { this.gold += 35; this.inCombat = false; try { window.dispatchEvent(new CustomEvent('pirate-toast', { detail: '+35 or !' })); } catch {} }
    this.emit();
  }
  damagePlayer(amount) { this.damageHull(amount); }
}
