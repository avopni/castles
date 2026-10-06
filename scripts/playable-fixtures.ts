import {createGame,assertInvariants} from '../src/engine/game';
import {FACTIONS,SPELLS} from '../src/engine/content';
import {newRecord} from '../src/session';
import {reviewState} from '../src/review';
import type {Card,Mode,SpellId,State} from '../src/engine/types';
function game(n=4,mode:Mode='competitive',bot=false){return createGame({players:Array.from({length:n},(_,i)=>({name:FACTIONS[i%4].name,faction:FACTIONS[i%4].name,bot})),mode,seed:42,spells:mode==='solo'||mode==='cooperative'?[]:Object.keys(SPELLS) as SpellId[]})}
function put(s:State,id:string,space:number){for(const t of Object.values(s.towers))t.residents=t.residents.filter(w=>w!==id);for(const c of s.board)c.ground=c.ground.filter(w=>w!==id);s.entered=s.entered.filter(w=>w!==id);s.board[space].ground.push(id)}
function card(s:State,predicate:(c:Card)=>boolean){const source=[s.deck,s.discard,...s.players.map(p=>p.hand)].find(a=>a.some(predicate))!,i=source.findIndex(predicate);[source[i],s.players[0].hand[0]]=[s.players[0].hand[0],source[i]];return s.players[0].hand[0].id}
const states:Record<string,State>={};
states.capacity=reviewState('capacity');states.capacity.players.forEach(p=>p.bot=false);
states.tall=reviewState('height');states.tall.players.forEach(p=>p.bot=false);
states.spells=structuredClone(states.capacity);states.spells.spells=Object.keys(SPELLS) as SpellId[];states.spells.players[0].full=5;states.spells.players[0].empty=0;
states.entry=game(2);put(states.entry,'P1-1',15);card(states.entry,c=>c.wizard===1&&!c.dice);
states.capture=game();card(states.capture,c=>c.tower===1&&!c.dice);
states.dice=game();card(states.dice,c=>c.dice===3&&!!c.wizard);
states.rescue=game();states.rescue.players[0].full=5;states.rescue.players[0].empty=0;put(states.rescue,'P1-1',1);put(states.rescue,'P1-2',1);
states.partners=game(4,'teams');states.partners.players[0].full=1;states.partners.players[0].empty=4;
states.interrupt=game();states.interrupt.nasty=true;states.interrupt.players[0].full=5;states.interrupt.players[0].empty=0;
states.solo=game(1,'solo');states.cooperative=game(3,'cooperative');
states.bots2=game(2,'competitive',true);states.bots4=game(4,'competitive',true);
states.victory=game();const winner=Object.keys(states.victory.wizards).filter(id=>states.victory.wizards[id].owner===0);for(const id of winner){put(states.victory,id,12);states.victory.board[12].ground=states.victory.board[12].ground.filter(w=>w!==id)}states.victory.entered=winner;states.victory.players[0].empty=0;states.victory.players[0].full=5;states.victory.phase='gameover';states.victory.winners=[0];
export const fixtures=Object.fromEntries(Object.entries(states).map(([name,s])=>{assertInvariants(s);return [name,newRecord(s)]}));
