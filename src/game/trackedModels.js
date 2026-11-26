export function addTrackedBody(T,body,casualty){
 const paint=new T.MeshStandardMaterial({color:casualty?0xb5a17c:0xbda67d,roughness:.82,metalness:.22});
 const dark=new T.MeshStandardMaterial({color:0x38342e,roughness:.85,metalness:.33});
 const glass=new T.MeshStandardMaterial({color:0x26413e,roughness:.35});
 const box=(name,size,x,y,z,material=paint)=>{
  const mesh=new T.Mesh(new T.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(x,y,z);
  mesh.castShadow=true;mesh.receiveShadow=true;body.add(mesh);return mesh;
 };
 box('lower armored hull',[2.95,.68,6.1],0,.92,0);
 box('upper armored hull',[3.42,.50,6.02],0,1.42,0);
 const glacis=box('sloped glacis',[3.22,.21,1.48],0,1.53,-2.46);glacis.rotation.x=.24;
 box(casualty?'Abrams turret':'HERCULES raised superstructure',casualty?[2.65,.83,2.92]:[2.76,1.07,2.43],0,2.05,casualty?-.42:-1.35);
 for(const x of [-.8,0,.8])box('recessed observation block',[.23,.18,.13],x,2.56,-2.42,glass);
 for(let i=0;i<7;i++)box('engine grille louver',[1.74,.043,.055],0,1.70,.85+i*.20,dark);
 const tracks=[];
 for(const side of [-1,1]){
  const x=side*1.49;
  for(let i=0;i<7;i++){
   const wheel=new T.Mesh(new T.CylinderGeometry(.39,.39,.34,14),dark);
   wheel.rotation.z=Math.PI/2;wheel.position.set(x,.51,-2.26+i*.75);wheel.castShadow=true;body.add(wheel);
  }
  for(let i=0;i<6;i++)box('armored skirt segment',[.14,.48,.88],side*1.80,1.24,-2.29+i*.90);
  const pads=new T.InstancedMesh(new T.BoxGeometry(.56,.11,.21),dark,casualty&&side===1?42:54);
  pads.castShadow=true;pads.frustumCulled=false;body.add(pads);tracks.push({pads,x,offset:0,broken:casualty&&side===1});
 }
 return tracks;
}
export function moveTracks(T,tracks,left,right,dt){
 const dummy=new T.Object3D();
 tracks.forEach((track,index)=>{
  if(!track.broken)track.offset+=(index===0?left:right)*dt;
  for(let i=0;i<track.pads.count;i++){
   const a=((i/54+track.offset/13)%1+1)%1;
   const bottom=a<.42,top=a>=.5&&a<.92;
   if(bottom||top){
    const t=bottom?a/.42:(a-.5)/.42;
    dummy.position.set(track.x,bottom?.13:.97,bottom?-2.58+t*5.16:2.58-t*5.16);dummy.rotation.x=0;
   }else{
    const t=(a-(a<.5?.42:.92))/.08*Math.PI;
    const end=a<.5?1:-1;
    dummy.position.set(track.x,.55-.42*Math.cos(t)*end,end*(2.58+.42*Math.sin(t)));dummy.rotation.x=t;
   }
   dummy.updateMatrix();track.pads.setMatrixAt(i,dummy.matrix);
  }
  track.pads.instanceMatrix.needsUpdate=true;
 });
}

export function trackedDust(T,scene){
 const particles=new Float32Array(24*3), position=new T.BufferAttribute(particles,3);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',position);
 const cloud=new T.Points(geometry,new T.PointsMaterial({color:0xc1a37d,size:.42,transparent:true,opacity:.23,depthWrite:false}));
 cloud.frustumCulled=false;scene.add(cloud);
 return (truck,time)=>{
  const speed=truck.vel.length();
  cloud.visible=speed>.55||truck.sandSink>.1;
  const sine=Math.sin(truck.yaw),cosine=Math.cos(truck.yaw);
  for(let i=0;i<24;i++){
   const age=(time*.00055+i/24)%1,side=(i%2===0?-1:1)*(1.45+age*.48);
   const tail=2+age*(1.2+speed*.46);
   position.setXYZ(i,truck.pos.x-sine*tail+cosine*side,truck.pos.y+.2+age*.95,truck.pos.z+cosine*tail+sine*side);
  }
  position.needsUpdate=true;
 };
}
