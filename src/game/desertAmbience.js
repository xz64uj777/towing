// Background events share a single clock with the scene. They never affect
// collisions, vehicle damage, or the recovery objectives.
const cycle=112;
const events=[
 {at:4,kind:'radioCheck'},
 {at:10,kind:'gunfire',x:-96,z:-153},
 {at:17,kind:'blast',x:90,z:-161},
 {at:24,kind:'chinook'},
 {at:65,kind:'gunfire',x:100,z:-120},
 {at:75,kind:'blast',x:-84,z:-182},
 {at:96,kind:'gunfire',x:-100,z:-62}
];

export function createDesertAmbience(T,scene,play){
 const helicopter=new T.Group();
 helicopter.name='Distant Chinook';
 const skin=new T.MeshStandardMaterial({color:0x53584c,roughness:.83});
 const glass=new T.MeshStandardMaterial({color:0x253137,roughness:.35});
 const blades=new T.MeshStandardMaterial({color:0x282925});
 function part(parent,geometry,material,x,y,z){
  const mesh=new T.Mesh(geometry,material);
  mesh.position.set(x,y,z);parent.add(mesh);
  return mesh;
 }
 const fuselage=part(helicopter,new T.CapsuleGeometry(1.13,5.9,5,10),skin,0,0,0);
 fuselage.rotation.x=Math.PI/2;
 part(helicopter,new T.SphereGeometry(.98,12,6),glass,0,.14,-3.3).scale.set(1,.63,.92);
 part(helicopter,new T.BoxGeometry(1.95,.9,4.7),skin,0,-.62,.32);
 const rotors=[-2.9,3.1].map((z,i)=>{
  const height=1.35+i*.5;
  part(helicopter,new T.CylinderGeometry(.32,.7,height,8),skin,0,height*.58,z);
  const rotor=new T.Group();
  rotor.position.set(0,height,z);helicopter.add(rotor);
  for(let blade=0;blade<3;blade++){
   const angle=blade*Math.PI*2/3;
   part(rotor,new T.BoxGeometry(.25,.05,3.6),blades,Math.sin(angle)*1.8,0,Math.cos(angle)*1.8).rotation.y=angle;
  }
  return rotor;
 });
 helicopter.visible=false;scene.add(helicopter);

 const flash=new T.MeshBasicMaterial({color:0xffab4d,fog:false,transparent:true,depthWrite:false});
 const smoke=new T.Group();
 smoke.name='Distant blast';
 const puffs=Array.from({length:8},(_,i)=>part(smoke,new T.IcosahedronGeometry(1,1),
  new T.MeshBasicMaterial({color:i%2?0x514945:0x7d6d58,transparent:true,depthWrite:false,fog:false}),0,0,0));
 const glow=part(smoke,new T.SphereGeometry(2,12,8),flash,0,1.3,0);
 smoke.visible=false;scene.add(smoke);

 let clock=0,cycleIndex=0,next=0,lastBlast=null,flyover=null,reportedTow=false;
 return (s,dt)=>{
  clock+=dt;
  const elapsed=clock-cycleIndex*cycle;
  if(elapsed>=cycle){cycleIndex++;next=0;}
  const phase=clock-cycleIndex*cycle;
  while(next<events.length&&phase>=events[next].at){
   const event=events[next++];
   if(event.kind==='blast')lastBlast={...event,start:clock};
   if(event.kind==='chinook'){
    const yaw=s.yaw??0;
    flyover={start:clock,yaw,direction:cycleIndex%2?-1:1,
     x:s.pos.x+Math.sin(yaw)*60,z:s.pos.z-Math.cos(yaw)*60};
   }
   if(event.kind!=='radioCheck'||cycleIndex===0)play(event.kind,event.x,event.z,s);
  }
  if(s.loaded&&!reportedTow){
   reportedTow=true;play('radioTow',undefined,undefined,s);
  }
  helicopter.visible=!!flyover&&clock-flyover.start<33;
  if(helicopter.visible){
   const age=clock-flyover.start;
   const travel=flyover.direction*(age-16.5)*8;
   helicopter.position.set(flyover.x+Math.cos(flyover.yaw)*travel,
    21+3*Math.sin(age*.09),flyover.z+Math.sin(flyover.yaw)*travel);
   helicopter.rotation.set(0,flyover.yaw-flyover.direction*Math.PI/2,.045*Math.sin(age*.24));
   rotors.forEach((rotor,i)=>{rotor.rotation.y=age*(i?23:-23);});
  }
  smoke.visible=!!lastBlast&&clock-lastBlast.start<14;
  if(smoke.visible){
   const age=clock-lastBlast.start;
   smoke.position.set(lastBlast.x,.5,lastBlast.z);
   glow.visible=age<.55;
   flash.opacity=Math.max(0,.9-age*1.6);
   glow.scale.setScalar(1+age*5);
   puffs.forEach((puff,i)=>{
    const spread=1+age*.61;
    puff.position.set(Math.sin(i*2.4)*spread+age*.33,1+i*.45+age*(.4+i*.08),Math.cos(i*2.4)*spread);
    puff.scale.setScalar(.85+age*.31+i*.22);
    puff.material.opacity=(.6-i*.037)*Math.min(1,age*4)*(1-age/14);
   });
  }
 };
}
