import {trackMotion,cableBreaks,damagedTrackSpeed} from './trackedRecovery.js';
import {addTrackedBody,moveTracks,trackedDust} from './trackedModels.js';
import {anchorCapacity,redirectLoad,anchorSlip} from './temporaryAnchors.js';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {levelFourHeight,levelFourSlope,levelFourDownhillAcceleration,LEVEL_FOUR_STAGING} from './levelFourTerrain.js';
import {createLevelFourScene} from './levelFourScene.js';
import {modelRollHull,rollContactOffset,recoveryRollStep} from './rollContact.js';
import {resolveVehicleContact,wheelLiftContactRear} from './vehicleContact.js';
import {TANDEM_SITE_INDEX,TANDEM_HELPER,isSupportLine,lineLimit,tandemComplete,noteTandemUse,switchTandemControl,migrateJobIndex,controlledTruck,lineOwner,ownerHasCable,linePowerReady,stopTruckInputs,makeHelperState,stepHelper,tandemDriveBlock} from './tandemRecovery.js';
import {siteConfig,siteHeight,siteSlope,siteGravity,WOODLAND_SITE_INDEX,woodlandTrailCenter,woodlandOnFirmTrail,createDispatchSite,bridgeEdgeExceeded,constrainSiteTruck,siteRecoveryReady,siteGoalReached,checkpointSiteCompatible} from './dispatchSites.js';
import {createLakeScene,lakeHeight,lakeSlope,lakeDownhillAcceleration,LAKE_SURFACE} from './lakeScene.js';
import {RECOVERY_SAVE_KEY,captureRecoverySave,parseRecoverySave,restoreRecoverySave} from './progressSave.js';
import {FRONT_WINCH_CRAWL,makeFrontWinch,frontWinchReach,woodlandBogged,frontWinchStep} from './woodlandRecovery.js';
import {sampleSurface,recoverySurfaceVelocity} from './terrainPhysics.js';
import {createGameAudio} from './gameAudio.js';
import {ROLLBACK_LENGTH,rollbackDeck,rollbackPose,rollbackStop,rollbackTravel,rollbackReady,rollbackCanConnect,rollbackAligned,rollbackGroundLimit,rollbackApproachStep,rollbackCanUnhook,rollbackRampReady,rollbackStowed,rollbackHydraulicStep,rollbackTransportReady,rollbackContactHeight,rollbackTieDownPath,ROLLBACK_CREEP_SPEED,rollbackCreepReady,rollbackBedContact,rollbackBedMotionBlocked,rollbackDamage,rollbackNetPay} from './rollbackPhysics.js';
import {cableGeometry,cablePathSpeed,cableLoad,cableReelStep,standardWinchStep,cableRenderPoints} from './cablePhysics.js';
import {supportReaction,supportState,SUPPORT_PADS,supportWrench,outriggerLoads,padContact,suspensionStep} from './supportPhysics.js';
import {ditchContactPose,ditchGroundStep,groundCableDelta} from './ditchPhysics.js';
import {surfaceMap,reflectionSky,addRoadsideDetails,addIntegratedChassis} from './visualQuality.js';
import {addRotatorBody,detailRotatorRig} from './heavyRotatorModel.js';
import {addFleetBody,addOffroadBody,detailMediumRig,detailCarrierDeck} from './fleetModels.js';
import {steeringStep,brakeStep,chassisGrade,cameraGroundClearance} from './drivingPhysics.js';
import { canCompleteJob, minimapX, minimapY, wheelLiftCaptureReady, wheelLiftMotionReady, wheelLiftLockReady, wheelLiftStrapReady, wheelLiftTransportReady, winchLoadBand, stopWinchCoast, canPowerBothRecoveryLines, parkingBrakeForRiggers, cameraPresetPose, recoveryYawMoment, recoveryYawStep } from './gameRules.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const woodlandSite=siteConfig(WOODLAND_SITE_INDEX);
const frontWinchHead=truck=>V(truck.pos.x+4.43*Math.sin(truck.yaw),truck.pos.y+1.02,truck.pos.z-4.43*Math.cos(truck.yaw));
const hasFrontCable=truck=>Boolean(truck?.frontWinch&&truck.frontWinch.anchor>=0);
const FLEET=[
{id:'light',name:'Light Wheel-Lift',price:0,color:0xd34b32,tools:['lift']},
{id:'flatbed',name:'Rollback Flatbed',price:400,color:0x2d78b2,tools:['bed','winch']},
{id:'medium',name:'Medium Wrecker',price:700,color:0xe0a52c,tools:['lift','boom','winch']},
{id:'rotator',name:'Heavy Rotator',price:1100,color:0x5e68b0,tools:['boom','winch','riggers']},
{id:'offroad',name:'Trail Recovery 8×8',price:1700,color:0xba7036,tools:['lift','boom','winch']},
{id:'hercules',name:'M88A2 HERCULES',price:2800,color:0xbda67d,tools:['boom','winch']}
];
const JOBS=[
{name:'Parking Lot Tow',x:3,z:-18,pay:450,kind:'tow',truck:'light',weight:1.5},
{name:'AWD Rollback Transport',x:3,z:-42,pay:750,kind:'flatbed',truck:'flatbed',weight:2.5},
{name:'Ditch Extraction',x:11,z:-28,pay:1200,kind:'recovery',truck:'medium',weight:4},
{name:'Heavy Rollover Recovery',x:-18,z:-63,pay:2600,kind:'heavy',truck:'rotator',weight:12,roll:1.48},
{name:'Lakeside Vehicle Recovery',x:-19,z:-76,pay:3400,kind:'heavy',truck:'rotator',weight:14,roll:1.25,vehicle:'suv',brief:'Recover a partially submerged SUV at the boat launch. Right it and pull through the muddy bank to dry pavement.'},
{name:'Winter Freight Terminal',x:-13,z:-88,pay:4200,kind:'heavy',truck:'rotator',weight:16,roll:2.66,boxTruck:true,brief:'Right a delivery truck on the icy loading apron, work around cargo stacks and pull it into the cleared freight bay.'},
{name:'Highway Bridge Rescue',x:-5.75,z:-100,pay:5800,kind:'heavy',truck:'rotator',weight:17,roll:1.35,boxTruck:true,second:{x:3.2,z:-109,roll:1.10,yaw:.28},brief:'Two wrecks on an elevated bridge. Keep both on the deck, right them and move vehicle 1 to the green bay and vehicle 2 to the cyan bay. Crossing the edge fails the dispatch.'},
{name:'Quarry Tandem Practice',x:-5,z:-99,pay:4800,kind:'heavy',truck:'rotator',weight:5,roll:.0,vehicle:'pickup',brief:'One cable per truck. Stage the rotator, connect A to pull toward the green bay, then stop and switch to medium wrecker B. Position it independently, park, connect B and manage both cable loads. Both winches must pull under load before completion.'},
{name:'Woodland Recovery',...woodlandSite.target,pay:3800,kind:'woodland',truck:'offroad',vehicle:'pickup',weight:3.4,
 brief:'Follow the gravel trail into the woods. Winch the stuck work truck onto firm ground, secure its front axle with the wheel lift, and tow it back to the green trailhead bay.'},
{name:'Military Tank Recovery: Iraq',x:12,z:-143,pay:6200,kind:'tracked',truck:'hercules',vehicle:'abrams',weight:61,
 brief:'Cross the ridge to find the disabled Abrams. Position the M88A2 on firm ground, park, lower the blade, and winch the tank onto the road. Disconnect, couple the tow bar and return to the maintenance outpost.'}
];
// Quick camera presets are independent of the equipment and dispatch menus.
const CAMERA_MODES=[['ravine','RAVINE'],['orbit','FREE'],['chase','CHASE'],['reverse','REAR'],['front','FRONT'],['left','LEFT'],['right','RIGHT'],['top','TOP'],['hook','HOOK'],['wide','WIDE']];
const deckFor=s=>rollbackDeck(s.bedSlide,s.bedProgress);
const rampReady=s=>rollbackRampReady(s.bedSlide,s.bedProgress);
const transportReady=s=>rollbackTransportReady(s.bedSlide,s.bedProgress,s.loaded,s.strapsOn,s.hook);
const creepReady=s=>rollbackCreepReady(s.bedSlide,s.bedProgress,s.loaded,s.strapsOn,s.hook);
const recordBedContact=(s,notify)=>{if(s.bedContactLatch)return;s.bedContactLatch=true;const old=s.recoveryDamage;s.recoveryDamage=rollbackDamage(old,JOBS[s.jobIndex%JOBS.length].pay);notify('RAMP CONTACT • $'+(s.recoveryDamage-old)+' damage. Release controls, pull forward slowly, then park and stow.');};
const rollbackLocal=s=>s.pickPos.clone().sub(s.pos).applyAxisAngle(V(0,1,0),s.yaw);
const rollbackReverse=s=>RECOVERY_POINTS[s.hookPoint].z>0;
const rollbackYawError=s=>Math.atan2(Math.sin(s.pickYaw-s.yaw-(rollbackReverse(s)?Math.PI:0)),Math.cos(s.pickYaw-s.yaw-(rollbackReverse(s)?Math.PI:0)));
const rollbackHead=s=>s.truck.userData.bed.localToWorld(V(0,.40,-ROLLBACK_LENGTH/2+.18));
const rollbackEye=s=>{const p=RECOVERY_POINTS[s.hookPoint],k=s.pickup.userData.scale;return s.pickup.localToWorld(V(p.x*k,p.y*k,p.z*k));};
const liftMotionReady=s=>wheelLiftMotionReady({speed:s.vel.length(),loaded:s.loaded,parkingBrake:s.parkingBrake});
const liftLockReady=s=>wheelLiftLockReady({speed:s.vel.length(),parkingBrake:s.parkingBrake});
const liftTransportReady=s=>!s.tools.includes('lift')||wheelLiftTransportReady({
 loaded:s.loaded,armsClosed:s.armsClosed,strapped:s.strapsOn,height:s.liftHeight,
});
const standardWinchReady=s=>s.parkingBrake&&s.hook&&!s.loaded&&(s.type.id!=='hercules'||s.bladeDepth>.25)&&(
 s.type.id==='flatbed'?rampReady(s):s.tools.includes('boom')&&s.boomDeployed
);
const drivingKeys={w:['throttle',1],arrowup:['throttle',1],s:['throttle',-.55],arrowdown:['throttle',-.55],
 a:['steer',-1],arrowleft:['steer',-1],d:['steer',1],arrowright:['steer',1],' ':['brake',1]};

const liftPitch=s=>s.type.id==='light'?.55-.65*s.liftHeight:.35-.36*s.liftHeight;
const liftReach=s=>s.type.id==='light'?1.72:2.85+s.liftExtension;
const truckCameraZoom=type=>type.id==='offroad'||type.id==='hercules'?20:13;
const liftBase=s=>s.type.id==='offroad'?3.55:2.4;
const liftHitchDistance=s=>liftBase(s)+Math.cos(liftPitch(s))*liftReach(s);
const inRecoveryBay=(s,job)=>job.kind==='woodland'
 ?siteGoalReached(woodlandSite.goals[0],s.pickPos,0)
 :Math.hypot(s.pickPos.x-2,s.pickPos.z-job.z)<4.2;

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
const recoveryAnchor=(target,point)=>target.pos.clone().add(V(0,target.contactHull?rollContactOffset(target.contactHull,target.roll):.65,0)).add(V(point.x,point.y,point.z).applyEuler(new THREE.Euler(0,-target.yaw,target.roll,'YXZ')));
const primaryRecoveryTarget=s=>({pos:s.pickPos,yaw:s.pickYaw,roll:s.pickRoll,contactHull:s.pickup.userData.rollHull});
const selectedRecoveryPoint=(s,line)=>line.customPoint||RECOVERY_POINTS[line.point];
const lineRoute=(head,eye,redirect,second=null,returnPoint=null)=>[head,...(redirect?[redirect]:[]),...(second?[second]:[]),eye,...(returnPoint?[returnPoint]:[])];
const linePathLength=(head,eye,redirect,second=null)=>cableGeometry(lineRoute(head,eye,redirect,second)).distance;
const lineTruck=(s,i)=>isSupportLine(s,i)?s.tandemHelper:s.truck;
const truckReturn=(s,i)=>lineTruck(s,i).userData.body.localToWorld(V((i===0?-.65:.65),1.1,2.3));
const recoveryHead=(s,i)=>lineTruck(s,i).userData.boomTip.localToWorld(V(isSupportLine(s,i)?0:i===0?-.25:.25,0,0));
// Four cable legs, eight subdivisions each, with one shared starting point.
const cableBuffer=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(33*3),3).setUsage(THREE.DynamicDrawUsage));g.setDrawRange(0,0);return g;};
const updateWinchLine=(line,points,spool,tension,ground)=>{
 const curve=cableRenderPoints(points,spool,tension,ground),attr=line.geometry.attributes.position;
 for(let i=0;i<curve.length;i++){const p=curve[i];attr.setXYZ(i,p.x,p.y,p.z);}
 attr.needsUpdate=true;line.geometry.setDrawRange(0,curve.length);line.visible=true;
};
const nextAnchorSlot=(anchors,current)=>{const choices=anchors.map((a,i)=>a.pos||i===0?i:-1).filter(i=>i>=0);return choices[(Math.max(0,choices.indexOf(current))+1)%choices.length];};
const winchSpeedFactor=speed=>({fine:.35,medium:1,high:2.4}[speed]??1);
const isDitchPull=s=>s.type.id==='medium'&&JOBS[s.jobIndex%JOBS.length].kind==='recovery'&&!s.loaded;
// Match the actual rendered pickup's grounded pose and scaled attachment point.
const ordinaryEye=s=>{const point=RECOVERY_POINTS[s.hookPoint];if(!isDitchPull(s))return recoveryAnchor(s.type.id==='rotator'?primaryRecoveryTarget(s):{pos:s.pickPos,yaw:s.pickYaw,roll:0},point);const k=s.pickup.userData.scale,p=ditchContactPose(s.pickPos.x,s.pickPos.z,s.pickYaw,k);return V(s.pickPos.x,p.height,s.pickPos.z).add(V(point.x*k,point.y*k,point.z*k).applyEuler(new THREE.Euler(p.pitch,-s.pickYaw,p.roll,'YXZ')));};
const AUTO_RECOVERY_SAVE_KEY='towing-autosave-v1';
const loadCareer=()=>{
 let saved={};
 try{saved=JSON.parse(localStorage.getItem('towing-career')||'{}')??{};}catch{}
 const savedJob=migrateJobIndex(saved.job??0,saved.jobCount??7,JOBS.length);
 const requested=Number(new URLSearchParams(window.location.search).get('level'));
 const job=Number.isInteger(requested)&&requested>=1&&requested<=JOBS.length?requested-1:savedJob;
 const assignedTruck=JOBS[job%JOBS.length].truck;
 const selected=job===savedJob&&FLEET.some(truck=>truck.id===saved.selected)?saved.selected:assignedTruck;
 return {...saved,job,jobCount:JOBS.length,selected};
};
const clearAutomaticCheckpoint=jobIndex=>{
 try{
  const checkpoint=parseRecoverySave(localStorage.getItem(AUTO_RECOVERY_SAVE_KEY),JOBS.length);
  if(checkpoint?.jobIndex===jobIndex)localStorage.removeItem(AUTO_RECOVERY_SAVE_KEY);
 }catch{}
};

function box(parent,name,size,pos,color,opts={}) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:opts.roughness??.78,metalness:opts.metalness??.08}));
  mesh.name=name; mesh.position.set(...pos); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function makeVehicle(scene,{name,color,pos,scale=1,kind='pickup'}) {
  const root=new THREE.Group(); root.name=name; root.position.copy(pos); scene.add(root);
  const body=new THREE.Group(); root.add(body);
  const tracked=kind==='hercules'||kind==='abrams';
  const tracks=tracked?addTrackedBody(THREE,body,kind==='abrams'):null;
  if(tracks)moveTracks(THREE,tracks,0,0,0);
  const offroad=kind==='offroad';
  if(offroad)addOffroadBody(THREE,body,color);
  else if(!tracked){
    addIntegratedChassis(THREE,body,{kind,scale,color,railsOnly:true});
    if(kind==='rotator')addRotatorBody(THREE,body,{scale,color});
    else addFleetBody(THREE,body,{kind,scale,color});
  }
  const wheels=[],tireBands=[],tireMap=surfaceMap(THREE,16,1,65,'tire');
  const axlePositions=offroad?[-2.75,-1.27,1.33,2.80]:[-1.55,1.55];
  const wheelOffsets=offroad?[-1.26,1.26]:[-1.06,1.06];
  for(const z of axlePositions)for(const x of wheelOffsets){
    const profile=[[.19,-.16],[.35,-.16],[.43,-.145],[.475,-.10],[.48,-.055],[.48,.055],[.475,.10],[.43,.145],[.35,.16],[.19,.16],[.19,-.16]].map(([r,y])=>new THREE.Vector2(r*scale,y*scale));
    const tire=new THREE.Mesh(new THREE.LatheGeometry(profile,28),new THREE.MeshStandardMaterial({color:0x27292a,roughness:.94,map:tireMap}));
    tire.rotation.z=Math.PI/2; tire.position.set(x,.62*scale,z); tire.castShadow=true; tire.visible=!tracked;root.add(tire); wheels.push(tire);
    if(kind==='rotator'&&z>0){const inner=new THREE.Mesh(tire.geometry,tire.material);inner.name='inner rear dual tire';inner.position.y=Math.sign(x)*.345*scale;inner.castShadow=true;tire.add(inner);}
    if(name!=='wrecker'&&z<0){const band=new THREE.Mesh(new THREE.CylinderGeometry(.491*scale,.491*scale,.12*scale,32,1,true),new THREE.MeshStandardMaterial({color:0xf2b832,roughness:.86,side:THREE.DoubleSide}));band.name='front tire webbing';band.visible=false;tire.add(band);tireBands.push(band);}
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.25*scale,.25*scale,.325*scale,20),new THREE.MeshStandardMaterial({color:0x8b9297,metalness:.7,roughness:.35}));
    tire.add(hub);
    const outer=x>0?-1:1;
    const center=new THREE.Mesh(new THREE.CylinderGeometry(.095*scale,.095*scale,.045*scale,14),new THREE.MeshStandardMaterial({color:0x343d43,metalness:.6,roughness:.38}));
    center.position.y=outer*.18*scale;tire.add(center);
    const boltGeo=new THREE.CylinderGeometry(.025*scale,.025*scale,.025*scale,6),boltMat=new THREE.MeshStandardMaterial({color:0x343b40,metalness:.55});
    for(let k=0;k<6;k++){const a=k*Math.PI/3,bolt=new THREE.Mesh(boltGeo,boltMat);bolt.position.set(Math.cos(a)*.17*scale,outer*.17*scale,Math.sin(a)*.17*scale);tire.add(bolt);}
    for(const y of [-.105,.105]){const groove=new THREE.Mesh(new THREE.TorusGeometry(.473*scale,.010*scale,5,28),new THREE.MeshStandardMaterial({color:0x0a0c0d,roughness:1}));groove.rotation.x=Math.PI/2;groove.position.y=y*scale;tire.add(groove);}
  }
  // Chassis and tires, before adding articulated equipment and the rollback bed.
  const collisionBounds=new THREE.Box3().setFromObject(root).translate(pos.clone().negate());
  const forks=[],outriggers=[],supportPads=[],boomCylinders=[],liftCylinders=[];
  let recoveryStructure=null,boomPivot=null,boomTilt=null,boomSleeve=null,boomTip=null;
  let underliftPivot=null,underliftInner=null,underliftHead=null,liftCross=null;
  if(name==='wrecker') {
    // Fixed recovery boom with a separate articulated underlift. The rotator alone can slew.
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
    if(kind==='medium'||offroad)detailMediumRig(THREE,{recoveryStructure,boomPivot,boomTilt,boomTip});
    if(kind==='rotator'){
      detailRotatorRig(THREE,{recoveryStructure,boomPivot,boomTilt,boomSleeve,boomTip});
      box(recoveryStructure,'rotator bearing pedestal',[1.36,.95,1.26],[0,1.47,1.13],0x36434b,{metalness:.45});
      for(const pad of SUPPORT_PADS){const side=Math.sign(pad.x);box(body,'stabilizer beam housing',[.96,.30,.40],[side*.73,.88,pad.z],0x343f46,{metalness:.45});}
    }
    if(kind==='rotator')for(const pad of SUPPORT_PADS){
      const side=Math.sign(pad.x),arm=box(body,'outrigger arm',[1.55,.22,.31],[side*1.75,.88,pad.z],0x4c555a,{metalness:.4});
      const foot=box(body,'outrigger foot',[.64,.14,.70],[pad.x,.13,pad.z],0xe0b340);
      const jack=new THREE.Mesh(new THREE.CylinderGeometry(.105,.135,1,12),new THREE.MeshStandardMaterial({color:0x929da5,metalness:.62,roughness:.33}));jack.name='outrigger hydraulic jack';jack.castShadow=true;body.add(jack);
      for(const part of [arm,foot,jack])part.visible=false;
      outriggers.push(arm,foot,jack);supportPads.push({arm,foot,jack,pad});
    }
    const liftZ=offroad?3.55:2.4;
    box(body,'underlift hinge housing',[.85,.49,.7],[0,1.12,liftZ-.03],0x252f35);
    underliftPivot=new THREE.Group();underliftPivot.name='underlift raise-lower hinge';underliftPivot.position.set(0,1.18,liftZ);body.add(underliftPivot);
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
  const bed=box(body,'rollback bed',[2.55,.22,ROLLBACK_LENGTH],[0,1.45,3.4],0x606a71);bed.visible=false;bed.material.map=surfaceMap(THREE,5,16,60,'steel');bed.material.roughness=.68;bed.material.metalness=.38;
   box(bed,'rollback headboard',[2.55,.48,.12],[0,.35,-ROLLBACK_LENGTH/2+.06],0x404c54);
   box(bed,'rollback winch drum',[.65,.32,.28],[0,.33,-ROLLBACK_LENGTH/2+.29],0x222c31);
   for(const side of [-1,1])box(bed,'deck edge rail',[.06,.055,ROLLBACK_LENGTH],[side*1.24,.13,0],0x8a959c);
  if(kind==='flatbed')detailCarrierDeck(THREE,bed,ROLLBACK_LENGTH);
  const deckTies=[];
  if(kind==='flatbed')for(let i=0;i<4;i++){
   const geo=new THREE.BufferGeometry(),positions=new Float32Array(15*2*3),indices=[];
   for(let j=0;j<14;j++){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
   geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geo.setIndex(indices);
   const webbing=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xe9ad25,roughness:.88,side:THREE.DoubleSide}));webbing.name='deck wheel tie-down '+i;webbing.frustumCulled=false;webbing.visible=false;bed.add(webbing);
   const ratchet=box(bed,'tie-down ratchet',[.16,.065,.20],[0,.15,0],0x9fa8ab,{metalness:.65});ratchet.visible=false;
   const anchor=box(bed,'tie-down anchor',[.18,.035,.17],[0,.13,0],0x343e43,{metalness:.5});anchor.visible=false;
   deckTies.push({webbing,ratchet,anchor});
  }
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
  const blade=kind==='hercules'?box(body,'hydraulic ground spade',[3.42,.64,.32],[0,.85,-3.04],0x87755a):null;
  if(blade)for(const side of [-1,1]){
   const arm=box(body,'A-frame boom leg',[.28,.31,3.2],[side*.73,0,1.55],0x958567);
   arm.rotation.y=-side*.30;boomTilt.add(arm);
  }
  root.userData={body,wheels,tracks,blade,collisionBounds,tireBands,deckTies,scale,towPitchPivot,bed,straps,recoveryStructure,boomPivot,boomTilt,boomSleeve,boomTip,boomCylinders,underliftPivot,underliftInner,underliftHead,liftCross,liftCylinders,forks,outriggers,supportPads};
  return root;
}

// Keep the button identity stable during frequent HUD renders.
function Hold({label,onDown,onUp,wide=false,disabled=false}) {
 const heldKey=useRef(null);
 const releaseKey=e=>{
  if(!heldKey.current)return;
  heldKey.current=null;onUp(e);
 };
 return <button disabled={disabled} className={wide?'control wide':'control'}
 onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);onDown(e);}}
 onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}
 onKeyDown={e=>{
  if(e.key!==' '&&e.key!=='Enter')return;
  e.preventDefault();
  if(!e.repeat&&!heldKey.current){heldKey.current=e.key;onDown(e);}
 }}
 onKeyUp={e=>{if(e.key===heldKey.current){e.preventDefault();releaseKey(e);}}}
 onBlur={releaseKey} onContextMenu={e=>e.preventDefault()}>{label}</button>;
}
export default function TowingGame(){
 const [career,setCareer]=useState(()=>({cash:0,completed:0,engine:0,winch:0,owned:['light'],...loadCareer()}));
 const careerRef=useRef(career);careerRef.current=career;
 const [automaticCheckpoint,setAutomaticCheckpoint]=useState(()=>{
  try{
   const checkpoint=parseRecoverySave(localStorage.getItem(AUTO_RECOVERY_SAVE_KEY),JOBS.length);
   return checkpoint?.jobIndex===career.job&&checkpoint.career.selected===career.selected&&
    checkpointSiteCompatible(checkpoint,JOBS.length)?checkpoint:null;
  }catch{return null;}
 });
 const pendingRestore=useRef(null);
 const [restoreSequence,setRestoreSequence]=useState(0),[showFrontWinch,setShowFrontWinch]=useState(false);
 const [savedCheckpoint,setSavedCheckpoint]=useState(()=>{
  try{return parseRecoverySave(localStorage.getItem(RECOVERY_SAVE_KEY),JOBS.length)}catch{return null}
 });
 const [settingsOpen,setSettingsOpen]=useState(false),[mapOpen,setMapOpen]=useState(false),[menuOpen,setMenuOpen]=useState(false),[recoveryOpen,setRecoveryOpen]=useState(true);const [settings,setSettings]=useState(()=>{try{return {steering:1,boom:1,winch:1,driveMode:'joystick',soundMuted:false,soundVolume:.7,...JSON.parse(localStorage.getItem('towing-controls')||'{}')}}catch{return {steering:1,boom:1,winch:1,driveMode:'joystick',soundMuted:false,soundVolume:.7}}});const settingsRef=useRef(settings);settingsRef.current=settings;const changeSetting=(key,value)=>setSettings(old=>{const next={...old,[key]:value};settingsRef.current=next;try{localStorage.setItem('towing-controls',JSON.stringify(next))}catch{}return next;});
 const [activeRecoveryLine,setActiveRecoveryLine]=useState(0),[winchSpeed,setWinchSpeed]=useState('medium'),[placingAnchor,setPlacingAnchor]=useState(false);const [garage,setGarage]=useState(false),[notice,setNotice]=useState(''),[hydraulic,setHydraulic]=useState({x:0,y:0}),[boomStick,setBoomStick]=useState({x:0,y:0}),[cameraMode,setCameraMode]=useState('orbit'),[cameraPanelOpen,setCameraPanelOpen]=useState(false);
 const saveCareer=fn=>setCareer(old=>{const next=fn(old);careerRef.current=next;try{localStorage.setItem('towing-career',JSON.stringify(next))}catch{}return next;});
 const audioRef=useRef(null);
 useEffect(()=>{
  const audio=createGameAudio();audioRef.current=audio;
  const unlock=()=>{if(!settingsRef.current.soundMuted)audio.unlock();};
  const hide=()=>{if(document.hidden)audio.silence();};
  window.addEventListener('pointerup',unlock,true);window.addEventListener('click',unlock,true);window.addEventListener('keydown',unlock,true);
  document.addEventListener('visibilitychange',hide);window.addEventListener('blur',audio.silence);
  return()=>{window.removeEventListener('pointerup',unlock,true);window.removeEventListener('click',unlock,true);window.removeEventListener('keydown',unlock,true);document.removeEventListener('visibilitychange',hide);window.removeEventListener('blur',audio.silence);audio.close();audioRef.current=null;};
 },[]);
 const mount=useRef(null),sim=useRef(null),[hud,setHud]=useState({speed:0,gear:'D',hook:false,tension:0,winch:'IDLE'}),[help,setHelp]=useState(false),[steerVisual,setSteerVisual]=useState(0);
 useEffect(()=>{
  const save=()=>{
   const game=sim.current,activeCareer=careerRef.current;
   if(!game||game.jobDone||game.siteFailed||game.jobIndex!==activeCareer.job||game.type.id!==activeCareer.selected)return;
   try{
    if(!game.autosaveBaseline||game.autosaveActive<15)return;
     const next=captureRecoverySave(activeCareer,game);
     const baseline=game.autosaveBaseline;
     const moved=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)>=5;
     const changed=moved(next.truck.pos,baseline.truck.pos)||moved(next.vehicle.pos,baseline.vehicle.pos)||['hook','loaded','strapsOn','riggersDeployed','dropoffArrived','dropoffComplete','woodlandExtracted'].some(k=>next.equipment[k]!==baseline.equipment[k])||Math.abs(next.equipment.cableLength-baseline.equipment.cableLength)>=1||next.lines.some((l,i)=>l.connected!==baseline.lines[i].connected||Math.abs(l.spool-baseline.lines[i].spool)>=1)||next.frontWinch?.anchor!==baseline.frontWinch?.anchor||Math.abs((next.frontWinch?.spool??0)-(baseline.frontWinch?.spool??0))>=1||JSON.stringify(next.anchors)!==JSON.stringify(baseline.anchors);
     if(!changed)return;
     localStorage.setItem(AUTO_RECOVERY_SAVE_KEY,JSON.stringify(next));setAutomaticCheckpoint(next);
   }catch{}
  };
  const saveOnHide=()=>{if(document.hidden)save();};
  const timer=window.setInterval(save,6000);
  document.addEventListener('visibilitychange',saveOnHide);
  window.addEventListener('pagehide',save);
  return()=>{
   window.clearInterval(timer);
   document.removeEventListener('visibilitychange',saveOnHide);
   window.removeEventListener('pagehide',save);
  };
 },[]);
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  const scene=new THREE.Scene();scene.environment=reflectionSky(THREE);scene.environmentIntensity=.55;scene.background=new THREE.Color(0x9db2c2);scene.fog=new THREE.Fog(0x9db2c2,55,180);
  const camera=new THREE.PerspectiveCamera(62,1,.1,350);camera.position.set(9,7,12);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xdcecff,0x56604a,2.0));const sun=new THREE.DirectionalLight(0xfff0d8,2.4);sun.position.set(-25,38,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:100});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.035;scene.add(sun,sun.target);
  const levelIndex=careerRef.current.job%JOBS.length;
  const levelFour=levelIndex>=3;
  const lakeLevel=levelIndex===4,site=siteConfig(levelIndex);
  const terrainHeight=site?(x,z)=>siteHeight(levelIndex,x,z):lakeLevel?lakeHeight:levelFourHeight;
  const terrainSlope=site?(x,z)=>siteSlope(levelIndex,x,z):lakeLevel?lakeSlope:levelFourSlope;
  const terrainGravity=site?(x,z,k)=>siteGravity(levelIndex,x,z,k):lakeLevel?lakeDownhillAcceleration:levelFourDownhillAcceleration;
   const surfaceAt=pos=>sampleSurface(levelIndex,pos.x,pos.z);
   const supportGround=(x,z)=>{const y=levelFour?terrainHeight(x,z):-.12;return Math.abs(x)<=5&&z>=-126&&z<=54?Math.max(.04,y):y;};
  const terrainScene=site?createDispatchSite(THREE,scene,levelIndex):lakeLevel?createLakeScene(THREE,scene):levelFour?createLevelFourScene(THREE,scene):null;
  const ravineStartZ=site?site.start.z:levelFour?Math.min(-49,JOBS[careerRef.current.job%JOBS.length].z+15):7;
  if(levelFour){scene.fog.far=250;const sky=site?.kind==='desert'?0xceb99a:site?.kind==='terminal'?0xc4cbd0:site?.kind==='bridge'?0x9baebf:lakeLevel?0x9dc5d2:0xa3b6c1;scene.background.set(sky);scene.fog.color.set(sky);}
  if(!levelFour){const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:0x65734e,roughness:1,map:surfaceMap(THREE,70,70,78)}));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;ground.receiveShadow=true;scene.add(ground);}
  if(!site){
  const road=new THREE.Mesh(new THREE.BoxGeometry(10,.12,180),new THREE.MeshStandardMaterial({color:0x45494b,roughness:.95,map:surfaceMap(THREE,8,95,65)}));road.position.set(0,-.02,-36);road.receiveShadow=true;scene.add(road);
  const shoulder=new THREE.Mesh(new THREE.BoxGeometry(5,.16,180),new THREE.MeshStandardMaterial({color:0x85785d,roughness:1,map:surfaceMap(THREE,4,75,92)}));shoulder.position.set(7.1,-.07,-36);scene.add(shoulder);
  const ditch=new THREE.Mesh(new THREE.BoxGeometry(4,.55,28),new THREE.MeshStandardMaterial({color:0x4d5840}));ditch.position.set(10.5,-.38,-20);scene.add(ditch);
  addRoadsideDetails(THREE,scene,levelFour?terrainHeight:()=>-.12,levelFour);
  // Recessed ravine and tilted gravel shoulders for the advanced dispatches.
  if(!levelFour)for(const x of [-24,-14]){const bank=new THREE.Mesh(new THREE.BoxGeometry(5,.6,64),new THREE.MeshStandardMaterial({color:0x655a46,roughness:1}));bank.position.set(x,-.1,-78);bank.rotation.z=x<-20?-.19:.19;bank.receiveShadow=true;scene.add(bank);}
  if(!levelFour){const ravineFloor=new THREE.Mesh(new THREE.BoxGeometry(9,.12,63),new THREE.MeshStandardMaterial({color:0x4a4539,roughness:1}));ravineFloor.position.set(-19,-.26,-78);scene.add(ravineFloor);}
  for(const x of [-4.65,4.65]){const edge=new THREE.Mesh(new THREE.PlaneGeometry(.105,176),new THREE.MeshStandardMaterial({color:0xd9d6bd,roughness:.93}));edge.rotation.x=-Math.PI/2;edge.position.set(x,.045,-36);scene.add(edge);}
  for(let z=-120;z<40;z+=8){const dash=new THREE.Mesh(new THREE.BoxGeometry(.13,.025,3.4),new THREE.MeshBasicMaterial({color:0xe4dfc6}));dash.position.set(0,.06,z);scene.add(dash);}
  }
  const type=FLEET.find(t=>t.id===careerRef.current.selected)||FLEET[0];
  const truck=makeVehicle(scene,{name:'wrecker',kind:type.id,color:type.color,pos:V(site?.start.x??0,0,ravineStartZ),scale:type.id==='rotator'?1.13:type.id==='offroad'?1.24:1});
  const tools=type.tools;truck.userData.bed.visible=tools.includes('bed');
   if(type.id==='flatbed'){
     for(const wheel of truck.userData.wheels)if(wheel.position.z>0)wheel.position.z=3.65;
   }
  truck.userData.recoveryStructure.visible=tools.includes('boom');truck.userData.underliftPivot.visible=tools.includes('lift');for(const part of truck.userData.outriggers)part.visible=false;if(type.id==='light'){const outer=truck.userData.underliftPivot.getObjectByName('underlift outer stinger');outer.scale.z=.60;outer.position.z=.71;truck.userData.underliftInner.visible=false;}for(const o of truck.userData.body.children){if(o.name.startsWith('light-duty'))o.visible=type.id==='light';if(o.name.startsWith('outrigger'))o.visible=false;if(o.name==='underlift hinge housing')o.visible=tools.includes('lift');}
  const firstJob=JOBS[careerRef.current.job%JOBS.length];
  const tandemHelper=levelIndex===TANDEM_SITE_INDEX&&type.id==='rotator'?makeVehicle(scene,{name:'wrecker',kind:'medium',color:0xe0a52c,pos:V(TANDEM_HELPER.x,.04,TANDEM_HELPER.z)}):null;
  if(tandemHelper){tandemHelper.name='tandem support wrecker B';tandemHelper.rotation.y=-TANDEM_HELPER.yaw;const e=tandemHelper.userData;e.bed.visible=false;e.underliftPivot.visible=false;e.recoveryStructure.visible=true;e.boomTilt.rotation.x=-.40;tandemHelper.updateWorldMatrix(true,true);}
  const pickup=makeVehicle(scene,{name:'pickup',kind:firstJob.vehicle??(firstJob.kind==='flatbed'?'suv':firstJob.boxTruck?'delivery':'pickup'),color:firstJob.kind==='flatbed'?0xb8c6ce:firstJob.kind==='recovery'||firstJob.kind==='woodland'?0x8f4534:0x315c83,pos:V(firstJob.x,levelFour?terrainHeight(firstJob.x,firstJob.z):0,firstJob.z),scale:firstJob.kind==='recovery'||firstJob.kind==='woodland'?1.06:firstJob.boxTruck?1.15:.92});
  // Job-specific vehicles and recovery scenes, rather than reusing the same pickup.
  if(firstJob.kind==='tow'){
    // Parking lot with marked stalls, a sidewalk, and a tow-away sign.
    const lot=box(scene,'parking lot',[16,.08,17],[4,-.08,-19],0x3e4448);lot.receiveShadow=true;
    for(let i=-2;i<=2;i++)box(scene,'parking space line',[.10,.015,6],[i*2.7+4,.015,-18],0xe9e2ca);
    box(scene,'tow-away sign pole',[.12,2.4,.12],[10,1.14,-15],0xa8b0b6);
    box(scene,'tow-away sign',[1.4,.7,.12],[10,2.38,-15],0xe5ce6c);
  }else if(firstJob.kind==='flatbed'){
    // Disabled AWD crossover: longer body and contrasting roof, at a roadside pull-off.
    // The crossover now has its own sculpted roof, rear quarters and glazing.
    const pullOff=box(scene,'roadside transport bay',[8,.06,17],[3,-.065,-42],0x7d7970);pullOff.receiveShadow=true;
    for(let i=0;i<4;i++)box(scene,'transport bay stripe',[.25,.025,2],[6,.02,-48+i*4],0xeee7cc);
    box(scene,'loading zone marker',[.6,.10,1.4],[7,.08,-41],0xdec555);
  }else if(firstJob.kind==='recovery'){
    // Off-road pickup sunk into a cut ditch with marker posts and a damaged barrier.

    for(const z of [-36,-30,-24])box(scene,'ditch hazard post',[.14,1.25,.14],[7.3,.53,z],0xe0a435);
    const fallen=box(scene,'damaged guardrail',[.17,.19,6.7],[8,.52,-27],0xb4bab9);fallen.rotation.x=.24;
    const pose=ditchContactPose(firstJob.x,firstJob.z,-.18,pickup.userData.scale);pickup.position.y=pose.height;pickup.rotation.order='YXZ';pickup.rotation.x=pose.pitch;pickup.rotation.z=pose.roll;
  }
  const secondaryPickup=makeVehicle(scene,{name:'second disabled truck',kind:'delivery',color:0x985b3a,pos:V(firstJob.second?.x??-22,levelFour?terrainHeight(firstJob.second?.x??-22,firstJob.second?.z??-106):0,firstJob.second?.z??-106),scale:1.04});
  if(firstJob.kind==='heavy'){pickup.userData.rollHull=modelRollHull(THREE,pickup);secondaryPickup.userData.rollHull=modelRollHull(THREE,secondaryPickup);}
  secondaryPickup.visible=!!firstJob.second;
  const riggingAnchors=[{id:'direct',label:'DIRECT LINE',pos:null},{pos:null},{pos:null}];
  const anchorTrees=[],trunkMeshes=[];
  scene.updateMatrixWorld(true);
  scene.traverse(object=>{
    if(!object.isMesh||!(/trunk/i.test(object.name)))return;
    trunkMeshes.push(object);
    if(object.isInstancedMesh){
      const matrix=new THREE.Matrix4();
      for(let i=0;i<object.count;i++){
        object.getMatrixAt(i,matrix);
        anchorTrees.push(V().setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld));
      }
    }else anchorTrees.push(object.getWorldPosition(V()));
  });
  // Two movable player-created stakes: one for each heavy-recovery line.
  for(let i=0;i<2;i++){
    const marker=new THREE.Group();
    const stake=new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,1.15,10),new THREE.MeshStandardMaterial({color:i===0?0x56e1f0:0xf6b854}));
    stake.position.y=.57;stake.castShadow=true;marker.add(stake);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.75,.07,8,24),new THREE.MeshBasicMaterial({color:i===0?0x56e1f0:0xf6b854}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.08;marker.add(ring);
    const weight=new THREE.Mesh(new THREE.BoxGeometry(.78,.40,.64),stake.material);
    weight.position.y=.2;weight.visible=false;marker.add(weight);
    marker.visible=false;scene.add(marker);
    riggingAnchors.push({id:'placed'+i,label:'YOUR ANCHOR '+(i===0?'A':'B'),pos:null,marker});
  }
  const recoveryCables=[0,1].map(i=>{const geometry=cableBuffer();const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:i===0?0xf0b73b:0x55d3ec}));line.frustumCulled=false;line.visible=false;scene.add(line);return line;});
  const frontAnchors=site?.kind==='woodland'&&type.id==='offroad'?riggingAnchors:null;
  const loseAnchor=(s,slot)=>{
    if(!slot||!s.riggingAnchors[slot]?.pos)return;
    const anchor=s.riggingAnchors[slot];
    anchor.pos=null;anchor.marker.visible=false;
    if(s.frontWinch?.anchor===slot)s.frontWinch=makeFrontWinch();
    if(s.hookRedirect===slot){s.hook=false;s.hookRedirect=0;s.winch=false;s.winchOut=false;s.tension=0;}
    for(const line of s.recoveryLines)if(line.redirect===slot||line.secondRedirect===slot){
      line.connected=false;line.motor=0;line.tension=0;line.redirect=0;line.secondRedirect=0;
    }
    setNotice(anchor.label+' PULLED LOOSE. Choose a firmer spot or reduce the load.');
  };
  const overloadAnchor=(s,slot,load,neighbors,h)=>{
    const a=s.riggingAnchors[slot];
    if(!a?.pos||load<=(a.capacity??58000))return false;
    if(a.tree||!a.marker){loseAnchor(s,slot);return true;}
    const slip=anchorSlip(load,a.capacity??58000,a.travel??0,h);
    a.travel=slip.travel;
    const direction=V();
    for(const p of neighbors){if(p)direction.add(p.clone().sub(a.pos).normalize());}
    direction.y=0;
    if(direction.lengthSq()>1e-8){
      a.pos.addScaledVector(direction.normalize(),slip.distance);
      const y=levelFour?terrainHeight(a.pos.x,a.pos.z):a.marker.position.y;
      a.pos.y=y+.55;
      a.marker.position.set(a.pos.x,y,a.pos.z);
    }
    if(slip.failed)loseAnchor(s,slot);
    return true;
  };
  const frontCable=frontAnchors?new THREE.Line(cableBuffer(),new THREE.LineBasicMaterial({color:0x63e5ef})):null;
  if(frontCable){frontCable.visible=false;frontCable.frustumCulled=false;scene.add(frontCable);}
  const goals=site?.goals??[{x:firstJob.kind==='tow'||firstJob.kind==='flatbed'?0:2,z:firstJob.kind==='tow'||firstJob.kind==='flatbed'?23:firstJob.z,r:3.85}];
  const zones=goals.map((goal,i)=>{
    const ring=new THREE.RingGeometry(goal.r-.35,goal.r,48);
    ring.rotateX(-Math.PI/2);
    const woodland=site?.kind==='woodland',ground=woodland?terrainHeight(goal.x,goal.z):0;
    if(woodland){
      const position=ring.attributes.position;
      for(let j=0;j<position.count;j++)position.setY(j,terrainHeight(goal.x+position.getX(j),goal.z+position.getZ(j))-ground);
    }
    const zone=new THREE.Mesh(ring,new THREE.MeshBasicMaterial({color:i?0x56dff2:0x46ef9c,side:THREE.DoubleSide}));
    zone.position.set(goal.x,woodland?ground+.045:.12,goal.z);scene.add(zone);return zone;
  });
  const zone=zones[0];
  pickup.rotation.y=.18;
  // Pickup starts low in the soft ditch with a little yaw.
  const cableMat=new THREE.LineBasicMaterial({color:0xf3bd43});const cableGeo=cableBuffer();const cable=new THREE.Line(cableGeo,cableMat);cable.frustumCulled=false;scene.add(cable);cable.visible=false;
  const s={truck,pickup,zone,bladeDepth:0,bladeInput:0,sandSink:0,rearOverload:0,woodlandExtracted:false,woodlandBogged:false,frontAnchors,frontWinch:frontAnchors?makeFrontWinch():null,tandemHelper,helperState:tandemHelper?makeHelperState(V):null,tandemUsed:[false,false],tandemSelected:0,siteFailed:false,anchorPlacement:null,customHookPlacement:null,doubleAnchorSetup:false,levelFour,pos:V(site?.start.x??0,levelFour?terrainHeight(site?.start.x??0,ravineStartZ):0,ravineStartZ),vel:V(),yaw:0,steer:0,steerAngle:0,throttle:0,brake:0,hook:false,winch:false,winchOut:false,parkingBrake:false,boomDeployed:false,boomAngle:.36,boomSwing:0,boomExtension:0,boomControl:0,boomExtendControl:0,boomSwingControl:0,liftDeployed:false,liftHeight:0,liftExtension:0,liftControl:0,liftExtendControl:0,liftHydraulicX:0,liftHydraulicY:0,gridWidth:0,armsClosed:false,riggersDeployed:false,suspension:{pitch:0,roll:0,heave:0},support:null,padContacts:[],supportRatio:0,cableLength:14,tension:0,pickPos:V(firstJob.x,levelFour?terrainHeight(firstJob.x,firstJob.z):0,firstJob.z),pickVel:V(),pickYaw:-.18,pickYawVel:0,cameraYaw:0,cameraPitch:.24,presetYaw:0,presetPitch:0,zoom:truckCameraZoom(type),cameraMode:(site?.kind==='woodland'||site?.kind==='desert')?'chase':levelFour?'ravine':cameraMode,orbitFocus:'truck',drag:null,pointers:new Map(),lastHud:0,jobIndex:careerRef.current.job,jobDone:false,dropoffArrived:false,dropoffComplete:false,autoUnload:false,autoLoad:false,heavyRecovery:firstJob.kind==='heavy',loaded:false,strapsOn:false,bedTilt:false,bedSlide:0,bedProgress:0,bedSlideControl:0,bedTiltControl:0,recoveryDamage:0,bedContactLatch:false,rollbackLoadX:0,rollbackLoadYaw:0,rollbackLoadZ:0,rollbackBlocked:false,pickRoll:firstJob.roll??0,pickRollVel:0,secondary:{mesh:secondaryPickup,contactHull:secondaryPickup.userData.rollHull,active:!!firstJob.second,pos:V(firstJob.second?.x??-22,levelFour?terrainHeight(firstJob.second?.x??-22,firstJob.second?.z??-106):0,firstJob.second?.z??-106),vel:V(),yaw:firstJob.second?.yaw??-.1,yawVel:0,roll:firstJob.second?.roll??0,rollVel:0},recoveryCables,riggingAnchors,hookPoint:0,hookRedirect:0,winchSpeed,recoveryLines:[{connected:false,point:0,redirect:0,target:0,spool:20,motor:0,tension:0,doubled:false,strain:0,stalled:false,previousDistance:null},{connected:false,point:1,redirect:0,target:0,spool:20,motor:0,tension:0,doubled:false,strain:0,stalled:false,previousDistance:null}],type,tools};
  const towBar=type.id==='hercules'?box(scene,'articulated tow bar',[.15,.15,1],[0,0,0],0x666755):null;
  if(towBar)towBar.visible=false;
  const updateDust=towBar?trackedDust(THREE,scene):null;
  sim.current=s;
  if(firstJob.kind==='heavy'){pickup.rotation.order='YXZ';pickup.rotation.z=s.pickRoll;pickup.position.y=s.pickPos.y+rollContactOffset(pickup.userData.rollHull,s.pickRoll);secondaryPickup.rotation.order='YXZ';secondaryPickup.rotation.z=s.secondary.roll;secondaryPickup.position.y=s.secondary.pos.y+rollContactOffset(s.secondary.contactHull,s.secondary.roll);}
  if(levelFour)setCameraMode((site?.kind==='woodland'||site?.kind==='desert')?'chase':'ravine');
  const checkpoint=pendingRestore.current;
  const restoring=checkpoint?.jobIndex===s.jobIndex&&checkpoint.career.selected===s.type.id;
  if(restoring){
   if(checkpointSiteCompatible(checkpoint,JOBS.length)){restoreRecoverySave(s,checkpoint,V);setCameraMode(s.cameraMode);setWinchSpeed(s.winchSpeed);setNotice('SAVED JOB RESTORED: '+JOBS[s.jobIndex%JOBS.length].name+'.');}
   else setNotice('Site redesigned. Dispatch restarted; career cash and upgrades preserved.');
  }
  s.autosaveBaseline=captureRecoverySave(careerRef.current,s);s.autosaveActive=0;
   setActiveRecoveryLine(s.tandemSelected);
  setShowFrontWinch(hasFrontCable(s));
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};const ro=new ResizeObserver(resize);ro.observe(host);resize();
  let last=performance.now(),raf=0;
  const update=(now)=>{
   // Consume the checkpoint once the restored scene reaches its first frame.
   if(restoring&&pendingRestore.current===checkpoint)pendingRestore.current=null;
   const dt=Math.min(.033,(now-last)/1000);last=now;if(!document.hidden&&(Math.abs(s.throttle)>.1||s.vel.length()>.6||s.winch||s.winchOut||s.frontWinch?.motor||s.recoveryLines.some(l=>l.motor)||Math.abs(s.boomControl)>.1||Math.abs(s.liftControl)>.1||Math.abs(s.bladeInput)>.1||Math.abs(s.helperState?.throttle??0)>.1))s.autosaveActive+=dt;const steps=Math.max(1,Math.ceil(dt/(1/120)));const h=dt/steps;
   for(let n=0;n<steps;n++){
    const forward=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));const right=V(Math.cos(s.yaw),0,Math.sin(s.yaw));
    const truckSurface=surfaceAt(s.pos);
    // Ordinary driving and grounded winching have no unconstrained vertical velocity.
    s.vel.y=0;
    if(isDitchPull(s)){s.pickVel.y=0;s.pickPos.y=ditchContactPose(s.pickPos.x,s.pickPos.z,s.pickYaw,s.pickup.userData.scale).height;}
     const speed=s.vel.dot(forward),creeping=s.type.id==='flatbed'&&creepReady(s),heavy=s.type.id==='rotator';
    s.steerAngle=creeping?0:steeringStep(s.steerAngle,s.steer,settingsRef.current.steering,speed,h,heavy);
    const steerAngle=s.steerAngle;s.truck.userData.body.rotation.y=0;
    const tracked=s.type.id==='hercules';
    if(tracked&&s.parkingBrake)s.bladeDepth=clamp(s.bladeDepth+s.bladeInput*h*.65,0,1);
    const parked=s.bladeDepth>.02||s.parkingBrake||s.riggersDeployed||s.winch||s.winchOut||!liftTransportReady(s)||(s.type.id==='flatbed'&&!transportReady(s)&&!creeping);
    const offroad=s.type.id==='offroad';
    if(s.frontWinch){
      const bogged=woodlandBogged(s.woodlandBogged,truckSurface.bog??0,s.vel.length());
      if(bogged!==s.woodlandBogged){
        setNotice(bogged?'8×8 BOGGED DOWN. Select FRONT WINCH, place an anchor ahead and connect. Release PARK BRAKE to pull free.':'8×8 CLEAR OF THE RUTS. Unhook the front line before driving on.');
        s.woodlandBogged=bogged;
      }
    }
    if(tracked)s.sandSink=clamp(s.sandSink+h*((truckSurface.sand??0)*Math.abs(s.throttle)*.28-.16),0,.38);
    const traction=s.woodlandBogged?0:Math.min(1,truckSurface.traction*(offroad?1.32:1));
    const engine=(heavy?3.15:offroad?4.7:5.8)+careerRef.current.engine*(heavy?.55:1.2);
    const nextSpeed=parked||s.brake?brakeStep(speed,18,h):creeping?(s.throttle>0?speed+2.4*h:brakeStep(speed,4,h)):speed+(s.throttle*engine*traction*(tracked?(s.loaded?.62:1)*(1-s.sandSink):1)-speed*(tracked&&s.loaded?.48:.22))*h;
    const accel=h>0?(nextSpeed-speed)/h:0;
    s.vel.addScaledVector(forward,nextSpeed-speed);
    if(levelFour){const hill=terrainGravity(s.pos.x,s.pos.z,.40);
      s.vel.x+=hill.x*h;s.vel.z+=hill.z*h;}
    const side=s.vel.dot(right);s.vel.addScaledVector(right,-side*(1-Math.exp(-12.5*truckSurface.lateralGrip*h)));
    s.vel.multiplyScalar(Math.pow(.985,h*60)*Math.exp(-Math.max(0,truckSurface.drag-.36)*.50*h));
    const wheelbase=heavy?3.1:s.type.id==='flatbed'?5.20:offroad?4.3:2.9;
    const yawRate=parked?0:tracked?trackMotion(s.throttle,s.steer,speed,traction).yaw:clamp((s.vel.dot(forward)/wheelbase)*Math.tan(steerAngle)*truckSurface.traction,heavy?-.95:-1.55,heavy?.95:1.55);s.yaw+=yawRate*h;
    // Keep the velocity aligned with the turning chassis instead of dragging sideways.
    if(heavy&&!parked)s.vel.applyAxisAngle(V(0,1,0),-yawRate*h);
    if(hasFrontCable(s)){
      const anchor=s.frontAnchors[s.frontWinch.anchor];
      const step=frontWinchStep(s.frontWinch,frontWinchHead(s),anchor.pos,parked,h,1.4*settingsRef.current.winch);
      s.frontWinch.spool=step.spool;s.frontWinch.tension=step.tension;
      s.frontWinch.stalled=step.stalled;s.frontWinch.previousDistance=step.previousDistance;
      // Idle steel line restrains outward motion; only powered reeling pulls the truck.
      const head=frontWinchHead(s),delta=head.clone().sub(anchor.pos),distance=delta.length();
      const breakingLoad=48000; // gameplay rating, separate from drum pull limit
      const demand=Math.max(0,distance-step.spool)*7200*Math.max(.70,Math.min(1.50,20/Math.max(1,step.spool)));
      const outward=delta.clone();outward.y=0;
      if(outward.lengthSq()>1e-8)outward.normalize();
      const radial=s.vel.dot(outward);
      const load=Math.max(step.tension,demand+Math.max(0,radial)*1000);
      if(load>=breakingLoad&&breakingLoad<=(anchor.capacity??58000)){
        s.frontWinch=makeFrontWinch();
        setNotice('FRONT WINCH CABLE SNAPPED. Reconnect to recover.');
      }else if(!overloadAnchor(s,s.frontWinch.anchor,load,[head],h)){
        if(s.frontWinch.motor>0){s.vel.x+=step.x;s.vel.z+=step.z;}
        else if(s.frontWinch.motor===0&&distance>=step.spool-.05&&radial>0){
          // A fast impact can overload the line even before visible stretch develops.
          const shock=12000*radial/Math.max(.15,h);
          if(shock>=breakingLoad&&breakingLoad<=(anchor.capacity??58000)){
            s.frontWinch=makeFrontWinch();setNotice('FRONT WINCH CABLE SNAPPED. Reconnect to recover.');
          }else if(!overloadAnchor(s,s.frontWinch.anchor,Math.max(load,shock),[head],h)){
            s.vel.addScaledVector(outward,-radial);
          }
        }
      }
    }else if(s.woodlandBogged){
      s.vel.x=stopWinchCoast(s.vel.x,h);s.vel.z=stopWinchCoast(s.vel.z,h);
    }
    const max=hasFrontCable(s)?FRONT_WINCH_CRAWL:tracked?(s.loaded?3.6:7):offroad?11:heavy?15:20;
    const sp=s.vel.length();if(sp>max)s.vel.setLength(max);
    if(creeping){
      const advance=parked||s.brake||s.throttle<=0?0:clamp(s.vel.dot(forward),0,ROLLBACK_CREEP_SPEED);
      s.vel.copy(forward).multiplyScalar(advance);
      const local=rollbackLocal(s),d=deckFor(s),scale=s.pickup.userData.scale,angle=s.pickYaw-s.yaw;
      if(advance>0&&local.z<d.centerZ&&rollbackBedContact(d,local.x,local.z+advance*h,angle,scale)>1e-6){s.vel.set(0,0,0);recordBedContact(s,setNotice);}
    }
    s.pos.addScaledVector(s.vel,h);
    if(site){constrainSiteTruck(levelIndex,s.pos,s.vel);for(const o of terrainScene.obstacles){const dx=s.pos.x-o.x,dz=s.pos.z-o.z,d=Math.hypot(dx,dz),r=o.r+1.4;if(d>.001&&d<r){s.pos.x+=dx/d*(r-d);s.pos.z+=dz/d*(r-d);s.vel.multiplyScalar(.25);}}}
    if(levelIndex===3&&s.pos.x < -4.02&&s.pos.z < -40&&s.pos.z > -98&&!(s.pos.z>=-68&&s.pos.z<=-58)){
      // Roadside steel barrier stops the truck except at the broken crash gap.
      s.pos.x=-4.02;s.vel.x=Math.max(0,s.vel.x)*.13;
    }
    if(s.helperState){const a=s.helperState;
      const surface=surfaceAt(a.pos),e=s.tandemHelper.userData;
      const rollSpeed=stepHelper(a,h,surface,settingsRef.current.steering,careerRef.current.engine,steeringStep,brakeStep);
      constrainSiteTruck(levelIndex,a.pos,a.vel);
      for(const o of terrainScene.obstacles){const dx=a.pos.x-o.x,dz=a.pos.z-o.z,d=Math.hypot(dx,dz),r=o.r+1.4;if(d>.001&&d<r){a.pos.x+=dx/d*(r-d);a.pos.z+=dz/d*(r-d);a.vel.multiplyScalar(.25);}}
      a.pos.y=terrainHeight(a.pos.x,a.pos.z);s.tandemHelper.position.copy(a.pos);s.tandemHelper.rotation.y=-a.yaw;
      for(let i=0;i<e.wheels.length;i++){const w=e.wheels[i];w.rotation.order='YXZ';w.rotation.y=i<2?-a.steerAngle:0;w.rotation.x-=rollSpeed*h/.48;}
      if(a.parkingBrake&&a.vel.length()<.25){a.boomAngle=clamp(a.boomAngle+a.boomControl*h*.80*settingsRef.current.boom,0,1.08);a.boomExtension=clamp(a.boomExtension+a.boomExtendControl*h*1.15*settingsRef.current.boom,0,2.2);}
      e.boomTilt.rotation.x=a.boomDeployed?-(.12+a.boomAngle):-.10;e.boomSleeve.position.z=2.49+a.boomExtension*.5;e.boomTip.position.z=3.25+a.boomExtension;s.tandemHelper.updateWorldMatrix(true,true);
    }
    s.pos.y=levelFour?terrainHeight(s.pos.x,s.pos.z):0;
    // Truck wheel spin and steering articulation.
    for(let i=0;i<s.truck.userData.wheels.length;i++){const w=s.truck.userData.wheels[i];w.rotation.y=0;w.rotation.order='YXZ';w.rotation.y=i<(offroad?4:2)?-steerAngle:0;w.rotation.x-=s.vel.dot(forward)*h/(.48*s.truck.userData.scale);}
    s.truck.position.copy(s.pos);s.truck.rotation.order='YXZ';s.truck.rotation.y=-s.yaw;
    if(levelFour){const grade=chassisGrade(terrainSlope(s.pos.x,s.pos.z),s.yaw);
      s.truck.rotation.x=grade.pitch;s.truck.rotation.z=grade.roll;
    }
    const equip=s.truck.userData;
    if(heavy&&levelFour){
      s.truck.updateWorldMatrix(true,false);
      for(const wheel of equip.wheels){
       const base=s.truck.localToWorld(V(wheel.position.x,.62*equip.scale,wheel.position.z));
       const ground=supportGround(base.x,base.z),desired=ground+.48*equip.scale;
       wheel.position.y=.62*equip.scale+clamp(desired-base.y,-.24,.24);
      }
    }
    // Only the rotator's chassis moves on its suspension for now: the
    // rollback and wheel-lift loading constraints retain their exact geometry.
    if(s.type.id==='rotator'){
     s.suspension=suspensionStep(s.suspension,s.riggersDeployed?0:accel,s.riggersDeployed?0:speed*yawRate,s.riggersDeployed?s.support:null,h,s.riggersDeployed);
     equip.body.rotation.x=s.suspension.pitch;equip.body.rotation.z=s.suspension.roll;equip.body.position.y=s.suspension.heave;
    }
    // Held hydraulic controls integrate over time, even without pointer-move events.
    if((s.parkingBrake||s.riggersDeployed)&&s.vel.length()<.25){
      if(s.boomDeployed){
        s.boomAngle=clamp(s.boomAngle+s.boomControl*h*.80*settingsRef.current.boom,0,1.08);
        s.boomExtension=clamp(s.boomExtension+s.boomExtendControl*h*1.15*settingsRef.current.boom,0,2.2);
        if(s.type.id==='rotator')s.boomSwing=clamp(s.boomSwing+s.boomSwingControl*h*.8*settingsRef.current.boom,-1.1,1.1);
      }
    }
    // Both wheel lifts can be positioned at walking speed before capturing an axle.
    if(s.liftDeployed&&liftMotionReady(s)){
      s.liftHeight=clamp(s.liftHeight+(s.liftControl+s.liftHydraulicY)*h*.70*settingsRef.current.boom,s.strapsOn&&s.loaded?Math.min(.45,s.liftHeight):0,1.25);
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
    const isRollback=s.type.id==='flatbed';
     if(isRollback){
      const step=rollbackHydraulicStep(s.bedSlide,s.bedProgress,s.bedSlideControl,s.bedTiltControl,h*settingsRef.current.boom,s.parkingBrake&&s.vel.length()<.25&&(!s.hook||s.loaded)&&(!s.loaded||s.strapsOn));
      const moving=step.slide!==s.bedSlide||step.tilt!==s.bedProgress,local=rollbackLocal(s);
      if(moving&&!s.loaded&&!s.hook&&rollbackBedMotionBlocked(deckFor(s),rollbackDeck(step.slide,step.tilt),local.x,local.z,s.pickYaw-s.yaw,s.pickup.userData.scale)){
       recordBedContact(s,setNotice);s.bedSlideControl=0;s.bedTiltControl=0;
      }else{s.bedSlide=step.slide;s.bedProgress=step.tilt;s.bedTilt=step.tilt>.001;}
     }
     const deck=deckFor(s);
     equip.bed.rotation.x=deck.angle;
     equip.bed.position.set(0,deck.centerY-.11*Math.cos(deck.angle),deck.centerZ-.11*Math.sin(deck.angle));
     if(isRollback){equip.bed.updateWorldMatrix(true,true);s.pickup.updateWorldMatrix(true,true);}
    s.padContacts=[];
    if(equip.supportPads.length){
      equip.body.updateWorldMatrix(true,false);
      const inverse=equip.body.getWorldQuaternion(new THREE.Quaternion()).invert();
      for(let i=0;i<equip.supportPads.length;i++){
       const {arm,foot,jack,pad}=equip.supportPads[i];
       arm.visible=foot.visible=jack.visible=s.riggersDeployed;
       if(!s.riggersDeployed)continue;
       const top=equip.body.localToWorld(V(pad.x,.88,pad.z));
       const ground=supportGround(top.x,top.z),contact=padContact(top.y,ground);
       const bottom=V(top.x,contact.footY,top.z);
       foot.position.copy(equip.body.worldToLocal(bottom.clone()));foot.quaternion.copy(inverse);
       const a=equip.body.worldToLocal(top.clone()),b=equip.body.worldToLocal(bottom.clone().add(V(0,.07,0))),delta=a.clone().sub(b);
       jack.position.copy(a).addScaledVector(delta,-.5);jack.scale.y=Math.max(.05,delta.length());jack.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());
       const load=(s.support?.loads[i]??0)/(23000*9.81/4);
       foot.material.color.setHex(!contact.contact?0xb6402f:load>1.65?0xe7882f:load<.25&&s.support?0x7f8587:0xe0b340);
       s.padContacts.push({contact:contact.contact,traction:surfaceAt(bottom).traction});
      }
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
        const a=V(side*.36,.88,liftBase(s)-.56);
        const b=equip.body.worldToLocal(equip.underliftPivot.localToWorld(V(side*.28,0,1.05)));
        const d=b.clone().sub(a);
        mesh.position.copy(a).addScaledVector(d,.5);
        mesh.quaternion.setFromUnitVectors(V(0,1,0),d.clone().normalize());
        mesh.scale.y=d.length();
        mesh.visible=s.tools.includes('lift');
      }
      const hitchZ=liftHitchDistance(s);
      for(const strap of equip.straps){
        strap.visible=s.strapsOn&&s.tools.includes('lift');
        strap.position.y=1.18-Math.sin(pitch)*liftReach(s)+.13;
        strap.position.z=hitchZ;
      }
    }
    if(levelFour&&!s.loaded&&!s.siteFailed){
      // Surface gravity makes uphill pulls resist the winches.
      const g=terrainGravity(s.pickPos.x,s.pickPos.z,.36);
      s.pickVel.x+=g.x*h;s.pickVel.z+=g.z*h;
      if(s.secondary.active){const g2=terrainGravity(s.secondary.pos.x,s.secondary.pos.z,.36);
        s.secondary.vel.x+=g2.x*h;s.secondary.vel.z+=g2.z*h;}
    }
    // Recovery ropes apply translation, yaw and roll at their actual world-space eyes.
    let primaryYawMoment=0;
    let primaryPowered=false;
    const damagedTrack=!!s.pickup.userData.tracks;
    if(s.type.id==='rotator'){
      const targets=[{...primaryRecoveryTarget(s),vel:s.pickVel,yawRate:s.pickYawVel,rollRate:s.pickRollVel,mass:JOBS[s.jobIndex%JOBS.length].weight||12},{pos:s.secondary.pos,vel:s.secondary.vel,yaw:s.secondary.yaw,roll:s.secondary.roll,contactHull:s.secondary.contactHull,yawRate:s.secondary.yawVel,rollRate:s.secondary.rollVel,mass:11}];
      const torques=[0,0],yawMoments=[0,0],forces=[V(),V()],truckReaction=V(),wrench={x:0,y:0,z:0,mx:0,mz:0};
      const supportOrigin=s.pos.clone().add(V(0,0,.175).applyAxisAngle(V(0,1,0),-s.yaw));
      for(let i=0;i<2;i++){
        const line=s.recoveryLines[i],rope=s.recoveryCables[i],target=targets[line.target];
        if(!line.connected||!lineOwner(s,i).boomDeployed||(line.target===1&&!s.secondary.active)){rope.visible=false;line.tension=0;line.strain=0;line.stalled=false;line.previousDistance=null;continue;}
        const point=selectedRecoveryPoint(s,line),anchor=recoveryAnchor(target,point);
        const head=recoveryHead(s,i);
        const guide=s.riggingAnchors[line.redirect].pos;
        const second=line.secondRedirect?s.riggingAnchors[line.secondRedirect].pos:null;
        const route=lineRoute(head,anchor,guide,second,line.doubled?truckReturn(s,i):null);
        const geometry=cableGeometry(route,line.doubled);
        const distance=geometry.distance,direction=V(geometry.force.x,geometry.force.y,geometry.force.z);
        const pathSpeed=cablePathSpeed(distance,line.previousDistance,h);
        line.previousDistance=distance;
        const contacts=s.padContacts.filter(p=>p.contact).length;
        const helperLine=isSupportLine(s,i),limit=lineLimit(s,i);if(helperLine)s.helperState.supportRatio=0;
        const owner=lineOwner(s,i),safe=!s.siteFailed&&linePowerReady(s,i)&&(helperLine||contacts>=2);
        const stabilitySpeed=helperLine?.70:(contacts<4||(s.support?.ratio??0)>=.95)?.40:1;
        const prior=cableLoad(distance,line.spool,pathSpeed,limit);
        if(!s.siteFailed&&(safe||(line.motor<0&&owner.parkingBrake&&(helperLine||owner.riggersDeployed)))&&line.motor!==0)line.spool=cableReelStep(line.spool,line.motor,(2.1+careerRef.current.winch*.35)*settingsRef.current.winch*winchSpeedFactor(s.winchSpeed)*(line.motor>0?stabilitySpeed:1),h,prior.tension,limit);
        const offset=anchor.clone().sub(target.pos).sub(V(0,target.contactHull?rollContactOffset(target.contactHull,target.roll):.65,0));
        // A braked idle drum still carries load. The meter shows line tension,
        // while the chassis receives the vector sum of the supporting legs.
        const load=cableLoad(distance,line.spool,pathSpeed,limit),pull=load.tension;
        if(guide&&overloadAnchor(s,line.redirect,redirectLoad(pull,head,guide,second??anchor),[head,second??anchor],h)){if(line.connected)line.tension=pull;continue;}
        if(second&&overloadAnchor(s,line.secondRedirect,redirectLoad(pull,guide??head,second,anchor),[guide??head,anchor],h)){if(line.connected)line.tension=pull;continue;}
        if(s.tandemHelper)noteTandemUse(s.tandemUsed,i,line.motor,pull);
        line.tension=pull;line.strain=load.strain;line.stalled=line.motor>0&&load.stalled;
        if(pull>0){
          const reaction=supportReaction(route,pull,line.doubled);if(!helperLine){truckReaction.add(V(reaction.x,reaction.y,reaction.z));const moment=supportWrench(route,pull,line.doubled,supportOrigin,s.yaw);for(const key of Object.keys(wrench))wrench[key]+=moment[key];}else if(owner.parkingBrake){const support=supportState(reaction,surfaceAt(owner.pos).traction,false,12000);owner.supportRatio=support.ratio;owner.vel.x+=support.ax*h;owner.vel.z+=support.az*h;}
          const axis=V(Math.cos(target.yaw),0,Math.sin(target.yaw));
          const cx=point.x*Math.cos(target.roll)-point.y*Math.sin(target.roll);
          const cy=point.x*Math.sin(target.roll)+point.y*Math.cos(target.roll);
          torques[line.target]+=(cx*direction.y-cy*direction.dot(axis))*pull/(target.mass*8200);
          // Sum both lines before integrating, so neither line gets priority.
          yawMoments[line.target]+=recoveryYawMoment(offset,direction,pull);
          forces[line.target].addScaledVector(V(direction.x,0,direction.z),pull);
        }
      }
      s.support=s.riggersDeployed?outriggerLoads(wrench,s.padContacts):null;
      const support=supportState(truckReaction,s.support?Math.min(truckSurface.traction,s.support.grip):truckSurface.traction,s.riggersDeployed);
      s.supportRatio=support.ratio;
      if(s.riggersDeployed&&s.parkingBrake){
       // Bounded creep under excess horizontal reaction; no automatic tip-over.
       s.vel.x+=support.ax*h;s.vel.z+=support.az*h;
      }
      for(let i=0;i<targets.length;i++)if((i===0&&!s.loaded)||(i===1&&s.secondary.active))targets[i].vel.addScaledVector(forces[i],h/(targets[i].mass*(levelFour?1350:3100)));
      primaryYawMoment=yawMoments[0];
      primaryPowered=s.recoveryLines.some(l=>l.connected&&l.target===0&&l.motor>0);
      if(!primaryPowered){s.pickVel.x=stopWinchCoast(s.pickVel.x,h);s.pickVel.z=stopWinchCoast(s.pickVel.z,h);}
      if(!s.siteFailed){
        const roll=recoveryRollStep(targets[0].contactHull,s.pickRoll,s.pickRollVel,torques[0],h);
        s.pickRoll=roll.roll;s.pickRollVel=roll.velocity;
      }
      if(s.secondary.active){
        const secondaryPowered=s.recoveryLines.some(l=>l.connected&&l.target===1&&l.motor>0);
        s.secondary.yawVel=recoveryYawStep(s.secondary.yawVel,yawMoments[1],targets[1].mass,h,secondaryPowered);
        s.secondary.yaw+=s.secondary.yawVel*h;
        if(!secondaryPowered){s.secondary.vel.x=stopWinchCoast(s.secondary.vel.x,h);s.secondary.vel.z=stopWinchCoast(s.secondary.vel.z,h);}
        if(!s.siteFailed){
          const roll=recoveryRollStep(targets[1].contactHull,s.secondary.roll,s.secondary.rollVel,torques[1],h);
          s.secondary.roll=roll.roll;s.secondary.rollVel=roll.velocity;
        }
        const ground=recoverySurfaceVelocity(s.secondary.vel.x,s.secondary.vel.z,s.secondary.yaw,s.secondary.roll,h,surfaceAt(s.secondary.pos));
        s.secondary.vel.x=ground.x;s.secondary.vel.z=ground.z;
        s.secondary.pos.addScaledVector(s.secondary.vel,h);
        if(levelFour)s.secondary.pos.y=terrainHeight(s.secondary.pos.x,s.secondary.pos.z);
      }
    }
    // Ditch resistance and recovery vehicle interaction.
    const pa=isRollback?rollbackHead(s):s.tools.includes('boom')&&equip.boomTip?equip.boomTip.getWorldPosition(V()):s.pos.clone().add(V(0,1.1,0)).add(forward.clone().multiplyScalar(-2.3));
    const pb=isRollback?rollbackEye(s):ordinaryEye(s);
    const guide=s.riggingAnchors[s.hookRedirect].pos;
    const dist=linePathLength(pa,pb,guide);
    const dir=pb.clone().sub(guide||pa).normalize();
    if(s.hook){
       const ready=standardWinchReady(s);
       const pulling=s.winch&&!s.winchOut&&ready&&(!isRollback||rollbackLocal(s).z>rollbackStop(deck)+.015);
       const motor=pulling?1:s.winchOut&&ready?-1:0;
       const pathSpeed=cablePathSpeed(dist,s.previousCableDistance,h);
       s.previousCableDistance=dist;
       const speed=(motor<0?3.2:2.4+careerRef.current.winch*.8)*settingsRef.current.winch*winchSpeedFactor(s.winchSpeed);
       const line=standardWinchStep({distance:dist,spool:s.cableLength,pathSpeed,hold:ready||!isRollback,motor,speed,seconds:h,min:isRollback?.55:3.2});
       s.cableLength=line.spool;s.tension=line.tension;s.cableStrain=line.strain;s.cableStalled=pulling&&line.stalled;
       const drivingOverload=!s.parkingBrake&&Math.abs(s.throttle)>.1&&line.stalled;
       s.rearOverload=drivingOverload?s.rearOverload+h:Math.max(0,s.rearOverload-2*h);
       if(!isRollback&&(cableBreaks(dist,line.spool,pathSpeed,32000)||s.rearOverload>.8)){
        s.hook=false;s.winch=false;s.winchOut=false;s.tension=0;s.cableStrain=0;s.cableStalled=false;s.rearOverload=0;
        setNotice('REAR CABLE FAILED UNDER LOAD. Stop and reconnect after repositioning.');
       }
       if(tracked&&s.hook&&s.tension>(10000+39000*s.bladeDepth*truckSurface.traction)){
        s.bladeDepth=Math.max(0,s.bladeDepth-h*.35);
        if(s.bladeDepth<=.25){s.hook=false;s.winch=false;s.tension=0;setNotice('Ground blade pulled loose. Reposition on firmer ground.');}
       }
       if(!pulling&&s.tension===0){s.pickVel.x=stopWinchCoast(s.pickVel.x,h);s.pickVel.z=stopWinchCoast(s.pickVel.z,h);}
       if(guide&&overloadAnchor(s,s.hookRedirect,redirectLoad(s.tension,pa,guide,pb),[pa,pb],h))s.tension=0;
       if(s.tension>0&&!s.loaded&&(!isRollback||pulling)){
         if(!damagedTrack||pulling||!s.parkingBrake){
          const pull=groundCableDelta(dir.clone().negate(),s.tension,damagedTrack?15000:2350,h);
          s.pickVel.x+=pull.x;s.pickVel.z+=pull.z;s.pickVel.y=0;
         }
         if(!guide&&!isRollback){const reaction=groundCableDelta(dir,s.tension,tracked?65000:6200,h);s.vel.x+=reaction.x;s.vel.z+=reaction.z;}
         if(!isRollback){const offset=pb.clone().sub(s.pickPos).sub(V(0,.65,0));primaryYawMoment+=recoveryYawMoment(offset,dir.clone().negate(),s.tension);primaryPowered=pulling;}
       }
     } else {s.tension=0;s.cableStrain=0;s.cableStalled=false;s.previousCableDistance=null;s.rearOverload=0;}
    if(!s.loaded&&!isRollback){
       s.pickYawVel=recoveryYawStep(s.pickYawVel,primaryYawMoment,JOBS[s.jobIndex%JOBS.length].weight||12,h,primaryPowered);
      s.pickYaw+=s.pickYawVel*h;
    }else if(s.loaded||!isRollback||!s.hook)s.pickYawVel=0;
    if(s.loaded){if(isRollback){
       s.pickPos.copy(s.pos).addScaledVector(right,s.rollbackLoadX).addScaledVector(forward,-rollbackStop(deck)-s.rollbackLoadZ);
       s.pickYaw=s.yaw+(rollbackReverse(s)?Math.PI:0)+s.rollbackLoadYaw;
     }else{
      // Wheel-lift: hitch is fixed to the truck, and the trailing axle rolls behind it.
      // Never aim the car at the hitch: that causes 180-degree flips at rest.
      const hitchDistance=tracked?3.55:liftHitchDistance(s);const hitch=s.pos.clone().addScaledVector(forward,-hitchDistance);
      const drawbar=tracked?5.1:s.type.id==='offroad'?1.55*s.pickup.userData.scale:1.55;
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
    // Local rolling and tire-side resistance, including wet-bank and water drag.
    // A captured vehicle follows its existing lift/deck constraint instead.
    if(!s.loaded&&isRollback&&s.hook){
       const local=rollbackLocal(s),oldZ=local.z,oldX=local.x,scale=s.pickup.userData.scale;
       const edge=rollbackGroundLimit(deck,scale),enabled=s.parkingBrake&&rampReady(s);
       const reeling=enabled&&s.winch&&!s.winchOut&&s.tension>0;
       const paying=enabled&&s.winchOut&&!s.winch&&local.z<edge+1;
       if(reeling){
         const maxSpeed=1.8*winchSpeedFactor(s.winchSpeed);
         if(local.z>edge+1e-7){
           // Pull on the selected eye; the tires resist lateral scrub and the
           // cable moment turns the car. No scripted centering or yaw lerp.
           const ground=recoverySurfaceVelocity(s.pickVel.x,s.pickVel.z,s.pickYaw,0,h,surfaceAt(s.pickPos));
           s.pickVel.set(ground.x,0,ground.z);if(s.pickVel.length()>maxSpeed)s.pickVel.setLength(maxSpeed);
           s.pickYawVel=recoveryYawStep(s.pickYawVel,recoveryYawMoment(pb.clone().sub(s.pickPos),dir.clone().negate(),s.tension),JOBS[s.jobIndex%JOBS.length].weight,h,true);
           s.pickYaw+=s.pickYawVel*h;
           const step=rollbackApproachStep(deck,local.x,local.z,rollbackYawError(s),scale,s.pickVel.dot(right),-s.pickVel.dot(forward),h);
           local.x=step.x;local.z=step.z;
           if(step.blocked)s.pickVel.set(0,0,0);
         }else if(rollbackAligned(local.x,rollbackYawError(s),scale)){
           const speed=clamp(s.pickVel.dot(forward),0,maxSpeed);
           local.z=rollbackTravel(deck,local.z,speed*h);
           s.pickVel.copy(forward).multiplyScalar(speed);s.pickYawVel=0;
         }else{
           s.pickVel.set(0,0,0);s.pickYawVel=0;
           if(!s.rollbackBlocked)setNotice('RAMP MISALIGNED: unhook on the ground, level bed and reposition the truck. Both axles must line up.');
           s.rollbackBlocked=true;
         }
       }else if(paying){
         local.z=Math.min(edge+1,local.z+.7*h);s.pickVel.set(0,0,0);s.pickYawVel=0;s.rollbackBlocked=false;
       }else{s.pickVel.set(0,0,0);s.pickYawVel=0;if(!s.winch)s.rollbackBlocked=false;}
       if(local.z<=rollbackStop(deck)+.015){if(s.winch)local.z=rollbackStop(deck);s.pickVel.set(0,0,0);}
       s.pickPos.copy(s.pos).addScaledVector(right,local.x).addScaledVector(forward,-local.z);
       const carForward=V(Math.sin(s.pickYaw),0,-Math.cos(s.pickYaw));
       const travel=right.clone().multiplyScalar(local.x-oldX).addScaledVector(forward,oldZ-local.z).dot(carForward);
       for(const wheel of s.pickup.userData.wheels)wheel.rotation.x+=travel/(.48*scale);
     }
     if(!s.loaded&&!(isRollback&&s.hook)){
      if(damagedTrack){
       const speed=s.pickVel.length();
       const held=primaryPowered||s.hook&&!s.parkingBrake;
       if(speed>0)s.pickVel.multiplyScalar(damagedTrackSpeed(speed,surfaceAt(s.pickPos).sand??0,held,h)/speed);
      }
       const ground=recoverySurfaceVelocity(s.pickVel.x,s.pickVel.z,s.pickYaw,s.type.id==='rotator'?s.pickRoll:0,h,surfaceAt(s.pickPos));
      s.pickVel.x=ground.x;s.pickVel.z=ground.z;
      if(isDitchPull(s)){
        const contact=ditchGroundStep(s.pickPos,s.pickVel,s.pickYaw,s.pickup.userData.scale,h);
        s.pickPos.set(contact.x,contact.y,contact.z);s.pickVel.y=0;
        const travel=s.pickVel.dot(V(Math.sin(s.pickYaw),0,-Math.cos(s.pickYaw)))*h;
        for(const wheel of s.pickup.userData.wheels)wheel.rotation.x+=travel/(.48*s.pickup.userData.scale);
      }else{
        s.pickVel.y=0;s.pickPos.addScaledVector(s.pickVel,h);
        if(!levelFour&&!isRollback)s.pickPos.y=0;
      }
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
    if(!s.siteFailed){
      const chassisContact=(state,mesh,weight)=>({pos:state.pos,vel:state.vel,yaw:state.yaw,bounds:mesh.userData.collisionBounds,weight});
      const truckContact=chassisContact(s,s.truck,parked?0:.5);
      const onEquipment=s.loaded||(isRollback&&s.hook);
      const pickupRoll=s.type.id==='rotator'?s.pickRoll:0;
      const pickupContact={pos:s.pickPos,vel:s.pickVel,yaw:s.pickYaw,roll:pickupRoll,
        lift:s.type.id==='rotator'?rollContactOffset(s.pickup.userData.rollHull,pickupRoll):0,
        bounds:s.pickup.userData.collisionBounds,weight:onEquipment?0:1};
      const other=s.secondary;
      const secondContact=other.active?{...chassisContact(other,other.mesh,1),roll:other.roll,lift:rollContactOffset(other.contactHull,other.roll)}:null;
      const helper=s.helperState;
      const helperContact=helper?chassisContact(helper,s.tandemHelper,helper.parkingBrake?0:.7):null;
      if(!onEquipment){
        const rear=wheelLiftContactRear(truckContact,pickupContact,s.liftDeployed&&s.liftHeight<.38);
        resolveVehicleContact({...truckContact,rear},pickupContact);
      }
      if(secondContact){
        resolveVehicleContact(truckContact,secondContact);
        resolveVehicleContact(pickupContact,secondContact);
        if(levelFour)other.pos.y=terrainHeight(other.pos.x,other.pos.z);
      }
      if(helperContact){
        resolveVehicleContact(truckContact,helperContact);
        resolveVehicleContact(pickupContact,helperContact);
        constrainSiteTruck(levelIndex,helper.pos,helper.vel);
        helper.pos.y=terrainHeight(helper.pos.x,helper.pos.z);
        s.tandemHelper.position.copy(helper.pos);
      }
      if(site)constrainSiteTruck(levelIndex,s.pos,s.vel);
      if(levelFour){
        s.pos.y=terrainHeight(s.pos.x,s.pos.z);
        s.pickPos.y=terrainHeight(s.pickPos.x,s.pickPos.z);
      }else if(isDitchPull(s))s.pickPos.y=ditchContactPose(s.pickPos.x,s.pickPos.z,s.pickYaw,s.pickup.userData.scale).height;
      s.truck.position.copy(s.pos);
    }
    if(s.secondary.active){
      const other=s.secondary;
      other.mesh.position.copy(other.pos);
      other.mesh.position.y+=rollContactOffset(other.contactHull,other.roll);
      other.mesh.rotation.set(0,-other.yaw,other.roll,'YXZ');
    }
    if(site?.kind==='bridge'&&!s.siteFailed&&(bridgeEdgeExceeded(s.pickPos.x,s.pickPos.z)||(s.secondary.active&&bridgeEdgeExceeded(s.secondary.pos.x,s.secondary.pos.z)))){
      s.siteFailed=true;clearAutomaticCheckpoint(s.jobIndex);
      s.pickVel.set(0,0,0);s.secondary.vel.set(0,0,0);
      for(const l of s.recoveryLines){l.connected=false;l.motor=0;l.tension=0;}
      setNotice('RECOVERY FAILED: Vehicle crossed the bridge edge. MENU → RESTART JOB.');
    }
    // Heading comes from cable moments; terrain and drag affect translation.
    s.pickup.position.copy(s.pickPos);
    // A wheel-lift raises only the captured FRONT axle; the rear tires roll on the ground.
    // Flatbeds still lift the whole vehicle onto the deck.
    const localCar=isRollback?rollbackLocal(s):null;
     const onDeck=isRollback&&(s.loaded||(s.hook&&rollbackAligned(localCar.x,rollbackYawError(s),s.pickup.userData.scale)&&localCar.z>=rollbackStop(deck)-.1&&localCar.z<=rollbackGroundLimit(deck,s.pickup.userData.scale)));
     const carPose=onDeck?rollbackPose(deck,localCar.z,s.pickup.userData.scale,rollbackReverse(s)):{height:0,pitch:0};
     if(isRollback)s.pickPos.y=s.pos.y+rollbackContactHeight(carPose,s.pickup.userData.scale);
     s.pickup.position.y=isRollback?s.pickPos.y:(s.type.id==='rotator'?s.pickPos.y+rollContactOffset(s.pickup.userData.rollHull,s.pickRoll):s.pickPos.y);
     if(isRollback){s.pickup.rotation.order='YXZ';s.pickup.rotation.x=carPose.pitch;}
    if(s.pickup.userData.towPitchPivot){
      const frontAxleLift=s.loaded&&s.type.id!=='flatbed'?.20+s.liftHeight*.58:0;
      const wheelbase=3.10*s.pickup.userData.scale;
      s.pickup.userData.towPitchPivot.rotation.x=Math.atan2(frontAxleLift,wheelbase);
    }
    if(s.type.id==='rotator')s.pickup.rotation.order='YXZ';s.pickup.rotation.y=-s.pickYaw;s.pickup.rotation.z=s.type.id==='rotator'?s.pickRoll:0;
    if(isDitchPull(s)){const pose=ditchContactPose(s.pickPos.x,s.pickPos.z,s.pickYaw,s.pickup.userData.scale);s.pickup.rotation.order='YXZ';s.pickup.rotation.x=pose.pitch;s.pickup.rotation.z=pose.roll;}
    else if(site?.kind==='woodland'){
      const grade=chassisGrade(terrainSlope(s.pickPos.x,s.pickPos.z),s.pickYaw);
      s.pickup.rotation.set(grade.pitch,-s.pickYaw,grade.roll,'YXZ');
    }else if(!isRollback)s.pickup.rotation.x=0;
    for(const band of s.pickup.userData.tireBands)band.visible=s.loaded&&s.strapsOn&&s.tools.includes('lift');
    if(isRollback){
     s.pickup.updateWorldMatrix(true,true);equip.bed.updateWorldMatrix(true,false);
     const k=s.pickup.userData.scale;
     for(let i=0;i<equip.deckTies.length;i++){
      const tie=equip.deckTies[i],visible=s.loaded&&s.strapsOn;tie.webbing.visible=tie.ratchet.visible=tie.anchor.visible=visible;if(!visible)continue;
      const wheel=s.pickup.userData.wheels[i],center=equip.bed.worldToLocal(wheel.getWorldPosition(V()));
      const x=center.x+Math.sign(center.x)*.085*k,points=rollbackTieDownPath(x,center.y,center.z,k),attr=tie.webbing.geometry.attributes.position;
      for(let j=0;j<points.length;j++){const p=points[j];attr.setXYZ(j*2,p.x-.055,p.y,p.z);attr.setXYZ(j*2+1,p.x+.055,p.y,p.z);}
      attr.needsUpdate=true;tie.webbing.geometry.computeVertexNormals();
      tie.anchor.position.set(x,.135,points[0].z);tie.ratchet.position.set(x,.16,points.at(-1).z);
     }
    }
    const job=JOBS[s.jobIndex%JOBS.length];
    if(job.kind==='woodland'&&!s.woodlandExtracted&&s.hook&&s.winch&&woodlandOnFirmTrail(s.pickPos.x,s.pickPos.z)){
      s.woodlandExtracted=true;
      setNotice('TRUCK CLEAR OF THE MUD. Unhook, align the wheel lift, raise and strap the axle, then tow back to the trailhead.');
    }
    if((job.kind==='recovery'||job.kind==='woodland')&&s.loaded&&s.strapsOn&&!s.dropoffArrived&&inRecoveryBay(s,job)&&s.vel.length()<.25){s.dropoffArrived=true;setNotice(job.kind==='woodland'?'AT TRAILHEAD: Park, remove straps, lower the lift and open the L-arms.':'AT RECOVERY ZONE: Park, remove straps, lower lift, then open L-arms.');}
    if((job.kind==='tow'||job.kind==='flatbed')&&!s.dropoffArrived&&s.loaded&&s.strapsOn&&s.pos.distanceTo(V(0,0,23))<5&&s.vel.length()<.9){
      s.dropoffArrived=true;
      setNotice(job.kind==='flatbed'?'AT DEPOT: Park, slide back, tilt down, remove straps, winch out, unhook, creep clear and stow bed.':'AT DEPOT: Park, remove straps, lower the lift, then open L-arms to finish.');
    }
    const heavyClear=job.kind==='heavy'&&(site?siteRecoveryReady(levelIndex,{pos:s.pickPos,roll:s.pickRoll},s.secondary,s.siteFailed):Math.abs(s.pickRoll)<.28&&(!s.secondary.active||Math.abs(s.secondary.roll)<.28)&&s.pickPos.distanceTo(V(2,0,job.z))<7.5&&(!s.secondary.active||s.secondary.pos.distanceTo(V(2,0,job.z))<10));const reached=job.kind==='tracked'?s.loaded&&s.parkingBrake&&siteGoalReached(site.goals[0],s.pickPos,0):job.kind==='flatbed'?s.dropoffComplete&&s.parkingBrake&&s.vel.length()<.25&&rollbackStowed(s.bedSlide,s.bedProgress):job.kind==='tow'?s.pos.distanceTo(V(0,0,23))<5:job.kind==='heavy'?(s.tandemHelper?tandemComplete(s.tandemUsed,heavyClear):heavyClear):inRecoveryBay(s,job);
    if(!s.jobDone&&canCompleteJob(job.kind,{reached,loaded:s.loaded,strapped:s.strapsOn,hook:s.hook,recoveryConnected:s.recoveryLines.some(line=>line.connected),delivered:s.dropoffComplete})){
      s.jobDone=true;s.winch=false;s.winchOut=false;s.hook=false;
      for(const line of s.recoveryLines){line.connected=false;line.motor=0;line.tension=0;}
      const gross=JOBS[s.jobIndex%JOBS.length].pay,damage=job.kind==='flatbed'?s.recoveryDamage:0,reward=rollbackNetPay(gross,damage);
      clearAutomaticCheckpoint(s.jobIndex);
      // Completed jobs must not accidentally load an obsolete recovery checkpoint.
      try{const oldSave=parseRecoverySave(localStorage.getItem(RECOVERY_SAVE_KEY),JOBS.length);
       if(oldSave?.jobIndex===s.jobIndex){localStorage.removeItem(RECOVERY_SAVE_KEY);setSavedCheckpoint(null);}}
      catch{}
      saveCareer(p=>({...p,cash:p.cash+reward,completed:p.completed+1,job:p.job+1,selected:JOBS[(p.job+1)%JOBS.length].truck}));
      setNotice('JOB COMPLETE +$'+reward+(damage?' • Damage deduction $'+damage:'')+'! Next dispatch automatically loaded.');
    }
    if(n===steps-1){if(s.hook){const eye=isRollback?rollbackEye(s):ordinaryEye(s);updateWinchLine(cable,guide?[pa,guide,eye]:[pa,eye],s.cableLength,s.tension,supportGround);}else cable.visible=false;}
   }
   updateDust?.(s,now);
   if(s.truck.userData.tracks){
     const track=trackMotion(s.throttle,s.steer,s.vel.length(),1);
     const speed=s.vel.dot(V(Math.sin(s.yaw),0,-Math.cos(s.yaw)));
     const turn=s.parkingBrake||s.bladeDepth>.02?0:(track.left-track.right)*.75;
     const slip=s.parkingBrake?0:s.throttle*s.sandSink*3;
     moveTracks(THREE,s.truck.userData.tracks,speed+turn+slip,speed-turn+slip,dt);
     s.truck.userData.body.position.y=-s.sandSink;
     s.truck.userData.blade.position.y=.85-s.bladeDepth;
   }
   if(s.pickup.userData.tracks){
     const speed=s.loaded?s.vel.length():s.pickVel.length();
     moveTracks(THREE,s.pickup.userData.tracks,speed,0,dt);
   }
   if(towBar){
     towBar.visible=s.loaded;
     const a=s.pos.clone().add(V(-3.1*Math.sin(s.yaw),.72,3.1*Math.cos(s.yaw)));
     const b=s.pickPos.clone().add(V(3*Math.sin(s.pickYaw),.72,-3*Math.cos(s.pickYaw)));
     const d=b.clone().sub(a);towBar.position.copy(a).lerp(b,.5);towBar.scale.z=d.length();
     towBar.quaternion.setFromUnitVectors(V(0,0,1),d.normalize());
   }
   // Update visible cable curves only once per rendered frame, using the
   // final target and boom poses instead of the previous substep's positions.
   if(s.type.id==='rotator')for(let i=0;i<2;i++){
    const l=s.recoveryLines[i],rope=s.recoveryCables[i];
    if(!l.connected||!lineOwner(s,i).boomDeployed||(l.target===1&&!s.secondary.active)){rope.visible=false;continue;}
    const target=l.target===1?s.secondary:primaryRecoveryTarget(s);
    const route=lineRoute(recoveryHead(s,i),recoveryAnchor(target,selectedRecoveryPoint(s,l)),s.riggingAnchors[l.redirect].pos,l.secondRedirect?s.riggingAnchors[l.secondRedirect].pos:null,l.doubled?truckReturn(s,i):null);
    updateWinchLine(rope,route,l.spool,l.tension,supportGround);
   }
   if(frontCable){
     frontCable.visible=hasFrontCable(s);
     if(frontCable.visible)updateWinchLine(frontCable,[frontWinchHead(s),s.frontAnchors[s.frontWinch.anchor].pos],
       s.frontWinch.spool,s.frontWinch.tension,supportGround);
   }
   // Driving and recovery camera presets remain locked until CAM or ANGLES explicitly changes them.
   let presetFocus=null;const active=controlledTruck(s);
   if(s.cameraMode==='ravine'&&levelFour){
     const look=active.pos.clone().lerp(s.pickPos,s.tandemHelper?.28:.72);
     // Elevated roadside vantage frames the road, steep near wall, and wreck below.
     const viewTruck=active.pos;camera.position.set(viewTruck.x+(site?10:5.5),viewTruck.y+(site?15:11),viewTruck.z+8);
     presetFocus=V(look.x,site?look.y+1:look.y-2.5,look.z);
     camera.lookAt(presetFocus);
   }else if(s.cameraMode==='orbit'){
     const focus=s.orbitFocus==='hook'?s.pickPos.clone().add(V(0,1.2,0)):
       s.orbitFocus==='wide'?active.pos.clone().lerp(s.pickPos,.5).add(V(0,1.2,0)):
       active.pos.clone().add(V(0,1.2,0));
     const cy=Math.cos(s.cameraPitch),sy=Math.sin(s.cameraPitch);
     camera.position.copy(focus).add(V(Math.sin(s.cameraYaw)*cy*s.zoom,sy*s.zoom,Math.cos(s.cameraYaw)*cy*s.zoom));
     camera.lookAt(focus);
   }else{
     const pose=cameraPresetPose(s.cameraMode,{x:active.pos.x,z:active.pos.z},active.yaw,{x:s.pickPos.x,z:s.pickPos.z},s.zoom);
     if(s.cameraMode==='chase'&&s.type.id==='offroad'){
       pose.position.x+=2.4*Math.cos(active.yaw);
       pose.position.z+=2.4*Math.sin(active.yaw);
       pose.position.y+=.85;
     }
     const heightOffset=levelFour?(s.cameraMode==='hook'?s.pickPos.y:s.cameraMode==='wide'?(active.pos.y+s.pickPos.y)*.5:active.pos.y):0;
      camera.position.set(pose.position.x,pose.position.y+heightOffset,pose.position.z);
      presetFocus=V(pose.target.x,pose.target.y+heightOffset,pose.target.z);
      camera.lookAt(presetFocus);
   }
   // Touch orbit is an offset from the selected camera preset, not a mode switch.
   if(presetFocus){
     const delta=camera.position.clone().sub(presetFocus),baseRadius=Math.max(1,delta.length());
     const baseYaw=Math.atan2(delta.x,delta.z),basePitch=Math.asin(clamp(delta.y/baseRadius,-1,1));
     const yaw=baseYaw+s.presetYaw,pitch=clamp(basePitch+s.presetPitch,-1.35,1.48);
     const radius=baseRadius*(s.cameraMode==='ravine'?s.zoom/13:1),cosPitch=Math.cos(pitch);
     camera.position.copy(presetFocus).add(V(Math.sin(yaw)*cosPitch*radius,Math.sin(pitch)*radius,Math.cos(yaw)*cosPitch*radius));
     camera.lookAt(presetFocus);
   }
   // Apply after all camera presets and touch orbit offsets, so no mode can enter the terrain.
   const safeCamera=cameraGroundClearance(camera.position,supportGround);camera.position.y=safeCamera.y;
   if(presetFocus){presetFocus.y=Math.max(presetFocus.y,supportGround(presetFocus.x,presetFocus.z)+.75);camera.lookAt(presetFocus);}
   else if(s.cameraMode==='orbit'){const focus=s.orbitFocus==='hook'?s.pickPos.clone().add(V(0,1.2,0)):s.orbitFocus==='wide'?active.pos.clone().lerp(s.pickPos,.5).add(V(0,1.2,0)):active.pos.clone().add(V(0,1.2,0));focus.y=Math.max(focus.y,supportGround(focus.x,focus.z)+.75);camera.lookAt(focus);}
   if(now-s.lastHud>120){const sp=active.vel.length()*3.6;setHud({speed:sp,gear:active.throttle<-.1?'R':'D',hook:s.hook,tension:s.tension/1000,winch:s.winch?'REELING':'IDLE',parking:active.parkingBrake,riggers:active.riggersDeployed,boom:active.boomDeployed,lift:s.liftDeployed,range:active.pos.distanceTo(s.pickPos),mapX:active.pos.x,mapZ:active.pos.z,mapYaw:active.yaw,otherTruck:s.helperState?{x:(active===s?s.helperState:s).pos.x,z:(active===s?s.helperState:s).pos.z,yaw:(active===s?s.helperState:s).yaw}:null,roll:s.pickRoll,roll2:s.secondary.roll,secondX:s.secondary.pos.x,secondZ:s.secondary.pos.z,lineTensions:s.recoveryLines.map(l=>l.tension/1000),lineStrains:s.recoveryLines.map(l=>l.strain??0),lineStalls:s.recoveryLines.map(l=>!!l.stalled),cableStrain:s.cableStrain??0,cableStalled:!!s.cableStalled,carX:s.pickPos.x,carZ:s.pickPos.z,carYaw:s.pickYaw,loaded:s.loaded,liftHeight:s.liftHeight,armsClosed:s.armsClosed,strapsOn:s.strapsOn,gridContact:tireGridContact(s),recoverySurface:surfaceAt(s.pickPos).name,secondarySurface:s.secondary.active?surfaceAt(s.secondary.pos).name:null,truckSurface:surfaceAt(active.pos).name,supportRatio:active.supportRatio??0,padCount:s.support?.count??0,stabilityRatio:s.support?.ratio??0,padLoads:s.support?.loads.map(v=>Math.round(v/1000))??[]});s.lastHud=now;}
   audioRef.current?.update(s,dt,surfaceAt(s.pos),settingsRef.current.soundVolume,settingsRef.current.soundMuted,document.hidden||!document.hasFocus());
   const shadowFocus=s.pos.clone().lerp(s.pickPos,s.heavyRecovery?.30:.12);sun.target.position.copy(shadowFocus);sun.position.copy(shadowFocus).add(V(-25,38,20));
   if(terrainScene?.waterNormal){terrainScene.waterNormal.offset.x=(now*.000009)%1;terrainScene.waterNormal.offset.y=(now*.000006)%1;}
   renderer.render(scene,camera);raf=requestAnimationFrame(update);
  };raf=requestAnimationFrame(update);
  const heldDrivingKeys=new Set();
  const onKey=e=>{
   const down=e.type==='keydown',key=e.key.toLowerCase();
   if(down&&(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||
    e.target.closest?.('input,select,textarea,[contenteditable]')||
    key===' '&&e.target.closest?.('button')))return;
   const command=Object.hasOwn(drivingKeys,key)?drivingKeys[key]:key==='r'&&s.type.id!=='rotator'?['winch',1]:null;
   if(!command){
    if(down&&!e.repeat&&key==='h'&&s.type.id!=='rotator'&&s.type.id!=='flatbed'&&s.tools.includes('winch'))toggleHook();
    return;
   }
   if(down)heldDrivingKeys.add(key);
   else if(!heldDrivingKeys.delete(key))return;
   press(command[0],down?command[1]:0)(e);
  };
  const stopHeldControls=()=>{heldDrivingKeys.clear();s.bladeInput=0;if(s.frontWinch)s.frontWinch.motor=0;stopTruckInputs(s.helperState);s.bedSlideControl=0;s.bedTiltControl=0;s.throttle=0;s.steer=0;s.brake=0;s.winch=false;s.winchOut=false;s.boomControl=0;s.boomExtendControl=0;s.boomSwingControl=0;s.liftControl=0;s.liftExtendControl=0;s.liftHydraulicX=0;s.liftHydraulicY=0;for(const line of s.recoveryLines){line.motor=0;line.tension=0;}s.tension=0;s.pickVel.set(0,0,0);s.pickRollVel=0;s.pickYawVel=0;s.secondary.vel.set(0,0,0);s.secondary.rollVel=0;s.secondary.yawVel=0;};
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
      const treeHit=raycaster.intersectObjects(trunkMeshes,false)[0];
      if(!hit&&!treeHit){setNotice('Tap a tree trunk or a visible open spot on the ground.');return;}
      const index=s.anchorPlacement.lineIndex,target=typeof index==='number'&&s.recoveryLines[index].target===1&&s.secondary.active?s.secondary.pos:s.pickPos;
      const owner=typeof index==='number'?lineOwner(s,index):s;
      let tree=null;
      if(treeHit&&(!hit||raycaster.ray.origin.distanceTo(hit)>treeHit.distance)){
        if(treeHit.instanceId===undefined)tree=treeHit.object.getWorldPosition(V());
        else{
          const matrix=new THREE.Matrix4();treeHit.object.getMatrixAt(treeHit.instanceId,matrix);
          tree=V().setFromMatrixPosition(matrix).applyMatrix4(treeHit.object.matrixWorld);
        }
      }else if(hit)tree=anchorTrees.reduce((best,p)=>Math.hypot(p.x-hit.x,p.z-hit.z)<(best?Math.hypot(best.x-hit.x,best.z-hit.z):1.15)?p:best,null);
      const x=tree?.x??hit.x,z=tree?.z??hit.z;
      const y=levelFour?terrainHeight(x,z):hit.y;
      const point=V(x,y+(tree?.95:.55),z);
      const td=Math.hypot(x-owner.pos.x,z-owner.pos.z),vd=Math.hypot(x-target.x,z-target.z);
      if(index==='front'){
        const forward=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));
        if(!frontWinchReach(frontWinchHead(s),forward,point)){setNotice('Choose a spot ahead of the front bumper and within 20 m.');return;}
      }else if(td<4||td>32||vd<3||vd>32){setNotice('Anchor must be 4–32 m from truck and 3–32 m from vehicle.');return;}
      if(site?.kind==='bridge'&&(Math.abs(x)>6||z< -124||z> -54)){setNotice('Place the portable anchor on the bridge deck.');return;}
      if(terrainScene?.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+.2)&&!tree){setNotice('Choose a clear spot beside the obstacle.');return;}
      const slope=levelFour?terrainSlope(x,z):{x:0,z:0};
      const surface=surfaceAt(point);
      const ballast=!tree&&['CONCRETE','PAVEMENT','BRIDGE DECK','ICE','PACKED SNOW'].includes(surface.name);
      const capacity=anchorCapacity(surface,Math.hypot(slope.x,slope.z),!!tree);
      if(!capacity){setNotice('This ground will not hold an anchor. Try firmer or flatter terrain.');return;}
      const slot=s.anchorPlacement.slot,a=s.riggingAnchors[slot];
      a.pos=point;a.capacity=capacity;a.travel=0;a.tree=!!tree;a.ballast=ballast;a.marker.position.set(x,y,z);a.marker.visible=true;
      a.marker.children[0].visible=!tree&&!ballast;
      a.marker.children[2].visible=ballast;
      if(index===null)s.hookRedirect=slot;
      else if(typeof index==='number')s.recoveryLines[index].redirect=slot;
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
      setNotice((tree?'TREE SLING':ballast?'WEIGHTED ANCHOR':'GROUND ANCHOR')+' SET · '+Math.round(capacity/1000)+' kN'+(capacity<25000?' · WEAK HOLD':'')+(index==='front'?' · Connect the front winch to use it.':''));
      return;
    }
    s.pointers.delete(e.pointerId);s.drag=null;if(s.pointers.size<2)s.pinch=null;
  };
  renderer.domElement.addEventListener('pointerdown',onPointerDown);renderer.domElement.addEventListener('pointermove',onPointerMove);renderer.domElement.addEventListener('pointerup',onPointerUp);renderer.domElement.addEventListener('pointercancel',onPointerUp);
  return()=>{audioRef.current?.silence();cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onKey);window.removeEventListener('blur',stopHeldControls);document.removeEventListener('visibilitychange',onVisibilityChange);renderer.dispose();host.removeChild(renderer.domElement);const textures=new Set([scene.environment]);scene.traverse(o=>{o.geometry?.dispose?.();if(o.isInstancedMesh)o.dispose();if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material])){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}}});for(const texture of textures)texture?.dispose();};
 },[career.selected,career.job,restoreSequence]);
 const s=sim.current;
 const boomCanSwing=s?.type.id==='rotator'&&controlledTruck(s)===s;

 const press=(key,val)=>e=>{
  e.preventDefault();
  const s=sim.current;if(!s)return;
  if(s.tandemHelper&&['throttle','steer','brake'].includes(key)){
   const truck=controlledTruck(s);
   if(key==='throttle'&&val){const reason=tandemDriveBlock(s);if(reason){truck.throttle=0;setNotice(reason);return;}}
   truck[key]=val;return;
  }
  if((key==='winch'||key==='winchOut')&&val&&!standardWinchReady(s)){
   setNotice('Park, set up the boom or ramp, and connect the winch first.');return;
  }
  if(key==='throttle'&&!val)s.bedContactLatch=false;
  s[key]=val;
 };
 const joystickMove=e=>{const el=e.currentTarget,rect=el.getBoundingClientRect(),dx=(e.clientX-(rect.left+rect.width/2))/(rect.width*.42);const steer=clamp(dx*settingsRef.current.steering,-1,1);setSteerVisual(steer);if(sim.current)controlledTruck(sim.current).steer=clamp(dx,-1,1);};
 const joystickStop=e=>{e.preventDefault();setSteerVisual(0);if(sim.current)controlledTruck(sim.current).steer=0;};
 const setBoomControl=(axis,d)=>{const game=sim.current;if(!game)return;const s=controlledTruck(game);if(d===0){s[axis]=0;return;}if(!game.tools.includes('boom')||!s.boomDeployed||(!s.parkingBrake&&!s.riggersDeployed)){setNotice('Apply PARK BRAKE or deploy RIGGERS to unlock the boom.');return;}if(s.vel.length()>.25){setNotice('Stop the truck before moving the boom.');return;}s[axis]=d;};
 const releaseBoomStick=()=>{
  const s=sim.current;
  if(s)for(const truck of [s,s.helperState])if(truck){truck.boomControl=0;truck.boomSwingControl=0;}
  setBoomStick({x:0,y:0});
 };
 const boomStickStop=()=>{
  const s=sim.current;
  if(s)for(const truck of [s,s.helperState])if(truck)truck.boomExtendControl=0;
  releaseBoomStick();
 };
 const boomStickMove=e=>{
  const game=sim.current;if(!game||!game.tools.includes('boom'))return;const s=controlledTruck(game);
  if((!s.parkingBrake&&!s.riggersDeployed)||!s.boomDeployed||s.vel.length()>.25){boomStickStop();setNotice('Stop and apply PARK BRAKE or deploy RIGGERS to operate the boom.');return;}
  const rect=e.currentTarget.getBoundingClientRect();
  const x=clamp((e.clientX-rect.left-rect.width/2)/(rect.width*.42),-1,1);
  const y=clamp((rect.top+rect.height/2-e.clientY)/(rect.height*.42),-1,1);
  const horizontal=game.type.id==='rotator'&&s===game&&Math.abs(x)>.12?x:0,vertical=Math.abs(y)>.12?y:0;
  s.boomControl=vertical;
  s.boomSwingControl=horizontal;
  setBoomStick({x:horizontal,y:vertical});
 };
 const toggleRiggers=()=>{const s=sim.current;if(!s||!s.tools.includes('riggers'))return;if(s.tandemHelper&&s.tandemSelected===1){setNotice('Support wrecker is already staged.');return;}
 if(s.vel.length()>.4){setNotice('Stop the truck before deploying riggers.');return;}
 if(s.riggersDeployed&&ownerHasCable(s,0)){setNotice('Disconnect recovery lines before retracting riggers.');return;}
 const deploying=!s.riggersDeployed;
 s.riggersDeployed=deploying;s.support=null;s.supportRatio=0;
 // The brake engages with the riggers, but retracting them never releases it automatically.
 s.parkingBrake=parkingBrakeForRiggers(s.parkingBrake,s.riggersDeployed);
 s.boomDeployed=s.parkingBrake||s.riggersDeployed;
 boomStickStop();
 if(!s.boomDeployed){s.boomAngle=.36;s.boomExtension=0;s.boomSwing=0;}
 setNotice(deploying?'RIGGERS DEPLOYED • PARK BRAKE APPLIED AUTOMATICALLY.':'RIGGERS RETRACTED • PARK BRAKE REMAINS ON. RELEASE IT WHEN READY TO DRIVE.');
};
 const setLiftControl=(axis,d)=>{const s=sim.current;if(!s)return;if(d===0){s[axis]=0;return;}if(!s.tools.includes('lift')||!s.liftDeployed){setNotice('Deploy wheel lift first.');return;}if(!liftMotionReady(s)){setNotice(s.loaded?'Stop and apply PARK BRAKE before adjusting a captured vehicle.':'Slow to walking speed (8 km/h) to adjust the wheel lift.');return;}if(s.type.id==='light'&&axis==='liftExtendControl'){setNotice('Starter wheel lift has fixed reach.');return;}if(axis==='liftControl'&&d<0&&s.strapsOn&&s.liftHeight<=.45){setNotice('Remove straps before lowering the car.');return;}s[axis]=d;};
 const liftPress=(axis,d)=>e=>{e.preventDefault();setLiftControl(axis,d);};
 const toggleLift=()=>{const s=sim.current;if(!s||!s.tools.includes('lift'))return;if(s.loaded){setNotice('Lower car and release L-arms before folding lift.');return;}if(!liftMotionReady(s)){setNotice('Slow to walking speed (8 km/h) to deploy or fold the wheel lift.');return;}s.liftDeployed=!s.liftDeployed;s.liftControl=0;s.liftExtendControl=0;s.liftHydraulicX=0;s.liftHydraulicY=0;if(s.liftDeployed){s.liftHeight=0;s.armsClosed=false;s.strapsOn=false;setNotice('Wheel lift lowered. Reverse slowly, seat both tires, then PARK and close the L-arms.');}else{s.liftExtension=0;s.liftHeight=0;setNotice('Wheel lift folded upright.');}};
 const hydraulicStop=()=>{const s=sim.current;if(s){s.liftHydraulicX=0;s.liftHydraulicY=0;}setHydraulic({x:0,y:0});};
 const hydraulicMove=e=>{const s=sim.current;if(!s||!s.liftDeployed)return;if(!liftMotionReady(s)){hydraulicStop();return;}const rect=e.currentTarget.getBoundingClientRect();const x=s.type.id==='light'?0:clamp((e.clientX-rect.left-rect.width/2)/(rect.width*.42),-1,1),y=clamp((rect.top+rect.height/2-e.clientY)/(rect.height*.42),-1,1);s.liftHydraulicX=Math.abs(x)>.12?x:0;s.liftHydraulicY=Math.abs(y)>.12?y:0;setHydraulic({x,y});};
 const adjustGrid=delta=>{const s=sim.current;if(!s||!s.liftDeployed)return;if(s.loaded){setNotice('Release the captured tires before adjusting grid width.');return;}if(!liftMotionReady(s)){setNotice('Slow to walking speed (8 km/h) to adjust the grid.');return;}s.gridWidth=clamp(s.gridWidth+delta,0,.45);};
 const toggleArms=()=>{const s=sim.current;if(!s||!s.liftDeployed||!liftLockReady(s)){setNotice('Deploy lift, stop and engage PARK BRAKE before closing or opening L-arms.');return;}if(s.autoLoad||s.autoUnload){setNotice('Wait for the automatic lift cycle to finish.');return;}if(s.loaded&&s.strapsOn){setNotice('Remove straps before opening L-arms.');return;}if(s.loaded&&s.liftHeight>.25){setNotice('Lower the lift before opening L-arms.');return;}if(!s.armsClosed){if(JOBS[s.jobIndex%JOBS.length].kind==='woodland'&&!s.woodlandExtracted){setNotice('Winch the stuck truck onto the gravel before capturing its tires.');return;}const contact=tireGridContact(s);if(!contact.ok){setNotice(contact.facing<.60?'Align the tow truck straight with the car before closing L-arms.':s.liftHeight>=.38?'Lower the wheel lift before closing L-arms.':'Back farther beneath both FRONT tires. Grid alignment: '+contact.error.toFixed(1)+' m away.');return;}}const releasing=s.armsClosed&&s.loaded;
 s.armsClosed=!s.armsClosed;s.loaded=s.armsClosed;
 if(s.armsClosed){
   s.dropoffArrived=false;s.dropoffComplete=false;s.pickYaw=s.yaw;s.prevHitch=null;
   setNotice('Tires captured. Raise lift, then apply tire straps.');
 }else{
   s.prevHitch=null;s.pickVel.set(0,0,0);
   const job=JOBS[s.jobIndex%JOBS.length];
   const atDestination=job.kind==='recovery'||job.kind==='woodland'?inRecoveryBay(s,job):s.pos.distanceTo(V(0,0,23))<5;
   if(releasing&&s.dropoffArrived&&atDestination&&s.parkingBrake){
     s.dropoffComplete=true;
     setNotice('Vehicle safely unloaded. Dispatch complete!');
   }else setNotice('L-arms opened. Vehicle released.');
 }};
 const togglePark=()=>{const s=sim.current;if(!s)return;if(s.helperState&&s.tandemSelected===1){const a=s.helperState;if(a.parkingBrake&&ownerHasCable(s,1)){setNotice('Disconnect truck B cable before driving.');return;}a.parkingBrake=!a.parkingBrake;a.boomDeployed=a.parkingBrake;boomStickStop();if(!a.boomDeployed){a.boomAngle=.28;a.boomExtension=0;}s.lastHud=0;setNotice(a.parkingBrake?'TRUCK B • PARK BRAKE APPLIED':'TRUCK B • DRIVE READY');return;}
 if(s.autoLoad||s.autoUnload){setNotice('Wait for the hydraulic cycle to finish before releasing PARK BRAKE.');return;}
 if(s.parkingBrake&&s.bladeDepth>.02){setNotice('Raise the ground blade before driving.');return;}
 if(s.parkingBrake&&!liftTransportReady(s)){setNotice('Raise the captured axle and fit both tire straps before driving.');return;}
 if(s.parkingBrake&&s.type.id==='flatbed'&&!transportReady(s)&&!creepReady(s)){setNotice('Secure the load, level the deck and slide it fully forward before driving.');return;}
 if(s.parkingBrake&&s.type.id==='flatbed'&&creepReady(s)){s.bedSlideControl=0;s.bedTiltControl=0;setNotice('EMPTY RAMP • Forward creep only (4 km/h). Pull clear, park, then stow.');}
 if(s.parkingBrake&&s.riggersDeployed){setNotice('Retract RIGGERS before releasing PARK BRAKE.');return;}
 if(s.parkingBrake&&ownerHasCable(s,0)){setNotice('Disconnect recovery lines before driving.');return;}
 s.parkingBrake=!s.parkingBrake;if(s.tandemHelper){s.lastHud=0;setNotice(s.parkingBrake?'TRUCK A • PARK BRAKE APPLIED':'TRUCK A • DRIVE READY');}
 if(s.tools.includes('boom')){
  s.boomDeployed=s.parkingBrake||s.riggersDeployed;
  boomStickStop();
  if(!s.boomDeployed){s.boomAngle=.36;s.boomExtension=0;s.boomSwing=0;}
 }
};
 const toggleHook=()=>{const s=sim.current;if(!s)return;if(!s.hook&&s.type.id==='hercules'&&s.bladeDepth<=.25){setNotice('Park and lower the ground blade before connecting.');return;}if(!s.hook&&hasFrontCable(s)){setNotice('Disconnect the front winch before rigging the rear line.');return;}if(!s.hook&&s.hookRedirect&&!s.riggingAnchors[s.hookRedirect].pos){setNotice('Place the selected anchor before connecting to the vehicle.');return;}if(!s.hook&&!s.boomDeployed&&s.tools.includes('boom')){setNotice('Apply PARK BRAKE to activate the boom before hooking.');return;}if(!s.hook&&!s.tools.includes('winch')){setNotice('This truck has no winch.');return;}if(s.type.id==='flatbed'){const deck=deckFor(s),local=rollbackLocal(s),scale=s.pickup.userData.scale;if(s.loaded){setNotice('Release the secured load before connecting.');return;}if(s.hook&&!rollbackCanUnhook(deck,local.z,scale,s.parkingBrake,s.vel.length()<.25)){setNotice('Park and pay out until all tires are on the ground before disconnecting.');return;}if(!s.hook&&(!s.parkingBrake||!rampReady(s)||s.hookRedirect||Math.abs(RECOVERY_POINTS[s.hookPoint].z)<1.5||!rollbackCanConnect(deck,local.x,local.z,rollbackYawError(s),scale))){setNotice('Park, deploy bed, align car behind ramp and select its facing front/rear eye with DIRECT LINE.');return;}}if(!s.hook&&s.loaded){setNotice('Release the vehicle from the wheel lift before hooking.');return;}if(!s.hook&&s.pos.distanceTo(s.pickPos)>24){setNotice('Move within 24 m to hook the vehicle.');return;}s.hook=!s.hook;s.previousCableDistance=null;s.cableStrain=0;s.cableStalled=false;s.rollbackBlocked=false;if(s.type.id==='flatbed'){s.winch=false;s.winchOut=false;s.pickVel.set(0,0,0);s.pickYawVel=0;if(!s.hook&&s.dropoffArrived&&s.pos.distanceTo(V(0,0,23))<5&&!s.loaded&&!s.strapsOn){s.dropoffComplete=true;setNotice('Vehicle unloaded. Release PARK, creep forward clear of car, PARK again, then TILT UP and SLIDE IN.');}else if(s.hook)s.dropoffComplete=false;}if(s.hook){const f=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));const a=s.pos.clone().add(f.multiplyScalar(-2.3));const head=s.type.id==='flatbed'?rollbackHead(s):s.tools.includes('boom')&&s.truck.userData.boomTip?s.truck.userData.boomTip.getWorldPosition(V()):a;const eye=s.type.id==='flatbed'?rollbackEye(s):ordinaryEye(s);s.cableLength=linePathLength(head,eye,s.riggingAnchors[s.hookRedirect].pos);if(s.type.id==='medium'||s.type.id==='offroad')setNotice('Cable connected. Hold WINCH IN to pull the vehicle along the ground.');}else if(s.type.id==='medium'||s.type.id==='offroad'){s.winch=false;s.winchOut=false;s.tension=0;s.pickVel.set(0,0,0);setNotice('Cable disconnected.');}};
 const reset=()=>{
  const s=sim.current;if(!s)return;
  clearAutomaticCheckpoint(s.jobIndex);setAutomaticCheckpoint(null);
   pendingRestore.current=null;
  if(s.anchorPlacement||s.customHookPlacement!==null)setRecoveryOpen(true);
  s.anchorPlacement=null;s.customHookPlacement=null;s.doubleAnchorSetup=false;s.anchorTap=null;
  s.pointers.clear();s.drag=null;s.pinch=null;
  setPlacingAnchor(false);setNotice('');
  stopTruckInputs(s);setSteerVisual(0);setBoomStick({x:0,y:0});
  const idx=careerRef.current.job%JOBS.length,config=siteConfig(idx),terrainHeight=config?(x,z)=>siteHeight(idx,x,z):idx===4?lakeHeight:levelFourHeight,start=config?.start.z??(s.levelFour?Math.min(-49,JOBS[idx].z+15):7);s.siteFailed=false;s.bladeDepth=0;s.bladeInput=0;s.sandSink=0;s.woodlandExtracted=false;s.woodlandBogged=false;if(s.frontWinch)s.frontWinch=makeFrontWinch();setShowFrontWinch(false);if(s.tandemHelper)s.helperState=makeHelperState(V);s.tandemUsed=[false,false];s.tandemSelected=0;setActiveRecoveryLine(0);const startX=config?.start.x??0;s.pos.set(startX,s.levelFour?terrainHeight(startX,start):0,start);s.vel.set(0,0,0);s.yaw=0;s.steerAngle=0;const job=JOBS[careerRef.current.job%JOBS.length];s.pickPos.set(job.x,s.levelFour?terrainHeight(job.x,job.z):0,job.z);s.pickYaw=-.18;s.pickYawVel=0;s.pickRoll=job.roll??0;s.pickRollVel=0;s.secondary.active=!!job.second;s.secondary.mesh.visible=!!job.second;s.secondary.pos.set(job.second?.x??-22,s.levelFour?terrainHeight(job.second?.x??-22,job.second?.z??-106):0,job.second?.z??-106);s.secondary.vel.set(0,0,0);s.secondary.roll=job.second?.roll??0;s.secondary.rollVel=0;s.secondary.yaw=job.second?.yaw??-.1;s.secondary.yawVel=0;for(const line of s.recoveryLines){line.connected=false;line.spool=20;line.motor=0;line.tension=0;line.target=0;line.point=0;line.redirect=0;line.secondRedirect=0;line.customPoint=null;line.doubled=false;line.strain=0;line.stalled=false;line.previousDistance=null;}for(const anchor of s.riggingAnchors){if(anchor.marker){anchor.pos=null;anchor.marker.visible=false;}}s.hookPoint=0;s.hookRedirect=0;for(const rope of s.recoveryCables)rope.visible=false;s.jobIndex=careerRef.current.job;s.jobDone=false;s.dropoffArrived=false;s.dropoffComplete=false;s.autoUnload=false;s.autoLoad=false;s.heavyRecovery=job.kind==='heavy';s.loaded=false;s.prevHitch=null;s.strapsOn=false;s.bedTilt=false;s.bedSlide=0;s.bedProgress=0;s.bedSlideControl=0;s.bedTiltControl=0;s.recoveryDamage=0;s.bedContactLatch=false;s.rollbackLoadX=0;s.rollbackLoadYaw=0;s.rollbackLoadZ=0;s.rollbackBlocked=false;s.zone.position.set(config?.goals[0].x??(job.kind==='tow'||job.kind==='flatbed'?0:2),config?.kind==='woodland'?terrainHeight(config.goals[0].x,config.goals[0].z)+.045:.12,config?.goals[0].z??(job.kind==='tow'||job.kind==='flatbed'?23:job.z));s.pickVel.set(0,0,0);s.hook=false;s.winch=false;s.winchOut=false;s.parkingBrake=false;s.boomDeployed=false;s.boomAngle=.36;s.boomSwing=0;s.boomExtension=0;s.boomControl=0;s.boomExtendControl=0;s.boomSwingControl=0;s.liftDeployed=false;s.liftHeight=0;s.liftExtension=0;s.liftControl=0;s.liftExtendControl=0;s.liftHydraulicX=0;s.liftHydraulicY=0;s.gridWidth=0;s.armsClosed=false;s.riggersDeployed=false;s.support=null;s.padContacts=[];s.supportRatio=0;s.suspension={pitch:0,roll:0,heave:0};s.cableLength=14;s.previousCableDistance=null;s.cableStrain=0;s.cableStalled=false;s.autosaveBaseline=captureRecoverySave(careerRef.current,s);s.autosaveActive=0;
 };
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
 const resumeSavedJob=(automatic=false)=>{
  let checkpoint=null;
  try{checkpoint=parseRecoverySave(localStorage.getItem(automatic===true?AUTO_RECOVERY_SAVE_KEY:RECOVERY_SAVE_KEY),JOBS.length)}catch{}
  if(!checkpoint){setSavedCheckpoint(null);setNotice('No valid saved job on this device.');return;}
  pendingRestore.current=checkpoint;
  saveCareer(old=>({...old,job:checkpoint.jobIndex,selected:checkpoint.career.selected}));
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
  const gridCenter=s.pos.clone().addScaledVector(forward,-liftHitchDistance(s));
  const lateral=.78+s.gridWidth;
  const errors=[-1,1].map(side=>{
   const tire=axle.clone().addScaledVector(carRight,side*.84);
   const grid=gridCenter.clone().addScaledVector(right,side*lateral);
   return tire.distanceTo(grid);
  });
  const facing=carForward.dot(forward),error=Math.max(...errors);
   return {ok:wheelLiftCaptureReady({leftError:errors[0],rightError:errors[1],facing,height:s.liftHeight}),error,facing};
 };
 const strapTires=()=>{
  const s=sim.current;if(!s)return;
  if(s.autoLoad||s.autoUnload){setNotice('Wait for the automatic cycle to finish.');return;}
  if(!s.tools.includes('lift')){setNotice('This truck has no wheel lift.');return;}
  if(!liftLockReady(s)){setNotice('Stop and apply PARK BRAKE before fitting or removing tire straps.');return;}
  const job=JOBS[s.jobIndex%JOBS.length];
  if(s.strapsOn){
   if((job.kind==='recovery'||job.kind==='woodland')&&s.loaded&&inRecoveryBay(s,job))s.dropoffArrived=true;
   s.strapsOn=false;setNotice('Straps removed. Hold LIFT DOWN until on the ground, then open L-arms.');return;
  }
  if(!wheelLiftStrapReady({hasLift:s.tools.includes('lift'),deployed:s.liftDeployed,loaded:s.loaded,armsClosed:s.armsClosed,height:s.liftHeight,speed:s.vel.length(),parkingBrake:s.parkingBrake})){
   setNotice(!s.loaded||!s.armsClosed?'Close L-arms around both tires first.':!s.liftDeployed?'Deploy the wheel lift first.':'Raise wheel lift before applying straps.');return;
  }
  s.vel.set(0,0,0);s.throttle=0;s.strapsOn=true;s.hook=false;s.winch=false;s.winchOut=false;s.tension=0;s.previousCableDistance=null;
  setNotice(job.kind==='woodland'?'Tires strapped. Release PARK BRAKE and tow back along the gravel trail.':job.kind==='recovery'?'Tires strapped. Release PARK BRAKE and tow to the green recovery circle.':'Tires strapped. Release PARK BRAKE and tow to depot.');
 };
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
  if(!s.dropoffArrived&&!liftTransportReady(s)){setNotice('Raise and strap the captured axle before delivering the vehicle.');return;}
  s.dropoffArrived=true;s.strapsOn=false;s.liftControl=0;s.liftHydraulicY=0;
  s.autoUnload=true;
  setNotice('Removing straps and lowering the car onto its rear wheels. L-arms will open when lowered.');
 };
 const bladePress=value=>()=>{
  const truck=sim.current;if(!truck)return;
  if(value&&!truck.parkingBrake){setNotice('Park before moving the ground blade.');return;}
  truck.bladeInput=value;
 };
 const coupleTank=()=>{
  const truck=sim.current;if(!truck)return;
  if(truck.loaded){setNotice('Tow the tank into the outpost bay and apply PARK to finish.');return;}
  if(!truck.parkingBrake||truck.hook||truck.bladeDepth>.02){setNotice('Park, disconnect the winch and raise the blade before coupling.');return;}
  const local=rollbackLocal(truck);
  if(Math.abs(truck.pickPos.x)>7.5||Math.abs(local.x)>1.8||local.z<6.5||local.z>10){
   setNotice('Pull the Abrams onto hardpack. Align the M88A2 rear 7–10 m ahead of the tank.');return;
  }
  truck.loaded=true;truck.pickVel.set(0,0,0);truck.pickYaw=truck.yaw;truck.prevHitch=null;
  setNotice('TOW BAR COUPLED. Tow to the outpost, then apply PARK BRAKE.');
 };
 const toggleFrontWinch=()=>{
  const truck=sim.current,line=truck?.frontWinch;
  if(!line)return;
  if(line.anchor>=0){
   truck.frontWinch=makeFrontWinch();setNotice('Front winch disconnected.');return;
  }
  if(truck.hook){setNotice('Disconnect the rear line before rigging the front winch.');return;}
  if(truck.vel.length()>.35){setNotice('Stop before connecting the front winch.');return;}
  const head=frontWinchHead(truck),forward=V(Math.sin(truck.yaw),0,-Math.cos(truck.yaw));
  let nearest=Infinity;
  truck.frontAnchors.forEach(({pos},i)=>{
   if(!pos)return;
   const distance=head.distanceTo(pos);
   if(distance<nearest&&frontWinchReach(head,forward,pos)){nearest=distance;line.anchor=i;}
  });
  if(line.anchor===-1){setNotice('Place a front anchor ahead of the truck, then connect it.');return;}
  line.spool=nearest;
  setNotice('FRONT WINCH CONNECTED. Release PARK BRAKE and hold PULL SELF to crawl free.');
 };
 const setFrontWinchMotor=value=>{
  const truck=sim.current,line=truck?.frontWinch;
  if(!line||line.anchor<0)return;
  if(value>0&&(truck.parkingBrake||!liftTransportReady(truck))){
   setNotice(truck.parkingBrake?'Release PARK BRAKE before pulling with the front winch.':'Secure the lifted vehicle before pulling with the front winch.');return;
  }
  line.motor=value;
 };
 const switchOffroadWinch=front=>{
  const truck=sim.current;
  if(truck?.frontWinch){truck.frontWinch.motor=0;truck.winch=false;truck.winchOut=false;}
  setShowFrontWinch(front);
 };
 const selectWinchSpeed=mode=>{setWinchSpeed(mode);if(sim.current)sim.current.winchSpeed=mode;};
 const changeHookPoint=()=>{const s=sim.current;if(!s||!s.tools.includes('winch'))return;if(s.hook){setNotice('Disconnect hook before changing attachment eye.');return;}s.hookPoint=(s.hookPoint+1)%RECOVERY_POINTS.length;setNotice('Winch hook: '+RECOVERY_POINTS[s.hookPoint].label);};
 const changeHookRedirect=()=>{const s=sim.current;if(!s||!s.tools.includes('winch'))return;if(s.hook){setNotice('Disconnect hook before changing anchor.');return;}s.hookRedirect=nextAnchorSlot(s.riggingAnchors,s.hookRedirect);setNotice('Winch route: '+s.riggingAnchors[s.hookRedirect].label);};
 const changeRecoveryRedirect=index=>{const s=sim.current;if(!s||s.type.id!=='rotator')return;const l=s.recoveryLines[index];if(l.connected){setNotice('Disconnect line before changing redirect anchor.');return;}l.redirect=l.secondRedirect?0:nextAnchorSlot(s.riggingAnchors,l.redirect);l.secondRedirect=0;setNotice('Line '+(index===0?'A':'B')+' route: '+s.riggingAnchors[l.redirect].label);};
 const removePlacedAnchor=slot=>{
    const s=sim.current;if(!s||![3,4].includes(slot))return;
    const anchor=s.riggingAnchors[slot];if(!anchor?.pos){setNotice('That ground anchor is not placed.');return;}
    if(s.recoveryLines.some(line=>line.connected&&(line.redirect===slot||line.secondRedirect===slot))||(s.hook&&s.hookRedirect===slot)||s.frontWinch?.anchor===slot){
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
    if(s.tandemHelper||s.recoveryLines.some(l=>l.connected)){setNotice('Disconnect LINE A and LINE B before moving anchors.');return;}
    s.recoveryLines[0].secondRedirect=0;s.doubleAnchorSetup=true;s.anchorPlacement={slot:3,lineIndex:0};s.anchorTap=null;
    setPlacingAnchor(true);setRecoveryOpen(false);
    setNotice('TWO-POINT LINE A: Place redirect A, then redirect B. Both guide the SAME cable.');
  };
 const startAnchorPlacement=lineIndex=>{
    const s=sim.current;if(!s||!s.tools.includes('winch'))return;
    const owner=typeof lineIndex==='number'?lineOwner(s,lineIndex):s;
    if(owner.vel.length()>.35||(lineIndex!=='front'&&!owner.parkingBrake)){setNotice('Stop and park before rigging a redirect.');return;}
    if(lineIndex==='front'?hasFrontCable(s):lineIndex===null?s.hook:s.recoveryLines[lineIndex].connected){setNotice('Disconnect the line before moving its anchor.');return;}
    const slot=lineIndex===1?4:3;
    if(s.recoveryLines.some(line=>line.connected&&(line.redirect===slot||line.secondRedirect===slot))||(s.hook&&s.hookRedirect===slot)||s.frontWinch?.anchor===slot){setNotice('This anchor holds another connected line. Disconnect it before moving.');return;}
    s.doubleAnchorSetup=false;s.anchorPlacement={slot,lineIndex};s.anchorTap=null;setPlacingAnchor(true);setRecoveryOpen(false);
    setNotice('Tap a tree trunk or choose an open spot for a portable anchor.');
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
 const toggleMovingBlock=index=>{const s=sim.current;if(!s||s.type.id!=='rotator'||!s.recoveryLines[index])return;const line=s.recoveryLines[index];if(line.connected){setNotice('Disconnect this line before changing the block.');return;}line.doubled=!line.doubled;setNotice(line.doubled?'MOVING BLOCK ENABLED: two supporting legs, return to truck.':'SINGLE LINE ENABLED: fixed redirects only change direction.');};
 const toggleRecoveryLine=index=>{const s=sim.current;if(!s||s.type.id!=='rotator')return;if(s.siteFailed){setNotice('Recovery failed. Restart the dispatch.');return;}const l=s.recoveryLines[index];if(l.connected){l.connected=false;l.motor=0;l.tension=0;l.strain=0;l.stalled=false;l.previousDistance=null;setNotice('Line '+(index===0?'A':'B')+' disconnected.');return;}if(!linePowerReady(s,index)){setNotice(isSupportLine(s,index)?'Stop and park truck B before connecting its cable.':'Stop, park and deploy riggers before connecting.');return;}const target=l.target===1?s.secondary:primaryRecoveryTarget(s);const a=recoveryAnchor(target,selectedRecoveryPoint(s,l)),b=recoveryHead(s,index),guide=s.riggingAnchors[l.redirect].pos;if(l.redirect&&!guide){setNotice('Place the selected anchor before connecting.');return;}const second=l.secondRedirect?s.riggingAnchors[l.secondRedirect].pos:null;if(l.secondRedirect&&!second){setNotice('Place both redirect anchors before connecting.');return;}const distance=cableGeometry(lineRoute(b,a,guide,second,l.doubled?truckReturn(s,index):null),l.doubled).distance;if(distance>90){setNotice('Recovery line out of reach: reposition truck.');return;}l.connected=true;l.motor=0;l.spool=distance;l.previousDistance=null;l.tension=0;l.strain=0;l.stalled=false;setNotice('Line '+(index===0?'A':'B')+' attached to '+selectedRecoveryPoint(s,l).label+' via '+s.riggingAnchors[l.redirect].label+(l.doubled?' · MOVING BLOCK.':'.'));};
 const setRecoveryMotor=(index,value)=>{const s=sim.current;if(!s||s.type.id!=='rotator')return;const l=s.recoveryLines[index];if(value!==0&&(!l.connected||!linePowerReady(s,index))){setNotice('Connect the line, deploy BOOM and RIGGERS, then apply PARK BRAKE.');return;}const released=l.motor>0&&value===0;l.motor=value;if(released){const otherPull=s.recoveryLines.some((other,i)=>i!==index&&other.connected&&other.target===l.target&&other.motor>0);if(!otherPull){if(l.target===0){s.pickVel.set(0,0,0);s.pickYawVel=0;}else{s.secondary.vel.set(0,0,0);s.secondary.yawVel=0;}}}};
 const recoveryPress=(index,value)=>e=>{e.preventDefault();setRecoveryMotor(index,value);};
 const setBothRecoveryMotors=value=>{
   const s=sim.current;if(!s||s.type.id!=='rotator')return;if(s.tandemHelper&&value!==0){setNotice('Practice one truck at a time. Switch A/B to manage tension.');return;}
   if(value!==0&&!canPowerBothRecoveryLines(s.recoveryLines,s.parkingBrake&&s.riggersDeployed&&s.boomDeployed&&s.vel.length()<.25)){
     setNotice('Connect LINE A and LINE B, deploy BOOM + RIGGERS, and apply PARK BRAKE to operate both.');
     return;
   }
   for(const index of [0,1])setRecoveryMotor(index,value);
 };
 const bothRecoveryPress=value=>e=>{e.preventDefault();setBothRecoveryMotors(value);};
 const bedPress=(axis,d)=>e=>{
  e.preventDefault();const s=sim.current;if(!s||s.type.id!=='flatbed')return;
  if(!d){s[axis]=0;s.bedContactLatch=false;return;}
  if(!liftLockReady(s)){setNotice('Stop and apply PARK BRAKE to operate the rollback.');return;}
  if(s.hook&&!s.loaded){setNotice('Secure the load or unhook on the ground before moving the bed.');return;}
  if(s.loaded&&!s.strapsOn){setNotice('Secure all four tires before moving the bed.');return;}
  if(axis==='bedTiltControl'&&s.bedSlide<.999){setNotice('Slide the bed fully back before tilting.');return;}
  if(axis==='bedSlideControl'&&s.bedProgress>.001){setNotice('Hold TILT UP until the deck is level before sliding.');return;}
  s[axis]=d;s[axis==='bedSlideControl'?'bedTiltControl':'bedSlideControl']=0;
 };
 const secureLoad=()=>{
  const s=sim.current;if(!s||s.type.id!=='flatbed')return;
  if(!liftLockReady(s)||!rampReady(s)){setNotice('Park, slide back and tilt down to the ground before fitting or removing straps.');return;}
  if(s.loaded){
   if(s.pos.distanceTo(V(0,0,23))<5&&s.strapsOn)s.dropoffArrived=true;
   s.loaded=false;s.strapsOn=false;s.hook=true;s.winch=false;s.winchOut=false;s.cableLength=rollbackHead(s).distanceTo(rollbackEye(s));s.previousCableDistance=null;
   setNotice('Four straps removed. Hold WINCH OUT to lower the car down the ramp.');return;
  }
  if(!s.hook){setNotice('Connect the winch cable and load the vehicle first.');return;}
  const local=rollbackLocal(s),deck=deckFor(s);
  if(!rollbackReady(deck,local.x,local.z,rollbackYawError(s),s.pickup.userData.scale)){setNotice('Hold WINCH IN until both axles are on the deck.');return;}
  s.rollbackLoadX=local.x;s.rollbackLoadYaw=rollbackYawError(s);s.rollbackLoadZ=Math.max(0,local.z-rollbackStop(deck));
  s.dropoffComplete=false;s.dropoffArrived=false;s.strapsOn=true;s.loaded=true;s.hook=false;s.winch=false;s.winchOut=false;s.tension=0;s.pickVel.set(0,0,0);
  setNotice('Four wheel straps fitted. Hold TILT UP, then SLIDE IN. Release park brake when bed is stowed.');
 };
 const chooseTruck=id=>{const t=FLEET.find(x=>x.id===id);if(!t)return;saveCareer(p=>({...p,selected:id,owned:FLEET.map(truck=>truck.id)}));setNotice('TEST MODE: '+t.name+' ready.');};
 const selectTestJob=index=>{const j=JOBS[index];if(!j)return;saveCareer(p=>({...p,job:index,selected:j.truck,owned:FLEET.map(truck=>truck.id)}));setGarage(false);setHelp(false);setNotice('TEST JOB: '+j.name+' — '+FLEET.find(t=>t.id===j.truck).name);};
 const changeCamera=mode=>{
   if(!CAMERA_MODES.some(([id])=>id===mode))return;
   const s=sim.current;
   if(s){s.cameraMode=mode;s.zoom=truckCameraZoom(s.type);s.presetYaw=0;s.presetPitch=0;if(mode==='orbit'){s.orbitFocus='truck';s.cameraYaw=0;s.cameraPitch=.30;}}
   setCameraMode(mode);setCameraPanelOpen(false);
 };
 const nextCamera=()=>{const index=CAMERA_MODES.findIndex(([id])=>id===cameraMode);changeCamera(CAMERA_MODES[(index+1)%CAMERA_MODES.length][0]);};
 const toggleRearCamera=()=>changeCamera(cameraMode==='reverse'?'orbit':'reverse');
 const currentJob=JOBS[career.job%JOBS.length],currentSite=siteConfig(career.job%JOBS.length);
 const mapY=currentSite?.kind==='desert'?z=>143+(z+55)*1.1:minimapY;
 const offroadEquipment=s?.type.id==='offroad';
 const fieldLiftToggle=<button className={'action '+(s?.liftDeployed?'active':'')} onClick={toggleLift}>{s?.liftDeployed?'FOLD WHEEL LIFT':'LOWER WHEEL LIFT'}</button>;
 const fieldLiftGrid=<div className="equipment-row"><button className="action" onClick={()=>adjustGrid(-.1)}>GRID −</button><button className="action" onClick={()=>adjustGrid(.1)}>GRID +</button></div>;
 const fieldLift=(offroadEquipment||s?.type.id==='medium')&&<>
  {!offroadEquipment&&<><div className="equipment-section-label">WHEEL LIFT</div>{fieldLiftToggle}</>}
  {s.liftDeployed&&<>
   <div className="wheel-lift-actions" role="group" aria-label="Wheel lift controls">
    <div className="equipment-row"><Hold label="LIFT UP" onDown={liftPress('liftControl',1)} onUp={liftPress('liftControl',0)}/><Hold label="LIFT DOWN" onDown={liftPress('liftControl',-1)} onUp={liftPress('liftControl',0)}/></div>
    {!offroadEquipment&&fieldLiftGrid}
    <div className="equipment-row"><button className="action" onClick={toggleArms}>{s.armsClosed?'OPEN L-ARMS':'CLOSE L-ARMS'}</button><button className={'action '+(hud.strapsOn?'active':offroadEquipment&&s.loaded?'priority-action':'')} disabled={!s.loaded} onClick={strapTires}>{hud.strapsOn?'REMOVE STRAPS':'FIT STRAPS'}</button></div>
   </div>
   {!s.loaded&&<div className={'lift-status '+(hud.gridContact?.ok?'aligned':'')}>{hud.gridContact?.ok?'TIRES ALIGNED • PARK':'ALIGN FRONT TIRES • '+(hud.gridContact?.error?.toFixed(1)??'--')+' m'}</div>}
   {offroadEquipment&&!s.loaded&&fieldLiftGrid}
  </>}
  {offroadEquipment&&!s.loaded&&fieldLiftToggle}
 </>;
 return <main className={'game-shell'+(menuOpen?' menu-active':'')+(cameraPanelOpen?' camera-active':'')}><div className={'scene'+(placingAnchor?' anchor-placement-scene':'')} ref={mount}/>
   {placingAnchor&&<div className="anchor-placement-hint" role="status"><b>{s?.customHookPlacement!==null?'SELECT CUSTOM HOOK':'PLACE GROUND ANCHOR'}</b><span>{s?.customHookPlacement!==null?'Tap a frame edge or bumper on the recovery vehicle.':'Tap a tree trunk or a clear spot to rig a temporary anchor.'}</span><button type="button" onClick={s?.customHookPlacement!==null?cancelCustomHook:cancelAnchorPlacement}>CANCEL PLACEMENT</button></div>}
  <header className="topbar"><div><strong>TOWING & RECOVERY</strong><small>{s?.tandemHelper?'TRUCK '+(activeRecoveryLine===0?'A • ROTATOR':'B • MEDIUM')+' • '+(controlledTruck(s).parkingBrake?'PARKED':'DRIVE READY'):'CAREER MODE • '+career.selected.toUpperCase()+' TRUCK'}</small><small style={{display:"block",fontWeight:800,color:"#ffe07a",letterSpacing:".04em"}}>BUILD .92 • SMART SAVE</small></div><div className="speed"><b>{hud.speed.toFixed(0)}</b><span>KM/H</span></div></header>
  <div className={'game-minimap '+(mapOpen?'map-expanded':'map-collapsed')} style={{position:'absolute',left:12,bottom:195,zIndex:9,width:mapOpen?146:106,height:mapOpen?166:36,pointerEvents:'auto',border:'2px solid #f3c851',borderRadius:12,background:'rgba(9,20,30,.88)',color:'#fff',boxShadow:'0 3px 14px #0008',padding:6,boxSizing:'border-box'}}>
   <button type="button" aria-expanded={mapOpen} onClick={()=>setMapOpen(v=>!v)} style={{fontSize:11,fontWeight:800,width:'100%',background:'transparent',border:0,color:'white'}}>{mapOpen?'MAP −':'MAP +'}</button>
   {mapOpen&&<svg viewBox="0 0 140 140" width="132" height="132" aria-label="Map of recovery vehicles and destination">
    <rect width="140" height="140" rx="6" fill="#1b3431"/>
    {currentSite?.kind==='woodland'
     ?<polyline points={Array.from({length:21},(_,i)=>{
       const z=woodlandSite.bounds.minZ+i*(woodlandSite.bounds.maxZ-woodlandSite.bounds.minZ)/20;
       return minimapX(woodlandTrailCenter(z))+','+mapY(z);
      }).join(' ')} fill="none" stroke="#9d8b65" strokeWidth="14"/>
     :<><path d="M 70 0 V 140" stroke="#61787a" strokeWidth="22"/>
      <path d="M 70 0 V 140" stroke="#c4c8a6" strokeDasharray="5 7" strokeWidth="1.5"/></>}
    {s?.riggingAnchors.slice(3).filter(a=>a.pos).map(anchor=><circle key={anchor.id}
      cx={minimapX(anchor.pos.x)} cy={mapY(anchor.pos.z)} r="3" fill="#63e5ef"><title>{anchor.label}</title></circle>)}
    {currentSite?currentSite.goals.map((g,i)=><circle key={i} cx={minimapX(g.x)} cy={mapY(g.z)} r={g.r*1.5} fill="none" stroke={i?'#56dff2':'#49dc77'} strokeWidth="2.5"/>):<circle cx={minimapX(currentJob.kind==='tow'||currentJob.kind==='flatbed'?0:2)} cy={mapY(currentJob.kind==='tow'||currentJob.kind==='flatbed'?23:currentJob.z)} r="7" fill="none" stroke="#49dc77" strokeWidth="2.5"/>}
    {currentSite?.kind==='woodland'
     ?<text x={minimapX(woodlandSite.goals[0].x)} y={mapY(woodlandSite.goals[0].z)+15} fill="#c9ffd1" fontSize="7" textAnchor="middle" fontWeight="bold">TRAILHEAD</text>
     :<><rect x="57" y={mapY(currentSite?.kind==='desert'?-65:23)-5} width="26" height="10" rx="3" fill="#49dc77" stroke="#fff" strokeWidth="1"/>
      <text x="70" y={mapY(currentSite?.kind==='desert'?-65:23)+3} fill="#0d2518" fontSize="7" textAnchor="middle" fontWeight="bold">DEPOT</text></>}
    <g transform={'translate('+minimapX(hud.carX??currentJob.x)+','+mapY(hud.carZ??currentJob.z)+') rotate('+(-(hud.carYaw??0)*180/Math.PI)+')'}>
     <rect x="-4" y="-7" width="8" height="14" rx="2" fill="#ffcf58" stroke="#111" strokeWidth="1"/>
    </g>
    {s?.secondary.active&&<g transform={'translate('+minimapX(hud.secondX??currentJob.second.x)+','+mapY(hud.secondZ??currentJob.second.z)+')'}>
     <rect x="-5" y="-7" width="10" height="14" rx="2" fill="#d99355" stroke="#fff" strokeWidth="1"/>
     <text x="0" y="3" fontSize="8" textAnchor="middle" fill="#111" fontWeight="bold">2</text>
    </g>}
    {hud.otherTruck&&s?.tandemHelper&&<g transform={'translate('+minimapX(hud.otherTruck.x)+','+mapY(hud.otherTruck.z)+') rotate('+(-hud.otherTruck.yaw*180/Math.PI)+')'}><rect x="-5" y="-9" width="10" height="18" rx="2" fill="#e7b744" stroke="white"/><text x="0" y="3" textAnchor="middle" fontSize="8" fill="#222">{activeRecoveryLine===0?'B':'A'}</text></g>}
    <g transform={'translate('+minimapX(hud.mapX??0)+','+mapY(hud.mapZ??7)+') rotate('+(-(hud.mapYaw??0)*180/Math.PI)+')'}>
     <rect x="-5" y="-9" width="10" height="18" rx="2" fill="#55b7ff" stroke="white" strokeWidth="1.5"/>
     <path d="M -3 -5 L 0 -8 L 3 -5" fill="none" stroke="white"/>
    </g>
    <text x="5" y="135" fontSize="8" fill="#fff">BLUE: YOU</text>
   </svg>}
  </div>
  {menuOpen&&<section className="mission">
   <div className="eyebrow">DISPATCH #{career.job%JOBS.length+1} · {career.completed} COMPLETED</div>
   <b>{currentJob.name}</b>
   <span>{(currentJob.kind==='woodland'&&s?.woodlandExtracted
    ?s.loaded&&s.strapsOn?'Tow the truck back to the green trailhead bay. Park, remove the straps, lower the lift and open the L-arms.'
     :'The truck is clear. Disconnect the winch, align the wheel lift and secure both front tires.'
    :currentJob.brief)??(career.job%JOBS.length===3?'Recover a rolled heavy truck from a steep 60-ft wooded ravine below a broken guardrail. Anchor on firm ground and use both lines against the uphill slope.':currentJob.kind==='tow'?'Capture both tires, raise and strap, drive to the depot, then park, unstrap, lower and release.':currentJob.kind==='flatbed'?'Disabled AWD crossover: park, slide out, tilt down, hook and winch aboard. Fit four straps, tilt up, slide in and deliver. Unload and stow at depot.':currentJob.kind==='heavy'?'Use LINE A and B to right the rollover and pull every vehicle into the green recovery zone.':'Pickup stuck in the ditch: park on the road, deploy boom, connect hook and winch the truck into the green recovery circle.')} Reward: {'$'}{currentJob.pay}{currentJob.kind==='flatbed'&&s?.recoveryDamage>0?' · DAMAGE −$'+s.recoveryDamage+' · NET $'+rollbackNetPay(currentJob.pay,s.recoveryDamage):''}</span>
   <div className="stats"><span>CASH {'$'}{career.cash}</span><span>ENGINE {career.engine}/3 · WINCH {career.winch}/3</span></div>
   <div className="stats">
    {currentJob.kind==='heavy'?<span>RECOVERY LINES {s?.recoveryLines.filter(line=>line.connected).length??0}/2 CONNECTED</span>:<span>{hud.hook?'CABLE CONNECTED':'CABLE DISCONNECTED'}</span>}
    <span>{s?.siteFailed?'FAILED — RESTART JOB':currentJob.kind==='heavy'?'ROLL '+((hud.roll??0)*180/Math.PI).toFixed(0)+'°'+(currentJob.second?' / 2: '+((hud.roll2??0)*180/Math.PI).toFixed(0)+'°':''):hud.tension.toFixed(1)+' kN · '+(hud.range?.toFixed(0)??'--')+' m'}</span>
   </div>
  </section>}
  {s?.tools.includes('winch')&&<div className="tension-readout" role="group" aria-label="Winch load and capacity">
    {(s.type.id==='rotator'?(hud.lineTensions??[0,0]):s.frontWinch?[hud.tension,s.frontWinch.tension/1000]:[hud.tension]).map((tension,i)=>{
     const limit=s.type.id==='rotator'?lineLimit(s,i)/1000:32,load=winchLoadBand(tension,limit);
     const surface=(s.frontWinch&&i===1?hud.truckSurface:s.type.id==='rotator'&&s.recoveryLines[i].target===1?hud.secondarySurface:hud.recoverySurface)??'GROUND';
     const surfaceShort=({PAVEMENT:'PAVED',SUBMERGED:'WATER',GRAVEL:'GRVL','PACKED SNOW':'SNOW','BRIDGE DECK':'BRIDGE'}[surface]??surface);
     const label=s.type.id==='rotator'?(i===0?'A':'B'):s.frontWinch?(i===0?'REAR':'FRONT'):'WINCH';
     const meterLabel=s.type.id==='rotator'?'Line '+label:s.frontWinch?label+' winch':'Winch';
     return <div className="tension-item" key={i}>
      <div className="tension-item-head"><span className={'tension-label '+(i===0?'line-a':'line-b')} title={surface} aria-label={meterLabel+', target surface: '+surface}>{label+' · '+surfaceShort}</span><b className={'tension-amount '+load.level}>{tension.toFixed(1)} / {limit} kN</b></div>
      <div className="tension-track" role="meter" aria-label={meterLabel+' load'} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(limit,Math.max(0,tension))}><div className={'tension-fill '+load.level} style={{width:(load.fraction*100).toFixed(0)+'%'}}/></div>
     </div>;
    })}
    <small title="Simulated cable strain; yellow 60%, red 85% of rated line load">{s.type.id==='rotator'?[0,1].map(i=>{const l=s.recoveryLines[i];return (i===0?'A':'B')+' '+(l.doubled?'2:1':'1:1')+' '+(hud.lineStalls?.[i]?'STALL':(hud.lineStrains?.[i]??0).toFixed(1)+'%');}).join(' · ')+(hud.riggers?' · '+((hud.supportRatio??0)>=1?'GRIP LIMIT':'GRIP '+Math.round((hud.supportRatio??0)*100)+'%'):''):(hud.cableStalled?'STALL · ':winchSpeed.toUpperCase()+' · ')+'STRAIN '+(hud.cableStrain??0).toFixed(1)+'%'}</small>
    {s.type.id==='rotator'&&hud.riggers&&<small title={'Pad loads FL / FR / RL / RR: '+(hud.padLoads??[]).join(' / ')+' kN'} style={{color:(hud.padCount??0)<4||(hud.stabilityRatio??0)>=.95?'#ffc66b':undefined}}>PADS {hud.padCount??0}/4 · {(hud.stabilityRatio??0)>=.95?'STABILITY LIMIT':'LEAN '+Math.round((hud.stabilityRatio??0)*100)+'%'}</small>}
   </div>}
  <div className="bottom-ui">{settings.driveMode==='joystick'?<div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);joystickMove(e);}} onPointerMove={e=>{if(e.buttons)joystickMove(e);}} onPointerUp={joystickStop} onPointerCancel={joystickStop}><div className="stick-knob" style={{transform:`translateX(${steerVisual*23}px)`}}>●</div><span>STEER</span></div>:<div className="joystick steering-arrows"><Hold label="◀ LEFT" onDown={press('steer',-1)} onUp={press('steer',0)}/><Hold label="RIGHT ▶" onDown={press('steer',1)} onUp={press('steer',0)}/></div>}<div className={'equipment-stack'+(s?.tools.includes('boom')&&(hud.parking||hud.riggers)?' has-boom':'')+(s?.tools.includes('boom')?' single-line-stack':'')}>{s?.tools.includes('boom')&&(hud.parking||hud.riggers)&&<div className="boom-float"><div className="boom-control-cluster">
 <div className="boom-status">BOOM READY</div>
 <div className="boom-extension" role="group" aria-label="Boom extension">
  <Hold label="RETRACT" onDown={()=>setBoomControl('boomExtendControl',-1)} onUp={()=>setBoomControl('boomExtendControl',0)}/>
  <Hold label="EXTEND" onDown={()=>setBoomControl('boomExtendControl',1)} onUp={()=>setBoomControl('boomExtendControl',0)}/>
 </div>
 <div className="boom-joystick" role="group" aria-label={boomCanSwing?'Boom joystick: up and down to raise or lower, left and right to swing':'Boom joystick: up and down to raise or lower'} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);boomStickMove(e);}} onPointerMove={e=>{if(e.buttons)boomStickMove(e);}} onPointerUp={releaseBoomStick} onPointerCancel={releaseBoomStick} onLostPointerCapture={releaseBoomStick}>
  <span className="boom-label top">UP</span><span className="boom-label bottom">DOWN</span>
  {boomCanSwing&&<><span className="boom-label left">LEFT</span><span className="boom-label right">RIGHT</span></>}
  <div className="boom-knob" style={{transform:`translate(${boomStick.x*20}px,${-boomStick.y*20}px)`}}/>
 </div>
 </div></div>}<div className={'recovery equipment-compact all-controls '+(s?.type.id==='rotator'?'heavy-compact single-line-menu ':'')+(s?.tools.includes('winch')?'winch-equipped ':'')+(offroadEquipment?'offroad-equipment ':'')+(recoveryOpen?'is-open':'is-collapsed')}>
 <div className="equipment-header">
  <button type="button" className="recovery-toggle" aria-expanded={recoveryOpen} onClick={()=>{setRecoveryOpen(v=>!v);setMenuOpen(false);setCameraPanelOpen(false);}}>
   {s?.type.id==='light'?'WHEEL LIFT':s?.type.id==='rotator'?'RECOVERY':s?.type.id==='flatbed'?'ROLLBACK':'EQUIPMENT'} {recoveryOpen?'−':'+'}
  </button>
  {recoveryOpen&&s?.type.id==='rotator'&&[0,1].map(i=><button type="button" key={i} className={'action line-select line-'+(i===0?'a':'b')+(activeRecoveryLine===i?' active':'')} aria-pressed={activeRecoveryLine===i} onClick={()=>{if(activeRecoveryLine!==i){if(s.tandemHelper&&!switchTandemControl(s,i)){setNotice('Stop the current truck before switching.');return;}setRecoveryMotor(activeRecoveryLine,0);setActiveRecoveryLine(i);setSteerVisual(0);setBoomStick({x:0,y:0});if(s.tandemHelper){const a=controlledTruck(s);s.lastHud=0;changeCamera('chase');setNotice('TRUCK '+(i===0?'A':'B')+' • '+(a.parkingBrake?'PARKED — cable/riggers or brake engaged':'DRIVE READY'));}}}}>{s.tandemHelper?'TRUCK':'LINE'} {i===0?'A':'B'}</button>)}
 </div>
 {recoveryOpen&&<>
  {s?.type.id==='rotator'?<div className="equipment-row heavy-safety-row">
    <button type="button" className={'action brake-button '+(hud.parking?'active':'')} onClick={togglePark}>{s?.tandemHelper?(controlledTruck(s).parkingBrake?'RELEASE PARK':'APPLY PARK'):(hud.parking?'PARK ✓':'PARK BRAKE')}</button>
    <button type="button" disabled={!!s?.tandemHelper&&activeRecoveryLine===1} className={'action '+(hud.riggers?'active':'')} onClick={toggleRiggers}>{s?.tandemHelper&&activeRecoveryLine===1?'FIXED BOOM':hud.riggers?'RIGGERS RETRACT':'RIGGERS DEPLOY'}</button>
    <button type="button" className="action heavy-speed-cycle" onClick={()=>selectWinchSpeed(['fine','medium','high'][(['fine','medium','high'].indexOf(winchSpeed)+1)%3])}>SPEED {winchSpeed.toUpperCase()} ↻</button>
   </div>:<button type="button" className={'action brake-button '+(hud.parking?'active':'')} onClick={togglePark}>{hud.parking?'PARK BRAKE ✓':'PARK BRAKE'}</button>}
  {offroadEquipment&&fieldLift}
  {s?.frontWinch&&<div className="equipment-tabs" role="group" aria-label="Select 8×8 winch">
    <button type="button" aria-pressed={!showFrontWinch} className={!showFrontWinch?'selected':''} onClick={()=>switchOffroadWinch(false)}>REAR WINCH</button>
    <button type="button" aria-pressed={showFrontWinch} className={showFrontWinch?'selected':''} onClick={()=>switchOffroadWinch(true)}>FRONT WINCH</button>
  </div>}
  {s?.frontWinch&&showFrontWinch&&<>
    {!hasFrontCable(s)&&<button type="button" className="action" onClick={()=>startAnchorPlacement('front')}>PLACE FRONT ANCHOR</button>}
    <button type="button" className={'action '+(hasFrontCable(s)?'active':'')} onClick={toggleFrontWinch}>
      {hasFrontCable(s)?'DISCONNECT FRONT':'CONNECT FRONT ANCHOR'}
    </button>
    <div className="equipment-row winch-row">
      <Hold label="PULL SELF" disabled={!hasFrontCable(s)} onDown={()=>setFrontWinchMotor(1)} onUp={()=>setFrontWinchMotor(0)}/>
      <Hold label="PAY OUT" disabled={!hasFrontCable(s)} onDown={()=>setFrontWinchMotor(-1)} onUp={()=>setFrontWinchMotor(0)}/>
    </div>
    <div className="lift-status">{s.woodlandBogged?'BOGGED DOWN · ':' '}{hasFrontCable(s)
     ?s.parkingBrake?'RELEASE PARK TO PULL':s.frontAnchors[s.frontWinch.anchor].label
     :'PLACE AN ANCHOR AHEAD'}</div>
  </>}
  {s?.tools.includes('winch')&&s?.type.id!=='rotator'&&(!s.frontWinch||!showFrontWinch)&&<div className="winch-speed-selector" role="group" aria-label="Winch reel speed">{['fine','medium','high'].map(mode=><button key={mode} className={winchSpeed===mode?'selected':''} onClick={()=>selectWinchSpeed(mode)}>{mode.toUpperCase()}</button>)}</div>}
  {s?.type.id==='light'&&<>
    <div className="equipment-row">
      {!s.loaded&&<button className={'action '+(s.liftDeployed?'active':'')} onClick={toggleLift}>{s.liftDeployed?'FOLD LIFT':'LOWER LIFT'}</button>}
      <button className={'action '+(cameraMode==='reverse'?'active':'')} onClick={toggleRearCamera}>{cameraMode==='reverse'?'NORMAL CAM':'REAR CAM'}</button>
    </div>
    {!s.loaded?<button className="action priority-action" onClick={autoLoadVehicle}>{s.autoLoad?'LOADING…':'AUTO LOAD VEHICLE'}</button>:<button className="action priority-action" onClick={unloadAtDepot}>{s.autoUnload?'UNLOADING…':'UNLOAD AT DEPOT'}</button>}
    <div className="equipment-section-label">MANUAL WHEEL LIFT</div>
    <div className="equipment-row"><Hold disabled={!s.liftDeployed} label="LIFT UP" onDown={liftPress('liftControl',1)} onUp={liftPress('liftControl',0)}/><Hold disabled={!s.liftDeployed} label="LIFT DOWN" onDown={liftPress('liftControl',-1)} onUp={liftPress('liftControl',0)}/></div>
    <div className="equipment-row"><button className="action" disabled={!s.liftDeployed} onClick={toggleArms}>{s.armsClosed?'OPEN L-ARMS':'CLOSE L-ARMS'}</button><button className="action" disabled={!s.loaded||s.autoUnload} onClick={strapTires}>{s.strapsOn?'REMOVE STRAPS':'FIT STRAPS'}</button></div>
    {s.liftDeployed&&!s.loaded&&<div className={'lift-status '+(hud.gridContact?.ok?'aligned':'')}>{hud.gridContact?.ok?'TIRES ALIGNED':hud.armsClosed?'TIRES CAPTURED':'ALIGN FRONT TIRES • '+(hud.gridContact?.error?.toFixed(1)??'--')+' m'}</div>}
  </>}
  {s?.type.id==='flatbed'&&<>
   <div className="equipment-row"><Hold label="SLIDE OUT" onDown={bedPress('bedSlideControl',1)} onUp={bedPress('bedSlideControl',0)}/><Hold label="SLIDE IN" onDown={bedPress('bedSlideControl',-1)} onUp={bedPress('bedSlideControl',0)}/></div>
   <div className="equipment-row"><Hold label="TILT DOWN" onDown={bedPress('bedTiltControl',1)} onUp={bedPress('bedTiltControl',0)}/><Hold label="TILT UP" onDown={bedPress('bedTiltControl',-1)} onUp={bedPress('bedTiltControl',0)}/></div>
   <div className="lift-status">{rollbackStowed(s.bedSlide,s.bedProgress)?'BED LOCKED':creepReady(s)&&!s.parkingBrake?'CREEP FORWARD • 4 KM/H':rampReady(s)?'RAMP ON GROUND':'SLIDE '+Math.round(s.bedSlide*100)+'% · TILT '+Math.round(s.bedProgress*100)+'%'}</div>
   {!hud.hook&&!hud.loaded&&<><div className="equipment-row"><select className="action" aria-label="Choose winch hook position" value={s?.hookPoint??0} onChange={e=>{if(s&&!s.hook&&!s.loaded){s.hookPoint=Number(e.target.value);setNotice("Hook position: "+RECOVERY_POINTS[s.hookPoint].label);}}}>{RECOVERY_POINTS.slice(0,2).map((p,i)=><option key={p.id} value={i}>{p.label}</option>)}</select><button className="action" onClick={()=>{if(s&&!s.hook){s.hookRedirect=0;setNotice('DIRECT LINE selected.');}}}>DIRECT LINE</button></div></>}
   {!s.loaded&&<button className={'action '+(hud.hook?'active':'')} onClick={toggleHook}>{hud.hook?'UNHOOK VEHICLE':'CONNECT TO VEHICLE'}</button>}
   {hud.hook&&<div className="equipment-row winch-row"><Hold label="WINCH IN" onDown={press('winch',true)} onUp={press('winch',false)}/><Hold label="WINCH OUT" onDown={press('winchOut',true)} onUp={press('winchOut',false)}/></div>}
   <button className={'action priority-action '+(s.strapsOn?'active':'')} onClick={secureLoad}>{s.loaded?'REMOVE 4 STRAPS':'FIT 4 STRAPS'}</button>
  </>}
  {(s?.type.id==='medium'||s?.type.id==='offroad')&&<>
    {(!s.frontWinch||!showFrontWinch)&&<>
    {!hud.hook&&<><div className="equipment-row"><select className="action" aria-label="Choose winch hook position" value={s?.hookPoint??0} onChange={e=>{if(s&&!s.hook){s.hookPoint=Number(e.target.value);setNotice("Hook position: "+RECOVERY_POINTS[s.hookPoint].label);}}}>{RECOVERY_POINTS.map((p,i)=><option key={p.id} value={i}>{p.label}</option>)}</select><button className="action" onClick={changeHookRedirect}>{s?.riggingAnchors[s.hookRedirect].label??'DIRECT LINE'}</button></div><button className="action" onClick={()=>startAnchorPlacement(null)}>PLACE / MOVE ANCHOR</button></>}
    <button className={'action '+(hud.hook?'active':'')} onClick={toggleHook}>{hud.hook?'DISCONNECT HOOK':'CONNECT TO VEHICLE'}</button>
    {hud.hook&&<div className="equipment-row winch-row"><Hold label="WINCH IN" onDown={press('winch',true)} onUp={press('winch',false)}/><Hold label="WINCH OUT" onDown={press('winchOut',true)} onUp={press('winchOut',false)}/></div>}
    </>}
  </>}
  {s?.type.id==='medium'&&fieldLift}
  {s?.type.id==='hercules'&&<>
   <div className="equipment-row">
    <Hold label="BLADE DOWN" onDown={bladePress(1)} onUp={bladePress(0)}/>
    <Hold label="BLADE UP" onDown={bladePress(-1)} onUp={bladePress(0)}/>
   </div>
   <div className="lift-status">BLADE {Math.round(s.bladeDepth*100)}% · SINK {Math.round(s.sandSink*100)} cm</div>
   {!s.loaded&&<button className="action" onClick={toggleHook}>{s.hook?'DISCONNECT WINCH':'CONNECT TO ABRAMS'}</button>}
   {s.hook&&<div className="equipment-row winch-row">
    <Hold label="WINCH IN" onDown={press('winch',true)} onUp={press('winch',false)}/>
    <Hold label="PAY OUT" onDown={press('winchOut',true)} onUp={press('winchOut',false)}/>
   </div>}
   <button className="action priority-action" onClick={coupleTank}>{s.loaded?'TOW BAR COUPLED':'COUPLE TOW BAR'}</button>
  </>}
  {s?.type.id==='rotator'&&(()=>{
    const i=activeRecoveryLine,line=s.recoveryLines[i],letter=i===0?'A':'B',both=s.recoveryLines.every(l=>l.connected);
    return <>
     <div className="equipment-row three-controls winch-row">
      <button type="button" className={'action '+(line.connected?'active':'')} onClick={()=>toggleRecoveryLine(i)}>{line.connected?'UNHOOK':'CONNECT'}</button>
      <Hold key={'in-'+i} disabled={!line.connected} label="WINCH IN" onDown={recoveryPress(i,1)} onUp={recoveryPress(i,0)}/>
      <Hold key={'out-'+i} disabled={!line.connected} label="PAY OUT" onDown={recoveryPress(i,-1)} onUp={recoveryPress(i,0)}/>
     </div>
     {s.tandemHelper?<div className="equipment-row all-both-row"><small style={{color:'#ffe07a'}}>LOAD A {s.tandemUsed[0]?'✓':'—'} · B {s.tandemUsed[1]?'✓':'—'} · {i===1?'MEDIUM WRECKER':'ROTATOR'}</small></div>:<div className="equipment-row all-both-row winch-row">
      <Hold disabled={!both} label="WINCH BOTH" onDown={bothRecoveryPress(1)} onUp={bothRecoveryPress(0)}/>
      <Hold disabled={!both} label="PAY BOTH" onDown={bothRecoveryPress(-1)} onUp={bothRecoveryPress(0)}/>
     </div>}
     <div className="equipment-row">
      <select className="action" aria-label={'Line '+letter+' attachment point'} disabled={line.connected} value={line.customPoint?'custom':line.point} onChange={e=>{if(!line.connected&&e.target.value!=='custom'){line.point=Number(e.target.value);line.customPoint=null;setNotice('Hook position: '+RECOVERY_POINTS[line.point].label);}}}>
       {line.customPoint&&<option value="custom">CUSTOM HOOK</option>}{RECOVERY_POINTS.map((p,j)=><option key={p.id} value={j}>{p.label}</option>)}
      </select>
      <button type="button" className="action" disabled={line.connected} onClick={()=>startCustomHook(i)}>CUSTOM HOOK</button>
     </div>
     <div className="equipment-row">
      <button type="button" className="action" disabled={line.connected} onClick={()=>changeRecoveryRedirect(i)} title={s.riggingAnchors[line.redirect].label}>{line.secondRedirect?'DOUBLE ROUTE':s.riggingAnchors[line.redirect].label}</button>
      <button type="button" className="action" disabled={line.connected} onClick={()=>startAnchorPlacement(i)}>PLACE / MOVE {letter}</button>
     </div>
     <div className="equipment-row">
      <button type="button" className={'action '+(line.doubled?'active':'')} disabled={line.connected||!!s.tandemHelper} onClick={()=>toggleMovingBlock(i)}>{line.doubled?'2:1 BLOCK':'1:1 LINE'}</button>
      {s.secondary.active?<button type="button" className="action" disabled={line.connected} onClick={()=>changeRecoveryTarget(i)}>TARGET {line.target+1}</button>:<button type="button" className="action" disabled={!!s.tandemHelper||s.recoveryLines.some(l=>l.connected)} onClick={()=>{setActiveRecoveryLine(0);startDoubleAnchorSetup();}}>TWO-POINT A</button>}
     </div>
     <div className={'equipment-row '+(s.secondary.active?'three-controls':'')}>
      {s.secondary.active&&<button type="button" className="action" disabled={s.recoveryLines.some(l=>l.connected)} onClick={()=>{setActiveRecoveryLine(0);startDoubleAnchorSetup();}}>2-POINT A</button>}
      {[3,4].map((slot,j)=><button key={slot} type="button" className="action" disabled={!s.riggingAnchors[slot].pos||s.recoveryLines.some(l=>l.connected&&(l.redirect===slot||l.secondRedirect===slot))} onClick={()=>removePlacedAnchor(slot)}>REMOVE {j===0?'A':'B'}</button>)}
     </div>
    </>;
  })()}
 </>}
 </div></div><div className="drive"><Hold label="REV" onDown={press('throttle',-.55)} onUp={press('throttle',0)}/><Hold label="BRAKE" onDown={press('brake',1)} onUp={press('brake',0)}/><Hold label="GAS" wide onDown={press('throttle',1)} onUp={press('throttle',0)}/></div></div>
  <div className={'camera-dock'+(cameraPanelOpen?' camera-open':'')}>
  {!menuOpen&&<div className="camera-shortcuts" role="group" aria-label="Camera controls">
    <button type="button" className="camera-cycle" onClick={nextCamera} title="Cycle camera angles">CAM: {CAMERA_MODES.find(([id])=>id===cameraMode)?.[1]} ↻</button>
    <button type="button" className="camera-angles" onClick={()=>{setCameraPanelOpen(v=>!v);setMenuOpen(false);}} aria-expanded={cameraPanelOpen}>ANGLES {cameraPanelOpen?'−':'+'}</button>
  </div>}
  {cameraPanelOpen&&!menuOpen&&<div className="camera-selector" role="group" aria-label="Camera angle presets">
    {CAMERA_MODES.map(([id,label])=><button type="button" key={id} className={cameraMode===id?'selected':''} onClick={()=>changeCamera(id)}>{label}</button>)}
  </div>}
  </div>
  <div className={'toolbar'+(menuOpen?' menu-open':'')}>
  <button type="button" className="menu-toggle" aria-expanded={menuOpen} onClick={()=>{setMenuOpen(v=>!v);setCameraPanelOpen(false);setSettingsOpen(false);setGarage(false);setHelp(false);}}>{menuOpen?'CLOSE MENU ✕':'MENU ☰'}</button>
  {menuOpen&&<div className="toolbar-panel" role="dialog" aria-label="Options menu" aria-modal="true"><div className="checkpoint-actions">
   <div className="checkpoint-caption">{savedCheckpoint?'SAVED: LEVEL '+(savedCheckpoint.jobIndex%JOBS.length+1)+' • '+JOBS[savedCheckpoint.jobIndex%JOBS.length].name:'NO IN-PROGRESS SAVE'}</div>
   {automaticCheckpoint&&<button className="checkpoint-resume" onClick={()=>resumeSavedJob(true)}>RESUME AUTO-SAVE • LEVEL {automaticCheckpoint.jobIndex%JOBS.length+1}</button>}<button className="checkpoint-save" onClick={saveInProgress}>SAVE IN-PROGRESS</button>
   {savedCheckpoint&&<><button className="checkpoint-resume" onClick={()=>resumeSavedJob()}>RESUME SAVED JOB</button><button className="checkpoint-delete" onClick={deleteSavedJob}>DELETE SAVED JOB</button></>}
  </div><select aria-label="Select test job" value={career.job%JOBS.length} onChange={e=>selectTestJob(Number(e.target.value))} style={{background:"#153c43",color:"#fff",border:"2px solid #f3c851",borderRadius:7,padding:"8px",fontWeight:800,maxWidth:190}}>{JOBS.map((job,index)=><option key={job.name} value={index}>{index+1}. {job.name}</option>)}</select><button onClick={()=>{setMenuOpen(false);reset();setNotice('Dispatch: '+JOBS[careerRef.current.job%JOBS.length].name);}}>RESTART JOB</button><button onClick={()=>{setMenuOpen(false);setGarage(v=>!v);setHelp(false);}}>FLEET / GARAGE</button><button onClick={()=>{setMenuOpen(false);reset();}}>RESET</button><button onClick={()=>{setMenuOpen(false);changeCamera('orbit');}}>RESET CAMERA</button><button onClick={()=>{setMenuOpen(false);setSettingsOpen(v=>!v);}}>SETTINGS</button><button aria-pressed={!settings.soundMuted} onClick={()=>{const muted=!settings.soundMuted;if(!muted)audioRef.current?.unlock();else audioRef.current?.silence();changeSetting('soundMuted',muted);}}>{settings.soundMuted?'SOUND OFF':'SOUND ON'}</button><button onClick={()=>{setMenuOpen(false);setHelp(v=>!v);}}>CONTROLS</button></div>}</div>
  {settingsOpen&&<aside className="help" style={{zIndex:30,maxWidth:310}}><button onClick={()=>setSettingsOpen(false)}>×</button><b>CONTROL SETTINGS</b>{[['steering','Driving sensitivity',0.4,1.6],['boom','Boom / hydraulic sensitivity',0.3,2],['winch','Winch speed',0.3,2]].map(([key,label,min,max])=><label key={key}>{label}: {settings[key].toFixed(1)}× <input type="range" min={min} max={max} step="0.1" value={settings[key]} onChange={e=>changeSetting(key,Number(e.target.value))}/></label>)}<label>Sound <input type="checkbox" checked={!settings.soundMuted} onChange={e=>{if(e.target.checked)audioRef.current?.unlock();else audioRef.current?.silence();changeSetting('soundMuted',!e.target.checked);}}/></label><label>Sound volume: {Math.round((settings.soundVolume??.7)*100)}% <input type="range" min="0" max="1" step="0.05" value={settings.soundVolume??.7} onChange={e=>changeSetting('soundVolume',Number(e.target.value))}/></label><label>Steering <select value={settings.driveMode} onChange={e=>changeSetting('driveMode',e.target.value)}><option value="joystick">Joystick</option><option value="arrows">Arrows</option></select></label><small>Saved on this device.</small></aside>}{notice&&<div className="game-notice" onClick={()=>setNotice('')}>{notice} ✕</div>}
  {garage&&<aside className="help garage"><button onClick={()=>setGarage(false)}>×</button><b>RECOVERY GARAGE</b><span>TEST MODE: All jobs and trucks unlocked. Choose any job from the bottom toolbar.</span><span>Balance: ${career.cash}</span><div className="fleet-list">{FLEET.map(t=><button key={t.id} className="garage-buy" onClick={()=>chooseTruck(t.id)}>{t.name} · {career.selected===t.id?'SELECTED':'TEST DRIVE'}</button>)}</div><button className="garage-buy" onClick={()=>upgrade('engine')}>ENGINE LV {career.engine}/3 · {'$'+(career.engine+1)*500}</button><button className="garage-buy" onClick={()=>upgrade('winch')}>WINCH LV {career.winch}/3 · {'$'+(career.winch+1)*500}</button><small>Progress saves on this device.</small></aside>}
  {help&&<aside className="help instructions-panel" role="dialog" aria-label="Game instructions"><button type="button" className="instructions-close" onClick={()=>setHelp(false)} aria-label="Close instructions">×</button><button type="button" className="instructions-start" onClick={()=>setHelp(false)}>▶ START GAME</button><b>HOW TO OPERATE</b><span>Use the left joystick to steer. Reverse and gas are on the right. Release the gas to slow down; use PARK BRAKE to stop and secure the truck. Deploy the boom and parking brake before winching. The boom controls appear on the left. Move the joystick up or down to raise or lower the boom, and left or right to swing the rotator. Hold EXTEND or RETRACT to change its length. Winching heavy recoveries still requires both park brake and riggers. Park brake is required for capturing the tires and all heavy recovery operations; both light and medium wheel lifts can be deployed and adjusted at walking speed without the park brake while unloaded. Use CAM to cycle camera views or ANGLES for RAVINE, FREE, CHASE, REAR, FRONT, LEFT, RIGHT, TOP, HOOK and WIDE views. Drag to orbit; pinch to zoom any view. Drive within 24 m to hook the pickup. Light wheel-lift: tap LOWER WHEEL LIFT while moving slowly, reverse beneath the front tires until the status says TIRES ALIGNED, stop and apply PARK BRAKE, tap CLOSE L-ARMS, hold LIFT UP, tap FIT TIRE STRAPS, release brake and tow. Open WHEEL LIFT on the right to access these buttons. MENU opens separately at the top right. Flatbed: park and hold SLIDE OUT, then TILT DOWN. Hook and winch aboard; FIT 4 STRAPS. Hold TILT UP, then SLIDE IN before driving. At depot deploy the ramp manually, REMOVE 4 STRAPS, winch out, unhook on the ground, release PARK and creep forward clear of the car, then park and stow the deck. Ramp contact costs $75 per incident. If misaligned, unhook and reposition. Medium wrecker: fixed rear boom raises/lowers and telescopes but does not swing. Deploy the separate wheel lift while stopped or creeping in reverse. Hold LIFT UP/DOWN and adjust GRID width while lining up. Stop and apply PARK BRAKE to close L-arms, raise the captured axle and FIT STRAPS. At the green recovery circle, park, REMOVE STRAPS, lower the lift and release the tires. Only the heavy rotator can swing its boom with the riggers deployed. For a heavy rollover: deploy riggers and boom, connect LINE A and B to suitable simulated frame points, hold each independent winch (or use WINCH BOTH / PAY BOTH to operate them together) and watch the roll angle and tension. A connected idle line holds its length and can gain tension when another line pulls against it. Four outrigger pads settle independently. Watch PADS and LEAN; incomplete or highly loaded support slows reel-in, and fewer than two contacts prevents reel-in. Pay out to unload the rig. Some jobs have two trucks; select TARGET VEHICLE 1 or 2 for each line and bring both upright into the recovery zone. Game forces are simplified and not real-world rigging instructions. Buy trucks in FLEET / GARAGE.</span><small>Keyboard: W/S drive & reverse · A/D steer · H hook · R winch</small></aside>}
 </main>;
}
