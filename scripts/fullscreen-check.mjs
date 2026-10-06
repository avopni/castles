import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';

const origin=process.env.CASTLES_ORIGIN??'http://127.0.0.1:4186',out='docs/verification/fullscreen-features';
await fs.mkdir(out,{recursive:true});
const bundled=await build({stdin:{contents:"export {fixtures} from './scripts/playable-fixtures';export {replay} from './src/engine/storage';export {assertInvariants,legalMoves} from './src/engine/game';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm'});
const {fixtures,replay,assertInvariants}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const port=9276,pause=ms=>new Promise(r=>setTimeout(r,ms));
const SPELL_COST={stride:2,lift:1,headwind:2,undertow:1,swap:2,nudge:2,piggyback:1};
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--no-first-run','--disable-background-networking','--remote-allow-origins=*',`--remote-debugging-port=${port}`,
 `--user-data-dir=${path.resolve('.tools/fullscreen-browser')}`,'--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank'
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

 for(const [width,height]of [[1440,960],[1366,768],[1024,768],[900,700],[740,600]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await install('capacity');
   await wait("[...document.querySelectorAll('.card-art')].every(i=>i.complete&&i.naturalWidth>0)");
   const layout=await evaluate("(()=>{const b=document.querySelector('.game-board').getBoundingClientRect(),h=document.querySelector('.hand-tray').getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,header:document.querySelector('.game-header').getBoundingClientRect().height,collision:[...document.querySelectorAll('.game-board [data-space]')].some(e=>{const r=e.getBoundingClientRect();return r.right>h.left&&r.left<h.right&&r.bottom>h.top&&r.top<h.bottom}),overflow:document.documentElement.scrollWidth>innerWidth}})()");
   check(`full board and unobstructed spaces at ${width}`,layout.x===0&&layout.y===layout.header&&layout.w===width&&layout.h===height-layout.header&&!layout.collision&&!layout.overflow,layout);
   await snapshot(`board-${width}`);
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});await install('capacity');
 const s=await state(),exposed=s.board.flatMap((c,i)=>c.towers.length?s.towers[c.towers.at(-1)].residents:c.ground),own=exposed.filter(id=>s.wizards[id].owner===0);
 const glowing=()=>evaluate("JSON.parse(document.querySelector('.game-board').dataset.highlighted)");
 check('active exposed animals glow, buried animals do not',JSON.stringify((await glowing()).sort())===JSON.stringify(own.sort()));
 await button('Houses','.game-header');await click('[aria-label="Highlight Rats pieces"]');
 const ratIds=exposed.filter(id=>s.wizards[id].owner===2);check('selecting another house highlights its exposed animals',ratIds.every(id=>(s.wizards[id].owner===2))&&(await glowing()).length===new Set([...own,...ratIds]).size);
 await snapshot('other-house');
 const beforePeek=JSON.stringify(await saved());await button('Peek','.game-header');
 const revealed=await evaluate("[...document.querySelectorAll('[data-peek-piece]')].map(e=>e.dataset.peekPiece)");
 const all=Object.keys(s.wizards).filter(id=>!s.entered.includes(id));
 check('Peek reveals every on-board animal including buried ones',JSON.stringify(revealed.sort())===JSON.stringify(all.sort()));
 check('Peek does not mutate the save',JSON.stringify(await saved())===beforePeek);await snapshot('peek');
 await click('[data-space="2"]');check('Peek inspector lists buried levels',await evaluate("!!document.querySelector('.peek-layers')"));await snapshot('peek-inspector');
 await button('Peek','.game-header');check('turning Peek off removes hidden data',await evaluate("document.querySelectorAll('[data-peek-piece],.peek-layers').length===0"));
 await click('[aria-label="Next space"]');check('header selector navigates inspector',await evaluate("document.querySelector('.game-drawer h2').textContent==='Space 4'"));
 await click('[aria-label="Close Space 4"]');await click('[aria-label="Hide hand"]');check('hand can collapse',await evaluate("getComputedStyle(document.querySelector('.hand-cards')).display==='none'"));await click('[aria-label="Show hand"]');
 await install('dice',{reducedMotion:false});await playFirst('dice');
 await wait("document.querySelector('.die')?.dataset.rolling==='true'");
 check('dice use an active 3D tumble and disable acceptance',await evaluate("document.querySelector('.die-cube').getAnimations().length>0&&[...document.querySelectorAll('.hand-actions button')].find(b=>b.textContent.startsWith('Keep')).disabled"));await snapshot('dice-rolling');
 await wait("document.querySelector('.game-shell').dataset.busy==='false'");let rolled=await state();check('die settles to engine result',await evaluate(`document.querySelector('.die').getAttribute('aria-label')==='Die result ${rolled.pending.roll}'`));
 await button('Reroll','.hand-actions');await wait("document.querySelector('.die')?.dataset.rolling==='true'");check('reroll animates again',await evaluate("document.querySelector('.die-cube').getAnimations().length>0"));await wait("document.querySelector('.game-shell').dataset.busy==='false'");rolled=await state();await snapshot('dice-settled');
 await button('Keep ','.hand-actions');check('settled roll is accepted normally',(await state()).phase==='move');
 await install('dice');await playFirst('dice');check('reduced motion bypasses dice animation',await evaluate("document.querySelector('.die').dataset.rolling==='false'&&document.querySelector('.die-cube').getAnimations().length===0"));
 await install('tall');await snapshot('ten-high');await click('[data-space="6"]');await button('Inspect keep’s stack');await snapshot('ten-high-inspector');
 check('no runtime exceptions',errors.length===0,{errors});
 await fs.writeFile(`${out}/results.json`,JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
}finally{
 if(ws?.readyState===WebSocket.OPEN){await Promise.race([call('Browser.close').catch(()=>{}),pause(1500)]);ws.close()}chrome.kill();
}
