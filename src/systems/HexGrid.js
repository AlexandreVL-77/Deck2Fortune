// Infinite deterministic axial hex world. A seed defines the same world on every visit.
export const DIRECTIONS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
export function hexDistance(a,b){return(Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2;}
export function axialToPixel(q,r,size){return{x:size*Math.sqrt(3)*(q+r/2),y:size*1.5*r};}
function hash(seed,q,r){let h=(seed^Math.imul(q|0,0x45d9f3b)^Math.imul(r|0,0x119de1f3))|0;h=Math.imul(h^(h>>>16),0x45d9f3b);h=Math.imul(h^(h>>>16),0x45d9f3b);return((h^(h>>>16))>>>0)/4294967296;}

const ISLAND_SHAPES=[
  [[0,0],[1,0],[0,1]],
  [[0,0],[1,0],[0,1],[-1,1]],
  [[0,0],[1,0],[0,1],[1,-1],[-1,1]],
  [[0,0],[1,0],[0,1],[-1,0],[0,-1]]
];
function rotateAxial([q,r],turns){for(let i=0;i<turns;i++)[q,r]=[-r,q+r];return[q,r];}
function belongsToIslandCluster(seed,q,r,near){
  if(near<=3)return false;
  // Extremely rare cluster origins; each successful origin creates a connected 3–5 tile island.
  for(let oq=q-2;oq<=q+2;oq++)for(let or=r-2;or<=r+2;or++){
    if(hexDistance({q:oq,r:or},{q,r})>2||hexDistance({q:oq,r:or},{q:0,r:0})<=3)continue;
    const roll=hash(seed,oq,or);
    if(roll<.99965)continue;
    const shapeIndex=Math.floor(hash(seed^0x51ed270b,oq,or)*ISLAND_SHAPES.length);
    const turns=Math.floor(hash(seed^0x2c1b3c6d,oq,or)*6);
    const shape=ISLAND_SHAPES[shapeIndex].map(p=>rotateAxial(p,turns));
    if(shape.some(([dq,dr])=>oq+dq===q&&or+dr===r))return true;
  }
  return false;
}

export function makeTile(seed,q,r){
  if(q===0&&r===0)return{q,r,kind:'sea'};
  const n=hash(seed,q,r),near=hexDistance({q,r},{q:0,r:0});let kind='sea';
  // Rare cloud banks remain independent from island generation.
  const cloudShape=[[0,0],[1,0],[-1,0],[0,1],[0,-1]];
  const coveredByCloud=cloudShape.some(([dq,dr])=>{
    const aq=q-dq,ar=r-dr;
    return hexDistance({q:aq,r:ar},{q:0,r:0})>2&&hash(seed,aq,ar)>.997;
  });
  if(coveredByCloud)kind='storm';
  else if(belongsToIslandCluster(seed,q,r,near))kind='island';
  else if(n>.9997&&near>5)kind='volcano';
  return{q,r,kind};
}
export function makeIslandMap(radius=7,seed=1){const tiles=[];for(let q=-radius;q<=radius;q++)for(let r=-radius;r<=radius;r++)if(hexDistance({q,r},{q:0,r:0})<=radius)tiles.push(makeTile(seed,q,r));return tiles;}
