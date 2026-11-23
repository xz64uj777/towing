import {levelFourHeight,levelFourSlope} from './levelFourTerrain.js';

// Self-contained Level 4 scenery. All visible slopes come from the heightfield
// used by recovery and driving physics; no false, flat-bottomed ravine boxes.
export function createLevelFourScene(THREE,scene){
 const geo=new THREE.PlaneGeometry(220,220,202,202);
 geo.rotateX(-Math.PI/2);
 const pos=geo.attributes.position;
 const colors=[];
 const forest=new THREE.Color('#466b4c'),soil=new THREE.Color('#765d49');
 const gravel=new THREE.Color('#99876b'),rock=new THREE.Color('#6f7377');
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i),y=levelFourHeight(x,z);
  pos.setY(i,y);
  const slope=levelFourSlope(x,z),grade=Math.hypot(slope.x,slope.z);
  const c=forest.clone().lerp(soil,Math.min(1,grade*.35+.08));
  if(y< -12)c.lerp(gravel,.38);
  if(grade>1.0)c.lerp(rock,Math.min(.97,(grade-.55)*.47));
  colors.push(c.r,c.g,c.b);
 }
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geo.computeVertexNormals();
 const ground=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}));
 ground.name='Level 4 physical ravine and mountainside';
 ground.receiveShadow=true;scene.add(ground);
 const trunkMat=new THREE.MeshStandardMaterial({color:0x58452c,roughness:1});
 const leafMat=new THREE.MeshStandardMaterial({color:0x294f36,roughness:1});
 const barkMat=new THREE.MeshStandardMaterial({color:0x60452e,roughness:1});
 const rockMat=new THREE.MeshStandardMaterial({color:0x797971,roughness:1,flatShading:true});
 const railMat=new THREE.MeshStandardMaterial({color:0xb8c1c3,metalness:.65,roughness:.36});
 const gravelMat=new THREE.MeshStandardMaterial({color:0x9b815e,roughness:1});
 const create=(geometry,material,x,y,z,name)=>{
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.name=name;m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
 };
 // Deep creek: it follows the cut valley and disappears naturally where its ends rise.
 const waterPoints=[];
 for(let z=-110;z<=-39;z+=2){const x=-24+Math.sin(z*.14)*.9;waterPoints.push({x,z,y:levelFourHeight(x,z)+.18});}
 const waterVert=[],waterIndex=[];
 waterPoints.forEach(({x,y,z})=>{waterVert.push(x-1.05,y,z,x+1.05,y,z);});
 for(let i=0;i<waterPoints.length-1;i++){const n=i*2;waterIndex.push(n,n+1,n+2,n+1,n+3,n+2);}
 const waterGeo=new THREE.BufferGeometry();waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(waterVert,3));waterGeo.setIndex(waterIndex);waterGeo.computeVertexNormals();
 const creek=new THREE.Mesh(waterGeo,new THREE.MeshStandardMaterial({color:0x458f9f,metalness:.30,roughness:.22,transparent:true,opacity:.90,side:THREE.DoubleSide}));
 creek.name='Ravine creek';scene.add(creek);
 // Broken guardrail leaves a six-metre breach at the crash site.
 for(let z=-98;z<=-37;z+=3){
  if(z>=-67&&z<=-59)continue;
  const y=levelFourHeight(-5.25,z);
  create(new THREE.CylinderGeometry(.085,.10,1.04,8),railMat,-5.25,y+.61,z,'Guardrail steel post');
  if(z< -97||z> -40||(z>-70&&z< -57))continue;
  create(new THREE.BoxGeometry(.18,.23,2.88),railMat,-5.26,y+1.03,z+1.45,'Roadside guardrail beam');
 }
 // Broken rail sections, scrape marks and warning barrels tell the crash story.
 const torn=create(new THREE.BoxGeometry(.18,.20,3.2),railMat,-6.1,levelFourHeight(-6.1,-65)+.23,-65,'Sheared crash barrier');
 torn.rotation.z=-.20;torn.rotation.x=.45;
 const paintMat=new THREE.MeshStandardMaterial({color:0x272626,roughness:1});
 for(let i=0;i<6;i++){
  const skid=create(new THREE.BoxGeometry(.12,.015,2.0),paintMat,-1.5-i*.55,.054,-58-i*1.0,'Tire skid mark');
  skid.rotation.y=-.35;
 }
 const amber=new THREE.MeshStandardMaterial({color:0xf0a929,roughness:.7});
 for(const z of [-53,-72]){
  const post=create(new THREE.CylinderGeometry(.20,.23,.95,9),amber,-4.2,.48,z,'Road edge warning barrel');
  create(new THREE.BoxGeometry(.56,.15,.56),railMat,-4.2,.65,z,'Reflective roadside band');
 }
 // Deterministic trees with trunks, lateral branches, and tiered pine foliage.
 function tree(x,z,height=1){
  const y=levelFourHeight(x,z),h=(4.8+height*1.8);
  create(new THREE.CylinderGeometry(.14,.29,h*.64,7),trunkMat,x,y+h*.32,z,'Mountain tree trunk');
  for(let j=0;j<3;j++){
   create(new THREE.ConeGeometry(1.55-j*.29,h*.45,8),leafMat,x,y+h*(.52+j*.14),z,'Pine branches');
  }
  for(let b=0;b<3;b++){
   const arm=create(new THREE.CylinderGeometry(.025,.085,1.45,5),barkMat,x+Math.cos(b*2.09)*.55,y+h*.54,z+Math.sin(b*2.09)*.55,'Exposed tree branch');
   arm.rotation.z=Math.sin(b*2.09)*.9;arm.rotation.x=Math.cos(b*2.09)*.65;
  }
 }
 for(let i=0;i<42;i++){
  const t=i*2.399963;const row=i%4;
  const x=row<2?-42-(i%7)*3.2:12+(i%9)*3.3;
  const z=-118+(i*13%148);
  if(Math.abs(x+18)>5||Math.abs(z+63)>14)tree(x+Math.sin(t)*1.2,z,.4+(i%4)*.2);
 }
 // Foreground tree and broken branches make the ledge feel wooded.
 tree(-34,-62,1.15);tree(-38,-69,1.5);tree(-11,-89,.65);
 const fallen=create(new THREE.CylinderGeometry(.16,.28,7.4,9),barkMat,-30,levelFourHeight(-30,-76)+.65,-76,'Fallen ravine tree');
 fallen.rotation.z=1.31;fallen.rotation.x=.35;
 const obstacles=[];
 for(let i=0;i<28;i++){
  const x=-10-(i*13%26),z=-46-(i*17%51);
  const y=levelFourHeight(x,z),r=.4+(i%5)*.21;
  const m=create(new THREE.IcosahedronGeometry(r,0),rockMat,x,y+r*.25,z,'Ravine rock');
  m.scale.set(1.35,.7+.12*(i%3),.85);m.rotation.y=i*.91;
  if(x>-28&&x<-13&&z<-45&&z>-88)obstacles.push({x,z,r:r*.95});
 }
 for(let i=0;i<12;i++){
  const x=-10-i*1.9,z=-83+(i*7%34),y=levelFourHeight(x,z);
  const debris=create(new THREE.BoxGeometry(.38,.10,1.4),gravelMat,x,y+.08,z,'Loose timber debris');
  debris.rotation.y=i*.57;
 }

 // Rock shelves track the actual surface of the steep-sided channel.
 const ledgeMat=new THREE.MeshStandardMaterial({color:0x555b5b,roughness:1,flatShading:true});
 for(let i=0;i<46;i++){
   const z=-109+(i*17%73),x=-7.8-(i%5)*1.2;
   const base=levelFourHeight(x,z),radius=.55+(i%5)*.24;
   const ledge=create(new THREE.DodecahedronGeometry(radius,0),ledgeMat,x,base+.12,z,'Exposed layered cliff rock');
   ledge.scale.set(1.4,.58,.8);ledge.rotation.y=(i%7)*.39;
 }
 // Loose deadwood collected on the riverbed and beneath the broken rail.
 for(let i=0;i<16;i++){
   const x=-22+(i%5)*1.3,z=-99+i*3.3,y=levelFourHeight(x,z);
   const branch=create(new THREE.CylinderGeometry(.04,.12,2.4+(i%3),6),barkMat,x,y+.25,z,'Fallen creek branch');
   branch.rotation.z=.9+(i%4)*.2;branch.rotation.x=(i%3)*.43;
 }
 return {ground,obstacles};
}
