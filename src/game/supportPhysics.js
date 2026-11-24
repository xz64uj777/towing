// Game-tuned support forces; not a real equipment capacity chart.
export function supportReaction(route, tension, doubled=false) {
 const unit=(a,b)=>{const d=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);return d>1e-8?{x:(a.x-b.x)/d,y:(a.y-b.y)/d,z:(a.z-b.z)/d}:{x:0,y:0,z:0};};
 const a=unit(route[1],route[0]), b=doubled?unit(route[route.length-2],route[route.length-1]):{x:0,y:0,z:0};
 return {x:tension*(a.x+.90*b.x),y:tension*(a.y+.90*b.y),z:tension*(a.z+.90*b.z)};
}
export function supportState(force, traction, deployed, mass=23000) {
 const horizontal=Math.hypot(force.x,force.z), weight=Math.max(0,mass*9.81-force.y);
 const capacity=Math.max(1000,weight*(deployed?.58:.36)*Math.max(.1,Math.min(1,traction)));
 const ratio=horizontal/capacity, accel=Math.min(.8,Math.max(0,horizontal-capacity)/mass);
 return {ratio,ax:horizontal>0?accel*force.x/horizontal:0,az:horizontal>0?accel*force.z/horizontal:0};
}
