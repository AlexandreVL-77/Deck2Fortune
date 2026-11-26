import * as THREE from 'three';
import { rollTreasure } from '../systems/Treasure.js';
import { makeTile, axialToPixel, hexDistance, DIRECTIONS } from '../systems/HexGrid.js';

const CHUNK_SIZE=6;
const CHUNK_RADIUS=1;
const HEX_SIZE = 1.12;
const VIEW_HEIGHT = 13.8;
const OCEAN_Y = -.42;
const SHIP_Y = -.14;

export class ThreeWorld {
  constructor(root, state) {
    this.root=root; this.state=state; this.home=true;
    this.tiles=[]; this.tileByKey=new Map(); this.highlightMeshes=[];
    this.ray=new THREE.Raycaster(); this.pointer=new THREE.Vector2();
    this.drag=null; this.target=new THREE.Vector3(state.camera?.x||0,0,state.camera?.z||0); this.cameraPanOffset=new THREE.Vector3(); this.chunks=new Map();
    this.crests=[]; this.foams=[]; this.smokes=[]; this.cloudGroups=[]; this.heading=0; this.lastRevealCount=state.revealedClouds?.size||0;
    this.stormDamageAccumulator=0; this.lastFrameTime=0; this.sinkingStartedAt=null; this.lastLightning=0;
    this.toonGradient=this.makeToonGradient();
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color('#4fb9c6');
    this.camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,120);
    this.cameraOffset=new THREE.Vector3(9,17,9);
    this.viewHeight=VIEW_HEIGHT;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure=1;
    this.renderer.domElement.style.touchAction='none';
    root.appendChild(this.renderer.domElement);
    this.addLights(); this.createOcean(); this.createMap(); this.createShip();
    // Preserve the saved camera offset relative to the ship when resuming a game.
    this.cameraPanOffset.set(this.target.x-this.shipTarget.x,0,this.target.z-this.shipTarget.z);
    this.createStormEffects(); this.createBoosterEffects();
    this.createHighlights(); this.updateHighlights(); this.resize();
    window.addEventListener('resize',()=>this.resize());
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
    canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    canvas.addEventListener('pointerup',e=>this.pointerUp(e));
    canvas.addEventListener('pointercancel',()=>{this.drag=null;});
    this.loop=this.loop.bind(this); this.frame=requestAnimationFrame(this.loop);
  }
  makeToonGradient(){
    // 3 paliers d'ombre : rendu cartoon à aplats (Wind Waker / Animal Crossing)
    const tex=new THREE.DataTexture(new Uint8Array([150,205,255]),3,1,THREE.RedFormat);
    tex.minFilter=tex.magFilter=THREE.NearestFilter; tex.generateMipmaps=false; tex.needsUpdate=true;
    return tex;
  }
  material(color,flat=false){
    const key=color+(flat?'f':'');
    this.matCache=this.matCache||new Map();
    if(!this.matCache.has(key)){
      const m=new THREE.MeshToonMaterial({color,gradientMap:this.toonGradient});
      if(flat)m.flatShading=true; // facettes low-poly
      this.matCache.set(key,m);
    }
    return this.matCache.get(key);
  }
  softShadowTexture(){
    const c=document.createElement('canvas'); c.width=c.height=128;
    const g=c.getContext('2d'),grad=g.createRadialGradient(64,64,4,64,64,62);
    grad.addColorStop(0,'rgba(12,78,92,.55)'); grad.addColorStop(.6,'rgba(12,78,92,.26)'); grad.addColorStop(1,'rgba(12,78,92,0)');
    g.fillStyle=grad; g.fillRect(0,0,128,128);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex;
  }
  addLights(){
    this.scene.add(new THREE.HemisphereLight(0xeaffff,0x7aa88f,1.6));
    const sun=new THREE.DirectionalLight(0xfff0d2,2.0);
    sun.position.set(-8,18,11); sun.castShadow=true;
    sun.shadow.mapSize.set(512,512);
    sun.shadow.camera.left=-22; sun.shadow.camera.right=22;
    sun.shadow.camera.top=22; sun.shadow.camera.bottom=-22;
    sun.shadow.bias=-.00025; sun.shadow.normalBias=.02; this.scene.add(sun);
  }
  createOcean(){
    // Océan low-poly à facettes, vagues douces animées dans animateWorld()
    const geo=new THREE.PlaneGeometry(90,90,54,54); geo.rotateX(-Math.PI/2);
    this.oceanBase=geo.attributes.position.array.slice();
    geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    this.ocean=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#3fb8c4',roughness:.55,metalness:0,flatShading:true}));
    this.ocean.position.y=OCEAN_Y; this.ocean.receiveShadow=true; this.scene.add(this.ocean);
    // Petits arcs d'écume qui scintillent
    const crestGeo=new THREE.RingGeometry(.40,.46,18,1,0,2.1); crestGeo.rotateX(-Math.PI/2);
    for(let i=0;i<28;i++){
      const m=new THREE.Mesh(crestGeo,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.2,depthWrite:false}));
      m.position.set(((i*7)%19-9)*1.75,-.3,((i*11)%17-8)*1.8);
      m.rotation.y=i*1.3; m.scale.setScalar(.8+(i%3)*.3); m.userData.phase=i*.9;
      this.crests.push(m); this.scene.add(m);
    }
  }
  tilePosition(q,r){
    const p=axialToPixel(q,r,HEX_SIZE);
    return new THREE.Vector3(p.x,0,p.y);
  }
  key(q,r){return q+','+r;}
  flatHex(geo){geo.rotateX(-Math.PI/2);geo.rotateY(Math.PI/6);return geo;}
  createMap(){
    const baseGeo=new THREE.CylinderGeometry(HEX_SIZE*.98,HEX_SIZE*.98,.20,6,1);
    const waterMat=new THREE.MeshStandardMaterial({color:'#8fe3da',roughness:.4,transparent:true,opacity:.4,depthWrite:false});
    const ringGeo=this.flatHex(new THREE.RingGeometry(HEX_SIZE*.94,HEX_SIZE*.985,6,1));
    const ringMat=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.34,depthWrite:false});
    const leafGeo=new THREE.SphereGeometry(.28,6,4);leafGeo.scale(1,.2,.42);
    this.baseGeo=baseGeo;this.waterMat=waterMat;this.ringGeo=ringGeo;this.ringMat=ringMat;
    this.islandGeo={sand:new THREE.CylinderGeometry(.72,.84,.26,10),grass:new THREE.CylinderGeometry(.50,.64,.14,9),hill:new THREE.SphereGeometry(.40,8,5),rock:new THREE.DodecahedronGeometry(.09,0),leaf:leafGeo,archipelagoSand:null,archipelagoGrass:null};
    this.foamGeo=new THREE.RingGeometry(.80,.93,28);this.foamGeo.rotateX(-Math.PI/2);
    this.foamMat=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.6,depthWrite:false});
    this.cloudShadowGeo=new THREE.CircleGeometry(.72,28);this.cloudShadowGeo.rotateX(-Math.PI/2);
    this.cloudShadowMat=new THREE.MeshBasicMaterial({map:this.softShadowTexture(),transparent:true,depthWrite:false});
    // The map is created only when the player starts/continues a voyage.
    // The home screen does not need hundreds of hidden hex meshes.
  }
  disposeChunk(group){
    const sharedGeometries=new Set([
      this.baseGeo,this.ringGeo,this.foamGeo,this.cloudShadowGeo,
      ...Object.values(this.islandGeo||{})
    ]);
    const sharedMaterials=new Set([
      this.waterMat,this.ringMat,this.foamMat,this.cloudShadowMat,
      ...(this.matCache?.values()||[])
    ]);
    const geometries=new Set(),materials=new Set();
    group.traverse(object=>{
      if(object.geometry&&!sharedGeometries.has(object.geometry))geometries.add(object.geometry);
      const list=Array.isArray(object.material)?object.material:[object.material];
      for(const material of list)if(material&&!sharedMaterials.has(material))materials.add(material);
    });
    geometries.forEach(geometry=>geometry.dispose());
    materials.forEach(material=>material.dispose());
  }
  updateChunks(force=false){
    if(force&&this.chunks.size){for(const group of this.chunks.values()){this.scene.remove(group);this.disposeChunk(group);}this.chunks.clear();this.tiles=[];this.tileByKey.clear();this.foams=[];this.releaseAllArchipelagos();this.smokes=[];this.cloudGroups=[];}
    const qCenter=(Math.sqrt(3)/3*this.target.x-this.target.z/3)/HEX_SIZE;
    const rCenter=(2/3*this.target.z)/HEX_SIZE;
    const cq=Math.floor(qCenter/CHUNK_SIZE),cr=Math.floor(rCenter/CHUNK_SIZE);
    const centerKey=cq+','+cr;if(!force&&this.chunkCenter===centerKey)return;this.chunkCenter=centerKey;
    const wanted=new Set();
    for(let x=-CHUNK_RADIUS;x<=CHUNK_RADIUS;x++)for(let z=-CHUNK_RADIUS;z<=CHUNK_RADIUS;z++){
      const key=(cq+x)+','+(cr+z);wanted.add(key);
      if(this.chunks.has(key))continue;
      const group=new THREE.Group(),[chunkQ,chunkR]=key.split(',').map(Number);
      for(let q=chunkQ*CHUNK_SIZE;q<(chunkQ+1)*CHUNK_SIZE;q++)for(let r=chunkR*CHUNK_SIZE;r<(chunkR+1)*CHUNK_SIZE;r++){
        const key=this.key(q,r),hidden=makeTile(this.state.seed,q,r),data=hidden.kind==='storm'&&this.state.revealedClouds?.has(key)?makeTile(this.state.seed,q,r,true):hidden,pos=this.tilePosition(q,r),tileGroup=new THREE.Group();tileGroup.position.copy(pos);
        const base=new THREE.Mesh(this.baseGeo,this.waterMat);base.position.y=-.29;base.receiveShadow=true;base.userData.tile=data;tileGroup.add(base);
        this.tiles.push(base);this.tileByKey.set(this.key(q,r),{data,group:tileGroup,base});
        const ring=new THREE.Mesh(this.ringGeo,this.ringMat);ring.position.y=-.175;tileGroup.add(ring);
        if(data.kind==='island')this.addIsland(tileGroup,data);
        if(data.kind==='archipelago'&&data.archipelagoOrigin)this.ensureArchipelago(data);
        if(data.kind==='volcano')this.addVolcano(tileGroup,data);
        if(data.kind==='storm')this.addCloud(tileGroup,data);
        group.add(tileGroup);
      }
      group.userData.chunkKey=key;this.chunks.set(key,group);this.scene.add(group);
    }
    for(const [key,group] of this.chunks){
      if(wanted.has(key))continue;
      for(const base of this.tiles){const t=base.userData.tile;if(t.kind==='archipelago'&&Math.floor(t.q/CHUNK_SIZE)+','+Math.floor(t.r/CHUNK_SIZE)===key)this.releaseArchipelagoCell(t);}
      this.scene.remove(group);this.disposeChunk(group);this.chunks.delete(key);
      for(const base of this.tiles){const tile=base.userData.tile;if(Math.floor(tile.q/CHUNK_SIZE)+','+Math.floor(tile.r/CHUNK_SIZE)===key)this.tileByKey.delete(this.key(tile.q,tile.r));}
      this.tiles=this.tiles.filter(base=>{const tile=base.userData.tile;return Math.floor(tile.q/CHUNK_SIZE)+','+Math.floor(tile.r/CHUNK_SIZE)!==key;});
      const removed=new Set();group.traverse(obj=>removed.add(obj));this.foams=this.foams.filter(obj=>!removed.has(obj));this.smokes=this.smokes.filter(obj=>!removed.has(obj));this.cloudGroups=this.cloudGroups.filter(obj=>!removed.has(obj));
    }
  }
  /** Une île géante appartient à la scène (pas à un chunk) : elle reste posée tant qu'une de ses cases est chargée. */
  ensureArchipelago(tile){
    const o=tile.archipelagoOrigin,okey=o.q+','+o.r;
    if(!this.archipelagos)this.archipelagos=new Map();
    let entry=this.archipelagos.get(okey);
    if(!entry){
      const group=new THREE.Group();group.position.copy(this.tilePosition(o.q,o.r));
      this.addArchipelago(group,{q:o.q,r:o.r,archipelagoOrigin:o});
      this.scene.add(group);entry={group,cells:new Set()};this.archipelagos.set(okey,entry);
    }
    entry.cells.add(this.key(tile.q,tile.r));
  }
  releaseArchipelagoCell(tile){
    const o=tile.archipelagoOrigin;if(!o||!this.archipelagos)return;
    const okey=o.q+','+o.r,entry=this.archipelagos.get(okey);if(!entry)return;
    entry.cells.delete(this.key(tile.q,tile.r));
    if(!entry.cells.size)this.disposeArchipelago(okey,entry);
  }
  disposeArchipelago(okey,entry){
    this.scene.remove(entry.group);
    const removed=new Set();entry.group.traverse(obj=>removed.add(obj));
    this.foams=this.foams.filter(obj=>!removed.has(obj));
    this.disposeChunk(entry.group);this.archipelagos.delete(okey);
  }
  releaseAllArchipelagos(){if(this.archipelagos)for(const [k,e] of [...this.archipelagos])this.disposeArchipelago(k,e);}
  addFoam(group,tile){
    const foam=new THREE.Mesh(this.foamGeo,this.foamMat);
    foam.position.y=-.17; foam.userData.phase=tile.q+tile.r*.7; group.add(foam); this.foams.push(foam);
  }
  addIsland(group,tile){
    // Tout reste dans un rayon < .85 : pas de débordement sur les cases voisines
    const g=this.islandGeo,isle=new THREE.Group();
    isle.rotation.y=(((tile.q*5+tile.r*3)%6)+6)%6*Math.PI/3; group.add(isle);
    this.addFoam(group,tile);
    const mesh=(geo,mat,x,y,z,sy=1)=>{
      const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); m.scale.y=sy;
      m.castShadow=true; m.receiveShadow=true; isle.add(m); return m;
    };
    mesh(g.sand,this.material('#f3d9a0',true),0,-.08,0);
    mesh(g.grass,this.material('#86c777',true),-.02,.10,.02);
    mesh(g.hill,this.material('#6cb868',true),-.10,.14,0,.55);
    mesh(g.rock,this.material('#cdbd9c',true),.52,.07,-.40);
    mesh(g.rock,this.material('#bfb090',true),-.45,.07,.46).scale.setScalar(.8);
    this.addPalm(isle,-.18,-.02,.9,.22);
    this.addPalm(isle,.28,.22,.62,.15);
  }
  /** Contour fermé de l'archipel (union des hexagones) dans le repère local de la tuile d'origine. */
  archipelagoOutline(cells){
    const edgeMap=new Map();
    const vk=p=>p.map(v=>Math.round(v*1000)/1000).join(',');
    const addEdge=(a,b)=>{const ka=vk(a),kb=vk(b),key=ka<kb?ka+'|'+kb:kb+'|'+ka;if(edgeMap.has(key))edgeMap.delete(key);else edgeMap.set(key,{a,b});};
    for(const [q,r] of cells){
      const cx=HEX_SIZE*Math.sqrt(3)*(q+r/2),cz=HEX_SIZE*1.5*r,v=[];
      for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6;v.push([cx+Math.cos(a)*HEX_SIZE,cz+Math.sin(a)*HEX_SIZE]);}
      for(let i=0;i<6;i++)addEdge(v[i],v[(i+1)%6]);
    }
    const edges=[...edgeMap.values()],chains=[];
    while(edges.length){
      const chain=[edges[0].a,edges[0].b];edges.splice(0,1);
      while(vk(chain[chain.length-1])!==vk(chain[0])){
        const last=vk(chain[chain.length-1]);
        const i=edges.findIndex(e=>vk(e.a)===last||vk(e.b)===last);if(i<0)break;
        const e=edges.splice(i,1)[0];chain.push(vk(e.a)===last?e.b:e.a);
      }
      if(chain.length>=4)chains.push(chain.slice(0,-1));
    }
    return chains.sort((a,b)=>b.length-a.length)[0]||[[-1,-1],[1,-1],[1,1],[-1,1]];
  }
  /** Décale un polygone vers l'intérieur (d>0) ou l'extérieur (d<0) puis l'arrondit (Chaikin). */
  offsetOutline(poly,d,smooth=2){
    let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[1]-b[0]*a[1];}
    const sgn=area>0?1:-1,n=poly.length;let pts=[];
    for(let i=0;i<n;i++){
      const p=poly[(i+n-1)%n],c=poly[i],q=poly[(i+1)%n];
      const nrm=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return[-sgn*dz/l,sgn*dx/l];};
      const n1=nrm(p,c),n2=nrm(c,q);let bx=n1[0]+n2[0],bz=n1[1]+n2[1];const bl=Math.hypot(bx,bz)||1;bx/=bl;bz/=bl;
      const k=d/Math.max(.45,bx*n1[0]+bz*n1[1]);
      pts.push([c[0]+bx*k,c[1]+bz*k]);
    }
    for(let it=0;it<smooth;it++){
      const out=[];
      for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];out.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}
      pts=out;
    }
    return pts;
  }
  addArchipelago(group,tile){
    const cells=tile.archipelagoOrigin?.shape?.length?tile.archipelagoOrigin.shape:[[0,0],[1,0],[0,1]];
    const base=this.archipelagoOutline(cells);
    const centers=cells.map(([q,r])=>[HEX_SIZE*Math.sqrt(3)*(q+r/2),HEX_SIZE*1.5*r]);
    const cx=centers.reduce((s,c)=>s+c[0],0)/centers.length,cz=centers.reduce((s,c)=>s+c[1],0)/centers.length;
    const toShape=pts=>{const s=new THREE.Shape();s.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)s.lineTo(pts[i][0],pts[i][1]);s.closePath();return s;};
    const flat=(pts,y,mat,order=0)=>{const g=new THREE.ShapeGeometry(toShape(pts));g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,mat);m.position.y=y;m.renderOrder=order;return m;};
    const slab=(pts,depth,bevel,y,mat)=>{
      const g=new THREE.ExtrudeGeometry(toShape(pts),{depth,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel*.8,curveSegments:1});
      g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,mat);m.position.y=y;m.castShadow=true;m.receiveShadow=true;return m;
    };
    const rng=(()=>{let a=(tile.q*73856093^tile.r*19349663^0x9e3779b9)>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();
    const land=new THREE.Group();group.add(land);
    // Lagon peu profond + écume animée autour de toute la côte.
    const lagoonMat=new THREE.MeshBasicMaterial({color:'#aef0e0',transparent:true,opacity:.5,depthWrite:false});
    land.add(flat(this.offsetOutline(base,-.12,2),-.285,lagoonMat,1));
    const foamPts=this.offsetOutline(base,.10,2),foamIn=this.offsetOutline(base,.30,2);
    const foamShape=toShape(foamPts);foamShape.holes.push(new THREE.Path(foamIn.map(p=>new THREE.Vector2(p[0],p[1]))));
    const foamGeo=new THREE.ShapeGeometry(foamShape);foamGeo.rotateX(-Math.PI/2);
    const foam=new THREE.Mesh(foamGeo,this.foamMat);foam.position.set(cx,-.2,cz);foam.userData.phase=tile.q+tile.r*.7;
    foam.geometry.translate(-cx,0,-cz);group.add(foam);this.foams.push(foam);
    // Plage puis herbe : deux dalles biseautées, silhouette organique.
    const sandPts=this.offsetOutline(base,.28,2),grassPts=this.offsetOutline(base,.58,2),hillPts=this.offsetOutline(base,.95,1);
    land.add(slab(sandPts,.20,.05,-.22,this.material('#f1d79e',true)));
    land.add(slab(grassPts,.08,.07,-.03,this.material('#7cc46f',true)));
    const GY=.06;
    const inside=(pts,x,z)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
    const sample=(pts,tries=40)=>{let minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9;for(const p of pts){minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);minz=Math.min(minz,p[1]);maxz=Math.max(maxz,p[1]);}
      for(let i=0;i<tries;i++){const x=minx+rng()*(maxx-minx),z=minz+rng()*(maxz-minz);if(inside(pts,x,z))return[x,z];}return[cx,cz];};
    const add=(geo,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;land.add(m);return m;};
    // Relief : un massif central (avec sommet rocheux sur les grands archipels) + collines.
    const big=cells.length>=6;
    const hillMat=this.material('#5fb065',true),hillMat2=this.material('#72c273',true),rock=this.material('#9a9a92',true),rockDark=this.material('#7e7f79',true);
    const port=!!tile.archipelagoOrigin?.comptoir;
    if(!port){
    const peak=add(new THREE.ConeGeometry(1,1,7),hillMat,cx,GY+(big?.42:.3),cz,big?1.05:.8,big?.9:.6,big?1.05:.8);peak.rotation.y=rng()*3;
    if(big){add(new THREE.ConeGeometry(.5,.5,6),rock,cx,GY+.78,cz,1,1,1).rotation.y=rng()*3;add(new THREE.ConeGeometry(.28,.3,6),new THREE.MeshToonMaterial({color:'#f4f1e6',gradientMap:this.toonGradient,flatShading:true}),cx,GY+1.02,cz);}
    }
    for(let i=0;i<Math.max(2,cells.length-3);i++){const [x,z]=sample(hillPts);if(Math.hypot(x-cx,z-cz)<.6)continue;const rad=.28+rng()*.12;if(![[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dz])=>inside(grassPts,x+dx*rad,z+dz*rad)))continue;add(new THREE.IcosahedronGeometry(1,0),i%2?hillMat:hillMat2,x,GY+.04,z,rad,.2+rng()*.1,rad);}
    // Palmiers + rochers côté plage.
    const palms=3+Math.min(4,cells.length-3);
    for(let i=0;i<palms;i++){
      const k=Math.floor(rng()*grassPts.length),p=grassPts[k];
      const x=p[0]+(cx-p[0])*.14,z=p[1]+(cz-p[1])*.14;
      this.addPalm(land,x,z,.55+rng()*.2,GY+.02);
    }
    for(let i=0;i<4;i++){const p=sandPts[Math.floor(rng()*sandPts.length)];add(new THREE.DodecahedronGeometry(.07+rng()*.05,0),i%2?rock:rockDark,p[0]+(cx-p[0])*.08,-.02,p[1]+(cz-p[1])*.08);}
    if(tile.archipelagoOrigin?.comptoir)this.addComptoir(land,{GY,sandPts,grassPts,inside,rng,add});
    else{
      // Île sauvage : buissons et rochers supplémentaires, aucune construction.
      const bush=this.material('#4fa35a',true);
      for(let i=0;i<5;i++){const [x,z]=sample(grassPts);add(new THREE.IcosahedronGeometry(1,0),bush,x,GY+.07,z,.13+rng()*.07,.1,.13+rng()*.07);}
    }
  }
  /** Comptoir : petit port marchand construit autour de la case d'origine (celle qui ouvre le menu). */
  addComptoir(land,{GY,sandPts,grassPts,inside,rng}){
    const wood=this.material('#93603d',true),darkWood=this.material('#68442f',true),roof=this.material('#c2603f',true),cream=this.material('#f5dfb2',true),glass=this.material('#b9e8e4',true);
    const house=(x,z,s,ry)=>{
      const g=new THREE.Group();g.position.set(x,GY,z);g.rotation.y=ry;g.scale.setScalar(s);land.add(g);
      const part=(geo,mat,px,py,pz)=>{const m=new THREE.Mesh(geo,mat);m.position.set(px,py,pz);m.castShadow=true;g.add(m);return m;};
      part(new THREE.BoxGeometry(.56,.36,.46),cream,0,.18,0);
      part(new THREE.ConeGeometry(.46,.34,4),roof,0,.52,0).rotation.y=Math.PI/4;
      part(new THREE.BoxGeometry(.11,.2,.03),darkWood,0,.1,.235);
      part(new THREE.BoxGeometry(.1,.1,.03),glass,-.17,.22,.235);
    };
    // Ponton : point du rivage le plus proche de la case d'origine, orienté vers le large.
    let pi=0,best=1e9;for(let i=0;i<sandPts.length;i++){const d=Math.hypot(sandPts[i][0],sandPts[i][1]);if(d<best){best=d;pi=i;}}
    const dp=sandPts[pi],dir=Math.atan2(dp[0],dp[1]);
    // Maisons en arc de cercle autour de l'origine, à l'opposé du ponton, seulement si elles sont sur l'herbe.
    let placed=0;
    for(let k=0;k<7&&placed<3;k++){
      const ang=dir+Math.PI+(k-3)*.8,x=Math.sin(ang)*.62,z=Math.cos(ang)*.62;
      if(!inside(grassPts,x,z))continue;house(x,z,1.05+rng()*.12,ang+Math.PI);placed++;
    }
    if(!placed)house(0,0,.8,dir);
    const px=dp[0]+Math.sin(dir)*.2,pz=dp[1]+Math.cos(dir)*.2;
    const dock=new THREE.Group();dock.position.set(px,-.12,pz);dock.rotation.y=dir;land.add(dock);
    const plank=new THREE.Mesh(new THREE.BoxGeometry(.32,.06,.7),wood);plank.position.z=.12;plank.castShadow=true;dock.add(plank);
    for(const x of [-.14,.14])for(const z of [-.14,.34]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.03,.04,.5,6),darkWood);post.position.set(x,-.25,z);dock.add(post);}
    const boat=new THREE.Group();boat.position.set(.34,-.25,.3);dock.add(boat);
    boat.add(new THREE.Mesh(new THREE.BoxGeometry(.16,.07,.34),this.material('#b2703f',true)));
    const sail=new THREE.Mesh(new THREE.PlaneGeometry(.2,.24),new THREE.MeshToonMaterial({color:'#fff4d6',side:THREE.DoubleSide,gradientMap:this.toonGradient}));sail.position.y=.17;sail.rotation.y=Math.PI/2;boat.add(sail);
    // Étal marchand rayé, tonneaux et pavillon doré pour reconnaître le comptoir de loin.
    const sx=Math.sin(dir)*.1,sz=Math.cos(dir)*.1;
    const stall=new THREE.Group();stall.position.set(sx,GY,sz);stall.scale.setScalar(1.25);stall.rotation.y=dir;land.add(stall);
    const top=new THREE.Mesh(new THREE.ConeGeometry(.3,.18,6),this.material('#e0534a',true));top.position.y=.42;top.castShadow=true;stall.add(top);
    for(const [x,z] of [[-.17,-.17],[.17,-.17],[-.17,.17],[.17,.17]]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.34,5),darkWood);post.position.set(x,.17,z);stall.add(post);}
    const table=new THREE.Mesh(new THREE.BoxGeometry(.34,.05,.26),wood);table.position.y=.14;stall.add(table);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.12,8),darkWood);barrel.position.set(.3,.06,.1);stall.add(barrel);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.7,5),darkWood);pole.position.set(-.35,.35,-.1);stall.add(pole);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(.22,.14),new THREE.MeshToonMaterial({color:'#ffcf4a',side:THREE.DoubleSide,gradientMap:this.toonGradient}));flag.position.set(-.24,.62,-.1);stall.add(flag);
  }
  addPalm(parent,x,z,s,baseY){
    const p=new THREE.Group(); p.position.set(x,baseY,z); parent.add(p);
    const h=.62*s,lean=.18,topX=Math.sin(lean)*h,topY=Math.cos(lean)*h;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.045*s,.07*s,h,6),this.material('#b27a4c',true));
    trunk.position.set(topX/2,topY/2,0); trunk.rotation.z=-lean; trunk.castShadow=true; p.add(trunk);
    for(let i=0;i<7;i++){
      const pivot=new THREE.Group(); pivot.position.set(topX,topY,0); pivot.rotation.y=i*Math.PI*2/7; p.add(pivot);
      const leaf=new THREE.Mesh(this.islandGeo.leaf,this.material(i%2?'#4fa85d':'#6dc06b',true));
      leaf.scale.setScalar(s); leaf.position.x=.24*s; leaf.rotation.z=-.4; leaf.castShadow=true; pivot.add(leaf);
    }
    const nut=new THREE.SphereGeometry(.035*s,6,5);
    for(const dx of [-.04,.05]){const c=new THREE.Mesh(nut,this.material('#8a5a35',true));c.position.set(topX+dx*s,topY-.05*s,.03*s);p.add(c);}
  }
  addVolcano(group,tile){
    this.addFoam(group,tile);
    const mesh=(geo,mat,y)=>{const m=new THREE.Mesh(geo,mat);m.position.y=y;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
    mesh(new THREE.CylinderGeometry(.74,.84,.26,10),this.material('#d9bf8c',true),-.08);
    mesh(new THREE.CylinderGeometry(.20,.62,.95,9),this.material('#8a7772',true),.40);
    const rim=new THREE.TorusGeometry(.21,.055,5,9); rim.rotateX(Math.PI/2);
    mesh(rim,this.material('#5a4b49',true),.88);
    const lava=new THREE.Mesh(new THREE.CircleGeometry(.17,9),new THREE.MeshBasicMaterial({color:'#ff884a'}));
    lava.rotation.x=-Math.PI/2; lava.position.y=.885; group.add(lava);
    for(let i=0;i<3;i++){
      const puff=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,depthWrite:false}));
      puff.userData.phase=i/3; group.add(puff); this.smokes.push(puff);
    }
  }
  addCloud(group,tile){
    // Nuage flottant + ombre ronde et douce sur l'eau
    const shadow=new THREE.Mesh(this.cloudShadowGeo,this.cloudShadowMat);
    shadow.position.set(.14,-.175,-.1); shadow.scale.set(1.1,1,.82); group.add(shadow);
    const cloud=new THREE.Group(); cloud.position.y=1.28; cloud.scale.setScalar(1.7); cloud.userData.phase=tile.q*.9+tile.r*1.7; group.add(cloud);
    // Nuage en volume : on evite toute nappe/disque aplati.
    // Une couche basse de grosses spheres chevauchees bouche les interstices,
    // tandis que des bourrelets plus hauts donnent une silhouette arrondie.
    const lowerPuffs=[
      [-.48,-.10,.02,.62],[0,-.12,0,.68],[.48,-.10,-.02,.62],
      [.12,-.12,.48,.58],[-.18,-.12,-.46,.58],
      [.58,-.10,.38,.52],[-.58,-.10,-.34,.52],
      [.02,-.12,.82,.48],[-.02,-.12,-.82,.48]
    ];
    for(const [x,y,z,s] of lowerPuffs){
      const puff=new THREE.Mesh(new THREE.SphereGeometry(s,16,12),this.material('#dce7ef'));
      puff.scale.set(1,.78,1); puff.position.set(x,y,z); cloud.add(puff);
    }
    const crownPuffs=[
      [-.42,.16,.02,.46],[0,.25,0,.54],[.43,.16,-.02,.46],
      [.10,.12,.42,.40],[-.18,.12,-.40,.40],
      [.50,.16,.34,.34],[-.50,.16,-.30,.34]
    ];
    for(const [x,y,z,s] of crownPuffs){
      const puff=new THREE.Mesh(new THREE.SphereGeometry(s,16,12),this.material('#f4f7fa'));
      puff.scale.set(1,.92,1); puff.position.set(x,y,z); cloud.add(puff);
    }
    const bolt=new THREE.Shape();
    bolt.moveTo(0,0); bolt.lineTo(-.08,-.2); bolt.lineTo(-.02,-.2); bolt.lineTo(-.1,-.42); bolt.lineTo(.06,-.16); bolt.lineTo(0,-.16); bolt.closePath();
    const b=new THREE.Mesh(new THREE.ShapeGeometry(bolt),new THREE.MeshBasicMaterial({color:'#ffe27a',side:THREE.DoubleSide}));
    b.position.set(0,-.08,.05); b.rotation.y=Math.PI/4; b.visible=false; cloud.add(b);
    cloud.userData.bolt=b; this.cloudGroups.push(cloud);
  }
  hullGeometry(k,depth,bevel){
    // Silhouette de coque vue de dessus (étrave pointue vers +Z), extrudée en hauteur
    const s=new THREE.Shape();
    s.moveTo(-.20*k,.55*k); s.lineTo(.20*k,.55*k);
    s.quadraticCurveTo(.31*k,.08*k,.19*k,-.40*k);
    s.quadraticCurveTo(.09*k,-.62*k,0,-.74*k);
    s.quadraticCurveTo(-.09*k,-.62*k,-.19*k,-.40*k);
    s.quadraticCurveTo(-.31*k,.08*k,-.20*k,.55*k);
    const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:8});
    g.rotateX(-Math.PI/2); return g;
  }
  sailGeometry(w,h){
    const g=new THREE.PlaneGeometry(w,h,6,6),p=g.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,Math.cos(p.getX(i)/w*Math.PI)*.07*(1-Math.abs(p.getY(i)/h)*.5));
    g.computeVertexNormals(); return g;
  }
  createShip(){
    this.ship=new THREE.Group(); this.ship.rotation.order='YXZ';
    const add=(geo,mat,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;this.ship.add(m);return m;};
    const wood=this.material('#7d4f30',true);
    const sailMat=new THREE.MeshToonMaterial({color:'#fff6e2',gradientMap:this.toonGradient,side:THREE.DoubleSide});
    add(this.hullGeometry(1,.16,.04),this.material('#b9724a',true));
    add(this.hullGeometry(.86,.02,0),this.material('#ecc98a'),0,.195,0);
    add(new THREE.BoxGeometry(.26,.15,.22),this.material('#e6b779',true),0,.285,-.36);
    add(new THREE.BoxGeometry(.31,.04,.27),this.material('#b5644a',true),0,.38,-.36);
    add(new THREE.CylinderGeometry(.025,.035,1.15,6),wood,0,.78,.05);
    const yard=new THREE.CylinderGeometry(.016,.016,.74,6); yard.rotateZ(Math.PI/2);
    add(yard,wood,0,1.12,.06);
    const yard2=new THREE.CylinderGeometry(.014,.014,.5,6); yard2.rotateZ(Math.PI/2);
    add(yard2,wood,0,1.34,.06);
    add(this.sailGeometry(.7,.62),sailMat,0,.8,.07);
    add(this.sailGeometry(.46,.28),sailMat,0,1.2,.07);
    add(new THREE.SphereGeometry(.04,8,6),this.material('#f3c56b'),0,1.38,.05);
    add(new THREE.SphereGeometry(.06,8,6),this.material('#f3c56b'),0,.17,.68);
    const flagGeo=new THREE.PlaneGeometry(.3,.15); flagGeo.translate(.15,0,0); flagGeo.rotateY(Math.PI/2);
    this.flag=new THREE.Mesh(flagGeo,new THREE.MeshBasicMaterial({color:'#e0584a',side:THREE.DoubleSide}));
    this.flag.position.set(0,1.43,.05); this.ship.add(this.flag);
    const wakeGeo=new THREE.RingGeometry(.42,.56,24); wakeGeo.rotateX(-Math.PI/2);
    const wake=new THREE.Mesh(wakeGeo,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.5,depthWrite:false}));
    wake.position.y=.02; wake.scale.set(.85,1,1.7); this.ship.add(wake);
    this.ship.position.copy(this.tilePosition(this.state.player.q,this.state.player.r));
    this.ship.position.y=SHIP_Y; this.ship.rotation.y=this.heading;
    this.shipTarget=this.ship.position.clone(); this.scene.add(this.ship);
  }
  createStormEffects(){
    const positions=new Float32Array(180*6);
    this.rainGeometry=new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.rain=new THREE.LineSegments(this.rainGeometry,new THREE.LineBasicMaterial({color:'#e4f7ff',transparent:true,opacity:.62}));
    this.rain.visible=false; this.scene.add(this.rain);
    this.stormFlash=document.createElement('div'); this.stormFlash.className='storm-flash'; this.root.appendChild(this.stormFlash);
    this.sunkOverlay=document.createElement('div'); this.sunkOverlay.className='shipwreck-overlay';
    this.sunkOverlay.innerHTML='<div class="wreck-splash">〰</div><strong>TON NAVIRE A COULÉ</strong><span>La mer a englouti ton aventure…</span><button type="button">RETOUR À LA MER</button>';
    this.root.appendChild(this.sunkOverlay);
    this.sunkOverlay.querySelector('button').addEventListener('click',()=>window.location.reload());
    this.rainSeeds=Array.from({length:180},()=>({x:(Math.random()-.5)*15,z:(Math.random()-.5)*15,y:Math.random()*9,speed:5+Math.random()*5}));
  }
  createBoosterEffects(){
    this.boosterOverlay=document.createElement('div');
    this.boosterOverlay.className='booster-reveal';
    this.root.appendChild(this.boosterOverlay);
    this.boosterModel=null;
    this.boosterStartedAt=0;
  }
  showBoosterReveal(cards){
    const packCards=Array.isArray(cards)?cards:[];
    if(!packCards.length)return;
    const typeLabels={attack:'ATTAQUE',move:'NAVIGATION',heal:'SOUTIEN',blessing:'BÉNÉDICTION'};
    this.boosterOverlay.innerHTML=`
      <div class="booster-stage">
        <div class="booster-kicker">ÉDITION · LES MERS OUBLIÉES</div>
        <strong class="booster-title">NOUVEAU BOOSTER !</strong>
        <div class="booster-pack" aria-label="Booster scellé">
          <div class="booster-pack-emblem">✦</div>
          <div class="booster-pack-brand">DECK<span>2</span><br>FORTUNE</div>
          <div class="booster-pack-caption">5 CARTES À COLLECTIONNER</div>
        </div>
        <div class="booster-subtitle">Un paquet de 5 cartes t’attend…</div>
        <button class="booster-action" type="button">OUVRIR LE BOOSTER</button>
      </div>`;
    this.boosterOverlay.classList.add('visible');
    const openButton=this.boosterOverlay.querySelector('.booster-action');
    openButton.addEventListener('click',()=>{
      const pack=this.boosterOverlay.querySelector('.booster-pack');
      pack?.classList.add('opening');
      openButton.disabled=true;
      window.setTimeout(()=>showCard(0,false),560);
    },{once:true});
    const showCard=(index,revealed)=>{
      const card=packCards[index];
      const stars=card.rarity==='epic'?'★★★':card.rarity==='rare'?'★★':'★';
      const rarity=card.rarity==='epic'?'ÉPIQUE':card.rarity==='rare'?'RARE':'COMMUNE';
      const stat=card.type==='attack'?`${card.power} DÉGÂTS · PORTÉE ${card.range}`:card.type==='move'?`DÉPLACEMENT · ${card.distance} CASE${card.distance>1?'S':''}`:card.type==='blessing'?'CHANCE ×2 · 2 TOURS':`RÉPARATION · +${card.power} COQUE`;
      this.boosterOverlay.innerHTML=`
        <div class="booster-stage">
          <div class="booster-kicker">OUVERTURE DU BOOSTER</div>
          <strong class="booster-title">TA COLLECTION</strong>
          <div class="booster-card-wrap">
            <div class="booster-card ${revealed?'is-revealed':''} ${card.rarity==='epic'?'rarity-epic':card.rarity==='rare'?'rarity-rare':''}">
              <div class="booster-card-back"><strong>DECK<span style="color:#f6c75f">2</span>FORTUNE</strong><b>✦</b><small>LES MERS OUBLIÉES</small></div>
              <div class="booster-card-front ${card.rarity==='rare'?'rarity-rare':''}">
                <div class="booster-card-top"><span>${rarity}</span><span class="booster-card-stars">${stars}</span></div>
                <div class="booster-card-art">${card.image?`<img class="booster-card-art-image" src="${card.image}" alt="${card.name}">`:card.icon}</div>
                <h3>${card.name}</h3>
                <span class="booster-card-type">${typeLabels[card.type]||'CARTE'}</span>
                <p>${card.description}</p>
                <div class="booster-card-footer">${stat}</div>
                <div class="booster-card-footer">DECK2FORTUNE · COLLECTION</div>
              </div>
            </div>
          </div>
          <div class="booster-progress">${packCards.map((_,i)=>`<i class="${i<index||(i===index&&revealed)?'done':''}"></i>`).join('')}</div>
          <div class="booster-subtitle">${revealed?`Carte ${index+1}/${packCards.length} ajoutée à ta collection`:`Carte ${index+1}/${packCards.length} · découvre-la !`}</div>
          <button class="booster-action" type="button">${revealed?(index===packCards.length-1?'TERMINER':'CARTE SUIVANTE'):'RÉVÉLER LA CARTE'}</button>
        </div>`;
      const button=this.boosterOverlay.querySelector('.booster-action');
      button.addEventListener('click',()=>{
        if(!revealed){showCard(index,true);return;}
        if(index<packCards.length-1){showCard(index+1,false);return;}
        this.boosterOverlay.classList.remove('visible');
      });
    };
  }
  syncShipToPlayer(){
    const destination=this.tilePosition(this.state.player.q,this.state.player.r);
    const direction=destination.clone().sub(this.shipTarget);
    if(direction.lengthSq()>.001)this.heading=Math.atan2(direction.x,direction.z);
    this.shipTarget.copy(destination);
    // A ship movement recenters the camera; manual panning is temporary.
    this.cameraPanOffset.set(0,0,0);
    this.updateHighlights();
  }
  resetWorld(){
    for(const group of this.chunks.values()){this.scene.remove(group);this.disposeChunk(group);}
    this.chunks.clear();this.tiles=[];this.tileByKey.clear();this.foams=[];this.smokes=[];this.cloudGroups=[];this.chunkCenter=null;this.releaseAllArchipelagos();
    this.target.set(0,0,0);this.cameraPanOffset.set(0,0,0);this.shipTarget.copy(this.tilePosition(0,0));this.ship.position.copy(this.shipTarget);this.ship.position.y=SHIP_Y;this.ship.rotation.set(0,0,0);this.ship.scale.setScalar(1);this.heading=0;this.sinkingStartedAt=null;this.sunkOverlay.classList.remove('visible');this.state.camera={x:0,z:0};this.updateChunks(true);this.updateHighlights();this.updateCamera();
  }
  createHighlights(){
    this.highlightGroup=new THREE.Group(); this.scene.add(this.highlightGroup);
    this.hlRingGeo=this.flatHex(new THREE.RingGeometry(HEX_SIZE*.80,HEX_SIZE*.94,6,1));
    this.hlFillGeo=this.flatHex(new THREE.CircleGeometry(HEX_SIZE*.94,6));
    this.hlRingMat=new THREE.MeshBasicMaterial({color:'#fff3b0',transparent:true,opacity:.9,depthWrite:false});
    this.hlFillMat=new THREE.MeshBasicMaterial({color:'#ffe38a',transparent:true,opacity:.25,depthWrite:false});
  }
  updateHighlights(){
    this.highlightGroup.clear();
    const p=this.state.player;
    for(const [dq,dr] of DIRECTIONS){
      const q=p.q+dq,r=p.r+dr;
      if(!this.tileByKey.has(this.key(q,r)))continue;
      const pos=this.tilePosition(q,r);
      const fill=new THREE.Mesh(this.hlFillGeo,this.hlFillMat); fill.position.set(pos.x,-.165,pos.z);
      const ring=new THREE.Mesh(this.hlRingGeo,this.hlRingMat); ring.position.set(pos.x,-.16,pos.z);
      this.highlightGroup.add(fill,ring);
    }
  }
  setHome(value){
    this.home=value;
    this.viewHeight=value?16:VIEW_HEIGHT;
    if(!value){this.target.copy(this.ship.position).add(this.cameraPanOffset);this.target.y=0;this.updateChunks();this.updateCamera();}
    this.resize();
  }
  pointerDown(e){
    if(e.button!==0||this.home)return;
    e.preventDefault();
    this.drag={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
    this.renderer.domElement.setPointerCapture?.(e.pointerId);
  }
  pointerMove(e){
    if(!this.drag||this.home||e.pointerId!==this.drag.pointerId)return;
    const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;
    if(Math.hypot(e.clientX-this.drag.startX,e.clientY-this.drag.startY)>5)this.drag.moved=true;
    if(this.drag.moved){
      const scale=this.viewHeight/Math.max(1,this.renderer.domElement.clientHeight);
      // Move the camera opposite to the pointer in camera screen-space,
      // so the ocean/map follows the drag naturally in every direction.
      this.camera.updateMatrixWorld(true);
      const right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0);
      const up=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
      right.y=0;up.y=0;
      if(right.lengthSq()>0)right.normalize();
      if(up.lengthSq()>0)up.normalize();
      this.cameraPanOffset.addScaledVector(right,-dx*scale);
      this.cameraPanOffset.addScaledVector(up,dy*scale);
      this.target.copy(this.ship.position).add(this.cameraPanOffset);this.target.y=0;
      this.state.camera={x:this.target.x,z:this.target.z};
      this.state.saveProgress();this.updateChunks();this.updateHighlights();this.updateCamera();
    }
    this.drag.lastX=e.clientX;this.drag.lastY=e.clientY;
  }
  pointerUp(e){
    if(!this.drag||e.pointerId!==this.drag.pointerId)return;
    const moved=this.drag.moved;this.drag=null;
    if(this.renderer.domElement.hasPointerCapture?.(e.pointerId))this.renderer.domElement.releasePointerCapture(e.pointerId);
    if(!moved&&!this.home)this.tap(e);
  }
  tap(e){
    if(this.state.inCombat)return;
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height*2-1));
    this.ray.setFromCamera(this.pointer,this.camera);
    const hit=this.ray.intersectObjects(this.tiles,false)[0];if(!hit)return;
    const tile=hit.object.userData.tile;
    const pl=this.state.player,og=tile.archipelagoOrigin;
    const reachable=hexDistance(tile,pl)<=1||(tile.kind==='archipelago'&&og?.shape?.some(([dq,dr])=>hexDistance({q:og.q+dq,r:og.r+dr},pl)<=1));
    if(!reachable)return;
    if(tile.kind==='sea'||tile.kind==='storm'){
      if(this.state.sunk)return;
      const from=this.shipTarget.clone();
      this.state.player={q:tile.q,r:tile.r};
      this.shipTarget.copy(this.tilePosition(tile.q,tile.r));
      // Smoothly return to the default ship-centered view after navigation.
      this.cameraPanOffset.set(0,0,0);
      this.state.camera={x:this.target.x,z:this.target.z};
      const d=this.shipTarget.clone().sub(from);
      if(d.lengthSq()>.01)this.heading=Math.atan2(d.x,d.z);
      this.state.explore();
      this.updateHighlights();
      if(tile.kind==='storm'){
        this.state.enterStorm();
        window.dispatchEvent(new CustomEvent('pirate-toast',{detail:'TEMPÊTE ! La coque subit des dégâts tant que tu restes dans l’orage !'}));
      }else{
        this.state.leaveStorm();
        window.dispatchEvent(new CustomEvent('pirate-toast',{detail:'Navigation réussie !'}));
      }
      if(!this.state.inCombat&&hexDistance(this.state.player,this.state.enemy)<=1){
        this.state.startCombat();
        window.dispatchEvent(new CustomEvent('pirate-toast',{detail:'Un corsaire des brumes approche ! Prépare tes cartes !'}));
      }
    }else{
      const origin=tile.archipelagoOrigin,rewardKey=this.key(tile.q,tile.r);
      const isPort=tile.kind==='archipelago'&&origin?.comptoir;
      if(isPort){
        window.dispatchEvent(new CustomEvent('pirate-comptoir'));
        if(!this.state.visited.has(rewardKey)){this.state.visited.add(rewardKey);const treasure=rollTreasure('archipelago');if(treasure){this.state.addTreasure(treasure);window.dispatchEvent(new CustomEvent('pirate-toast',{detail:`Trésor découvert : ${treasure.icon} ${treasure.name} !`}));}}
      }else if(!this.state.visited.has(rewardKey)){
        this.state.visited.add(rewardKey);
        const treasure=rollTreasure(tile.kind);
        if(treasure){this.state.addTreasure(treasure);window.dispatchEvent(new CustomEvent('pirate-toast',{detail:`Trésor découvert : ${treasure.icon} ${treasure.name} !`}));}
      }
    }
    this.state.emit();
  }
  updateCamera(){this.camera.position.copy(this.target).add(this.cameraOffset);this.camera.lookAt(this.target);}
  resize(){
    const w=this.root.clientWidth,h=this.root.clientHeight;if(!w||!h)return;
    const aspect=w/h,halfH=this.viewHeight/2,halfW=halfH*aspect;
    this.camera.left=-halfW;this.camera.right=halfW;this.camera.top=halfH;this.camera.bottom=-halfH;
    this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.updateCamera();
  }
  animateStorm(t,dt){
    const active=this.state.inStorm&&!this.state.sunk;
    this.rain.visible=active; this.root.classList.toggle('storm-active',active);
    if(active){
      const pos=this.ship.position,arr=this.rain.geometry.attributes.position.array;
      for(let i=0;i<this.rainSeeds.length;i++){
        const seed=this.rainSeeds[i],j=i*6; seed.y-=seed.speed*dt;
        if(seed.y<-.3){seed.y=6+Math.random()*3;seed.x=(Math.random()-.5)*15;seed.z=(Math.random()-.5)*15;}
        arr[j]=pos.x+seed.x;arr[j+1]=seed.y;arr[j+2]=pos.z+seed.z;
        arr[j+3]=pos.x+seed.x-.12;arr[j+4]=seed.y-.42;arr[j+5]=pos.z+seed.z+.08;
      }
      this.rain.geometry.attributes.position.needsUpdate=true;
      this.stormDamageAccumulator+=dt;
      if(this.stormDamageAccumulator>=.25){const elapsed=this.stormDamageAccumulator;this.stormDamageAccumulator=0;this.state.damageHull(this.state.stormDamageRate*elapsed);}
      if(t-this.lastLightning>4.5){this.lastLightning=t;this.stormFlash.classList.remove('flash');void this.stormFlash.offsetWidth;this.stormFlash.classList.add('flash');}
      this.ship.rotation.x=Math.sin(t*6.5)*.045; this.ship.rotation.z=Math.sin(t*8)*.025;
    }else{this.stormDamageAccumulator=0;this.ship.rotation.x+=(Math.sin(t*1.1)*.025-this.ship.rotation.x)*.04;}
  }
  animateSinking(t){
    if(!this.state.sunk)return;
    if(this.sinkingStartedAt===null)this.sinkingStartedAt=t;
    const p=Math.min(1,(t-this.sinkingStartedAt)/3.4);
    this.ship.position.y=SHIP_Y-p*2.3; this.ship.rotation.z+=(-.8-this.ship.rotation.z)*.025;
    this.ship.rotation.x+=(.55-this.ship.rotation.x)*.025; this.ship.rotation.y+=.012;
    this.ship.scale.setScalar(Math.max(.35,1-p*.65));
    if(p>=1)this.sunkOverlay.classList.add('visible');
  }
  animateWorld(t){
    const a=this.ocean.geometry.attributes.position,b=this.oceanBase;
    for(let i=0;i<a.count;i++){const x=b[i*3],z=b[i*3+2];a.array[i*3+1]=Math.sin(x*.55+t*.9)*.055+Math.cos(z*.7+t*.7)*.045;}
    a.needsUpdate=true;
    for(const c of this.crests){const s=Math.sin(t*.8+c.userData.phase);c.material.opacity=.14+.12*s;c.position.y=-.3+s*.01;}
    this.foamMat.opacity=.5+.15*Math.sin(t*1.5);
    for(const f of this.foams)f.scale.setScalar(1+.03*Math.sin(t*1.5+f.userData.phase));
    for(const c of this.cloudGroups){
      const p=c.userData.phase;
      c.position.y=.62+Math.sin(t*.9+p)*.04; c.position.x=Math.sin(t*.3+p)*.06;
      c.userData.bolt.visible=((t+p)%4.5)<.14;
    }
    for(const s of this.smokes){
      const u=(t*.25+s.userData.phase)%1;
      s.position.set(Math.sin(u*5)*.05,.95+u*.8,0); s.scale.setScalar(.7+u*1.3); s.material.opacity=.75*(1-u);
    }
    this.flag.rotation.y=Math.sin(t*4)*.25;
  }
  loop(){
    this.frame=requestAnimationFrame(this.loop);const t=performance.now()*.001;
    const dt=this.lastFrameTime?Math.min(.05,t-this.lastFrameTime):0;this.lastFrameTime=t;
    const sp=this.ship.position;
    sp.x+=(this.shipTarget.x-sp.x)*.075; sp.z+=(this.shipTarget.z-sp.z)*.075;
    if(!this.home){
      const followTarget=new THREE.Vector3(sp.x+this.cameraPanOffset.x,0,sp.z+this.cameraPanOffset.z);
      this.target.lerp(followTarget,.14);
      this.state.camera={x:this.target.x,z:this.target.z};
    }
    if((this.state.revealedClouds?.size||0)!==this.lastRevealCount){this.lastRevealCount=this.state.revealedClouds.size;this.chunkCenter=null;this.updateChunks(true);this.updateHighlights();}
    if(!this.home)this.updateChunks();
    this.ocean.position.x=this.target.x; this.ocean.position.z=this.target.z;
    if(!this.state.sunk)sp.y=SHIP_Y+Math.sin(t*1.7)*.03;
    let dh=this.heading-this.ship.rotation.y; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); this.ship.rotation.y+=dh*.12;
    this.ship.rotation.z=Math.sin(t*.8)*.03; this.ship.rotation.x=Math.sin(t*1.1)*.025;
    this.animateWorld(t);this.animateStorm(t,dt);this.animateSinking(t);
    if(this.home){this.target.x=this.state.camera.x||0;this.target.z=this.state.camera.z||0;}
    this.updateCamera();
    this.renderer.render(this.scene,this.camera);
  }
}
