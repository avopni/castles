import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';
const origin=process.env.CASTLES_ORIGIN??'http://127.0.0.1:4186',out='docs/verification/flow';
await fs.mkdir(out,{recursive:true});await fs.mkdir('.tools/downloads',{recursive:true});
const code=await build({stdin:{contents:"export {fixtures} from './scripts/playable-fixtures';export {replay} from './src/engine/storage';export {reduceGame,assertInvariants} from './src/engine/game';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {fixtures,replay,reduceGame,assertInvariants}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
const pause=ms=>new Promise(r=>setTimeout(r,ms)),port=9272;
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--remote-allow-origins=*',`--remote-debugging-port=${port}`,`--user-data-dir=${path.resolve('.tools/flow-browser-'+Date.now())}`,'--window-size=1440,960','about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,serial=0;const requests=new Map(),checks=[];
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,t=setTimeout(()=>{requests.delete(id);reject(Error('Timeout: '+method))},20000);requests.set(id,{resolve:r=>{clearTimeout(t);resolve(r)},reject:e=>{clearTimeout(t);reject(e)}});ws.send(JSON.stringify({id,method,params}));});
try{
 let tab;for(let i=0;i<80;i++){try{tab=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');if(tab)break}catch{}await pause(100)}
 if(!tab)throw Error('Chrome did not start');ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=requests.get(m.id);if(p){requests.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}});
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value};
 const wait=async expression=>{for(let i=0;i<160;i++){if(await evaluate(expression))return;await pause(100)}throw Error('Not ready: '+expression)};
 const button=async(text,scope='')=>evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(b=>b.textContent.trim().startsWith(${JSON.stringify(text)}));if(!b||b.disabled)throw Error('Missing '+${JSON.stringify(text)});b.click()})()`);
 const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
 const check=(name,condition)=>{if(!condition)throw Error('Failed: '+name);checks.push(name);console.log('PASS '+name)};
 const prefs={tutorial:false,privateHands:false,reducedMotion:true,botDelay:700};
 await call('Page.navigate',{url:origin+'/'});await wait("Boolean(document.querySelector('.game-shell'))");
 const install=async(name,options={})=>{await evaluate(`localStorage.setItem('cascading-castles-save-v1',${JSON.stringify(JSON.stringify(fixtures[name]))});localStorage.setItem('castles-preferences',${JSON.stringify(JSON.stringify({...prefs,...options}))})`);await call('Page.reload');await wait("Boolean(document.querySelector('.game-board[data-ready=true]'))");await pause(300)};
 const shot=async name=>{if(process.env.CASTLES_SKIP_SHOTS==='1')return;await call('Page.bringToFront');await pause(200);const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});const png=Buffer.from(r.data,'base64');if(png.length<50000)throw Error('Blank screenshot: '+name);await fs.writeFile(`${out}/${name}.png`,png);console.log('Captured '+name)};
 const saved=async()=>JSON.parse(await evaluate("localStorage.getItem('cascading-castles-save-v1')"));
 const state=async()=>replay(await saved());
 await evaluate("localStorage.removeItem('cascading-castles-save-v1')");await call('Page.reload');await wait("Boolean(document.querySelector('.setup-seats'))");await shot('01-setup');
 await install('capture');await shot('02-table');await click(`.hand-cards [data-card="${fixtures.capture.initial.players[0].hand[0].id}"]`);await wait("Boolean(document.querySelector('.target-list'))");await shot('03-card-and-targets');await button('Tower 1','.target-list');await shot('04-confirm-move');await button('Move to space');await wait("document.querySelector('.game-shell').dataset.phase==='after'");await shot('05-capture');
 await button('Next card','.hand-actions');await click('.hand-cards .play-card:not(:disabled)');await wait("Boolean(document.querySelector('.target-list'))");await button('Tower ','.target-list');await button('Move to space');await wait("document.querySelector('.game-shell').dataset.phase==='after'");await button('End turn','.hand-actions');await wait("document.querySelector('.game-shell').dataset.current==='1'");check('human two-card turn refills and passes',(await state()).players[0].hand.length===3);
 await install('capacity');await click('[data-space="2"]');await shot('06-six-unit-roof');await click('[aria-label="Close Space 3"]');await click('.keep-space');await shot('07-home-ledger');
 await install('dice');await click(`.hand-cards [data-card="${fixtures.dice.initial.players[0].hand[0].id}"]`);await shot('08-dice');
 await install('spells');await button('Spells','.game-header');await button('Walking Stone','.spell-list');await shot('09-spell-targets');
 await install('rescue');await button('Spells','.game-header');await button('Unbar the Door','.spell-list');await button('Search beneath 1','.spell-targets');await shot('10-rescue-choice');
 await install('entry',{privateHands:true});await shot('11-private-handoff');
 await install('tall');await click('[data-space="6"]');await button('Inspect keep’s stack');await shot('12-ten-high');
 await install('victory');await shot('13-victory');
 if(process.env.CASTLES_ONLY_SHOTS!=='1'){
 // Browser-native file import/export.
 await install('entry');await click('[aria-label="Settings and saves"]');
 await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve('.tools/downloads')});await button('Export save');
 for(let i=0;i<50;i++){try{await fs.stat('.tools/downloads/cascading-castles-save.json');break}catch{await pause(100)}}
 const exported=JSON.parse(await fs.readFile('.tools/downloads/cascading-castles-save.json','utf8'));check('export creates a replayable save',replay(exported).version===1);
 const imported=JSON.stringify(fixtures.capacity);await fs.writeFile('.tools/import-test.json',imported);await fs.writeFile('.tools/import-invalid.json','{"format":"unknown"}');
 const upload=async file=>{const doc=await call('DOM.getDocument');const input=await call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[type=file]'});await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path.resolve(file)]});};
 await upload('.tools/import-test.json');await wait("Boolean(document.querySelector('.keep-arrivals'))");check('valid import restores six completed animals',(await state()).entered.length===6);
 await upload('.tools/import-invalid.json');await wait("Boolean(document.querySelector('.game-error'))");check('invalid import preserves current save',(await state()).entered.length===6);
 // Interrupt timing through every priority window.
 await install('interrupt');await click(`.hand-cards [data-card="${fixtures.interrupt.initial.players[0].hand[0].id}"]`);
 for(let i=0;i<4;i++)await button('Pass','.hand-actions');
 if((await state()).phase==='roll')await button('Keep ','.hand-actions');await button('Choose a piece','.hand-actions');await click('.target-list button');await button('Move to space');
 check('interrupt reaches during-move window',(await state()).reaction.stage==='during');for(let i=0;i<4;i++)await button('Pass','.hand-actions');check('interrupt reaches after-move window',(await state()).reaction.stage==='after');for(let i=0;i<4;i++)await button('Pass','.hand-actions');check('interrupt resumes the turn',(await state()).phase==='after');
 // Repo subpath and software-only rendering fallback.
 await call('Page.navigate',{url:'http://127.0.0.1:4188/castles/'});await wait("Boolean(document.querySelector('.game-shell'))");await button('Begin gathering');await wait("Boolean(document.querySelector('.game-board[data-ready=true]'))");check('Pages repository path loads all sixteen cells',await evaluate("document.querySelectorAll('[data-space]').length===16"));await shot('14-pages-path');
 const injected=await call('Page.addScriptToEvaluateOnNewDocument',{source:"const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).startsWith('webgl')?null:original.call(this,type,...args)}"});
 await call('Page.reload');await wait("document.querySelector('.game-board')?.dataset.fallback==='true'");check('fallback retains sixteen accessible board spaces',await evaluate("document.querySelectorAll('[data-space]').length===16"));await shot('15-fallback');await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
 }
 await fs.writeFile(`${out}/${process.env.CASTLES_ONLY_SHOTS==='1'?'captures':'results'}.json`,JSON.stringify({date:new Date().toISOString(),origin,checks},null,2));
}finally{if(ws?.readyState===WebSocket.OPEN){await Promise.race([call('Browser.close').catch(()=>{}),pause(1500)]);ws.close()}chrome.kill();}
