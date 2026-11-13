import Phaser from 'phaser';
import { makeIslandMap, axialToPixel, hexDistance } from '../systems/HexGrid.js';
import { CombatSystem } from '../systems/CombatSystem.js';

export class GameScene extends Phaser.Scene {
  constructor(state){super('GameScene');this.state=state;this.combat=new CombatSystem(state);this.tileCenters=[];}
  create(){
    this.cameras.main.setBackgroundColor('#126f7b');
    this.graphics=this.add.graphics();
    this.drawWorld();
    this.input.on('pointerdown',p=>this.onWorldTap(p));
    this.scale.on('resize',()=>this.drawWorld());
    this.state.subscribe(()=>this.drawWorld());
  }
  polygon(g,pts,color,alpha=1,line=0x315d55){
    g.fillStyle(color,alpha);g.lineStyle(1.5,line,.8);g.fillPoints(pts,true);g.strokePoints(pts,true);
  }
  hexPoints(x,y,size,scale=1){
    return Array.from({length:6},(_,i)=>{const a=Math.PI/3*i+Math.PI/6;return{x:x+Math.cos(a)*size*scale,y:y+Math.sin(a)*size*scale};});
  }
  drawPalm(g,x,y,s){
    g.lineStyle(3,0x805536,1);g.lineBetween(x,y+7*s,x+2*s,y-12*s);
    g.lineStyle(3,0x397b50,1);
    for(const [dx,dy] of [[-11,-15],[-5,-21],[4,-22],[12,-15],[0,-12]]){
      g.lineBetween(x+2*s,y-12*s,x+dx*s,y+dy*s);
      g.fillStyle(0x4e9a5d,1);g.fillEllipse(x+dx*s,y+dy*s,9*s,4*s);
    }
    g.fillStyle(0xe4bd68,1);g.fillCircle(x+2*s,y-12*s,3*s);
  }
  drawIsland(g,x,y,size){
    const pts=this.hexPoints(x,y,size,.76);
    this.polygon(g,pts,0xd8b56f,1,0x9c7448);
    this.polygon(g,this.hexPoints(x,y-2,size,.66),0x65a96c,1,0x3e8056);
    g.fillStyle(0x8bc879,.9);g.fillEllipse(x-5,y-7,size*.45,size*.2);
    this.drawPalm(g,x-size*.2,y+3,size/34);
    this.drawPalm(g,x+size*.22,y+8,size/42);
    g.fillStyle(0xe7d08e,1);g.fillEllipse(x-size*.24,y+size*.22,size*.22,size*.09);
  }
  drawVolcano(g,x,y,size){
    this.polygon(g,this.hexPoints(x,y,size,.76),0xb98a59,1,0x805b43);
    g.fillStyle(0x5d6260,1);g.fillPoints([{x:x-size*.42,y:y+size*.2},{x:x-size*.12,y:y-size*.43},{x:x+size*.08,y:y-size*.12},{x:x+size*.25,y:y-size*.38},{x:x+size*.48,y:y+size*.2}],true);
    g.lineStyle(3,0xe56d42,1);g.lineBetween(x-size*.13,y-size*.24,x+size*.03,y-size*.08);g.lineBetween(x+size*.03,y-size*.08,x+size*.18,y-size*.26);
    g.fillStyle(0xf4a05b,.8);g.fillCircle(x,y-size*.42,3);
    g.fillStyle(0x737c7b,.6);g.fillEllipse(x+size*.2,y-size*.55,14,8);
  }
  drawStorm(g,x,y,size){
    this.polygon(g,this.hexPoints(x,y,size,.74),0x647d91,1,0x435c70);
    g.fillStyle(0x9aafbb,1);g.fillCircle(x-size*.15,y-4,size*.18);g.fillCircle(x+size*.02,y-size*.13,size*.22);g.fillCircle(x+size*.22,y-3,size*.16);g.fillRoundedRect(x-size*.28,y-4,size*.58,size*.19,5);
    g.fillStyle(0xf8d36e,1);g.fillPoints([{x:x+3,y:y+3},{x:x-5,y:y+size*.25},{x:x+2,y:y+size*.2},{x:x-1,y:y+size*.4},{x:x+12,y:y+size*.12},{x:x+5,y:y+size*.16}],true);
    g.lineStyle(1,0xffffff,.3);g.lineBetween(x-size*.35,y+size*.38,x-size*.2,y+size*.42);
  }
  drawShip(g,x,y,scale,enemy=false){
    const hull=enemy?0x573d45:0x754b35,sail=enemy?0xd8c7b0:0xffe7b2;
    g.fillStyle(0x062f40,.28);g.fillEllipse(x,y+scale*15,scale*54,scale*18);
    g.fillStyle(hull,1);g.lineStyle(2,enemy?0x382e3a:0x4d3327,1);
    g.fillPoints([{x:x-scale*29,y:y-scale*3},{x:x+scale*29,y:y-scale*3},{x:x+scale*19,y:y+scale*13},{x:x-scale*17,y:y+scale*13}],true);g.strokePoints([{x:x-scale*29,y:y-scale*3},{x:x+scale*29,y:y-scale*3},{x:x+scale*19,y:y+scale*13},{x:x-scale*17,y:y+scale*13}],true);
    g.lineStyle(3,0x5d3b2b,1);g.lineBetween(x,y-scale*26,x,y+scale*1);g.lineBetween(x+scale*13,y-scale*18,x+scale*13,y+scale*1);
    g.fillStyle(sail,1);g.fillPoints([{x:x-scale*2,y:y-scale*23},{x:x-scale*2,y:y-scale*2},{x:x-scale*22,y:y-scale*2}],true);
    g.fillStyle(enemy?0xb64f47:0xe0b65f,1);g.fillPoints([{x:x+scale*3,y:y-scale*18},{x:x+scale*3,y:y-scale*2},{x:x+scale*20,y:y-scale*2}],true);
    g.lineStyle(1,0x8d6240,1);g.lineBetween(x-scale*2,y-scale*23,x-scale*2,y-scale*2);g.lineBetween(x+scale*3,y-scale*18,x+scale*3,y-scale*2);
    if(enemy){g.lineStyle(2,0xeee0c5,1);g.lineBetween(x+scale*13,y-scale*18,x+scale*13,y-scale*29);g.fillStyle(0x9f4141,1);g.fillTriangle(x+scale*13,y-scale*29,x+scale*28,y-scale*24,x+scale*13,y-scale*20);}
    else {g.fillStyle(0x9e5940,1);g.fillTriangle(x,y-scale*26,x+scale*12,y-scale*21,x,y-scale*17);}
    g.fillStyle(0xf2d18a,1);g.fillCircle(x-scale*8,y+scale*4,scale*1.5);g.fillCircle(x,y+scale*4,scale*1.5);g.fillCircle(x+scale*8,y+scale*4,scale*1.5);
  }
  drawWorld(){
    const g=this.graphics;g.clear();this.tileCenters=[];
    const w=this.scale.width,h=this.scale.height,size=Math.min(w/10,34),center={x:w/2,y:h*.49};
    // Deep-water base with layered, hand-drawn current lines.
    for(let i=0;i<18;i++){
      const yy=((i*73+31)%Math.max(1,h));
      const xx=((i*137+19)%Math.max(1,w));
      g.lineStyle(1.5,0xa1e0d4,.11);g.beginPath();g.arc(xx,yy,9+(i%4)*3,.2,2.7,false);g.strokePath();
      g.fillStyle(0xd2f0cf,.13);g.fillCircle(xx+18,yy+12,1.5);
    }
    for(let i=0;i<4;i++){g.lineStyle(2,0xd5eee0,.1);g.strokeEllipse(center.x,center.y+i*5,w*.8-i*17,h*.39-i*13);}
    for(const tile of makeIslandMap(4)){
      const p=axialToPixel(tile.q,tile.r,size),x=center.x+p.x*.82,y=center.y+p.y*.82;
      this.tileCenters.push({tile,x,y});
      const pts=this.hexPoints(x,y,size,.72);
      if(tile.kind==='sea'){
        g.fillStyle(0x1a8290,.17);g.lineStyle(1,0x9bd7c9,.22);g.fillPoints(pts,true);g.strokePoints(pts,true);
        g.lineStyle(1.5,0xa9e3d4,.34);g.beginPath();g.arc(x-size*.13,y,size*.19,.2,2.5,false);g.strokePath();
      } else {
        g.fillStyle(0x073b4a,.2);g.fillPoints(this.hexPoints(x+2,y+5,size,.76),true);
        if(tile.kind==='island')this.drawIsland(g,x,y,size);
        if(tile.kind==='storm')this.drawStorm(g,x,y,size);
        if(tile.kind==='volcano')this.drawVolcano(g,x,y,size);
      }
    }
    const ship=axialToPixel(this.state.player.q,this.state.player.r,size);
    this.drawShip(g,center.x+ship.x*.82,center.y+ship.y*.82-12,.72,false);
    if(this.state.inCombat){
      const enemy=axialToPixel(this.state.enemy.q,this.state.enemy.r,size);
      this.drawShip(g,center.x+enemy.x*.82,center.y+enemy.y*.82-12,.72,true);
    }
    // Decorative compass rose.
    const cx=w-34,cy=h*.46;g.lineStyle(1.5,0xf4d28c,.65);g.strokeCircle(cx,cy,13);g.fillStyle(0xf4d28c,.8);g.fillTriangle(cx,cy-10,cx-3,cy+2,cx+3,cy+2);g.fillStyle(0x315b65,1);g.fillTriangle(cx,cy+10,cx-3,cy-2,cx+3,cy-2);
  }
  onWorldTap(pointer){
    if(this.state.inCombat)return;
    let nearest=null,best=Infinity;
    for(const item of this.tileCenters){
      const d=Phaser.Math.Distance.Between(pointer.x,pointer.y,item.x,item.y);
      if(d<best){best=d;nearest=item.tile;}
    }
    const size=Math.min(this.scale.width/10,34);
    if(best<size*.7&&nearest){
      this.state.player={q:nearest.q,r:nearest.r};
      if(nearest.kind==='island')this.state.gold+=5;
      if(nearest.kind==='storm')this.state.damagePlayer(2);
      if(nearest.kind==='volcano')this.state.gold+=12;
      this.state.emit();
      if(hexDistance(nearest,{q:2,r:-1})<=1)this.state.startCombat();
      else window.dispatchEvent(new CustomEvent('pirate-toast',{detail:nearest.kind==='island'?'Île découverte : +5 or !':nearest.kind==='storm'?'La tempête secoue la coque !':nearest.kind==='volcano'?'Volcan découvert : +12 or !':'Cap sur l’horizon !'}));
    }
  }
}