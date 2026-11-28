// Lancer : node tests/cards.test.mjs
import assert from 'node:assert/strict';
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
globalThis.window = { dispatchEvent() {}, addEventListener() {} };
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail; } };
const cards = await import('../src/data/cards.js');
const { GameState } = await import('../src/systems/GameState.js');
const { CombatSystem } = await import('../src/systems/CombatSystem.js');
const { EFFECTS, registerEffect } = await import('../src/systems/cardEffects.js');
const { ShopSystem } = await import('../src/systems/ShopSystem.js');

assert.deepEqual(cards.validateLibrary(), []);
for (const c of cards.CARD_LIBRARY) assert.ok(EFFECTS[cards.cardEffectId(c)], `effet manquant pour ${c.id}`);
assert.ok(cards.deckPoints(cards.DEFAULT_DECK) <= cards.DECK_POINT_LIMIT);

cards.CARD_LIBRARY.push({ id: 'xatk', name: 'x', type: 'attack', rarity: 'rare', power: 5, range: 9, weapon: 'ranged', description: 'x' });
const s = new GameState();
assert.equal(s.hand.length, 4);
// setDeck : budget de points + taille
assert.equal(s.setDeck(cards.CARD_LIBRARY.map(c => c.id)), false);
for (const c of cards.CARD_LIBRARY) s.cardCollection[c.id] = 1;
assert.equal(s.setDeck(['sea-blessing', 'emergency-planks', 'golden-compass', 'rum-of-fortune', 'spyglass']), true, '5 cartes à 1 point chacune');
assert.equal(s.setDeck(['emergency-planks', 'golden-compass', 'rum-of-fortune']), false, 'un deck doit contenir au moins 5 cartes');

// Jouer chaque carte hors combat : la main reste à 4 cartes et la pioche tourne.
const combat = new CombatSystem(s);
s.hp = 10;
for (let i = 0; i < 12; i++) { combat.playCard(0); assert.equal(s.hand.length, 4, 'main toujours à 4'); }
// Rhum : malus de chance temporaire, pas permanent.
s.hand[0] = { ...cards.getCard('rum-of-fortune') }; s.ranged.luck = 70; s.hp = 10;
assert.ok(combat.playCard(0).ok); assert.equal(s.ranged.luck, 70); assert.ok(s.luckMalusTurns > 0);
// Effet personnalisé enregistré sans toucher au moteur.
registerEffect('test-gold', ({ state }) => { state.gold += 7; return { ok: true, message: '+7 or' }; });
cards.CARD_LIBRARY.push({ id: 'test', name: 'Test', type: 'utility', rarity: 'common', description: 'x', effect: 'test-gold' });
s.hand[0] = { ...cards.getCard('test') }; const g = s.gold; assert.ok(combat.playCard(0).ok); assert.equal(s.gold, g + 7);
cards.CARD_LIBRARY.pop();
// Combat : attaque refusée en exploration, jouable en combat.
s.hand[0] = { ...cards.getCard('xatk') };
assert.equal(combat.playCard(0).ok, false);
s.startCombat(); s.hand[0] = { ...cards.getCard('xatk') }; s.ranged.cooldown = 0;
const atk = combat.playCard(0); assert.equal(atk.ok, true, atk.message); assert.ok(s.ranged.cooldown > 0);
const nx = combat.playCard(0); assert.ok(nx.ok === false || s.hand.length === 4, JSON.stringify([nx, s.hand.length, s.drawPile, s.discardPile]));
// Boosters : 5 cartes, au moins une non commune.
s.gold = 500; const r = new ShopSystem(s).buyBooster(); assert.equal(r.cards.length, 5); assert.ok(r.cards.some(c => c.rarity !== 'common'));
console.log('cartes : OK');
// Nouvelles cartes : brume, mitraille, boulet lourd.
{
  const g = new GameState(), c = new CombatSystem(g);
  for (const id of ['fog-veil', 'deck-gatling', 'heavy-shot']) assert.ok(EFFECTS[cards.cardEffectId(cards.getCard(id))], id);
  g.startCombat(); g.player = { q: 0, r: 0 }; g.enemy.q = 1; g.enemy.r = 0; g.enemy.hp = 18;
  g.hand[0] = { ...cards.getCard('deck-gatling') }; assert.ok(c.playCard(0).ok); assert.equal(g.enemy.hp, 13);
  g.enemy.q = 3; g.enemy.r = 0; g.hand[0] = { ...cards.getCard('deck-gatling') }; assert.equal(c.playCard(0).ok, false);
  g.hand[0] = { ...cards.getCard('heavy-shot') }; assert.ok(c.playCard(0).ok); assert.equal(g.enemy.hp, 4); assert.ok(g.enemy.q + g.enemy.r !== 3 || g.enemy.q > 3);
  g.hand[0] = { ...cards.getCard('fog-veil') }; assert.ok(c.playCard(0).ok); assert.equal(g.fogTurns, 1);
  g.ranged.cooldown = 0; g.hand[0] = { ...cards.getCard('heavy-shot') }; assert.equal(c.playCard(0).ok, false);
  c.enemyTurn(); assert.equal(g.fogTurns, 0);
}
console.log('nouvelles cartes : OK');
