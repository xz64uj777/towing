// Device-local snapshot for an unfinished dispatch. This never replaces career storage.
import {SITE_REVISION} from './dispatchSites.js';
import {migrateJobIndex,stopTruckInputs} from './tandemRecovery.js';
import {makeFrontWinch,WOODLAND_PULL_ANCHORS} from './woodlandRecovery.js';
import {parkingBrakeForRiggers} from './gameRules.js';
export const RECOVERY_SAVE_KEY='towing-in-progress-v1';
const vec=v=>v?{x:v.x,y:v.y,z:v.z}:null;
const validVec=v=>v&&[v.x,v.y,v.z].every(Number.isFinite);
const validNum=n=>typeof n==='number'&&Number.isFinite(n);
const index=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
export function captureRecoverySave(career,s){
 return {version:1,siteRevision:SITE_REVISION,savedAt:Date.now(),jobIndex:s.jobIndex,jobCount:career.jobCount??7,
 frontWinch:s.frontWinch?{anchor:s.frontWinch.anchor,spool:s.frontWinch.spool,bogged:s.woodlandBogged}:null,
 tandemUsed:s.tandemHelper?[...s.tandemUsed]:null,
 tandemSelected:s.tandemHelper?s.tandemSelected:null,
 helper:s.helperState?{pos:vec(s.helperState.pos),yaw:s.helperState.yaw,parkingBrake:s.helperState.parkingBrake,boomAngle:s.helperState.boomAngle,boomExtension:s.helperState.boomExtension}:null,
 career:{...career,job:s.jobIndex,selected:s.type.id},
 truck:{pos:vec(s.pos),yaw:s.yaw},
 vehicle:{pos:vec(s.pickPos),yaw:s.pickYaw,roll:s.pickRoll},
 secondary:{pos:vec(s.secondary.pos),yaw:s.secondary.yaw,roll:s.secondary.roll,active:s.secondary.active},
 equipment:Object.fromEntries(['parkingBrake','riggersDeployed','boomDeployed','boomAngle','boomSwing','boomExtension',
 'liftDeployed','liftHeight','liftExtension','gridWidth','armsClosed','loaded','strapsOn','bedTilt','bedSlide','bedProgress','hook',
 'hookPoint','hookRedirect','cableLength','woodlandExtracted','rollbackLoadX','rollbackLoadYaw','rollbackLoadZ','recoveryDamage','siteFailed','autoLoad','autoUnload','dropoffArrived','dropoffComplete','winchSpeed']
 .map(k=>[k,s[k]])),
 anchors:s.riggingAnchors.slice(3,5).map(a=>vec(a.pos)),
 lines:s.recoveryLines.map(l=>({connected:l.connected,point:l.point,customPoint:l.customPoint?{...l.customPoint}:null,
  redirect:l.redirect,secondRedirect:l.secondRedirect||0,target:l.target,spool:l.spool,doubled:!!l.doubled})),
 camera:{mode:s.cameraMode,yaw:s.cameraYaw,pitch:s.cameraPitch,presetYaw:s.presetYaw,presetPitch:s.presetPitch,zoom:s.zoom}};
}
export function parseRecoverySave(raw,jobCount){
 try{
  const s=typeof raw==='string'?JSON.parse(raw):raw;
  if(!s||s.version!==1||!Number.isInteger(s.jobIndex)||s.jobIndex<0||s.jobIndex>99999||
  !Number.isInteger(jobCount)||jobCount<1||!s.career||
  !['light','flatbed','medium','rotator','offroad'].includes(s.career.selected)||
  !s.truck||!validVec(s.truck.pos)||!validNum(s.truck.yaw)||
  !s.vehicle||!validVec(s.vehicle.pos)||!validNum(s.vehicle.yaw)||!validNum(s.vehicle.roll)||
  !s.secondary||!validVec(s.secondary.pos)||!validNum(s.secondary.yaw)||!validNum(s.secondary.roll)||
  !s.equipment||!Array.isArray(s.anchors)||s.anchors.length!==2||
  !s.anchors.every(a=>a===null||validVec(a))||
  !Array.isArray(s.lines)||s.lines.length!==2||
  !s.lines.every(l=>l&&typeof l.connected==='boolean'&&index(l.point,9)&&index(l.target,1)&&
    index(l.redirect,4)&&index(l.secondRedirect,4)&&(l.doubled===undefined||typeof l.doubled==='boolean')&&validNum(l.spool)&&l.spool>=0&&l.spool<=100&&
    (!l.customPoint||[l.customPoint.x,l.customPoint.y,l.customPoint.z].every(validNum)))||
  !s.camera||!validNum(s.camera.zoom))return null;
  if(jobCount>=8){const jobIndex=migrateJobIndex(s.jobIndex,s.jobCount??7,jobCount);return {...s,jobCount,jobIndex,career:{...s.career,job:jobIndex,jobCount}};}
  return s;
 }catch{return null;}
}
export function restoreRecoverySave(s,saved,V){
 const put=(to,from)=>to.set(from.x,from.y,from.z);
 put(s.pos,saved.truck.pos);s.vel.set(0,0,0);s.yaw=saved.truck.yaw;
 put(s.pickPos,saved.vehicle.pos);s.pickVel.set(0,0,0);s.pickYaw=saved.vehicle.yaw;
 s.pickYawVel=0;s.pickRoll=saved.vehicle.roll;s.pickRollVel=0;
 put(s.secondary.pos,saved.secondary.pos);s.secondary.vel.set(0,0,0);
 s.secondary.yaw=saved.secondary.yaw;s.secondary.yawVel=0;
 s.secondary.roll=saved.secondary.roll;s.secondary.rollVel=0;
 s.secondary.active=!!saved.secondary.active;s.secondary.mesh.visible=s.secondary.active;
 for(const [key,value] of Object.entries(saved.equipment))if(key in s)s[key]=value;
 s.parkingBrake=parkingBrakeForRiggers(s.parkingBrake,s.riggersDeployed);
 if(s.type.id==='flatbed'){const legacy=saved.equipment.bedTilt?1:0;const limit=n=>Math.max(0,Math.min(1,n));s.bedSlide=validNum(saved.equipment.bedSlide)?limit(saved.equipment.bedSlide):legacy;s.bedProgress=validNum(saved.equipment.bedProgress)?limit(saved.equipment.bedProgress):legacy;if(s.bedProgress>.001)s.bedSlide=1;s.bedTilt=s.bedProgress>.001;s.bedSlideControl=0;s.bedTiltControl=0;if(s.bedSlide>.001||s.bedProgress>.001||s.hook)s.parkingBrake=true;}
 for(let i=0;i<2;i++){
  const point=saved.anchors[i],anchor=s.riggingAnchors[i+3];
  anchor.pos=point?V(point.x,point.y,point.z):null;
  anchor.marker.visible=!!point;
  if(point)anchor.marker.position.set(point.x,point.y-.55,point.z);
  Object.assign(s.recoveryLines[i],saved.lines[i],{doubled:!!saved.lines[i].doubled,motor:0,tension:0,strain:0,stalled:false,previousDistance:null});
 }
 for(const [key,min,max] of [['rollbackLoadX',-.27,.27],['rollbackLoadYaw',-.15,.15],['rollbackLoadZ',0,.18]])s[key]=validNum(saved.equipment[key])?Math.max(min,Math.min(max,saved.equipment[key])):0;
 s.recoveryDamage=validNum(saved.equipment.recoveryDamage)?Math.max(0,Math.min(750,saved.equipment.recoveryDamage)):0;s.bedContactLatch=false;
 if(s.tandemHelper){
  s.tandemUsed=[!!saved.tandemUsed?.[0],!!saved.tandemUsed?.[1]];
  s.tandemSelected=saved.tandemSelected===1?1:0;
  const helper=s.helperState,checkpoint=saved.helper;
  if(helper&&checkpoint&&validVec(checkpoint.pos)&&validNum(checkpoint.yaw)){
   put(helper.pos,checkpoint.pos);helper.yaw=checkpoint.yaw;
   helper.boomAngle=validNum(checkpoint.boomAngle)?Math.max(0,Math.min(1.08,checkpoint.boomAngle)):.28;
   helper.boomExtension=validNum(checkpoint.boomExtension)?Math.max(0,Math.min(2.2,checkpoint.boomExtension)):0;
  }
  if(helper){
   helper.parkingBrake=s.tandemSelected===0||s.recoveryLines[1].connected||checkpoint?.parkingBrake!==false;
   helper.boomDeployed=helper.parkingBrake;
   helper.vel.set(0,0,0);stopTruckInputs(helper);
  }
 }
 if(s.frontWinch){
  const line=saved.frontWinch;
  s.frontWinch=makeFrontWinch();
  if(!s.hook&&line&&index(line.anchor,WOODLAND_PULL_ANCHORS.length-1)&&validNum(line.spool)&&line.spool>=0&&line.spool<=90){
   s.frontWinch.anchor=line.anchor;s.frontWinch.spool=line.spool;
  }
  s.woodlandBogged=line?.bogged===true;
 }
 s.hookPoint=index(s.hookPoint,9)?s.hookPoint:0;
 s.hookRedirect=index(s.hookRedirect,4)?s.hookRedirect:0;
 s.winch=false;s.winchOut=false;s.throttle=0;s.brake=0;s.steer=0;s.tension=0;s.previousCableDistance=null;s.cableStrain=0;s.cableStalled=false;
 s.boomControl=0;s.boomExtendControl=0;s.boomSwingControl=0;
 s.liftControl=0;s.liftExtendControl=0;s.liftHydraulicX=0;s.liftHydraulicY=0;
 s.prevHitch=null;s.anchorPlacement=null;s.customHookPlacement=null;s.doubleAnchorSetup=false;
 if(typeof saved.camera.mode==='string')s.cameraMode=saved.camera.mode;
 for(const [dst,src] of [['cameraYaw','yaw'],['cameraPitch','pitch'],['presetYaw','presetYaw'],
  ['presetPitch','presetPitch'],['zoom','zoom']]){
  if(validNum(saved.camera[src]))s[dst]=saved.camera[src];
 }
}
