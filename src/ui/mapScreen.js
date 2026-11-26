import { makeTile, axialToPixel } from '../systems/HexGrid.js';
import { coordLabel, distanceLabel } from '../systems/Coordinates.js';

const css = `
#map-screen{position:fixed;inset:0;z-index:61;display:flex;flex-direction:column;color:#4a2f1a;font-family:'Fredoka','DM Sans',system-ui,sans-serif;background:#4a2f1a;padding:max(10px,env(safe-area-inset-top)) 10px calc(12px + env(safe-area-inset-bottom))}
#map-screen[hidden]{display:none}
#map-screen .top{display:flex;align-items:center;gap:10px;margin-bottom:8px}
#map-screen .back{width:42px;height:42px;border-radius:14px;border:2px solid #fff8;background:linear-gradient(#fff2c9,#f0c36f);box-shadow:0 3px #a8672f;font-size:20px;color:#5a3a1f;font-weight:900}
#map-screen h2{margin:0;flex:1;font-family:'Rye',Georgia,serif;font-size:21px;color:#fff6d8;text-shadow:0 2px #2a1a0c}
#map-screen .pos{padding:6px 10px;border-radius:12px;background:#2d4f5d;color:#ffe8a8;font-weight:800;font-size:12px}
#map-screen .frame{position:relative;flex:1;min-height:0;border-radius:18px;border:5px solid #8a5a35;box-shadow:inset 0 0 0 3px #d9b36c,0 4px 12px #0008;overflow:hidden;background:#f1deaa}
#map-screen canvas{width:100%;height:100%;display:block;touch-action:none}
#map-screen .info{margin-top:8px;padding:10px 12px;border-radius:16px;background:linear-gradient(#f9e9bd,#ecd194);border:2px solid #b57a43;font-size:13px;font-weight:700;min-height:20px;display:flex;align-items:center;gap:8px}
#map-screen .info-text{flex:1}
#map-screen .waypoint-action{border:2px solid #8a3d2c;border-radius:10px;padding:7px 10px;background:linear-gradient(#f8d18b,#e9a84f);color:#512b1b;font-weight:900;font-size:12px;white-space:nowrap}
#map-screen .waypoint-action[hidden]{display:none}
#map-screen .legend{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;font-weight:800;color:#ffe8a8;margin-top:6px}`;
const R = 12; // rayon d'affichage en cases
let root, canvas, ctx2d, state, pan = { x: 0, y: 0 }, drag = null, selected = null, marks = [];

function build() {
  if (root) return;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  root = document.createElement('section'); root.id = 'map-screen'; root.hidden = true;
  root.innerHTML = `<div class="top"><button class="back" aria-label="Retour">‹</button><h2>Carte pirate</h2><span class="pos"></span></div>
  <div class="frame"><canvas></canvas></div><div class="info"><span class="info-text">Touche une île pour afficher ses coordonnées et y placer un waypoint.</span><button class="waypoint-action" hidden></button></div>
  <div class="legend"><span>⛵ Toi</span><span>🏝 Grande île</span><span>🌋 Volcan</span><span>⚓ Comptoir</span><span>⛈ Tempête</span></div>`;
  document.body.appendChild(root);
  canvas = root.querySelector('canvas'); ctx2d = canvas.getContext('2d');
  root.querySelector('.back').onclick = () => { root.hidden = true; };
  root.querySelector('.waypoint-action').onclick = () => {
    if (!selected?.isIsland || typeof state.toggleWaypoint !== 'function') return;
    state.toggleWaypoint(selected.q, selected.r);
    updateSelectionInfo();
    draw();
  };
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; pan.x = drag.px + dx; pan.y = drag.py + dy; draw(); });
  canvas.addEventListener('pointerup', e => { if (drag && !drag.moved) pick(e); drag = null; });
}

function layout() {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  return { w: rect.width, h: rect.height, dpr, size: Math.min(rect.width / (R * 1.6), 22) };
}

function draw() {
  const { w, h, dpr, size } = layout(), c = ctx2d, p = state.player;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Parchemin
  const g = c.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h) * .7);
  g.addColorStop(0, '#f8e8b8'); g.addColorStop(1, '#e0bf80'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const origin = axialToPixel(p.q, p.r, 1);
  const toScreen = (q, r) => { const a = axialToPixel(q, r, 1); return [w / 2 + pan.x + (a.x - origin.x) * size, h / 2 + pan.y + (a.y - origin.y) * size]; };
  marks = [];
  const hex = (x, y, s) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } c.closePath(); };
  const span = Math.ceil(Math.max(w, h) / size / 1.2) + 2;
  for (let dq = -span; dq <= span; dq++) for (let dr = -span; dr <= span; dr++) {
    const q = p.q + dq, r = p.r + dr, key = q + ',' + r, [x, y] = toScreen(q, r);
    if (x < -size || y < -size || x > w + size || y > h + size) continue;
    hex(x, y, size * .98);
    // L'atlas cartographie le monde généré autour du navire, pas uniquement les cases visitées.
    const t = makeTile(state.seed, q, r, !!state.revealedClouds?.has(key));
    // Toute case appartenant à une île ou à un archipel est une cible sélectionnable,
    // même si aucun emoji n'est dessiné sur cette case précise.
    if (t.kind === 'island') marks.push({ x, y, q, r, label: 'Île', emoji: '🏝', isIsland: true });
    else if (t.kind === 'archipelago') marks.push({ x, y, q, r, label: 'Île de l’archipel', emoji: '🏝', isIsland: true });
    c.fillStyle = t.kind === 'archipelago' ? '#8fcf7a' : t.kind === 'island' ? '#a8d98a' : t.kind === 'volcano' ? '#c9825a' : t.kind === 'storm' ? '#aab4bd' : '#bfe3e0';
    c.fill(); c.strokeStyle = '#a07a45aa'; c.lineWidth = .8; c.stroke();
    const mark = (emoji, label, scale = 1, isIsland = false) => { c.font = `${size * 1.15 * scale}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(emoji, x, y + 1); marks.push({ x, y, q, r, label, emoji, isIsland }); };
    if (t.kind === 'volcano') mark('🌋', 'Volcan');
    else if (t.kind === 'island') mark('🌴', 'Île', .8, true);
    else if (t.kind === 'archipelago') { const o = t.archipelagoOrigin; if (o.comptoir && o.q === q && o.r === r) mark('⚓', 'Comptoir marchand', 1.1); else if (o.q === q && o.r === r) mark('🏝', 'Grande île', 1, true); }
    else if (t.kind === 'storm') mark('⛈', 'Tempête', .8);
  }
  // Waypoints : visibles uniquement sur l'Atlas, jamais dans le monde 3D.
  for (const waypoint of state.waypoints || []) {
    const [wx, wy] = toScreen(waypoint.q, waypoint.r);
    if (wx < -size || wy < -size || wx > w + size || wy > h + size) continue;
    c.beginPath(); c.arc(wx + size * .58, wy - size * .58, Math.max(7, size * .38), 0, Math.PI * 2);
    c.fillStyle = '#b83c2f'; c.fill(); c.strokeStyle = '#fff0c4'; c.lineWidth = 1.5; c.stroke();
    c.font = `${Math.max(10, size * .48)}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('⚑', wx + size * .58, wy - size * .58);
  }
  // Rose des vents & quadrillage de coordonnées
  c.fillStyle = '#7a4a2b'; c.font = '700 11px Fredoka, sans-serif'; c.textAlign = 'center';
  c.fillText('N', w / 2, 12); c.fillText('S', w / 2, h - 5); c.fillText('O', 8, h / 2); c.fillText('E', w - 8, h / 2);
  // Navire
  const [sx, sy] = toScreen(p.q, p.r);
  c.beginPath(); c.arc(sx, sy, size * .9, 0, 7); c.fillStyle = '#ffffff99'; c.fill(); c.strokeStyle = '#d24b3a'; c.lineWidth = 2; c.stroke();
  c.font = `${size * 1.3}px serif`; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText('⛵', sx, sy + 1);
  if (selected) { const m = marks.find(k => k.q === selected.q && k.r === selected.r); if (m) { c.beginPath(); c.arc(m.x, m.y, size * 1.1, 0, 7); c.strokeStyle = '#d24b3a'; c.setLineDash([4, 3]); c.lineWidth = 2; c.stroke(); c.setLineDash([]); } }
  root.querySelector('.pos').textContent = '📍 ' + coordLabel(p.q, p.r);
}

function updateSelectionInfo() {
  const text = root.querySelector('.info-text');
  const button = root.querySelector('.waypoint-action');
  if (!selected) {
    text.textContent = 'Touche une île pour afficher ses coordonnées et y placer un waypoint.';
    button.hidden = true;
    return;
  }
  text.textContent = `${selected.emoji} ${selected.label} — ${coordLabel(selected.q, selected.r)} · à ${distanceLabel(state.player, selected)} cases`;
  const isWaypoint = (state.waypoints || []).some(point => point.q === selected.q && point.r === selected.r);
  button.hidden = !selected.isIsland;
  button.textContent = isWaypoint ? 'Retirer le waypoint' : '⚑ Ajouter waypoint';
}
function pick(e) {
  const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
  const m = marks.map(k => ({ k, d: Math.hypot(k.x - x, k.y - y) })).sort((a, b) => a.d - b.d)[0];
  if (!m || m.d > 30) selected = null;
  else selected = m.k;
  updateSelectionInfo();
  draw();
}

/** Ouvre l'Atlas : les waypoints restent visibles uniquement sur cette carte. */
export function openMapScreen(gameState) { state = gameState; build(); pan = { x: 0, y: 0 }; selected = null; root.hidden = false; requestAnimationFrame(draw); }
