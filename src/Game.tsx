import {useCallback,useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {createGame,hand,legalMoves,mod,partner,reduceGame,surface,towerLocation,wizardLocation} from './engine/game';
import {chooseBotAction,remember,type Memory} from './engine/bot';
import {cardText,FACTIONS,SPELLS} from './engine/content';
import {load,parseSave,replay,save,type Record as GameRecord} from './engine/storage';
import type {Action,Card,Config,Move,SpellId,State} from './engine/types';
import {actingSeat,automaticAction,availableSpells,movementDuration,newRecord,resourceSeat,spellActions} from './session';
import {GameBoard} from './GameBoard';
import {BoardPicker} from './BoardPicker';
import {SetupWizard} from './SetupWizard';
import {SpaceInspector} from './SpaceInspector';
import {boardTheme} from './boardThemes';
import {CastleMark,PieceIcon} from './Crest';
import {Portrait} from './Portrait';
import {Die} from './Die';
import './game.css';
import './fullscreen.css';
import './landing.css';
import './hand-dock.css';
import './move-feedback.css';

type Panel='setup'|'houses'|'spells'|'home'|'inspect'|'targets'|'settings'|'partner'|null;
type Preferences={tutorial:boolean;privateHands:boolean;reducedMotion:boolean;botDelay:number;boardId:string};
const defaults:Preferences={tutorial:false,privateHands:false,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,botDelay:700,boardId:'valley'};
function preferences():Preferences{try{const stored={...defaults,...JSON.parse(localStorage.getItem('castles-preferences')??'{}')};return {...stored,boardId:boardTheme(stored.boardId).id}}catch{return defaults}}
function initialSession(){try{const record=load();return record?{record,state:replay(record),error:''}:{record:null,state:null,error:''}}catch{return {record:null,state:null,error:'The saved game could not be restored. Import a backup or begin a new game.'}}}
function Figure({faction,completed=false}:{faction:string;completed?:boolean}){return <span className={`figure ${completed?'completed':''}`}><img src={`${import.meta.env.BASE_URL}art/units/${faction.toLowerCase()}-v1.png`} alt={`${faction} traveller`}/>{completed&&<b aria-label="Home">✓</b>}</span>}
function turretLabel(state:State,id:string){
  const space=towerLocation(state,id).space,stack=state.board[space].towers,top=stack.at(-1)==='keep'?stack.length-2:stack.length-1,index=stack.indexOf(id);
  if(index<0)return 'Turret';
  if(top===0||index===0)return 'Bottom turret';
  if(index===top)return 'Top turret';
  const n=index+1,suffix=n%10===1&&n%100!==11?'st':n%10===2&&n%100!==12?'nd':n%10===3&&n%100!==13?'rd':'th';
  return `${n}${suffix} from bottom`;
}
function Potions({player}:{player:State['players'][number]}){return <div className="bottles" aria-label={`${player.full} full, ${player.empty} empty, ${player.spent} spent potions`}>
  {Array.from({length:player.full+player.empty+player.spent},(_,i)=><span key={i} className={i<player.full?'full':i<player.full+player.empty?'empty':'spent'}><PieceIcon kind="potion"/></span>)}
  <small>{player.full} full{player.spent>0?` · ${player.spent} spent`:''}</small>
</div>}
function MovementCard({card,disabled=false,onClick,committed=false,hidden=false}:{card:Card;disabled?:boolean;onClick?:()=>void;committed?:boolean;hidden?:boolean}){
  return <button className={`play-card ${committed?'committed':''} ${hidden?'card-back':''}`} disabled={disabled} onClick={onClick} title={hidden?'Concealed card':cardText(card)} aria-label={hidden?'Concealed card':`Play ${cardText(card)}`} data-card={card.id}>
    <img className="card-art" src={`${import.meta.env.BASE_URL}art/cards/revision-05/faces/${hidden?'back':card.face}.png`} alt={hidden?'Raven card back':cardText(card)}/>
  </button>;
}
function selectedCardDescription(pending:State['pending']){
  if(pending?.refresh)return 'Castle moves 1 space';
  if(!pending?.card)return 'Choose a tower or unit';
  const describe=(piece:string,steps:number)=>{
    const distance=steps<0?pending.roll:steps;
    return distance===null?`${piece} moves by dice roll`:`${piece} moves ${distance} space${distance===1?'':'s'}`;
  };
  return [pending.card.tower&&describe('Castle',pending.card.tower),pending.card.wizard&&describe('Unit',pending.card.wizard)].filter(Boolean).join(' / ');
}
function spaceSelection(state:State,space:number,moves:Move[],tier=state.board[space].towers[0]){
  const unit=moves.find(m=>m.kind==='wizard'&&wizardLocation(state,m.target)?.space===space)?.target;
  if(state.phase==='move'&&!state.pending?.refresh&&!state.pending?.card?.tower)return unit??tier??'';
  return tier??unit??'';
}
function Drawer({title,onClose,children,left=false}:{title:string;onClose:()=>void;children:ReactNode;left?:boolean}){
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLElement>('button')?.focus();return()=>{if(previous?.isConnected)previous.focus()}},[]);
  return <aside ref={ref} role="dialog" aria-modal="false" aria-label={title} className={`game-drawer ${left?'left':''}`} onKeyDown={e=>{if(e.key==='Escape')onClose()}}><header><h2>{title}</h2><button onClick={onClose} aria-label={`Close ${title}`}>×</button></header>{children}</aside>;
}
export default function Game(){
  const [boot]=useState(initialSession);
  const [state,setState]=useState<State|null>(boot.state),[record,setRecord]=useState<GameRecord|null>(boot.record);
  const [prefs,setPrefs]=useState(preferences),[panel,setPanel]=useState<Panel>(boot.state?null:'setup');
  const [before,setBefore]=useState<State|null>(null),[busy,setBusy]=useState(false),[reviewAction,setReviewAction]=useState(false),[paused,setPaused]=useState(false),[handoff,setHandoff]=useState(!!boot.state&&prefs.privateHands&&!boot.state.players[actingSeat(boot.state)].bot);
  const [error,setError]=useState(boot.error),[notice,setNotice]=useState(''),[victoryDismissed,setVictoryDismissed]=useState(false);
  const [selected,setSelected]=useState(''),[inspected,setInspected]=useState(0),[chosenSpell,setChosenSpell]=useState<SpellId|null>(null);
  const [optionSpace,setOptionSpace]=useState<number|null>(null);
  const [giveCard,setGiveCard]=useState<number|null>(null),[takeCard,setTakeCard]=useState<number|null>(null);
  const [savedLabel,setSavedLabel]=useState('Saved on this device');
  const [focusedOwner,setFocusedOwner]=useState<number|null>(null),[peek,setPeek]=useState(false),[handCollapsed,setHandCollapsed]=useState(false);
  const file=useRef<HTMLInputElement>(null),unlock=useRef<ReturnType<typeof setTimeout>|null>(null),memories=useRef<Memory[]>([]),latest=useRef({state,record,busy,paused,handoff});
  latest.current={state,record,busy,paused,handoff};
  useEffect(()=>{try{localStorage.setItem('castles-preferences',JSON.stringify(prefs))}catch{ /* Preferences can remain session-local. */ }},[prefs]);
  useEffect(()=>()=>{if(unlock.current)clearTimeout(unlock.current)},[]);
  useEffect(()=>{if(!record)return;memories.current=record.initial.players.map(()=>({}));let observed=record.initial;
    memories.current=memories.current.map(m=>remember(observed,m));
    for(const a of record.actions){observed=reduceGame(observed,a);memories.current=memories.current.map(m=>remember(observed,m));}
  },[record?.initial]);
  const install=(r:GameRecord)=>{
    if(unlock.current)clearTimeout(unlock.current);const next=replay(r);
    setRecord(r);setState(next);setBefore(null);setBusy(false);setReviewAction(false);setPaused(false);setHandoff(prefs.privateHands&&!next.players[actingSeat(next)].bot);
    setPanel(null);setError('');setSelected('');setOptionSpace(null);setChosenSpell(null);setVictoryDismissed(false);
    setPeek(false);setFocusedOwner(null);setHandCollapsed(false);
    try{save(r);setSavedLabel('Saved on this device')}catch{setSavedLabel('Storage unavailable · export a backup')}
  };
  const dispatch=useCallback((action:Action,automatic=false)=>{
    const current=latest.current;
    if(!current.state||!current.record||current.busy||current.paused||current.handoff||reviewAction)return;
    if(!automatic&&current.state.players[actingSeat(current.state)].bot)return;
    try{
      const next=reduceGame(current.state,action),r={...current.record,actions:[...current.record.actions,action],savedAt:new Date().toISOString()};
      const duration=movementDuration(next,prefs.reducedMotion);
      const reviewable=!automatic&&next.events.some(e=>e.kind==='move'||e.kind==='keep'||e.kind==='enter');
      latest.current={...current,state:next,record:r,busy:duration>0};
      memories.current=next.players.map((_,i)=>remember(next,memories.current[i]??{}));
      setRecord(r);setState(next);setBefore(duration||reviewable?current.state:null);setBusy(duration>0);setSelected('');setOptionSpace(null);setChosenSpell(null);setError('');
      if(action.type!=='givePotion'&&action.type!=='exchange')setPanel(null);
      if(!automatic&&next.phase==='move'&&(action.type==='play'||action.type==='accept'||action.type==='refresh')){
        const nextMoves=legalMoves(next),first=nextMoves[0];
        if(first){const space=next.towers[first.target]?towerLocation(next,first.target).space:wizardLocation(next,first.target)!.space;setInspected(space);setOptionSpace(space);setSelected(spaceSelection(next,space,nextMoves));setPanel('inspect');setHandCollapsed(false);}
      }
      const completed=next.events.find(e=>e.kind==='enter'),capture=next.events.find(e=>e.kind==='capture'),miss=next.events.find(e=>e.kind==='miss');
      setNotice(completed?`${completed.ids.length} traveller${completed.ids.length>1?'s':''} home`:capture?next.players[capture.value!].full>current.state.players[capture.value!].full?'A potion filled':'Travellers covered':miss?(miss.text??'The search found no traveller'):'');
      try{save(r);setSavedLabel('Saved on this device')}catch{setSavedLabel('Storage unavailable · export a backup')}
      const pass=()=>{latest.current={...latest.current,busy:false};setBusy(false);if(reviewable){setReviewAction(true);setHandCollapsed(false);return;}setBefore(null);if(prefs.privateHands&&actingSeat(next)!==actingSeat(current.state!)&&!next.players[actingSeat(next)].bot&&next.phase!=='gameover')setHandoff(true);};
      if(duration)unlock.current=setTimeout(pass,duration+80);else pass();
    }catch(e){setError(e instanceof Error?e.message:'That action could not be completed')}
  },[prefs.reducedMotion,prefs.privateHands,reviewAction]);
  useEffect(()=>{
    if(!state||busy||reviewAction||paused||handoff||panel==='setup'||state.phase==='gameover')return;
    const actor=actingSeat(state),bot=state.players[actor].bot;
    const automatic=bot?chooseBotAction(state,memories.current[actor]??{}):automaticAction(state);
    if(!automatic)return;
    const timer=setTimeout(()=>dispatch(automatic,true),bot?prefs.botDelay:180);return()=>clearTimeout(timer);
  },[state,busy,reviewAction,paused,handoff,panel,dispatch,prefs.botDelay]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),2800);return()=>clearTimeout(timer)},[notice]);
  useEffect(()=>{setFocusedOwner(null);setPeek(false)},[state?.current]);
  useEffect(()=>{if(reviewAction)document.querySelector<HTMLButtonElement>('.move-review button')?.focus({preventScroll:true})},[reviewAction]);
  const shared=state?.mode==='solo'||state?.mode==='cooperative',actor=state?actingSeat(state):0,p=state?.players[actor],resources=state?.players[resourceSeat(state)],locked=!state||busy||reviewAction||paused||handoff||!!p?.bot;
  const reviewState=before??state,reviewFaction=reviewState?.players[actingSeat(reviewState)].faction;
  const reviewArtPrefix=reviewFaction==='Rabbits'||reviewFaction==='Rats'||reviewFaction==='Badgers'?reviewFaction.toLowerCase()+'-':'';
  const moves=state?.phase==='move'?legalMoves(state):[],spells=state?availableSpells(state):[];
  const canUndoCard=!!state&&state.phase==='move'&&!!state.pending?.card&&!state.pending.card.dice&&record?.actions.at(-1)?.type==='play';
  const castChoices=state&&chosenSpell?spellActions(state,chosenSpell):[];
  const chosenMove=moves.find(m=>m.target===selected);
  const positionOf=(id:string)=>state?.towers[id]?towerLocation(state,id).space:wizardLocation(state!,id)?.space??0;
  const destination=chosenMove&&!locked?mod(positionOf(chosenMove.target)+chosenMove.steps):undefined;
  const boardTargets=locked||selected?[]:moves.filter(m=>optionSpace===null||positionOf(m.target)===optionSpace).map(m=>m.target);
  const pick=useCallback((id:string)=>{
    const s=latest.current.state;if(!s||latest.current.busy)return;
    const space=id.startsWith('space-')?Number(id.slice(6)):s.towers[id]?towerLocation(s,id).space:wizardLocation(s,id)?.space;
    if(space===undefined)return;
    if(chosenMove&&!locked&&space===destination){dispatch({type:'move',move:chosenMove});return;}
    if(id.startsWith('space-')&&!s.board[space].towers.length&&!s.board[space].ground.length)return;
    if(id==='keep'){setInspected(space);setOptionSpace(space);setSelected('');setPanel('home');return;}
    if(id.startsWith('space-')&&s.board[space].towers.at(-1)==='keep'){setInspected(space);setOptionSpace(space);setSelected('');setPanel('home');return;}
    setInspected(space);setOptionSpace(space);setSelected(s.wizards[id]?id:spaceSelection(s,space,moves));setPanel('inspect');setHandCollapsed(false);
  },[chosenMove,locked,destination,dispatch,moves]);
  const selectPiece=(id:string)=>{if(!state||locked)return;setOptionSpace(inspected);setSelected(state.towers[id]?spaceSelection(state,inspected,moves,id):id)};
  const begin=(config:Config)=>{try{
    setPrefs(v=>({...v,privateHands:false}));install(newRecord(createGame(config)));setHandoff(false);
  }catch(e){setError((e as Error).message)}};
  const actionLabel=(a:Action):string=>a.type==='spell'?a.spell==='nudge'?(a.direction===1?'Clockwise':'Counterclockwise'):a.spell==='swap'?`${turretLabel(state!,a.target!)} ↔ ${turretLabel(state!,a.other!)}`:a.target?.startsWith('T')?`${a.spell==='rescue'?'Search beneath':turretLabel(state!,a.target)}`:state!.players[state!.wizards[a.target!].owner].faction:'';
  const confirmMove=()=>{const current=latest.current;if(!current.state)return;latest.current={...current,busy:false};setReviewAction(false);setBefore(null);if(prefs.privateHands&&before&&actingSeat(current.state)!==actingSeat(before)&&!current.state.players[actingSeat(current.state)].bot&&current.state.phase!=='gameover')setHandoff(true);};
  const restoreRecord=(r:GameRecord,message:string)=>{const previous=replay(r);latest.current={...latest.current,state:previous,record:r,busy:false};setRecord(r);setState(previous);setBefore(null);setBusy(false);setReviewAction(false);setSelected('');setOptionSpace(null);setChosenSpell(null);setPanel(null);setNotice(message);try{save(r);setSavedLabel('Saved on this device')}catch{setSavedLabel('Storage unavailable · export a backup')}};
  const undoCard=()=>{const current=latest.current;if(!current.record||!canUndoCard)return;restoreRecord({...current.record,actions:current.record.actions.slice(0,-1),savedAt:new Date().toISOString()},'Card undone');};
  const undoMove=()=>{const current=latest.current;if(!current.record||!before)return;const previousAction=current.record.actions.at(-2),removeCard=before.phase==='move'&&before.pending?.card&&!before.pending.card.dice&&previousAction?.type==='play',count=removeCard?2:1;restoreRecord({...current.record,actions:current.record.actions.slice(0,-count),savedAt:new Date().toISOString()},'Move undone');};
  const download=()=>{if(!record)return;const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='cascading-castles-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const importGame=async(f:File)=>{try{if(f.size>20_000_000)throw Error('That save is too large.');const r=parseSave(await f.text());install(r);}catch(e){setError('Import failed: '+(e as Error).message)}};
  return <div className="game-shell" data-phase={state?.phase??'setup'} data-busy={busy} data-current={state?.current??0} style={{'--house':FACTIONS.find(f=>f.name===p?.faction)?.color??'#54b6ad'} as CSSProperties}>
    <header className="game-header"><div className="brand"><CastleMark/><h1>Cascading Castles</h1></div>
      <div className="turn-label">{p&&<Portrait faction={p.faction}/>}<strong>{state?state.phase==='gameover'?'The gathering ends':state.phase==='reaction'?`${p!.name} · interrupt`:`${p!.name}’ turn`:'Gather the houses'}</strong>{state&&<span className="turn-dots" aria-label={`${state.actions} card actions used`}>{state.actions>=1?'●':'○'} {shared?'':state.actions>=2?'●':'○'}</span>}</div>
      {resources&&<Potions player={resources}/>}
      <nav><button onClick={()=>setPanel(panel==='houses'?null:'houses')} aria-expanded={panel==='houses'}>Houses</button><button onClick={()=>{setChosenSpell(null);setPanel(panel==='spells'?null:'spells')}} aria-expanded={panel==='spells'}>Spells</button><button disabled={!state||handoff} onClick={()=>setPeek(v=>!v)} aria-pressed={peek} className="peek-toggle">Peek</button><button className="tutorial-toggle" onClick={()=>setPrefs(v=>({...v,tutorial:!v.tutorial}))} aria-pressed={prefs.tutorial}>Tutorial</button><button onClick={()=>{setPaused(true);setPanel('settings')}} aria-label="Settings and saves">☷</button></nav>
    </header>
    <main className="game-table">
      {state?<GameBoard boardId={prefs.boardId} state={state} before={before} selected={selected} targets={boardTargets} destinationSpace={destination} reducedMotion={prefs.reducedMotion} onPick={pick} activeOwner={state.phase==='move'?-1:actor} focusedOwner={state.phase==='move'?null:focusedOwner} peek={peek&&!handoff}/>:<img className="welcome-board" src={import.meta.env.BASE_URL+boardTheme(prefs.boardId).image} alt={`${boardTheme(prefs.boardId).name} game board`}/>}
      {focusedOwner!==null&&state&&<button className="focus-house" onClick={()=>setFocusedOwner(null)}>{state.players[focusedOwner].name} highlighted ×</button>}
      {peek&&!handoff&&<div className="peek-notice">Peek · buried pieces revealed</div>}
      {state&&<div className="round-label">{state.finalRound?'Final round':`Round ${state.round}`} · {state.mode==='teams'?'Partners':shared?'Shared journey':'Clockwise'}</div>}
      {prefs.tutorial&&<div className="tutorial-help"><b>{state?.phase==='roll'?'Accept the die or reroll.':state?.phase==='move'?'Choose an exposed traveller or a turret level.':state?.phase==='reaction'?'Cast a spell or pass priority.':shared?'Play one card each turn.':'Play two cards, one at a time.'}</b><p>Move the full value clockwise. Turrets carry everything above them and hide animals they land on. A capture fills one potion. Bring all your animals home and fill every bottle; spent potions count.</p></div>}
      {notice&&<div className="game-notice" role="status">{notice}</div>}
      {error&&<div className="game-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
      {state&&<section className={`hand-tray ${handCollapsed?'collapsed':''}`} aria-label="Current hand" data-review={reviewAction}>
        <button className="hand-toggle" aria-label={handCollapsed?'Show hand':'Hide hand'} onClick={()=>setHandCollapsed(v=>!v)}>{handCollapsed?'Show hand':'−'}</button>
        <div className="hand-owner">{p?.bot?'BOT':shared?'SHARED HAND':p?.name}<small>{busy?'Travelling…':paused?'Paused':state.phase==='reaction'?`${state.reaction!.stage} movement`:state.phase==='move'?panel==='inspect'?selectedCardDescription(state.pending):chosenMove?'Click the highlighted clearing':optionSpace===null?'Choose a clearing':'Choose a tower or unit':state.phase==='roll'?'Choose your roll':state.phase==='after'?'A spell, or continue':state.phase==='gameover'?'Journey complete':''}</small></div>
        <div className="hand-body">
          {reviewAction?<div className="move-review" role="group" aria-label="Review the completed move"><small>Review your move</small><button className="primary review-art-button" onClick={confirmMove}><img src={`${import.meta.env.BASE_URL}art/actions/${reviewArtPrefix}confirm-v1.png`} alt=""/><span>Confirm</span></button><button className="review-art-button" onClick={undoMove}><img src={`${import.meta.env.BASE_URL}art/actions/${reviewArtPrefix}undo-v1.png`} alt=""/><span>Undo</span></button></div>:panel==='inspect'?<SpaceInspector state={state} space={inspected} boardId={prefs.boardId} selected={selected} moves={moves.filter(m=>positionOf(m.target)===inspected)} locked={locked} actor={actor} focusedOwner={focusedOwner} peek={peek&&!handoff} towerLabel={id=>turretLabel(state,id)} onSelect={selectPiece} onClose={()=>{setPanel(null);setSelected('');setOptionSpace(null)}}/>:<div className="hand-cards">{hand(state).map(c=><MovementCard key={c.id} card={c} hidden={!!p?.bot||handoff||!shared&&actor!==state.current} disabled={locked||state.phase!=='choose'} onClick={()=>dispatch({type:'play',card:c.id})}/>)}{state.pending?.card&&<MovementCard card={state.pending.card} committed disabled/>}</div>}
        </div>
          {!reviewAction&&<div className="hand-actions">
          {panel===null&&state.phase==='choose'&&!shared&&state.actions===0&&!state.pending&&<button disabled={locked} onClick={()=>dispatch({type:'refresh'})}>Refresh hand<small>Turret +1 · whole hand</small></button>}
        {state.phase==='move'&&selected!=='keep'&&state.towers[selected]&&(()=>{const pending=state.pending!,steps=pending.refresh?1:pending.card!.tower<0?pending.roll!:pending.card!.tower;return steps>0&&state.board[mod(inspected+steps)].towers.includes('keep')?<button disabled={locked} onClick={()=>dispatch({type:'mistake',tower:selected})}>Commit blocked lift · ends turn</button>:null})()}
          {canUndoCard&&<button onClick={undoCard}>Undo card</button>}
          {state.phase==='move'&&panel!=='inspect'&&!locked&&<button onClick={()=>{setPanel('inspect');setHandCollapsed(false)}}>Choose a piece</button>}
          {state.phase==='after'&&<button className="primary" disabled={locked} onClick={()=>dispatch({type:'continue'})}>{state.actions>=(shared?1:2)?'End turn':'Next card'}</button>}
          {state.phase==='reaction'&&<button className="primary" disabled={locked} onClick={()=>dispatch({type:'passReaction'})}>Pass</button>}
          {state.phase==='roll'&&<><Die value={state.pending!.roll!} rollKey={record?.actions.length??0} rolling={busy&&state.events.some(e=>e.kind==='roll')} reducedMotion={prefs.reducedMotion}/><button className="primary" disabled={locked} onClick={()=>dispatch({type:'accept'})}>Keep {state.pending!.roll}</button><button disabled={locked||!state.pending!.rerolls} onClick={()=>dispatch({type:'reroll'})}>Reroll · {state.pending!.rerolls}</button></>}
          {p?.bot&&state.phase!=='gameover'&&<button onClick={()=>setPaused(v=>!v)}>{paused?'Resume bots':'Pause bots'}</button>}
        </div>}
      </section>}
      {panel==='setup'&&<SetupWizard preferences={prefs} onPreferences={update=>setPrefs(v=>({...v,...update}))} onBegin={begin} onCancel={state?()=>setPanel(null):undefined} onImport={!state?()=>file.current?.click():undefined}/>}
      {panel==='houses'&&state&&<Drawer title="The houses" left onClose={()=>setPanel(null)}>{state.players.map((q,i)=><button className="house-standing" aria-label={`Highlight ${q.name} pieces`} aria-pressed={focusedOwner===i} onClick={()=>{setFocusedOwner(i);setPanel(null)}} key={i}><Portrait faction={q.faction}/><span><h3>{q.name}{i===state.current?' · turn':''}</h3><small>{q.bot?'Bot':'Human'}{partner(state,i)!==null?` · partner: ${state.players[partner(state,i)!].name}`:''}</small><p>{state.entered.filter(id=>state.wizards[id].owner===i).length}/{q.wizardCount} home</p><Potions player={q}/></span></button>)}</Drawer>}
      {panel==='home'&&state&&<Drawer title="Home in the Keep" onClose={()=>setPanel(null)}>{state.board[towerLocation(state,'keep').space].towers.length>1&&<button onClick={()=>{const space=towerLocation(state,'keep').space;setInspected(space);setSelected(state.board[space].towers.at(-2)!);setPanel('inspect')}}>Inspect keep’s stack</button>}{state.players.filter(q=>q.wizardCount).map(q=>{const owner=state.players.indexOf(q),done=state.entered.filter(id=>state.wizards[id].owner===owner);return <article className="arrival-row" key={owner}><div><Portrait faction={q.faction}/><h3>{q.name}<small>{done.length} / {q.wizardCount}</small></h3></div><div className="arrival-slots">{Array.from({length:q.wizardCount},(_,i)=>i<done.length?<Figure key={i} faction={q.faction} completed/>:<span key={i} className="empty-arrival" aria-label="Not yet home"/>)}</div></article>})}</Drawer>}
      {panel==='spells'&&state&&<Drawer title="The spellbook" onClose={()=>{setPanel(null);setChosenSpell(null)}}>
        <div className="spell-list">{state.spells.map(id=><button key={id} className={chosenSpell===id?'selected':''} disabled={locked||!spells.includes(id)} onClick={()=>setChosenSpell(id)}><img src={`${import.meta.env.BASE_URL}art/cards/revision-05/faces/${id}.png`} alt=""/><strong>{SPELLS[id].name}<span>{SPELLS[id].cost} ◇</span></strong><small>{SPELLS[id].description}</small></button>)}</div>
        {chosenSpell&&<div className="spell-targets"><h3>{SPELLS[chosenSpell].name}</h3>{castChoices.map((a,i)=><button key={i} disabled={locked} onClick={()=>dispatch(a)}>{actionLabel(a)}<small>Cast · {SPELLS[chosenSpell].cost} potion{SPELLS[chosenSpell].cost>1?'s':''}</small></button>)}</div>}
      </Drawer>}
      {panel==='settings'&&<Drawer title="Settings and saves" onClose={()=>{setPanel(null);setPaused(false)}}>
        <BoardPicker value={boardTheme(prefs.boardId).id} onChange={boardId=>setPrefs(v=>({...v,boardId}))}/>
        <p className="save-label">{savedLabel}</p><button onClick={()=>{setPanel(null);setPaused(false)}}>Resume game</button>
        <label className="check"><input type="checkbox" checked={prefs.privateHands} onChange={e=>setPrefs(v=>({...v,privateHands:e.target.checked}))}/>Private handoff</label>
        <label className="check"><input type="checkbox" checked={prefs.reducedMotion} onChange={e=>setPrefs(v=>({...v,reducedMotion:e.target.checked}))}/>Reduced motion</label>
        <label className="check"><input type="checkbox" checked={prefs.tutorial} onChange={e=>setPrefs(v=>({...v,tutorial:e.target.checked}))}/>Tutorial</label>
        <label>Bot pace<select value={prefs.botDelay} onChange={e=>setPrefs(v=>({...v,botDelay:Number(e.target.value)}))}><option value={150}>Quick</option><option value={700}>Steady</option><option value={1600}>Leisurely</option></select></label>
        <button disabled={!record} onClick={download}>Export save</button><button onClick={()=>file.current?.click()}>Import save</button>
        {state?.mode==='teams'&&<button onClick={()=>{setPaused(false);setGiveCard(null);setTakeCard(null);setPanel('partner')}}>Partner exchange</button>}
        <button onClick={()=>{setPaused(false);setPanel('setup')}}>New gathering</button>
        <a href="./flow/">Game flow walkthrough ↗</a>
        <a href="./cards/" target="_blank" rel="noreferrer">The card collection ↗</a>
      </Drawer>}
      {panel==='partner'&&state&&partner(state,state.current)!==null&&<Drawer title="Partners" onClose={()=>setPanel(null)}>
        <h3>{state.players[partner(state,state.current)!].name}</h3><div className="exchange-cards"><span>Offer</span>{hand(state).map(c=><button key={c.id} className={giveCard===c.id?'selected':''} onClick={()=>setGiveCard(c.id)}>{cardText(c)}</button>)}<span>Receive</span>{state.players[partner(state,state.current)!].hand.map(c=><button key={c.id} className={takeCard===c.id?'selected':''} onClick={()=>setTakeCard(c.id)}>{cardText(c)}</button>)}</div>
        <button className="primary" disabled={locked||state.exchanged||state.phase!=='choose'||giveCard===null||takeCard===null} onClick={()=>dispatch({type:'exchange',give:giveCard!,take:takeCard!})}>Exchange</button>
        <button disabled={locked||!state.players[state.current].full} onClick={()=>dispatch({type:'givePotion',count:1})}>Give one full potion</button><button disabled={locked||!state.players[partner(state,state.current)!].full} onClick={()=>dispatch({type:'givePotion',count:1,fromPartner:true})}>Receive one full potion</button>
      </Drawer>}
      {state?.phase==='rescue'&&<Drawer title="A traveller found" onClose={()=>{}}><p>Choose one traveller to bring to the exposed roof.</p><div className="roof-residents">{state.search!.choices.map(id=><button key={id} disabled={locked} onClick={()=>dispatch({type:'chooseRescue',wizard:id})}><Figure faction={state.players[state.wizards[id].owner].faction}/><small>{state.players[state.wizards[id].owner].faction}</small></button>)}</div></Drawer>}
      {handoff&&state&&<div className="handoff"><Portrait faction={p!.faction}/><h2>{p!.name}</h2><button className="primary" onClick={()=>setHandoff(false)}>Show my hand</button></div>}
      {state?.phase==='gameover'&&!victoryDismissed&&!reviewAction&&!busy&&<div className="victory"><div className="eyebrow">THE GATHERING ENDS</div><h2>{state.lost?'The road grows quiet':state.winners.map(i=>state.players[i].name).join(' & ')+' prevail'}</h2><div className="victory-animals">{(state.winners.length?state.winners:[0]).map(i=><Figure key={i} faction={state.players[i].faction} completed={!state.lost}/>)}</div><p>{shared?`${state.cardsPlayed} movement cards · ${state.cardsPlayed<=30&&!state.lost?'within thirty cards':'journey recorded'}`:'All travellers home. Every bottle filled.'}</p><button onClick={()=>setVictoryDismissed(true)}>Inspect the table</button><button className="primary" onClick={()=>{setPanel('setup');setVictoryDismissed(true)}}>New gathering</button></div>}
      <input ref={file} hidden type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void importGame(f);e.target.value=''}}/>
    </main>
  </div>;
}
