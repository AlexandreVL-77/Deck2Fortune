/** Menu du comptoir : vendre ses trésors contre de l'or. */
const css = `
#comptoir-screen{position:fixed;inset:0;z-index:62;display:flex;flex-direction:column;color:#4a2f1a;font-family:'Fredoka','DM Sans',system-ui,sans-serif;background:radial-gradient(120% 70% at 50% 0,#ffe7a8 0,#e6b06a 55%,#b97b44 100%);padding:max(10px,env(safe-area-inset-top)) 12px calc(14px + env(safe-area-inset-bottom))}
#comptoir-screen[hidden]{display:none}
#comptoir-screen .top{display:flex;align-items:center;gap:10px;margin-bottom:12px}
#comptoir-screen .back{width:42px;height:42px;border-radius:14px;border:2px solid #fff8;background:linear-gradient(#fff2c9,#f0c36f);box-shadow:0 3px #a8672f;font-size:20px;color:#5a3a1f;font-weight:900}
#comptoir-screen h2{margin:0;flex:1;font-family:'Rye',Georgia,serif;font-size:21px;color:#fff6d8;text-shadow:0 2px #6b4226}
#comptoir-screen .gold{padding:6px 12px;border-radius:14px;background:#2d4f5d;color:#ffe8a8;font-weight:800;font-size:13px;border:2px solid #fff3}
#comptoir-screen .panel{border-radius:22px;background:linear-gradient(#f9e9bd,#ecd194);border:3px solid #b57a43;box-shadow:0 5px #7a4a2b,inset 0 0 0 2px #fff6;padding:12px}
#comptoir-screen .merchant{display:flex;gap:10px;align-items:center;font-size:13px;line-height:1.3}
#comptoir-screen .merchant b{font-size:34px}
#comptoir-screen .list{flex:1;min-height:0;overflow:auto;margin:12px 0;display:flex;flex-direction:column;gap:8px}
#comptoir-screen .row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:16px;background:#fff8e0;border:2px solid #d8b070}
#comptoir-screen .row span.i{font-size:26px}#comptoir-screen .row .n{flex:1;font-weight:700}
#comptoir-screen .row button,#comptoir-screen .all{border:0;border-radius:13px;padding:8px 12px;font-weight:900;color:#fff;background:linear-gradient(#5fd37a,#2fa24f);box-shadow:0 3px #1d6d34}
#comptoir-screen .all{width:100%;padding:14px;font-size:15px;letter-spacing:1px}
#comptoir-screen .all[disabled]{background:#9aa;box-shadow:0 3px #678}
#comptoir-screen .empty{text-align:center;color:#fff;font-weight:700;margin-top:30px;text-shadow:0 1px #0006}`;
let root, state, toast;
function build() {
  if (root) return;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  root = document.createElement('section'); root.id = 'comptoir-screen'; root.hidden = true; document.body.appendChild(root);
}
function render() {
  const total = state.treasures.reduce((s, t) => s + t.value, 0);
  root.innerHTML = `<div class="top"><button class="back" aria-label="Retour">‹</button><h2>Comptoir</h2><span class="gold">🪙 ${state.gold} or</span></div>
  <div class="panel merchant"><b>🧔</b><div>« Amène-moi tes trésors, capitaine, et je te les paie en bon or sonnant ! »</div></div>
  <div class="list">${state.treasures.length ? state.treasures.map((t, i) => `<div class="row"><span class="i">${t.icon}</span><span class="n">${t.name}</span><button data-i="${i}">+${t.value} or</button></div>`).join('') : '<p class="empty">Ta cale est vide.<br>Fouille les îles et les volcans pour trouver des trésors !</p>'}</div>
  <button class="all" ${state.treasures.length ? '' : 'disabled'}>TOUT VENDRE${total ? ` · +${total} or` : ''}</button>`;
  root.querySelector('.back').onclick = () => { root.hidden = true; };
  root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => sell(+b.dataset.i));
  root.querySelector('.all').onclick = () => sell(null);
}
function sell(index) {
  const gained = state.sellTreasures(index);
  if (gained) toast(`+${gained} or !`);
  render();
}
export function openComptoir(gameState, toastFn) { state = gameState; toast = toastFn; build(); render(); root.hidden = false; }
