// Tandem practice: independently driven trucks, one powered winch each.
export const TANDEM_SITE_INDEX=7;
export const TANDEM_HELPER=Object.freeze({x:-12,z:-108,yaw:0,limit:32000});
export const isSupportLine=(s,index)=>Boolean(s.tandemHelper&&index===1);
export const lineLimit=(s,index)=>isSupportLine(s,index)?TANDEM_HELPER.limit:42000;
export const tandemComplete=(used,ready)=>Boolean(ready&&used?.[0]&&used?.[1]);
export function noteTandemUse(used,index,motor,tension){
 if(used&&motor>0&&tension>=1000)used[index]=true;
}
export const controlledTruck=s=>s.tandemSelected===1&&s.helperState?s.helperState:s;
export const lineOwner=(s,index)=>isSupportLine(s,index)&&s.helperState?s.helperState:s;
export const ownerHasCable=(s,index)=>s.tandemHelper?!!s.recoveryLines[index]?.connected:s.recoveryLines.some(l=>l.connected);
const speedOf=a=>a.vel?.length?.()??Math.hypot(a.vel?.x??0,a.vel?.z??0);
export const linePowerReady=(s,index)=>{const a=lineOwner(s,index);return !!a.parkingBrake&&!!a.boomDeployed&&(isSupportLine(s,index)||!!a.riggersDeployed)&&speedOf(a)<.25;};
export function stopTruckInputs(a){if(!a)return;a.throttle=0;a.steer=0;a.brake=0;a.boomControl=0;a.boomExtendControl=0;a.boomSwingControl=0;}
export function switchTandemControl(s,index){
 if(!s.tandemHelper)return false;
 const a=controlledTruck(s);if(speedOf(a)>.25)return false;
 stopTruckInputs(s);stopTruckInputs(s.helperState);for(const line of s.recoveryLines)line.motor=0;
 a.parkingBrake=true;a.boomDeployed=true;a.vel?.set?.(0,0,0);
 s.tandemSelected=index===1?1:0;
 // Selecting an unrigged truck enters driving mode; a connected or rigged truck stays parked.
 const next=controlledTruck(s);if(!ownerHasCable(s,s.tandemSelected)&&!next.riggersDeployed){next.parkingBrake=false;next.boomDeployed=false;next.boomAngle=next===s ? .36 : .28;next.boomExtension=0;next.boomSwing=0;}return true;
}
export function makeHelperState(V){return {pos:V(TANDEM_HELPER.x,.04,TANDEM_HELPER.z),vel:V(0,0,0),yaw:TANDEM_HELPER.yaw,steerAngle:0,throttle:0,steer:0,brake:0,parkingBrake:true,boomDeployed:true,boomAngle:.28,boomExtension:0,boomControl:0,boomExtendControl:0,boomSwingControl:0,riggersDeployed:false,supportRatio:0};}
export function stepHelper(a,dt,surface,steering,engine,steeringStep,brakeStep){
 const f={x:Math.sin(a.yaw),z:-Math.cos(a.yaw)},r={x:Math.cos(a.yaw),z:Math.sin(a.yaw)};
 const speed=a.vel.x*f.x+a.vel.z*f.z;
 a.steerAngle=steeringStep(a.steerAngle,a.steer,steering,speed,dt,false);
 const next=a.parkingBrake||a.brake?brakeStep(speed,18,dt):speed+(a.throttle*(4.4+engine*.7)*surface.traction-speed*.22)*dt;
 const side=a.vel.x*r.x+a.vel.z*r.z,damp=1-Math.exp(-12.5*surface.lateralGrip*dt);
 a.vel.x+=(next-speed)*f.x-side*r.x*damp;a.vel.z+=(next-speed)*f.z-side*r.z*damp;
 const drag=Math.pow(.985,dt*60)*Math.exp(-Math.max(0,surface.drag-.36)*.5*dt);a.vel.x*=drag;a.vel.z*=drag;
 const v=Math.hypot(a.vel.x,a.vel.z);if(v>14){a.vel.x*=14/v;a.vel.z*=14/v;}
 if(!a.parkingBrake)a.yaw+=Math.max(-1.25,Math.min(1.25,(a.vel.x*f.x+a.vel.z*f.z)/3.1*Math.tan(a.steerAngle)*surface.traction))*dt;
 a.pos.x+=a.vel.x*dt;a.pos.z+=a.vel.z*dt;return next;
}
export function tandemContactBlocked(before,after,other,minDistance=5.6){const a=Math.hypot(before.x-other.x,before.z-other.z),b=Math.hypot(after.x-other.x,after.z-other.z);return b<minDistance&&b<a;}
export function migrateJobIndex(index,oldCount,newCount=8){
 if(!Number.isInteger(index)||index<0)return 0;
 if(oldCount===newCount)return index;
 const count=oldCount===7?7:newCount;
 return Math.floor(index/count)*newCount+index%count;
}

export function tandemDriveBlock(s){const a=controlledTruck(s),letter=s.tandemSelected===1?'B':'A';if(ownerHasCable(s,s.tandemSelected??0))return 'TRUCK '+letter+': disconnect its cable before driving.';if(a.riggersDeployed)return 'TRUCK '+letter+': retract riggers before driving.';if(a.parkingBrake)return 'TRUCK '+letter+': release PARK BRAKE before driving.';return '';}
