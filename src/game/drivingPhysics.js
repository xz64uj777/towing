// Game-tuned vehicle controls, not real truck performance specifications.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function steeringStep(previous,input,sensitivity,speed,dt,heavy=false){
 const max=(heavy?.49:.62)-Math.min(.35,Math.abs(speed)/22*.35);
 const target=clamp(input*sensitivity,-1,1)*max;
 const change=(heavy?1.25:2.5)*Math.max(0,dt);
 return previous+clamp(target-previous,-change,change);
}
export function brakeStep(speed,rate,dt){
 return Math.sign(speed)*Math.max(0,Math.abs(speed)-Math.max(0,rate)*Math.max(0,dt));
}
export function chassisGrade(slope,yaw){
 const c=Math.cos(yaw),s=Math.sin(yaw);
 return {pitch:clamp(-Math.atan(-s*slope.x+c*slope.z),-.30,.30),roll:clamp(Math.atan(c*slope.x+s*slope.z),-.48,.48)};
}
export function cameraGroundClearance(position,ground,clearance=1.15){
 // Never let touch orbit, zoom or a hook view put the camera below the mesh.
 return {...position,y:Math.max(position.y,ground(position.x,position.z)+clearance)};
}
