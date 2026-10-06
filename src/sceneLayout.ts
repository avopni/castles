import * as THREE from 'three';
import { surface, wizardLocation } from './engine/game';
import { surfaceSlot, unitOriginY, TOWER_PITCH, TOWER_ORIGIN_Y } from './surfaceLayout';
import type { State } from './engine/types';

// Centers on the full-screen Market & Orchard painting. One closed sixteen-space loop.
export const CLEARINGS = [
  [.099,.216],[.268,.161],[.407,.132],[.533,.25],
  [.667,.187],[.82,.21],[.927,.34],[.838,.462],
  [.683,.484],[.574,.592],[.561,.757],[.383,.842],
  [.202,.82],[.097,.684],[.11,.606],[.1,.42],
] as const;
export const BOARD_WIDTH=22, BOARD_DEPTH=15.5;
const route = new THREE.CatmullRomCurve3(CLEARINGS.map(([u,v])=>new THREE.Vector3((u-.5)*BOARD_WIDTH,0,(v-.5)*BOARD_DEPTH)),true,'centripetal');
export function location(space:number,y=0) { const p=route.getPoint(((space%16)+16)%16/16);p.y=y;return p; }
// Adapt the physical ground plane to the canvas aspect and camera tilt. This keeps
// all artwork visible without stretching the 3D pieces or adding letterboxing.
export function boardLayout(aspect:number,verticalProjection:number,clearings:readonly (readonly [number,number])[]=CLEARINGS){
  const depth=BOARD_WIDTH/(aspect*Math.sqrt(1-verticalProjection**2));
  const path=new THREE.CatmullRomCurve3(clearings.map(([u,v])=>new THREE.Vector3((u-.5)*BOARD_WIDTH,0,(v-.5)*depth)),true,'centripetal');
  const locate=(space:number,y=0)=>{const p=path.getPoint(((space%16)+16)%16/16);p.y=y;return p};
  return {depth,location:locate};
}
export type Pose={space:number,x:number,y:number,z:number,support?:string,visible:boolean};
export type SlotMemory=Map<string,{support:string;slot:number}>;
export function scenePoses(s:State,slots:SlotMemory,locate=location):Record<string,Pose> {
  const poses:Record<string,Pose>={};
  s.board.forEach((cell,space)=>{
    cell.towers.forEach((id,level)=>{const p=locate(space,TOWER_ORIGIN_Y+level*TOWER_PITCH);poses[id]={space,...p,visible:true};});
    const ids=surface(s,space), occupied=new Set<number>();
    const assignments=new Map<string,number>();
    for(const id of ids){const support=wizardLocation(s,id)!.support,old=slots.get(id);if(old?.support===support&&!occupied.has(old.slot)){occupied.add(old.slot);assignments.set(id,old.slot);}}
    for(const id of ids)if(!assignments.has(id)){let slot=0;while(occupied.has(slot))slot++;occupied.add(slot);assignments.set(id,slot);}
    for(const id of ids){const support=wizardLocation(s,id)!.support,slot=assignments.get(id)!;slots.set(id,{support,slot});const p=locate(space,unitOriginY(cell.towers.length)),offset=surfaceSlot(slot);p.x+=offset.x;p.z+=offset.z;poses[id]={space,...p,support,visible:true};}
  });
  return poses;
}
