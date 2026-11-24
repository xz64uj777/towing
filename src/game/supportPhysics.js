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

// Game-tuned chassis dynamics. Four support pads in FL, FR, RL, RR order.
// Moments are about the center of the support rectangle in truck-local axes.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const SUPPORT_PADS=Object.freeze([{x:-2.5,z:-1.25},{x:2.5,z:-1.25},{x:-2.5,z:1.6},{x:2.5,z:1.6}].map(Object.freeze));
export function supportWrench(route,tension,doubled,origin,yaw){
 const c=Math.cos(yaw),s=Math.sin(yaw),local=v=>({x:c*v.x+s*v.z,y:v.y,z:-s*v.x+c*v.z});
 const result={x:0,y:0,z:0,mx:0,mz:0};
 const leg=(a,b,load)=>{
  const d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
  if(d<1e-8)return;
  const f=local({x:(b.x-a.x)*load/d,y:(b.y-a.y)*load/d,z:(b.z-a.z)*load/d});
  const r=local({x:a.x-origin.x,y:a.y-origin.y,z:a.z-origin.z});
  result.x+=f.x;result.y+=f.y;result.z+=f.z;
  result.mx+=r.y*f.z-r.z*f.y;result.mz+=r.x*f.y-r.y*f.x;
 };
 leg(route[0],route[1],tension);
 if(doubled)leg(route.at(-1),route.at(-2),.90*tension);
 return result;
}
export function outriggerLoads(wrench,contacts,mass=23000){
 const weight=Math.max(1,mass*9.81-wrench.y);
 const lateral=-wrench.mz/(weight*2.5),longitudinal=wrench.mx/(weight*1.425);
 const ratio=Math.max(Math.abs(lateral),Math.abs(longitudinal));
 const x=clamp(lateral,-1,1),z=clamp(longitudinal,-1,1);
 const raw=SUPPORT_PADS.map((p,i)=>contacts[i]?.contact?Math.max(0,(1+Math.sign(p.x)*x)*(1+Math.sign(p.z-.175)*z)/4):0);
 const sum=raw.reduce((a,b)=>a+b,0),count=contacts.filter(c=>c.contact).length;
 const loads=raw.map(v=>sum>1e-8?weight*v/sum:0);
 const grip=loads.reduce((n,v,i)=>n+v*clamp(contacts[i]?.traction??0,0,1),0)/weight;
 // Missing pads reduce effective support. This is a bounded approximation,
 // not a rigid-body tipping or real-world capacity solver.
 return {loads,count,ratio:Math.max(ratio,count===4?0:count===3?.65:count===2?1:1.35),lateral,longitudinal,grip:grip*(.4+.6*count/4)};
}
export function padContact(topY,groundY,maxStroke=1.85){
 const stroke=topY-groundY-.07;
 return {contact:stroke>=.12&&stroke<=maxStroke,footY:topY-clamp(stroke,.12,maxStroke),stroke:clamp(stroke,.12,maxStroke)};
}
export function suspensionStep(previous,acceleration,sideAcceleration,support,seconds,rigged){
 const a=1-Math.exp(-Math.max(0,seconds)*(rigged?5:7));
 const pitch=clamp(acceleration*.008+clamp(support?.longitudinal??0,-1.5,1.5)*.055,-.10,.10);
 const roll=clamp(sideAcceleration*.010-clamp(support?.lateral??0,-1.5,1.5)*.065,-.11,.11);
 const heave=rigged?-.035*Math.min(1.5,support?.ratio??0):-.015*Math.min(3,Math.abs(acceleration)+Math.abs(sideAcceleration));
 return {pitch:previous.pitch+(pitch-previous.pitch)*a,roll:previous.roll+(roll-previous.roll)*a,heave:previous.heave+(heave-previous.heave)*a};
}
