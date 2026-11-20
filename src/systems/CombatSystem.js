import { hexDistance, DIRECTIONS } from './HexGrid.js';

export const CRIT_MULTIPLIER = 2;
/** Chance effective d'une arme, bénédiction ×2 et malus de rhum −10 pts. */
export function effectiveLuck(state, weapon) {
  let luck = weapon.luck * (state.luckBoostTurns > 0 ? 2 : 1);
  if (state.luckMalusTurns > 0) luck -= 10;
  return Math.max(5, Math.min(100, luck));
}
/** Cartes que l'on peut jouer hors combat. */
const FREE_TYPES = new Set(['heal', 'blessing', 'scout']);

export class CombatSystem {
  constructor(state) { this.state = state; }
  /** Raison pour laquelle la carte est injouable, ou null. */
  blockedReason(card) {
    const s = this.state;
    if (!card) return 'Aucune carte.';
    if (!s.inCombat && !FREE_TYPES.has(card.type)) return 'Cette carte sert en combat.';
    if (s.sunk) return 'Ton navire a coulé.';
    if (card.type === 'attack') {
      const weapon = card.weapon === 'melee' ? s.melee : s.ranged;
      if (weapon.cooldown > 0) return `${weapon.name} recharge : ${weapon.cooldown} tour${weapon.cooldown > 1 ? 's' : ''}.`;
    }
    return null;
  }
  playCard(index) {
    const s = this.state, card = s.hand[index];
    const blocked = this.blockedReason(card);
    if (blocked) return { ok: false, message: blocked };
    if (card.type === 'attack') {
      if (hexDistance(s.player, s.enemy) > card.range) return { ok: false, message: 'L’ennemi est hors de portée.' };
      const weapon = card.weapon === 'melee' ? s.melee : s.ranged;
      const luck = effectiveLuck(s, weapon);
      const roll = Math.random() * 100;
      const hit = roll < luck;
      const crit = hit && roll < luck * 0.15;
      if (hit) s.damageEnemy((card.power ?? weapon.damage) * (crit ? CRIT_MULTIPLIER : 1));
      weapon.cooldown = weapon.maxCooldown;
      this.replaceCard(index);
      return { ok: true, fx: crit ? 'crit' : hit ? 'hit' : 'miss', message: crit ? 'COUP CRITIQUE ! Dégâts doublés !' : hit ? 'Touché ! Belle manœuvre.' : 'Raté ! Le vent a dévié le tir.' };
    }
    if (card.type === 'move') {
      const steps = Math.min(card.distance ?? 1, hexDistance(s.player, s.enemy));
      for (let step = 0; step < steps; step++) {
        let best = s.player, bestDistance = hexDistance(s.player, s.enemy);
        for (const [dq, dr] of DIRECTIONS) {
          const candidate = { q: s.player.q + dq, r: s.player.r + dr };
          const distance = hexDistance(candidate, s.enemy);
          if (distance < bestDistance) { best = candidate; bestDistance = distance; }
        }
        if (best === s.player) break;
        s.player = best;
      }
      this.replaceCard(index);
      return { ok: true, fx: 'move', message: 'Manœuvre effectuée.' };
    }
    if (card.type === 'blessing') {
      s.luckBoostTurns = 2; s.luckMalusTurns = 0; s.negativeEffects = [];
      this.replaceCard(index);
      return { ok: true, fx: 'bless', message: 'La mer te bénit : chance doublée pendant 2 tours !' };
    }
    if (card.effect === 'rum') {
      const gain = Math.ceil((s.maxHp - s.hp) / 2);
      s.hp = Math.min(s.maxHp, s.hp + gain);
      s.luckMalusTurns = 3;
      this.replaceCard(index);
      return { ok: true, fx: 'heal', message: `Rhum : +${gain} coque, mais chance −10 % pendant 3 tours.` };
    }
    if (card.type === 'heal') {
      s.hp = Math.min(s.maxHp, s.hp + card.power);
      this.replaceCard(index);
      return { ok: true, fx: 'heal', message: `Coque réparée : +${card.power}.` };
    }
    if (card.effect === 'compass' || card.effect === 'spyglass') {
      const detail = { effect: card.effect, radius: card.radius || 3, bonus: 0 };
      window.dispatchEvent(new CustomEvent('pirate-scout', { detail }));
      if (detail.bonus) s.gold += detail.bonus;
      this.replaceCard(index);
      return { ok: true, fx: 'scout', message: detail.message || 'Rien à signaler.' };
    }
    return { ok: false, message: 'Action inconnue.' };
  }
  replaceCard(index) { this.state.discardCard(index); this.state.emit(); }
  enemyTurn() {
    const s = this.state;
    if (!s.inCombat || s.sunk) return;
    const dist = hexDistance(s.player, s.enemy);
    if (dist <= 2 && Math.random() < .72) s.damagePlayer(4);
    for (const weapon of [s.melee, s.ranged]) weapon.cooldown = Math.max(0, weapon.cooldown - 1);
    if (s.luckBoostTurns > 0) s.luckBoostTurns--;
    if (s.luckMalusTurns > 0) s.luckMalusTurns--;
    s.turn++;
    s.emit();
  }
  endTurn() { this.enemyTurn(); }
}
