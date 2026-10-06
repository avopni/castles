import {useEffect,useRef} from 'react';
const angles:Record<number,[number,number]>={1:[0,0],2:[0,-90],3:[-90,0],4:[90,0],5:[0,90],6:[0,180]};
const pips:Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
export function Die({value,rollKey,rolling,reducedMotion}:{value:number;rollKey:number;rolling:boolean;reducedMotion:boolean}){
 const cube=useRef<HTMLDivElement>(null),[x,y]=angles[value]??angles[1];
 useEffect(()=>{
  if(!rolling||reducedMotion)return;
  const animation=cube.current?.animate([{transform:`translateY(-12px) rotateX(${x+640}deg) rotateY(${y+520}deg) rotateZ(45deg)`},{transform:`translateY(4px) rotateX(${x+180}deg) rotateY(${y+90}deg) rotateZ(-12deg)`,offset:.7},{transform:`translateY(0) rotateX(${x}deg) rotateY(${y}deg) rotateZ(0)`}],{duration:850,easing:'cubic-bezier(.18,.6,.28,1)'});
  return()=>animation?.cancel();
 },[rollKey,rolling,reducedMotion,x,y]);
 return <div className="die" data-rolling={rolling} aria-label={rolling?'Rolling die':`Die result ${value}`} role="img"><div ref={cube} className="die-cube" style={{transform:`rotateX(${x}deg) rotateY(${y}deg)`}}>{[1,2,3,4,5,6].map(n=><span key={n} className={`die-face face-${n}`}>{Array.from({length:9},(_,i)=><i key={i} className={pips[n].includes(i)?'pip':''}/>)}</span>)}</div></div>;
}
