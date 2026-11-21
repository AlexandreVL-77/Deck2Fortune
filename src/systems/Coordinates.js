/** Coordonnées de navigation : conversion axiale (q,r) -> grille lisible E/O et N/S. */
export function toGrid(q, r) { return { x: q + Math.floor(r / 2), y: r }; }
export function coordLabel(q, r) {
  const { x, y } = toGrid(q, r);
  return `${Math.abs(x)}°${x >= 0 ? 'E' : 'O'} · ${Math.abs(y)}°${y <= 0 ? 'N' : 'S'}`;
}
export function distanceLabel(a, b) {
  const dq = b.q - a.q, dr = b.r - a.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}
