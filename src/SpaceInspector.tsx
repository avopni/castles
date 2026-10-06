import {GameBoard} from './GameBoard';
import {surface} from './engine/game';
import type {Move,State} from './engine/types';

type Props={state:State;space:number;boardId:string;selected:string;moves:Move[];locked:boolean;actor:number;focusedOwner:number|null;peek:boolean;towerLabel:(id:string)=>string;onSelect:(id:string)=>void;onClose:()=>void};
export function SpaceInspector({state,space,boardId,selected,moves,locked,actor,focusedOwner,peek,towerLabel,onSelect,onClose}:Props){
  const cell=state.board[space],units=surface(state,space),legal=(id:string)=>moves.some(m=>m.target===id);
  const unitGroups=new Map<string,string[]>();
  for(const id of units){
    const faction=state.players[state.wizards[id].owner].faction;
    const group=unitGroups.get(faction)??[];
    group.push(id);
    unitGroups.set(faction,group);
  }
  return <section className="space-inspector" aria-label="Space choices" onKeyDown={e=>{if(e.key==='Escape')onClose()}}>
    <button className="dock-close" aria-label="Close space choices" onClick={onClose}>×</button>
    <div className="dock-columns">
      <section className="dock-preview" aria-label="Tower preview"><h3>Preview</h3><div className="dock-preview-stage"><GameBoard boardId={boardId} state={state} before={null} selected={selected} targets={selected?[]:moves.map(m=>m.target)} detailSpace={space} activeOwner={selected?-1:actor} focusedOwner={selected?null:focusedOwner} reducedMotion onPick={id=>{if(!id.startsWith('space-'))onSelect(id)}}/><div className="preview-tiers" role="group" aria-label="Tower tiers">{cell.towers.map((id,index)=><button key={id} title={`${id==='keep'?'The Keep':towerLabel(id)} · ${state.towers[id].raven?'Raven':'Stone'}`} aria-label={`Tier ${index+1}: ${id==='keep'?'The Keep':towerLabel(id)}`} aria-pressed={selected===id} className={legal(id)?'target-option':''} disabled={id==='keep'} onClick={()=>onSelect(id)}>{index+1}</button>)}</div></div>{!cell.towers.length&&<p>Ground</p>}</section>
      <section className="dock-units"><h3>Units</h3><div className="roof-residents" aria-label="Exposed travellers">{[...unitGroups].map(([faction,ids])=>{
        const selectedId=ids.find(id=>id===selected),id=selectedId??ids.find(legal)??ids[0],canSelect=legal(id);
        return <button key={faction} data-unit-id={id} title={faction} aria-label={`Select ${faction}${ids.length>1?`, ${ids.length} units`:''}`} aria-pressed={!!selectedId} className={canSelect?'target-option':''} disabled={locked||!canSelect} onClick={()=>onSelect(id)}><span className="figure"><img src={`${import.meta.env.BASE_URL}art/units/${faction.toLowerCase()}-v1.png`} alt=""/></span><small>{faction}</small>{ids.length>1&&<b className="unit-count">x{ids.length}</b>}{canSelect&&<b className="target-mark" aria-label="Legal move">!</b>}</button>;
      })}</div>{!units.length&&<p>No exposed units</p>}</section>
    </div>
    {peek&&<details className="dock-peek"><summary>Under the roof</summary><div className="peek-layers">{[{name:'Ground',ids:cell.ground},...cell.towers.map(id=>({name:id==='keep'?'Keep':towerLabel(id),ids:state.towers[id].residents}))].filter(layer=>layer.ids.length).map(layer=><div key={layer.name}><b>{layer.name}</b>{layer.ids.map(id=><span key={id}><img src={`${import.meta.env.BASE_URL}art/portraits/${state.players[state.wizards[id].owner].faction.toLowerCase()}.png`} alt=""/><small>{state.players[state.wizards[id].owner].faction}</small></span>)}</div>)}</div></details>}
  </section>;
}
