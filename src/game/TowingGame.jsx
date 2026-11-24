import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {levelFourHeight,levelFourSlope,levelFourDownhillAcceleration,LEVEL_FOUR_STAGING} from './levelFourTerrain.js';
import {createLevelFourScene} from './levelFourScene.js';
import {createLakeScene,lakeHeight,lakeSlope,lakeDownhillAcceleration,LAKE_SURFACE} from './lakeScene.js';
import {RECOVERY_SAVE_KEY,captureRecoverySave,parseRecoverySave,restoreRecoverySave} from './progressSave.js';
import { canCompleteJob, minimapX, minimapY, wheelLiftCaptureReady, winchLoadBand, poweredWinchForce, stopWinchCoast, recoveryCableTension, canPowerBothRecoveryLines, cameraPresetPose } from './gameRules.js';

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
{name:'Heavy Rollover Recovery',x:-18,z:-63,pay:2600,kind:'heavy',truck:'rotator',weight:12,roll:1.48},
{name:'Lakeside Vehicle Recovery',x:-19,z:-76,pay:3400,kind:'heavy',truck:'rotator',weight:14,roll:1.88},
{name:'Overturned Delivery Truck',x:-20,z:-88,pay:4200,kind:'heavy',truck:'rotator',weight:16,roll:2.66,boxTruck:true},
{name:'Two-Vehicle Ravine Rescue',x:-17,z:-100,pay:5800,kind:'heavy',truck:'rotator',weight:17,roll:1.63,boxTruck:true,second:{x:-22,z:-106,roll:1.41,yaw:.28}}
];
// Quick camera presets are independent of the equipment and dispatch menus.
const CAMERA_MODES=[['ravine','RAVINE'],['orbit','FREE'],['chase','CHASE'],['reverse','REAR'],['front','FRONT'],['left','LEFT'],['right','RIGHT'],['top','TOP'],['hook','HOOK'],['wide','WIDE']];
const liftPitch=s=>s.type.id==='light'?.55-.65*s.liftHeight:.35-.36*s.liftHeight;
const liftReach=s=>s.type.id==='light'?1.72:2.85+s.liftExtension;
const RECOVERY_POINTS=[
{id:'front',label:'FRONT EYE',x:0,y:.73,z:-1.85},
{id:'rear',label:'REAR EYE',x:0,y:.73,z:1.83},
{id:'left',label:'LEFT EYE',x:-.96,y:.80,z:0},
{id:'right',label:'RIGHT EYE',x:.96,y:.80,z:0},
{id:'upper',label:'UPPER FRAME',x:.9,y:1.35,z:.1},
{id:'lower',label:'LOWER FRAME',x:-.9,y:.65,z:.1},
{id:'frontLeft',label:'FRONT LEFT',x:-.86,y:.72,z:-1.65},
{id:'frontRight',label:'FRONT RIGHT',x:.86,y:.72,z:-1.65},
{id:'rearLeft',label:'REAR LEFT',x:-.86,y:.72,z:1.65},
{id:'rearRight',label:'REAR RIGHT',x:.86,y:.72,z:1.65}
];
// Fictional attachment and redirect points; simplified recovery physics, not field rigging advice.
const recoveryAnchor=(target,point)=>target.pos.clone().add(V(0,.65,0)).add(V(point.x,point.y,point.z).applyEuler(new THREE.Euler(0,-target.yaw,target.roll,'YXZ')));
const selectedRecoveryPoint=(s,line)=>line.customPoint||RECOVERY_POINTS[line.point];
const lineRoute=(head,eye,redirect,second=null)=>[head,...(redirect?[redirect]:[]),...(second?[second]:[]),eye];
const linePathLength=(head,eye,redirect,second=null)=>{const points=lineRoute(head,eye,redirect,second);return points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0);};
// Three.js cannot grow an existing two-vertex BufferGeometry via setFromPoints.
// Preallocate three vertices and draw only the active route (direct or redirected).
const updateWinchLine=(line,points)=>{line.geometry.setFromPoints(points);line.geometry.setDrawRange(0,points.length);line.geometry.computeBoundingSphere();line.visible=true;};
const nextAnchorSlot=(anchors,current)=>{const choices=anchors.map((a,i)=>a.pos||i===0?i:-1).filter(i=>i>=0);return choices[(Math.max(0,choices.indexOf(current))+1)%choices.length];};
const winchSpeedFactor=(speed,tension)=>({fine:.35,medium:1,high:2.4}[speed]??1)*(1-.7*clamp(tension/42000,0,1));
const jobSceneYOffset=s=>JOBS[s.jobIndex%JOBS.length].kind==='recovery'&&!s.loaded?-.14:0;
const loadCareer=()=>{let saved={};try{saved=JSON.parse(localStorage.getItem('towing-career')||'{}')}catch{}const requested=Number(new URLSearchParams(window.location.search).get('level'));return Number.isInteger(requested)&&requested>=1&&requested<=JOBS.length?{...saved,job:requested-1}:saved;};

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
  const forks=[],outriggers=[],boomCylinders=[],liftCylinders=[];
  let recoveryStructure=null,boomPivot=null,boomTilt=null,boomSleeve=null,boomTip=null;
  let underliftPivot=null,underliftInner=null,underliftHead=null,liftCross=null;
  if(name==='wrecker') {
    // Fixed recovery boom with a separate articulated underlift. The rotator alone can slew.
    for(const side of [-1,1]) {
      box(body,'light-duty cabinet',[.27,.75,1.9],[side*.96,1.55,1.0],color);
      box(body,'light-duty handle',[.06,.08,.25],[side*1.11,1.66,1],0xb9c2c8);
    }
    box(body,'light-duty deck',[2.1,.12,2.4],[0,1.97,1.1],0x343b3f);
    recoveryStructure=new THREE.Group();recoveryStructure.name='fixed recovery assembly';body.add(recoveryStructure);
    box(recoveryStructure,'wrecker tool cabinet',[1.85,.67,2.2],[0,1.68,1.15],color);
    for(const side of [-1,1]){
      box(recoveryStructure,'side locker door',[.055,.43,1.58],[side*.945,1.62,1.13],0x354048);
      box(recoveryStructure,'locker latch',[.065,.085,.18],[side*.98,1.64,1.32],0xc1c7ca,{metalness:.65});
      const drum=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.52,18),new THREE.MeshStandardMaterial({color:0x343b40,metalness:.48,roughness:.45}));
      drum.rotation.z=Math.PI/2;drum.position.set(side*.40,2.13,.6);drum.castShadow=true;recoveryStructure.add(drum);
    }
    box(recoveryStructure,'recovery boom hinge',[1.12,.43,.55],[0,2.12,1.1],0x222c31);
    boomPivot=new THREE.Group();boomPivot.name='recovery yaw pivot';boomPivot.position.set(0,2.16,1.13);recoveryStructure.add(boomPivot);
    boomTilt=new THREE.Group();boomTilt.name='recovery pitch hinge';boomPivot.add(boomTilt);
    box(boomTilt,'recovery boom outer',[.72,.53,2.65],[0,.05,1.38],0x34414a,{metalness:.5});
    boomSleeve=box(boomTilt,'recovery boom telescoping sleeve',[.52,.38,1.62],[0,.055,2.49],0xd2a42e,{metalness:.38});
    boomTip=new THREE.Group();boomTip.position.set(0,.05,3.25);boomTilt.add(boomTip);
    box(boomTip,'cable sheave',[.66,.62,.34],[0,0,0],0x252e35,{metalness:.55});
    box(boomTip,'recovery hook',[.19,.46,.16],[0,-.46,.08],0xd9a72d,{metalness:.55});
    for(const side of [-1,1]){
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,1,12),new THREE.MeshStandardMaterial({color:0xaab2b9,metalness:.7,roughness:.3}));
      mesh.castShadow=true;recoveryStructure.add(mesh);boomCylinders.push({mesh,side});
    }
    for(const side of [-1,1]) {
      const arm=box(body,'outrigger arm',[1.15,.22,.28],[side*1.45,1.05,1.6],0x4c555a);
      const foot=box(body,'outrigger foot',[.48,.14,.6],[side*2.05,.55,1.6],0xe0b340);
      outriggers.push(arm,foot);
    }
    box(body,'underlift hinge housing',[.85,.49,.7],[0,1.12,2.37],0x252f35);
    underliftPivot=new THREE.Group();underliftPivot.name='underlift raise-lower hinge';underliftPivot.position.set(0,1.18,2.40);body.add(underliftPivot);
    box(underliftPivot,'underlift outer stinger',[.57,.32,2.53],[0,0,1.23],0x303a43,{metalness:.45});
    underliftInner=box(underliftPivot,'underlift sliding inner tube',[.42,.25,1.25],[0,0,2.08],0xb9a04f,{metalness:.48});
    underliftHead=new THREE.Group();underliftHead.name='leveling tire crossbar';underliftPivot.add(underliftHead);
    liftCross=box(underliftHead,'wheel lift crossbar',[2.30,.20,.36],[0,0,0],0x535e66,{metalness:.43});
    for(const side of [-1,1]){
      const grid=new THREE.Group();grid.name='wheel grid';underliftHead.add(grid);
      const cradle=box(grid,'tire cradle',[.44,.13,.95],[0,0,0],0x747e85);
      const lArm=box(grid,'L-arm tire restraint',[.17,.16,1.05],[side*.14,0,.68],0xc1c5c8);
      const stop=box(grid,'front tire stop',[.45,.22,.13],[0,.08,-.42],0xe2b54b);
      forks.push({grid,cradle,lArm,stop,side});
    }
    for(const side of [-1,1]){
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.075,.095,1,12),new THREE.MeshStandardMaterial({color:0xb1b9c1,metalness:.65,roughness:.32}));
      mesh.castShadow=true;body.add(mesh);liftCylinders.push({mesh,side});
    }
  }
  const bed=box(body,'rollback bed',[2.15,.22,5.3],[0,1.45,1],0x606a71);bed.visible=false;
  const straps=[];for(const x of [-.8,.8]){const strap=box(body,'tire strap',[.22,.12,.55],[x,1.1,4.4],0xe3b13e);strap.visible=false;straps.push(strap);}
  // Tow pivot sits over the rear axle: the rear tires stay on the road
  // while the body and captured front axle pitch upward under the wheel lift.
  let towPitchPivot=null;
  if(name!=='wrecker'){
    const rearAxleZ=1.55*scale;
    towPitchPivot=new THREE.Group();
    towPitchPivot.name='rear axle towing pitch pivot';
    towPitchPivot.position.z=rearAxleZ;
    root.add(towPitchPivot);
    root.remove(body);towPitchPivot.add(body);body.position.z-=rearAxleZ;
    for(const tire of wheels){
      if(tire.position.z<0){
        root.remove(tire);towPitchPivot.add(tire);tire.position.z-=rearAxleZ;
      }
    }
  }
  root.userData={body,wheels,scale,towPitchPivot,bed,straps,recoveryStructure,boomPivot,boomTilt,boomSleeve,boomTip,boomCylinders,underliftPivot,underliftInner,underliftHead,liftCross,liftCylinders,forks,outriggers};
  return root;
}

// Keep the button identity stable during frequent HUD renders.
function Hold({label,onDown,onUp,wide=false}) {
 return <button className={wide?'control wide':'control'}
 onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);onDown(e);}}
 onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}
 onContextMenu={e=>e.preventDefault()}>{label}</button>;
}
export default function TowingGame(){
 const [career,setCareer]=useState(()=>{
 const saved={job:0,cash:0,completed:0,engine:0,winch:0,owned:['light'],selected:'light',...loadCareer()};
 // Match the equipped fleet truck to the dispatch after a page reload.
 return {...saved,selected:JOBS[(saved.job||0)%JOBS.length].truck};
});
 const careerRef=useRef(career);careerRef.current=career;
 const pendingRestore=useRef(null);
 const [restoreSequence,setRestoreSequence]=useState(0);
 const [savedCheckpoint,setSavedCheckpoint]=useState(()=>{
  try{return parseRecoverySave(localStorage.getItem(RECOVERY_SAVE_KEY),JOBS.length)}catch{return null}
 });
 const [settingsOpen,setSettingsOpen]=useState(false),[mapOpen,setMapOpen]=useState(()=>typeof window==='undefined'||window.innerHeight>520),[menuOpen,setMenuOpen]=useState(false),[recoveryOpen,setRecoveryOpen]=useState(true);const [settings,setSettings]=useState(()=>{try{return {steering:1,boom:1,winch:1,driveMode:'joystick',...JSON.parse(localStorage.getItem('towing-controls')||'{}')}}catch{return {steering:1,boom:1,winch:1,driveMode:'joystick'}}});const settingsRef=useRef(settings);settingsRef.current=settings;const changeSetting=(key,value)=>setSettings(old=>{const next={...old,[key]:value};settingsRef.current=next;try{localStorage.setItem('towing-controls',JSON.stringify(next))}catch{}return next;});
 const [equipmentTab,setEquipmentTab]=useState('quick'),[activeRecoveryLine,setActiveRecoveryLine]=useState(0),[winchSpeed,setWinchSpeed]=useState('medium'),[placingAnchor,setPlacingAnchor]=useState(false);const [garage,setGarage]=useState(false),[notice,setNotice]=useState(''),[hydraulic,setHydraulic]=useState({x:0,y:0}),[boomStick,setBoomStick]=useState({x:0,y:0}),[boomMode,setBoomMode]=useState('extend'),[cameraMode,setCameraMode]=useState('orbit'),[cameraPanelOpen,setCameraPanelOpen]=useState(false);
 const saveCareer=fn=>setCareer(old=>{const next=fn(old);careerRef.current=next;try{localStorage.setItem('towing-career',JSON.stringify(next))}catch{}return next;});
 const mount=useRef(null),sim=useRef(null),[hud,setHud]=useState({speed:0,gear:'D',hook:false,tension:0,winch:'IDLE'}),[help,setHelp]=useState(false),[steerVisual,setSteerVisual]=useState(0);
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x9db2c2);scene.fog=new THREE.Fog(0x9db2c2,55,180);
  const camera=new THREE.PerspectiveCamera(62,1,.1,350);camera.position.set(9,7,12);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xdcecff,0x56604a,2.0));const sun=new THREE.DirectionalLight(0xfff0d8,2.4);sun.position.set(-25,38,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
  const levelIndex=careerRef.current.job%JOBS.length;
  const levelFour=levelIndex>=3;
  const lakeLevel=levelIndex===4;
  const terrainHeight=lakeLevel?lakeHeight:levelFourHeight;
  const terrainSlope=lakeLevel?lakeSlope:levelFourSlope;
  const terrainGravity=lakeLevel?lakeDownhillAcceleration:levelFourDownhillAcceleration;
  const terrainScene=lakeLevel?createLakeScene(THREE,scene):levelFour?createLevelFourScene(THREE,scene):null;
  const ravineStartZ=levelFour?Math.min(-49,JOBS[careerRef.current.job%JOBS.length].z+15):7;
  if(levelFour){scene.fog.far=250;scene.background.set(lakeLevel?0x9dc5d2:0xa3b6c1);}
  if(!levelFour){const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:0x59684a,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;ground.receiveShadow=true;scene.add(ground);}
  const road=new THREE.Mesh(new THREE.BoxGeometry(10,.12,180),new THREE.MeshStandardMaterial({color:0x303438,roughness:.95}));road.position.set(0,-.02,-36);road.receiveShadow=true;scene.add(road);
  const shoulder=new THREE.Mesh(new THREE.BoxGeometry(5,.16,180),new THREE.MeshStandardMaterial({color:0x85785d}));shoulder.position.set(7.1,-.07,-36);scene.add(shoulder);
  const ditch=new THREE.Mesh(new THREE.BoxGeometry(4,.55,28),new THREE.MeshStandardMaterial({color:0x4d5840}));ditch.position.set(10.5,-.38,-20);scene.add(ditch);
  if(!levelFour)for(let i=0;i<30;i++){const x=(i%2?1:-1)*(14+Math.random()*28),z=-70+i*5;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,2.8,7),new THREE.MeshStandardMaterial({color:0x59432e}));trunk.position.set(x,1.3,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.5+Math.random(),4.4,7),new THREE.MeshStandardMaterial({color:0x344d38}));crown.position.set(x,4.1,z);crown.castShadow=true;scene.add(crown);}
  // Recessed ravine and tilted gravel shoulders for the advanced dispatches.
  if(!levelFour)for(const x of [-24,-14]){const bank=new THREE.Mesh(new THREE.BoxGeometry(5,.6,64),new THREE.MeshStandardMaterial({color:0x655a46,roughness:1}));bank.position.set(x,-.1,-78);bank.rotation.z=x<-20?-.19:.19;bank.receiveShadow=true;scene.add(bank);}
  if(!levelFour){const ravineFloor=new THREE.Mesh(new THREE.BoxGeometry(9,.12,63),new THREE.MeshStandardMaterial({color:0x4a4539,roughness:1}));ravineFloor.position.set(-19,-.26,-78);scene.add(ravineFloor);}
  for(let z=-120;z<40;z+=8){const dash=new THREE.Mesh(new THREE.BoxGeometry(.13,.025,3.4),new THREE.MeshBasicMaterial({color:0xe4dfc6}));dash.position.set(0,.06,z);scene.add(dash);}
  const type=FLEET.find(t=>t.id===careerRef.current.selected)||FLEET[0];
  const truck=makeVehicle(scene,{name:'wrecker',color:type.color,pos:V(0,0,ravineStartZ),scale:type.id==='rotator'?1.13:1});
  const tools=type.tools;truck.userData.bed.visible=tools.includes('bed');
  truck.userData.recoveryStructure.visible=tools.includes('boom');truck.userData.underliftPivot.visible=tools.includes('lift');for(const part of truck.userData.outriggers)part.visible=false;if(type.id==='light'){const outer=truck.userData.underliftPivot.getObjectByName('underlift outer stinger');outer.scale.z=.60;outer.position.z=.71;truck.userData.underliftInner.visible=false;}for(const o of truck.userData.body.children){if(o.name.startsWith('light-duty'))o.visible=type.id==='light';if(o.name.startsWith('outrigger'))o.visible=false;if(o.name==='underlift hinge housing')o.visible=tools.includes('lift');}
  const firstJob=JOBS[careerRef.current.job%JOBS.length];
  const pickup=makeVehicle(scene,{name:'pickup',color:firstJob.kind==='flatbed'?0xb8c6ce:firstJob.kind==='recovery'?0x8f4534:0x315c83,pos:V(firstJob.x,levelFour?terrainHeight(firstJob.x,firstJob.z):0,firstJob.z),scale:firstJob.kind==='recovery'?1.06:firstJob.boxTruck?1.15:.92});
  // Job-specific vehicles and recovery scenes, rather than reusing the same pickup.
  if(firstJob.kind==='tow'){
    // Parking lot with marked stalls, a sidewalk, and a tow-away sign.
    const lot=box(scene,'parking lot',[16,.08,17],[4,-.08,-19],0x3e4448);lot.receiveShadow=true;
    for(let i=-2;i<=2;i++)box(scene,'parking space line',[.10,.015,6],[i*2.7+4,.015,-18],0xe9e2ca);
    box(scene,'tow-away sign pole',[.12,2.4,.12],[10,1.14,-15],0xa8b0b6);
    box(scene,'tow-away sign',[1.4,.7,.12],[10,2.38,-15],0xe5ce6c);
  }else if(firstJob.kind==='flatbed'){
    // Disabled AWD crossover: longer body and contrasting roof, at a roadside pull-off.
    box(pickup.userData.body,'AWD crossover roof',[1.8,.32,2.5],[0,2.37,-.25],0x647b85);
    box(pickup.userData.body,'AWD roof rails',[1.75,.10,2.8],[0,2.56,-.25],0x292f37);
    const pullOff=box(scene,'roadside transport bay',[8,.06,17],[3,-.065,-42],0x7d7970);pullOff.receiveShadow=true;
    for(let i=0;i<4;i++)box(scene,'transport bay stripe',[.25,.025,2],[6,.02,-48+i*4],0xeee7cc);
    box(scene,'loading zone marker',[.6,.10,1.4],[7,.08,-41],0xdec555);
  }else if(firstJob.kind==='recovery'){
    // Off-road pickup sunk into a cut ditch with marker posts and a damaged barrier.
    box(pickup.userData.body,'recovery cargo tray',[1.96,.24,2.65],[0,1.61,1.16],0x6f7274);
    box(pickup.userData.body,'recovery brush guard',[2.0,.47,.15],[0,1.18,-2.63],0x24282b);
    for(const z of [-36,-30,-24])box(scene,'ditch hazard post',[.14,1.25,.14],[7.3,.53,z],0xe0a435);
    const fallen=box(scene,'damaged guardrail',[.17,.19,6.7],[8,.52,-27],0xb4bab9);fallen.rotation.x=.24;
    pickup.position.y=-.14;pickup.rotation.z=-.15;
  }
  if(firstJob.boxTruck)box(pickup.userData.body,'delivery cargo box',[1.96,1.1,2.55],[0,2.02,.9],0xc8d4dc);
  const secondaryPickup=makeVehicle(scene,{name:'second disabled truck',color:0x985b3a,pos:V(firstJob.second?.x??-22,levelFour?terrainHeight(firstJob.second?.x??-22,firstJob.second?.z??-106):0,firstJob.second?.z??-106),scale:1.04});
  box(secondaryPickup.userData.body,'cargo panel',[1.95,.7,2.2],[0,1.94,.7],0xa1a9b0);
  secondaryPickup.visible=!!firstJob.second;
  // Fixed anchor fixtures let each winch line be routed directly or around a ground/tree point.
  const riggingAnchors=[
    {id:'direct',label:'DIRECT LINE',pos:null},
    {id:'ground',label:'GROUND ANCHOR',pos:V(firstJob.x-6,(levelFour?terrainHeight(firstJob.x-6,firstJob.z+6):0)+.45,firstJob.z+6)},
    {id:'tree',label:'TREE ANCHOR',pos:V(firstJob.x+8,(levelFour?terrainHeight(firstJob.x+8,firstJob.z-5):0)+1.30,firstJob.z-5)}
  ];
  // Two movable player-created stakes: one for each heavy-recovery line.
  for(let i=0;i<2;i++){
    const marker=new THREE.Group();
    const stake=new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,1.15,10),new THREE.MeshStandardMaterial({color:i===0?0x56e1f0:0xf6b854}));
    stake.position.y=.57;stake.castShadow=true;marker.add(stake);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.75,.07,8,24),new THREE.MeshBasicMaterial({color:i===0?0x56e1f0:0xf6b854}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.08;marker.add(ring);marker.visible=false;scene.add(marker);
    riggingAnchors.push({id:'placed'+i,label:'YOUR ANCHOR '+(i===0?'A':'B'),pos:null,marker});
  }
  const groundPoint=riggingAnchors[1].pos,treePoint=riggingAnchors[2].pos;
  box(scene,'fixed ground anchor stake',[.22,.88,.22],[groundPoint.x,groundPoint.y-.13,groundPoint.z],0xf4b02e);
  box(scene,'ground anchor plate',[.75,.12,.75],[groundPoint.x,groundPoint.y-.40,groundPoint.z],0x233d4b);
  box(scene,'fixed tree redirect trunk',[.60,2.7,.60],[treePoint.x,treePoint.y-.03,treePoint.z],0x68452d);
  const anchorCrown=new THREE.Mesh(new THREE.ConeGeometry(1.55,3.5,8),new THREE.MeshStandardMaterial({color:0x356a3d}));anchorCrown.position.set(treePoint.x,treePoint.y+2.6,treePoint.z);anchorCrown.castShadow=true;scene.add(anchorCrown);
  box(scene,'tree anchor identification',[.94,.22,.20],[treePoint.x,treePoint.y,treePoint.z+.38],0xf4b02e);
  const recoveryCables=[0,1].map(i=>{const geometry=new THREE.BufferGeometry().setFromPoints([V(),V(),V()]);geometry.setDrawRange(0,2);const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:i===0?0xf0b73b:0x55d3ec}));line.visible=false;scene.add(line);return line;});
  const zone=new THREE.Mesh(new THREE.RingGeometry(3.5,3.85,48),new THREE.MeshBasicMaterial({color:0x46ef9c,side:THREE.DoubleSide}));
  zone.rotation.x=-Math.PI/2;zone.position.set(firstJob.kind==='tow'||firstJob.kind==='flatbed'?0:2,.12,firstJob.kind==='tow'||firstJob.kind==='flatbed'?23:firstJob.z);scene.add(zone);
  pickup.rotation.y=.18;
  // Pickup starts low in the soft ditch with a little yaw.
  const cableMat=new THREE.LineBasicMaterial({color:0xf3bd43});const cableGeo=new THREE.BufferGeometry().setFromPoints([V(),V(),V()]);cableGeo.setDrawRange(0,2);const cable=new THREE.Line(cableGeo,cableMat);scene.add(cable);cable.visible=false;
  const s={truck,pickup,zone,anchorPlacement:null,customHookPlacement:null,doubleAnchorSetup:false,levelFour,pos:V(0,levelFour?terrainHeight(0,ravineStartZ):0,ravineStartZ),vel:V(),yaw:0,steer:0,throttle:0,brake:0,hook:false,winch:false,winchOut:false,parkingBrake:false,boomDeployed:false,boomAngle:.36,boomSwing:0,boomExtension:0,boomControl:0,boomExtendControl:0,boomSwingControl:0,liftDeployed:false,liftHeight:0,liftExtension:0,liftControl:0,liftExtendControl:0,liftHydraulicX:0,liftHydraulicY:0,gridWidth:0,armsClosed:false,riggersDeployed:false,cableLength:14,tension:0,pickPos:V(firstJob.x,levelFour?terrainHeight(firstJob.x,firstJob.z):0,firstJob.z),pickVel:V(),pickYaw:-.18,pickYawVel:0,cameraYaw:0,cameraPitch:.24,presetYaw:0,presetPitch:0,zoom:13,cameraMode:levelFour?'ravine':cameraMode,orbitFocus:'truck',drag:null,pointers:new Map(),lastHud:0,jobIndex:careerRef.current.job,jobDone:false,dropoffArrived:false,dropoffComplete:false,autoUnload:false,autoLoad:false,heavyRecovery:firstJob.kind==='heavy',loaded:false,strapsOn:false,bedTilt:false,pickRoll:firstJob.roll??0,pickRollVel:0,secondary:{mesh:secondaryPickup,active:!!firstJob.second,pos:V(firstJob.second?.x??-22,levelFour?terrainHeight(firstJob.second?.x??-22,firstJob.second?.z??-106):0,firstJob.second?.z??-106),vel:V(),yaw:firstJob.second?.yaw??-.1,yawVel:0,roll:firstJob.second?.roll??0,rollVel:0},recoveryCables,riggingAnchors,hookPoint:0,hookRedirect:0,winchSpeed,recoveryLines:[{connected:false,point:0,redirect:0,target:0,spool:20,motor:0,tension:0},{connected:false,point:1,redirect:0,target:0,spool:20,motor:0,tension:0}],type,tools};
  sim.current=s;
  if(levelFour)setCameraMode('ravine');
  const checkpoint=pendingRestore.current;
  if(checkpoint&&checkpoint.jobIndex===s.jobIndex&&checkpoint.career.selected===s.type.id){
   restoreRecoverySave(s,checkpoint,V);pendingRestore.current=null;
   setCameraMode(s.cameraMode);setWinchSpeed(s.winchSpeed);
   setNotice('SAVED JOB RESTORED: '+JOBS[s.jobIndex%JOBS.length].name+'.');
  }
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};const ro=new ResizeObserver(resize);ro.observe(host);resize();
  let last=performance.now(),raf=0;
  const update=(now)=>{
   const dt=Math.min(.033,(now-last)/1000);last=now;const steps=Math.max(1,Math.ceil(dt/(1/120)));const h=dt/steps;
   for(let n=0;n<steps;n++){
    const forward=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));const right=V(Math.cos(s.yaw),0,Math.sin(s.yaw));
    const speed=s.vel.dot(forward);const steerAngle=s.steer*settingsRef.current.steering*(.64-.36*clamp(Math.abs(speed)/22,0,1));s.truck.userData.body.rotation.y=0;
    const parked=s.parkingBrake||s.riggersDeployed||s.winch||s.winchOut;const accel=parked?-Math.sign(speed)*18:s.brake?-Math.sign(speed)*18:s.throttle*(5.8+careerRef.current.engine*1.2)-speed*0.22;
    s.vel.addScaledVector(forward,accel*h);
    if(levelFour){const hill=terrainGravity(s.pos.x,s.pos.z,.40);
      s.vel.x+=hill.x*h;s.vel.z+=hill.z*h;
      if(s.pos.x< -5.5)s.vel.multiplyScalar(Math.exp(-(lakeLevel?.70:.42)*h));}
    const side=s.vel.dot(right);s.vel.addScaledVector(right,-side*Math.min(1,12.5*h));
    s.vel.multiplyScalar(Math.pow(.985,h*60));
    const yawRate=clamp((speed/2.9)*Math.tan(steerAngle),-1.55,1.55);s.yaw+=yawRate*h;
    const max=20;const sp=s.vel.length();if(sp>max)s.vel.setLength(max);
    s.pos.addScaledVector(s.vel,h);
    if(levelFour&&s.pos.x < -4.02&&s.pos.z < -40&&s.pos.z > -98&&!(s.pos.z>=-68&&s.pos.z<=-58)){
      // Roadside steel barrier stops the truck except at the broken crash gap.
      s.pos.x=-4.02;s.vel.x=Math.max(0,s.vel.x)*.13;
    }
    s.pos.y=levelFour?terrainHeight(s.pos.x,s.pos.z):0;
    // Truck wheel spin and steering articulation.
    for(let i=0;i<s.truck.userData.wheels.length;i++){const w=s.truck.userData.wheels[i];w.rotation.y=0;w.rotation.order='YXZ';w.rotation.y=i<2?steerAngle*.45:0;w.rotation.x+=speed*h/0.48;}
    s.truck.position.copy(s.pos);s.truck.rotation.order='YXZ';s.truck.rotation.y=-s.yaw;
    if(levelFour){const grade=terrainSlope(s.pos.x,s.pos.z);
      s.truck.rotation.x=clamp(grade.z,-.30,.30);
      s.truck.rotation.z=clamp(-grade.x,-.48,.48);
    }
    const equip=s.truck.userData;
    // Held hydraulic controls integrate over time, even without pointer-move events.
    if((s.parkingBrake||s.riggersDeployed)&&s.vel.length()<.25){
      if(s.boomDeployed){
        s.boomAngle=clamp(s.boomAngle+s.boomControl*h*.80*settingsRef.current.boom,0,1.08);
        s.boomExtension=clamp(s.boomExtension+s.boomExtendControl*h*1.15*settingsRef.current.boom,0,2.2);
        if(s.type.id==='rotator')s.boomSwing=clamp(s.boomSwing+s.boomSwingControl*h*.8*settingsRef.current.boom,-1.1,1.1);
      }
    }
    // Light-duty hydraulics can be used during slow positioning, without engaging park.
    if(s.liftDeployed&&(s.type.id==='light'?s.vel.length()<2.3:(s.parkingBrake&&s.vel.length()<.25))){
      s.liftHeight=clamp(s.liftHeight+(s.liftControl+s.liftHydraulicY)*h*.70*settingsRef.current.boom,0,1.25);
      if(s.type.id!=='light')s.liftExtension=clamp(s.liftExtension+(s.liftExtendControl+s.liftHydraulicX)*h*.90*settingsRef.current.boom,0,1.5);
    }
    // After positioning the tire grids, one-tap loading raises the captured axle
    // slowly and secures both tires. The free rear wheels remain on the road.
    if(s.autoLoad&&s.parkingBrake&&s.vel.length()<.25&&s.loaded&&s.liftDeployed){
      s.liftControl=0;s.liftHydraulicY=0;
      s.liftHeight=Math.min(.7,s.liftHeight+h*.65*settingsRef.current.boom);
      if(s.liftHeight>=.69){
        s.liftHeight=.7;s.strapsOn=true;s.autoLoad=false;
        setNotice('Tires lifted and strapped. Release PARK BRAKE and tow to depot.');
      }
    }
    // One-tap depot unloading animates the lift down, releases the L-arms,
    // and awards the job only once the vehicle is safely on its own wheels.
    if(s.autoUnload&&s.parkingBrake&&s.vel.length()<.25&&s.loaded){
      s.liftControl=0;s.liftHydraulicY=0;
      s.liftHeight=Math.max(0,s.liftHeight-h*.65*settingsRef.current.boom);
      if(s.liftHeight<=.02){
        s.liftHeight=0;s.autoUnload=false;s.armsClosed=false;s.loaded=false;
        s.strapsOn=false;s.prevHitch=null;s.pickVel.set(0,0,0);
        s.dropoffComplete=true;setNotice('Vehicle unloaded. Tow job complete!');
      }
    }
    equip.bed.rotation.x=s.bedTilt?-.18:0;equip.bed.position.z=s.bedTilt?1.8:1;
    for(const part of equip.outriggers){
      part.visible=s.tools.includes('riggers')&&s.riggersDeployed;
      const sign=Math.sign(part.position.x);
      part.position.x=sign*(s.riggersDeployed?(part.name==='outrigger arm'?1.75:2.5):(part.name==='outrigger arm'?1.45:2.05));
      part.position.y=s.riggersDeployed?(part.name==='outrigger arm'?.88:.13):(part.name==='outrigger arm'?1.05:.55);
    }
    if(equip.boomPivot){
      // Medium wrecker: fixed vertical plane. Heavy rotator: slewing turntable.
      equip.boomPivot.rotation.y=s.type.id==='rotator'&&s.boomDeployed?s.boomSwing:0;
      equip.boomTilt.rotation.x=s.boomDeployed?-(.12+s.boomAngle):-.10;
      equip.boomSleeve.position.z=2.49+s.boomExtension*.5;
      equip.boomSleeve.scale.z=1+s.boomExtension/1.62;
      equip.boomTip.position.z=3.25+s.boomExtension;
      equip.recoveryStructure.updateWorldMatrix(true,true);
      for(const {mesh,side} of equip.boomCylinders){
        const a=V(side*.48,1.86,1.71);
        const b=equip.recoveryStructure.worldToLocal(equip.boomTilt.localToWorld(V(side*.25,-.10,1.19)));
        const d=b.clone().sub(a);
        mesh.position.copy(a).addScaledVector(d,.5);
        mesh.quaternion.setFromUnitVectors(V(0,1,0),d.clone().normalize());
        mesh.scale.y=d.length();
      }
    }
    if(equip.underliftPivot){
      const pitch=s.liftDeployed?liftPitch(s):-1.30;
      equip.underliftPivot.rotation.x=pitch;
      equip.underliftInner.position.z=2.08+s.liftExtension*.5;
      equip.underliftInner.scale.z=1+s.liftExtension/1.25;
      equip.underliftHead.position.z=liftReach(s);
      equip.underliftHead.rotation.x=-pitch; // Level tire crossbar throughout lift.
      equip.liftCross.visible=s.tools.includes('lift');
      for(const fork of equip.forks){
        fork.grid.visible=s.liftDeployed;
        fork.grid.position.set(fork.side*(.78+s.gridWidth),-.14,0);
        fork.grid.rotation.y=s.armsClosed?0:fork.side*.28;
        fork.lArm.position.z=s.armsClosed?.55:1.05;
      }
      equip.body.updateWorldMatrix(true,true);
      for(const {mesh,side} of equip.liftCylinders){
        const a=V(side*.36,.88,1.84);
        const b=equip.body.worldToLocal(equip.underliftPivot.localToWorld(V(side*.28,0,1.05)));
        const d=b.clone().sub(a);
        mesh.position.copy(a).addScaledVector(d,.5);
        mesh.quaternion.setFromUnitVectors(V(0,1,0),d.clone().normalize());
        mesh.scale.y=d.length();
        mesh.visible=s.tools.includes('lift');
      }
      const hitchZ=2.4+Math.cos(pitch)*liftReach(s);
      for(const strap of equip.straps){
        strap.visible=s.strapsOn&&s.tools.includes('lift');
        strap.position.y=1.18-Math.sin(pitch)*liftReach(s)+.13;
        strap.position.z=hitchZ;
      }
    }
    if(levelFour&&!s.loaded){
      // Surface gravity makes uphill pulls resist the winches.
      const g=terrainGravity(s.pickPos.x,s.pickPos.z,.36);
      s.pickVel.x+=g.x*h;s.pickVel.z+=g.z*h;
      if(s.secondary.active){const g2=terrainGravity(s.secondary.pos.x,s.secondary.pos.z,.36);
        s.secondary.vel.x+=g2.x*h;s.secondary.vel.z+=g2.z*h;}
    }
    // Recovery ropes pull on selectable frame eyes, generating translation and roll torque.
    if(s.type.id==='rotator'){
      const targets=[{pos:s.pickPos,vel:s.pickVel,yaw:s.pickYaw,roll:s.pickRoll,mass:JOBS[s.jobIndex%JOBS.length].weight||12},{pos:s.secondary.pos,vel:s.secondary.vel,yaw:s.secondary.yaw,roll:s.secondary.roll,mass:11}];
      const torques=[0,0],yawTorques=[0,0];
      for(let i=0;i<2;i++){
        const line=s.recoveryLines[i],rope=s.recoveryCables[i],target=targets[line.target];
        if(!line.connected||!s.boomDeployed||(line.target===1&&!s.secondary.active)){rope.visible=false;line.tension=0;continue;}
        const point=selectedRecoveryPoint(s,line),anchor=recoveryAnchor(target,point);
        const head=equip.boomTip.getWorldPosition(V()).add(V(i===0?-.25:.25,0,0));
        const guide=s.riggingAnchors[line.redirect].pos;
        const second=line.secondRedirect?s.riggingAnchors[line.secondRedirect].pos:null;
        const distance=linePathLength(head,anchor,guide,second);
        const direction=(second||guide||head).clone().sub(anchor).normalize();
        updateWinchLine(rope,lineRoute(head,anchor,guide,second));
        const safe=s.parkingBrake&&s.riggersDeployed&&s.vel.length()<.25;
        if(safe&&line.motor!==0)line.spool=clamp(line.spool-line.motor*(2.1+careerRef.current.winch*.35)*settingsRef.current.winch*winchSpeedFactor(s.winchSpeed,line.tension)*h,3,90);
        const relative=target.vel.dot(direction);
        // Releasing stops the motor, not the drum brake: the other line's pull
        // must create resistance and visible load on this stationary cable.
        const pull=recoveryCableTension(distance,line.spool,relative,42000);
        line.tension=pull;
        if(pull>0){
          const axis=V(Math.cos(target.yaw),0,Math.sin(target.yaw));
          const cx=point.x*Math.cos(target.roll)-point.y*Math.sin(target.roll);
          const cy=point.x*Math.sin(target.roll)+point.y*Math.cos(target.roll);
          torques[line.target]+=(cx*direction.y-cy*direction.dot(axis))*pull/(target.mass*8200);
          // Horizontal moment about the vehicle's center: off-center pulls pivot the chassis.
          const offset=V(point.x,0,point.z).applyAxisAngle(V(0,1,0),-target.yaw);
          yawTorques[line.target]+=(offset.x*direction.z-offset.z*direction.x)*pull/(target.mass*4200);
          target.vel.addScaledVector(V(direction.x,0,direction.z),pull/(target.mass*(levelFour?1350:3100))*h);
        }
      }
      s.pickYawVel=clamp((s.pickYawVel+yawTorques[0]*h)*Math.exp(-2.2*h),-1.4,1.4);
      if(!s.loaded)s.pickYaw+=s.pickYawVel*h;
      if(s.secondary.active){s.secondary.yawVel=clamp((s.secondary.yawVel+yawTorques[1]*h)*Math.exp(-2.2*h),-1.4,1.4);s.secondary.yaw+=s.secondary.yawVel*h;}
      if(!s.recoveryLines.some(l=>l.connected&&l.target===0&&l.motor>0)){s.pickVel.x=stopWinchCoast(s.pickVel.x,h);s.pickVel.z=stopWinchCoast(s.pickVel.z,h);s.pickRollVel=stopWinchCoast(s.pickRollVel,h);}
       s.pickRollVel=clamp((s.pickRollVel+torques[0]*h)*Math.exp(-1.7*h),-1.5,1.5);
      s.pickRoll=clamp(s.pickRoll+s.pickRollVel*h,0,3.06);
      if(s.pickRoll===0||s.pickRoll===3.06)s.pickRollVel=0;
      if(s.secondary.active){
        if(!s.recoveryLines.some(l=>l.connected&&l.target===1&&l.motor>0)){s.secondary.vel.x=stopWinchCoast(s.secondary.vel.x,h);s.secondary.vel.z=stopWinchCoast(s.secondary.vel.z,h);s.secondary.rollVel=stopWinchCoast(s.secondary.rollVel,h);}
        s.secondary.rollVel=clamp((s.secondary.rollVel+torques[1]*h)*Math.exp(-1.7*h),-1.5,1.5);
        s.secondary.roll=clamp(s.secondary.roll+s.secondary.rollVel*h,0,3.06);
        if(s.secondary.roll===0||s.secondary.roll===3.06)s.secondary.rollVel=0;
        s.secondary.vel.multiplyScalar(Math.exp(-1.25*h));
        s.secondary.pos.addScaledVector(s.secondary.vel,h);
        if(levelFour)s.secondary.pos.y=terrainHeight(s.secondary.pos.x,s.secondary.pos.z);
        s.secondary.mesh.position.copy(s.secondary.pos);
        s.secondary.mesh.position.y=s.secondary.pos.y+.5+Math.sin(s.secondary.roll)*.16;
        s.secondary.mesh.rotation.y=-s.secondary.yaw;s.secondary.mesh.rotation.z=s.secondary.roll;
      }
    }
    // Ditch resistance and recovery vehicle interaction.
    const pa=s.boomDeployed&&s.tools.includes('boom')&&equip.boomTip?equip.boomTip.getWorldPosition(V()):s.pos.clone().add(V(0,1.1,0)).add(forward.clone().multiplyScalar(-2.3));
    const pb=recoveryAnchor({pos:s.pickPos,yaw:s.pickYaw,roll:s.type.id==='rotator'?s.pickRoll:0},RECOVERY_POINTS[s.hookPoint]);
    const guide=s.riggingAnchors[s.hookRedirect].pos;
    const dist=linePathLength(pa,pb,guide);
    const dir=pb.clone().sub(guide||pa).normalize();
    if(s.hook){
       const ready=(s.boomDeployed||s.tools.includes('bed'))&&(!s.heavyRecovery||s.riggersDeployed)&&s.parkingBrake,pulling=s.winch&&ready;
       if(pulling)s.cableLength=Math.max(3.2,s.cableLength-(2.4+careerRef.current.winch*.8)*settingsRef.current.winch*winchSpeedFactor(s.winchSpeed,s.tension)*h);
       if(s.winchOut&&ready)s.cableLength=Math.min(90,s.cableLength+3.2*settingsRef.current.winch*winchSpeedFactor(s.winchSpeed,s.tension)*h);
       if(!pulling)s.cableLength=Math.max(s.cableLength,dist);
       const rel=s.pickVel.clone().sub(s.vel).dot(dir);
       s.tension=poweredWinchForce(pulling,Math.max(0,(dist-s.cableLength)*6200+rel*780));
       if(s.tension>32000){
         // A stalled winch retains the attached cable instead of silently snapping it.
         s.tension=32000;s.winch=false;s.cableLength=Math.max(s.cableLength,dist-32000/6200);
         if(!s.winchOverloadNotified){s.winchOverloadNotified=true;setNotice('WINCH OVERLOAD: Cable held, motor stopped. Use rotator lines A/B or improve the pull angle.');}
       }else if(pulling&&dist>s.cableLength){const force=Math.min(s.tension,32000);s.pickVel.addScaledVector(dir,-force/2350*h);if(!guide)s.vel.addScaledVector(dir,force/6200*h);}
       if(s.tension<28000)s.winchOverloadNotified=false;
       if(!pulling){s.pickVel.x=stopWinchCoast(s.pickVel.x,h);s.pickVel.z=stopWinchCoast(s.pickVel.z,h);}
     } else s.tension=0;
    if(s.loaded){if(s.type.id==='flatbed'){s.pickPos.copy(s.pos).addScaledVector(forward,-.9);s.pickYaw=s.yaw;}else{
      // Wheel-lift: hitch is fixed to the truck, and the trailing axle rolls behind it.
      // Never aim the car at the hitch: that causes 180-degree flips at rest.
      const hitchPitch=liftPitch(s);const hitchDistance=2.4+Math.cos(hitchPitch)*liftReach(s);const hitch=s.pos.clone().addScaledVector(forward,-hitchDistance);
      const drawbar=1.55;
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
      // Only the free rear axle turns while the front wheels stay in the cradle.
      for(const wheel of s.pickup.userData.wheels){
        if(wheel.position.z>0)wheel.rotation.x+=longitudinal/(.48*s.pickup.userData.scale);
      }
    }s.pickVel.set(0,0,0);}
    // Pickup's soft-ground drag and rolling resistance.
    const pside=s.pickVel.dot(V(Math.cos(s.pickYaw),0,Math.sin(s.pickYaw)));s.pickVel.addScaledVector(V(Math.cos(s.pickYaw),0,Math.sin(s.pickYaw)),-pside*Math.min(1,2.6*h));
    if(!s.loaded){
      // Rolling resistance on steep terrain; downhill gravity remains active.
      s.pickVel.multiplyScalar(Math.pow(lakeLevel?.955:levelFour?.982:.994,h*60));
      s.pickPos.addScaledVector(s.pickVel,h);
      if(levelFour){
        for(const rock of terrainScene.obstacles){
          if(Math.hypot(s.pickPos.x-firstJob.x,s.pickPos.z-firstJob.z)<3.2)continue;
          const dx=s.pickPos.x-rock.x,dz=s.pickPos.z-rock.z,dist=Math.hypot(dx,dz),clearance=rock.r+1.15;
          if(dist>0.01&&dist<clearance){
            s.pickPos.x+=dx/dist*(clearance-dist);s.pickPos.z+=dz/dist*(clearance-dist);
            s.pickVel.multiplyScalar(.65);
          }
        }
        s.pickPos.y=terrainHeight(s.pickPos.x,s.pickPos.z);
      }
    }
    if(s.pickPos.x>7.4)s.pickVel.x*=Math.pow(.82,h*60);
    if(s.pickPos.z>6)s.pickVel.z*=Math.pow(.85,h*60);
    // Heading is driven by winch attachment torque, not arbitrary world-X sliding.
    if(!s.loaded&&s.type.id!=='rotator')s.pickYaw+=clamp(s.pickVel.x*.018,-.35,.35)*h;
    s.pickup.position.copy(s.pickPos);
    // A wheel-lift raises only the captured FRONT axle; the rear tires roll on the ground.
    // Flatbeds still lift the whole vehicle onto the deck.
    s.pickup.position.y=s.loaded&&s.type.id==='flatbed'?s.pos.y+1.5:(s.type.id==='rotator'?s.pickPos.y+.5+Math.sin(s.pickRoll)*.16:s.pickPos.y+jobSceneYOffset(s));
    if(s.pickup.userData.towPitchPivot){
      const frontAxleLift=s.loaded&&s.type.id!=='flatbed'?.20+s.liftHeight*.58:0;
      const wheelbase=3.10*s.pickup.userData.scale;
      s.pickup.userData.towPitchPivot.rotation.x=Math.atan2(frontAxleLift,wheelbase);
    }
    s.pickup.rotation.y=-s.pickYaw;s.pickup.rotation.z=s.type.id==='rotator'?s.pickRoll:(!s.loaded&&JOBS[s.jobIndex%JOBS.length].kind==='recovery'?.15:0);
    const job=JOBS[s.jobIndex%JOBS.length];
    if(job.kind==='tow'&&!s.dropoffArrived&&s.loaded&&s.strapsOn&&s.pos.distanceTo(V(0,0,23))<5&&s.vel.length()<.9){
      s.dropoffArrived=true;
      setNotice('AT DEPOT: Park, remove straps, lower the lift, then open L-arms to finish.');
    }
    const heavyClear=job.kind==='heavy'&&s.pickRoll<.28&&(!s.secondary.active||s.secondary.roll<.28)&&s.pickPos.distanceTo(V(2,0,job.z))<7.5&&(!s.secondary.active||s.secondary.pos.distanceTo(V(2,0,job.z))<10);const reached=job.kind==='tow'?s.pos.distanceTo(V(0,0,23))<5:s.loaded?s.pos.distanceTo(V(0,0,23))<5:job.kind==='heavy'?heavyClear:s.pickPos.distanceTo(V(2,0,job.z))<4.2;
    if(!s.jobDone&&canCompleteJob(job.kind,{reached,loaded:s.loaded,strapped:s.strapsOn,hook:s.hook,recoveryConnected:s.recoveryLines.some(line=>line.connected),delivered:s.dropoffComplete})){
      s.jobDone=true;s.winch=false;s.winchOut=false;s.hook=false;
      for(const line of s.recoveryLines){line.connected=false;line.motor=0;line.tension=0;}
      const reward=JOBS[s.jobIndex%JOBS.length].pay;
      // Completed jobs must not accidentally load an obsolete recovery checkpoint.
      try{const oldSave=parseRecoverySave(localStorage.getItem(RECOVERY_SAVE_KEY),JOBS.length);
       if(oldSave?.jobIndex===s.jobIndex){localStorage.removeItem(RECOVERY_SAVE_KEY);setSavedCheckpoint(null);}}
      catch{}
      saveCareer(p=>({...p,cash:p.cash+reward,completed:p.completed+1,job:p.job+1,selected:JOBS[(p.job+1)%JOBS.length].truck}));
      setNotice('JOB COMPLETE +$'+reward+'! Next dispatch automatically loaded.');
    }
    if(s.hook)updateWinchLine(cable,guide?[pa,guide,pb]:[pa,pb]);else cable.visible=false;
   }
   // Driving and recovery camera presets remain locked until CAM or ANGLES explicitly changes them.
   let presetFocus=null;
   if(s.cameraMode==='ravine'&&levelFour){
     const look=s.pos.clone().lerp(s.pickPos,.72);
     // Elevated roadside vantage frames the road, steep near wall, and wreck below.
     camera.position.set(s.pos.x+5.5,s.pos.y+11,s.pos.z+8);
     presetFocus=V(look.x,look.y-2.5,look.z);
     camera.lookAt(presetFocus);
   }else if(s.cameraMode==='orbit'){
     const focus=s.orbitFocus==='hook'?s.pickPos.clone().add(V(0,1.2,0)):
       s.orbitFocus==='wide'?s.pos.clone().lerp(s.pickPos,.5).add(V(0,1.2,0)):
       s.pos.clone().add(V(0,1.2,0));
     const cy=Math.cos(s.cameraPitch),sy=Math.sin(s.cameraPitch);
     camera.position.copy(focus).add(V(Math.sin(s.cameraYaw)*cy*s.zoom,sy*s.zoom,Math.cos(s.cameraYaw)*cy*s.zoom));
     camera.lookAt(focus);
   }else{
     const pose=cameraPresetPose(s.cameraMode,{x:s.pos.x,z:s.pos.z},s.yaw,{x:s.pickPos.x,z:s.pickPos.z},s.zoom);
     const heightOffset=levelFour?(s.cameraMode==='hook'?s.pickPos.y:s.cameraMode==='wide'?(s.pos.y+s.pickPos.y)*.5:s.pos.y):0;
      camera.position.set(pose.position.x,pose.position.y+heightOffset,pose.position.z);
      presetFocus=V(pose.target.x,pose.target.y+heightOffset,pose.target.z);
      camera.lookAt(presetFocus);
   }
   // Touch orbit is an offset from the selected camera preset, not a mode switch.
   if(presetFocus){
     const delta=camera.position.clone().sub(presetFocus),baseRadius=Math.max(1,delta.length());
     const baseYaw=Math.atan2(delta.x,delta.z),basePitch=Math.asin(clamp(delta.y/baseRadius,-1,1));
     const yaw=baseYaw+s.presetYaw,pitch=clamp(basePitch+s.presetPitch,-1.35,1.48);
     const radius=baseRadius*13/s.zoom,cosPitch=Math.cos(pitch);
     camera.position.copy(presetFocus).add(V(Math.sin(yaw)*cosPitch*radius,Math.sin(pitch)*radius,Math.cos(yaw)*cosPitch*radius));
     camera.lookAt(presetFocus);
   }
   if(now-s.lastHud>120){const sp=s.vel.length()*3.6;setHud({speed:sp,gear:s.throttle<-.1?'R':'D',hook:s.hook,tension:s.tension/1000,winch:s.winch?'REELING':'IDLE',parking:s.parkingBrake,riggers:s.riggersDeployed,boom:s.boomDeployed,lift:s.liftDeployed,range:s.pos.distanceTo(s.pickPos),mapX:s.pos.x,mapZ:s.pos.z,mapYaw:s.yaw,roll:s.pickRoll,roll2:s.secondary.roll,secondX:s.secondary.pos.x,secondZ:s.secondary.pos.z,lineTensions:s.recoveryLines.map(l=>l.tension/1000),carX:s.pickPos.x,carZ:s.pickPos.z,carYaw:s.pickYaw,loaded:s.loaded,liftHeight:s.liftHeight,armsClosed:s.armsClosed,strapsOn:s.strapsOn,gridContact:tireGridContact(s)});s.lastHud=now;}
   renderer.render(scene,camera);raf=requestAnimationFrame(update);
  };raf=requestAnimationFrame(update);
  const onKey=(e)=>{const down=e.type==='keydown';if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='w'||e.key==='ArrowUp')s.throttle=down?1:0;if(e.key==='s'||e.key==='ArrowDown')s.throttle=down?-.55:0;if(e.key==='a'||e.key==='ArrowLeft')s.steer=down?-1:0;if(e.key==='d'||e.key==='ArrowRight')s.steer=down?1:0;if(e.key.toLowerCase()==='r'){s.winch=down&&s.boomDeployed&&(!s.heavyRecovery||s.riggersDeployed)&&s.parkingBrake;if(!down){s.pickVel.set(0,0,0);s.tension=0;}}if(down&&e.key.toLowerCase()==='h')s.hook=!s.hook;};
  const stopHeldControls=()=>{s.throttle=0;s.steer=0;s.brake=0;s.winch=false;s.winchOut=false;s.boomControl=0;s.boomExtendControl=0;s.boomSwingControl=0;s.liftControl=0;s.liftExtendControl=0;s.liftHydraulicX=0;s.liftHydraulicY=0;for(const line of s.recoveryLines){line.motor=0;line.tension=0;}s.tension=0;s.pickVel.set(0,0,0);s.pickRollVel=0;s.secondary.vel.set(0,0,0);s.secondary.rollVel=0;};
  const onVisibilityChange=()=>{if(document.hidden)stopHeldControls();};
  window.addEventListener('keydown',onKey);window.addEventListener('keyup',onKey);
  window.addEventListener('blur',stopHeldControls);document.addEventListener('visibilitychange',onVisibilityChange);
  const raycaster=new THREE.Raycaster(),placementPlane=new THREE.Plane(V(0,1,0),0);
  const onPointerDown=e=>{
    renderer.domElement.setPointerCapture(e.pointerId);
    if(s.anchorPlacement||s.customHookPlacement!==null){s.anchorTap={id:e.pointerId,x:e.clientX,y:e.clientY};return;}
    s.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(s.pointers.size===1)s.drag={x:e.clientX,y:e.clientY,yaw:s.cameraYaw,pitch:s.cameraPitch,presetYaw:s.presetYaw,presetPitch:s.presetPitch};
  };
  const onPointerMove=e=>{
    if(s.anchorPlacement||s.customHookPlacement!==null||!s.pointers.has(e.pointerId))return;
    s.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(s.pointers.size===1&&s.drag){
      const dx=e.clientX-s.drag.x,dy=e.clientY-s.drag.y;
      if(s.cameraMode==='orbit'){
        s.cameraYaw=s.drag.yaw-dx*.006;
        s.cameraPitch=clamp(s.drag.pitch+dy*.004,-.05,1.48);
      }else{
        // Rotate the selected view without changing its camera mode.
        s.presetYaw=s.drag.presetYaw-dx*.006;
        s.presetPitch=clamp(s.drag.presetPitch+dy*.004,-1.1,1.1);
      }
    }
    if(s.pointers.size===2){
      const p=[...s.pointers.values()],distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
      if(s.pinch)s.zoom=clamp(s.pinch.zoom*s.pinch.d/Math.max(20,distance),5,40);
      else s.pinch={d:distance,zoom:s.zoom};
    }
  };
  const onPointerUp=e=>{
    if(s.customHookPlacement!==null){
      const tap=s.anchorTap;s.anchorTap=null;
      if(e.type==='pointercancel'||!tap||tap.id!==e.pointerId||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>18)return;
      const rect=renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
      const index=s.customHookPlacement,line=s.recoveryLines[index];
      const vehicle=line.target===1?s.secondary.mesh:s.pickup;
      const hit=raycaster.intersectObject(vehicle,true)[0];
      if(!hit){setNotice('Tap the vehicle body, not the ground.');return;}
      const local=vehicle.worldToLocal(hit.point.clone());
      const x=clamp(local.x,-.96,.96),z=clamp(local.z,-1.85,1.85);
      if(Math.abs(x)<.65&&Math.abs(z)<1.35){setNotice('Choose a frame edge or bumper, not the center body panel.');return;}
      line.customPoint={id:'custom',label:'CUSTOM HOOK',x,y:.73,z};
      s.customHookPlacement=null;setPlacingAnchor(false);setRecoveryOpen(true);
      setNotice('Custom hook selected. Connect the line to use this point.');
      return;
    }
    if(s.anchorPlacement){
      const tap=s.anchorTap;s.anchorTap=null;
      if(e.type==='pointercancel'||!tap||tap.id!==e.pointerId||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>18)return;
      const rect=renderer.domElement.getBoundingClientRect();
      const coords=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(coords,camera);
      const hit=levelFour?(raycaster.intersectObject(terrainScene.ground,false)[0]?.point??null):raycaster.ray.intersectPlane(placementPlane,V());
      if(!hit){setNotice('Tap a visible open spot on the ground.');return;}
      const index=s.anchorPlacement.lineIndex,target=index!==null&&s.recoveryLines[index].target===1&&s.secondary.active?s.secondary.pos:s.pickPos;
      const td=Math.hypot(hit.x-s.pos.x,hit.z-s.pos.z),vd=Math.hypot(hit.x-target.x,hit.z-target.z);
      if(td<4||td>32||vd<3||vd>32){setNotice('Anchor must be 4–32 m from truck and 3–32 m from vehicle. Tap again.');return;}
      if(Math.abs(hit.x)<5.5){setNotice('Place the stake in open ground off the road. Tap again.');return;}
      if(levelFour){const slope=terrainSlope(hit.x,hit.z);if(Math.hypot(slope.x,slope.z)>.80){
        setNotice('Too steep for an anchor. Choose firm, flatter ground.');return;}}
      const slot=s.anchorPlacement.slot,a=s.riggingAnchors[slot];
      a.pos=V(hit.x,hit.y+.55,hit.z);a.marker.position.set(hit.x,hit.y,hit.z);a.marker.visible=true;
      if(index===null)s.hookRedirect=slot;else s.recoveryLines[index].redirect=slot;
      s.anchorPlacement=null;
      if(s.doubleAnchorSetup&&slot===3){
        s.recoveryLines[0].redirect=3;
        s.anchorPlacement={slot:4,lineIndex:0};s.anchorTap=null;
        setNotice('ANCHOR A PLACED. Now tap a second firm-ground location for ANCHOR B.');
        return;
      }
      if(s.doubleAnchorSetup&&slot===4){
        s.recoveryLines[0].redirect=3;s.recoveryLines[0].secondRedirect=4;s.doubleAnchorSetup=false;
        setPlacingAnchor(false);setRecoveryOpen(true);
        setNotice('TWO-POINT LINE A READY: Boom → Anchor A → Anchor B → vehicle. Connect LINE A and winch at FINE speed.');
        return;
      }
      setPlacingAnchor(false);setRecoveryOpen(true);
      setNotice('Anchor placed! Select a vehicle eye, then CONNECT TO VEHICLE. The cable passes through this anchor.');
      return;
    }
    s.pointers.delete(e.pointerId);s.drag=null;if(s.pointers.size<2)s.pinch=null;
  };
  renderer.domElement.addEventListener('pointerdown',onPointerDown);renderer.domElement.addEventListener('pointermove',onPointerMove);renderer.domElement.addEventListener('pointerup',onPointerUp);renderer.domElement.addEventListener('pointercancel',onPointerUp);
  return()=>{cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onKey);window.removeEventListener('blur',stopHeldControls);document.removeEventListener('visibilitychange',onVisibilityChange);renderer.dispose();host.removeChild(renderer.domElement);scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});};
 },[career.selected,career.job,restoreSequence]);
 const s=sim.current;const press=(key,val)=>e=>{e.preventDefault();const s=sim.current;if(!s)return;if((key==='winch'||key==='winchOut')&&val&&((s.tools.includes('boom')&&!s.boomDeployed)||(s.heavyRecovery&&!s.riggersDeployed)||!s.parkingBrake)){setNotice(s.heavyRecovery?'Heavy recovery: deploy BOOM, RIGGERS and PARK BRAKE.':'Deploy BOOM and engage PARK BRAKE first.');return;}const released=key==='winch'&&!val&&s.winch;s[key]=val;if(released){s.pickVel.set(0,0,0);s.tension=0;}};
 const joystickMove=e=>{const el=e.currentTarget,rect=el.getBoundingClientRect(),dx=(e.clientX-(rect.left+rect.width/2))/(rect.width*.42);const steer=clamp(dx*settingsRef.current.steering,-1,1);setSteerVisual(steer);if(sim.current)sim.current.steer=steer;};
 const joystickStop=e=>{e.preventDefault();setSteerVisual(0);if(sim.current)sim.current.steer=0;};
 const setBoomControl=(axis,d)=>{const s=sim.current;if(!s)return;if(d===0){s[axis]=0;return;}if(!s.tools.includes('boom')||!s.boomDeployed||(!s.parkingBrake&&!s.riggersDeployed)){setNotice('Apply PARK BRAKE or deploy RIGGERS to unlock the boom.');return;}if(s.vel.length()>.25){setNotice('Stop the truck before moving the boom.');return;}s[axis]=d;};
 const boomStickStop=()=>{
  const s=sim.current;if(s){s.boomControl=0;s.boomExtendControl=0;s.boomSwingControl=0;}
  setBoomStick({x:0,y:0});
 };
 const boomStickMove=e=>{
  const s=sim.current;if(!s||!s.tools.includes('boom'))return;
  if((!s.parkingBrake&&!s.riggersDeployed)||!s.boomDeployed||s.vel.length()>.25){boomStickStop();setNotice('Stop and apply PARK BRAKE or deploy RIGGERS to operate the boom.');return;}
  const rect=e.currentTarget.getBoundingClientRect();
  const x=clamp((e.clientX-rect.left-rect.width/2)/(rect.width*.42),-1,1);
  const y=clamp((rect.top+rect.height/2-e.clientY)/(rect.height*.42),-1,1);
  const horizontal=Math.abs(x)>.12?x:0,vertical=Math.abs(y)>.12?y:0;
  s.boomControl=vertical;
  s.boomExtendControl=boomMode==='extend'?horizontal:0;
  s.boomSwingControl=boomMode==='swing'?horizontal:0;
  setBoomStick({x:horizontal,y:vertical});
 };
 const toggleRiggers=()=>{const s=sim.current;if(!s||!s.tools.includes('riggers'))return;if(s.vel.length()>.4){setNotice('Stop the truck before deploying riggers.');return;}if(s.riggersDeployed&&s.recoveryLines.some(line=>line.connected)){setNotice('Disconnect recovery lines before retracting riggers.');return;}s.riggersDeployed=!s.riggersDeployed;s.boomDeployed=s.parkingBrake||s.riggersDeployed;boomStickStop();if(!s.boomDeployed){s.boomAngle=.36;s.boomExtension=0;s.boomSwing=0;}};
 const setLiftControl=(axis,d)=>{const s=sim.current;if(!s)return;if(d===0){s[axis]=0;return;}if(!s.tools.includes('lift')||!s.liftDeployed){setNotice('Deploy wheel lift first.');return;}if(s.type.id==='light'){if(s.vel.length()>2.3){setNotice('Slow to walking speed before moving the wheel lift.');return;}if(axis==='liftExtendControl'){setNotice('Starter wheel lift has fixed reach.');return;}}else if(!s.parkingBrake||s.vel.length()>.25){setNotice('Engage PARK BRAKE to move wheel lift.');return;}if(axis==='liftControl'&&d<0&&s.strapsOn&&s.liftHeight<=.45){setNotice('Remove straps before lowering the car.');return;}s[axis]=d;};
 const liftPress=(axis,d)=>e=>{e.preventDefault();setLiftControl(axis,d);};
 const toggleLift=()=>{const s=sim.current;if(!s||!s.tools.includes('lift'))return;if(s.type.id==='light'?s.vel.length()>2.3:(!s.parkingBrake||s.vel.length()>.25)){setNotice(s.type.id==='light'?'Slow to walking speed to lower the lift.':'Stop and apply PARK BRAKE before deploying the lift.');return;}if(s.loaded){setNotice('Lower car and release L-arms before folding lift.');return;}s.liftDeployed=!s.liftDeployed;s.liftControl=0;s.liftExtendControl=0;s.liftHydraulicX=0;s.liftHydraulicY=0;if(s.liftDeployed){s.liftHeight=0;s.armsClosed=false;s.strapsOn=false;setNotice('Wheel lift lowered. Reverse slowly, seat both tires, then PARK and close the L-arms.');}else{s.liftExtension=0;s.liftHeight=0;setNotice('Wheel lift folded upright.');}};
 const hydraulicStop=()=>{const s=sim.current;if(s){s.liftHydraulicX=0;s.liftHydraulicY=0;}setHydraulic({x:0,y:0});};
 const hydraulicMove=e=>{const s=sim.current;if(!s||!s.liftDeployed)return;if(s.type.id==='light'?s.vel.length()>2.3:!s.parkingBrake)return;const rect=e.currentTarget.getBoundingClientRect();const x=s.type.id==='light'?0:clamp((e.clientX-rect.left-rect.width/2)/(rect.width*.42),-1,1),y=clamp((rect.top+rect.height/2-e.clientY)/(rect.height*.42),-1,1);s.liftHydraulicX=Math.abs(x)>.12?x:0;s.liftHydraulicY=Math.abs(y)>.12?y:0;setHydraulic({x,y});};
 const adjustGrid=delta=>{const s=sim.current;if(!s||!s.liftDeployed||!s.parkingBrake)return;s.gridWidth=clamp(s.gridWidth+delta,0,.45);};
 const toggleArms=()=>{const s=sim.current;if(!s||!s.liftDeployed||!s.parkingBrake){setNotice('Deploy lift and engage PARK BRAKE first.');return;}if(s.autoLoad||s.autoUnload){setNotice('Wait for the automatic lift cycle to finish.');return;}if(s.loaded&&s.strapsOn){setNotice('Remove straps before opening L-arms.');return;}if(s.loaded&&s.liftHeight>.25){setNotice('Lower the lift before opening L-arms.');return;}if(!s.armsClosed){const contact=tireGridContact(s);if(!contact.ok){setNotice(contact.facing<.60?'Align the tow truck straight with the car before closing L-arms.':s.liftHeight>=.38?'Lower the wheel lift before closing L-arms.':'Back farther beneath both FRONT tires. Grid alignment: '+contact.error.toFixed(1)+' m away.');return;}}const releasing=s.armsClosed&&s.loaded;
 s.armsClosed=!s.armsClosed;s.loaded=s.armsClosed;
 if(s.armsClosed){
   s.pickYaw=s.yaw;s.prevHitch=null;
   setNotice('Tires captured. Raise lift, then apply tire straps.');
 }else{
   s.prevHitch=null;s.pickVel.set(0,0,0);
   if(releasing&&s.dropoffArrived&&s.pos.distanceTo(V(0,0,23))<5&&s.parkingBrake){
     s.dropoffComplete=true;
     setNotice('Vehicle safely unloaded. Dispatch complete!');
   }else setNotice('L-arms opened. Vehicle released.');
 }};
 const togglePark=()=>{const s=sim.current;if(!s)return;
 if(s.autoLoad||s.autoUnload){setNotice('Wait for the hydraulic cycle to finish before releasing PARK BRAKE.');return;}
 if(s.parkingBrake&&s.recoveryLines.some(line=>line.connected)){setNotice('Disconnect recovery lines before driving.');return;}
 s.parkingBrake=!s.parkingBrake;
 if(s.tools.includes('boom')){
  s.boomDeployed=s.parkingBrake||s.riggersDeployed;
  boomStickStop();
  if(!s.boomDeployed){s.boomAngle=.36;s.boomExtension=0;s.boomSwing=0;}
 }
};
 const toggleHook=()=>{const s=sim.current;if(!s)return;if(!s.hook&&s.hookRedirect&&!s.riggingAnchors[s.hookRedirect].pos){setNotice('Place the selected anchor before connecting to the vehicle.');return;}if(!s.hook&&!s.boomDeployed&&s.tools.includes('boom')){setNotice('Apply PARK BRAKE to activate the boom before hooking.');return;}if(!s.hook&&!s.tools.includes('winch')){setNotice('This truck has no winch.');return;}if(!s.hook&&s.pos.distanceTo(s.pickPos)>24){setNotice('Move within 24 m to hook the vehicle.');return;}s.hook=!s.hook;if(s.hook){const f=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));const a=s.pos.clone().add(f.multiplyScalar(-2.3));const head=s.tools.includes('boom')&&s.truck.userData.boomTip?s.truck.userData.boomTip.getWorldPosition(V()):a;const eye=recoveryAnchor({pos:s.pickPos,yaw:s.pickYaw,roll:0},RECOVERY_POINTS[s.hookPoint]);s.cableLength=linePathLength(head,eye,s.riggingAnchors[s.hookRedirect].pos);}};
 const reset=()=>{const s=sim.current;if(!s)return;s.pos.set(0,s.levelFour?terrainHeight(0,Math.min(-49,JOBS[careerRef.current.job%JOBS.length].z+15)):0,s.levelFour?Math.min(-49,JOBS[careerRef.current.job%JOBS.length].z+15):7);s.vel.set(0,0,0);s.yaw=0;const job=JOBS[careerRef.current.job%JOBS.length];s.pickPos.set(job.x,s.levelFour?terrainHeight(job.x,job.z):0,job.z);s.pickYaw=-.18;s.pickYawVel=0;s.pickRoll=job.roll??0;s.pickRollVel=0;s.secondary.active=!!job.second;s.secondary.mesh.visible=!!job.second;s.secondary.pos.set(job.second?.x??-22,s.levelFour?terrainHeight(job.second?.x??-22,job.second?.z??-106):0,job.second?.z??-106);s.secondary.vel.set(0,0,0);s.secondary.roll=job.second?.roll??0;s.secondary.rollVel=0;s.secondary.yaw=job.second?.yaw??-.1;s.secondary.yawVel=0;for(const line of s.recoveryLines){line.connected=false;line.spool=20;line.motor=0;line.tension=0;line.target=0;line.point=0;line.redirect=0;line.secondRedirect=0;}s.anchorPlacement=null;setPlacingAnchor(false);for(const anchor of s.riggingAnchors){if(anchor.marker){anchor.pos=null;anchor.marker.visible=false;}}s.hookPoint=0;s.hookRedirect=0;for(const rope of s.recoveryCables)rope.visible=false;s.jobIndex=careerRef.current.job;s.jobDone=false;s.dropoffArrived=false;s.dropoffComplete=false;s.autoUnload=false;s.autoLoad=false;s.heavyRecovery=job.kind==='heavy';s.loaded=false;s.prevHitch=null;s.strapsOn=false;s.bedTilt=false;s.zone.position.set(job.kind==='tow'||job.kind==='flatbed'?0:2,.12,job.kind==='tow'||job.kind==='flatbed'?23:job.z);s.pickVel.set(0,0,0);s.hook=false;s.winch=false;s.winchOut=false;s.parkingBrake=false;s.boomDeployed=false;s.boomAngle=.36;s.boomSwing=0;s.boomExtension=0;s.boomControl=0;s.boomExtendControl=0;s.boomSwingControl=0;s.liftDeployed=false;s.liftHeight=0;s.liftExtension=0;s.liftControl=0;s.liftExtendControl=0;s.liftHydraulicX=0;s.liftHydraulicY=0;s.gridWidth=0;s.armsClosed=false;s.riggersDeployed=false;s.cableLength=14;};
 const saveInProgress=()=>{
  const game=sim.current;
  if(!game||game.jobDone){setNotice('Wait for the next dispatch before saving.');return;}
  try{
   const checkpoint=captureRecoverySave(careerRef.current,game);
   localStorage.setItem(RECOVERY_SAVE_KEY,JSON.stringify(checkpoint));
   setSavedCheckpoint(checkpoint);setMenuOpen(false);
   setNotice('LEVEL '+(game.jobIndex%JOBS.length+1)+' SAVED. Open MENU to RESUME SAVED JOB later.');
  }catch{setNotice('Could not save. Check browser storage settings.');}
 };
 const resumeSavedJob=()=>{
  let checkpoint=null;
  try{checkpoint=parseRecoverySave(localStorage.getItem(RECOVERY_SAVE_KEY),JOBS.length)}catch{}
  if(!checkpoint){setSavedCheckpoint(null);setNotice('No valid saved job on this device.');return;}
  pendingRestore.current=checkpoint;
  saveCareer(old=>({...old,...checkpoint.career,job:checkpoint.jobIndex,selected:checkpoint.career.selected}));
  setRestoreSequence(n=>n+1);
  setMenuOpen(false);setGarage(false);setHelp(false);setPlacingAnchor(false);setRecoveryOpen(true);
 };
 const deleteSavedJob=()=>{
  try{localStorage.removeItem(RECOVERY_SAVE_KEY);setSavedCheckpoint(null);
   setNotice('Checkpoint deleted. The current job is unchanged.');
  }catch{setNotice('Could not delete checkpoint from this browser.');}
 };
 const upgrade=type=>{const lvl=careerRef.current[type],price=(lvl+1)*500;if(lvl>=3||careerRef.current.cash<price){setNotice(lvl>=3?'Fully upgraded':'Not enough cash: $'+price);return;}saveCareer(p=>({...p,cash:p.cash-price,[type]:p[type]+1}));setNotice(type.toUpperCase()+' upgraded!');};
 // Wheel-lift capture uses the front tire positions, not the distance between vehicle centers.
 // Allow 0.85 m per tire so alignment is achievable on a touchscreen.
 const tireGridContact=s=>{
  const forward=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));
  const right=V(Math.cos(s.yaw),0,Math.sin(s.yaw));
  const carForward=V(Math.sin(s.pickYaw),0,-Math.cos(s.pickYaw));
  const carRight=V(Math.cos(s.pickYaw),0,Math.sin(s.pickYaw));
  const axle=s.pickPos.clone().addScaledVector(carForward,1.55*(s.pickup.userData.scale||1));
  const gridCenter=s.pos.clone().addScaledVector(forward,-(2.4+Math.cos(liftPitch(s))*liftReach(s)));
  const lateral=.78+s.gridWidth;
  const errors=[-1,1].map(side=>{
   const tire=axle.clone().addScaledVector(carRight,side*.84);
   const grid=gridCenter.clone().addScaledVector(right,side*lateral);
   return tire.distanceTo(grid);
  });
  const facing=carForward.dot(forward),error=Math.max(...errors);
   return {ok:wheelLiftCaptureReady({leftError:errors[0],rightError:errors[1],facing,height:s.liftHeight}),error,facing};
 };
 const strapTires=()=>{const s=sim.current;if(!s)return;if(s.autoLoad||s.autoUnload){setNotice('Wait for the automatic cycle to finish.');return;}if(!s.tools.includes('lift')){setNotice('This truck has no wheel lift.');return;}if(s.strapsOn){if(!s.parkingBrake){setNotice('Apply PARK BRAKE before removing tire straps.');return;}s.strapsOn=false;setNotice('Straps removed. Hold LIFT DOWN until on the ground, then open L-arms.');return;}if(!s.loaded||!s.armsClosed){setNotice('Close L-arms around both tires first.');return;}if(s.liftHeight<.45){setNotice('Raise wheel lift before applying straps.');return;}if(!s.liftDeployed){setNotice('Lower the wheel lift first.');return;}const job=JOBS[s.jobIndex%JOBS.length];if(job.kind!=='tow'){setNotice('This dispatch requires '+FLEET.find(t=>t.id===job.truck).name+'.');return;}if(!s.parkingBrake){setNotice('Apply PARK BRAKE before securing tire straps.');return;}s.vel.set(0,0,0);s.throttle=0;s.strapsOn=true;s.hook=false;s.winch=false;setNotice('Tires strapped. Release PARK BRAKE and tow to depot.');};
 const autoLoadVehicle=()=>{
  const s=sim.current;
  if(!s||s.type.id!=='light'||s.loaded||s.autoLoad){setNotice('This vehicle is already captured.');return;}
  if(!s.liftDeployed){setNotice('LOWER WHEEL LIFT first, then back under the front tires.');return;}
  if(s.vel.length()>.25||!s.parkingBrake){setNotice('Stop and set PARK BRAKE before AUTO LOAD.');return;}
  const contact=tireGridContact(s);
  if(!contact.ok){
    setNotice(contact.facing<.60?'Align the truck straight with the car.':'Back beneath BOTH front tires until TIRES ALIGNED is shown ('+contact.error.toFixed(1)+' m).');
    return;
  }
  s.autoLoad=true;s.armsClosed=true;s.loaded=true;
  s.strapsOn=false;s.prevHitch=null;s.pickVel.set(0,0,0);
  s.pickYaw=s.yaw;s.liftControl=0;s.liftHydraulicY=0;
  setNotice('L-arms closed. Raising the front axle, then securing the tire straps.');
 };
 const unloadAtDepot=()=>{
  const s=sim.current;if(!s||s.type.id!=='light'||!s.loaded){setNotice('Capture a vehicle with the wheel lift first.');return;}
  if(s.pos.distanceTo(V(0,0,23))>=5){setNotice('Drive the strapped car to the green depot circle before unloading.');return;}
  if(!s.parkingBrake||s.vel.length()>.25){setNotice('Stop completely and apply PARK BRAKE before unloading.');return;}
  if(s.autoLoad||s.autoUnload)return;
  s.dropoffArrived=true;s.strapsOn=false;s.liftControl=0;s.liftHydraulicY=0;
  s.autoUnload=true;
  setNotice('Removing straps and lowering the car onto its rear wheels. L-arms will open when lowered.');
 };
 const selectWinchSpeed=mode=>{setWinchSpeed(mode);if(sim.current)sim.current.winchSpeed=mode;};
 const changeHookPoint=()=>{const s=sim.current;if(!s||!s.tools.includes('winch'))return;if(s.hook){setNotice('Disconnect hook before changing attachment eye.');return;}s.hookPoint=(s.hookPoint+1)%RECOVERY_POINTS.length;setNotice('Winch hook: '+RECOVERY_POINTS[s.hookPoint].label);};
 const changeHookRedirect=()=>{const s=sim.current;if(!s||!s.tools.includes('winch'))return;if(s.hook){setNotice('Disconnect hook before changing anchor.');return;}s.hookRedirect=nextAnchorSlot(s.riggingAnchors,s.hookRedirect);setNotice('Winch route: '+s.riggingAnchors[s.hookRedirect].label);};
 const changeRecoveryRedirect=index=>{const s=sim.current;if(!s||s.type.id!=='rotator')return;const l=s.recoveryLines[index];if(l.connected){setNotice('Disconnect line before changing redirect anchor.');return;}l.redirect=nextAnchorSlot(s.riggingAnchors,l.redirect);setNotice('Line '+(index===0?'A':'B')+' route: '+s.riggingAnchors[l.redirect].label);};
 const removePlacedAnchor=slot=>{
    const s=sim.current;if(!s||![3,4].includes(slot))return;
    const anchor=s.riggingAnchors[slot];if(!anchor?.pos){setNotice('That ground anchor is not placed.');return;}
    if(s.recoveryLines.some(line=>line.connected&&(line.redirect===slot||line.secondRedirect===slot))||(s.hook&&s.hookRedirect===slot)){
      setNotice('Disconnect the cable using this anchor before removing it.');return;
    }
    anchor.pos=null;if(anchor.marker)anchor.marker.visible=false;
    for(const line of s.recoveryLines){if(line.redirect===slot)line.redirect=0;if(line.secondRedirect===slot)line.secondRedirect=0;}
    if(s.hookRedirect===slot)s.hookRedirect=0;
    if(s.anchorPlacement?.slot===slot){s.anchorPlacement=null;s.anchorTap=null;s.doubleAnchorSetup=false;setPlacingAnchor(false);setRecoveryOpen(true);}
    setNotice('ANCHOR '+(slot===3?'A':'B')+' REMOVED. Cable routing reset to DIRECT LINE.');
  };
 const startDoubleAnchorSetup=()=>{
    const s=sim.current;if(!s||s.type.id!=='rotator')return;
    if(!s.parkingBrake||s.vel.length()>.25){setNotice('Stop and apply PARK BRAKE before double anchor placement.');return;}
    if(s.recoveryLines.some(l=>l.connected)){setNotice('Disconnect LINE A and LINE B before moving anchors.');return;}
    s.recoveryLines[0].secondRedirect=0;s.doubleAnchorSetup=true;s.anchorPlacement={slot:3,lineIndex:0};s.anchorTap=null;
    setPlacingAnchor(true);setRecoveryOpen(false);
    setNotice('TWO-POINT LINE A: Place redirect A, then redirect B. Both guide the SAME cable.');
  };
 const startAnchorPlacement=lineIndex=>{
    const s=sim.current;if(!s||!s.tools.includes('winch'))return;
    if(!s.parkingBrake||s.vel.length()>.25){setNotice('Stop and apply PARK BRAKE before placing an anchor.');return;}
    if(lineIndex===null?s.hook:s.recoveryLines[lineIndex].connected){setNotice('Disconnect the line before moving its anchor.');return;}
    const slot=lineIndex===1?4:3;
    if(s.recoveryLines.some(line=>line.connected&&line.redirect===slot)||(s.hook&&s.hookRedirect===slot)){setNotice('This anchor holds another connected line. Disconnect it before moving.');return;}
    s.doubleAnchorSetup=false;s.anchorPlacement={slot,lineIndex};s.anchorTap=null;setPlacingAnchor(true);setRecoveryOpen(false);
    setNotice('Tap open ground off the road, within 32 m of truck and vehicle.');
  };
  const cancelAnchorPlacement=()=>{if(sim.current){sim.current.anchorPlacement=null;sim.current.anchorTap=null;sim.current.doubleAnchorSetup=false;}setPlacingAnchor(false);setRecoveryOpen(true);setNotice('Anchor placement cancelled.');};
  const startCustomHook=index=>{
    const s=sim.current;if(!s||s.type.id!=='rotator')return;
    if(s.recoveryLines[index].connected){setNotice('Disconnect the line before changing its hook.');return;}
    s.customHookPlacement=index;s.anchorTap=null;setPlacingAnchor(true);setRecoveryOpen(false);
    setNotice('CUSTOM HOOK: Tap a frame edge or bumper on the target vehicle.');
  };
  const cancelCustomHook=()=>{const s=sim.current;if(s){s.customHookPlacement=null;s.anchorTap=null;}setPlacingAnchor(false);setRecoveryOpen(true);setNotice('Custom hook cancelled.');};
  const changeRecoveryPoint=index=>{const s=sim.current;if(!s||s.type.id!=='rotator')return;const l=s.recoveryLines[index];if(l.connected){setNotice('Disconnect line before changing its attachment.');return;}l.point=(l.point+1)%RECOVERY_POINTS.length;setNotice('Line '+(index===0?'A':'B')+': '+RECOVERY_POINTS[l.point].label);};
 const changeRecoveryTarget=index=>{const s=sim.current;if(!s||!s.secondary.active)return;const l=s.recoveryLines[index];if(l.connected){setNotice('Disconnect line before changing target.');return;}l.target=(l.target+1)%2;setNotice('Line '+(index===0?'A':'B')+' target: vehicle '+(l.target+1));};
 const toggleRecoveryLine=index=>{const s=sim.current;if(!s||s.type.id!=='rotator')return;const l=s.recoveryLines[index];if(l.connected){l.connected=false;l.motor=0;l.tension=0;setNotice('Line '+(index===0?'A':'B')+' disconnected.');return;}if(!s.parkingBrake||!s.riggersDeployed||!s.boomDeployed){setNotice('Deploy BOOM and RIGGERS and apply PARK BRAKE first.');return;}const target=l.target===1?s.secondary:{pos:s.pickPos,yaw:s.pickYaw,roll:s.pickRoll};const a=recoveryAnchor(target,selectedRecoveryPoint(s,l)),b=s.truck.userData.boomTip.getWorldPosition(V()),guide=s.riggingAnchors[l.redirect].pos;if(l.redirect&&!guide){setNotice('Place the selected anchor before connecting.');return;}const second=l.secondRedirect?s.riggingAnchors[l.secondRedirect].pos:null;if(l.secondRedirect&&!second){setNotice('Place both redirect anchors before connecting.');return;}const distance=linePathLength(b,a,guide,second);if(distance>90){setNotice('Recovery line out of reach: reposition truck.');return;}l.connected=true;l.motor=0;l.spool=distance;setNotice('Line '+(index===0?'A':'B')+' attached to '+selectedRecoveryPoint(s,l).label+' via '+s.riggingAnchors[l.redirect].label+'.');};
 const setRecoveryMotor=(index,value)=>{const s=sim.current;if(!s||s.type.id!=='rotator')return;const l=s.recoveryLines[index];if(value!==0&&(!l.connected||!s.parkingBrake||!s.riggersDeployed||!s.boomDeployed)){setNotice('Connect the line, deploy BOOM and RIGGERS, then apply PARK BRAKE.');return;}const released=l.motor>0&&value===0;l.motor=value;if(released){const otherPull=s.recoveryLines.some((other,i)=>i!==index&&other.connected&&other.target===l.target&&other.motor>0);if(!otherPull){if(l.target===0){s.pickVel.set(0,0,0);s.pickRollVel=0;}else{s.secondary.vel.set(0,0,0);s.secondary.rollVel=0;}}}};
 const recoveryPress=(index,value)=>e=>{e.preventDefault();setRecoveryMotor(index,value);};
 const setBothRecoveryMotors=value=>{
   const s=sim.current;if(!s||s.type.id!=='rotator')return;
   if(value!==0&&!canPowerBothRecoveryLines(s.recoveryLines,s.parkingBrake&&s.riggersDeployed&&s.boomDeployed&&s.vel.length()<.25)){
     setNotice('Connect LINE A and LINE B, deploy BOOM + RIGGERS, and apply PARK BRAKE to operate both.');
     return;
   }
   for(const index of [0,1])setRecoveryMotor(index,value);
 };
 const bothRecoveryPress=value=>e=>{e.preventDefault();setBothRecoveryMotors(value);};
 const toggleBed=()=>{const s=sim.current;if(s&&s.tools.includes('bed'))s.bedTilt=!s.bedTilt;};
 const secureLoad=()=>{const s=sim.current;if(!s)return;const j=JOBS[s.jobIndex%JOBS.length];if(s.loaded){if(s.tools.includes('lift')){setNotice('Unload using REMOVE STRAPS, LIFT DOWN, then OPEN L-ARMS.');return;}if(s.liftHeight>.3){setNotice('Lower lift before releasing load.');return;}s.loaded=false;s.armsClosed=false;s.strapsOn=false;setNotice('Load released.');return;}if(s.type.id!==j.truck){setNotice('Dispatch requires '+FLEET.find(t=>t.id===j.truck).name+'.');return;}const distance=s.pos.distanceTo(s.pickPos);if(j.kind!=='tow'&&distance>7){setNotice('Position the recovery truck closer to the disabled vehicle.');return;}if(j.kind==='tow'){if(!s.liftDeployed){setNotice('Deploy the wheel lift first.');return;}if(!s.armsClosed||!s.loaded){setNotice('Back into tires and close L-arms first.');return;}if(s.liftHeight<.45){setNotice('Raise wheel lift before strapping.');return;}if(!s.parkingBrake){setNotice('Apply PARK BRAKE before securing the load.');return;}s.strapsOn=true;s.vel.set(0,0,0);s.throttle=0;s.hook=false;s.winch=false;setNotice('Tires secured. Release PARK BRAKE and drive to depot.');return;}if(!s.parkingBrake){setNotice('Engage PARK BRAKE before securing the load.');return;}if(j.kind==='flatbed'&&(!s.bedTilt||!s.hook)){setNotice('Tilt the rollback bed and hook the AWD vehicle before securing.');return;}
 if(j.kind==='flatbed'&&distance>2.1){setNotice('Hold WINCH IN to bring the AWD vehicle onto the rollback bed (within 2.1 m).');return;}if(j.kind==='recovery'||j.kind==='heavy'){setNotice('This is a recovery job: winch the vehicle into the green recovery circle.');return;}s.loaded=true;s.hook=false;s.winch=false;setNotice('Vehicle secured! Release park brake and deliver to green depot zone.');};
 const chooseTruck=id=>{const t=FLEET.find(x=>x.id===id);if(!t)return;saveCareer(p=>({...p,selected:id,owned:FLEET.map(truck=>truck.id)}));setNotice('TEST MODE: '+t.name+' ready.');};
 const selectTestJob=index=>{const j=JOBS[index];if(!j)return;saveCareer(p=>({...p,job:index,selected:j.truck,owned:FLEET.map(truck=>truck.id)}));setGarage(false);setHelp(false);setNotice('TEST JOB: '+j.name+' — '+FLEET.find(t=>t.id===j.truck).name);};
 const changeCamera=mode=>{
   if(!CAMERA_MODES.some(([id])=>id===mode))return;
   const s=sim.current;
   if(s){s.cameraMode=mode;s.zoom=13;s.presetYaw=0;s.presetPitch=0;if(mode==='orbit'){s.orbitFocus='truck';s.cameraYaw=0;s.cameraPitch=.30;}}
   setCameraMode(mode);setCameraPanelOpen(false);
 };
 const nextCamera=()=>{const index=CAMERA_MODES.findIndex(([id])=>id===cameraMode);changeCamera(CAMERA_MODES[(index+1)%CAMERA_MODES.length][0]);};
 const toggleRearCamera=()=>changeCamera(cameraMode==='reverse'?'orbit':'reverse');
 const currentJob=JOBS[career.job%JOBS.length];
 return <main className={'game-shell'+(menuOpen?' menu-active':'')+(cameraPanelOpen?' camera-active':'')}><div className={'scene'+(placingAnchor?' anchor-placement-scene':'')} ref={mount}/>
   {placingAnchor&&<div className="anchor-placement-hint" role="status"><b>{s?.customHookPlacement!==null?'SELECT CUSTOM HOOK':'PLACE GROUND ANCHOR'}</b><span>{s?.customHookPlacement!==null?'Tap a frame edge or bumper on the recovery vehicle.':'Tap open ground off the road, 4–32 m from truck and 3–32 m from vehicle.'}</span><button type="button" onClick={s?.customHookPlacement!==null?cancelCustomHook:cancelAnchorPlacement}>CANCEL PLACEMENT</button></div>}
  <header className="topbar"><div><strong>TOWING & RECOVERY</strong><small>CAREER MODE • {career.selected.toUpperCase()} TRUCK</small><small style={{display:"block",fontWeight:800,color:"#ffe07a",letterSpacing:".04em"}}>BUILD .54 • OPTIONS GRID</small></div><div className="speed"><b>{hud.speed.toFixed(0)}</b><span>KM/H</span></div></header>
  <div className="game-minimap" style={{position:'absolute',left:12,bottom:195,zIndex:9,width:mapOpen?146:106,height:mapOpen?166:36,pointerEvents:'auto',border:'2px solid #f3c851',borderRadius:12,background:'rgba(9,20,30,.88)',color:'#fff',boxShadow:'0 3px 14px #0008',padding:6,boxSizing:'border-box'}}>
   <button onClick={()=>setMapOpen(v=>!v)} style={{fontSize:11,fontWeight:800,width:'100%',background:'transparent',border:0,color:'white'}}>{mapOpen?'MAP −':'MAP +'}</button>
   {mapOpen&&<svg viewBox="0 0 140 140" width="132" height="132" aria-label="Map of recovery vehicles and destination">
    <rect width="140" height="140" rx="6" fill="#1b3431"/>
    <path d="M 70 0 V 140" stroke="#61787a" strokeWidth="22"/>
    <path d="M 70 0 V 140" stroke="#c4c8a6" strokeDasharray="5 7" strokeWidth="1.5"/>
    <circle cx={minimapX(currentJob.kind==='tow'||currentJob.kind==='flatbed'?0:2)} cy={minimapY(currentJob.kind==='tow'||currentJob.kind==='flatbed'?23:currentJob.z)} r="7" fill="none" stroke="#49dc77" strokeWidth="2.5"/>
    <rect x="57" y={minimapY(23)-5} width="26" height="10" rx="3" fill="#49dc77" stroke="#fff" strokeWidth="1"/>
    <text x="70" y={minimapY(23)+3} fill="#0d2518" fontSize="7" textAnchor="middle" fontWeight="bold">DEPOT</text>
    <g transform={'translate('+minimapX(hud.carX??currentJob.x)+','+minimapY(hud.carZ??currentJob.z)+') rotate('+(-(hud.carYaw??0)*180/Math.PI)+')'}>
     <rect x="-4" y="-7" width="8" height="14" rx="2" fill="#ffcf58" stroke="#111" strokeWidth="1"/>
    </g>
    {s?.secondary.active&&<g transform={'translate('+minimapX(hud.secondX??currentJob.second.x)+','+minimapY(hud.secondZ??currentJob.second.z)+')'}>
     <rect x="-5" y="-7" width="10" height="14" rx="2" fill="#d99355" stroke="#fff" strokeWidth="1"/>
     <text x="0" y="3" fontSize="8" textAnchor="middle" fill="#111" fontWeight="bold">2</text>
    </g>}
    <g transform={'translate('+minimapX(hud.mapX??0)+','+minimapY(hud.mapZ??7)+') rotate('+(-(hud.mapYaw??0)*180/Math.PI)+')'}>
     <rect x="-5" y="-9" width="10" height="18" rx="2" fill="#55b7ff" stroke="white" strokeWidth="1.5"/>
     <path d="M -3 -5 L 0 -8 L 3 -5" fill="none" stroke="white"/>
    </g>
    <text x="5" y="135" fontSize="8" fill="#fff">BLUE: YOU</text>
   </svg>}
  </div>
  <section className="mission">
   <div className="eyebrow">DISPATCH #{career.job%JOBS.length+1} · {career.completed} COMPLETED</div>
   <b>{currentJob.name}</b>
   <span>{career.job%JOBS.length===3?'Recover a rolled heavy truck from a steep 60-ft wooded ravine below a broken guardrail. Anchor on firm ground and use both lines against the uphill slope.':currentJob.kind==='tow'?'Capture both tires, raise and strap, drive to the depot, then park, unstrap, lower and release.':currentJob.kind==='flatbed'?'Disabled AWD crossover: park beside it, tilt rollback, hook and winch onto bed, then secure and deliver.':currentJob.kind==='heavy'?'Use LINE A and B to right the rollover and pull every vehicle into the green recovery zone.':'Pickup stuck in the ditch: park on the road, deploy boom, connect hook and winch the truck into the green recovery circle.'} Reward: {'$'}{currentJob.pay}</span>
   <div className="stats"><span>CASH {'$'}{career.cash}</span><span>ENGINE {career.engine}/3 · WINCH {career.winch}/3</span></div>
   <div className="stats">
    {currentJob.kind==='heavy'?<span>RECOVERY LINES {s?.recoveryLines.filter(line=>line.connected).length??0}/2 CONNECTED</span>:<span>{hud.hook?'CABLE CONNECTED':'CABLE DISCONNECTED'}</span>}
    <span>{currentJob.kind==='heavy'?'ROLL '+((hud.roll??0)*180/Math.PI).toFixed(0)+'°'+(currentJob.second?' / 2: '+((hud.roll2??0)*180/Math.PI).toFixed(0)+'°':''):hud.tension.toFixed(1)+' kN · '+(hud.range?.toFixed(0)??'--')+' m'}</span>
   </div>
  </section>
  {s?.tools.includes('winch')&&<div className="tension-readout" role="group" aria-label="Winch load and capacity">
    {(s.type.id==='rotator'?(hud.lineTensions??[0,0]):[hud.tension]).map((tension,i)=>{
     const limit=s.type.id==='rotator'?42:32,load=winchLoadBand(tension,limit);
     return <div className="tension-item" key={i}>
      <div className="tension-item-head"><span className={'tension-label '+(i===0?'line-a':'line-b')}>{s.type.id==='rotator'?'LINE '+(i===0?'A':'B'):'WINCH'}</span><b className={'tension-amount '+load.level}>{tension.toFixed(1)} / {limit} kN</b></div>
      <div className="tension-track" role="meter" aria-label={(s.type.id==='rotator'?'Line '+(i===0?'A':'B'):'Winch')+' load'} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(limit,Math.max(0,tension))}><div className={'tension-fill '+load.level} style={{width:(load.fraction*100).toFixed(0)+'%'}}/></div>
     </div>;
    })}
    <small>{winchSpeed.toUpperCase()} · YELLOW 60% · RED 85%</small>
   </div>}
  <div className="bottom-ui">{settings.driveMode==='joystick'?<div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);joystickMove(e);}} onPointerMove={e=>{if(e.buttons)joystickMove(e);}} onPointerUp={joystickStop} onPointerCancel={joystickStop}><div className="stick-knob" style={{transform:`translateX(${steerVisual*23}px)`}}>●</div><span>STEER</span></div>:<div className="joystick steering-arrows"><Hold label="◀ LEFT" onDown={press('steer',-1)} onUp={press('steer',0)}/><Hold label="RIGHT ▶" onDown={press('steer',1)} onUp={press('steer',0)}/></div>}{s?.tools.includes('boom')&&(hud.parking||hud.riggers)&&<div className="boom-float"><div className="boom-control-cluster">
 <div className="boom-status">{(hud.parking||hud.riggers)?'BOOM READY':'PARK OR RIGGERS'} · UP/DOWN + {boomMode==='extend'?'IN/OUT':'SWING'}</div>
 {s?.type.id==='rotator'&&<button type="button" className="action" onClick={()=>{boomStickStop();setBoomMode(m=>m==='extend'?'swing':'extend');}}>JOYSTICK: {boomMode==='extend'?'EXTEND':'SWING'}</button>}
 <div className="boom-joystick" role="group" aria-label="Boom joystick: vertical raises or lowers, horizontal extends or swings" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);boomStickMove(e);}} onPointerMove={e=>{if(e.buttons)boomStickMove(e);}} onPointerUp={boomStickStop} onPointerCancel={boomStickStop} onLostPointerCapture={boomStickStop}>
  <span className="boom-label top">UP</span><span className="boom-label bottom">DOWN</span>
  <span className="boom-label left">{boomMode==='extend'?'IN':'LEFT'}</span>
  <span className="boom-label right">{boomMode==='extend'?'OUT':'RIGHT'}</span>
  <div className="boom-knob" style={{transform:`translate(${boomStick.x*29}px,${-boomStick.y*29}px)`}}/>
 </div>
 </div></div>}<div className={'recovery equipment-compact '+(recoveryOpen?'is-open':'is-collapsed')}>
 <button type="button" className="recovery-toggle" onClick={()=>{setRecoveryOpen(v=>!v);setMenuOpen(false);setCameraPanelOpen(false);}}>
  {s?.type.id==='light'?'WHEEL LIFT':s?.type.id==='rotator'?'HEAVY RECOVERY':s?.type.id==='flatbed'?'ROLLBACK':'EQUIPMENT'} {recoveryOpen?'−':'+'}
 </button>
 {recoveryOpen&&<>
  <button type="button" className={'action brake-button '+(hud.parking?'active':'')} onClick={togglePark}>{hud.parking?'PARK BRAKE ✓':'PARK BRAKE'}</button>
  {s?.tools.includes('winch')&&<div className="winch-speed-selector" role="group" aria-label="Winch reel speed">{['fine','medium','high'].map(mode=><button key={mode} className={winchSpeed===mode?'selected':''} onClick={()=>selectWinchSpeed(mode)}>{mode.toUpperCase()}</button>)}</div>}
  {s?.type.id==='light'&&<>
   <div className="equipment-tabs"><button type="button" className={equipmentTab==='quick'?'selected':''} onClick={()=>setEquipmentTab('quick')}>AUTO</button><button type="button" className={equipmentTab==='manual'?'selected':''} onClick={()=>setEquipmentTab('manual')}>MANUAL</button></div>
   {equipmentTab==='quick'?<>
    <div className="equipment-row">
      {!s?.loaded&&<button className={'action '+(s?.liftDeployed?'active':'')} onClick={toggleLift}>{s?.liftDeployed?'FOLD LIFT':'LOWER LIFT'}</button>}
      <button className={'action '+(cameraMode==='reverse'?'active':'')} onClick={toggleRearCamera}>{cameraMode==='reverse'?'NORMAL CAM':'REAR CAM'}</button>
    </div>
    {!s?.loaded&&<button className="action priority-action" onClick={autoLoadVehicle}>{s?.autoLoad?'LOADING…':'AUTO LOAD VEHICLE'}</button>}
    {s?.loaded&&<>
      <button className="action priority-action" onClick={unloadAtDepot}>{s?.autoUnload?'UNLOADING…':'UNLOAD AT DEPOT'}</button>
      {!s?.autoUnload&&<button className="action" onClick={strapTires}>{s?.strapsOn?'REMOVE STRAPS':'FIT STRAPS'}</button>}
    </>}
   </>:<>
    {!s?.loaded&&<button className={'action '+(s?.liftDeployed?'active':'')} onClick={toggleLift}>{s?.liftDeployed?'FOLD WHEEL LIFT':'LOWER WHEEL LIFT'}</button>}
    {s?.liftDeployed&&<>
     <div className="equipment-row"><Hold label="LIFT UP" onDown={liftPress('liftControl',1)} onUp={liftPress('liftControl',0)}/><Hold label="LIFT DOWN" onDown={liftPress('liftControl',-1)} onUp={liftPress('liftControl',0)}/></div>
     <button className="action" onClick={toggleArms}>{s?.armsClosed?'OPEN L-ARMS':'CLOSE L-ARMS'}</button>
    </>}
    {s?.loaded&&<button className="action" onClick={strapTires}>{s?.strapsOn?'REMOVE STRAPS':'FIT STRAPS'}</button>}
   </>}
   {s?.liftDeployed&&!s.loaded&&<div className={'lift-status '+(hud.gridContact?.ok?'aligned':'')}>{hud.gridContact?.ok?'TIRES ALIGNED':hud.armsClosed?'TIRES CAPTURED':'ALIGN FRONT TIRES • '+(hud.gridContact?.error?.toFixed(1)??'--')+' m'}</div>}
  </>}
  {s?.type.id==='flatbed'&&<>
   <button className={'action '+(s?.bedTilt?'active':'')} onClick={toggleBed}>{s?.bedTilt?'LEVEL BED':'TILT ROLLBACK BED'}</button>
   {!hud.hook&&<><div className="equipment-row"><select className="action" aria-label="Choose winch hook position" value={s?.hookPoint??0} onChange={e=>{if(s&&!s.hook){s.hookPoint=Number(e.target.value);setNotice("Hook position: "+RECOVERY_POINTS[s.hookPoint].label);}}}>{RECOVERY_POINTS.map((p,i)=><option key={p.id} value={i}>{p.label}</option>)}</select><button className="action" onClick={changeHookRedirect}>{s?.riggingAnchors[s.hookRedirect].label??'DIRECT LINE'}</button></div><button className="action" onClick={()=>startAnchorPlacement(null)}>PLACE / MOVE ANCHOR</button></>}
   <button className={'action '+(hud.hook?'active':'')} onClick={toggleHook}>{hud.hook?'UNHOOK VEHICLE':'CONNECT TO VEHICLE'}</button>
   {hud.hook&&<div className="equipment-row"><Hold label="WINCH IN" onDown={press('winch',true)} onUp={press('winch',false)}/><Hold label="WINCH OUT" onDown={press('winchOut',true)} onUp={press('winchOut',false)}/></div>}
   <button className="action priority-action" onClick={secureLoad}>{s?.loaded?'RELEASE VEHICLE':'SECURE LOAD'}</button>
  </>}
  {s?.type.id==='medium'&&<>
   <div className="equipment-tabs"><button type="button" className={equipmentTab==='quick'?'selected':''} onClick={()=>setEquipmentTab('quick')}>BOOM / WINCH</button><button type="button" className={equipmentTab==='manual'?'selected':''} onClick={()=>setEquipmentTab('manual')}>WHEEL LIFT</button></div>
   {equipmentTab==='quick'?<>
    {!hud.hook&&<><div className="equipment-row"><select className="action" aria-label="Choose winch hook position" value={s?.hookPoint??0} onChange={e=>{if(s&&!s.hook){s.hookPoint=Number(e.target.value);setNotice("Hook position: "+RECOVERY_POINTS[s.hookPoint].label);}}}>{RECOVERY_POINTS.map((p,i)=><option key={p.id} value={i}>{p.label}</option>)}</select><button className="action" onClick={changeHookRedirect}>{s?.riggingAnchors[s.hookRedirect].label??'DIRECT LINE'}</button></div><button className="action" onClick={()=>startAnchorPlacement(null)}>PLACE / MOVE ANCHOR</button></>}
    <button className={'action '+(hud.hook?'active':'')} onClick={toggleHook}>{hud.hook?'DISCONNECT HOOK':'CONNECT TO VEHICLE'}</button>
    {hud.hook&&<div className="equipment-row"><Hold label="WINCH IN" onDown={press('winch',true)} onUp={press('winch',false)}/><Hold label="WINCH OUT" onDown={press('winchOut',true)} onUp={press('winchOut',false)}/></div>}
   </>:<>
    <button className={'action '+(s?.liftDeployed?'active':'')} onClick={toggleLift}>{s?.liftDeployed?'FOLD WHEEL LIFT':'LOWER WHEEL LIFT'}</button>
    {s?.liftDeployed&&<>
      <div className="equipment-row"><Hold label="LIFT UP" onDown={liftPress('liftControl',1)} onUp={liftPress('liftControl',0)}/><Hold label="LIFT DOWN" onDown={liftPress('liftControl',-1)} onUp={liftPress('liftControl',0)}/></div>
      <div className="equipment-row"><button className="action" onClick={()=>adjustGrid(-.1)}>GRID −</button><button className="action" onClick={()=>adjustGrid(.1)}>GRID +</button></div>
      <button className="action" onClick={toggleArms}>{s?.armsClosed?'OPEN L-ARMS':'CLOSE L-ARMS'}</button>
    </>}
   </>}
  </>}
  {s?.type.id==='rotator'&&<>
   <button className={'action '+(hud.riggers?'active':'')} onClick={toggleRiggers}>RIGGERS {hud.riggers?'RETRACT':'DEPLOY'}</button>
   <div className="equipment-tabs recovery-tabs-three"><button type="button" className={'recovery-tab line-a-tab '+(activeRecoveryLine===0?'selected':'')} onClick={()=>setActiveRecoveryLine(0)}>● LINE A</button><button type="button" className={'recovery-tab line-b-tab '+(activeRecoveryLine===1?'selected':'')} onClick={()=>setActiveRecoveryLine(1)}>● LINE B</button><button type="button" className={'recovery-tab '+(activeRecoveryLine==='both'?'selected':'')} onClick={()=>setActiveRecoveryLine('both')}>BOTH</button></div>
   {activeRecoveryLine==='both'&&<div className="recovery-line-compact dual-recovery-controls">
     <div className="line-summary dual-line-status"><span className="line-a-label">A: {s.recoveryLines[0].connected?'CONNECTED':'NOT CONNECTED'}</span><span className="line-b-label">B: {s.recoveryLines[1].connected?'CONNECTED':'NOT CONNECTED'}</span></div>
     {s.recoveryLines.every(line=>line.connected)?<div className="equipment-row"><Hold label="WINCH BOTH" onDown={bothRecoveryPress(1)} onUp={bothRecoveryPress(0)}/><Hold label="PAY BOTH" onDown={bothRecoveryPress(-1)} onUp={bothRecoveryPress(0)}/></div>:<div className="line-summary">Connect A and B from their tabs first.</div>}
   </div>}
   {s?.type.id==='rotator'&&<><button type="button" className="action" onClick={startDoubleAnchorSetup}>LINE A • TWO REDIRECT POINTS</button><div className="equipment-row">{[3,4].map((slot,i)=><button key={slot} type="button" className="action" disabled={!s.riggingAnchors[slot].pos} onClick={()=>removePlacedAnchor(slot)}>REMOVE ANCHOR {i===0?'A':'B'}</button>)}</div></>}
   {s?.recoveryLines[activeRecoveryLine]&&<div className={'recovery-line-compact '+(activeRecoveryLine===0?'line-a-controls':'line-b-controls')}>
    <div className="line-summary">BOOM → {s.riggingAnchors[s.recoveryLines[activeRecoveryLine].redirect].label}{s.recoveryLines[activeRecoveryLine].secondRedirect?' → '+s.riggingAnchors[s.recoveryLines[activeRecoveryLine].secondRedirect].label:''} → {selectedRecoveryPoint(s,s.recoveryLines[activeRecoveryLine]).label}</div>
    {!s.recoveryLines[activeRecoveryLine].connected&&<div className="equipment-row"><select className="action" aria-label="Choose vehicle attachment point" value={s.recoveryLines[activeRecoveryLine].point} onChange={e=>{const line=s.recoveryLines[activeRecoveryLine];if(!line.connected){line.point=Number(e.target.value);line.customPoint=null;setNotice("Hook position: "+RECOVERY_POINTS[line.point].label);}}}>{RECOVERY_POINTS.map((p,i)=><option key={p.id} value={i}>{p.label}</option>)}</select><button className="action" onClick={()=>changeRecoveryRedirect(activeRecoveryLine)}>{s.riggingAnchors[s.recoveryLines[activeRecoveryLine].redirect].label}</button></div>}
    {!s.recoveryLines[activeRecoveryLine].connected&&<button className="action" onClick={()=>startCustomHook(activeRecoveryLine)}>CUSTOM HOOK • TAP VEHICLE</button>}
    {!s.recoveryLines[activeRecoveryLine].connected&&<button className="action" onClick={()=>startAnchorPlacement(activeRecoveryLine)}>PLACE / MOVE ANCHOR</button>}
     {s.recoveryLines[activeRecoveryLine].connected&&<div className="line-summary">CONNECTED TO VEHICLE • {RECOVERY_POINTS[s.recoveryLines[activeRecoveryLine].point].label}</div>}
    {s.secondary.active&&<button className="action" onClick={()=>changeRecoveryTarget(activeRecoveryLine)}>TARGET VEHICLE {s.recoveryLines[activeRecoveryLine].target+1}</button>}
    <button className={'action '+(s.recoveryLines[activeRecoveryLine].connected?'active':'')} onClick={()=>toggleRecoveryLine(activeRecoveryLine)}>{s.recoveryLines[activeRecoveryLine].connected?'DISCONNECT LINE':'CONNECT TO VEHICLE'}</button>
    {s.recoveryLines[activeRecoveryLine].connected&&<div className="equipment-row"><Hold label="WINCH IN" onDown={recoveryPress(activeRecoveryLine,1)} onUp={recoveryPress(activeRecoveryLine,0)}/><Hold label="PAY OUT" onDown={recoveryPress(activeRecoveryLine,-1)} onUp={recoveryPress(activeRecoveryLine,0)}/></div>}
   </div>}
  </>}
 </>}
 </div><div className="drive"><Hold label="REV" onDown={press('throttle',-.55)} onUp={press('throttle',0)}/><Hold label="BRAKE" onDown={press('brake',1)} onUp={press('brake',0)}/><Hold label="GAS" wide onDown={press('throttle',1)} onUp={press('throttle',0)}/></div></div>
  <div className={'toolbar'+(menuOpen?' menu-open':'')+(cameraPanelOpen?' camera-open':'')}>
  <button type="button" className="menu-toggle" aria-expanded={menuOpen} onClick={()=>{setMenuOpen(v=>!v);setCameraPanelOpen(false);setSettingsOpen(false);setGarage(false);setHelp(false);}}>{menuOpen?'CLOSE MENU ✕':'MENU ☰'}</button>
  {!menuOpen&&<div className="camera-shortcuts" role="group" aria-label="Camera controls">
    <button type="button" className="camera-cycle" onClick={nextCamera} title="Cycle camera angles">CAM: {CAMERA_MODES.find(([id])=>id===cameraMode)?.[1]} ↻</button>
    <button type="button" className="camera-angles" onClick={()=>{setCameraPanelOpen(v=>!v);setMenuOpen(false);}} aria-expanded={cameraPanelOpen}>ANGLES {cameraPanelOpen?'−':'+'}</button>
  </div>}
  {cameraPanelOpen&&!menuOpen&&<div className="camera-selector" role="group" aria-label="Camera angle presets">
    {CAMERA_MODES.map(([id,label])=><button type="button" key={id} className={cameraMode===id?'selected':''} onClick={()=>changeCamera(id)}>{label}</button>)}
  </div>}
  {menuOpen&&<div className="toolbar-panel"><div className="checkpoint-actions">
   <div className="checkpoint-caption">{savedCheckpoint?'SAVED: LEVEL '+(savedCheckpoint.jobIndex%JOBS.length+1)+' • '+JOBS[savedCheckpoint.jobIndex%JOBS.length].name:'NO IN-PROGRESS SAVE'}</div>
   <button className="checkpoint-save" onClick={saveInProgress}>SAVE IN-PROGRESS</button>
   {savedCheckpoint&&<><button className="checkpoint-resume" onClick={resumeSavedJob}>RESUME SAVED JOB</button><button className="checkpoint-delete" onClick={deleteSavedJob}>DELETE SAVED JOB</button></>}
  </div><select aria-label="Select test job" value={career.job%JOBS.length} onChange={e=>selectTestJob(Number(e.target.value))} style={{background:"#153c43",color:"#fff",border:"2px solid #f3c851",borderRadius:7,padding:"8px",fontWeight:800,maxWidth:190}}>{JOBS.map((job,index)=><option key={job.name} value={index}>{index+1}. {job.name}</option>)}</select><button onClick={()=>{setMenuOpen(false);reset();setNotice('Dispatch: '+JOBS[careerRef.current.job%JOBS.length].name);}}>RESTART JOB</button><button onClick={()=>{setMenuOpen(false);setGarage(v=>!v);setHelp(false);}}>FLEET / GARAGE</button><button onClick={()=>{setMenuOpen(false);reset();}}>RESET</button><button onClick={()=>{setMenuOpen(false);changeCamera('orbit');}}>RESET CAMERA</button><button onClick={()=>{setMenuOpen(false);setSettingsOpen(v=>!v);}}>SETTINGS</button><button onClick={()=>{setMenuOpen(false);setHelp(v=>!v);}}>CONTROLS</button></div>}</div>
  {settingsOpen&&<aside className="help" style={{zIndex:30,maxWidth:310}}><button onClick={()=>setSettingsOpen(false)}>×</button><b>CONTROL SETTINGS</b>{[['steering','Driving sensitivity',0.4,1.6],['boom','Boom / hydraulic sensitivity',0.3,2],['winch','Winch speed',0.3,2]].map(([key,label,min,max])=><label key={key}>{label}: {settings[key].toFixed(1)}× <input type="range" min={min} max={max} step="0.1" value={settings[key]} onChange={e=>changeSetting(key,Number(e.target.value))}/></label>)}<label>Steering <select value={settings.driveMode} onChange={e=>changeSetting('driveMode',e.target.value)}><option value="joystick">Joystick</option><option value="arrows">Arrows</option></select></label><small>Saved on this device.</small></aside>}{notice&&<div className="game-notice" onClick={()=>setNotice('')}>{notice} ✕</div>}
  {garage&&<aside className="help garage"><button onClick={()=>setGarage(false)}>×</button><b>RECOVERY GARAGE</b><span>TEST MODE: All jobs and trucks unlocked. Choose any job from the bottom toolbar.</span><span>Balance: ${career.cash}</span><div className="fleet-list">{FLEET.map(t=><button key={t.id} className="garage-buy" onClick={()=>chooseTruck(t.id)}>{t.name} · {career.selected===t.id?'SELECTED':'TEST DRIVE'}</button>)}</div><button className="garage-buy" onClick={()=>upgrade('engine')}>ENGINE LV {career.engine}/3 · {'$'+(career.engine+1)*500}</button><button className="garage-buy" onClick={()=>upgrade('winch')}>WINCH LV {career.winch}/3 · {'$'+(career.winch+1)*500}</button><small>Progress saves on this device.</small></aside>}
  {help&&<aside className="help instructions-panel" role="dialog" aria-label="Game instructions"><button type="button" className="instructions-close" onClick={()=>setHelp(false)} aria-label="Close instructions">×</button><button type="button" className="instructions-start" onClick={()=>setHelp(false)}>▶ START GAME</button><b>HOW TO OPERATE</b><span>Use the left joystick to steer. Reverse and gas are on the right. Release the gas to slow down; use PARK BRAKE to stop and secure the truck. Deploy the boom and parking brake before winching. The boom joystick appears to the left of the equipment menu when either PARK BRAKE or RIGGERS is engaged and the truck is stopped. Winching heavy recoveries still requires both park brake and riggers. Park brake is required for capturing the tires and all heavy recovery operations; the light wheel lift can move at walking speed. Use CAM to cycle camera views or ANGLES for RAVINE, FREE, CHASE, REAR, FRONT, LEFT, RIGHT, TOP, HOOK and WIDE views. Drag to orbit; pinch to zoom any view. Drive within 24 m to hook the pickup. Light wheel-lift: tap LOWER WHEEL LIFT while moving slowly, reverse beneath the front tires until the status says TIRES ALIGNED, stop and apply PARK BRAKE, tap CLOSE L-ARMS, hold LIFT UP, tap FIT TIRE STRAPS, release brake and tow. Open WHEEL LIFT on the right to access these buttons. MENU opens separately at the top right. Flatbed: tilt bed, hook, secure load and deliver. Medium wrecker: fixed rear boom raises/lowers and telescopes but does not swing. Deploy the separate wheel lift, then hold LIFT UP/DOWN or its hydraulic joystick to raise/lower the tow bar. Only the heavy rotator can swing its boom with the riggers deployed. For a heavy rollover: deploy riggers and boom, connect LINE A and B to suitable simulated frame points, hold each independent winch (or select BOTH to reel in/out together) and watch the roll angle and tension. A connected idle line holds its length and can gain tension when another line pulls against it. Some jobs have two trucks; select TARGET 1 or 2 for each line and bring both upright into the recovery zone. Game forces are simplified and not real-world rigging instructions. Buy trucks in FLEET / GARAGE.</span><small>Keyboard: W/S drive & reverse · A/D steer · H hook · R winch</small></aside>}
 </main>;
}
