// A rolled body's local bounds project to a wider or narrower ground footprint.
export function vehicleFootprint({pos,yaw,roll=0,lift=0,bounds,rear=bounds.max.z}){
 const {min,max}=bounds,c=Math.cos(roll),s=Math.sin(roll);
 const centerX=(min.x+max.x)*.5,centerY=(min.y+max.y)*.5,centerZ=(min.z+rear)*.5;
 const halfX=(max.x-min.x)*.5,halfY=(max.y-min.y)*.5;
 const right={x:Math.cos(yaw),z:Math.sin(yaw)},back={x:-right.z,z:right.x};
 const lateral=centerX*c-centerY*s;
 const height=pos.y+lift+centerX*s+centerY*c;
 const verticalRadius=halfX*Math.abs(s)+halfY*Math.abs(c);
 return {
  x:pos.x+right.x*lateral+back.x*centerZ,
  z:pos.z+right.z*lateral+back.z*centerZ,
  low:height-verticalRadius,high:height+verticalRadius,
  right,back,halfX:halfX*Math.abs(c)+halfY*Math.abs(s),halfZ:(rear-min.z)*.5,
 };
}

const dot=(a,b)=>a.x*b.x+a.z*b.z;

// Separate the bodies along the shallowest overlap axis and remove only
// closing velocity, preserving the slide along a glancing contact.
export function resolveVehicleContact(a,b){
 const total=a.weight+b.weight;
 if(!total)return false;
 const first=vehicleFootprint(a),second=vehicleFootprint(b);
 if(first.high<=second.low||second.high<=first.low)return false;
 const delta={x:second.x-first.x,z:second.z-first.z};
 let normal,depth=Infinity;
 for(const axis of [first.right,first.back,second.right,second.back]){
  const radius=body=>body.halfX*Math.abs(dot(axis,body.right))+body.halfZ*Math.abs(dot(axis,body.back));
  const projected=dot(delta,axis),overlap=radius(first)+radius(second)-Math.abs(projected);
  if(overlap<=0)return false;
  if(overlap<depth){
   depth=overlap;
   normal=projected<0?{x:-axis.x,z:-axis.z}:axis;
  }
 }
 const closing=Math.max(0,dot(a.vel,normal)-dot(b.vel,normal));
 for(const [body,sign] of [[a,-1],[b,1]]){
  const share=sign*body.weight/total;
  body.pos.x+=normal.x*(depth+.001)*share;
  body.pos.z+=normal.z*(depth+.001)*share;
  body.vel.x+=normal.x*closing*share;
  body.vel.z+=normal.z*closing*share;
 }
 return true;
}

// Leave clearance for an aligned front bumper to overhang the deployed lift
// as the tires enter the grid. Side approaches retain the chassis footprint.
export function wheelLiftContactRear(truck, casualty, lowered){
 const rear=truck.bounds.max.z;
 if(!lowered)return rear;
 const dx=casualty.pos.x-truck.pos.x,dz=casualty.pos.z-truck.pos.z;
 const c=Math.cos(truck.yaw),s=Math.sin(truck.yaw);
 const behind=dz*c-dx*s,side=dx*c+dz*s;
 return behind>2.4&&Math.abs(side)<1&&Math.cos(casualty.yaw-truck.yaw)>.85?Math.min(rear,2):rear;
}
