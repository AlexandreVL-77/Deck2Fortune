import Phaser from 'phaser';
import { makeIslandMap, axialToPixel, hexDistance } from '../systems/HexGrid.js';
import { CombatSystem } from '../systems/CombatSystem.js';
export class GameScene extends Phaser.Scene {
  constructor(state){super('GameScene');this.state=state;this.combat=new CombatSystem(state);}
  create(){
    this.cameras.main.setBackgroundColor('#65c9d0');
    this.graphics=this.add.graphics();this.tileLabels=this.add.group();this.drawWorld();
    this.input.on('pointerdown',p=>this.onWorldTap(p));
    this.scale.on('resize',()=>this.drawWorld());
    this.state.subscribe(()=>this.drawWorld());
  }
  drawWorld(){
    const g=this.graphics;g.clear();this.tileLabels.clear(true,true);
    const w=this.scale.width,h=this.scale.height, size=Math.min(w/10,34);
    const center={x:w/2,y:h*.48};
    for(let i=0;i<5;i++){g.lineStyle(2,0xffffff,0.12);g.strokeEllipse(center.x,center.y+i*5,w*.78-i*18,h*.38-i*12);}
    for(const tile of makeIslandMap(4)){
      const p=axialToPixel(tile.q,tile.r,size);const x=center.x+p.x*.82,y=center.y+p.y*.82;
      const colors={sea:0x65c9d0,island:0x83c98a,storm:0x8a9ab0,volcano:0xd88b68};
      g.fillStyle(colors[tile.kind],tile.kind==='sea'?.32:1);g.lineStyle(2,0xffffff,.55);
      const points=[];for(let i=0;i<6;i++){const a=Math.PI/3*i+Math.PI/6;points.push({x:x+Math.cos(a)*size*.72,y:y+Math.sin(a)*size*.72});}
      g.fillPoints(points,true);g.strokePoints(points,true);
      if(tile.kind!=='sea'){
        const labels={island:'🌴',storm:'☁️',volcano:'🌋'};
        this.tileLabels.add(this.add.text(x,y-9,labels[tile.kind],{fontSize:`${Math.max(13,size*.62)}px`}).setOrigin(.5).setDepth(2));
      }
    }
    const ship=axialToPixel(this.state.player.q,this.state.player.r,size);
    this.shipMarker?.destroy();
    this.shipMarker=this.add.text(center.x+ship.x*.82,center.y+ship.y*.82-12,'⛵',{fontSize:'28px'}).setOrigin(.5).setDepth(5);
    if(this.state.inCombat){
      const enemy=axialToPixel(this.state.enemy.q,this.state.enemy.r,size);
      this.enemyMarker?.destroy();
      this.enemyMarker=this.add.text(center.x+enemy.x*.82,center.y+enemy.y*.82-12,'🏴‍☠️',{fontSize:'27px'}).setOrigin(.5).setDepth(5);
    } else this.enemyMarker?.destroy();
  }
  onWorldTap(pointer){
    if(this.state.inCombat)return;
    const w=this.scale.width,h=this.scale.height,size=Math.min(w/10,34),center={x:w/2,y:h*.48};
    let nearest=null,best=Infinity;
    for(const tile of makeIslandMap(4)){
      const p=axialToPixel(tile.q,tile.r,size);const x=center.x+p.x*.82,y=center.y+p.y*.82;
      const d=Phaser.Math.Distance.Between(pointer.x,pointer.y,x,y);
      if(d<best){best=d;nearest=tile;}
    }
    if(best<size*.7&&nearest){
      this.state.player={q:nearest.q,r:nearest.r};
      if(nearest.kind==='island')this.state.gold+=5;
      if(nearest.kind==='storm')this.state.damagePlayer(2);
      if(nearest.kind==='volcano')this.state.gold+=12;
      this.state.emit();
      if(hexDistance(nearest,{q:2,r:-1})<=1)this.state.startCombat();
      else window.dispatchEvent(new CustomEvent('pirate-toast',{detail:nearest.kind==='island'?'Île découverte : +5 or !':nearest.kind==='storm'?'La tempête secoue la coque !':'Cap sur l’horizon !'}));
    }
  }
}
