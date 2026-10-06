import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';

const origin=process.env.CASTLES_ORIGIN??'http://127.0.0.1:4186',out='docs/verification/move-feedback';
await fs.mkdir(out,{recursive:true});
const bundled=await build({stdin:{contents:"export {fixtures} from './scripts/playable-fixtures';export {replay} from './src/engine/storage';export {assertInvariants,legalMoves} from './src/engine/game';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm'});
const {fixtures,replay,assertInvariants}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const port=9287,pause=ms=>new Promise(r=>setTimeout(r,ms));
const SPELL_COST={stride:2,lift:1,headwind:2,undertow:1,swap:2,nudge:2,piggyback:1};
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--no-first-run','--disable-background-networking','--remote-allow-origins=*',`--remote-debugging-port=${port}`,
 `--user-data-dir=${path.resolve('.tools/hand-dock-browser')}`,'--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank'
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
 const snapshot=async(name)=>{await pause(400);const r=await call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});const png=Buffer.from(r.data,'base64');if(png.length<50000)throw Error('Blank screenshot: '+name);await fs.writeFile(`${out}/${name}-${Date.now()}.png`,png)};
 const check=(name,condition,details={})=>{if(!condition)throw Error('Failed: '+name+' '+JSON.stringify(details));checks.push({name,...details});console.log('PASS '+name)};
 const prefs={tutorial:false,privateHands:false,reducedMotion:true,botDelay:1,boardId:'valley'};
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:origin+'/'});await wait("Boolean(document.querySelector('.game-shell'))");
 await evaluate(`localStorage.setItem('cascading-castles-save-v1',${JSON.stringify(JSON.stringify(fixtures.capacity))});localStorage.setItem('castles-preferences',${JSON.stringify(JSON.stringify(prefs))})`);
 await call('Page.reload');await pause(600);await wait("Boolean(document.querySelector('.game-board[data-ready=true]'))");
 const install=async(name,extra={})=>{await evaluate(`localStorage.setItem('cascading-castles-save-v1',${JSON.stringify(JSON.stringify(fixtures[name]))});localStorage.setItem('castles-preferences',${JSON.stringify(JSON.stringify({...prefs,...extra}))})`);await call('Page.reload');await wait("!!document.querySelector('.game-board[data-ready=true]')");await pause(250)};
 const rect=()=>evaluate("JSON.stringify(document.querySelector('.hand-tray').getBoundingClientRect().toJSON())");
 const boardRect=()=>evaluate("JSON.stringify(document.querySelector('.game-table>.game-board').getBoundingClientRect().toJSON())");
 for(const [width,height] of [[1440,960],[1366,768],[1024,768],[740,600]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await install('capacity');
  const handBefore=await rect(),boardBefore=await boardRect(),savedBefore=await evaluate("localStorage.getItem('cascading-castles-save-v1')");
  const cards=await evaluate("(()=>{const b=document.querySelector('.hand-body').getBoundingClientRect(),cards=[...document.querySelectorAll('.hand-cards .play-card')].map(c=>c.getBoundingClientRect());return {fill:cards.reduce((sum,c)=>sum+c.width,0)/b.width,ratios:cards.map(c=>c.width/c.height)}})()");
  check('large cards retain their proportions at '+width,cards.fill>.84&&cards.ratios.every(r=>Math.abs(r-2/3)<.02),cards);await snapshot('large-cards-'+width);
  check('main spaces have no visible index labels',await evaluate("[...document.querySelectorAll('.game-table>.game-board .space-button')].every(b=>![...b.childNodes].some(n=>n.nodeType===3&&/\\d/.test(n.textContent)))"));
  await click('[data-space="2"]');await wait("!!document.querySelector('.hand-tray .detail-board[data-ready=true]')");
  check('inspection keeps hand and board footprint at '+width,await rect()===handBefore&&await boardRect()===boardBefore);
  const layout=await evaluate(`(()=>{const tray=document.querySelector('.hand-tray').getBoundingClientRect(),cols=[...document.querySelectorAll('.dock-columns>section')].map(e=>e.getBoundingClientRect());return {drawer:!!document.querySelector('.game-drawer'),units:document.querySelectorAll('.dock-units .roof-residents button').length,figures:[...document.querySelectorAll(".dock-units .figure")].every(e=>e.getBoundingClientRect().height>=12),columns:cols[0].right<=cols[1].left&&cols[1].right<=cols[2].left,bad:[...document.querySelectorAll(".hand-tray button,.hand-tray select")].filter(e=>!e.closest(".tower-levels")&&e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.left<tray.left||r.right>tray.right||r.top<tray.top||r.bottom>tray.bottom}).map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON()})),contained:[...document.querySelectorAll('.hand-tray button,.hand-tray select')].filter(e=>!e.closest('.tower-levels')&&e.getClientRects().length).every(e=>{const r=e.getBoundingClientRect();return r.left>=tray.left&&r.right<=tray.right&&r.top>=tray.top&&r.bottom<=tray.bottom}),overflow:document.documentElement.scrollWidth>innerWidth,spaceCollision:[...document.querySelectorAll('.game-table>.game-board [data-space]')].some(e=>{const r=e.getBoundingClientRect();return r.right>tray.left&&r.left<tray.right&&r.bottom>tray.top&&r.top<tray.bottom})}})()`);
  await snapshot('layout-debug-'+width);
  check('three columns, six roof units and no added board overlay at '+width,!layout.drawer&&layout.units===6&&layout.columns&&layout.figures&&layout.contained&&!layout.overflow&&!layout.spaceCollision,layout);
  check('unit labels only show house names',await evaluate("[...document.querySelectorAll('.dock-units small')].every(e=>/^(Otters|Badgers|Rats|Rabbits)$/.test(e.textContent))"));
  await snapshot('six-units-'+width);
  await click('[aria-label="Next space"]');check('next space stays in card panel',await evaluate("document.querySelector('[aria-label=\"Inspect space\"]').value==='3'")&&await rect()===handBefore);
  await click('[aria-label="Previous space"]');check('inspection preserves save',await evaluate("localStorage.getItem('cascading-castles-save-v1')")===savedBefore);
  await click('[aria-label="Close Space 3"]');check('closing inspection restores cards without resizing',await evaluate("!!document.querySelector('.hand-body>.hand-cards')")&&await rect()===handBefore);
  await install('capture');const beforeCard=await rect();
  await click(`.hand-cards [data-card="${fixtures.capture.initial.players[0].hand[0].id}"]`);await wait("!!document.querySelector('.space-inspector')");
  check('card opens dock automatically without resizing at '+width,await rect()===beforeCard&&!await evaluate("!!document.querySelector('.game-drawer')"));
  check('card initially highlights multiple origins',await evaluate("document.querySelectorAll('.game-table>.game-board .target-space').length>1"));
  await click('[data-space="1"]');
  check('choosing a space clears other origins',await evaluate("document.querySelectorAll('.game-table>.game-board .target-space').length===1&&document.querySelector('.game-table>.game-board .target-space').dataset.space==='1'"));
  await click('.tower-levels button');await wait("!!document.querySelector('.game-table>.game-board .destination-space')");
  check('piece selection highlights one destination without a move button',await evaluate("document.querySelectorAll('.game-table>.game-board .destination-space').length===1&&document.querySelector('.destination-space').dataset.space==='2'&&document.querySelectorAll('.game-table>.game-board .target-space').length===0&&![...document.querySelectorAll('.hand-actions button')].some(b=>b.textContent.startsWith('Move to'))"));
  await snapshot('destination-'+width);
  await click('[data-space="3"]');check('choosing another space clears stale destination',await evaluate("!document.querySelector('.game-table>.game-board .destination-space')&&document.querySelectorAll('.game-table>.game-board .target-space').length===1"));
  await snapshot('card-choices-'+width);
  await button('Undo card','.hand-actions');await wait("document.querySelector('.game-shell').dataset.phase==='choose'");check('undo restores cards without resizing at '+width,await rect()===beforeCard);
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await install('capture',{reducedMotion:false});const motionRect=await rect();
 await click(`.hand-cards [data-card="${fixtures.capture.initial.players[0].hand[0].id}"]`);await wait("!!document.querySelector('.space-inspector')");
 await click('[data-space="1"]');await click('.tower-levels button');await wait("!!document.querySelector('.game-table>.game-board .destination-space')");await click('.game-table>.game-board .destination-space');await wait("document.querySelector('.game-shell').dataset.busy==='true'");
 check('lift keeps fixed card panel',await rect()===motionRect);await wait("!!document.querySelector('.move-review')");
 check('review fills same fixed panel and hides cards',await rect()===motionRect&&await evaluate("(()=>{const b=document.querySelector('.hand-body').getBoundingClientRect(),buttons=[...document.querySelectorAll('.move-review button')].map(e=>e.getBoundingClientRect());return !document.querySelector('.hand-tray .play-card')&&!document.querySelector('.hand-actions')&&buttons.every(r=>r.height>b.height*.7)&&buttons.reduce((n,r)=>n+r.width,0)>b.width*.9})()"));await snapshot('move-review');
 await button('Undo','.move-review');await wait("document.querySelector('.game-shell').dataset.phase==='choose'");
 check('undo move restores initial session',await evaluate(`JSON.parse(localStorage.getItem('cascading-castles-save-v1')).actions.length===${fixtures.capture.actions.length}`));
 await install('capacity');await click(`.hand-cards [data-card="${fixtures.capacity.initial.players[0].hand[0].id}"]`);await wait("!!document.querySelector('.space-inspector')");await click('[data-space="2"]');
 await click('.dock-units .roof-residents button:not(:disabled)');await wait("!!document.querySelector('.game-table>.game-board .destination-space')");await click('.game-table>.game-board .destination-space');
 const moved=replay(JSON.parse(await evaluate("localStorage.getItem('cascading-castles-save-v1')")));assertInvariants(moved);check('right column selects and moves a unit',moved.events.some(e=>e.kind==='move'&&e.ids.some(id=>!!moved.wizards[id])));
 await wait("!!document.querySelector('.move-review')");check('reduced motion still offers confirm and undo',await evaluate("!document.querySelector('.hand-tray .play-card')"));await button('Confirm','.move-review');await wait("!document.querySelector('.move-review')");check('confirm restores normal card panel',await evaluate("!!document.querySelector('.hand-cards')"));
 await install('dice',{reducedMotion:false});const diceRect=await rect();await click(`.hand-cards [data-card="${fixtures.dice.initial.players[0].hand[0].id}"]`);await wait("document.querySelector('.game-shell').dataset.phase==='roll'");check('dice preserve panel size',await rect()===diceRect);await wait("document.querySelector('.game-shell').dataset.busy==='false'");await button('Keep ','.hand-actions');await wait("!!document.querySelector('.space-inspector')");check('accepted die opens choices in same panel',await rect()===diceRect);await snapshot('dice-choices');
 await install('entry');await click(`.hand-cards [data-card="${fixtures.entry.initial.players[0].hand[0].id}"]`);await wait("!!document.querySelector('.space-inspector')");await click('.game-table>.game-board [data-space="15"]');await click('.dock-units [data-unit-id="P1-1"]');await wait("!!document.querySelector('.game-table>.game-board .destination-space')");
 check('Home is highlighted as the destination',await evaluate("document.querySelector('.game-table>.game-board .destination-space').dataset.space==='0'"));await click('.game-table>.game-board .destination-space');await wait("!!document.querySelector('.move-review')");
 const entered=replay(JSON.parse(await evaluate("localStorage.getItem('cascading-castles-save-v1')")));assertInvariants(entered);check('clicking Home performs arrival before opening its ledger',entered.events.some(e=>e.kind==='enter')&&!await evaluate("!!document.querySelector('.game-drawer')"));await button('Confirm','.move-review');
 check('no runtime exceptions',errors.length===0,{errors});
 await fs.writeFile(out+'/results.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
}finally{
 if(ws?.readyState===WebSocket.OPEN){await Promise.race([call('Browser.close').catch(()=>{}),pause(1500)]);ws.close()}chrome.kill();
}
