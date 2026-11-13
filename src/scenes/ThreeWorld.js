import * as THREE from 'three';
import { makeTile, axialToPixel, hexDistance, DIRECTIONS } from '../systems/HexGrid.js';

const CHUNK_SIZE=8;
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
    this.drag=null; this.target=new THREE.Vector3(state.camera?.x||0,0,state.camera?.z||0); this.chunks=new Map();
    this.crests=[]; this.foams=[]; this.smokes=[]; this.cloudGroups=[]; this.heading=0;
    this.stormDamageAccumulator=0; this.lastFrameTime=0; this.sinkingStartedAt=null; this.lastLightning=0;
    this.toonGradient=this.makeToonGradient();
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color('#4fb9c6');
    this.camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,120);
    this.cameraOffset=new THREE.Vector3(9,17,9);
    this.viewHeight=VIEW_HEIGHT;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure=1;
    this.renderer.domElement.style.touchAction='none';
    root.appendChild(this.renderer.domElement);
    this.addLights(); this.createOcean(); this.createMap(); this.createShip(); this.createStormEffects();
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
    sun.shadow.mapSize.set(1024,1024);
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
    this.islandGeo={sand:new THREE.CylinderGeometry(.72,.84,.26,10),grass:new THREE.CylinderGeometry(.50,.64,.14,9),hill:new THREE.SphereGeometry(.40,8,5),rock:new THREE.DodecahedronGeometry(.09,0),leaf:leafGeo};
    this.foamGeo=new THREE.RingGeometry(.80,.93,28);this.foamGeo.rotateX(-Math.PI/2);
    this.foamMat=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.6,depthWrite:false});
    this.cloudShadowGeo=new THREE.CircleGeometry(.72,28);this.cloudShadowGeo.rotateX(-Math.PI/2);
    this.cloudShadowMat=new THREE.MeshBasicMaterial({map:this.softShadowTexture(),transparent:true,depthWrite:false});
    this.updateChunks(true);
  }
  updateChunks(force=false){
    const qCenter=(Math.sqrt(3)/3*this.target.x-this.target.z/3)/HEX_SIZE;
    const rCenter=(2/3*this.target.z)/HEX_SIZE;
    const cq=Math.floor(qCenter/CHUNK_SIZE),cr=Math.floor(rCenter/CHUNK_SIZE);
    const wanted=new Set();
    for(let x=-CHUNK_RADIUS;x<=CHUNK_RADIUS;x++)for(let z=-CHUNK_RADIUS;z<=CHUNK_RADIUS;z++){
      const key=(cq+x)+','+(cr+z);wanted.add(key);
      if(this.chunks.has(key))continue;
      const group=new THREE.Group(),[chunkQ,chunkR]=key.split(',').map(Number);
      for(let q=chunkQ*CHUNK_SIZE;q<(chunkQ+1)*CHUNK_SIZE;q++)for(let r=chunkR*CHUNK_SIZE;r<(chunkR+1)*CHUNK_SIZE;r++){
        const data=makeTile(this.state.seed,q,r),pos=this.tilePosition(q,r),tileGroup=new THREE.Group();tileGroup.position.copy(pos);
        const base=new THREE.Mesh(this.baseGeo,this.waterMat);base.position.y=-.29;base.receiveShadow=true;base.userData.tile=data;tileGroup.add(base);
        this.tiles.push(base);this.tileByKey.set(this.key(q,r),{data,group:tileGroup,base});
        const ring=new THREE.Mesh(this.ringGeo,this.ringMat);ring.position.y=-.175;tileGroup.add(ring);
        if(data.kind==='island')this.addIsland(tileGroup,data);
        if(data.kind==='volcano')this.addVolcano(tileGroup,data);
        if(data.kind==='storm')this.addCloud(tileGroup,data);
        group.add(tileGroup);
      }
      group.userData.chunkKey=key;this.chunks.set(key,group);this.scene.add(group);
    }
    for(const [key,group] of this.chunks){
      if(wanted.has(key))continue;
      this.scene.remove(group);this.chunks.delete(key);
      for(const base of this.tiles){const tile=base.userData.tile;if(Math.floor(tile.q/CHUNK_SIZE)+','+Math.floor(tile.r/CHUNK_SIZE)===key)this.tileByKey.delete(this.key(tile.q,tile.r));}
      this.tiles=this.tiles.filter(base=>{const tile=base.userData.tile;return Math.floor(tile.q/CHUNK_SIZE)+','+Math.floor(tile.r/CHUNK_SIZE)!==key;});
      group.traverse(obj=>{if(obj.isMesh){obj.geometry.dispose?.();}});
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
    const cloud=new THREE.Group(); cloud.position.y=.62; cloud.userData.phase=tile.q*.9+tile.r*1.7; group.add(cloud);
    for(const [x,y,z,s] of [[-.30,0,.02,.30],[0,.12,0,.40],[.32,0,-.02,.30],[.08,-.02,.22,.26],[-.12,0,-.20,.24]]){
      const puff=new THREE.Mesh(new THREE.SphereGeometry(s,12,9),this.material(y>.05?'#ffffff':'#dbe3ef'));
      puff.scale.y=.75; puff.position.set(x,y,z); cloud.add(puff);
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
    if(!value){this.target.set(this.state.camera.x||0,0,this.state.camera.z||0);this.updateChunks();}
    this.resize();
  }
  pointerDown(e){this.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};this.renderer.domElement.setPointerCapture?.(e.pointerId);}
  pointerMove(e){
    if(!this.drag||this.home)return;
    const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;
    if(Math.abs(e.clientX-this.drag.x)+Math.abs(e.clientY-this.drag.y)>7)this.drag.moved=true;
    if(this.drag.moved){
      const scale=this.viewHeight/Math.max(1,this.renderer.domElement.clientHeight);
      this.target.x-=dx*scale*.72; this.target.z+=dy*scale*.72; this.state.camera={x:this.target.x,z:this.target.z}; this.state.saveProgress(); this.updateChunks(); this.updateHighlights(); this.updateCamera();
    }
    this.drag.lastX=e.clientX;this.drag.lastY=e.clientY;
  }
  pointerUp(e){
    if(!this.drag)return;const moved=this.drag.moved;this.drag=null;
    if(!moved&&!this.home)this.tap(e);
  }
  tap(e){
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
    }else{
      const message=tile.kind==='island'?'Île découverte : +5 or !':'Volcan découvert : +12 or !';
      const rewardKey=this.key(tile.q,tile.r);
      if(!this.state.visited.has(rewardKey)){if(tile.kind==='island')this.state.gold+=5;if(tile.kind==='volcano')this.state.gold+=12;this.state.visited.add(rewardKey);}
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
    this.updateChunks(); this.ocean.position.x=this.target.x; this.ocean.position.z=this.target.z;
    const sp=this.ship.position;
    sp.x+=(this.shipTarget.x-sp.x)*.075; sp.z+=(this.shipTarget.z-sp.z)*.075;
    if(!this.state.sunk)sp.y=SHIP_Y+Math.sin(t*1.7)*.03;
    let dh=this.heading-this.ship.rotation.y; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); this.ship.rotation.y+=dh*.12;
    this.ship.rotation.z=Math.sin(t*.8)*.03; this.ship.rotation.x=Math.sin(t*1.1)*.025;
    this.animateWorld(t);this.animateStorm(t,dt);this.animateSinking(t);
    if(this.home){this.target.x=this.state.camera.x||0;this.target.z=this.state.camera.z||0;this.updateCamera();}
    this.renderer.render(this.scene,this.camera);
  }
}
