import { CARD_LIBRARY, DECK_MAX_SIZE } from '../data/cards.js';

const RARITY = { common: 'Commune', rare: 'Rare', epic: 'Épique' };
const css = `
#deck-screen{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;color:#4a2f1a;font-family:'Fredoka','DM Sans',system-ui,sans-serif;
 background:radial-gradient(120% 70% at 50% 0,#9fe3df 0,#58b9c4 45%,#2c8d9f 100%);padding:max(10px,env(safe-area-inset-top)) 12px calc(14px + env(safe-area-inset-bottom));overflow:hidden}
#deck-screen[hidden]{display:none}
#deck-screen .dk-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
#deck-screen .dk-back{width:42px;height:42px;border-radius:14px;border:2px solid #fff8;background:linear-gradient(#fff2c9,#f0c36f);box-shadow:0 3px #a8672f;font-size:20px;color:#5a3a1f;font-weight:900}
#deck-screen h2{margin:0;flex:1;font-family:'Rye',Georgia,serif;font-size:21px;color:#fff6d8;text-shadow:0 2px #6b4226,0 0 8px #0004;letter-spacing:.5px}
#deck-screen .dk-count{padding:6px 12px;border-radius:14px;background:#2d4f5d;color:#ffe8a8;font-weight:800;font-size:13px;border:2px solid #fff3}
#deck-screen .dk-panel{border-radius:22px;background:linear-gradient(#f9e9bd,#ecd194);border:3px solid #b57a43;box-shadow:0 5px #7a4a2b,inset 0 0 0 2px #fff6;padding:10px}
#deck-screen .dk-label{display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:11px;letter-spacing:2px;color:#7a4a2b;margin:0 2px 8px}
#deck-screen .dk-slots{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
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
#deck-screen .dk-sheet .tag.rare{background:#3b86d6}#deck-screen .dk-sheet .tag.epic{background:#9a4fd1}
#deck-screen .dk-sheet p{margin:0 0 12px;font-size:13px;line-height:1.35}
#deck-screen .dk-act{width:100%;padding:12px;border-radius:15px;border:0;font-weight:900;font-size:14px;letter-spacing:1px;color:#fff;background:linear-gradient(#5fd37a,#2fa24f);box-shadow:0 4px #1d6d34}
#deck-screen .dk-act.off{background:#9aa;box-shadow:0 4px #678}
@keyframes dkf{from{opacity:0}}@keyframes dku{from{transform:translateY(60px)}}`;

let root, selSlot = 0, detail = null, ctx;
const toastEl = () => document.getElementById('toast');
function say(msg) { const t = toastEl(); if (!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); }

function build() {
  if (root) return;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  root = document.createElement('section'); root.id = 'deck-screen'; root.hidden = true; document.body.appendChild(root);
}
const img = card => `<img src="${card.image}" alt="${card.name}" draggable="false">`;

function render() {
  const { state } = ctx;
  const deck = state.deck;
  const slots = Array.from({ length: DECK_MAX_SIZE }, (_, i) => CARD_LIBRARY.find(c => c.id === deck[i]));
  const rare = deck.map(id => CARD_LIBRARY.find(c => c.id === id)).filter(c => c && c.rarity !== 'common').length;
  root.innerHTML = `
  <div class="dk-top"><button class="dk-back" aria-label="Retour">‹</button><h2>Mon Deck</h2><span class="dk-count">${deck.length}/${DECK_MAX_SIZE}</span></div>
  <div class="dk-panel"><div class="dk-label"><span>DECK DE COMBAT</span><span>★ ${rare} rare${rare > 1 ? 's' : ''}+</span></div>
    <div class="dk-slots">${slots.map((c, i) => `<button class="dk-card ${i === selSlot ? 'sel' : ''}" data-slot="${i}">${c ? img(c) : ''}<span class="n">${i + 1}</span></button>`).join('')}</div>
    <div class="dk-next">Main : <i>4 cartes</i> + prochaine carte <i>aléatoire</i></div></div>
  <div class="dk-coll"><div class="dk-label" style="color:#fff;text-shadow:0 1px #0006"><span>COLLECTION</span><span>${CARD_LIBRARY.filter(c => (state.cardCollection[c.id] || 0) > 0).length}/${CARD_LIBRARY.length}</span></div>
    <div class="dk-grid">${CARD_LIBRARY.map(c => { const have = (state.cardCollection[c.id] || 0) > 0, inDeck = deck.includes(c.id);
      return `<button class="dk-card ${inDeck ? 'in' : ''} ${have ? '' : 'lock'}" data-card="${c.id}">${img(c)}</button>`; }).join('')}</div>
    <p class="dk-hint">Touche un emplacement, puis une carte pour l’échanger.</p></div>
  <div class="dk-sheet" hidden></div>`;
  root.querySelector('.dk-back').onclick = close;
  root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { selSlot = +b.dataset.slot; render(); });
  root.querySelectorAll('[data-card]').forEach(b => b.onclick = () => { detail = b.dataset.card; openSheet(); });
}

function openSheet() {
  const { state } = ctx, card = CARD_LIBRARY.find(c => c.id === detail); if (!card) return;
  const have = (state.cardCollection[card.id] || 0) > 0, inDeck = state.deck.includes(card.id);
  const sheet = root.querySelector('.dk-sheet'); sheet.hidden = false;
  sheet.innerHTML = `<div><div class="dk-card">${img(card)}</div><div><h3>${card.name}</h3><span class="tag ${card.rarity}">${(RARITY[card.rarity] || '').toUpperCase()}</span><p>${card.description}</p>
    <button class="dk-act ${have && !inDeck ? '' : 'off'}">${!have ? 'À TROUVER EN BOOSTER' : inDeck ? 'DÉJÀ DANS LE DECK' : `UTILISER (EMPLACEMENT ${selSlot + 1})`}</button></div></div>`;
  sheet.onclick = e => { if (e.target === sheet) sheet.hidden = true; };
  sheet.querySelector('.dk-act').onclick = () => {
    if (!have || inDeck) { sheet.hidden = true; return; }
    const next = [...state.deck]; next[selSlot] = card.id;
    if (state.setDeck(next)) say(`${card.name} équipée !`); else say('Deck invalide.');
    sheet.hidden = true; render(); ctx.onChange?.();
  };
}

function close() { root.hidden = true; ctx.onClose?.(); }
/** Ouvre l'écran Deck plein écran (indépendant du tiroir de jeu). */
export function openDeckScreen(options) { ctx = options; build(); selSlot = 0; render(); root.hidden = false; }
