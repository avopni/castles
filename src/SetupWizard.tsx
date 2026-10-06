import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {BOARD_THEMES,boardTheme} from './boardThemes';
import {FACTIONS,SPELLS} from './engine/content';
import type {Config,Faction,SpellId} from './engine/types';
import {Portrait} from './Portrait';

type SetupPreferences={boardId:string;tutorial:boolean;reducedMotion:boolean;botDelay:number};
type Props={preferences:SetupPreferences;onPreferences:(update:Partial<SetupPreferences>)=>void;onBegin:(config:Config)=>void;onCancel?:()=>void;onImport?:()=>void};
export function SetupWizard({preferences,onPreferences,onBegin,onCancel,onImport}:Props){
  const [step,setStep]=useState(0),[house,setHouse]=useState<Faction>('Otters');
  const [spells,setSpells]=useState<SpellId[]>(['stride','lift']),[interrupts,setInterrupts]=useState(false),[replace,setReplace]=useState(false);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus()},[step]);
  const board=boardTheme(preferences.boardId),boardIndex=BOARD_THEMES.indexOf(board);
  const opponents=FACTIONS.filter(f=>f.name!==house);
  const titles=['Choose your board','Choose your character','Spells & game options'];
  const moveBoard=(direction:number)=>onPreferences({boardId:BOARD_THEMES[(boardIndex+direction+BOARD_THEMES.length)%BOARD_THEMES.length].id});
  const begin=()=>{
    if(onCancel&&!replace){setReplace(true);return;}
    onBegin({mode:'competitive',players:[{name:house,faction:house,bot:false},...opponents.map(f=>({name:f.name,faction:f.name,bot:true}))],spells,nasty:interrupts,starter:0,seed:Date.now()});
  };
  return <section className="landing" data-step={step} aria-label="Gather the houses">
    <header className="setup-heading"><div><div className="eyebrow">GATHER THE HOUSES · {step+1} / 3</div><h2 ref={heading} tabIndex={-1}>{titles[step]}</h2></div>{onCancel&&<button onClick={onCancel}>Return to game</button>}</header>
    <div className="setup-page">
      {step===0&&<div className="board-stage">
        <div className="board-preview"><button aria-label="Previous board" onClick={()=>moveBoard(-1)}>‹</button><img src={import.meta.env.BASE_URL+board.image} alt={`${board.name} board landscape`}/><button aria-label="Next board" onClick={()=>moveBoard(1)}>›</button></div>
        <div className="board-caption" aria-live="polite"><h3>{board.name}</h3><p>{board.description}</p></div>
        <div className="board-thumbnails" aria-label="Board choices">{BOARD_THEMES.map(b=><button key={b.id} aria-label={`Choose ${b.name}`} aria-pressed={board.id===b.id} onClick={()=>onPreferences({boardId:b.id})}><img src={import.meta.env.BASE_URL+b.image} alt=""/><span>{b.name}</span></button>)}</div>
      </div>}
      {step===1&&<div className="character-stage"><p className="step-hint">Your house faces three bots. They take the other houses automatically.</p><div className="house-options">{FACTIONS.map(f=><button key={f.name} style={{'--faction-color':f.color} as CSSProperties} aria-label={`Choose ${f.name}`} aria-pressed={house===f.name} onClick={()=>setHouse(f.name)}><Portrait faction={f.name}/><span className="house-copy"><strong>{f.name}</strong><small>{f.motto}</small><b>{house===f.name?'Your character':'Choose character'}</b></span></button>)}</div><p className="opponent-line">Bots: {opponents.map(f=>f.name).join(' · ')}</p></div>}
      {step===2&&<div className="options-stage"><section className="wizard-spells" aria-label="Shared spells"><h3>Shared spells</h3><p className="step-hint">Choose the spells available to every house.</p><div className="spell-choices">{(Object.keys(SPELLS) as SpellId[]).map(id=><label key={id} title={SPELLS[id].description}><input type="checkbox" checked={spells.includes(id)} onChange={()=>setSpells(v=>v.includes(id)?v.filter(s=>s!==id):[...v,id])}/><span>{SPELLS[id].name}<small>{SPELLS[id].cost} potion{SPELLS[id].cost===1?'':'s'}</small></span></label>)}</div></section><section className="wizard-options" aria-label="Game options"><h3>Game options</h3><label className="check"><input type="checkbox" checked={interrupts} onChange={e=>setInterrupts(e.target.checked)}/>Interrupt spells</label><label className="check"><input type="checkbox" checked={preferences.tutorial} onChange={e=>onPreferences({tutorial:e.target.checked})}/>Tutorial hints</label><label className="check"><input type="checkbox" checked={preferences.reducedMotion} onChange={e=>onPreferences({reducedMotion:e.target.checked})}/>Reduced motion</label><label className="bot-pace">Bot pace<select value={preferences.botDelay} onChange={e=>onPreferences({botDelay:Number(e.target.value)})}><option value={150}>Quick</option><option value={700}>Steady</option><option value={1600}>Leisurely</option></select></label><p className="setup-summary">{board.name}<br/>{house} · You + 3 bots</p></section></div>}
    </div>
    <footer className="setup-footer"><div>{step>0?<button onClick={()=>{setReplace(false);setStep(v=>v-1)}}>Back</button>:onImport?<button onClick={onImport}>Import save</button>:null}</div><div className="step-dots" aria-label={`Step ${step+1} of 3`}>{titles.map((title,i)=><span key={title} className={i===step?'active':''}/>)}</div><div className="setup-next">{replace&&<small>Replaces your current autosave.</small>}{step<2?<button className="primary" onClick={()=>setStep(v=>v+1)}>Next: {step===0?'character':'game options'} →</button>:<button className="primary" onClick={begin}>{replace?'Replace & begin':'Begin gathering'}</button>}</div></footer>
  </section>;
}
