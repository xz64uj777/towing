import {surfaceMap,waterNormalMap} from './visualQuality.js';
// Distinct recovery locations. Shared coordinates drive rendering and objectives.
export const SITE_REVISION=1;
export const WOODLAND_SITE_INDEX=8;
const WOODLAND_SITE={
 kind:'woodland',start:{x:8,z:-72},target:{x:21,z:-104},goals:[{x:8,z:-67,r:4.2}],
 anchors:[{x:16,z:-107,label:'TRAIL EDGE ANCHOR'},{x:11,z:-113,label:'TURNOUT ANCHOR'}],
 bounds:{minX:-16,maxX:36,minZ:-121,maxZ:-62}
};
export const siteConfig=i=>i===5?{
 kind:'terminal',start:{x:0,z:-73},goals:[{x:8,z:-88,r:4.1}],anchors:[{x:-19,z:-79,label:'YARD ANCHOR A'},{x:14,z:-96,label:'YARD ANCHOR B'}],bounds:{minX:-21,maxX:21,minZ:-114,maxZ:-62}
}:i===6?{
 kind:'bridge',start:{x:0,z:-78},goals:[{x:0,z:-85,r:3.0},{x:0,z:-75,r:3.0}],anchors:[{x:-6.1,z:-87,label:'LEFT DECK ANCHOR'},{x:6.1,z:-91,label:'RIGHT DECK ANCHOR'}],bounds:{minX:-4.85,maxX:4.85,minZ:-124,maxZ:-54}
}:i===7?{
 kind:'quarry',start:{x:7,z:-83},goals:[{x:7,z:-93,r:4.2}],anchors:[{x:-17,z:-90,label:'QUARRY ANCHOR A'},{x:15,z:-102,label:'QUARRY ANCHOR B'}],bounds:{minX:-22,maxX:22,minZ:-120,maxZ:-59}
}:i===WOODLAND_SITE_INDEX?WOODLAND_SITE:null;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const woodlandTrailCenter=z=>8+5*Math.sin((z+69)/8);
function woodlandGround(x,z){
 const offset=x-woodlandTrailCenter(z);
 const road=1-smooth(5.8,7.4,Math.abs(offset));
 const trailhead=1-smooth(7.8,11,Math.hypot(x-8,z+68));
 const turnout=1-smooth(7.8,10.8,Math.hypot(x-11,z+113));
 const recoveryClearing=1-smooth(6.5,8.4,Math.hypot(x-13,z+101));
 const gravel=Math.max(road,trailhead,turnout,recoveryClearing);
 const basin=Math.hypot((x-WOODLAND_SITE.target.x)/9,(z-WOODLAND_SITE.target.z)/10);
 const mud=(1-gravel)*(1-smooth(.45,1.22,basin));
 const forest=1-gravel-mud;
 const rise=.04+(-z-68)*.035+.10*Math.sin((z+69)*.23)+.06*Math.sin((x-8)*.45);
 const bank=forest*(.58*Math.sin(x*.16+z*.13)+.34*Math.cos(x*.28-z*.17));
 // The raised gravel line and lower wheel tracks fade out at both clearings.
 const approach=gravel*smooth(-96,-92,z)*(1-smooth(-81,-77,z));
 const wet=approach*smooth(-.8,.9,offset)*(1-smooth(4.9,6.5,offset));
 const camber=approach*(1-smooth(-1.8,1.3,offset))*(.24-.035*(offset+2.5));
 const crest=.14*approach*Math.sin((z+90)*.37);
 const rutDistance=Math.min(Math.abs(offset-1.2),Math.abs(offset-3.8));
 const rutDepth=.11*wet*(1-smooth(.27,.96,rutDistance));
 const bogDistance=Math.hypot((offset-2.5)/2.4,(z+87)/4.8);
 const bog=wet*(1-smooth(.45,1.10,bogDistance));
 return {gravel,mud,forest,wet,bog,height:rise+bank-1.60*mud+camber+crest-.24*wet-rutDepth};
}
export const woodlandOnFirmTrail=(x,z)=>z>=WOODLAND_SITE.bounds.minZ&&z<=WOODLAND_SITE.bounds.maxZ&&
 Math.abs(x-woodlandTrailCenter(z))<=4.6&&woodlandGround(x,z).wet<.45;
export function bridgeGround(x,z){
 const channel=smooth(0,8,Math.min(z+116,-91-z));
 return -.12-6.2*channel+.10*Math.sin(x*.12)*channel;
}
export function siteHeight(i,x,z){
 if(i===5||i===7)return .04;
 if(i===6)return Math.abs(x)<=6.6&&z>=-128&&z<=-52?.04:bridgeGround(x,z);
 if(i===WOODLAND_SITE_INDEX)return woodlandGround(x,z).height;
 return 0;
}
export function siteSlope(i,x,z){
 if(i===5||i===7||(i===6&&Math.abs(x)<=6.2))return {x:0,z:0};
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
 if(i===WOODLAND_SITE_INDEX){
  const {gravel,mud,forest,wet,bog}=woodlandGround(x,z),dry=gravel-wet;
  return {name:wet>=.45?'RUTTED MUD':gravel>=.5?'GRAVEL':mud>=.42?'MUD':'FOREST FLOOR',
   traction:.89*dry+.55*wet+.39*mud+.65*forest,lateralGrip:.86*dry+.48*wet+.42*mud+.62*forest,
   drag:.62*dry+1.48*wet+2.15*mud+1.10*forest,depth:0,bog};
 }
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
 if(i===WOODLAND_SITE_INDEX){
  const terrain=new T.PlaneGeometry(126,130,144,144);
  terrain.rotateX(-Math.PI/2);terrain.translate(9,0,-94);
  const position=terrain.attributes.position,colors=new Float32Array(position.count*3);
  const needles=new T.Color(0x4c6240),gravel=new T.Color(0x9a8970),mud=new T.Color(0x524034),wetClay=new T.Color(0x655043);
  for(let j=0;j<position.count;j++){
   const x=position.getX(j),z=position.getZ(j),surface=woodlandGround(x,z);
   position.setY(j,surface.height);
   const variation=.90+.10*Math.sin(x*.73+z*.84)*Math.sin(z*.59);
   const dry=surface.gravel-surface.wet;
   colors[j*3]=variation*(needles.r*surface.forest+gravel.r*dry+mud.r*surface.mud+wetClay.r*surface.wet);
   colors[j*3+1]=variation*(needles.g*surface.forest+gravel.g*dry+mud.g*surface.mud+wetClay.g*surface.wet);
   colors[j*3+2]=variation*(needles.b*surface.forest+gravel.b*dry+mud.b*surface.mud+wetClay.b*surface.wet);
  }
  terrain.setAttribute('color',new T.BufferAttribute(colors,3));terrain.computeVertexNormals();
  const ground=make('woodland service trail and muddy shoulder',terrain,new T.MeshStandardMaterial({
   vertexColors:true,roughness:.96,map:surfaceMap(T,48,48,90)
  }),0,0,0);
  ground.castShadow=false;

  const trees=[];
  for(const side of [-1,1])for(let row=0;row<5;row++)for(let j=0;j<17;j++){
   const z=-137+j*5.0+Math.sin(j*2.41+row*3+side)*1.75;
   const x=woodlandTrailCenter(z)+side*(9.4+row*6.2+1.6*Math.sin(j*3.51+row));
   const surface=woodlandGround(x,z);
   if(surface.gravel>.16||surface.mud>.22)continue;
   const height=4.7+1.8*(1+Math.sin(j*2.71+row*5+side));
   trees.push({x,z,y:surface.height,height});
   if(x>config.bounds.minX&&x<config.bounds.maxX&&z>config.bounds.minZ&&z<config.bounds.maxZ){
    obstacles.push({x,z,r:.34});
   }
  }
  const dummy=new T.Object3D();
  const crown=new T.ConeGeometry(1,1,8);
  const layers=[
   {name:'woodland pine trunks',geo:new T.CylinderGeometry(.16,.30,1,8),material:mat(0x56402b),height:.72,center:.36,width:1},
   {name:'woodland lower pine boughs',geo:crown,material:mat(0x2f5739),height:.52,center:.65,width:1.54},
   {name:'woodland upper pine boughs',geo:crown,material:mat(0x416747),height:.45,center:.83,width:1.07}
  ];
  for(const layer of layers){
   const mesh=new T.InstancedMesh(layer.geo,layer.material,trees.length);mesh.name=layer.name;
   mesh.castShadow=true;mesh.receiveShadow=true;
   trees.forEach(({x,y,z,height},j)=>{
    const width=layer.width*(.8+height*.04);
    dummy.position.set(x,y+height*layer.center,z);dummy.rotation.set(0,j*2.40,0);dummy.scale.set(width,height*layer.height,width);
    dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);
   });
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);
  }
  const stone=mat(0x75766a),rock=new T.DodecahedronGeometry(1,0);
  const boulders=[[-7,-86,1.1],[13,-85,.9],[-4,-97,.85],[19,-94,1.0],[28,-108,1.05],[-1,-114,1.0],[23,-117,1.15]];
  for(const z of [-80,-85])for(const side of [-1,1]){
   boulders.push([woodlandTrailCenter(z)+side*7.1,z,side>0?.65:.55]);
  }
  for(const [x,z,r] of boulders){
   const obstacle=make('woodland trail boulder',rock,stone,x,siteHeight(i,x,z)+r*.26,z);
   obstacle.scale.set(r,r*.67,r*.85);obstacle.rotation.y=x*.35;
   obstacles.push({x,z,r});
  }
  const timber=mat(0x746048),reflector=mat(0xffda79);
  const posts=[[2,-67],[14,-67],[5,-113],[17,-113]];
  for(const z of [-81,-92])for(const side of [-1,1])posts.push([woodlandTrailCenter(z)+side*6.65,z]);
  for(const [x,z] of posts){
   const y=siteHeight(i,x,z);
   box('trail edge post',[.15,.94,.15],[x,y+.46,z],timber);
   box('trail edge reflector',[.17,.19,.17],[x,y+.81,z],reflector);
  }
  const logs=new T.CylinderGeometry(.23,.31,4.4,9);
  for(let j=0;j<5;j++){
   const x=18+(.45*(j%3)),z=-69,level=Math.floor(j/3);
   const log=make('stacked timber at the trailhead',logs,timber,x,siteHeight(i,x,z)+.26+level*.47,z);
   log.rotation.x=Math.PI/2;
  }
  return {ground,obstacles};
 }
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
