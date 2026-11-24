import {loftGeometry,surfaceMap} from './visualQuality.js';

// Purpose-built compact heavy rotator, with unchanged rigging hardpoints.
// Coordinates below are in the existing chassis-local frame, front = -Z.
// The visual model keeps the established two axle positions; rear duals
// are additional tire meshes, not extra simulation axles.
export const ROTATOR_AXLES=Object.freeze([-1.55,1.55]);
const mat=(T,color,roughness=.5,metalness=.2)=>new T.MeshStandardMaterial({color,roughness,metalness});
function mesh(T,parent,name,geometry,material,pos=[0,0,0]){
 const o=new T.Mesh(geometry,material);o.name=name;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
const box=(T,parent,name,dim,pos,m)=>mesh(T,parent,name,new T.BoxGeometry(...dim),m,pos);
function pane(T,parent,name,points,m){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return mesh(T,parent,name,g,m);
}
export function rotatorArchBottom(z,axle,scale=1){
 // Tire sweep clearance also accommodates the existing suspension travel.
 const radius=.73*scale,d=z-axle,base=.74*scale;
 return Math.abs(d)>=radius?base:Math.max(base,.62*scale+Math.sqrt(radius*radius-d*d));
}
function wheelPod(T,parent,side,z0,z1,axle,scale,top,outer,inner,paint,trim,name){
 const radius=.73*scale,stations=[z0,z1];
 for(let i=0;i<=28;i++){const z=axle-radius+2*radius*i/28;if(z>z0&&z<z1)stations.push(z);}
 stations.sort((a,b)=>a-b);
 const positions=[],indices=[];
 for(const z of stations){
  const low=rotatorArchBottom(z,axle,scale),end=Math.min(1,(z-z0)/.18,(z1-z)/.18);
  const x=outer-.055*(1-end),y=top-.075*(1-end);
  positions.push(side*x,low,z,side*x,y-.065,z,side*(x-.065),y,z,side*inner,y,z,side*inner,low,z);
 }
 for(let i=0;i<stations.length-1;i++)for(let j=0;j<5;j++){
  const a=i*5+j,b=i*5+(j+1)%5,c=a+5,d=b+5;
  indices.push(a,b,c,b,d,c);
 }
 const k=(stations.length-1)*5;for(let j=1;j<4;j++)indices.push(0,j,j+1,k,k+j+1,k+j);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();
 const shellMat=paint.clone();shellMat.side=T.DoubleSide;mesh(T,parent,name,g,shellMat);
 // Dark wheel-opening lip follows the actual curved cutout.
 const lip=[],idx=[];
 for(let i=0;i<=32;i++){
  const a=Math.PI*i/32;for(const r of [radius,radius+.055])lip.push(side*(outer+.006),.62*scale+r*Math.sin(a),axle+r*Math.cos(a));
 }
 for(let i=0;i<32;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(lip,3));geo.setIndex(idx);geo.computeVertexNormals();
 const m=trim.clone();m.side=T.DoubleSide;mesh(T,parent,name+' wheel opening trim',geo,m);
}
export function addRotatorBody(T,body,{scale=1.13,color=0x5e68b0}={}){
 const root=new T.Group();root.name='dedicated heavy rotator body';body.add(root);
 const paint=mat(T,color,.38,.28),dark=mat(T,0x21292e,.76,.16),rubber=mat(T,0x151a1c,.92,.05),steel=mat(T,0xa0a9ae,.38,.65),chrome=mat(T,0xc3cbd0,.25,.8);
 const glass=mat(T,0x284653,.16,.35);glass.side=T.DoubleSide;
 const seal=mat(T,0x141d21,.82,.08);seal.side=T.DoubleSide;
 const white=mat(T,0xe9ebdc,.19,.15),red=mat(T,0x9e2426,.28,.12),amber=mat(T,0xe4a32e,.30,.15);
 const B=(n,d,p,m)=>box(T,root,n,d,p,m),G=(n,stations,m)=>mesh(T,root,n,loftGeometry(T,stations,1),m);
 const S=scale,front=ROTATOR_AXLES[0],rear=ROTATOR_AXLES[1],outer=1.06+.16*S+.095;
 // Short sloping heavy-duty hood and broad cab. The lower fender
 // surfaces bridge their sill directly into the body rather than float outside it.
 G('rotator contoured engine hood',[
  [-3.2*S,.91*S,1.04*S,1.68*S,1.78*S,.78*S],
  [-3.03*S,1.02*S,1.03*S,1.84*S,1.94*S,.91*S],
  [-2.43*S,1.04*S,1.12*S,1.91*S,2.00*S,.91*S],
  [-2.06*S,1.02*S,1.38*S,1.95*S,2.05*S,.92*S]
 ],paint);
 G('rotator reinforced cab',[
  [-2.29*S,1.02*S,1.37*S,1.96*S,2.01*S,.92*S],
  [-1.70*S,1.04*S,1.37*S,2.04*S,2.67*S,.91*S],
  [-1.57*S,1.04*S,1.37*S,2.04*S,2.73*S,.90*S],
  [-.46*S,1.04*S,1.37*S,2.04*S,2.73*S,.91*S],
  [-.22*S,1.01*S,1.37*S,2.00*S,2.65*S,.86*S],
  [-.12*S,1.00*S,1.37*S,1.99*S,2.50*S,.81*S]
 ],paint);
 const P=(n,points,m)=>pane(T,root,n,points.map(p=>p.map(v=>v*S)),m);
 // Sloped laminated windshield with a separate rubber perimeter and divider.
 const w=(left,right)=>[[left,2.045,-2.295],[right,2.045,-2.295],[right*.95,2.635,-1.710],[left*.95,2.635,-1.710]];
 P('rotator windshield seal',w(-.91,.91),seal);
 P('driver windshield',w(-.85,-.025).map(([x,y,z])=>[x,y+.012,z-.014]),glass);
 P('passenger windshield',w(.025,.85).map(([x,y,z])=>[x,y+.012,z-.014]),glass);
 for(const side of [-1,1]){
  const x=side*1.052;
  P('rotator side glass seal',[[x,2.07,-1.67],[x,2.07,-.42],[side*.94,2.62,-.42],[side*.94,2.62,-1.67]],seal);
  P('rotator side glass',[[x+side*.012,2.11,-1.61],[x+side*.012,2.11,-.48],[side*.952,2.56,-.48],[side*.952,2.56,-1.61]],glass);
  B('cab door rear seam',[.018,.66*S,.018],[side*1.045*S,1.72*S,-.31*S],dark);
  B('cab door handle',[.05,.07*S,.23*S],[side*1.06*S,1.92*S,-.53*S],chrome);
  B('mirror support',[.29*S,.06,.10],[side*1.14*S,2.15*S,-1.91*S],dark);
  B('large heated mirror',[.15*S,.37*S,.23*S],[side*1.26*S,2.18*S,-1.91*S],dark);
  B('mirror glass',[.13*S,.30*S,.018],[side*1.26*S,2.18*S,-1.78*S],steel);
  wheelPod(T,root,side,-2.98*S,.02,front,S,1.60*S,outer,.86*S,paint,rubber,'integrated front fender');
  // Cabinet side pods taper around the rear duals and share the full fender
  // shell, keeping the central rotating structure and cable return free.
  wheelPod(T,root,side,.02,2.65,rear,S,1.96,outer,.64*S,paint,rubber,'integrated recovery locker and rear fender');
  const doorX=side*(outer+.013);
  for(const [z,width] of [[.52,.75],[1.48,.98],[2.28,.48]]){
   B('recessed compartment surround',[.026,.42,width],[doorX,1.68,z],dark);
   B('flush recovery compartment door',[.034,.37,width-.05],[doorX+side*.018,1.68,z],paint);
   B('stainless slam latch',[.025,.075,.17],[doorX+side*.041,1.69,z+.12],chrome);
  }
  B('cab access step upper',[.30,.11,.58],[side*1.10*S,1.13*S,-.53*S],steel);
  B('cab access step lower',[.32,.10,.60],[side*1.09*S,.85*S,-.53*S],steel);
  B('rear splash guard',[.30,.43,.075],[side*1.06,.42*S,rear+.55*S],rubber);
  // Air tank between the axles, fitted under the recovery body.
  const tank=mesh(T,root,'air reservoir',new T.CylinderGeometry(.18,.18,.67,16),steel,[side*.61*S,.70*S,.10]);tank.rotation.x=Math.PI/2;
  // Vertical exhaust stack behind the cab.
  mesh(T,root,'polished exhaust stack',new T.CylinderGeometry(.065,.065,1.03,12),chrome,[side*.91*S,2.19*S,-.12*S]);
  mesh(T,root,'perforated exhaust shield',new T.CylinderGeometry(.105,.105,.62,12),steel,[side*.91*S,2.03*S,-.12*S]);
  B('forward headlamp recess',[.40*S,.29*S,.075],[side*.74*S,1.56*S,-3.2*S-.025],dark);
  for(const x of [-.105,.105])B('headlamp lens',[.17*S,.17*S,.065],[(side*.74+x)*S,1.56*S,-3.2*S-.071],white);
  B('front amber turn signal',[.15*S,.095*S,.063],[side*.85*S,1.40*S,-3.2*S-.07],amber);
  B('rear marker housing',[.37,.24,.075],[side*.98,1.61,2.67],dark);
  B('rear stop lamp',[.15,.15,.06],[side*1.04,1.61,2.72],red);
  B('rear reverse lamp',[.10,.15,.06],[side*.85,1.61,2.72],white);
  for(const z of [.35,1.13,2.28])B('side amber clearance lamp',[.045,.065,.14],[side*(outer+.035),1.99,z],amber);
 }
 B('heavy grille surround',[1.13*S,.68*S,.11],[0,1.63*S,-3.20*S-.025],chrome);
 B('deep radiator grille',[1.00*S,.55*S,.08],[0,1.63*S,-3.20*S-.095],dark);
 for(let i=0;i<6;i++)B('radiator grille louver',[.96*S,.026*S,.035],[0,(1.40+.087*i)*S,-3.20*S-.145],steel);
 B('wraparound front bumper',[2.10*S,.25*S,.20],[0,1.08*S,-3.20*S-.05],chrome);
 B('front bumper air opening',[.70*S,.105*S,.025],[0,1.08*S,-3.20*S-.165],dark);
 B('rear recovery crossmember',[2.37,.24,.19],[0,1.10,2.67],dark);
 // Chevrons on the fixed rear apron, separate from the working underlift.
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const x=side*(.40+i*.17),y=1.105,z=2.77;
  pane(T,root,'rear conspicuity chevron',[[x-.055,y-.09,z],[x+.045,y-.09,z],[x+.10,y+.09,z],[x,y+.09,z]],i%2?red:amber);
 }
 const deckMat=mat(T,0x747c81,.65,.48);deckMat.map=surfaceMap(T,3,8,60,'steel');
 for(const side of [-1,1])B('diamond plate locker cap',[.47,.065,2.51],[side*.96,1.99,1.34],deckMat);
 B('roof lightbar mount',[1.58*S,.08,.27],[0,2.75*S,-1.04*S],dark);
 const lamp=amber.clone();lamp.emissive=new T.Color(0xb7670d);lamp.emissiveIntensity=.35;
 for(const side of [-1,1])B('rotator amber lightbar lens',[.70*S,.13,.25],[side*.39*S,2.75*S+.10,-1.04*S],lamp);
 for(let i=-2;i<=2;i++)B('roof clearance light',[.085,.055,.10],[i*.24*S,2.73*S+.025,-1.64*S],amber);
 return root;
}
// Visual detail only: nothing moves or renames the existing boom hardpoints.
export function detailRotatorRig(T,{recoveryStructure,boomPivot,boomTilt,boomSleeve,boomTip}){
 const dark=mat(T,0x28343c,.61,.4),steel=mat(T,0x9faab0,.38,.67),gold=mat(T,0xd5a532,.43,.37),black=mat(T,0x161b1e,.86,.15);
 const hide=(parent,name)=>{const o=parent.getObjectByName(name);if(o)o.visible=false;};
 for(const name of ['wrecker tool cabinet','side locker door','locker latch'])recoveryStructure.traverse(o=>{if(o.name===name)o.visible=false;});
 hide(recoveryStructure,'recovery boom hinge');
 const ring=mesh(T,recoveryStructure,'slew bearing',new T.CylinderGeometry(.66,.73,.20,32),dark,[0,2.02,1.13]);
 mesh(T,recoveryStructure,'slew bearing bright rim',new T.CylinderGeometry(.68,.68,.045,32),steel,[0,2.14,1.13]);
 for(const side of [-1,1]){
  box(T,boomPivot,'rotator pivot cheek',[.18,.56,.70],[side*.46,.03,.04],gold);
  const pin=mesh(T,boomPivot,'boom pivot pin',new T.CylinderGeometry(.14,.14,.055,16),steel,[side*.56,.03,0]);pin.rotation.z=Math.PI/2;
  box(T,boomTilt,'reinforced boom side rail',[.045,.13,2.45],[side*.38,.11,1.36],steel);
  box(T,boomSleeve,'telescoping guide strip',[.03,.075,.75],[side*.27,.09,0],dark);
 }
 hide(boomTip,'cable sheave');hide(boomTip,'recovery hook');
 for(const side of [-1,1]){
  const cheek=mesh(T,boomTip,'sheave cheek plate',new T.CylinderGeometry(.26,.26,.085,24),gold,[side*.37,0,0]);cheek.rotation.z=Math.PI/2;
  const wheel=mesh(T,boomTip,'grooved cable pulley',new T.CylinderGeometry(.225,.225,.14,24),steel,[side*.23,0,0]);wheel.rotation.z=Math.PI/2;
  const groove=mesh(T,boomTip,'pulley cable groove',new T.TorusGeometry(.22,.027,8,24),black,[side*.23,0,0]);groove.rotation.y=Math.PI/2;
 }
 const pin=mesh(T,boomTip,'sheave axle',new T.CylinderGeometry(.085,.085,.84,16),steel);pin.rotation.z=Math.PI/2;
 return ring;
}
