// Roll contact from the actual rendered model's projected convex hull.
// A fixed lift cannot support a vehicle on its roof or side.
export function rollHull(points){
 const sorted=points.map(p=>({x:p.x,y:p.y})).sort((a,b)=>a.x-b.x||a.y-b.y);
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const chain=arr=>{const h=[];for(const p of arr){while(h.length>=2&&cross(h.at(-2),h.at(-1),p)<=1e-10)h.pop();h.push(p);}return h;};
 if(sorted.length<2)return sorted;
 return [...chain(sorted).slice(0,-1),...chain([...sorted].reverse()).slice(0,-1)];
}
export function modelRollHull(T,root){
 root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert(),m=new T.Matrix4(),v=new T.Vector3(),points=[];
 root.traverseVisible(o=>{
  if(!o.isMesh||!o.geometry?.attributes.position)return;
  const p=o.geometry.attributes.position;m.multiplyMatrices(inverse,o.matrixWorld);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);points.push({x:v.x,y:v.y});}
 });
 return rollHull(points);
}
export function rollContactOffset(hull,roll){
 if(!hull?.length)return .5+Math.sin(roll)*.16;
 const c=Math.cos(roll),s=Math.sin(roll);
 let bottom=Infinity;for(const p of hull)bottom=Math.min(bottom,p.x*s+p.y*c);
 return -bottom+.008;
}

// The supported center of mass rises as the body rocks toward an edge.
// Gravity follows the height gradient, including when both cables are slack.
export function recoveryRollStep(hull,roll,velocity,cableAcceleration,seconds){
 let acceleration=cableAcceleration;
 if(hull?.length){
  let bottom=Infinity,top=-Infinity,halfWidth=0;
  for(const point of hull){
   bottom=Math.min(bottom,point.y);
   top=Math.max(top,point.y);
   halfWidth=Math.max(halfWidth,Math.abs(point.x));
  }
  const centerY=bottom+(top-bottom)*.42;
  const supportedHeight=angle=>rollContactOffset(hull,angle)+centerY*Math.cos(angle);
  const probe=.002,height=supportedHeight(roll);
  const gravity=.28/Math.max(halfWidth,top-centerY,.1);
  const left=cableAcceleration-gravity*(height-supportedHeight(roll-probe))/probe;
  const right=cableAcceleration-gravity*(supportedHeight(roll+probe)-height)/probe;
  if(Math.abs(velocity)<.015){
   // At a contact corner, forces on both sides can oppose leaving the resting face.
   if(left>=0&&right<=0)return {roll,velocity:0};
   acceleration=left+right>=0?right:left;
  }else{
   acceleration=velocity>0?right:left;
  }
 }
 const nextVelocity=Math.max(-1.5,Math.min(1.5,(velocity+acceleration*seconds)*Math.exp(-1.7*seconds)));
 const nextRoll=roll+nextVelocity*seconds;
 return {roll:Math.atan2(Math.sin(nextRoll),Math.cos(nextRoll)),velocity:nextVelocity};
}
