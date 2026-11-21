import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const FLEET=[
{id:'light',name:'Light Wheel-Lift',price:0,color:0xd34b32,tools:['lift']},
{id:'flatbed',name:'Rollback Flatbed',price:400,color:0x2d78b2,tools:['bed','winch']},
{id:'medium',name:'Medium Wrecker',price:700,color:0xe0a52c,tools:['lift','boom','winch']},
{id:'rotator',name:'Heavy Rotator',price:1100,color:0x5e68b0,tools:['boom','winch','riggers']}
];
const JOBS=[
{name:'Parking Lot Tow',x:3,z:-18,pay:450,kind:'tow',truck:'light',weight:1.5},
{name:'AWD Rollback Transport',x:3,z:-42,pay:750,kind:'flatbed',truck:'flatbed',weight:2.5},
{name:'Ditch Extraction',x:11,z:-28,pay:1200,kind:'recovery',truck:'medium',weight:4},
{name:'Heavy Rollover Recovery',x:-18,z:-63,pay:2600,kind:'heavy',truck:'rotator',weight:12}
];
const loadCareer=()=>{try{return JSON.parse(localStorage.getItem('towing-career')||'{}')}catch{return {}}};

function box(parent,name,size,pos,color,opts={}) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:opts.roughness??.78,metalness:opts.metalness??.08}));
  mesh.name=name; mesh.position.set(...pos); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function makeVehicle(scene,{name,color,pos,scale=1}) {
  const root=new THREE.Group(); root.name=name; root.position.copy(pos); scene.add(root);
  const body=new THREE.Group(); root.add(body);
  box(body,'frame',[2.05*scale,.48*scale,4.8*scale],[0,.95*scale,0],0x252a2e);
  box(body,'cab',[1.92*scale,1.45*scale,1.85*scale],[0,1.78*scale,-1.12*scale],color);
  box(body,'hood',[1.95*scale,.7*scale,1.55*scale],[0,1.55*scale,-2.45*scale],color);
  box(body,'windshield',[1.68*scale,.78*scale,.08*scale],[0,2.0*scale,-2.04*scale],0x8eb1c2,{metalness:.25,roughness:.22});
  box(body,'bed',[2.0*scale,.3*scale,1.5*scale],[0,1.35*scale,1.15*scale],0x333a40);
  const wheels=[];
  for(const z of [-1.55,1.55]) for(const x of [-1.06,1.06]) {
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.48*scale,.48*scale,.32*scale,20),new THREE.MeshStandardMaterial({color:0x17191b,roughness:.95}));
    tire.rotation.z=Math.PI/2; tire.position.set(x,.62*scale,z); tire.castShadow=true; root.add(tire); wheels.push(tire);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.2*scale,.2*scale,.335*scale,16),new THREE.MeshStandardMaterial({color:0x8b9297,metalness:.7,roughness:.35}));
    hub.rotation.z=Math.PI/2; hub.position.copy(tire.position); tire.add(hub); hub.position.set(0,0,0);
  }
  const forks=[];
  if(name==='wrecker') {
    box(body,'boom base',[1.55,.42,1.1],[0,1.45,1.75],0x24282c);
    const boom=box(body,'recovery boom',[.42,.38,3.1],[0,2.35,2.5],0xd4a326); boom.rotation.x=1.35;
    const outriggers=[];for(const x of [-1,1]){const arm=box(body,'outrigger arm',[1.15,.22,.28],[x*1.45,1.05,1.6],0x4c555a);const foot=box(body,'outrigger foot',[.48,.14,.6],[x*2.05,.55,1.6],0xe0b340);outriggers.push({arm,foot,x});}
    const liftCross=box(body,'wheel lift crossbar',[2.25,.18,.3],[0,1.65,3.65],0x444b50);
    for(const side of [-1,1]) {const grid=new THREE.Group();grid.name='wheel grid';body.add(grid);const cradle=box(grid,'tire cradle',[.42,.12,.95],[0,0,0],0x747e85);const lArm=box(grid,'L-arm tire restraint',[.17,.16,1.05],[side*.14,0,.68],0xc1c5c8);const stop=box(grid,'front tire stop',[.45,.22,.13],[0,.08,-.42],0xe2b54b);forks.push({grid,cradle,lArm,stop,side});}
  }
  const bed=box(body,'rollback bed',[2.15,.22,5.3],[0,1.45,1],0x606a71);bed.visible=false;
  const straps=[];for(const x of [-.8,.8]){const strap=box(body,'tire strap',[.22,.12,.55],[x,1.1,4.4],0xe3b13e);strap.visible=false;straps.push(strap);}
  root.userData={body,wheels,scale,bed,straps,boom: name==='wrecker'?body.children.find(o=>o.name==='recovery boom'):null,liftCross: name==='wrecker'?body.children.find(o=>o.name==='wheel lift crossbar'):null,forks: name==='wrecker'?forks:[],outriggers:name==='wrecker'?body.children.filter(o=>o.name==='outrigger arm'||o.name==='outrigger foot'):[]}; return root;
}

export default function TowingGame(){
 const [career,setCareer]=useState(()=>({job:0,cash:0,completed:0,engine:0,winch:0,owned:['light'],selected:'light',...loadCareer()}));
 const careerRef=useRef(career);careerRef.current=career;
 const [garage,setGarage]=useState(false),[notice,setNotice]=useState(''),[hydraulic,setHydraulic]=useState({x:0,y:0});
 const saveCareer=fn=>setCareer(old=>{const next=fn(old);careerRef.current=next;try{localStorage.setItem('towing-career',JSON.stringify(next))}catch{}return next;});
 const mount=useRef(null),sim=useRef(null),[hud,setHud]=useState({speed:0,gear:'D',hook:false,tension:0,winch:'IDLE'}),[help,setHelp]=useState(true),[steerVisual,setSteerVisual]=useState(0);
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x9db2c2);scene.fog=new THREE.Fog(0x9db2c2,55,180);
  const camera=new THREE.PerspectiveCamera(62,1,.1,350);camera.position.set(9,7,12);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xdcecff,0x56604a,2.0));const sun=new THREE.DirectionalLight(0xfff0d8,2.4);sun.position.set(-25,38,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:0x59684a,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;ground.receiveShadow=true;scene.add(ground);
  const road=new THREE.Mesh(new THREE.BoxGeometry(10,.12,125),new THREE.MeshStandardMaterial({color:0x303438,roughness:.95}));road.position.set(0,-.02,-18);road.receiveShadow=true;scene.add(road);
  const shoulder=new THREE.Mesh(new THREE.BoxGeometry(5,.16,125),new THREE.MeshStandardMaterial({color:0x85785d}));shoulder.position.set(7.1,-.07,-18);scene.add(shoulder);
  const ditch=new THREE.Mesh(new THREE.BoxGeometry(4,.55,28),new THREE.MeshStandardMaterial({color:0x4d5840}));ditch.position.set(10.5,-.38,-20);scene.add(ditch);
  for(let i=0;i<30;i++){const x=(i%2?1:-1)*(14+Math.random()*28),z=-70+i*5;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,2.8,7),new THREE.MeshStandardMaterial({color:0x59432e}));trunk.position.set(x,1.3,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.5+Math.random(),4.4,7),new THREE.MeshStandardMaterial({color:0x344d38}));crown.position.set(x,4.1,z);crown.castShadow=true;scene.add(crown);}
  for(let z=-75;z<40;z+=8){const dash=new THREE.Mesh(new THREE.BoxGeometry(.13,.025,3.4),new THREE.MeshBasicMaterial({color:0xe4dfc6}));dash.position.set(0,.06,z);scene.add(dash);}
  const type=FLEET.find(t=>t.id===careerRef.current.selected)||FLEET[0];
  const truck=makeVehicle(scene,{name:'wrecker',color:type.color,pos:V(0,0,7),scale:type.id==='rotator'?1.13:1});
  const tools=type.tools;truck.userData.bed.visible=tools.includes('bed');
  for(const o of truck.userData.body.children){if(o.name==='recovery boom'||o.name==='boom base')o.visible=tools.includes('boom');if(o.name.startsWith('wheel lift'))o.visible=tools.includes('lift');if(o.name.startsWith('outrigger'))o.visible=tools.includes('riggers');}
  const firstJob=JOBS[careerRef.current.job%JOBS.length];
  const pickup=makeVehicle(scene,{name:'pickup',color:0x315c83,pos:V(firstJob.x,0,firstJob.z),scale:.92});
  const zone=new THREE.Mesh(new THREE.RingGeometry(3.5,3.85,48),new THREE.MeshBasicMaterial({color:0x46ef9c,side:THREE.DoubleSide}));
  zone.rotation.x=-Math.PI/2;zone.position.set(firstJob.kind==='tow'||firstJob.kind==='flatbed'?0:2,.12,firstJob.kind==='tow'||firstJob.kind==='flatbed'?23:firstJob.z);scene.add(zone);
  pickup.rotation.y=.18;
  // Pickup starts low in the soft ditch with a little yaw.
  const cableMat=new THREE.LineBasicMaterial({color:0xf3bd43});const cableGeo=new THREE.BufferGeometry().setFromPoints([V(),V()]);const cable=new THREE.Line(cableGeo,cableMat);scene.add(cable);cable.visible=false;
  const s={truck,pickup,zone,pos:V(0,0,7),vel:V(),yaw:0,steer:0,throttle:0,brake:0,hook:false,winch:false,winchOut:false,parkingBrake:false,boomDeployed:false,boomSwing:0,boomExtension:0,liftDeployed:false,liftHeight:0,liftExtension:0,gridWidth:0,armsClosed:false,riggersDeployed:false,cableLength:14,tension:0,pickPos:V(firstJob.x,0,firstJob.z),pickVel:V(),pickYaw:-.18,cameraYaw:0,cameraPitch:.24,zoom:13,drag:null,pointers:new Map(),lastHud:0,jobIndex:careerRef.current.job,jobDone:false,heavyRecovery:careerRef.current.job%JOBS.length===3,loaded:false,strapsOn:false,bedTilt:false,type,tools};
  sim.current=s;
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};const ro=new ResizeObserver(resize);ro.observe(host);resize();
  let last=performance.now(),raf=0;
  const update=(now)=>{
   const dt=Math.min(.033,(now-last)/1000);last=now;const steps=Math.max(1,Math.ceil(dt/(1/120)));const h=dt/steps;
   for(let n=0;n<steps;n++){
    const forward=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));const right=V(Math.cos(s.yaw),0,Math.sin(s.yaw));
    const speed=s.vel.dot(forward);const steerAngle=s.steer*(.64-.36*clamp(Math.abs(speed)/22,0,1));s.truck.userData.body.rotation.y=0;
    const parked=s.parkingBrake||s.riggersDeployed||s.winch||s.winchOut;const accel=parked?-Math.sign(speed)*18:s.brake?-Math.sign(speed)*18:s.throttle*(5.8+careerRef.current.engine*1.2)-speed*0.22;
    s.vel.addScaledVector(forward,accel*h);
    const side=s.vel.dot(right);s.vel.addScaledVector(right,-side*Math.min(1,12.5*h));
    s.vel.multiplyScalar(Math.pow(.985,h*60));
    const yawRate=clamp((speed/2.9)*Math.tan(steerAngle),-1.55,1.55);s.yaw+=yawRate*h;
    const max=20;const sp=s.vel.length();if(sp>max)s.vel.setLength(max);
    s.pos.addScaledVector(s.vel,h);s.pos.y=0;
    // Truck wheel spin and steering articulation.
    for(let i=0;i<s.truck.userData.wheels.length;i++){const w=s.truck.userData.wheels[i];w.rotation.y=0;w.rotation.order='YXZ';w.rotation.y=i<2?steerAngle*.45:0;w.rotation.x+=speed*h/0.48;}
    s.truck.position.copy(s.pos);s.truck.rotation.y=-s.yaw;
    const equip=s.truck.userData;equip.bed.rotation.x=s.bedTilt?-.18:0;equip.bed.position.z=s.bedTilt?1.8:1;for(const strap of equip.straps)strap.visible=s.strapsOn&&s.tools.includes('lift');if(equip.outriggers){for(const part of equip.outriggers){const sign=Math.sign(part.position.x);part.position.x=sign*(s.riggersDeployed?(part.name==='outrigger arm'?1.75:2.5):(part.name==='outrigger arm'?1.45:2.05));part.position.y=s.riggersDeployed?(part.name==='outrigger arm'?.88:.13):(part.name==='outrigger arm'?1.05:.55);}}if(equip.boom){const heavy=s.type.id==='rotator';equip.boom.rotation.x=s.boomDeployed?(heavy?-.28:-.18):1.35;equip.boom.rotation.y=heavy&&s.boomDeployed?s.boomSwing:0;equip.boom.position.y=s.boomDeployed?1.9:2.35;equip.boom.position.z=s.boomDeployed?(heavy?3.0+s.boomExtension:3.0):2.5;equip.boom.scale.z=heavy&&s.boomDeployed?1+s.boomExtension/3.1:1;}if(equip.liftCross){equip.liftCross.position.y=s.liftDeployed?.28+s.liftHeight:1.65;equip.liftCross.position.z=s.liftDeployed?4.55+s.liftExtension:3.65;for(const fork of equip.forks){fork.grid.visible=s.liftDeployed;fork.grid.position.set(fork.side*(.78+s.gridWidth),.18+s.liftHeight,5.05+s.liftExtension);fork.grid.rotation.y=s.armsClosed?0:fork.side*.28;fork.lArm.position.z=s.armsClosed?.55:1.05;}}
    // Ditch resistance and recovery vehicle interaction.
    const pickForward=V(Math.sin(s.pickYaw),0,-Math.cos(s.pickYaw));
    const pa=s.pos.clone().add(V(0,1.1,0)).add(forward.clone().multiplyScalar(-2.3));
    const pb=s.pickPos.clone().add(V(0,1,0)).add(pickForward.clone().multiplyScalar(2.0));
    const delta=pb.clone().sub(pa);const dist=delta.length();const dir=delta.normalize();
    if(s.hook){
      if(s.winch&&(s.boomDeployed||s.tools.includes('bed'))&&(!s.heavyRecovery||s.riggersDeployed)&&s.parkingBrake)s.cableLength=Math.max(3.2,s.cableLength-(2.4+careerRef.current.winch*.8)*h);if(s.winchOut&&(s.boomDeployed||s.tools.includes('bed'))&&(!s.heavyRecovery||s.riggersDeployed)&&s.parkingBrake)s.cableLength=Math.min(26,s.cableLength+3.2*h);
      const rel=s.pickVel.clone().sub(s.vel).dot(dir);s.tension=Math.max(0,(dist-s.cableLength)*6200+rel*780);
      if(s.tension>32000){s.hook=false;s.tension=0;}
      else if(dist>s.cableLength&&(s.boomDeployed||s.tools.includes('bed'))&&(!s.heavyRecovery||s.riggersDeployed)&&s.parkingBrake){const f=Math.min(s.tension,32000);s.pickVel.addScaledVector(dir,-f/2350*h);s.vel.addScaledVector(dir,f/6200*h);}
    } else s.tension=0;
    if(s.loaded){if(s.type.id==='flatbed'){s.pickPos.copy(s.pos).addScaledVector(forward,-.9);s.pickYaw=s.yaw;}else{
      // Wheel-lift: hitch is fixed to the truck, and the trailing axle rolls behind it.
      // Never aim the car at the hitch: that causes 180-degree flips at rest.
      const hitch=s.pos.clone().addScaledVector(forward,-5.05-s.liftExtension);
      const drawbar=3.0;
      const previousHitch=s.prevHitch||hitch;
      const travel=hitch.clone().sub(previousHitch);
      const towForward=V(Math.sin(s.pickYaw),0,-Math.cos(s.pickYaw));
      const towRight=V(Math.cos(s.pickYaw),0,Math.sin(s.pickYaw));
      const longitudinal=travel.dot(towForward);
      const lateral=travel.dot(towRight);
      // No translation means no articulation; reverse changes the sign naturally.
      if(travel.lengthSq()>1e-10){
        const yawChange=clamp(lateral/drawbar,-1.1*h,1.1*h);
        s.pickYaw+=yawChange;
      }
      const aligned=V(Math.sin(s.pickYaw),0,-Math.cos(s.pickYaw));
      s.pickPos.copy(hitch).addScaledVector(aligned,-drawbar);
      s.prevHitch=hitch.clone();
    }s.pickVel.set(0,0,0);}
    // Pickup's soft-ground drag and rolling resistance.
    const pside=s.pickVel.dot(V(Math.cos(s.pickYaw),0,Math.sin(s.pickYaw)));s.pickVel.addScaledVector(V(Math.cos(s.pickYaw),0,Math.sin(s.pickYaw)),-pside*Math.min(1,2.6*h));
    if(!s.loaded){s.pickVel.multiplyScalar(Math.pow(.994,h*60));s.pickPos.addScaledVector(s.pickVel,h);}
    if(s.pickPos.x>7.4)s.pickVel.x*=Math.pow(.82,h*60);
    if(s.pickPos.z>6)s.pickVel.z*=Math.pow(.85,h*60);
    if(!s.loaded)s.pickYaw+=clamp(s.pickVel.x*.018,-.35,.35)*h;
    s.pickup.position.copy(s.pickPos);s.pickup.position.y=s.loaded?(s.type.id==='flatbed'?1.5:.48+s.liftHeight*.5):0;s.pickup.rotation.y=-s.pickYaw;
    const job=JOBS[s.jobIndex%JOBS.length];const reached=s.loaded?s.pos.distanceTo(V(0,0,23))<5:s.pickPos.distanceTo(V(2,0,job.z))<4.2;
    if(!s.jobDone&&reached&&(s.loaded||s.hook)){
      s.jobDone=true;s.winch=false;s.hook=false;
      const reward=JOBS[s.jobIndex%JOBS.length].pay;
      saveCareer(p=>({...p,cash:p.cash+reward,completed:p.completed+1,job:p.job+1}));
      setNotice('JOB COMPLETE +$'+reward+'! Tap NEXT JOB.');
    }
    if(s.hook){cable.visible=true;cable.geometry.setFromPoints([pa,pb]);}else cable.visible=false;
   }
   // Orbit follow camera, pinch zoom is handled by pointer distance.
   const focus=s.pos.clone().add(V(0,1.2,0));const distance=s.zoom;const cy=Math.cos(s.cameraPitch),sy=Math.sin(s.cameraPitch);
   const offset=V(Math.sin(s.cameraYaw)*cy*distance,sy*distance,Math.cos(s.cameraYaw)*cy*distance);
   camera.position.copy(focus).add(offset);camera.lookAt(focus.clone().add(V(0,0,-2)));
   if(now-s.lastHud>120){const sp=s.vel.length()*3.6;setHud({speed:sp,gear:s.throttle<-.1?'R':'D',hook:s.hook,tension:s.tension/1000,winch:s.winch?'REELING':'IDLE',parking:s.parkingBrake,riggers:s.riggersDeployed,boom:s.boomDeployed,lift:s.liftDeployed,range:s.pos.distanceTo(s.pickPos),mapX:s.pos.x,mapZ:s.pos.z,mapYaw:s.yaw,carX:s.pickPos.x,carZ:s.pickPos.z,carYaw:s.pickYaw,loaded:s.loaded});s.lastHud=now;}
   renderer.render(scene,camera);raf=requestAnimationFrame(update);
  };raf=requestAnimationFrame(update);
  const onKey=(e)=>{const down=e.type==='keydown';if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='w'||e.key==='ArrowUp')s.throttle=down?1:0;if(e.key==='s'||e.key==='ArrowDown')s.throttle=down?-.55:0;if(e.key==='a'||e.key==='ArrowLeft')s.steer=down?-1:0;if(e.key==='d'||e.key==='ArrowRight')s.steer=down?1:0;if(e.key.toLowerCase()==='r')s.winch=down&&s.boomDeployed&&(!s.heavyRecovery||s.riggersDeployed)&&s.parkingBrake;if(down&&e.key.toLowerCase()==='h')s.hook=!s.hook;};
  window.addEventListener('keydown',onKey);window.addEventListener('keyup',onKey);
  const onPointerDown=e=>{renderer.domElement.setPointerCapture(e.pointerId);s.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(s.pointers.size===1)s.drag={x:e.clientX,y:e.clientY,yaw:s.cameraYaw,pitch:s.cameraPitch};};
  const onPointerMove=e=>{if(!s.pointers.has(e.pointerId))return;s.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(s.pointers.size===1&&s.drag){s.cameraYaw=s.drag.yaw-(e.clientX-s.drag.x)*.006;s.cameraPitch=clamp(s.drag.pitch+(e.clientY-s.drag.y)*.004,-.05,.85);}if(s.pointers.size===2){const p=[...s.pointers.values()];const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(s.pinch)s.zoom=clamp(s.pinch.zoom*s.pinch.d/Math.max(20,d),6,26);else s.pinch={d,zoom:s.zoom};}};
  const onPointerUp=e=>{s.pointers.delete(e.pointerId);s.drag=null;if(s.pointers.size<2)s.pinch=null;};
  renderer.domElement.addEventListener('pointerdown',onPointerDown);renderer.domElement.addEventListener('pointermove',onPointerMove);renderer.domElement.addEventListener('pointerup',onPointerUp);renderer.domElement.addEventListener('pointercancel',onPointerUp);
  return()=>{cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onKey);renderer.dispose();host.removeChild(renderer.domElement);scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});};
 },[career.selected,career.job]);
 const s=sim.current;const press=(key,val)=>e=>{e.preventDefault();const s=sim.current;if(!s)return;if((key==='winch'||key==='winchOut')&&val&&((s.tools.includes('boom')&&!s.boomDeployed)||(s.heavyRecovery&&!s.riggersDeployed)||!s.parkingBrake)){setNotice(s.heavyRecovery?'Heavy recovery: deploy BOOM, RIGGERS and PARK BRAKE.':'Deploy BOOM and engage PARK BRAKE first.');return;}s[key]=val;};
 const joystickMove=e=>{const el=e.currentTarget,rect=el.getBoundingClientRect(),dx=(e.clientX-(rect.left+rect.width/2))/(rect.width*.42);const steer=clamp(dx,-1,1);setSteerVisual(steer);if(sim.current)sim.current.steer=steer;};
 const joystickStop=e=>{e.preventDefault();setSteerVisual(0);if(sim.current)sim.current.steer=0;};
 const toggleBoom=()=>{const s=sim.current;if(!s)return;if(!s.tools.includes('boom'))return;if(!s.parkingBrake||s.vel.length()>.25){setNotice('Stop and manually apply PARK BRAKE before deploying the boom.');return;}if(s.hook&&!s.boomDeployed){setNotice('Unhook before changing boom position.');return;}s.boomDeployed=!s.boomDeployed;}; 
 const adjustHeavyBoom=(axis,delta)=>{const s=sim.current;if(!s||s.type.id!=='rotator'||!s.boomDeployed)return;if(!s.parkingBrake||!s.riggersDeployed){setNotice('Apply PARK BRAKE and deploy RIGGERS first.');return;}s[axis]=clamp(s[axis]+delta,axis==='boomSwing'?-1.1:0,axis==='boomSwing'?1.1:2.2);};
 const toggleRiggers=()=>{const s=sim.current;if(!s||!s.tools.includes('riggers'))return;if(s.vel.length()>.4){setNotice('Stop the truck before deploying riggers.');return;}if(!s.parkingBrake){setNotice('Engage PARK BRAKE manually before operating riggers.');return;}s.riggersDeployed=!s.riggersDeployed;};
 const adjustLift=(axis,delta)=>{const s=sim.current;if(!s||!s.tools.includes('lift'))return;if(!s.parkingBrake||s.vel.length()>.25){setNotice('Stop and engage PARK BRAKE to operate the wheel lift.');return;}if(!s.liftDeployed){setNotice('Deploy the wheel lift first.');return;}s[axis]=clamp(s[axis]+delta,0,axis==='liftHeight'?1.25:1.5);};
 const toggleLift=()=>{const s=sim.current;if(!s||!s.tools.includes('lift'))return;if(!s.parkingBrake||s.vel.length()>.25){setNotice('Stop and manually apply PARK BRAKE before deploying the lift.');return;}if(s.loaded){setNotice('Unload the car before folding the wheel lift.');return;}s.liftDeployed=!s.liftDeployed;if(s.liftDeployed){s.liftHeight=0;s.armsClosed=false;s.strapsOn=false;setNotice('Wheel lift lowered. Release PARK BRAKE, back the grids under the tires, then park and secure.');}};
 const hydraulicStop=()=>setHydraulic({x:0,y:0});
 const hydraulicMove=e=>{const s=sim.current;if(!s||!s.liftDeployed||!s.parkingBrake)return;const rect=e.currentTarget.getBoundingClientRect();const x=clamp((e.clientX-rect.left-rect.width/2)/(rect.width*.42),-1,1),y=clamp((rect.top+rect.height/2-e.clientY)/(rect.height*.42),-1,1);setHydraulic({x,y});if(Math.abs(x)>.12)adjustLift('liftExtension',x*.055);if(Math.abs(y)>.12)adjustLift('liftHeight',y*.045);};
 const adjustGrid=delta=>{const s=sim.current;if(!s||!s.liftDeployed||!s.parkingBrake)return;s.gridWidth=clamp(s.gridWidth+delta,0,.45);};
 const toggleArms=()=>{const s=sim.current;if(!s||!s.liftDeployed||!s.parkingBrake){setNotice('Deploy lift and engage PARK BRAKE first.');return;}if(s.loaded){setNotice('Unload before opening tire restraints.');return;}s.armsClosed=!s.armsClosed;};
 const togglePark=()=>{const s=sim.current;if(!s)return;if(s.riggersDeployed&&s.parkingBrake){setNotice('Retract riggers before releasing parking brake.');return;}s.parkingBrake=!s.parkingBrake;};
 const toggleHook=()=>{const s=sim.current;if(!s)return;if(!s.hook&&!s.boomDeployed&&s.tools.includes('boom')){setNotice('Deploy the boom before hooking.');return;}if(!s.hook&&!s.tools.includes('winch')){setNotice('This truck has no winch.');return;}if(!s.hook&&s.pos.distanceTo(s.pickPos)>24){setNotice('Move within 24 m to hook the vehicle.');return;}s.hook=!s.hook;if(s.hook){const f=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));const a=s.pos.clone().add(f.multiplyScalar(-2.3));s.cableLength=clamp(a.distanceTo(s.pickPos),4,25);}};
 const reset=()=>{const s=sim.current;if(!s)return;s.pos.set(0,0,7);s.vel.set(0,0,0);s.yaw=0;const job=JOBS[careerRef.current.job%JOBS.length];s.pickPos.set(job.x,0,job.z);s.jobIndex=careerRef.current.job;s.jobDone=false;s.heavyRecovery=careerRef.current.job%JOBS.length===3;s.loaded=false;s.prevHitch=null;s.strapsOn=false;s.bedTilt=false;s.zone.position.set(job.kind==='tow'||job.kind==='flatbed'?0:2,.12,job.kind==='tow'||job.kind==='flatbed'?23:job.z);s.pickVel.set(0,0,0);s.hook=false;s.winch=false;s.winchOut=false;s.parkingBrake=false;s.boomDeployed=false;s.boomSwing=0;s.boomExtension=0;s.liftDeployed=false;s.liftHeight=0;s.liftExtension=0;s.gridWidth=0;s.armsClosed=false;s.riggersDeployed=false;s.cableLength=14;};
 const upgrade=type=>{const lvl=careerRef.current[type],price=(lvl+1)*500;if(lvl>=3||careerRef.current.cash<price){setNotice(lvl>=3?'Fully upgraded':'Not enough cash: $'+price);return;}saveCareer(p=>({...p,cash:p.cash-price,[type]:p[type]+1}));setNotice(type.toUpperCase()+' upgraded!');};
 // Wheel-lift capture uses the front tire positions, not the distance between vehicle centers.
 // Allow 0.85 m per tire so alignment is achievable on a touchscreen.
 const tireGridContact=s=>{
  const forward=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));
  const right=V(Math.cos(s.yaw),0,Math.sin(s.yaw));
  const carForward=V(Math.sin(s.pickYaw),0,-Math.cos(s.pickYaw));
  const carRight=V(Math.cos(s.pickYaw),0,Math.sin(s.pickYaw));
  const axle=s.pickPos.clone().addScaledVector(carForward,1.55);
  const gridCenter=s.pos.clone().addScaledVector(forward,-5.05-s.liftExtension);
  const lateral=.78+s.gridWidth;
  const errors=[-1,1].map(side=>{
   const tire=axle.clone().addScaledVector(carRight,side*.84);
   const grid=gridCenter.clone().addScaledVector(right,side*lateral);
   return tire.distanceTo(grid);
  });
  return {ok:errors.every(d=>d<=.85)&&carForward.dot(forward)>.72&&s.liftHeight<.3,
   error:Math.max(...errors)};
 };
 const strapTires=()=>{const s=sim.current;if(!s)return;if(!s.tools.includes('lift')){setNotice('This truck has no wheel lift.');return;}if(s.loaded){setNotice('Vehicle already attached. Drive to the green depot zone.');return;}if(!s.liftDeployed){setNotice('Lower the wheel lift first.');return;}const contact=tireGridContact(s);if(!contact.ok){setNotice('Back the lowered grids under BOTH front tires and line up straight. Tire alignment error: '+contact.error.toFixed(1)+' m.');return;}const job=JOBS[s.jobIndex%JOBS.length];if(job.kind!=='tow'){setNotice('This dispatch requires '+FLEET.find(t=>t.id===job.truck).name+'.');return;}if(!s.parkingBrake){setNotice('Apply PARK BRAKE before securing tire straps.');return;}s.vel.set(0,0,0);s.throttle=0;s.armsClosed=true;s.strapsOn=true;s.loaded=true;s.liftHeight=.55;s.pickYaw=s.yaw;s.prevHitch=null;s.hook=false;s.winch=false;setNotice('Tires strapped and car hooked! Release PARK BRAKE, then drive to the green depot zone.');};
 const toggleBed=()=>{const s=sim.current;if(s&&s.tools.includes('bed'))s.bedTilt=!s.bedTilt;};
 const secureLoad=()=>{const s=sim.current;if(!s)return;const j=JOBS[s.jobIndex%JOBS.length];if(s.loaded){s.loaded=false;s.strapsOn=false;setNotice('Load released.');return;}if(s.type.id!==j.truck){setNotice('Dispatch requires '+FLEET.find(t=>t.id===j.truck).name+'.');return;}const distance=s.pos.distanceTo(s.pickPos);if(j.kind!=='tow'&&distance>3.2){setNotice('Move closer to the recovery vehicle.');return;}if(j.kind==='tow'){if(!s.liftDeployed){setNotice('Deploy the wheel lift first.');return;}if(!tireGridContact(s).ok){setNotice('Back the lowered grids beneath both front tires before securing.');return;}if(!s.parkingBrake){setNotice('Apply PARK BRAKE before securing the load.');return;}s.armsClosed=true;s.strapsOn=true;s.liftHeight=.55;s.vel.set(0,0,0);s.throttle=0;s.loaded=true;s.pickYaw=s.yaw;s.prevHitch=null;s.hook=false;s.winch=false;setNotice('Car hooked and tire straps secured! Release PARK BRAKE and drive to the green depot zone.');return;}if(!s.parkingBrake){setNotice('Engage PARK BRAKE before securing the load.');return;}if(j.kind==='flatbed'&&(!s.bedTilt||!s.hook)){setNotice('Tilt the bed and connect winch cable.');return;}if(j.kind==='recovery'||j.kind==='heavy'){setNotice('Use boom and winch to pull vehicle into green zone.');return;}s.loaded=true;s.hook=false;s.winch=false;setNotice('Vehicle secured! Release park brake and deliver to green depot zone.');};
 const chooseTruck=id=>{const t=FLEET.find(x=>x.id===id);if(!t)return;saveCareer(p=>({...p,selected:id,owned:FLEET.map(truck=>truck.id)}));setNotice('TEST MODE: '+t.name+' ready.');};
 const selectTestJob=index=>{const j=JOBS[index];if(!j)return;saveCareer(p=>({...p,job:index,selected:j.truck,owned:FLEET.map(truck=>truck.id)}));setGarage(false);setHelp(false);setNotice('TEST JOB: '+j.name+' — '+FLEET.find(t=>t.id===j.truck).name);};
 const Hold=({label,onDown,onUp,wide=false})=><button className={wide?'control wide':'control'} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp} onContextMenu={e=>e.preventDefault()}>{label}</button>;
 return <main className="game-shell"><div className="scene" ref={mount}/>
  <header className="topbar"><div><strong>TOWING & RECOVERY</strong><small>CAREER MODE • {career.selected.toUpperCase()} TRUCK</small><small style={{display:"block",fontWeight:800,color:"#ffe07a",letterSpacing:".04em"}}>BUILD .14 • ALL JOBS UNLOCKED</small></div><div className="speed"><b>{hud.speed.toFixed(0)}</b><span>KM/H</span></div></header>
  <div style={{position:'absolute',right:12,top:92,zIndex:9,width:146,height:166,pointerEvents:'none',border:'2px solid #f3c851',borderRadius:12,background:'rgba(9,20,30,.88)',color:'#fff',boxShadow:'0 3px 14px #0008',padding:6,boxSizing:'border-box'}}><div style={{fontSize:11,fontWeight:800,textAlign:'center'}}>MINI MAP</div><svg viewBox="0 0 140 140" width="132" height="132" aria-label="Truck, disabled vehicle and depot map"><rect x="0" y="0" width="140" height="140" rx="6" fill="#1b3431"/><path d="M 70 0 V 140" stroke="#61787a" strokeWidth="28"/><path d="M 70 0 V 140" stroke="#c4c8a6" strokeDasharray="5 7" strokeWidth="1.5"/><rect x="59" y="12" width="22" height="13" rx="3" fill="#49dc77" stroke="#fff" strokeWidth="1"/><text x="70" y="21" fill="#0d2518" fontSize="8" textAnchor="middle" fontWeight="bold">DEPOT</text><g transform={`translate(${70+(hud.carX??3)*2},${70+(hud.carZ??-18)*1.8}) rotate(${-(hud.carYaw??0)*180/Math.PI})`}><rect x="-4" y="-7" width="8" height="14" rx="2" fill="#ffcf58" stroke="#111" strokeWidth="1"/></g><g transform={`translate(${70+(hud.mapX??0)*2},${70+(hud.mapZ??7)*1.8}) rotate(${-(hud.mapYaw??0)*180/Math.PI})`}><rect x="-5" y="-10" width="10" height="20" rx="2" fill="#55b7ff" stroke="white" strokeWidth="1.5"/><path d="M -3 -6 L 0 -9 L 3 -6" fill="none" stroke="white"/></g><text x="5" y="135" fontSize="8" fill="#fff">BLUE: YOU</text></svg></div>
  <section className="mission"><div className="eyebrow">DISPATCH #{career.completed+1} · ${career.completed} COMPLETED</div><b>{JOBS[career.job%JOBS.length].name}</b><span>{JOBS[career.job%JOBS.length].kind==='tow'?'Secure both tires and deliver to depot.':JOBS[career.job%JOBS.length].kind==='flatbed'?'Load on rollback and deliver to depot.':'Winch the disabled vehicle into the green recovery zone.'} Reward: ${JOBS[career.job%JOBS.length].pay}</span><div className="stats"><span>CASH ${career.cash}</span><span>ENGINE {career.engine}/3 · WINCH {career.winch}/3</span></div><div className="stats"><span>{hud.hook?'CABLE CONNECTED':'CABLE DISCONNECTED'}</span><span>{hud.tension.toFixed(1)} kN · {hud.range?.toFixed(0)} m</span></div></section>
  <div className="bottom-ui"><div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);joystickMove(e);}} onPointerMove={joystickMove} onPointerUp={joystickStop} onPointerCancel={joystickStop}><div className="stick-knob" style={{transform:`translateX(${steerVisual*23}px)`}}>●</div><span>STEER</span></div><div className="recovery"><button className={'action '+(hud.parking?'active':'')} onClick={togglePark}>PARK BRAKE</button>{s?.tools.includes('boom')&&<button className={'action '+(s?.boomDeployed?'active':'')} onClick={toggleBoom}>BOOM {s?.boomDeployed?'FOLD':'DEPLOY'}</button>}{s?.tools.includes('lift')&&<button className={'action '+(s?.liftDeployed?'active':'')} onClick={toggleLift}>LIFT {s?.liftDeployed?'FOLD':'DEPLOY'}</button>}{s?.tools.includes('lift')&&hud.lift&&<><button className="action" onClick={()=>adjustGrid(-.1)}>GRID NARROW</button><button className="action" onClick={()=>adjustGrid(.1)}>GRID WIDE</button><button className="action" onClick={toggleArms}>{s?.armsClosed?'OPEN L-ARMS':'CLOSE L-ARMS'}</button></>}{s?.tools.includes('lift')&&hud.lift&&<div aria-label="Hydraulic lift joystick" style={{width:105,height:105,border:'2px solid #f3c851',borderRadius:18,background:'#183941',touchAction:'none',position:'relative',display:'grid',placeItems:'center',color:'white',fontSize:10,fontWeight:800}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);hydraulicMove(e);}} onPointerMove={e=>{if(e.buttons)hydraulicMove(e);}} onPointerUp={hydraulicStop} onPointerCancel={hydraulicStop}><span style={{position:'absolute',top:3}}>UP</span><span style={{position:'absolute',bottom:3}}>DOWN</span><span style={{position:'absolute',left:2}}>IN</span><span style={{position:'absolute',right:2}}>OUT</span><div style={{width:30,height:30,borderRadius:'50%',background:'#f3c851',transform:`translate(${hydraulic.x*28}px,${-hydraulic.y*28}px)`,boxShadow:'0 2px 5px #0009'}}/></div>}{s?.type.id==='rotator'&&hud.boom&&<><button className="action" onClick={()=>adjustHeavyBoom('boomSwing',-.15)}>BOOM LEFT</button><button className="action" onClick={()=>adjustHeavyBoom('boomSwing',.15)}>BOOM RIGHT</button><button className="action" onClick={()=>adjustHeavyBoom('boomExtension',.25)}>BOOM OUT</button><button className="action" onClick={()=>adjustHeavyBoom('boomExtension',-.25)}>BOOM IN</button></>}{s?.tools.includes('riggers')&&<button className={'action '+(hud.riggers?'active':'')} onClick={toggleRiggers}>RIGGERS {hud.riggers?'RETRACT':'DEPLOY'}</button>}{s?.tools.includes('winch')&&<button className={'action '+(hud.hook?'active':'')} onClick={toggleHook}>{hud.hook?'UNHOOK':'HOOK'}</button>}{s?.tools.includes('winch')&&<Hold label="WINCH IN" onDown={press('winch',true)} onUp={press('winch',false)}/>}{s?.tools.includes('winch')&&<Hold label="WINCH OUT" onDown={press('winchOut',true)} onUp={press('winchOut',false)}/>}<>{s?.tools.includes('lift')&&<button className="action" onClick={strapTires}>TIRE STRAPS</button>}{s?.tools.includes('bed')&&<button className="action" onClick={toggleBed}>BED TILT</button>}{(s?.tools.includes('lift')||s?.tools.includes('bed'))&&<button className="action" onClick={secureLoad}>{s?.loaded?'UNLOAD':'SECURE LOAD'}</button>}</></div><div className="drive"><Hold label="REV" onDown={press('throttle',-.55)} onUp={press('throttle',0)}/><Hold label="GAS" wide onDown={press('throttle',1)} onUp={press('throttle',0)}/></div></div>
  <div className="toolbar"><select aria-label="Select test job" value={career.job%JOBS.length} onChange={e=>selectTestJob(Number(e.target.value))} style={{background:"#153c43",color:"#fff",border:"2px solid #f3c851",borderRadius:7,padding:"8px",fontWeight:800,maxWidth:190}}>{JOBS.map((job,index)=><option key={job.name} value={index}>{index+1}. {job.name}</option>)}</select><button onClick={()=>{reset();setNotice('Dispatch: '+JOBS[careerRef.current.job%JOBS.length].name);}}>NEXT JOB</button><button onClick={()=>{setGarage(v=>!v);setHelp(false);}}>FLEET / GARAGE</button><button onClick={reset}>RESET</button><button onClick={()=>{const s=sim.current;if(s){s.cameraYaw=0;s.cameraPitch=.24;s.zoom=13;}}}>RESET CAMERA</button><button onClick={()=>setHelp(v=>!v)}>CONTROLS</button></div>
  {notice&&<div className="game-notice" onClick={()=>setNotice('')}>{notice} ✕</div>}
  {garage&&<aside className="help garage"><button onClick={()=>setGarage(false)}>×</button><b>RECOVERY GARAGE</b><span>TEST MODE: All jobs and trucks unlocked. Choose any job from the bottom toolbar.</span><span>Balance: ${career.cash}</span><div className="fleet-list">{FLEET.map(t=><button key={t.id} className="garage-buy" onClick={()=>chooseTruck(t.id)}>{t.name} · {career.selected===t.id?'SELECTED':'TEST DRIVE'}</button>)}</div><button className="garage-buy" onClick={()=>upgrade('engine')}>ENGINE LV {career.engine}/3 · {'$'+(career.engine+1)*500}</button><button className="garage-buy" onClick={()=>upgrade('winch')}>WINCH LV {career.winch}/3 · {'$'+(career.winch+1)*500}</button><small>Progress saves on this device.</small></aside>}
  {help&&<aside className="help"><button onClick={()=>setHelp(false)}>×</button><b>HOW TO OPERATE</b><span>Use the left joystick to steer. Reverse and gas are on the right. Release the gas to slow down; use PARK BRAKE to stop and secure the truck. Deploy the boom and parking brake before winching. Heavy recoveries also require riggers. The parking brake is manual and must be engaged before hydraulic operations. Drag the scene to orbit; pinch to zoom. Drive within 24 m to hook the pickup. Light wheel-lift: park and lower the grids, release parking brake, back the grids under both front tires, reapply brake, secure tire straps, then lift and tow. Flatbed: tilt bed, hook, secure load and deliver. Medium wrecker: boom and winch recovery. Heavy rotator: boom, outriggers and winch. Buy trucks in FLEET / GARAGE.</span><small>Keyboard: W/S drive & reverse · A/D steer · H hook · R winch</small></aside>}
 </main>;
}
