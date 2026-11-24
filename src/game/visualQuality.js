// Original procedural art. No network assets or changes to physics dimensions.
// The longitudinal stations describe a rounded, tapered eight-sided cross section.
const mesh=(T,parent,name,geo,mat)=>{const m=new T.Mesh(geo,mat);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
const paint=(T,color,roughness=.43,metalness=.24)=>new T.MeshStandardMaterial({color,roughness,metalness});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const BODY_PROFILES={
 light:{nose:[-3.20,-2.92,-2.25,-1.96],cab:[-2.03,-1.54,-.55,-.20],top:2.49,hood:1.88},
 flatbed:{nose:[-3.20,-2.90,-2.22,-1.96],cab:[-2.03,-1.68,-.48,-.20],top:2.54,hood:1.99},
 medium:{nose:[-3.20,-2.90,-2.23,-1.98],cab:[-2.04,-1.67,-.48,-.20],top:2.58,hood:2.02},
 rotator:{nose:[-3.20,-2.88,-2.22,-1.98],cab:[-2.04,-1.78,-.42,-.20],top:2.57,hood:2.03},
 pickup:{nose:[-3.20,-2.92,-2.22,-1.98],cab:[-2.04,-1.49,-.54,-.19],top:2.42,hood:1.86},
 suv:{nose:[-3.20,-2.94,-2.25,-1.98],cab:[-2.06,-1.40,1.46,2.04],top:2.46,hood:1.79},
 delivery:{nose:[-3.20,-2.95,-2.22,-1.98],cab:[-2.04,-1.72,-.50,-.20],top:2.53,hood:1.96}
};
// Each station: z, half width, floor, shoulder height, roof height, roof half width.
// Ring winding points outward; caps close the ends. Slightly inset shoulders
// give actual three-dimensional fender and roof contours rather than square boxes.
export function loftGeometry(T,stations,scale=1){
 const vertices=[],indices=[];
 for(const [z,w,b,shoulder,top,r] of stations){
  for(const [x,y] of [[-w*.80,b],[w*.80,b],[w,b+.09],[w,shoulder],[r,top],[-r,top],[-w,shoulder],[-w,b+.09]])vertices.push(x*scale,y*scale,z*scale);
 }
 for(let i=0;i<stations.length-1;i++)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8,c=a+8,d=b+8;indices.push(a,b,c,b,d,c);}
 for(let j=1;j<7;j++){indices.push(0,j+1,j);const k=(stations.length-1)*8;indices.push(k,k+j,k+j+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingBox();return geo;
}
function panel(T,parent,name,points,scale,material){
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points.flatMap(p=>p.map(v=>v*scale)),3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();
 return mesh(T,parent,name,geo,material);
}
export function addVehicleShell(T,body,{kind='pickup',scale=1,color}){
 const p=BODY_PROFILES[kind]||BODY_PROFILES.pickup,[n0,n1,n2,n3]=p.nose,[c0,c1,c2,c3]=p.cab;
 const suv=kind==='suv',commercial=['flatbed','medium','rotator','delivery'].includes(kind);
 const mat=paint(T,color,.36,.28),trim=paint(T,0x20272b,.83,.08),steel=paint(T,0x87949c,.31,.65);
 const glass=new T.MeshStandardMaterial({color:0x365765,roughness:.16,metalness:.42,side:T.DoubleSide});
 const frontGlass=new T.MeshStandardMaterial({color:0x476c7d,roughness:.15,metalness:.35,side:T.DoubleSide});
 const B=(name,size,pos,m)=>{const o=mesh(T,body,name,new T.BoxGeometry(...size.map(v=>v*scale)),m);o.position.set(...pos.map(v=>v*scale));return o;};
 const G=(name,stations,m)=>mesh(T,body,name,loftGeometry(T,stations,scale),m);
 G('sculpted hood',[[n0,.84,1.18,p.hood-.29,p.hood-.19,.72],[n1,.96,1.15,p.hood-.12,p.hood-.04,.83],[n2,.99,1.12,p.hood-.08,p.hood,.86],[n3,.97,1.12,p.hood-.04,p.hood,.87]],mat);
 G('tapered cabin',[[c0,.96,1.08,p.hood-.02,p.hood+.025,.86],[c1,.97,1.08,p.hood-.02,p.top,.79],[c2,.96,1.08,p.hood-.02,p.top-.035,.79],[c3,.91,1.08,p.hood-.02,suv?p.hood+.15:p.hood+.06,.82]],mat);
 // The windshield follows the actual slope, with an inset dark rubber perimeter.
 const wind=(inset,dy)=>[[(-.85+inset),p.hood+.025+dy,c0-.012],[(.85-inset),p.hood+.025+dy,c0-.012],[(.79-inset),p.top+dy,c1-.012],[(-.79+inset),p.top+dy,c1-.012]];
 const gasket=new T.MeshStandardMaterial({color:0x172125,roughness:.85,side:T.DoubleSide});
 panel(T,body,'windshield seal',wind(.025,.012),scale,gasket);
 // Inset by interpolating along the windshield slope, then lift off the surface.
 const mix=(a,b,f)=>a+(b-a)*f;
 const windshield=[[ -.75,mix(p.hood+.025,p.top,.09)+.024,mix(c0,c1,.09)-.026],[.75,mix(p.hood+.025,p.top,.09)+.024,mix(c0,c1,.09)-.026],[.69,mix(p.hood+.025,p.top,.92)+.024,mix(c0,c1,.92)-.026],[-.69,mix(p.hood+.025,p.top,.92)+.024,mix(c0,c1,.92)-.026]];
 panel(T,body,'raked windshield',windshield,scale,frontGlass);
 for(const side of [-1,1]){
  // Side glazing is on the inclined shoulder-to-roof surface.
  const y0=p.hood+.09,y1=p.top-.10;
  const xAt=y=>side*(mix(.97,.79,clamp((y-(p.hood-.02))/(p.top-(p.hood-.02)),0,1))+.020);
  const split=suv?-.04:(c1+c2)/2;
  const sidePane=(name,z0,z1)=>panel(T,body,name,[[xAt(y0),y0,z0],[xAt(y0),y0,z1],[xAt(y1),y1,z1],[xAt(y1),y1,z0]],scale,glass);
  sidePane('front door glass',c1+.045,split-.045);
  sidePane('rear side glass',split+.045,c2-.045);
  B('door handle',[.055,.055,.22],[side*.985,p.hood-.21,split-.12],steel);
  B('rocker trim',[.09,.12,Math.max(.7,c3-c0-.20)],[side*.965,1.15,(c0+c3)/2],trim);
  if(!suv){B('mirror stem',[.26,.05,.07],[side*1.05,p.hood+.07,c0+.18],trim);B('side mirror',[.13,.25,.18],[side*1.18,p.hood+.08,c0+.18],trim);}
  else B('aero mirror',[.24,.13,.20],[side*1.09,p.hood+.06,c0+.15],trim);
  B('headlamp housing',[.36,.24,.075],[side*.67,p.hood-.34,n0-.016],trim);
  B('clear headlamp',[.31,.17,.055],[side*.67,p.hood-.32,n0-.055],paint(T,0xf4e8ce,.20,.24));
  B('amber marker',[.07,.10,.052],[side*.85,p.hood-.34,n0-.045],paint(T,0xdf8b20,.35,.15));
 }
 B('formed front bumper',[1.89,.23,.18],[0,1.07,n0-.015],commercial?steel:trim);
 B('recessed grille',[commercial?1.14:1.0,commercial?.42:.30,.060],[0,p.hood-.36,n0-.018],trim);
 for(let i=0;i<3;i++)B('grille brightwork',[commercial?1.05:.90,.025,.028],[0,p.hood-.47+i*.095,n0-.056],steel);
 if(suv){
  G('crossover rear quarters',[[c0,.96,.98,p.hood-.04,p.hood-.02,.90],[0,.99,.98,p.hood-.03,p.hood,.92],[1.6,.98,.98,p.hood-.03,p.hood,.92],[2.24,.88,1.03,p.hood-.12,p.hood-.06,.83]],mat);
  B('rear bumper',[1.90,.20,.18],[0,1.08,2.25],trim);
  for(const side of [-1,1]){
   B('tail lamp',[.28,.20,.075],[side*.76,1.60,2.25],paint(T,0xab2525,.29,.12));
   B('roof rail',[.065,.065,2.15],[side*.65,p.top+.04,.14],trim);
  }
  panel(T,body,'sloping rear window',[[-.77,p.top-.15,c2+.12],[.77,p.top-.15,c2+.12],[.78,p.hood+.17,c3+.025],[-.78,p.hood+.17,c3+.025]],scale,glass);
 }
 if(kind==='pickup'||kind==='delivery'){
  for(const side of [-1,1]){
   B('rear quarter panel',[.18,.40,1.92],[side*.91,1.51,1.13],mat);
   B('rear tail light',[.22,.26,.07],[side*.81,1.48,2.10],paint(T,0xa72d27,.28,.17));
  }
  B('tailgate',[1.72,.40,.13],[0,1.51,2.10],mat);
  B('rear step bumper',[1.94,.18,.18],[0,1.10,2.16],steel);
 }
 if(['light','flatbed','medium','rotator'].includes(kind)){
  B('lightbar mounting rail',[1.44,.075,.27],[0,p.top+.03,-1.03],trim);
  const lamp=paint(T,0xffb43a,.23,.12);lamp.emissive=new T.Color(0xc36a09);lamp.emissiveIntensity=.28;
  for(const side of [-1,1])B('amber warning light',[.62,.12,.25],[side*.35,p.top+.12,-1.03],lamp);
  if(commercial)for(const side of [-1,1])B('cab step',[.26,.10,1.14],[side*1.02,1.00,-1.06],steel);
 }
 return body;
}
// Seamless, deterministic multiscale aggregate rather than uniform random noise.
export function surfaceMap(T,repeatX,repeatY,contrast=70,kind='ground'){
 const size=128,data=new Uint8Array(size*size*4);let seed=51871;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const f=(Math.sin(x*2*Math.PI/32+y*2*Math.PI/64)+Math.cos(y*2*Math.PI/32-x*2*Math.PI/64))*.25+.5;
  let v=255-contrast*(.45*random()+.55*f);
  if(kind==='steel'){
   const row=Math.floor(y/16),xx=(x+(row%2)*8)%16,yy=y%16;
   const diamond=Math.abs(xx-8)+Math.abs(yy-8)*2;
   v=diamond<4?240:diamond<6?143:196+random()*22;
  }else if(kind==='tire'){
   const tread=(x+Math.floor(Math.abs(y-64)*.42))%16;
   v=tread<3?116:215+random()*24;
  }
  const i=(y*size+x)*4;data.set([v,v,v,255],i);
 }
 const tex=new T.DataTexture(data,size,size);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(repeatX,repeatY);tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;return tex;
}
export function waterNormalMap(T){
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const a=x*2*Math.PI/16+y*2*Math.PI/32,b=x*2*Math.PI/32-y*2*Math.PI/16;
  const dx=.25*Math.cos(a)+.12*Math.cos(b),dy=.12*Math.cos(a)-.25*Math.cos(b),n=Math.hypot(dx,dy,1);
  data.set([128+127*dx/n,128+127*dy/n,128+127/n,255],(y*size+x)*4);
 }
 const tex=new T.DataTexture(data,size,size);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(12,10);tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.needsUpdate=true;return tex;
}
// Small procedural reflection environment; reused by all paint, chrome and glass.
export function reflectionSky(T){
 const w=128,h=64,data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const t=y/(h-1),a=x/w,upper=clamp((t-.43)*3,0,1),glow=Math.exp(-((a-.25)**2/.006+(t-.72)**2/.02));
  const base=t<.43?[.15,.16,.12]:[.55-.27*upper,.65-.22*upper,.73-.11*upper];
  data.set(base.map(v=>Math.round(255*clamp(v+.33*glow,0,1))).concat(255),(y*w+x)*4);
 }
 const tex=new T.DataTexture(data,w,h);tex.mapping=T.EquirectangularReflectionMapping;tex.magFilter=T.LinearFilter;tex.minFilter=T.LinearFilter;tex.needsUpdate=true;return tex;
}
// Instanced trees and grass avoid hundreds of individual draw calls on phones.
export function addRoadsideDetails(T,scene,height,advanced=false){
 let seed=83271;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const dummy=new T.Object3D(),color=new T.Color();
 const make=(name,geo,material,count)=>{const o=new T.InstancedMesh(geo,material,count);o.name=name;scene.add(o);return o;};
 const treeCount=advanced?24:56;
 const trunks=make('instanced roadside trunks',new T.CylinderGeometry(.12,.25,1,8),paint(T,0x6c543b,.98,0),treeCount);
 const crowns=make('layered roadside canopies',new T.IcosahedronGeometry(1,1),paint(T,0xffffff,.98,0),treeCount*3);
 trunks.castShadow=true;crowns.castShadow=true;
 for(let i=0;i<treeCount;i++){
  const side=advanced?1:(i%2?-1:1),x=side*(15+rand()*33),z=-112+rand()*154,y=height(x,z),h=4+rand()*3.2;
  dummy.position.set(x,y+h*.37,z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.set(1,h*.74,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
  for(let j=0;j<3;j++){
   dummy.position.set(x+(rand()-.5)*1.1,y+h*(.65+j*.15),z+(rand()-.5)*1.1);dummy.rotation.set(0,rand()*6.28,0);const r=(1.55-j*.28)*(.85+rand()*.3);dummy.scale.set(r,h*.30,r*.85);dummy.updateMatrix();crowns.setMatrixAt(i*3+j,dummy.matrix);color.setHSL(.25+rand()*.06,.25+rand()*.17,.22+rand()*.12);crowns.setColorAt(i*3+j,color);
  }
 }
 const tuft=make('low roadside grass tufts',new T.ConeGeometry(.15,.42,4),paint(T,0xffffff,.98,0),320);
 for(let i=0;i<320;i++){
  const side=advanced?1:(i%2?-1:1),x=side*(10.8+rand()*8.5),z=-112+rand()*155,y=height(x,z);
  dummy.position.set(x,y+.11,z);dummy.rotation.set((rand()-.5)*.35,rand()*6.28,(rand()-.5)*.35);dummy.scale.set(.5+rand(),.6+rand()*.65,.5+rand());dummy.updateMatrix();tuft.setMatrixAt(i,dummy.matrix);color.setHSL(.20+rand()*.09,.23+rand()*.22,.23+rand()*.18);tuft.setColorAt(i,color);
 }
 for(const o of [trunks,crowns,tuft]){o.instanceMatrix.needsUpdate=true;if(o.instanceColor)o.instanceColor.needsUpdate=true;o.computeBoundingSphere();}
 return [trunks,crowns,tuft];
}
