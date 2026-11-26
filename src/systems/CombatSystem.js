import { hexDistance } from './HexGrid.js';
import { cardEffectId, cardUse } from '../data/cards.js';
import { EFFECTS, effectiveLuck, CRIT_MULTIPLIER } from './cardEffects.js';

export { effectiveLuck, CRIT_MULTIPLIER };

export class CombatSystem {
  constructor(state) { this.state = state; }
  /** Raison pour laquelle une carte est injouable maintenant, ou null. */
  blockedReason(card) {
    const s = this.state;
    if (!card) return 'Aucune carte à jouer.';
    if (s.sunk) return 'Ton navire a coulé.';
    if (cardUse(card) === 'combat' && !s.inCombat) return 'Cette carte se joue pendant un combat.';
    if (card.type === 'attack') {
      const weapon = card.weapon === 'melee' ? s.melee : s.ranged;
      if (weapon.cooldown > 0) return `${weapon.name} recharge encore (${weapon.cooldown} tour${weapon.cooldown > 1 ? 's' : ''}).`;
    }
    return null;
  }
  playCard(index) {
    const s = this.state, card = s.hand[index];
    const blocked = this.blockedReason(card);
    if (blocked) return { ok: false, message: blocked };
    const handler = EFFECTS[cardEffectId(card)];
    if (!handler) return { ok: false, message: 'Effet de carte inconnu.' };
    const result = handler({ state: s, card, index });
    if (result.ok) { s.discardCard(index); s.emit(); }
    return result;
  }
  enemyTurn() {
    const s = this.state;
    if (!s.inCombat || s.sunk) return;
    if (hexDistance(s.player, s.enemy) <= 2 && Math.random() < .72) s.damagePlayer(4);
    for (const weapon of [s.melee, s.ranged]) weapon.cooldown = Math.max(0, weapon.cooldown - 1);
    if (s.luckBoostTurns > 0) s.luckBoostTurns--;
    if (s.luckMalusTurns > 0) s.luckMalusTurns--;
    s.turn++; s.emit();
  }
  endTurn() { this.enemyTurn(); }
}
