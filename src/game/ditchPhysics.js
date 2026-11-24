// Ground-constrained medium-wrecker recovery. This is a pull, not a crane lift.
// Heights match the visible Level 3 road, shoulder, ditch and surrounding plane.
// Blend the small steps so contact poses change continuously across their edges.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const f=clamp((x-a)/(b-a),0,1);return f*f*(3-2*f);};
const footprint=(x,z,cx,cz,hx,hz)=>(1-smooth(hx-.20,hx+.20,Math.abs(x-cx)))*(1-smooth(hz-.20,hz+.20,Math.abs(z-cz)));
export function ditchGroundHeight(x,z){
 let height=-.12;
 height+=(.01-height)*footprint(x,z,7.1,-36,2.5,90);
 height=Math.max(height,-.12+.015*footprint(x,z,10.5,-20,2,14));
 height+=(.04-height)*footprint(x,z,0,-36,5,90);
 return height;
}
export function ditchContactPose(x,z,yaw,scale=1){
 const fx=Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=Math.sin(yaw);
 const at=(f,r)=>ditchGroundHeight(x+fx*f+rx*r,z+fz*f+rz*r);
 // The four wheel centers are at +/-1.55 longitudinal and +/-1.06 lateral.
 const fl=at(1.55,-1.06),fr=at(1.55,1.06),rl=at(-1.55,-1.06),rr=at(-1.55,1.06);
 const front=(fl+fr)/2,rear=(rl+rr)/2,left=(fl+rl)/2,right=(fr+rr)/2;
 return {height:(front+rear)/2-.14*scale,pitch:Math.atan2(front-rear,3.10),roll:Math.atan2(right-left,2.12)};
}
export function groundCableDelta(direction,tension,mass,seconds){
 // Keep the magnitude of the horizontal projection, rather than normalizing
 // it again: a steeper cable has less horizontal pulling force.
 const amount=Math.max(0,tension)*Math.max(0,seconds)/Math.max(1,mass);
 return {x:direction.x*amount,y:0,z:direction.z*amount};
}
export function ditchGroundStep(position,velocity,yaw,scale,seconds){
 const x=position.x+velocity.x*seconds,z=position.z+velocity.z*seconds;
 const pose=ditchContactPose(x,z,yaw,scale);
 return {x,y:pose.height,z,pitch:pose.pitch,roll:pose.roll};
}
