const STEP=1/120;
const smooth=(value)=>{
 const t=Math.max(0,Math.min(1,value));
 return t*t*(3-2*t);
};

export function physicsFrame(elapsed, remainder) {
 const total=remainder+Math.max(0,Math.min(.1,elapsed));
 const steps=Math.floor((total+1e-9)/STEP);
 return {steps,h:STEP,remainder:Math.max(0,total-steps*STEP)};
}

export function ditchHeight(x,z) {
 return -.95*smooth((2-Math.abs(x-10.5))/1.3)*smooth((14-Math.abs(z+20))/3);
}

export function stabilityScale(lateralForce, rollMoment, pitchMoment, grade) {
 // Tuned game limits for a deployed rotator. Support decreases on uneven ground.
 const support=Math.max(.45,1-Math.abs(grade)*.4);
 const utilization=Math.hypot(lateralForce/54000,rollMoment/92000,pitchMoment/170000)/support;
 return utilization>1?1/utilization:1;
}

export function resolveObstacle(x,z,centerX,centerZ,clearance) {
 const dx=x-centerX,dz=z-centerZ,distance=Math.hypot(dx,dz);
 if(distance>=clearance)return null;
 const nx=distance>1e-8?dx/distance:1,nz=distance>1e-8?dz/distance:0;
 return {x:centerX+nx*clearance,z:centerZ+nz*clearance,nx,nz};
}
