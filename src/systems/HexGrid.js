// Axial coordinates for a pointy-top hex grid.
export const DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
export function hexDistance(a,b) {
  return (Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2;
}
export function axialToPixel(q,r,size) {
  return { x:size*Math.sqrt(3)*(q+r/2), y:size*1.5*r };
}
export function makeIslandMap(radius=7) {
  const tiles=[];
  for(let q=-radius;q<=radius;q++) for(let r=-radius;r<=radius;r++) {
    const coord={q,r};
    if(hexDistance({q:0,r:0},coord)>radius) continue;
    // Keep the starting area clear so the ship always has its own water tile.
    const distance=hexDistance({q:0,r:0},coord);
    if(distance<=1) {
      tiles.push({...coord,kind:'sea'});
      continue;
    }
    const roll=(Math.abs(q*17+r*31)+q*q+r*r)%17;
    tiles.push({...coord,kind:roll===0?'volcano':roll===1?'storm':roll<6?'island':'sea'});
  }
  return tiles;
}
