// Simplified simulator cable model. Coefficients and strain are game-tuned,
// not equipment specifications or field rigging calculations.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const unit=(a,b)=>{const d=length(a,b);return d>1e-9?{x:(a.x-b.x)/d,y:(a.y-b.y)/d,z:(a.z-b.z)/d}:{x:0,y:0,z:0};};

// Fixed redirects only change direction. A moving block at the target is
// supported by its incoming and return legs; their forces add as vectors.
export function cableGeometry(points,doubled=false){
 const eyeIndex=points.length-(doubled?2:1),eye=points[eyeIndex];
 const a=unit(points[eyeIndex-1],eye);
 const b=doubled?unit(points[eyeIndex+1],eye):{x:0,y:0,z:0};
 const force={x:a.x+.90*b.x,y:a.y+.90*b.y,z:a.z+.90*b.z};
 let distance=0;
 for(let i=1;i<points.length;i++)distance+=length(points[i],points[i-1]);
 return {distance,force,advantage:Math.hypot(force.x,force.y,force.z)};
}
// Path speed includes boom, anchors and rotating/moving attachment points.
// The first physics step after connecting or resuming has no derivative spike.
export function cablePathSpeed(distance,previous,dt){
 return Number.isFinite(previous)&&dt>0?clamp((distance-previous)/dt,-12,12):0;
}
export function cableLoad(distance,spool,pathSpeed,limit){
 const stretch=Math.max(0,distance-spool);
 // Preserve the previous game force scale while allowing longer cables to be softer.
 const stiffness=7200*clamp(20/Math.max(1,spool),.70,1.50);
 const demand=stretch>0?Math.max(0,stretch*stiffness+pathSpeed*1000):0;
 return {tension:Math.min(limit,demand),strain:100*stretch/Math.max(1,spool),stalled:demand>=limit};
}
export function cableReelStep(spool,motor,baseSpeed,seconds,tension,limit,min=3,max=90){
 if(!motor||seconds<=0)return spool;
 const fraction=clamp(tension/limit,0,1);
 // The drum stalls at rated line load but can still pay out. Once the load
 // falls, a held command automatically resumes. No cable snapping in this build.
 const factor=motor>0?(fraction>=1?0:Math.max(.12,1-.88*fraction)):(1-.45*fraction);
 // Never jump the length of a previously connected line just because it's
 // already below the normal reel-in stop or beyond the payout limit.
 return motor>0?Math.max(Math.min(min,spool),spool-baseSpeed*factor*seconds):
  Math.min(Math.max(max,spool),spool+baseSpeed*factor*seconds);
}

// Render-only sag. All redirects remain exact vertices; cable force and
// spool calculations still use the straight segmented route.
export function cableRenderPoints(points,spool,tension,ground=()=>-Infinity,segments=8){
 const lengths=points.slice(1).map((p,i)=>length(p,points[i]));
 const distance=lengths.reduce((a,b)=>a+b,0);
 const slack=Math.max(0,(Number.isFinite(spool)?spool:distance)-distance);
 const tight=clamp(1-Math.max(0,tension)/12000,0,1);
 const out=[{...points[0]}];
 for(let i=0;i<lengths.length;i++){
  const a=points[i],b=points[i+1],d=lengths[i],horizontal=Math.hypot(b.x-a.x,b.z-a.z);
  const extra=distance>0?slack*d/distance:0;
  const sag=Math.min(2.4,horizontal*.16,Math.sqrt(Math.max(0,extra*d*.375))+horizontal*.012)*tight;
  for(let j=1;j<=segments;j++){
   const f=j/segments,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f,base=a.y+(b.y-a.y)*f;
   const y=j===segments?b.y:Math.min(base,Math.max(base-4*sag*f*(1-f),ground(x,z)+.055));
   out.push({x:j===segments?b.x:x,y,z:j===segments?b.z:z});
  }
 }
 return out;
}
