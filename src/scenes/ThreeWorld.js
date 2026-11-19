import * as THREE from 'three';
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
    this.crests=[]; this.foams=[]; this.smokes=[]; this.cloudGroups=[]; this.heading=0;
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
    this.updateChunks(true);
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
        if(data.kind==='archipelago'&&data.archipelagoOrigin?.q===q&&data.archipelagoOrigin?.r===r)this.addArchipelago(tileGroup,data);
        if(data.kind==='volcano')this.addVolcano(tileGroup,data);
        if(data.kind==='storm')this.addCloud(tileGroup,data);
        group.add(tileGroup);
      }
      group.userData.chunkKey=key;this.chunks.set(key,group);this.scene.add(group);
    }
    for(const [key,group] of this.chunks){
      if(wanted.has(key))continue;
      this.scene.remove(group);this.disposeChunk(group);this.chunks.delete(key);
      for(const base of this.tiles){const tile=base.userData.tile;if(Math.floor(tile.q/CHUNK_SIZE)+','+Math.floor(tile.r/CHUNK_SIZE)===key)this.tileByKey.delete(this.key(tile.q,tile.r));}
      this.tiles=this.tiles.filter(base=>{const tile=base.userData.tile;return Math.floor(tile.q/CHUNK_SIZE)+','+Math.floor(tile.r/CHUNK_SIZE)!==key;});
      const removed=new Set();group.traverse(obj=>removed.add(obj));this.foams=this.foams.filter(obj=>!removed.has(obj));this.smokes=this.smokes.filter(obj=>!removed.has(obj));this.cloudGroups=this.cloudGroups.filter(obj=>!removed.has(obj));
    }
  }
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
  addArchipelago(group,tile){
    // Côte organique volontairement en retrait : l'île ne touche jamais les bords des hexagones.
    const cells=tile.archipelagoOrigin?.shape?.length?tile.archipelagoOrigin.shape:[[0,0],[1,0],[0,1]];
    const edgeMap=new Map();
    const vertexKey=p=>p.map(v=>Math.round(v*10000)/10000).join(',');
    const addEdge=(a,b)=>{
      const ka=vertexKey(a),kb=vertexKey(b),key=ka<kb?ka+'|'+kb:kb+'|'+ka;
      if(edgeMap.has(key))edgeMap.delete(key);else edgeMap.set(key,{a,b});
    };
    for(const [q,r] of cells){
      const cx=HEX_SIZE*Math.sqrt(3)*(q+r/2),cz=HEX_SIZE*1.5*r;
      const vertices=[];
      for(let i=0;i<6;i++){
        const angle=i*Math.PI/3+Math.PI/6;
        vertices.push([cx+Math.cos(angle)*HEX_SIZE,cz+Math.sin(angle)*HEX_SIZE]);
      }
      for(let i=0;i<6;i++)addEdge(vertices[i],vertices[(i+1)%6]);
    }
    const edges=[...edgeMap.values()],chains=[];
    while(edges.length){
      const chain=[edges[0].a,edges[0].b];edges.splice(0,1);
      while(vertexKey(chain[chain.length-1])!==vertexKey(chain[0])){
        const last=vertexKey(chain[chain.length-1]);
        const index=edges.findIndex(e=>vertexKey(e.a)===last||vertexKey(e.b)===last);
        if(index<0)break;
        const edge=edges.splice(index,1)[0];
        chain.push(vertexKey(edge.a)===last?edge.b:edge.a);
      }
      if(chain.length>=4)chains.push(chain.slice(0,-1));
    }
    const outline=chains.sort((a,b)=>b.length-a.length)[0]||[[-1,-1],[1,-1],[1,1],[-1,1]];
    // Silhouette en vrais segments : on conserve les facettes hexagonales low-poly.
    const roundedShape=(scale)=>{
      const points=outline.map(([x,z])=>[x*scale,z*scale]);
      const shape=new THREE.Shape();
      shape.moveTo(points[0][0],points[0][1]);
      for(let i=1;i<points.length;i++)shape.lineTo(points[i][0],points[i][1]);
      shape.closePath();
      return shape;
    };
    const land=new THREE.Group();group.add(land);
    const extrude=(shape,depth,bevelSize,bevelThickness)=>{
      const geo=new THREE.ExtrudeGeometry(shape,{
        depth,bevelEnabled:true,bevelSegments:5,steps:1,
        bevelSize,bevelThickness,curveSegments:10
      });
      geo.rotateX(-Math.PI/2);
      return geo;
    };
    // Plage en pente : une base basse et très biseautée évite l'effet de falaise.
    // Le bevel déborde légèrement du contour dessiné et forme une vraie transition vers l'eau.
    const sandGeo=extrude(roundedShape(.68),.10,.15,.09);
    const sand=new THREE.Mesh(sandGeo,this.material('#efd39a'));
    sand.position.y=-.16;sand.castShadow=true;sand.receiveShadow=true;land.add(sand);
    const grassGeo=extrude(roundedShape(.59),.075,.12,.065);
    const grass=new THREE.Mesh(grassGeo,this.material('#79bd70'));
    grass.position.y=.015;grass.castShadow=true;grass.receiveShadow=true;land.add(grass);

    // Écume qui entoure toute la côte (et non un simple anneau hexagonal).
    // Elle est animée avec les autres effets d'eau dans animateWorld().
    const shoreline=roundedShape(.99);
    const innerPoints=roundedShape(.82).getPoints(16);
    const innerPath=new THREE.Path();
    innerPath.moveTo(innerPoints[0].x,innerPoints[0].y);
    for(let i=1;i<innerPoints.length;i++)innerPath.lineTo(innerPoints[i].x,innerPoints[i].y);
    innerPath.closePath();
    shoreline.holes.push(innerPath);
    const foamGeo=new THREE.ShapeGeometry(shoreline,1);
    foamGeo.rotateX(-Math.PI/2);
    const foam=new THREE.Mesh(foamGeo,this.foamMat);
    foam.position.y=-.165;
    foam.userData.phase=tile.q+tile.r*.7;
    group.add(foam);
    this.foams.push(foam);

    // Quelques bosses de terrain arrondies donnent du volume sans créer de murs.
    const hillMat=this.material('#68b96d');
    const hill=(x,z,sx,sy,sz)=>{
      const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),hillMat);
      mesh.position.set(x,.22,z);mesh.scale.set(sx,sy,sz);
      mesh.castShadow=true;mesh.receiveShadow=true;land.add(mesh);
    };
    hill(-.48,-.12,.92,.22,.68);
    hill(.48,.38,.68,.17,.58);
    hill(.02,-.58,.58,.13,.43);

    // Les constructions sont plus petites et regroupées au centre pour rester dans la côte.
    const decor=new THREE.Group();
    const randomA=Math.abs(Math.sin(tile.q*127.1+tile.r*311.7)*43758.5453)%1;
    const randomB=Math.abs(Math.sin(tile.q*269.5+tile.r*183.3+17)*24634.6345)%1;
    decor.scale.setScalar(.54+randomA*.06);
    decor.rotation.y=randomB*Math.PI*2;
    decor.position.set((randomA-.5)*.12,0,(randomB-.5)*.12);
    land.add(decor);
    const prop=(geo,mat,x,y,z,sx=1,sy=1,sz=1)=>{
      const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);
      m.castShadow=true;m.receiveShadow=true;decor.add(m);return m;
    };
    const wood=this.material('#93603d',true),darkWood=this.material('#68442f',true);
    const roof=this.material('#b85e43',true),cream=this.material('#f5dfb2',true);
    const glass=this.material('#b9e8e4',true);
    const cabin=(x,z,s=1)=>{
      const y=.27;
      prop(new THREE.BoxGeometry(.62,.42,.54),wood,x,y+.21,z,s,s,s);
      const top=prop(new THREE.ConeGeometry(.49,.36,4),roof,x,y+.60,z,s,s,s);
      top.rotation.y=Math.PI/4;
      prop(new THREE.BoxGeometry(.12,.24,.025),darkWood,x,y+.12,z+.275*s,s,s,s);
      prop(new THREE.BoxGeometry(.12,.12,.025),glass,x-.18*s,y+.27,z+.275*s,s,s,s);
    };
    cabin(-.82,-.28,.9);
    cabin(.78,.48,.72);
    // Petit ponton court, sans pièces qui flottent au-delà de l'île.
    prop(new THREE.BoxGeometry(.28,.08,.48),wood,.05,.22,1.28);
    for(const x of [-.13,.13])for(const z of [1.12,1.44]){
      prop(new THREE.CylinderGeometry(.035,.045,.28,6),darkWood,x,.12,z);
    }
    this.addPalm(decor,-1.28,.68,.22,.25);
    this.addPalm(decor,1.25,-.72,.20,.25);
    // Contour discret et arrondi, aligné sur la vraie géométrie de l'île.
    const coastPoints=roundedShape(.84).getPoints(12).map(p=>new THREE.Vector3(p.x,.025,p.y));
    const coastGeo=new THREE.BufferGeometry().setFromPoints(coastPoints);
    const coast=new THREE.LineLoop(coastGeo,new THREE.LineBasicMaterial({color:'#fff0c8',transparent:true,opacity:.38}));
    land.add(coast);
    land.rotation.y=(((tile.q*5+tile.r*3)%6)+6)%6*Math.PI/3;
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
    this.chunks.clear();this.tiles=[];this.tileByKey.clear();this.foams=[];this.smokes=[];this.cloudGroups=[];this.chunkCenter=null;
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
    if(hexDistance(tile,this.state.player)>1)return;
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
      const message=tile.kind==='island'||tile.kind==='archipelago'?'Île découverte : +5 or !':'Volcan découvert : +12 or !';
      const rewardKey=this.key(tile.q,tile.r);
      if(!this.state.visited.has(rewardKey)){if(tile.kind==='island'||tile.kind==='archipelago')this.state.gold+=5;if(tile.kind==='volcano')this.state.gold+=12;this.state.visited.add(rewardKey);}
      window.dispatchEvent(new CustomEvent('pirate-toast',{detail:message}));
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
    this.updateChunks(); this.ocean.position.x=this.target.x; this.ocean.position.z=this.target.z;
    if(!this.state.sunk)sp.y=SHIP_Y+Math.sin(t*1.7)*.03;
    let dh=this.heading-this.ship.rotation.y; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); this.ship.rotation.y+=dh*.12;
    this.ship.rotation.z=Math.sin(t*.8)*.03; this.ship.rotation.x=Math.sin(t*1.1)*.025;
    this.animateWorld(t);this.animateStorm(t,dt);this.animateSinking(t);
    if(this.home){this.target.x=this.state.camera.x||0;this.target.z=this.state.camera.z||0;}
    this.updateCamera();
    this.renderer.render(this.scene,this.camera);
  }
}
