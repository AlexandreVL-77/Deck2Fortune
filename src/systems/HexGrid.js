// Infinite deterministic axial hex world. A seed defines the same world on every visit.
export const DIRECTIONS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
export function hexDistance(a,b){return(Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2;}
export function axialToPixel(q,r,size){return{x:size*Math.sqrt(3)*(q+r/2),y:size*1.5*r};}
function hash(seed,q,r){let h=(seed^Math.imul(q|0,0x45d9f3b)^Math.imul(r|0,0x119de1f3))|0;h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return((h^(h>>>16))>>>0)/4294967296;}
export function makeTile(seed,q,r){
  if(q===0&&r===0)return{q,r,kind:'sea'};
  const n=hash(seed,q,r),near=hexDistance({q,r},{q:0,r:0});let kind='sea';
  // Un banc de nuages occupe cinq cases en croix et reste déterministe.
  const cloudShape=[[0,0],[1,0],[-1,0],[0,1],[0,-1]];
  const coveredByCloud=cloudShape.some(([dq,dr])=>{
    const aq=q-dq,ar=r-dr;
    return hexDistance({q:aq,r:ar},{q:0,r:0})>2&&hash(seed,aq,ar)>.997;
  });
  if(coveredByCloud)kind='storm';
  else if(n>.955&&near>2)kind='volcano';else if(n>.79&&near>1)kind='island';
  return{q,r,kind};
}
export function makeIslandMap(radius=7,seed=1){const tiles=[];for(let q=-radius;q<=radius;q++)for(let r=-radius;r<=radius;r++)if(hexDistance({q,r},{q:0,r:0})<=radius)tiles.push(makeTile(seed,q,r));return tiles;}
