// Introductory tandem recovery: one powered winch per truck. The support
// truck is staged and parked, so the player learns tension handoffs first.
export const TANDEM_SITE_INDEX=7;
export const TANDEM_HELPER=Object.freeze({x:-12,z:-108,yaw:0,limit:32000});
export const isSupportLine=(s,index)=>Boolean(s.tandemHelper&&index===1);
export const lineLimit=(s,index)=>isSupportLine(s,index)?TANDEM_HELPER.limit:42000;
export const tandemComplete=(used,ready)=>Boolean(ready&&used?.[0]&&used?.[1]);
export function noteTandemUse(used,index,motor,tension){
 if(used&&motor>0&&tension>=1000)used[index]=true;
}
export function switchTandemControl(s,index){
 if(!s.tandemHelper)return;
 s.tandemSelected=index===1?1:0;
 s.throttle=0;s.steer=0;s.brake=0;
 s.boomControl=0;s.boomExtendControl=0;s.boomSwingControl=0;
 for(const line of s.recoveryLines)line.motor=0;
}
export function migrateJobIndex(index,oldCount,newCount=8){
 if(!Number.isInteger(index)||index<0)return 0;
 if(oldCount===newCount)return index;
 const count=oldCount===7?7:newCount;
 return Math.floor(index/count)*newCount+index%count;
}
