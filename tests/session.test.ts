import {describe,test,expect} from 'vitest';
import {createGame,assertInvariants,reduceGame,surface} from '../src/engine/game';
import {FACTIONS,SPELLS} from '../src/engine/content';
import {parseSave,replay} from '../src/engine/storage';
import {availableSpells,automaticAction,newRecord,spellActions} from '../src/session';
import {scenePoses} from '../src/sceneLayout';
import type {SpellId,State} from '../src/engine/types';
function game(){return createGame({players:FACTIONS.map(f=>({name:f.name,faction:f.name})),seed:42,spells:Object.keys(SPELLS) as SpellId[]})}
function put(s:State,id:string,space:number){for(const t of Object.values(s.towers))t.residents=t.residents.filter(w=>w!==id);for(const c of s.board)c.ground=c.ground.filter(w=>w!==id);s.board[space].ground.push(id)}
function searchState(){const s=game();s.players[0].full=5;s.players[0].empty=0;put(s,'P1-1',1);put(s,'P1-2',1);return s}
describe('playable session',()=>{
  test('rescue pays before presenting an actual choice and saves mid-search',()=>{
    const s=searchState();const found=reduceGame(s,{type:'spell',spell:'rescue',target:'T1'});
    expect(found.phase).toBe('rescue');expect(found.players[0].full).toBe(4);expect(found.players[0].spent).toBe(1);
    expect(found.search!.choices).toEqual(['P1-1','P1-2']);expect(surface(found,1)).not.toContain('P1-2');
    const record={...newRecord(s),actions:[{type:'spell',spell:'rescue',target:'T1'} as const]};
    expect(replay(parseSave(JSON.stringify(record)))).toEqual(found);
    expect(()=>reduceGame(found,{type:'play',card:found.players[0].hand[0].id})).toThrow();
    expect(()=>reduceGame(found,{type:'chooseRescue',wizard:'P2-1'})).toThrow();
    const chosen=reduceGame(found,{type:'chooseRescue',wizard:'P1-2'});
    expect(chosen.phase).toBe('choose');expect(chosen.search).toBeUndefined();expect(surface(chosen,1)).toContain('P1-2');
    expect(chosen.board[1].ground).toContain('P1-1');expect(chosen.players[0].spent).toBe(1);assertInvariants(chosen);
  });
  test('search availability cannot reveal whether a buried animal exists',()=>{
    const withAnimals=searchState(),emptyFloor=structuredClone(withAnimals);put(emptyFloor,'P1-1',12);put(emptyFloor,'P1-2',12);
    expect(spellActions(withAnimals,'rescue')).toEqual(spellActions(emptyFloor,'rescue'));
  });
  test('automatic continuation preserves a usable spell opportunity',()=>{
    const s=game();s.phase='after';s.actions=2;
    expect(automaticAction(s)).toEqual({type:'continue'});
    s.players[0].full=1;s.players[0].empty=4;
    expect(availableSpells(s)).toContain('lift');expect(automaticAction(s)).toBeNull();
  });
  test('six-unit slots preserve remaining travellers when a companion leaves',()=>{
    const s=game(),slots=new Map();const first=scenePoses(s,slots),id=s.towers.T1.residents[0],remaining=s.towers.T1.residents[1];
    put(s,id,12);const next=scenePoses(s,slots);
    expect(next[remaining]).toEqual(first[remaining]);
    expect(next[id].space).toBe(12);
  });
});
