// Axial coordinates (q, r). Distance is exact for a pointy-top hex grid.
export const DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
export function hexDistance(a,b) {
  return (Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2;
}
export function axialToPixel(q,r,size) {
  return { x:size*Math.sqrt(3)*(q+r/2), y:size*1.5*r };
}
export function makeIslandMap(radius=4) {
  const tiles=[];
  for(let q=-radius;q<=radius;q++) for(let r=-radius;r<=radius;r++) {
    if(hexDistance({q:0,r:0},{q,r})<=radius) {
      const roll=(Math.abs(q*17+r*31)+q*q+r*r)%13;
      tiles.push({q,r,kind:roll===0?'volcano':roll===1?'storm':roll<5?'island':'sea'});
    }
  }
  return tiles;
}
