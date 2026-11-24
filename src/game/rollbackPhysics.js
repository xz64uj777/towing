// Truck-local +Z points rearward. All heights describe the top of the deck.
export const ROLLBACK_LENGTH=6.5;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function rollbackDeck(slide,tilt=slide){
 const t=clamp(tilt,0,1),angle=.40*t,frontZ=.15+1.55*clamp(slide,0,1),rearZ=frontZ+ROLLBACK_LENGTH*Math.cos(angle);
 const rearY=1.56*(1-t)+.035*t,frontY=rearY+ROLLBACK_LENGTH*Math.sin(angle);
 return {angle,frontZ,rearZ,frontY,rearY,centerZ:(frontZ+rearZ)/2,centerY:(frontY+rearY)/2};
}
export function rollbackHeight(d,z){return z>=d.rearZ?0:d.frontY+(d.rearY-d.frontY)*clamp((z-d.frontZ)/(d.rearZ-d.frontZ),0,1);}
export function rollbackPose(d,z,scale,reverse=false){
 const a=1.55*scale,f=rollbackHeight(d,z-a),r=rollbackHeight(d,z+a);
 const pitch=Math.atan2(f-r,2*a);
 return {height:(f+r)/2,pitch:reverse?-pitch:pitch};
}
export const rollbackStop=d=>d.frontZ+3.18;
export const rollbackTravel=(d,z,dist)=>Math.max(rollbackStop(d),z-dist);
export const rollbackReady=(d,x,z,yaw,scale)=>rollbackAligned(x,yaw,scale)&&z>=rollbackStop(d)-.06&&z<=rollbackStop(d)+.18&&z+1.55*scale<d.rearZ;
export const rollbackCanConnect=(d,x,z,yaw,scale)=>Math.abs(x)<=1.25&&Math.abs(yaw)<=.70&&z>=rollbackGroundLimit(d,scale);

// Tire centers must fit inside the deck's usable width before either axle enters.
// No automatic sideways translation or heading correction is applied on the ramp.
export function rollbackAligned(x,yaw,scale){
 return Math.abs(yaw)<=.15&&Math.abs(x)+1.55*scale*Math.abs(Math.sin(yaw))<=.27;
}
export const rollbackGroundLimit=(d,scale)=>d.rearZ+1.55*scale;
export function rollbackApproachStep(d,x,z,yaw,scale,vx,vz,dt){
 const edge=rollbackGroundLimit(d,scale);
 const nextX=x+vx*dt,nextZ=z+vz*dt;
 if(nextZ>=edge)return {x:nextX,z:nextZ,blocked:false};
 // Stop at the ramp toe when the wheels cannot fit. Never teleport sideways.
 if(!rollbackAligned(nextX,yaw,scale)){
  const fraction=clamp((z-edge)/Math.max(1e-9,z-nextZ),0,1);
  return {x:x+(nextX-x)*fraction,z:edge,blocked:true};
 }
 // Move to the edge first; the next substep uses the deck constraint.
 return {x:nextX,z:edge,blocked:false};
}
export function rollbackCanUnhook(d,z,scale,parked,stationary){
 return parked&&stationary&&z>=rollbackGroundLimit(d,scale)-1e-7;
}

// Separate, momentary hydraulic controls with a simplified mechanical lockout.
export const rollbackRampReady=(slide,tilt)=>slide>=.999&&tilt>=.999;
export const rollbackStowed=(slide,tilt)=>slide<=.001&&tilt<=.001;
export function rollbackHydraulicStep(slide,tilt,slideInput,tiltInput,seconds,enabled){
 slide=clamp(slide,0,1);tilt=clamp(tilt,0,1);
 if(!enabled||seconds<=0)return {slide,tilt};
 if(tiltInput&&slide>=.999)tilt=clamp(tilt+Math.sign(tiltInput)*seconds*.52,0,1);
 else if(slideInput&&tilt<=.001)slide=clamp(slide+Math.sign(slideInput)*seconds*.56,0,1);
 return {slide,tilt};
}
export function rollbackTransportReady(slide,tilt,loaded,strapped,hook){
 return rollbackStowed(slide,tilt)&&(!loaded?!hook:!!strapped);
}
// Correct the original tire-center offset: wheel centers are .62 above the
// vehicle root, but the actual tire radius is .48, not .62.
export const rollbackContactHeight=(pose,scale)=>pose.height-.14*scale/Math.max(.85,Math.cos(pose.pitch));
export function rollbackTieDownPath(x,y,z,scale){
 const r=.493*scale,half=ROLLBACK_LENGTH/2,limit=v=>clamp(v,-half+.13,half-.13);
 const points=[{x,y:.125,z:limit(z-r-.30)}];
 for(let i=0;i<=12;i++){const angle=-Math.PI/2+Math.PI*i/12;points.push({x,y:y+r*Math.cos(angle),z:z+r*Math.sin(angle)});}
 points.push({x,y:.125,z:limit(z+r+.30)});
 return points;
}
