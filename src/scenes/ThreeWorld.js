import * as THREE from 'three';
import { makeIslandMap, axialToPixel, hexDistance, DIRECTIONS } from '../systems/HexGrid.js';

const MAP_RADIUS = 7;
const HEX_SIZE = 1.12;
const VIEW_HEIGHT = 13.8;

export class ThreeWorld {
  constructor(root, state) {
    this.root=root; this.state=state; this.home=true;
    this.tiles=[]; this.tileByKey=new Map(); this.highlightMeshes=[];
    this.ray=new THREE.Raycaster(); this.pointer=new THREE.Vector2();
    this.drag=null; this.target=new THREE.Vector3(0,0,0);
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color('#63c7c7');
    this.camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,120);
    this.cameraOffset=new THREE.Vector3(9,17,9);
    this.viewHeight=VIEW_HEIGHT;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.18;
    this.renderer.domElement.style.touchAction='none';
    root.appendChild(this.renderer.domElement);
    this.addLights(); this.createOcean(); this.createMap(); this.createShip();
    this.createHighlights(); this.updateHighlights(); this.resize();
    window.addEventListener('resize',()=>this.resize());
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
    canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    canvas.addEventListener('pointerup',e=>this.pointerUp(e));
    canvas.addEventListener('pointercancel',()=>{this.drag=null;});
    this.loop=this.loop.bind(this); this.frame=requestAnimationFrame(this.loop);
  }
  material(color,roughness=.88,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
  addLights(){
    this.scene.add(new THREE.HemisphereLight(0xe8ffff,0x6b765f,2.1));
    const sun=new THREE.DirectionalLight(0xffedc9,2.7);
    sun.position.set(-8,18,11); sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    sun.shadow.camera.left=-22; sun.shadow.camera.right=22;
    sun.shadow.camera.top=22; sun.shadow.camera.bottom=-22;
    sun.shadow.bias=-.00025; this.scene.add(sun);
  }
  createOcean(){
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(120,120),this.material('#48b9c1',.34,.04));
    ocean.rotation.x=-Math.PI/2; ocean.position.y=-.42; ocean.receiveShadow=true;
    this.scene.add(ocean);
    // Gentle, sparse current strokes; the playable hex grid is drawn per tile below.
    for(let i=0;i<24;i++){
      const x=((i*7)%19-9)*1.7, z=((i*11)%17-8)*1.8;
      const curve=new THREE.EllipseCurve(x,z,.52+(i%3)*.2,.09,0,Math.PI*1.55,false,0);
      const pts=curve.getPoints(24).map(p=>new THREE.Vector3(p.x,-.405,p.y));
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({color:'#d9ffff',transparent:true,opacity:.12})));
    }
  }
  tilePosition(q,r){
    const p=axialToPixel(q,r,HEX_SIZE);
    return new THREE.Vector3(p.x*.88,0,p.y*.88);
  }
  makeHexOutline(){
    const points=[];
    for(let i=0;i<6;i++){
      const a=Math.PI/6+i*Math.PI/3;
      points.push(new THREE.Vector3(Math.cos(a)*HEX_SIZE*.99,-.345,Math.sin(a)*HEX_SIZE*.99));
    }
    const geo=new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineLoop(geo,new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.25}));
  }
  createMap(){
    const baseGeo=new THREE.CylinderGeometry(HEX_SIZE*.98,HEX_SIZE*.98,.20,6,1);
    baseGeo.rotateY(Math.PI/6);
    const sandGeo=new THREE.CylinderGeometry(.88,.94,.13,6,1); sandGeo.rotateY(Math.PI/6);
    const grassGeo=new THREE.CylinderGeometry(.77,.84,.13,6,1); grassGeo.rotateY(Math.PI/6);
    const waterMat=this.material('#55bdc1',.48,.02);
    for(const data of makeIslandMap(MAP_RADIUS)){
      const pos=this.tilePosition(data.q,data.r), group=new THREE.Group();
      group.position.copy(pos);
      const base=new THREE.Mesh(baseGeo,waterMat);
      base.position.y=-.29; base.receiveShadow=true;
      base.userData.tile=data; group.add(base); this.tiles.push(base);
      this.tileByKey.set(this.key(data.q,data.r),{data,group,base});
      group.add(this.makeHexOutline());
      if(data.kind==='island') this.addIsland(group,sandGeo,grassGeo);
      if(data.kind==='volcano') this.addVolcano(group,sandGeo);
      if(data.kind==='storm') this.addCloud(group);
      this.scene.add(group);
    }
  }
  key(q,r){return q+','+r;}
  addIsland(group,sandGeo,grassGeo){
    const sand=new THREE.Mesh(sandGeo,this.material('#f0d59a'));
    sand.position.y=.08; sand.castShadow=true; sand.receiveShadow=true; group.add(sand);
    const grass=new THREE.Mesh(grassGeo,this.material('#79bd70'));
    grass.position.y=.19; grass.castShadow=true; group.add(grass);
    this.addPalm(group,-.20,-.08,.78);
    // Keep foliage inside the island footprint.
  }
  addPalm(group,x,z,s){
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.045*s,.07*s,.62*s,7),this.material('#a8754b'));
    trunk.position.set(x,.54*s,z); trunk.rotation.z=-.12; trunk.castShadow=true; group.add(trunk);
    const crownY=.88*s;
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      const leaf=new THREE.Mesh(new THREE.SphereGeometry(.29*s,8,6),
        this.material(i%2?'#4d9d59':'#69b967'));
      leaf.scale.set(1,.22,.42);
      leaf.position.set(x+Math.cos(a)*.22*s,crownY,z+Math.sin(a)*.22*s);
      leaf.rotation.y=-a; leaf.castShadow=true; group.add(leaf);
    }
    const crown=new THREE.Mesh(new THREE.SphereGeometry(.10*s,7,6),this.material('#b68a50'));
    crown.position.set(x,crownY,z); group.add(crown);
  }
  addVolcano(group,sandGeo){
    const rim=new THREE.Mesh(sandGeo,this.material('#d9bd88'));
    rim.position.y=.08; group.add(rim);
    const mountain=new THREE.Mesh(new THREE.ConeGeometry(.67,1.05,8),this.material('#6e7770'));
    mountain.position.y=.65; mountain.castShadow=true; group.add(mountain);
    const lava=new THREE.Mesh(new THREE.CircleGeometry(.16,9),new THREE.MeshBasicMaterial({color:'#ff9a58'}));
    lava.rotation.x=-Math.PI/2; lava.position.y=1.18; group.add(lava);
  }
  addCloud(group){
    // Clouds float above a normal turquoise water tile: no grey hex platform.
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(.50,24),
      new THREE.MeshBasicMaterial({color:'#236f78',transparent:true,opacity:.14,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2; shadow.position.set(0,-.385,0); shadow.scale.set(1,.66,1); group.add(shadow);
    const white=this.material('#fffdf2',.98);
    for(const [x,y,z,s] of [[-.25,.55,0,.28],[0,.68,0,.36],[.28,.54,0,.27],[.10,.49,.18,.25]]){
      const puff=new THREE.Mesh(new THREE.SphereGeometry(s,12,9),white);
      puff.scale.y=.72; puff.position.set(x,y,z); puff.castShadow=true; group.add(puff);
    }
  }
  createShip(){
    this.ship=new THREE.Group();
    const wood=this.material('#b77a45'),trim=this.material('#e7b86d'),sailMat=new THREE.MeshStandardMaterial({color:'#fff8e9',roughness:.9,side:THREE.DoubleSide});
    // Elongated hull with a raised bow and stern, aligned along local Z.
    const hull=new THREE.Mesh(new THREE.CapsuleGeometry(.24,.72,4,9),wood);
    hull.rotation.x=Math.PI/2; hull.scale.set(1,.72,1);
    hull.position.y=.12; hull.castShadow=true; this.ship.add(hull);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(.43,.10,1.15),trim);
    deck.position.y=.28; deck.castShadow=true; this.ship.add(deck);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.98,8),this.material('#8c5b37'));
    mast.position.set(0,.82,-.03); mast.castShadow=true; this.ship.add(mast);
    const sailShape=new THREE.Shape();
    sailShape.moveTo(0,.43); sailShape.quadraticCurveTo(.40,.20,.34,-.38); sailShape.quadraticCurveTo(.12,-.45,0,-.34); sailShape.closePath();
    const sail=new THREE.Mesh(new THREE.ShapeGeometry(sailShape,12),sailMat);
    sail.position.set(.025,.85,.02); sail.castShadow=true; this.ship.add(sail);
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(.28,.12),new THREE.MeshBasicMaterial({color:'#df5548',side:THREE.DoubleSide}));
    flag.position.set(.13,1.35,0); this.ship.add(flag);
    this.ship.position.copy(this.tilePosition(this.state.player.q,this.state.player.r));
    this.ship.position.y=.02; this.shipTarget=this.ship.position.clone(); this.scene.add(this.ship);
  }
  createHighlights(){
    this.highlightGroup=new THREE.Group(); this.scene.add(this.highlightGroup);
    const geometry=new THREE.RingGeometry(.88,1.00,6);
    geometry.rotateX(-Math.PI/2);
    const material=new THREE.MeshBasicMaterial({color:'#fff0a6',transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false});
    this.highlightTemplate={geometry,material};
  }
  updateHighlights(){
    this.highlightGroup.clear();
    const p=this.state.player;
    for(const [dq,dr] of DIRECTIONS){
      const q=p.q+dq,r=p.r+dr,entry=this.tileByKey.get(this.key(q,r));
      if(!entry||entry.data.kind!=='sea')continue;
      const glow=new THREE.Mesh(this.highlightTemplate.geometry,this.highlightTemplate.material);
      glow.position.copy(this.tilePosition(q,r)); glow.position.y=-.31;
      glow.rotation.y=Math.PI/6; this.highlightGroup.add(glow);
    }
  }
  setHome(value){
    this.home=value; this.target.set(0,0,0);
    this.viewHeight=value?16:VIEW_HEIGHT; this.resize();
  }
  pointerDown(e){this.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};this.renderer.domElement.setPointerCapture?.(e.pointerId);}
  pointerMove(e){
    if(!this.drag||this.home)return;
    const dx=e.clientX-this.drag.lastX,dy=e.clientY-this.drag.lastY;
    if(Math.abs(e.clientX-this.drag.x)+Math.abs(e.clientY-this.drag.y)>7)this.drag.moved=true;
    if(this.drag.moved){
      const scale=this.viewHeight/Math.max(1,this.renderer.domElement.clientHeight);
      this.target.x-=dx*scale*.72; this.target.z+=dy*scale*.72; this.updateCamera();
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
    if(tile.kind==='sea'){
      this.state.player={q:tile.q,r:tile.r};
      this.shipTarget.copy(this.tilePosition(tile.q,tile.r));
      this.updateHighlights();
      window.dispatchEvent(new CustomEvent('pirate-toast',{detail:'Navigation réussie !'}));
    }else{
      const message=tile.kind==='island'?'Île découverte : +5 or !':tile.kind==='storm'?'Nuage d’orage : la coque tremble !':'Volcan découvert : +12 or !';
      if(tile.kind==='island')this.state.gold+=5;
      if(tile.kind==='storm')this.state.damagePlayer(2);
      if(tile.kind==='volcano')this.state.gold+=12;
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
  loop(){
    this.frame=requestAnimationFrame(this.loop);const t=performance.now()*.001;
    this.ship.position.lerp(this.shipTarget,.075);
    this.ship.position.y=.02+Math.sin(t*1.7)*.035;
    this.ship.rotation.z=Math.sin(t*.8)*.012;
    if(this.home){this.target.x=Math.sin(t*.1)*.25;this.updateCamera();}
    this.renderer.render(this.scene,this.camera);
  }
}
