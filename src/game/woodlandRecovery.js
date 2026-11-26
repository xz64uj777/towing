import {cablePathSpeed,standardWinchStep} from './cablePhysics.js';

export const WOODLAND_PULL_ANCHORS=[
 {x:7,z:-99,label:'LOWER TRAIL ANCHOR'},
 {x:3,z:-75,label:'UPPER TRAIL ANCHOR'},
 {x:16,z:-87,label:'EAST TRAIL ANCHOR'},
];
export const FRONT_WINCH_CRAWL=2;
export const makeFrontWinch=()=>({anchor:-1,spool:0,motor:0,previousDistance:null,tension:0,stalled:false});

export function frontWinchReach(head,forward,anchor){
 const x=anchor.x-head.x,z=anchor.z-head.z,range=Math.hypot(x,z);
 return range>=1.8&&range<=20&&(x*forward.x+z*forward.z)/range>=.30;
}

export function woodlandBogged(wasBogged,depth,speed){
 return wasBogged?depth>.38:depth>.68&&speed<1.35;
}

export function frontWinchStep(line,head,anchor,parked,seconds,speed){
 const x=anchor.x-head.x,y=anchor.y-head.y,z=anchor.z-head.z;
 const distance=Math.hypot(x,y,z);
 const motor=parked&&line.motor>0?0:line.motor;
 const load=standardWinchStep({distance,spool:line.spool,
  pathSpeed:cablePathSpeed(distance,line.previousDistance,seconds),hold:true,motor,speed,seconds,min:1.8,
 });
 const impulse=!parked&&distance>.01?load.tension*seconds/(12000*distance):0;
 return {spool:load.spool,tension:load.tension,stalled:motor>0&&load.stalled,previousDistance:distance,x:x*impulse,z:z*impulse};
}
