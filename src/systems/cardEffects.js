import { hexDistance, DIRECTIONS, makeTile } from './HexGrid.js';

/**
 * Registre des effets de cartes. Pour créer un nouvel effet :
 *   registerEffect('mon-effet', ({ state, card }) => ({ ok: true, message: '…' }));
 * puis donner `effect: 'mon-effet'` à la carte dans data/cards.js.
 * Un effet renvoie { ok, message, fx? } ; la carte n'est consommée que si ok === true.
 */
export const EFFECTS = {};
export const registerEffect = (id, handler) => { EFFECTS[id] = handler; };

export const CRIT_MULTIPLIER = 2;
/** Chance effective d'une arme : bénédiction ×2, malus temporaire (rhum) en points. */
export function effectiveLuck(state, weapon) {
  let luck = weapon.luck * (state.luckBoostTurns > 0 ? 2 : 1);
  if (state.luckMalusTurns > 0) luck -= state.luckMalusAmount || 0;
  return Math.max(0, Math.min(100, luck));
}

const LAND = ['island', 'archipelago', 'volcano'];
const compassDirection = (from, to) => {
  const dq = to.q - from.q, dr = to.r - from.r, x = Math.sqrt(3) * (dq + dr / 2), z = 1.5 * dr;
  return [[1, 0, 'est'], [1, -1, 'nord-est'], [0, -1, 'nord-ouest'], [-1, 0, 'ouest'], [-1, 1, 'sud-ouest'], [0, 1, 'sud-est']]
    .map(([q, r, label]) => ({ label, dot: x * Math.sqrt(3) * (q + r / 2) + z * 1.5 * r })).sort((a, b) => b.dot - a.dot)[0].label;
};

registerEffect('attack', ({ state: s, card }) => {
  if (hexDistance(s.player, s.enemy) > card.range) return { ok: false, message: 'L’ennemi est hors de portée.' };
  const weapon = card.weapon === 'melee' ? s.melee : s.ranged;
  if (weapon.cooldown > 0) return { ok: false, message: `${weapon.name} recharge encore.` };
  const luck = effectiveLuck(s, weapon), roll = Math.random() * 100;
  const hit = roll < luck, crit = hit && roll < luck * .15;
  if (hit) s.damageEnemy((card.power ?? weapon.damage) * (crit ? CRIT_MULTIPLIER : 1));
  weapon.cooldown = weapon.maxCooldown;
  return { ok: true, fx: crit ? 'crit' : hit ? 'hit' : 'miss', message: crit ? 'COUP CRITIQUE ! Dégâts doublés !' : hit ? 'Touché ! Belle manœuvre.' : 'Raté ! Le vent a dévié le tir.' };
});

registerEffect('move', ({ state: s, card }) => {
  const steps = Math.min(card.distance ?? 1, hexDistance(s.player, s.enemy));
  for (let step = 0; step < steps; step++) {
    let best = s.player, bestDistance = hexDistance(s.player, s.enemy);
    for (const [dq, dr] of DIRECTIONS) {
      const candidate = { q: s.player.q + dq, r: s.player.r + dr }, distance = hexDistance(candidate, s.enemy);
      if (distance < bestDistance) { best = candidate; bestDistance = distance; }
    }
    if (best === s.player) break;
    s.player = best;
  }
  return { ok: true, fx: 'move', message: 'Manœuvre effectuée.' };
});

registerEffect('bless', ({ state: s, card }) => {
  s.luckBoostTurns = card.turns || 2; s.luckMalusTurns = 0; s.negativeEffects = [];
  return { ok: true, fx: 'bless', message: `La mer te bénit : Luck doublée pendant ${s.luckBoostTurns} tours !` };
});

registerEffect('heal', ({ state: s, card }) => {
  const restored = card.healRatio ? Math.ceil((s.maxHp - s.hp) * card.healRatio) : (card.power || 0);
  s.hp = Math.min(s.maxHp, s.hp + restored);
  if (card.luckPenalty) { s.luckMalusAmount = card.luckPenalty; s.luckMalusTurns = card.luckTurns || 3; }
  return { ok: true, fx: 'heal', message: card.luckPenalty ? `${card.name} : +${restored} coque, Luck -${card.luckPenalty}% pendant ${s.luckMalusTurns} tours.` : `Coque réparée : +${restored}.` };
});

registerEffect('compass', ({ state: s }) => {
  let nearest = null, best = Infinity;
  for (let q = s.player.q - 18; q <= s.player.q + 18; q++) for (let r = s.player.r - 18; r <= s.player.r + 18; r++) {
    const tile = makeTile(s.seed, q, r, true);
    if (!LAND.includes(tile.kind)) continue;
    const distance = hexDistance(s.player, tile);
    if (distance > 0 && distance < best) { best = distance; nearest = tile; }
  }
  if (!nearest) return { ok: false, message: 'La boussole ne trouve aucun trésor dans ces eaux.' };
  const here = makeTile(s.seed, s.player.q, s.player.r, true);
  const nearIsland = LAND.includes(here.kind) || DIRECTIONS.some(([dq, dr]) => LAND.includes(makeTile(s.seed, s.player.q + dq, s.player.r + dr, true).kind));
  if (nearIsland) s.gold += 15;
  return { ok: true, fx: 'scout', message: `Le trésor se trouve au ${compassDirection(s.player, nearest)} · ${nearIsland ? '+15 or !' : 'cap indiqué'}` };
});

registerEffect('reveal', ({ state: s, card }) => {
  s.revealedClouds = s.revealedClouds || new Set();
  let revealed = 0;
  for (let q = s.player.q - card.radius; q <= s.player.q + card.radius; q++) for (let r = s.player.r - card.radius; r <= s.player.r + card.radius; r++) {
    if (hexDistance(s.player, { q, r }) > card.radius) continue;
    if (makeTile(s.seed, q, r).kind === 'storm') { s.revealedClouds.add(q + ',' + r); revealed++; }
  }
  return { ok: true, fx: 'scout', message: `Longue-vue : ${revealed} case(s) sous les nuages révélée(s) !` };
});

// --- Cartes de combat avancées ---
registerEffect('fog', ({ state: s, card }) => {
  s.fogTurns = card.turns || 1;
  return { ok: true, fx: 'bless', message: `Brume : intouchable à distance ${s.fogTurns} tour, mais tu ne peux plus tirer.` };
});

registerEffect('volley', ({ state: s, card }) => {
  if (hexDistance(s.player, s.enemy) > 1) return { ok: false, message: 'Aucun ennemi sur une case adjacente.' };
  s.damageEnemy(card.power);
  return { ok: true, fx: 'hit', message: `Mitraille ! ${card.power} dégâts.` };
});

registerEffect('heavy-shot', ({ state: s, card }) => {
  if (hexDistance(s.player, s.enemy) > card.range) return { ok: false, message: 'L’ennemi est hors de portée.' };
  s.damageEnemy(card.power);
  // Repousse l'ennemi d'une case (la plus éloignée du joueur, sur l'eau).
  let best = null, bestDistance = hexDistance(s.player, s.enemy);
  for (const [dq, dr] of DIRECTIONS) {
    const c = { q: s.enemy.q + dq, r: s.enemy.r + dr };
    if (LAND.includes(makeTile(s.seed, c.q, c.r, true).kind)) continue;
    const d = hexDistance(s.player, c);
    if (d > bestDistance) { best = c; bestDistance = d; }
  }
  if (best && s.enemy.hp > 0) { s.enemy.q = best.q; s.enemy.r = best.r; }
  return { ok: true, fx: 'hit', message: `Boulet lourd ! ${card.power} dégâts et l’ennemi est repoussé.` };
});
