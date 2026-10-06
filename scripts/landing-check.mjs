import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
const pause=ms=>new Promise(r=>setTimeout(r,ms)),port=9283;
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-background-networking','--remote-allow-origins=*',`--remote-debugging-port=${port}`,`--user-data-dir=${path.resolve('.tools/landing-browser-2')}`,'--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'],{stdio:'ignore',windowsHide:true});
let ws;const pending=new Map();let serial=0;const errors=[];
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>reject(Error("CDP timeout: "+method)),15000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}))});
try{
 let tab;for(let i=0;i<100;i++){try{tab=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.type==='page');if(tab)break}catch{}await pause(100)}
 if(!tab)throw Error('Chrome did not start');
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});
 await call('Runtime.enable');await call('Page.enable');
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value};
 const wait=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await pause(100)}throw Error('Timeout: '+expression)};
 const check=(name,result)=>{if(!result)throw Error(name);console.log('PASS '+name)};
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:'http://127.0.0.1:4186/'});await wait("!!document.querySelector('.game-shell')");
 await evaluate("localStorage.clear();localStorage.setItem('castles-preferences',JSON.stringify({boardId:'original',reducedMotion:true}))");await call('Page.reload');await wait("!!document.querySelector('.landing')");
 check('old market preference migrates',await evaluate("document.querySelector('.board-caption h3').textContent==='Golden Kingdom'"));
 await fs.mkdir('docs/verification/landing-wizard',{recursive:true});
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 for(const [width,height] of [[1440,900],[1366,768],[1024,768],[390,844],[375,667],[320,568],[740,390],[600,360]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  for(let step=0;step<3;step++){
   await wait(`document.querySelector('.landing')?.dataset.step==='${step}'`);await pause(150);
   const layout=await evaluate(`(()=>{const l=document.querySelector('.landing'),p=document.querySelector('.setup-page'),header=document.querySelector('.game-header').getBoundingClientRect();const controls=[...l.querySelectorAll('button,input,select')];return {details:[...p.querySelectorAll("section,.options-stage")].map(e=>({class:e.className,height:e.getBoundingClientRect().height,scroll:e.scrollHeight})),pageHeight:p.clientHeight,pageScroll:p.scrollHeight,overflow:l.scrollHeight>l.clientHeight+1||l.scrollWidth>l.clientWidth+1||p.scrollHeight>p.clientHeight+1,visible:controls.every(e=>{const b=e.getBoundingClientRect();return b.top>=header.bottom-1&&b.bottom<=innerHeight+1&&b.left>=0&&b.right<=innerWidth+1}),images:[...p.querySelectorAll('img')].every(i=>i.getBoundingClientRect().height>10)}})()`);
   check(`step ${step+1} fits ${width}x${height}: ${JSON.stringify(layout)}`,!layout.overflow&&layout.visible&&layout.images);
   await wait("[...document.querySelectorAll('.landing img')].every(i=>i.complete&&i.naturalWidth>0)");
   if(width===1440||width===390||width===740)await fs.writeFile(`docs/verification/landing-wizard/${width}-step-${step+1}-${Date.now()}.png`,Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
   if(step<2)await click('.setup-next button');
  }
  await click('.setup-footer>div:first-child button');await wait("document.querySelector('.landing').dataset.step==='1'");
  await click('.setup-footer>div:first-child button');await wait("document.querySelector('.landing').dataset.step==='0'");
 }
 await click('[aria-label="Next board"]');await pause(100);check('next board works',await evaluate("document.querySelector('.board-caption h3').textContent==='Alpine Realms'"));
 await click('[aria-label="Choose Sapphire Coast"]');await click('.setup-next button');
 await click('[aria-label="Choose Rats"]');await pause(100);
 check('bots take other houses',await evaluate("document.querySelector('.opponent-line').textContent==='Bots: Otters · Badgers · Rabbits'"));
 await click('.setup-next button');
 await evaluate("document.querySelectorAll('.spell-choices input')[2].click();document.querySelector('.wizard-options .check input').click()");
 await click('.setup-footer>div:first-child button');await wait("document.querySelector('.landing').dataset.step==='1'");
 check('back retains chosen character',await evaluate("document.querySelector('[aria-label=\"Choose Rats\"]').getAttribute('aria-pressed')==='true'"));
 await click('.setup-next button');
 check('back retains spells and options',await evaluate("document.querySelectorAll('.spell-choices input')[2].checked&&document.querySelector('.wizard-options .check input').checked"));
 await click('.setup-next button');await wait("!document.querySelector('.landing')&&!!document.querySelector('.game-board')");
 check('four unique houses, one human, three bots and selected options',await evaluate("(()=>{const s=JSON.parse(localStorage.getItem('cascading-castles-save-v1')).initial;return s.players.length===4&&s.players[0].faction==='Rats'&&!s.players[0].bot&&s.players.slice(1).every(p=>p.bot)&&new Set(s.players.map(p=>p.faction)).size===4&&s.spells.includes('headwind')&&s.nasty&&document.querySelector('.game-board').dataset.board==='coast'})()"));
 await call('Page.reload');await wait("!!document.querySelector('.game-board')");
 check('board and house survive reload',await evaluate("document.querySelector('.game-board').dataset.board==='coast'&&JSON.parse(localStorage.getItem('cascading-castles-save-v1')).initial.players[0].faction==='Rats'"));
 check('no runtime exceptions',errors.length===0);
}finally{if(ws?.readyState===1){await call('Browser.close').catch(()=>{});ws.close()}chrome.kill()}
