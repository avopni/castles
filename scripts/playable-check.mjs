import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';

const origin=process.env.CASTLES_ORIGIN??'http://127.0.0.1:4186',out=process.env.CASTLES_TEST_DIR??'docs/verification/playable';
await fs.mkdir(out,{recursive:true});
const bundled=await build({stdin:{contents:"export {fixtures} from './scripts/playable-fixtures';export {replay} from './src/engine/storage';export {assertInvariants,legalMoves} from './src/engine/game';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm'});
const {fixtures,replay,assertInvariants}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const port=9270,pause=ms=>new Promise(r=>setTimeout(r,ms));
const SPELL_COST={stride:2,lift:1,headwind:2,undertow:1,swap:2,nudge:2,piggyback:1};
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--no-first-run','--disable-background-networking','--remote-allow-origins=*',`--remote-debugging-port=${port}`,
 `--user-data-dir=${path.resolve('.tools/playable-browser')}`,'--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank'
],{stdio:'ignore',windowsHide:true});
let ws,serial=0;const requests=new Map(),errors=[],checks=[];
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{requests.delete(id);reject(Error('CDP timeout: '+method))},15000);requests.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}));});
try{
 let tab;for(let i=0;i<80;i++){try{tab=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');if(tab)break}catch{}await pause(100)}
 if(!tab)throw Error('Chrome did not start');
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=requests.get(m.id);if(!p)return;requests.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);});
 await call('Page.enable');await call('Runtime.enable');
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value};
 const wait=async(expression,timeout=20000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await pause(100)}throw Error('Timed out: '+expression)};
 const click=selector=>evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b||b.disabled)throw Error('Control missing or disabled: '+${JSON.stringify(selector)});b.click()})()`);
 const button=async(text,scope='')=>evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)}));if(!b||b.disabled)throw Error('Button missing or disabled: '+${JSON.stringify(text)});b.click()})()`);
 const snapshot=async(name)=>{await pause(400);const r=await call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});const png=Buffer.from(r.data,'base64');if(png.length<50000)throw Error('Blank screenshot: '+name);await fs.writeFile(`${out}/${name}.png`,png)};
 const check=(name,condition,details={})=>{if(!condition)throw Error('Failed: '+name+' '+JSON.stringify(details));checks.push({name,...details});console.log('PASS '+name)};
 const prefs={tutorial:false,privateHands:false,reducedMotion:true,botDelay:1};
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:origin+'/'});await wait("Boolean(document.querySelector('.game-shell'))");
 const install=async(name,settings={})=>{
   await evaluate(`localStorage.setItem('cascading-castles-save-v1',${JSON.stringify(JSON.stringify(fixtures[name]))});localStorage.setItem('castles-preferences',${JSON.stringify(JSON.stringify({...prefs,...settings}))})`);
   await call('Page.reload');await wait("Boolean(document.querySelector('.game-board[data-ready=true]'))");await pause(300);
 };
 const saved=async()=>JSON.parse(await evaluate("localStorage.getItem('cascading-castles-save-v1')"));
 const state=async()=>replay(await saved());
 const playFirst=async(name)=>click(`.hand-cards [data-card="${fixtures[name].initial.players[0].hand[0].id}"]`);
 const move=async(target)=>{await wait("Boolean(document.querySelector('.target-list'))");await button(target,'.target-list');await button('Move to space','.game-drawer')};

 // Real setup controls, not a test-only game controller.
 await evaluate("localStorage.removeItem('cascading-castles-save-v1');localStorage.setItem('castles-preferences',"+JSON.stringify(JSON.stringify(prefs))+")");await call('Page.reload');
 await wait("Boolean(document.querySelector('.setup-seats'))");await snapshot('01-setup');await button('Begin gathering');await wait("Boolean(document.querySelector('.game-board[data-ready=true]'))");
 check('setup produces a durable rules-engine session',!!(await saved()).initial);await snapshot('02-table');
 await install('capacity');
 for(const [width,height]of [[1440,960],[1366,768],[1024,768],[900,700],[740,600]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(150);
   const rect=()=>evaluate("JSON.stringify(document.querySelector('.game-board').getBoundingClientRect().toJSON())");const before=await rect();
   await button('Houses','.game-header');const after=await rect();check(`houses preserve board at ${width}`,before===after);
   await click('[aria-label="Close The houses"]');await button('Spells','.game-header');check(`spells preserve board at ${width}`,before===await rect());await click('[aria-label="Close The spellbook"]');
   const fits=await evaluate("({overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,spaces:document.querySelectorAll('.game-board:not(.detail-board) [data-space]').length,visible:Number(document.querySelector('.game-board').dataset.visibleUnits),fallback:document.querySelector('.game-board').dataset.fallback})");
   check(`responsive sixteen-cell board at ${width}`,!fits.overflow&&fits.spaces===16&&fits.visible>=6&&fits.fallback==='false',fits);
   const surface=await evaluate("JSON.parse(document.querySelector('.game-board').dataset.surfaceFit).find(s=>s.count===6)");
   check(`painted six-unit meshes fit at ${width}`,surface.minimumPairGap>0&&surface.minimumWallGap>0&&surface.radii.every(r=>r<=.13+1e-6),surface);
   await snapshot(`capacity-${width}`);
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await click('[data-space="2"]');check('roof inspection shows exactly six exposed animals',await evaluate("document.querySelectorAll('.roof-residents button').length===6"));await snapshot('03-roof-inspection');await click('[aria-label="Close Space 3"]');
 await click('.keep-space');check('arrival ledger has six completed animals',await evaluate("document.querySelectorAll('.arrival-slots .completed').length===6"));await snapshot('04-home-ledger');await click('[aria-label="Close Home in the Keep"]');

 await install('dice');await playFirst('dice');await wait("document.querySelector('.game-shell').dataset.phase==='roll'");const first=await state();await button('Reroll','.hand-actions');const rerolled=await state();check('reroll replaces result and consumes one chance',rerolled.pending.rerolls===first.pending.rerolls-1);await snapshot('05-dice');await button('Keep ','.hand-actions');check('accepting a roll enables target choice',(await state()).phase==='move');

 await install('capture',{reducedMotion:false});await playFirst('capture');await move('Tower 1');await wait("document.querySelector('.game-shell').dataset.busy==='true'");check('movement locks card input',await evaluate("[...document.querySelectorAll('.play-card')].every(b=>b.disabled)"));await pause(300);await snapshot('06-animated-capture');await wait("document.querySelector('.game-shell').dataset.busy==='false'");const captured=await state();check('capture stacks towers and fills one bottle',captured.board[2].towers.includes('T1')&&captured.players[0].full===1);await snapshot('07-capture-result');

 await install('entry');await playFirst('entry');await move('Otters 1');await wait("document.querySelector('.game-shell').dataset.current==='1'");const arrived=await state();check('keep arrival completes animal and ends turn',arrived.entered.includes('P1-1')&&arrived.current===1);check('keep relocates to a raven-marked empty surface',arrived.board.findIndex(c=>c.towers.includes('keep'))!==0);await snapshot('08-arrival');
 const beforeReload=JSON.stringify(await saved());await call('Page.reload');await wait("Boolean(document.querySelector('.game-board[data-ready=true]'))");check('reload restores exact action history',JSON.stringify(await saved())===beforeReload);

 await install('rescue');await button('Spells','.game-header');await button('Unbar the Door','.spell-list');await button('Search beneath 1','.spell-targets');await wait("document.querySelector('.game-shell').dataset.phase==='rescue'");check('paid rescue offers found animals only',(await state()).search.choices.length===2);await snapshot('09-rescue-choice');await button('Otters 2','.roof-residents');const rescued=await state();check('rescue selection spends once and leaves the other animal hidden',rescued.players[0].spent===1&&rescued.towers.T1.residents.includes('P1-2')&&rescued.board[1].ground.includes('P1-1'));

 for(const [spell,title]of [['stride','Fleetfoot'],['lift','Walking Stone'],['headwind','Wayward Wind'],['undertow','Stone Tide'],['swap','Twinned Turrets'],['nudge','Call the Keep'],['piggyback','Fellowship']]){
   await install('spells');
   if(spell==='piggyback'){
     // Choose a traveller card through the actual hand, then pay for a companion.
     const s=await state(),c=s.players[0].hand.find(c=>!!c.wizard&&!c.dice);if(!c)throw Error('Missing fellowship card');await click(`.hand-cards [data-card="${c.id}"]`);
   }
   await button('Spells','.game-header');await button(title,'.spell-list');await click('.spell-targets button');
   const cast=await state();check(`spell ${spell} executes through UI`,cast.players[0].spent===SPELL_COST[spell]);
 }
 await install('partners');await click('[aria-label="Settings and saves"]');await button('Partner exchange');await click('.exchange-cards button');await evaluate("document.querySelectorAll('.exchange-cards button')[3].click()");await button('Exchange','.game-drawer');check('partnership card exchange is recorded',(await state()).exchanged);await button('Give one full potion');check('partnership potion transfer is conserved',(await state()).players[2].full===1);
 await install('interrupt');await playFirst('interrupt');check('interrupt opens before movement',(await state()).reaction.stage==='before');await button('Pass','.hand-actions');check('interrupt priority advances',(await state()).reaction.cursor===1);check('off-turn reaction conceals active hand',await evaluate("[...document.querySelectorAll('.hand-cards .play-card:not(.committed)')].every(b=>b.classList.contains('card-back'))"));await snapshot('10-interrupt');
 await install('entry',{privateHands:true});await button('Show my hand');await playFirst('entry');await move('Otters 1');await wait("Boolean(document.querySelector('.handoff'))");check('private handoff hides next human hand',await evaluate("[...document.querySelectorAll('.hand-cards .play-card:not(.committed)')].every(b=>b.classList.contains('card-back'))"));await snapshot('11-private-handoff');
 await install('tall');await click('[data-space="6"]');await button('Inspect keep’s stack');check('ten-level stack can be inspected',await evaluate("document.querySelectorAll('.tower-levels button').length===10"));await snapshot('12-ten-high');
 await install('victory');check('victory displays winning house',await evaluate("document.querySelector('.victory h2').textContent.includes('Otters')"));await snapshot('13-victory');
 await install('solo');check('solo has twelve shared animals',Object.keys((await state()).wizards).length===12);await install('cooperative');check('cooperation shares twelve animals and one hand',Object.keys((await state()).wizards).length===12&&(await state()).players[1].hand.length===0);
 for(const name of ['bots2','bots4']){
   await install(name);const start=Date.now();let last=0;
   while(Date.now()-start<180000){
     await pause(1000);const r=await saved(),s=replay(r);assertInvariants(s);
     if(r.actions.length>last+100){console.log(`${name}: ${r.actions.length} actions, round ${s.round}`);last=r.actions.length;}
     if(s.phase==='gameover'){check(`${name} completes a full browser game`,!s.lost&&s.winners.length>0,{actions:r.actions.length,rounds:s.round});await snapshot(name+'-complete');break;}
   }
   check(`${name} reaches victory within timeout`,(await state()).phase==='gameover');
 }
 check('no browser runtime exceptions',errors.length===0,{errors});
 await fs.writeFile(`${out}/results.json`,JSON.stringify({date:new Date().toISOString(),origin,checks,errors},null,2));
 console.log(`Verified ${checks.length} playable browser checks.`);
}finally{
 if(ws?.readyState===WebSocket.OPEN){await Promise.race([call('Browser.close').catch(()=>{}),pause(1500)]);ws.close()}chrome.kill();
}
