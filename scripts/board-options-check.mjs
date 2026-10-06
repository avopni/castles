import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';

const origin=process.env.CASTLES_ORIGIN??'http://127.0.0.1:4186',out='docs/verification/board-options';
await fs.mkdir(out,{recursive:true});
const bundled=await build({stdin:{contents:"export {fixtures} from './scripts/playable-fixtures';export {replay} from './src/engine/storage';export {assertInvariants,legalMoves} from './src/engine/game';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm'});
const {fixtures,replay,assertInvariants}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const port=9279,pause=ms=>new Promise(r=>setTimeout(r,ms));
const SPELL_COST={stride:2,lift:1,headwind:2,undertow:1,swap:2,nudge:2,piggyback:1};
const chrome=spawn(process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--no-first-run','--disable-background-networking','--remote-allow-origins=*',`--remote-debugging-port=${port}`,
 `--user-data-dir=${path.resolve('.tools/board-options-browser')}`,'--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank'
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
 const prefs={tutorial:false,privateHands:false,reducedMotion:true,botDelay:1,boardId:'valley'};
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:origin+'/'});await wait("Boolean(document.querySelector('.game-shell'))");
 await evaluate(`localStorage.setItem('cascading-castles-save-v1',${JSON.stringify(JSON.stringify(fixtures.capacity))});localStorage.setItem('castles-preferences',${JSON.stringify(JSON.stringify(prefs))})`);
 await call('Page.reload');await pause(600);await wait("Boolean(document.querySelector('.game-board[data-ready=true]'))");
 const saved=await evaluate("localStorage.getItem('cascading-castles-save-v1')");
 for(const id of ['valley','alpine','coast','forest','sky']){
   await click('[aria-label="Settings and saves"]');
   await evaluate(`[...document.querySelectorAll('.board-options button')].find(b=>b.querySelector('img').src.includes('/${id}.png')).click()`);
   await click('[aria-label="Close Settings and saves"]');
   await wait(`document.querySelector('.game-board')?.dataset.board==='${id}'`);
   await pause(800);
   for(const [width,height] of [[1440,960],[1366,768],[740,600]]){
     await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(300);
     const layout=await evaluate(`(()=>{
       const board=document.querySelector('.game-table>.game-board'),b=board.getBoundingClientRect(),h=document.querySelector('.hand-tray').getBoundingClientRect();
       const spaces=[...board.querySelectorAll('[data-space]')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,x:(r.left+r.right)/2,y:r.top}});
       const a=spaces[13],c=spaces[14],card=document.querySelector('.play-card').getBoundingClientRect();
       return {count:spaces.length,cardRatio:card.width/card.height,cardCollision:spaces.some(r=>r.right>h.left&&r.left<h.right&&r.bottom>h.top&&r.top<h.bottom),leftGap:Math.hypot(a.x-c.x,a.y-c.y),overflow:document.documentElement.scrollWidth>innerWidth,potions:getComputedStyle(document.querySelector('.game-header>.bottles')).display};
     })()`);
     check(`${id} layout at ${width}`,layout.count===16&&!layout.cardCollision&&!layout.overflow&&layout.leftGap>60&&Math.abs(layout.cardRatio-2/3)<.02&&layout.potions!=='none',layout);
     if(width===1440)await snapshot(id);
   }
   check(id+' preserves game state',await evaluate("localStorage.getItem('cascading-castles-save-v1')")===saved);
 }
 await call('Page.reload');await pause(600);await wait("document.querySelector('.game-board')?.dataset.board==='sky'");
 check('board choice survives reload',true);
 await click('[aria-label="Settings and saves"]');
 await evaluate("document.querySelectorAll('.board-options img').forEach(i=>i.loading='eager')");
 await wait("[...document.querySelectorAll('.board-options img')].every(i=>i.complete&&i.naturalWidth>0)");await snapshot('picker');
 await call('Page.navigate',{url:origin+'/boards/index.html'});await wait("document.querySelectorAll('article').length===5");
 await evaluate("document.querySelectorAll('article img').forEach(i=>i.loading='eager')");
 await wait("[...document.images].every(i=>i.complete&&i.naturalWidth>0)");
 check('five full-size gallery images load',true);
 await click('[data-board="coast"]');await wait("document.querySelector('.game-board')?.dataset.board==='coast'");
 check('gallery selection opens chosen board without changing game',await evaluate("localStorage.getItem('cascading-castles-save-v1')")===saved);
 check('no runtime exceptions',errors.length===0,{errors});
 await fs.writeFile(out+'/results.json',JSON.stringify({date:new Date().toISOString(),checks,errors},null,2));
}finally{
 if(ws?.readyState===WebSocket.OPEN){await Promise.race([call('Browser.close').catch(()=>{}),pause(1500)]);ws.close()}chrome.kill();
}
