import {surfaceMap,waterNormalMap} from './visualQuality.js';
// Distinct recovery locations. Shared coordinates drive rendering and objectives.
export const SITE_REVISION=1;
export const siteConfig=i=>i===5?{
 kind:'terminal',start:{x:0,z:-73},goals:[{x:8,z:-88,r:4.1}],anchors:[{x:-19,z:-79,label:'YARD ANCHOR A'},{x:14,z:-96,label:'YARD ANCHOR B'}],bounds:{minX:-21,maxX:21,minZ:-114,maxZ:-62}
}:i===6?{
 kind:'bridge',start:{x:0,z:-78},goals:[{x:0,z:-85,r:3.0},{x:0,z:-75,r:3.0}],anchors:[{x:-6.1,z:-87,label:'LEFT DECK ANCHOR'},{x:6.1,z:-91,label:'RIGHT DECK ANCHOR'}],bounds:{minX:-4.85,maxX:4.85,minZ:-124,maxZ:-54}
}:i===7?{
 kind:'quarry',start:{x:7,z:-83},goals:[{x:7,z:-93,r:4.2}],anchors:[{x:-17,z:-90,label:'QUARRY ANCHOR A'},{x:15,z:-102,label:'QUARRY ANCHOR B'}],bounds:{minX:-22,maxX:22,minZ:-120,maxZ:-59}
}:null;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function bridgeGround(x,z){
 const channel=smooth(0,8,Math.min(z+116,-91-z));
 return -.12-6.2*channel+.10*Math.sin(x*.12)*channel;
}
export function siteHeight(i,x,z){
 if(i===5||i===7)return .04;
 if(i===6)return Math.abs(x)<=6.6&&z>=-128&&z<=-52?.04:bridgeGround(x,z);
 return 0;
}
export function siteSlope(i,x,z){
 if(i===5||i===7||Math.abs(x)<=6.2)return {x:0,z:0};
 const h=.25;return {x:(siteHeight(i,x+h,z)-siteHeight(i,x-h,z))/(2*h),z:(siteHeight(i,x,z+h)-siteHeight(i,x,z-h))/(2*h)};
}
export function siteGravity(i,x,z,strength=1){
 const s=siteSlope(i,x,z),d=1+s.x*s.x+s.z*s.z;return {x:-9.81*strength*s.x/d,z:-9.81*strength*s.z/d};
}
export function siteSurface(i,x,z){
 if(i===5){
  const paved=x>=-22&&x<=22&&z>=-116&&z<=-60;
  if(paved&&x>=-17&&x<=-8&&z>=-94&&z<=-83)return {name:'ICE',traction:.34,lateralGrip:.38,drag:.42,depth:0};
  if(paved&&Math.abs(x)>12&&!(x>0&&z>=-93&&z<=-83))return {name:'PACKED SNOW',traction:.56,lateralGrip:.55,drag:1.15,depth:0};
  if(paved)return {name:'CONCRETE',traction:.94,lateralGrip:.92,drag:.42,depth:0};
 }
 if(i===7)return {name:Math.abs(x)<10?'COMPACTED GRAVEL':'LOOSE GRAVEL',traction:Math.abs(x)<10?.86:.68,lateralGrip:Math.abs(x)<10?.85:.64,drag:Math.abs(x)<10?.70:1.05,depth:0};
 if(i===6&&Math.abs(x)<=6.6&&z>=-128&&z<=-52)return {name:'BRIDGE DECK',traction:.92,lateralGrip:.90,drag:.40,depth:0};
 return {name:'GRAVEL',traction:.78,lateralGrip:.75,drag:.8,depth:0};
}
export const bridgeEdgeExceeded=(x,z)=>Math.abs(x)>6.35||z< -127||z> -53;
export function constrainSiteTruck(i,pos,vel){
 const bounds=siteConfig(i)?.bounds;if(!bounds)return;
 const x=Math.max(bounds.minX,Math.min(bounds.maxX,pos.x)),z=Math.max(bounds.minZ,Math.min(bounds.maxZ,pos.z));
 if(x!==pos.x)vel.x=0;if(z!==pos.z)vel.z=0;pos.x=x;pos.z=z;
}
export function siteGoalReached(goal,pos,roll){
 return Math.abs(roll)<.28&&Math.hypot(pos.x-goal.x,pos.z-goal.z)<goal.r;
}
export function siteRecoveryReady(i,primary,secondary,failed=false){
 const config=siteConfig(i);if(!config||failed)return false;
 return siteGoalReached(config.goals[0],primary.pos,primary.roll)&&
 (i!==6||!!secondary?.active&&siteGoalReached(config.goals[1],secondary.pos,secondary.roll));
}
export const checkpointSiteCompatible=(snapshot,count=7)=>snapshot.jobIndex%count<4||snapshot.siteRevision===SITE_REVISION;
// Purpose-built meshes, not the old roadside/ravine scene.
export function createDispatchSite(T,scene,i){
 const config=siteConfig(i),mat=(color,roughness=.85,metalness=.05)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const concrete=mat(0x92938b),asphalt=mat(0x454b50),steel=mat(0x66737e,.53,.55),yellow=mat(0xe5b84a),white=mat(0xdeddd1),dark=mat(0x303b40),waterMat=mat(0x276e83,.24,.2);
 const make=(name,geo,m,x,y,z)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;};
 const box=(n,d,p,m)=>make(n,new T.BoxGeometry(...d),m,...p);
 const paint=(n,d,p,m)=>{const o=box(n,d,p,m);o.castShadow=false;return o;};
 const obstacles=[];
 if(i===5){
  const groundMat=mat(0x797f82);groundMat.map=surfaceMap(T,22,30,74);
  const ground=box('freight terminal concrete apron',[44,.18,56],[0,-.05,-88],groundMat);
  // Warehouses and container rows enclose the yard without blocking the recovery bay.
  const siding=mat(0x657883,.76,.23),roof=mat(0x424e54),door=mat(0x849099,.65,.24);
  box('freight warehouse',[38,7,7],[0,3.54,-120],siding);
  box('warehouse parapet',[39,.35,7.4],[0,7.15,-120],roof);
  for(let k=0;k<5;k++){
   const x=-15+k*7.5;box('loading dock door',[3.4,3.7,.16],[x,1.90,-116.42],door);
   for(let j=0;j<6;j++)box('loading door horizontal seam',[3.2,.04,.04],[x,.48+j*.59,-116.30],dark);
   box('dock bumper',[3.55,.24,.45],[x,.47,-116.15],dark);
  }
  const containerColors=[0x2f657b,0x99583d,0x6b7d62];
  for(const side of [-1,1])for(let j=0;j<4;j++){
   const x=side*24,z=-110+j*13.0,m=mat(containerColors[(j+(side>0?1:0))%3]);
   box('freight shipping container',[3.6,3.0,10.2],[x,1.54,z],m);
   for(let k=0;k<10;k++)box('container corrugation',[.09,2.72,.10],[x-side*1.83,1.54,z-4.4+k*.97],m);
  }
  const ice=mat(0x9bb7c9,.29,.24),snow=mat(0xe5eef1,.91,0);snow.map=surfaceMap(T,8,12,88);ice.map=surfaceMap(T,7,9,70);
  // Plowed central access lane and cleared recovery bay amid snow-covered loading areas.
  paint('packed snow west apron',[10,.014,55],[-17,.048,-88],snow);
  paint('packed snow east apron north',[10,.014,23],[17,.048,-104.5],snow);
  paint('packed snow east apron south',[10,.014,23],[17,.048,-71.5],snow);
  paint('glazed ice patch',[9,.022,11],[-12.5,.061,-88.5],ice);
  // Thin patches feather the straight plow edges; deep piles stay outside the traffic lanes.
  const driftGeo=new T.SphereGeometry(1,12,6),dummy=new T.Object3D();
  const drifts=new T.InstancedMesh(driftGeo,snow,68);drifts.name='irregular windblown snow at plow edges';drifts.receiveShadow=true;scene.add(drifts);
  for(let j=0;j<68;j++){const side=j%2?1:-1,z=-114+(j*19%52);const x=side*(12.05+.45*Math.sin(j*2.399));dummy.position.set(x,.052,z);dummy.scale.set(.28+.42*(j%4)/3,.018+.025*(j%3)/2,.65+.6*(j%5)/4);dummy.rotation.set(0,j*.73,0);dummy.updateMatrix();drifts.setMatrixAt(j,dummy.matrix);}
  drifts.instanceMatrix.needsUpdate=true;drifts.computeBoundingSphere();
  const tracks=mat(0x626d74,.75,.05);
  for(const x of [-1.05,1.05])for(let j=0;j<12;j++)paint('wet tire tracks through plowed lane',[.26,.008,2.8],[x+.15*Math.sin(j*.6),.054,-111+j*3.7],tracks);
  for(const x of [-14.2,-12.1])for(let j=0;j<4;j++){const track=paint('skid on icy apron',[.21,.009,2.0],[x+j*.20,.079,-84.5-j*2.1],tracks);track.rotation.y=.11;}
  const bankGeo=new T.SphereGeometry(1,12,8);
  for(const side of [-1,1])for(let j=0;j<11;j++){const bank=make('plowed snow bank',bankGeo,snow,side*22.4,.42,-113+j*5.0);bank.scale.set(1.25,.60+.28*(j%3),2.7);}
  box('warehouse snow cap',[39,.13,7.4],[0,7.39,-120],snow);
  for(const side of [-1,1])for(let j=0;j<4;j++)box('snow on container roof',[3.6,.10,10.2],[side*24,3.09,-110+j*13.0],snow);
  for(let x=-18;x<=18;x+=6)paint('apron expansion joint',[.035,.012,54],[x,.05,-88],dark);
  for(let z=-112;z<=-64;z+=8)paint('apron expansion joint',[42,.012,.035],[0,.05,z],dark);
  // Physical pallet stacks sit outside the direct route to the unloading bay.
  const wood=mat(0x846b48);
  for(const [x,z] of [[-4,-96],[-3,-79],[15,-105]]){
   box('stacked freight pallet',[2.0,.30,1.8],[x,.19,z],wood);
   box('banded freight crate',[1.75,1.30,1.5],[x,.98,z],wood);
   for(const q of [-.55,.55])box('cargo retaining band',[.08,1.32,1.53],[x+q,.98,z],dark);
   obstacles.push({x,z,r:1.15});
  }
  for(const x of [-3,3])for(let z=-112;z<=-64;z+=6)paint('yard lane marking',[.12,.016,2.6],[x,.058,z],yellow);
  const g=config.goals[0];
  for(const side of [-1,1])paint('recovery bay boundary',[.13,.018,8.4],[g.x+side*3.2,.064,g.z],white);
  for(const side of [-1,1])paint('recovery bay end line',[6.4,.018,.13],[g.x,.064,g.z+side*4.2],white);
  for(const x of [-20,20])for(const z of [-111,-65]){
   box('yard floodlight pole',[.16,7,.16],[x,3.54,z],steel);box('yard floodlight head',[.82,.27,.35],[x,7.07,z],white);
  }
  return {ground,obstacles};
 }
 if(i===7){
  const gravel=mat(0x93836a);gravel.map=surfaceMap(T,38,35,90);
  const ground=box('quarry gravel staging yard',[54,.18,70],[0,-.05,-90],gravel);
  const compact=mat(0xa59a84);paint('compacted gravel recovery lane',[20,.014,62],[0,.049,-90],compact);
  const stone=mat(0x77746a),ore=mat(0x8d8270),sand=mat(0xb3a080);
  for(const side of [-1,1])for(let j=0;j<8;j++){
   const x=side*(27+j%2*3),z=-116+j*7.4;
   const pile=make('quarry aggregate pile',new T.ConeGeometry(4.2+(j%3)*.6,4.8+(j%4)*.7,9),j%2?stone:ore,x,2.4,z);
   pile.scale.set(1.15,1,.84);pile.rotation.y=j*.7;
  }
  for(let j=0;j<9;j++){const z=-121+j*7.5;box('quarry concrete retaining block',[.85,.75,3.0],[-23,.42,z],concrete);}
  box('quarry scale house',[5,3.2,5.6],[18,1.64,-119],steel);
  box('scale house roof',[5.4,.18,6],[18,3.34,-119],dark);
  box('scale house window',[2.1,1.1,.08],[18,2.15,-116.17],mat(0x45626e,.2,.25));
  for(const [x,z] of [[-18,-113],[18,-77]]){box('quarry concrete block',[2.4,.85,2.4],[x,.465,z],concrete);obstacles.push({x,z,r:1.25});}
  for(const x of [-20,20])for(const z of [-113,-64])box('yellow quarry boundary bollard',[.24,1.05,.24],[x,.56,z],yellow);
  for(let j=0;j<30;j++){const x=-24+(j*17%48),z=-120+(j*11%60);if(Math.abs(x)<15)continue;const rock=make('loose aggregate',new T.DodecahedronGeometry(.12+(j%4)*.06,0),sand,x,.09,z);rock.scale.y=.65;}
  for(const x of [-14,-10])paint('support truck staging lines',[.12,.018,7],[x,.065,-108],yellow);
  const g=config.goals[0];for(const side of [-1,1])paint('quarry safe bay marking',[.12,.02,8.4],[g.x+side*3.4,.062,g.z],white);
  return {ground,obstacles};
 }
 // Elevated bridge over a transverse river, with continuous approach roads.
 const geo=new T.PlaneGeometry(180,180,120,120);geo.rotateX(-Math.PI/2);geo.translate(0,0,-83);
 const p=geo.attributes.position;for(let j=0;j<p.count;j++)p.setY(j,bridgeGround(p.getX(j),p.getZ(j)));geo.computeVertexNormals();
 make('river valley and bridge embankments',geo,mat(0x6b7659),0,0,0);
 const normal=waterNormalMap(T);waterMat.normalMap=normal;waterMat.normalScale=new T.Vector2(.55,.55);
 const river=make('river beneath highway bridge',new T.PlaneGeometry(178,23),waterMat,0,-3.4,-103.5);river.rotation.x=-Math.PI/2;river.castShadow=false;
 const deck=box('elevated highway bridge deck',[13.2,.56,76],[0,-.24,-90],asphalt);
 for(const x of [-5.35,5.35])box('longitudinal bridge girder',[.56,.86,76],[x,-.89,-90],steel);
 for(const z of [-113,-94]){
  for(const x of [-4.3,4.3])box('bridge concrete pier',[1.55,6.8,2.0],[x,-3.7,z],concrete);
  box('bridge pier cap',[11.7,.65,2.2],[0,-1.47,z],concrete);
 }
 for(const x of [-6.35,6.35])for(let z=-126;z<=-54;z+=3){
  if(x<0&&z>=-105&&z<=-96)continue;
  box('concrete parapet segment',[.38,.82,2.96],[x,.45,z],concrete);
 }
 for(const z of [-124,-90,-56])paint('bridge expansion joint',[12.3,.015,.13],[0,.052,z],dark);
 for(let z=-126;z<=-54;z+=6)paint('highway center dash',[.16,.018,3.1],[0,.055,z],yellow);
 for(const x of [-5.6,5.6])paint('white bridge edge line',[.12,.018,74],[x,.056,-90],white);
 for(const z of [-105,-96]){
  const broken=box('broken parapet end',[.42,.65,1.05],[-6.32,.34,z],concrete);broken.rotation.y=.23;
 }
 for(let j=0;j<5;j++){
  const o=paint('bridge crash skid mark',[.13,.016,2.5],[-1.3-j*.75,.065,-94-j*1.45],dark);o.rotation.y=-.40;
 }
 // Closure boards make this a dedicated incident site instead of a through road.
 for(const z of [-123,-55])for(const x of [-4.0,4.0]){
  box('highway closure barricade',[2.2,.22,.18],[x,.98,z],yellow);
  for(const side of [-1,1])box('barricade stand',[.12,.95,.13],[x+side*.85,.51,z],steel);
 }
 return {ground:deck,obstacles,waterNormal:normal};
}
