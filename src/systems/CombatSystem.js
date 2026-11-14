import { hexDistance, DIRECTIONS } from './HexGrid.js';
import { CARD_LIBRARY } from '../data/cards.js';

export class CombatSystem {
  constructor(state) { this.state = state; }
  playCard(index) {
    const s = this.state, card = s.hand[index];
    if (!s.inCombat || !card) return { ok: false, message: 'Aucune carte à jouer.' };
    if (card.type === 'attack') {
      const dist = hexDistance(s.player, s.enemy);
      if (dist > card.range) return { ok: false, message: 'L’ennemi est hors de portée.' };
      const weapon = card.weapon === 'melee' ? s.melee : s.ranged;
      if (weapon.cooldown > 0) return { ok: false, message: `${weapon.name} recharge encore.` };
      const hit = Math.random() * 100 < weapon.luck;
      if (hit) s.damageEnemy(card.power ?? weapon.damage);
      this.setCooldown(weapon);
      this.replaceCard(index);
      return { ok: true, message: hit ? 'Touché ! Belle manœuvre.' : 'Raté ! Le vent a dévié le tir.' };
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
      s.emit();
      return { ok: true, message: 'Manœuvre effectuée.' };
    }
    if (card.type === 'heal') {
      s.hp = Math.min(s.maxHp, s.hp + card.power);
      this.replaceCard(index);
      s.emit();
      return { ok: true, message: 'Coque réparée.' };
    }
    return { ok: false, message: 'Action inconnue.' };
  }
  setCooldown(weapon) { weapon.cooldown = weapon.maxCooldown; }
  replaceCard(index) {
    this.state.hand[index] = { ...CARD_LIBRARY[Math.floor(Math.random() * CARD_LIBRARY.length)] };
    this.state.emit();
  }
  enemyTurn() {
    const s = this.state;
    if (!s.inCombat || s.sunk) return;
    const dist = hexDistance(s.player, s.enemy);
    if (dist <= 2 && Math.random() < .72) s.damagePlayer(4);
    for (const weapon of [s.melee, s.ranged]) weapon.cooldown = Math.max(0, weapon.cooldown - 1);
    s.turn++;
    s.emit();
  }
  endTurn() { this.enemyTurn(); }
}
