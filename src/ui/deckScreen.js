import { CARD_LIBRARY, DECK_MAX_SIZE, DECK_MIN_SIZE, DECK_POINT_LIMIT as LEST_CAPACITY, cardPoints as cardLest, deckPoints as deckLest, RARITIES } from '../data/cards.js';
import { cardFace } from './cardFace.js';

const RARITY = Object.fromEntries(Object.entries(RARITIES).map(([k, v]) => [k, v.label]));
const css = `
#deck-screen{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;color:#4a2f1a;font-family:'Fredoka','DM Sans',system-ui,sans-serif;
 background:linear-gradient(#0003,#0005),url(./assets/ui/deck-bg.webp) center/cover,#2c8d9f;padding:max(10px,env(safe-area-inset-top)) 12px calc(14px + env(safe-area-inset-bottom));overflow:hidden}
#deck-screen[hidden]{display:none}
#deck-screen .dk-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
#deck-screen .dk-back{width:42px;height:42px;border-radius:14px;border:2px solid #fff8;background:linear-gradient(#fff2c9,#f0c36f);box-shadow:0 3px #a8672f;font-size:20px;color:#5a3a1f;font-weight:900}
#deck-screen h2{margin:0;flex:1;font-family:'Rye',Georgia,serif;font-size:21px;color:#fff6d8;text-shadow:0 2px #6b4226,0 0 8px #0004;letter-spacing:.5px}
#deck-screen .dk-count{padding:6px 12px;border-radius:14px;background:#2d4f5d;color:#ffe8a8;font-weight:800;font-size:13px;border:2px solid #fff3}
#deck-screen .dk-panel{border-radius:22px;background:linear-gradient(#f9e9bd,#ecd194);border:3px solid #b57a43;box-shadow:0 5px #7a4a2b,inset 0 0 0 2px #fff6;padding:10px}
#deck-screen .dk-label{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11px;letter-spacing:2px;color:#7a4a2b;margin:0 2px 8px}
#deck-screen .dk-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 14%}
#deck-screen .dk-slots .empty{aspect-ratio:5/7;border-radius:10px;border:2px dashed #b57a43;display:grid;place-items:center;color:#b57a43;font-weight:900;font-size:20px}
#deck-screen .dk-lest{height:12px;border-radius:8px;background:#0003;overflow:hidden;margin-top:9px}#deck-screen .dk-lest i{display:block;height:100%;background:linear-gradient(90deg,#f6d38c,#e29a4a);transition:width .25s}#deck-screen .dk-lest.full i{background:linear-gradient(90deg,#f08a6a,#d24b3a)}
#deck-screen .lw{position:absolute;right:3px;top:3px;min-width:18px;height:18px;border-radius:9px;background:#2d4f5d;color:#ffe8a8;font-size:10px;font-weight:900;display:grid;place-items:center;padding:0 4px}
#deck-screen .dk-card{position:relative;aspect-ratio:5/7;border-radius:10px;overflow:hidden;border:0;padding:0;background:#0003;box-shadow:0 3px 6px #0004;transition:transform .15s}
#deck-screen .dk-card img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
#deck-screen .dk-slots .dk-card.sel{outline:3px solid #ffd45a;transform:translateY(-6px) scale(1.04);box-shadow:0 0 14px #ffd45a}
#deck-screen .dk-slots .dk-card .n{position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#2d4f5d;color:#fff;font-size:10px;font-weight:900;display:grid;place-items:center}
#deck-screen .dk-next{display:flex;gap:6px;align-items:center;margin-top:9px;font-size:11px;font-weight:800;color:#7a4a2b}
#deck-screen .dk-next i{font-style:normal;padding:3px 8px;border-radius:10px;background:#fff7;border:1px solid #b57a43}
#deck-screen .dk-coll{flex:1;min-height:0;margin-top:12px;display:flex;flex-direction:column}
#deck-screen .dk-grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-content:start;padding:4px 2px 8px}
#deck-screen .dk-grid .dk-card.in{filter:saturate(.45) brightness(.8)}
#deck-screen .dk-grid .dk-card.in::after{content:'EN DECK';position:absolute;inset:auto 0 0;background:#2d4f5dcc;color:#ffe8a8;font-size:9px;font-weight:900;letter-spacing:1px;padding:3px 0}
#deck-screen .dk-grid .dk-card.lock{filter:grayscale(1) brightness(.45)}
#deck-screen .dk-grid .dk-card.lock::after{content:'🔒 Booster';position:absolute;inset:auto 0 0;background:#000a;color:#fff;font-size:9px;font-weight:900;padding:3px 0}
#deck-screen .dk-hint{text-align:center;font-size:12px;font-weight:700;color:#fff;margin:8px 0 0;text-shadow:0 1px #0006}
#deck-screen .dk-sheet{position:absolute;inset:0;background:#0007;display:flex;align-items:flex-end;animation:dkf .2s}
#deck-screen .dk-sheet[hidden]{display:none}
#deck-screen .dk-sheet>div{width:100%;border-radius:26px 26px 0 0;background:linear-gradient(#f9e9bd,#ecd194);border-top:4px solid #b57a43;padding:16px 16px calc(18px + env(safe-area-inset-bottom));display:grid;grid-template-columns:42% 1fr;gap:14px;animation:dku .25s ease-out}
#deck-screen .dk-sheet .dk-card{box-shadow:0 8px 18px #0006}
#deck-screen .dk-sheet h3{margin:0;font-size:19px;color:#5a3a1f}
#deck-screen .dk-sheet .tag{display:inline-block;margin:4px 0 8px;padding:3px 9px;border-radius:9px;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#fff;background:#7a8fa0}
#deck-screen .dk-sheet .tag.rare{background:#3b86d6}#deck-screen .dk-sheet .tag.epic{background:#9a4fd1}#deck-screen .dk-sheet .tag.legendary{background:#e6a622}
#deck-screen .dk-sheet p{margin:0 0 12px;font-size:13px;line-height:1.35}
#deck-screen .dk-act{width:100%;padding:12px;border-radius:15px;border:0;font-weight:900;font-size:14px;letter-spacing:1px;color:#fff;background:linear-gradient(#5fd37a,#2fa24f);box-shadow:0 4px #1d6d34}
#deck-screen .dk-act.off{background:#9aa;box-shadow:0 4px #678}
@keyframes dkf{from{opacity:0}}@keyframes dku{from{transform:translateY(60px)}}`;

let root, detail = null, ctx, draft = [];
const valid = () => draft.length >= DECK_MIN_SIZE && draft.length <= DECK_MAX_SIZE && deckLest(draft) <= LEST_CAPACITY;
const commit = () => { if (valid() && ctx.state.setDeck([...draft])) ctx.onChange?.(); };
const toastEl = () => document.getElementById('toast');
function say(msg) { const t = toastEl(); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); }

function build() {
  if (root) return;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  root = document.createElement('section'); root.id = 'deck-screen'; root.hidden = true; document.body.appendChild(root);
}
const img = card => cardFace(card);

function render() {
  const { state } = ctx;
  const deck = draft, lest = deckLest(deck);
  const slots = Array.from({ length: DECK_MAX_SIZE }, (_, i) => CARD_LIBRARY.find(c => c.id === deck[i]));
  const rest = CARD_LIBRARY.filter(c => !deck.includes(c.id));
  root.innerHTML = `
  <div class="dk-top"><button class="dk-back" aria-label="Retour">‹</button><h2>Mon Deck</h2><span class="dk-count" style="${valid() ? '' : 'background:#c0462f'}">${deck.length}/${DECK_MAX_SIZE}</span></div>
  <div class="dk-panel"><div class="dk-label"><span>DECK DE COMBAT</span><span>⚓ Points ${lest}/${LEST_CAPACITY}</span></div>
    <div class="dk-slots">${slots.map((c, i) => c ? `<button class="dk-card" data-slot="${c.id}">${img(c)}<span class="lw">${cardLest(c)}</span></button>` : `<div class="empty">+</div>`).join('')}</div>
    <div class="dk-lest ${lest >= LEST_CAPACITY ? 'full' : ''}"><i style="width:${Math.min(100, lest / LEST_CAPACITY * 100)}%"></i></div>
    <div class="dk-next">Main : <i>4 cartes</i> · maximum 50 points de cartes.</div></div>
  <div class="dk-coll"><div class="dk-label" style="color:#fff;text-shadow:0 1px #0006"><span>COLLECTION</span><span>${rest.length} en réserve</span></div>
    <div class="dk-grid">${rest.map(c => { const have = (state.cardCollection[c.id] || 0) > 0;
      return `<button class="dk-card ${have ? '' : 'lock'}" data-card="${c.id}">${img(c)}<span class="lw">${cardLest(c)}</span></button>`; }).join('') || '<p class="dk-hint" style="grid-column:1/-1">Toutes tes cartes sont dans le deck.</p>'}</div>
    <p class="dk-hint">Touche une carte du deck pour la ranger, ou une carte de la collection pour l’utiliser.</p></div>
  <div class="dk-sheet" hidden></div>`;
  root.querySelector('.dk-back').onclick = close;
  root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
    draft = draft.filter(id => id !== b.dataset.slot); commit(); render();
    if (draft.length < DECK_MIN_SIZE) say(`Il faut au moins ${DECK_MIN_SIZE} cartes pour partir.`);
  });
  root.querySelectorAll('[data-card]').forEach(b => b.onclick = () => { detail = b.dataset.card; openSheet(); });
}

function openSheet() {
  const { state } = ctx, card = CARD_LIBRARY.find(c => c.id === detail); if (!card) return;
  const have = (state.cardCollection[card.id] || 0) > 0;
  const full = draft.length >= DECK_MAX_SIZE, over = deckLest(draft) + cardLest(card) > LEST_CAPACITY;
  const label = !have ? 'À TROUVER EN BOOSTER' : full ? 'DECK COMPLET' : over ? 'PAS ASSEZ DE POINTS' : 'UTILISER';
  const sheet = root.querySelector('.dk-sheet'); sheet.hidden = false;
  sheet.innerHTML = `<div><div class="dk-card">${img(card)}</div><div><h3>${card.name}</h3><span class="tag ${card.rarity}">${(RARITY[card.rarity] || '').toUpperCase()} · ${cardLest(card)} POINTS</span><p>${card.description}</p>
    <button class="dk-act ${have && !full && !over ? '' : 'off'}">${label}</button></div></div>`;
  sheet.onclick = e => { if (e.target === sheet) sheet.hidden = true; };
  sheet.querySelector('.dk-act').onclick = () => {
    if (have && !full && !over) { draft.push(card.id); commit(); say(`${card.name} équipée !`); }
    else if (have) say(full ? 'Deck complet : range une carte d’abord.' : 'Pas assez de points : range une carte.');
    sheet.hidden = true; render();
  };
}

function close() {
  if (!valid()) return say(draft.length < DECK_MIN_SIZE ? `Il faut au moins ${DECK_MIN_SIZE} cartes.` : 'Pas assez de points.');
  commit(); root.hidden = true; ctx.onClose?.();
}
/** Ouvre l'écran Deck plein écran (indépendant du tiroir de jeu). */
export function openDeckScreen(options) { ctx = options; build(); draft = [...options.state.deck]; render(); root.hidden = false; }
