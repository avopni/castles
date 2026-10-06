import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import type {State} from './engine/types';
import {surface, towerLocation, wizardLocation} from './engine/game';
import {FACTIONS} from './engine/content';
import {BOARD_WIDTH,boardLayout,scenePoses,type Pose,type SlotMemory} from './sceneLayout';
import {boardTheme} from './boardThemes';
import {TOWER_PITCH,UNIT_BASE_RADIUS,UNIT_BASE_CENTER_Y,UNIT_BASE_HEIGHT} from './surfaceLayout';
import {movementDuration} from './session';

const textures=new Map<string,THREE.Texture>();
function imageTexture(file:string,ready:()=>void){
  const url=import.meta.env.BASE_URL+file;
  if(!textures.has(url)){
    const texture=new THREE.TextureLoader().load(url,ready);texture.colorSpace=THREE.SRGBColorSpace;textures.set(url,texture);
  }
  return textures.get(url)!;
}
function birdTexture(gold=false){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d')!;
  x.fillStyle=gold?'#d0a755':'#252b28';
  x.beginPath();x.ellipse(60,72,32,18,-.5,0,Math.PI*2);x.fill();
  x.beginPath();x.arc(86,42,13,0,Math.PI*2);x.fill();
  x.beginPath();x.moveTo(95,40);x.lineTo(116,45);x.lineTo(95,49);x.fill();
  x.beginPath();x.moveTo(37,77);x.lineTo(7,105);x.lineTo(47,87);x.fill();
  x.strokeStyle=x.fillStyle;x.lineWidth=4;x.beginPath();x.moveTo(63,86);x.lineTo(65,105);x.lineTo(76,105);x.moveTo(76,80);x.lineTo(84,103);x.lineTo(95,103);x.stroke();
  x.fillStyle='#ede2bb';x.beginPath();x.arc(90,39,2,0,Math.PI*2);x.fill();
  x.strokeStyle=gold?'#aa853b':'#59604f';x.lineWidth=2;x.beginPath();x.moveTo(78,58);x.quadraticCurveTo(53,60,43,80);x.stroke();
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function masonry(dark=false){
  const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d')!;
  x.fillStyle=dark?'#374940':'#9e8664';x.fillRect(0,0,512,256);
  for(let row=0;row<5;row++)for(let col=-1;col<9;col++){
    const n=(row*71+col*13+103)%30;
    x.fillStyle=dark?`hsl(163,18%,${23+n/5}%)`:`hsl(39,${24+n/3}%,${65+n/3}%)`;
    const left=col*66+(row%2?33:0);x.fillRect(left+2,row*52+2,62,48);
    x.strokeStyle=dark?'#a4a27c30':'#fff0c55a';x.lineWidth=2;x.strokeRect(left+4,row*52+4,58,43);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
type Props={state:State;before:State|null;selected?:string;targets?:string[];destinationSpace?:number;reducedMotion:boolean;onPick:(id:string)=>void;detailSpace?:number;activeOwner?:number;focusedOwner?:number|null;peek?:boolean;boardId?:string};
export function GameBoard({state,before,selected,targets=[],destinationSpace,reducedMotion,onPick,detailSpace,activeOwner=state.current,focusedOwner=null,peek=false,boardId='valley'}:Props){
  const theme=boardTheme(boardId),clearings=theme.clearings;
  const host=useRef<HTMLDivElement>(null),slots=useRef<SlotMemory>(new Map()),pick=useRef(onPick);
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
  pick.current=onPick;
  const [fallback,setFallback]=useState(false);
  const [viewport,setViewport]=useState({width:1440,height:896});
  useEffect(()=>{const el=host.current!;const observer=new ResizeObserver(()=>{const width=el.clientWidth,height=el.clientHeight;setViewport(v=>v.width===width&&v.height===height?v:{width,height})});observer.observe(el);return()=>observer.disconnect()},[]);
  const targetKey=targets.join(',');
  useEffect(()=>()=>{rendererRef.current?.dispose();rendererRef.current?.forceContextLoss();rendererRef.current?.domElement.remove();rendererRef.current=null;},[]);
  useEffect(()=>{
    if(fallback)return;
    const container=host.current!;
    const aspect=Math.max(.2,viewport.width/Math.max(1,viewport.height));
    // A stable 35.26-degree elevation matches the painted ground's ellipses.
    // Reserve headroom by compacting stack height, never by flattening the view.
    const projection=Math.sqrt(2/3);
    let heightScale=1;
    const inMotion=!!before&&movementDuration(state,reducedMotion)>0&&state.events.some(e=>e.kind==='move'||e.kind==='keep');
    if(detailSpace===undefined)for(const s of [state,before??state])s.board.forEach((cell,i)=>{
      const top=inMotion?Math.min(...clearings.map(c=>c[1])):clearings[i][1];
      if(cell.towers.length)heightScale=Math.min(heightScale,Math.max(.035,(top*BOARD_WIDTH/aspect-.45)/(projection*((cell.towers.length-1)*TOWER_PITCH+1.65+(inMotion?1.4:0)))));
    });
    const {depth:BOARD_DEPTH,location}=boardLayout(aspect,projection,clearings);
    let renderer:THREE.WebGLRenderer;
    try{renderer=rendererRef.current??new THREE.WebGLRenderer({antialias:true,alpha:true});rendererRef.current=renderer;}catch{setFallback(true);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
    renderer.domElement.setAttribute('aria-hidden','true');container.prepend(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-11,11,7,-7,.1,120);
    camera.position.set(0,24,24*projection/Math.sqrt(1-projection**2));camera.lookAt(0,0,0);camera.updateMatrixWorld();
    scene.add(new THREE.HemisphereLight('#fff4d5','#566349',1.4));
    const sun=new THREE.DirectionalLight('#fff1d1',2);sun.position.set(-8,18,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15});sun.shadow.bias=-.001;scene.add(sun);
    const allMaterials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[],localTextures:THREE.Texture[]=[];
    let dirty=true;
    const ready=()=>{dirty=true;};
    const stone=masonry(),darkStone=masonry(true),raven=birdTexture(),goldRaven=birdTexture(true);localTextures.push(stone,darkStone,raven,goldRaven);
    const material=(color:string,map?:THREE.Texture)=>{const m=new THREE.MeshStandardMaterial({color,map,roughness:.95});allMaterials.push(m);return m;};
    const cream=material('#fff3d5',stone),dark=material('#e0ded1',darkStone),floor=material('#d9c6a1'),trim=material('#e2cda4'),shadow=material('#202e29'),gold=material('#d4a65a');
    function mesh(geometry:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0){
      geometries.push(geometry);const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
    }
    const artMat=new THREE.MeshBasicMaterial({map:imageTexture(theme.image,ready),toneMapped:false});allMaterials.push(artMat);
    const painting=mesh(new THREE.PlaneGeometry(BOARD_WIDTH,BOARD_DEPTH),artMat,scene,0,-.012,0);painting.rotation.x=-Math.PI/2;painting.castShadow=false;
    const shadowMat=new THREE.ShadowMaterial({opacity:.23});allMaterials.push(shadowMat);
    mesh(new THREE.PlaneGeometry(BOARD_WIDTH,BOARD_DEPTH),shadowMat,scene,0,.001,0).rotation.x=-Math.PI/2;
    const objects=new Map<string,THREE.Group>();
    painting.visible=detailSpace===undefined;
    const unitBaseBottom=UNIT_BASE_CENTER_Y-UNIT_BASE_HEIGHT/2;
    const renderPose=(id:string,pose:Pose):Pose=>({...pose,y:state.wizards[id]?(pose.y+unitBaseBottom)*heightScale-unitBaseBottom:pose.y*heightScale});
    const renderPoses=(values:Record<string,Pose>)=>Object.fromEntries(Object.entries(values).map(([id,pose])=>[id,renderPose(id,pose)]));
    const oldPoses=renderPoses(scenePoses(before??state,new Map(slots.current),location)),poses=renderPoses(scenePoses(state,slots.current,location));
    const glowMaterials:THREE.MeshBasicMaterial[]=[];
    const duration=before?movementDuration(state,reducedMotion):0;
    const entering=new Set(state.events.filter(e=>e.kind==='enter').flatMap(e=>e.ids));
    for(const [id,pose] of Object.entries(poses))if(state.towers[id]&&(detailSpace===undefined||pose.space===detailSpace)){
      if(detailSpace!==undefined&&id!==state.board[detailSpace].towers.at(-1))continue;
      const g=new THREE.Group();g.userData.pick=id;g.scale.y=heightScale;objects.set(id,g);scene.add(g);const keep=id==='keep',wall=keep?dark:cream;
      if(state.board[pose.space].towers.indexOf(id)===0)mesh(new THREE.CylinderGeometry(.65,.66,.075,40),wall,g,0,-.0375);
      mesh(new THREE.CylinderGeometry(.62,.65,.7,40),wall,g,0,.35);
      mesh(new THREE.CylinderGeometry(.66,.66,.07,40),trim,g,0,.075);
      mesh(new THREE.CylinderGeometry(.54,.54,.09,40),keep?shadow:floor,g,0,.72);
      const rim=mesh(new THREE.RingGeometry(.51,.68,40),wall,g,0,.78);rim.rotation.x=-Math.PI/2;
      for(let j=0;j<10;j++){const a=j*Math.PI/5,m=mesh(new THREE.BoxGeometry(.22,.23,.21),wall,g,Math.sin(a)*.56,.8,Math.cos(a)*.56);m.rotation.y=a;}
      for(let j=0;j<4;j++){
        const a=j*Math.PI/2;
        const slit=mesh(new THREE.BoxGeometry(.06,.21,.025),keep?gold:shadow,g,Math.sin(a)*.623,.43,Math.cos(a)*.623);slit.rotation.y=a;
      }
      // Amber entrance and a raven plaque on the front wall.
      if(keep)mesh(new THREE.BoxGeometry(.19,.29,.035),gold,g,0,.22,.635);
      if(state.towers[id].raven||keep){
        const m=new THREE.MeshBasicMaterial({map:keep?goldRaven:raven,transparent:true,alphaTest:.1,side:THREE.DoubleSide});allMaterials.push(m);
        const seal=mesh(new THREE.PlaneGeometry(.28,.28),m,g,0,.5,.65);seal.castShadow=false;
        if(!keep){const mark=mesh(new THREE.PlaneGeometry(.29,.29),m,g,0,.77,0);mark.rotation.x=-Math.PI/2;mark.castShadow=false;}
      }
      if(keep){
        mesh(new THREE.CylinderGeometry(.012,.012,.63,8),gold,g,-.26,1.08,0);
        const flag=mesh(new THREE.PlaneGeometry(.38,.22),gold,g,-.07,1.28,0);(flag.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
      }
      if(selected===id||targets.includes(id)){
        const m=new THREE.MeshBasicMaterial({color:selected===id?'#fff1aa':'#80e6d1'});allMaterials.push(m);
        const halo=mesh(new THREE.TorusGeometry(.73,.025,8,48),m,g,0,.1,0);halo.rotation.x=-Math.PI/2;halo.castShadow=false;
      }
    }
    const unitIds=new Set([...Object.keys(poses),...(duration?Object.keys(oldPoses):[])]);
    for(const id of unitIds){
      if(!state.wizards[id])continue;
      const pose=poses[id]??oldPoses[id];if(detailSpace!==undefined&&pose.space!==detailSpace)continue;
      const owner=state.wizards[id].owner,faction=state.players[owner].faction,color=FACTIONS.find(f=>f.name===faction)!.color;
      const g=new THREE.Group();g.userData.pick=id;scene.add(g);objects.set(id,g);
      mesh(new THREE.CylinderGeometry(UNIT_BASE_RADIUS,UNIT_BASE_RADIUS,.025,24),material(color),g,0,.025,0);
      if(owner===activeOwner||owner===focusedOwner||selected===id||targets.includes(id)){
        const m=new THREE.MeshBasicMaterial({color:selected===id?'#fff1aa':color,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});allMaterials.push(m);glowMaterials.push(m);
        const halo=mesh(new THREE.RingGeometry(.13,owner===focusedOwner ? .21 : .18,40),m,g,0,.013,0);halo.rotation.x=-Math.PI/2;halo.castShadow=false;halo.userData.decoration=true;
        g.userData.highlighted=true;g.userData.owner=owner;
      }
      const texture=imageTexture(`art/units/${faction.toLowerCase()}-v1.png`,ready);
      const m=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.15,side:THREE.DoubleSide,toneMapped:false});allMaterials.push(m);
      const painted=mesh(new THREE.PlaneGeometry(.18,.6),m,g,0,.15,0);painted.rotation.x=-Math.atan2(camera.position.y,camera.position.z);
      if(selected===id){const ring=mesh(new THREE.TorusGeometry(.125,.004,6,24),gold,g,0,.036,0);ring.rotation.x=-Math.PI/2;}
    }
    // Public ground raven marks, exactly at cells 1, 5, 9, 13.
    for(let space=0;space<16;space++)if(state.board[space].raven&&(!state.board[space].towers.length)&& (detailSpace===undefined||space===detailSpace)){
      const p=location(space,.015),m=new THREE.MeshBasicMaterial({map:raven,transparent:true,alphaTest:.1});allMaterials.push(m);
      mesh(new THREE.PlaneGeometry(.6,.6),m,scene,p.x,p.y,p.z).rotation.x=-Math.PI/2;
    }
    function poseFor(id:string):Pose {
      if(poses[id])return poses[id];
      if(entering.has(id)){const e=state.events.find(e=>e.kind==='enter'&&e.ids.includes(id))!,p=location(e.to!,((before??state).board[e.to!].towers.length-1)*TOWER_PITCH+.85);return renderPose(id,{space:e.to!,...p,visible:true});}
      return oldPoses[id];
    }
    function fit(){
      const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
      renderer.setSize(w,h);scene.updateMatrixWorld(true);
      const bounds=new THREE.Box3(),p=new THREE.Vector3();
      if(detailSpace===undefined){
        for(const x of [-BOARD_WIDTH/2,BOARD_WIDTH/2])for(const z of [-BOARD_DEPTH/2,BOARD_DEPTH/2])bounds.expandByPoint(p.set(x,0,z).applyMatrix4(camera.matrixWorldInverse));
      }else{const center=location(detailSpace,(state.board[detailSpace].towers.length-1)*TOWER_PITCH+.8);for(const x of [-.95,.95])for(const z of [-.95,.95])bounds.expandByPoint(p.set(center.x+x,center.y,center.z+z).applyMatrix4(camera.matrixWorldInverse));}
      if(detailSpace!==undefined)for(const [id] of objects){for(const pose of [oldPoses[id],poseFor(id)])if(pose){bounds.expandByPoint(p.set(pose.x-.7,pose.y,pose.z).applyMatrix4(camera.matrixWorldInverse));bounds.expandByPoint(p.set(pose.x+.7,pose.y+1.4+(duration?1.4:0),pose.z).applyMatrix4(camera.matrixWorldInverse));}}
      // The front edge projects below the tower origin at this elevation.
      // Include actual mesh extents so inspection keeps the whole tower in view.
      if(detailSpace!==undefined)for(const g of objects.values()){
        const box=new THREE.Box3().setFromObject(g);
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])bounds.expandByPoint(p.set(x,y,z).applyMatrix4(camera.matrixWorldInverse));
      }
      const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),aspect=w/h;
      const hh=Math.max(size.y,size.x/aspect)*(detailSpace===undefined?.5:.515);
      camera.left=center.x-hh*aspect;camera.right=center.x+hh*aspect;camera.top=center.y+hh;camera.bottom=center.y-hh;camera.updateProjectionMatrix();
      for(let space=0;space<16;space++){
        const button=container.querySelector<HTMLElement>(`[data-space="${space}"]`);if(!button)continue;
        p.copy(location(space)).project(camera);button.style.left=`${(p.x+1)*50}%`;button.style.top=`${(1-p.y)*50}%`;
      }
      dirty=true;
    }
    for(const [id,g]of objects){const pose=poseFor(id);g.position.set(pose.x,pose.y,pose.z);}
    fit();const observer=new ResizeObserver(fit);observer.observe(container);
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
    const click=(e:PointerEvent)=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);for(const hit of ray.intersectObjects(scene.children,true)){let obj:THREE.Object3D|null=hit.object;while(obj&&!obj.userData.pick)obj=obj.parent;if(obj?.userData.pick){pick.current(obj.userData.pick);return;}}};
    renderer.domElement.addEventListener('pointerup',click);
    const started=performance.now();let raf=0,settled=false;
    const loadedTextures=new Set<THREE.Texture>();
    function frame(now:number){
      for(const m of glowMaterials)m.opacity=reducedMotion?.6:.48+.2*Math.sin(now/700);
      const t=duration?Math.min(1,(now-started)/duration):1;
      for(const texture of textures.values())if(texture.image?.width&&!loadedTextures.has(texture)){loadedTextures.add(texture);dirty=true;}
      for(const [id,g]of objects){
        const to=poseFor(id),from=oldPoses[id]??to;
        const event=state.events.find(e=>(e.kind==='move'||e.kind==='keep')&&(e.ids.includes(id)||!!from.support&&e.ids.includes(from.support)));
        const isKeep=event?.kind==='keep',end=entering.size ? .7 : 1;
        const raw=isKeep&&entering.size?Math.max(0,(t-.72)/.28):Math.min(1,t/end),ease=raw*raw*(3-2*raw);
        if(event&&duration){
          const p=event.steps===undefined?new THREE.Vector3(from.x+(to.x-from.x)*ease,0,from.z+(to.z-from.z)*ease):location(from.space+event.steps*ease);
          const origin=location(from.space),dest=location(to.space);
          if(event.steps!==undefined){p.x+=(from.x-origin.x)*(1-ease)+(to.x-dest.x)*ease;p.z+=(from.z-origin.z)*(1-ease)+(to.z-dest.z)*ease;}
          g.position.set(p.x,from.y+(to.y-from.y)*ease+Math.sin(Math.PI*raw)*(state.towers[id]?1.4*heightScale:from.support&&event.ids.includes(from.support)?1.4*heightScale:.55*heightScale),p.z);
        }else g.position.set(to.x,to.y,to.z);
        if(state.wizards[id]) {
          const art=g.children.find(o=>o instanceof THREE.Mesh && o.geometry instanceof THREE.PlaneGeometry) as THREE.Mesh|undefined;
          const image=art&&((art.material as THREE.MeshBasicMaterial).map?.image as HTMLImageElement|undefined);
          if(art&&image?.width){const height=Math.min(.23,.18*image.height/image.width,.184/Math.abs(Math.sin(art.rotation.x)));art.scale.y=height/.6;art.position.y=.0375+height*Math.cos(art.rotation.x)/2;}
        }
        // Covered residents remain hidden. Newly revealed residents appear after lifting.
        g.visible=poses[id] ? !!oldPoses[id]||t>.15 : entering.has(id)?t<.7:t<.68;
        if(id==='keep'&&detailSpace===undefined){const button=container.querySelector<HTMLElement>('.keep-space');if(button){const projected=g.position.clone().setY(0).project(camera);button.style.left=`${(projected.x+1)*50}%`;button.style.top=`${(1-projected.y)*50}%`;button.classList.toggle('badge-left',projected.x>.4);}}
      }
      if(t===1&&(dirty||!settled)&&detailSpace===undefined){
        scene.updateMatrixWorld(true);const radii:Record<string,number>={},vertex=new THREE.Vector3();
        for(const [id,g]of objects)if(state.wizards[id]&&g.visible){let radius=0;g.traverse(o=>{if(o instanceof THREE.Mesh&&!o.userData.decoration){const points=o.geometry.getAttribute('position');for(let i=0;i<points.count;i++){vertex.fromBufferAttribute(points,i).applyMatrix4(o.matrixWorld);radius=Math.max(radius,Math.hypot(vertex.x-g.position.x,vertex.z-g.position.z));}}});radii[id]=radius;}
        container.dataset.surfaceFit=JSON.stringify(state.board.flatMap((cell,space)=>{const ids=surface(state,space);if(!ids.length)return [];const origin=location(space),clear=cell.towers.length ? .45 : .8;let minimumPairGap:number|null=null;for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=objects.get(ids[i])!.position,b=objects.get(ids[j])!.position;minimumPairGap=Math.min(minimumPairGap??Infinity,Math.hypot(a.x-b.x,a.z-b.z)-radii[ids[i]]-radii[ids[j]]);}return [{space,count:ids.length,minimumPairGap,minimumWallGap:Math.min(...ids.map(id=>{const p=objects.get(id)!.position;return clear-Math.hypot(p.x-origin.x,p.z-origin.z)-radii[id]})),radii:ids.map(id=>radii[id])}]}));
      }
      if(dirty||t<1||!settled||glowMaterials.length&&!reducedMotion){renderer.render(scene,camera);dirty=false;settled=t===1;}
      container.dataset.highlighted=JSON.stringify([...objects].filter(([,g])=>g.visible&&g.userData.highlighted).map(([id])=>id));
      container.dataset.ready='true';container.dataset.animating=String(t<1);container.dataset.visibleUnits=String([...objects].filter(([id,g])=>state.wizards[id]&&g.visible).length);
      container.dataset.viewAngle='35.26';container.dataset.heightScale=String(heightScale);
      raf=requestAnimationFrame(frame);
    }
    raf=requestAnimationFrame(frame);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();renderer.domElement.removeEventListener('pointerup',click);geometries.forEach(g=>g.dispose());allMaterials.forEach(m=>m.dispose());localTextures.forEach(t=>t.dispose());renderer.renderLists.dispose();};
  },[state,before,selected,targetKey,reducedMotion,detailSpace,fallback,viewport,activeOwner,focusedOwner,theme,clearings]);
  return <div ref={host} className={`game-board ${detailSpace!==undefined?'detail-board':''}`} data-board={theme.id} data-peek={peek} data-fallback={fallback} aria-label={`${theme.name} sixteen-space board`}>
    {fallback&&<img className="fallback-painting" src={import.meta.env.BASE_URL+theme.image} alt={theme.name}/>}
    <div className="space-controls">{clearings.map(([u,v],space)=>{
      if(detailSpace!==undefined&&space!==detailSpace)return null;
      const c=state.board[space],ids=surface(state,space),top=c.towers.at(-1),keep=top==='keep',targetSpace=targets.some(id=>(state.towers[id]?towerLocation(state,id).space:wizardLocation(state,id)?.space)===space);
      return <button key={space} data-space={space} onClick={()=>onPick(`space-${space}`)} style={fallback?{left:`${u*100}%`,top:`${v*100}%`}:undefined}
        aria-label={`Space ${space+1}, ${c.towers.length} turret levels, ${ids.length} exposed travellers${space===destinationSpace?', move selected piece here':''}${targetSpace?', legal move available':''}${keep?', keep':''}`} className={`space-button ${keep?'keep-space':''} ${targetSpace?'target-space':''} ${space===destinationSpace?'destination-space':''}`}>
        {keep&&state.entered.length>0&&<span className="home-counter">Home · {state.entered.length}<span className="keep-arrivals">{state.players.map((p,i)=>p.wizardCount>0&&<span key={i}><img src={`${import.meta.env.BASE_URL}art/portraits/${p.faction.toLowerCase()}.png`} alt={p.name}/>{state.entered.filter(id=>state.wizards[id].owner===i).length}/{p.wizardCount}</span>)}</span></span>}
        {c.towers.length>1&&<span className="stack-count" aria-label={`${c.towers.length} turret levels`}>{c.towers.length}↑</span>}
        {peek&&<span className="peek-pieces">{[...c.ground,...c.towers.flatMap(id=>state.towers[id].residents)].map(id=><span key={id} data-peek-piece={id} className={ids.includes(id)?'exposed':'buried'} title={`${state.players[state.wizards[id].owner].faction} · ${ids.includes(id)?'exposed':'buried'}`}><img src={`${import.meta.env.BASE_URL}art/portraits/${state.players[state.wizards[id].owner].faction.toLowerCase()}.png`} alt={state.players[state.wizards[id].owner].name}/></span>)}</span>}
        {fallback&&<span>{c.towers.length?'♜'.repeat(c.towers.length):''}{ids.map(id=>state.players[state.wizards[id].owner].faction[0]).join('')}</span>}
      </button>;
    })}</div>
  </div>;
}
