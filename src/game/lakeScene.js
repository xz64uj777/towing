// Level 5: broad shallow lake with a muddy bank and submerged recovery target.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const LAKE_SURFACE=-2.15;
export function lakeHeight(x,z){
 const bay=smooth(48,62,-z)*(1-smooth(100,117,-z));
 const west=-x;
 const bank=smooth(5,23,west);
 const basin=smooth(8,19,west);
 const undulation=.18*Math.sin(x*.21+z*.12)*bank;
 return -.12-bay*(1.9*bank+2.0*basin)+undulation;
}
export function lakeSlope(x,z){
 const h=.35;return {x:(lakeHeight(x+h,z)-lakeHeight(x-h,z))/(2*h),z:(lakeHeight(x,z+h)-lakeHeight(x,z-h))/(2*h)};
}
export function lakeDownhillAcceleration(x,z,strength=1){
 const slope=lakeSlope(x,z),d=1+slope.x*slope.x+slope.z*slope.z;
 return {x:-9.81*strength*slope.x/d,z:-9.81*strength*slope.z/d};
}
export function createLakeScene(THREE,scene){
 const geo=new THREE.PlaneGeometry(220,220,240,240);geo.rotateX(-Math.PI/2);
 const pos=geo.attributes.position,colors=[];
 const grass=new THREE.Color('#50734c'),mud=new THREE.Color('#645947'),sand=new THREE.Color('#988a65');
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i),y=lakeHeight(x,z);pos.setY(i,y);
  const c=grass.clone();const wet=smooth(-5,-8,x)*(1-smooth(32,42,Math.abs(z+78)));
  c.lerp(mud,wet*.84);if(y<LAKE_SURFACE+.55)c.lerp(sand,.65);
  colors.push(c.r,c.g,c.b);
 }
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
 const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
 ground.name='Level 5 physical lake shore';ground.receiveShadow=true;scene.add(ground);
 // Water only occupies the recessed western basin; no water across the paved road.
 const waterGeo=new THREE.PlaneGeometry(74,58);waterGeo.rotateX(-Math.PI/2);
 const water=new THREE.Mesh(waterGeo,new THREE.MeshStandardMaterial({color:0x247e91,metalness:.42,roughness:.19,transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false}));
 water.name='Lake surface';water.position.set(-47,LAKE_SURFACE,-78);scene.add(water);
 const create=(g,m,x,y,z,name)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.name=name;o.castShadow=true;scene.add(o);return o;};
 const wood=new THREE.MeshStandardMaterial({color:0x695038,roughness:1});
 const reeds=new THREE.MeshStandardMaterial({color:0x778448,roughness:1});
 const rock=new THREE.MeshStandardMaterial({color:0x7c7970,roughness:1});
 const warning=new THREE.MeshStandardMaterial({color:0xd9a840,roughness:.75});
 for(let i=0;i<55;i++){
  const z=-105+(i*17%54),x=-8-(i*13%19);
  const y=lakeHeight(x,z);
  if(y>LAKE_SURFACE-.2){
   const stalk=create(new THREE.CylinderGeometry(.04,.08,1.15+(i%3)*.25,5),reeds,x,y+.58,z,'Lakeside reeds');stalk.rotation.z=(i%5-2)*.12;
  }
 }
 for(let i=0;i<25;i++){
  const x=-10-(i*19%25),z=-106+(i*11%58),y=lakeHeight(x,z);
  const b=create(new THREE.IcosahedronGeometry(.4+(i%4)*.18,0),rock,x,y+.12,z,'Shoreline boulder');b.scale.set(1.35,.55,.9);
 }
 // Wooden launch ramp, broken dock and rescue markers distinguish this dispatch.
 const dock=create(new THREE.BoxGeometry(2.6,.22,13),wood,-9,lakeHeight(-9,-78)+.18,-78,'Weathered boat launch dock');
 dock.rotation.y=.12;
 for(const z of [-83,-77,-71]){
  const y=lakeHeight(-7,z);
  create(new THREE.CylinderGeometry(.10,.12,1.35,7),warning,-7,y+.7,z,'Water hazard marker');
 }
 const buoyMat=new THREE.MeshStandardMaterial({color:0xf3a43b,roughness:.45});
 for(const z of [-98,-89,-68,-59])create(new THREE.SphereGeometry(.36,10,8),buoyMat,-28,LAKE_SURFACE+.22,z,'Floating rescue buoy');
 return {ground,obstacles:[]};
}
