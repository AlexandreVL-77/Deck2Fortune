import { cardPoints, RARITIES, TYPE_LABELS } from '../data/cards.js';

const css = `
.cf{container-type:inline-size;position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;gap:4cqw;padding:7cqw 6cqw;box-sizing:border-box;color:#4a2f1a;text-align:center;border-radius:inherit;border:1.2cqw solid var(--rc,#8a7a60);background:linear-gradient(#fff6d8,#ecd194);font-family:'Fredoka','DM Sans',system-ui,sans-serif;overflow:hidden}
.cf-img{width:100%;height:100%;object-fit:contain;display:block;border-radius:6px}
.cf.r-rare{--rc:#3b86d6}.cf.r-epic{--rc:#9a4fd1}.cf.r-legendary{--rc:#e6a622}
.cf .cf-type{font-size:7cqw;font-weight:900;letter-spacing:.5cqw;color:#fff;background:var(--rc);padding:1cqw 4cqw;border-radius:5cqw}
.cf .cf-art{flex:1;min-height:0;width:100%;display:grid;place-items:center;font-size:34cqw;border-radius:6cqw;background:radial-gradient(circle,#fff9,#0000 70%)}
.cf strong{font-size:9.5cqw;line-height:1.05}
.cf small{font-size:6.6cqw;line-height:1.15;opacity:.85;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}`;
let injected = false;
/** Visage d'une carte : l'illustration complète si elle existe, sinon une carte générée (nom, icône, rareté). */
export function cardFace(card) {
  if (!injected) { injected = true; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
  if (card.image) return `<img class="cf-img" src="${card.image}" alt="${card.name}" draggable="false" decoding="sync">`;
  return `<div class="cf r-${card.rarity}"><span class="cf-type">${TYPE_LABELS[card.type] || ''} · ${RARITIES[card.rarity]?.label || ''}</span><span class="cf-art">${card.icon || '🃏'}</span><strong>${card.name}</strong><small>${card.description}</small></div>`;
}
export { cardPoints };
