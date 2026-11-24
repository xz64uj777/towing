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

export const ROTATOR_LINE_RATING=42000;

export function recoverySupport(lines, grade) {
 // Sum signed reactions in normalized support coordinates before limiting load.
 const support=Math.max(.45,1-Math.abs(grade)*.4);
 const budgets=[54000,92000,170000];
 const vectors=lines.map(({response})=>response.map((load,axis)=>load/(budgets[axis]*support)));
 const total=[0,0,0];
 const demands=lines.map(({demand},i)=>{
  const tension=Math.min(ROTATOR_LINE_RATING,demand);
  for(let axis=0;axis<3;axis++)total[axis]+=vectors[i][axis]*tension;
  return tension;
 });
 const scale=1/Math.max(1,Math.hypot(...total));
 return demands.map((demand,i)=>{
  const tension=demand*scale, vector=vectors[i];
  const other=total.map((load,axis)=>load*scale-vector[axis]*tension);
  const a=vector.reduce((sum,value)=>sum+value*value,0);
  if(a===0)return {tension,limit:ROTATOR_LINE_RATING};
  const b=vector.reduce((sum,value,axis)=>sum+value*other[axis],0);
  const c=other.reduce((sum,value)=>sum+value*value,0)-1;
  // Maximum tension this line can carry with the other loads held.
  const limit=(-b+Math.sqrt(Math.max(0,b*b-a*c)))/a;
  return {tension,limit:Math.min(ROTATOR_LINE_RATING,Math.max(tension,limit))};
 });
}

export function uprightRollAcceleration(roll) {
 // Tire support comes back progressively as the chassis approaches upright.
 const contact=smooth((.60-Math.abs(roll))/.28);
 return -2.8*contact*Math.sin(roll);
}

export function resolveObstacle(x,z,centerX,centerZ,clearance) {
 const dx=x-centerX,dz=z-centerZ,distance=Math.hypot(dx,dz);
 if(distance>=clearance)return null;
 const nx=distance>1e-8?dx/distance:1,nz=distance>1e-8?dz/distance:0;
 return {x:centerX+nx*clearance,z:centerZ+nz*clearance,nx,nz};
}
