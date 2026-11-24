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
