import { SPELLS } from './engine/content';
import { assertInvariants, hand, legalMoves, reduceGame, surface, towerLocation, wizardLocation } from './engine/game';
import type { Action, SpellId, State } from './engine/types';
import type { Record as GameRecord } from './engine/storage';

export function newRecord(state: State): GameRecord {
  assertInvariants(state);
  return {format:'cascading-castles',version:1,initial:state,actions:[],savedAt:new Date().toISOString()};
}
export function actingSeat(s: State) { return s.phase === 'reaction'||s.phase==='rescue'&&s.search?.resume==='reaction' ? s.reaction!.cursor : s.current; }
export function resourceSeat(s: State) { return s.mode === 'solo' || s.mode === 'cooperative' ? 0 : actingSeat(s); }
export function spellActions(s: State, id: SpellId): Action[] {
  if (s.phase === 'gameover' || s.phase === 'rescue' || !s.spells.includes(id)) return [];
  const actions: Action[]=[];
  const attempt=(a:Action)=>{try{reduceGame(s,a);actions.push(a)}catch{ /* Only show legal public targets. */ }};
  if(id==='nudge') { attempt({type:'spell',spell:id,direction:1});attempt({type:'spell',spell:id,direction:-1}); }
  else if(id==='swap') {
    const tops=s.board.flatMap(c=>c.towers.at(-1)&&c.towers.at(-1)!=='keep'?[c.towers.at(-1)!]:[]);
    tops.forEach((target,i)=>tops.slice(i+1).forEach(other=>attempt({type:'spell',spell:id,target,other})));
  } else if(id==='rescue') {
    // Never probe buried residents to decide whether a search is available.
    // A full roof cannot receive a rescued figure, so disable every search there.
    if ((s.nasty ? s.phase==='reaction' : !s.spellUsed) && s.players[resourceSeat(s)].full >= SPELLS[id].cost &&
      (!(s.mode==='solo'||s.mode==='cooperative') || s.phase==='after'&&s.actions===1)) {
      for(const target of Object.keys(s.towers)) if(target!=='keep') {
        const space=towerLocation(s,target).space;
        if(s.board[space].towers.at(-1)==='keep'||surface(s,space).length<6) {
          if(!s.nasty||!s.actionSpell||s.actionSpell.spell===id&&s.actionSpell.caster===actingSeat(s))
            actions.push({type:'spell',spell:id,target});
        }
      }
    }
  } else {
    const ids=(id==='lift'||id==='undertow') ? Object.keys(s.towers).filter(t=>t!=='keep') :
      Object.keys(s.wizards).filter(w=>wizardLocation(s,w)?.visible);
    ids.forEach(target=>attempt({type:'spell',spell:id,target}));
  }
  return actions;
}
export function availableSpells(s:State) { return s.spells.filter(id=>spellActions(s,id).length>0); }
export function automaticAction(s: State): Action|null {
  if(s.phase==='move'&&!legalMoves(s).length)return {type:'skip'};
  if(s.phase==='after'&&!availableSpells(s).length)return {type:'continue'};
  return null;
}
export function cardName(s: State) { return hand(s).map(c=>c.id); }
export function movementDuration(s:State,reduced:boolean) {
  if(reduced)return 0;
  return s.events.some(e=>e.kind==='enter')?2100:s.events.some(e=>e.kind==='move'||e.kind==='keep')?1350:s.events.some(e=>e.kind==='roll')?900:0;
}
