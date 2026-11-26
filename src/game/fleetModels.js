import {loftGeometry,surfaceMap} from './visualQuality.js';

// Original game-scale bodywork. Preserve existing wheel centers, tire radii,
// ramp dimensions, recovery eyes and hydraulic attachment coordinates.
const material=(T,color,roughness=.43,metalness=.22)=>new T.MeshStandardMaterial({color,roughness,metalness});
function mesh(T,parent,name,geo,mat,p=[0,0,0]){
 const o=new T.Mesh(geo,mat);o.name=name;o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
const box=(T,p,n,d,v,m)=>mesh(T,p,n,new T.BoxGeometry(...d),m,v);
function pane(T,p,n,points,m){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return mesh(T,p,n,g,m);
}
export const VEHICLE_MODEL_KINDS=Object.freeze(['light','medium','flatbed','pickup','suv','delivery']);
const profiles={
 light:{hood:1.89,roof:2.43,front:-3.20,wind:-2.11,roofFront:-1.49,roofRear:-.52,cabEnd:-.18,width:.96},
 medium:{hood:2.02,roof:2.64,front:-3.20,wind:-2.11,roofFront:-1.66,roofRear:-.51,cabEnd:-.18,width:1.01},
 flatbed:{hood:1.91,roof:2.57,front:-3.20,wind:-2.10,roofFront:-1.58,roofRear:-.51,cabEnd:-.20,width:.99},
 pickup:{hood:1.79,roof:2.36,front:-3.20,wind:-2.10,roofFront:-1.49,roofRear:-.49,cabEnd:-.12,width:.97},
 suv:{hood:1.65,roof:2.38,front:-3.20,wind:-2.11,roofFront:-1.45,roofRear:1.48,cabEnd:2.20,width:.99},
 delivery:{hood:1.91,roof:2.49,front:-3.20,wind:-2.10,roofFront:-1.64,roofRear:-.52,cabEnd:-.15,width:1.00}
};
// Actual wheel openings, measured at the existing axle locations (not a scaled
// wheelbase). Outer edge remains within the established rollback width.
export function fleetArchHeight(z,axle,scale){
 const r=.62*scale,d=z-axle;
 return Math.max(.72*scale,Math.abs(d)<r?.62*scale+Math.sqrt(r*r-d*d):0);
}
function archShell(T,parent,{side,z0,z1,axle,scale,top,inner,outer,paint,trim,name}){
 const r=.62*scale,cuts=[z0,z1];
 for(let i=0;i<=32;i++){const a=axle-r+2*r*i/32;if(a>z0&&a<z1)cuts.push(a);}
 cuts.sort((a,b)=>a-b);
 const pos=[],idx=[];
 for(const z of cuts){
  const low=fleetArchHeight(z,axle,scale),end=Math.min(1,(z-z0)/.15,(z1-z)/.15);
  const x=outer-.035*(1-end),y=Math.max(low+.075,top-.035*(1-end));
  pos.push(side*x,low,z,side*x,y-.045,z,side*(x-.045),y,z,side*inner,y,z,side*inner,low,z);
 }
 for(let i=0;i<cuts.length-1;i++)for(let j=0;j<5;j++){
  const a=i*5+j,b=i*5+(j+1)%5,c=a+5,d=b+5;idx.push(a,b,c,b,d,c);
 }
 const k=(cuts.length-1)*5;for(let j=1;j<4;j++)idx.push(0,j,j+1,k,k+j+1,k+j);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingBox();
 const m=paint.clone();m.side=T.DoubleSide;mesh(T,parent,name,g,m);
 const lip=[],ix=[];
 for(let i=0;i<=24;i++){const a=Math.PI*i/24;for(const radius of [r,r+.038])lip.push(side*(outer+.005),.62*scale+radius*Math.sin(a),axle+radius*Math.cos(a));}
 for(let i=0;i<24;i++){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(lip,3));geo.setIndex(ix);geo.computeVertexNormals();const lm=trim.clone();lm.side=T.DoubleSide;mesh(T,parent,name+' lip',geo,lm);
}
export function addFleetBody(T,body,{kind,scale=1,color=0x446688}){
 const p=profiles[kind];if(!p)throw new Error('Unknown fleet model '+kind);
 const root=new T.Group();root.name='dedicated '+kind+' body';body.add(root);
 const S=scale,flat=kind==='flatbed',tow=kind==='light'||kind==='medium',commercial=tow||flat||kind==='delivery',suv=kind==='suv';
 const paint=material(T,color,.37,.25),trim=material(T,0x262d31,.83,.1),steel=material(T,0xa7b0b4,.36,.67),rubber=material(T,0x181e21,.93,.05),glass=material(T,0x2e4d5b,.17,.35),seal=material(T,0x182125,.82,.07);
 glass.side=seal.side=T.DoubleSide;
 const amber=material(T,0xe8a02d,.25,.13),red=material(T,0xa8292e,.26,.12),white=material(T,0xe8e9db,.21,.16);
 const B=(n,d,v,m)=>box(T,root,n,d.map(x=>x*S),v.map(x=>x*S),m);
 const G=(n,stations,m)=>mesh(T,root,n,loftGeometry(T,stations,S),m);
 const P=(n,pts,m)=>pane(T,root,n,pts.map(v=>v.map(x=>x*S)),m);
 const h=p.hood,r=p.roof,w=p.width;
 // Hood and cabin meet at the cowl. Lower wheel pods bridge into the
 // main shell; no solid body crosses the upper tire envelope.
 G(kind+' shaped hood',[[p.front,.82,1.21,h-.25,h-.17,.74],[-3.00,w,1.21,h-.11,h-.04,.86],[-2.50,w,1.24,h-.06,h,.90],[p.wind,w,1.30,h-.02,h+.02,.88]],paint);
 G(kind+' shaped cabin',[[p.wind,w,1.27,h-.02,h+.02,.88],[p.roofFront,w,1.27,h-.01,r-.06,.82],[p.roofFront+.12,w,1.27,h-.01,r,.80],[p.roofRear,w,1.27,h-.01,r-.04,.80],[p.cabEnd,.90,1.27,h-.04,suv?h+.12:r-.20,.78]],paint);
 const ws=[[ -.86,h+.045,p.wind-.016],[.86,h+.045,p.wind-.016],[.80,r-.045,p.roofFront-.018],[-.80,r-.045,p.roofFront-.018]];
 P('bonded windshield surround',ws,seal);
 P('laminated windshield',ws.map(([x,y,z])=>[x*.90,y*.94+(h+r)*.03,z-.024]),glass);
 const outer=Math.min(1.26,1.06+.16*S+.026),inner=.86*S;
 const frontTop=Math.max(1.34*S,.62*S+.62*S+.10);
 const rearAxle=flat?3.65:1.55;
 for(const side of [-1,1]){
  const paneX=y=>side*(w-(w-.80)*Math.max(0,Math.min(1,(y-h)/(r-h)))+.025);
  const y0=h+.085,y1=r-.135;
  const window=(n,a,b)=>P(n,[[paneX(y0),y0,a],[paneX(y0),y0,b],[paneX(y1),y1,b],[paneX(y1),y1,a]],glass);
  const split=suv?-.30:(p.roofFront+p.roofRear)*.5;
  window('front door window',p.roofFront+.07,split-.055);
  window('rear side window',split+.055,p.roofRear-.07);
  B('front door handle',[.042,.055,.19],[side*(w+.018),h-.16,split-.12],steel);
  B('door shut line',[.019,.34,.021],[side*(w+.019),h-.29,split],trim);
  B('mirror arm',[.22,.06,.10],[side*(w+.10),h+.10,p.wind+.16],trim);
  B('door mirror',[.14,commercial?.28:.16,.20],[side*(w+.20),h+.12,p.wind+.16],trim);
  archShell(T,root,{side,z0:-2.95*S,z1:.06*S,axle:-1.55,scale:S,top:frontTop,inner,outer,paint,trim:rubber,name:'integrated front wheel housing'});
  if(flat){
   // Carrier mudguards end below the stowed deck surface and are fixed
   // to the chassis, not the moving deck or its tie-down points.
   archShell(T,root,{side,z0:rearAxle-.83*S,z1:rearAxle+.83*S,axle:rearAxle,scale:S,top:1.32*S,inner,outer,paint:trim,trim:rubber,name:'carrier rear wheel guard'});
   box(T,root,'carrier toolbox',[.40,.40,.96],[side*.86,.81,1.33],paint);
   box(T,root,'carrier toolbox latch',[.035,.085,.17],[side*1.075,.86,1.33],steel);
  }else{
   const top=tow?1.93:1.46*S;
   archShell(T,root,{side,z0:.06*S,z1:2.24*S,axle:rearAxle,scale:S,top,inner:tow?.64:inner,outer,paint,trim:rubber,name:tow?'integrated wrecker side pod':'integrated rear wheel housing'});
   if(tow){
    for(const [z,width] of [[.48,.63],[1.39,.98],[2.05,.36]]){
     box(T,root,'recessed wrecker locker',[.028,.38,width],[side*(outer+.012),1.69,z],trim);
     box(T,root,'flush wrecker locker door',[.033,.33,width-.045],[side*(outer+.027),1.69,z],paint);
     box(T,root,'locker slam latch',[.025,.07,.16],[side*(outer+.048),1.71,z],steel);
    }
    box(T,root,'wrecker deck edge cap',[.40,.065,2.07],[side*.94,1.97,1.13],steel);
   }
  }
  if(commercial){
   B('cab access step',[.25,.10,.59],[side*1.06,.86,-.47],steel);
   box(T,root,'rear mudflap',[.30*S,.36*S,.055],[side*1.06,.47*S,rearAxle+.55*S],rubber);
  }
  B('headlamp recess',[.40,.23,.07],[side*.70,h-.34,p.front-.024],trim);
  B('headlamp lens',[.34,.17,.065],[side*.70,h-.33,p.front-.071],white);
  B('amber turn signal',[.08,.10,.05],[side*.90,h-.34,p.front-.064],amber);
  if(!flat){
   B('rear lamp surround',[.31,.20,.07],[side*.78,1.42,2.24],trim);
   B('rear stop lens',[.19,.14,.055],[side*.81,1.43,2.287],red);
  }
 }
 B('formed grille surround',[1.10,commercial?.42:.27,.09],[0,h-.30,p.front-.035],commercial?steel:trim);
 B('radiator intake',[.98,commercial?.34:.20,.06],[0,h-.30,p.front-.092],trim);
 for(let i=0;i<3;i++)B('grille slat',[.91,.023,.03],[0,h-.39+i*.075,p.front-.133],steel);
 B('integrated front bumper',[1.96,.22,.17],[0,1.09,p.front-.025],commercial?steel:trim);
 if(suv){
  G('crossover continuous lower body',[[p.wind,.91,1.25,h-.02,h,.87],[0,.98,1.25,h,h+.015,.91],[1.6,.98,1.25,h,h,.91],[2.24,.87,1.25,h-.12,h-.08,.82]],paint);
  P('crossover rear hatch glass',[[-.73,r-.17,p.roofRear+.13],[.73,r-.17,p.roofRear+.13],[.75,h+.18,p.cabEnd+.025],[-.75,h+.18,p.cabEnd+.025]],glass);
  B('crossover sculpted rear bumper',[1.90,.20,.15],[0,1.12,2.24],trim);
  for(const side of [-1,1])B('crossover roof rail',[.058,.065,2.4],[side*.63,r+.035,.10],trim);
 }else if(kind==='pickup'){
  // Open cargo box, not a solid slab on top of the frame.
  B('pickup cargo floor',[1.68,.10,2.12],[0,1.35,1.13],trim);
  for(const side of [-1,1])B('pickup bed side wall',[.16,.40,2.12],[side*.88,1.58,1.13],paint);
  B('pickup tailgate',[1.74,.42,.13],[0,1.58,2.24],paint);
  B('pickup rear step bumper',[1.90,.17,.16],[0,1.10,2.25],steel);
 }else if(kind==='delivery'){
  const cargo=material(T,0xc8d4dc,.62,.1);
  // Keep cargo box within the previous heavy-recovery height and footprint.
  box(T,root,'delivery cargo body',[1.96,1.10,2.55],[0,2.02,.90],cargo);
  for(const side of [-1,1]){
   box(T,root,'cargo rear corner extrusion',[.06,1.1,.065],[side*.96,2.02,2.17],steel);
   box(T,root,'cargo rear door panel',[.91,1.01,.045],[side*.47,2.02,2.20],cargo);
   box(T,root,'cargo locking rod',[.045,.87,.055],[side*.36,2.02,2.24],steel);
   for(const y of [1.72,2.31])box(T,root,'cargo door hinge',[.13,.06,.06],[side*.86,y,2.24],steel);
   box(T,root,'cargo lower rub rail',[.06,.085,2.50],[side*.99,1.52,.90],steel);
  }
  box(T,root,'cargo door center seal',[.032,1.01,.06],[0,2.02,2.23],trim);
  box(T,root,'delivery rear underride bumper',[1.97,.15,.16],[0,1.05,2.23],steel);
 }else if(tow){
  box(T,root,'wrecker center equipment deck',[1.28,.10,2.03],[0,1.89,1.12],trim);
  // Keep the underlift hinge and stinger passage open below the rear deck.
  box(T,root,'wrecker rear apron',[2.25,.19,.15],[0,1.79,2.27],paint);
 }else if(flat){
  for(const side of [-1,1])box(T,root,'rollback subframe rail',[.16,.17,4.70],[side*.50,1.10,2.66],trim);
  box(T,root,'carrier rear crossmember',[1.91,.15,.16],[0,.84,5.12],steel);
 }
 if(tow||flat){
  B('roof beacon base',[1.39,.075,.26],[0,r+.04,-1.0],trim);
  const lamp=amber.clone();lamp.emissive=new T.Color(0xa75d08);lamp.emissiveIntensity=.35;
  for(const side of [-1,1])B('amber roof beacon',[.61,.12,.24],[side*.35,r+.12,-1.0],lamp);
 }
 return root;
}
export function detailMediumRig(T,{recoveryStructure,boomPivot,boomTilt,boomTip}){
 const steel=material(T,0x97a4aa,.38,.65),dark=material(T,0x29343a,.66,.3);
 recoveryStructure.traverse(o=>{if(['wrecker tool cabinet','side locker door','locker latch'].includes(o.name))o.visible=false;});
 box(T,recoveryStructure,'fixed boom pedestal',[1.10,.62,1.15],[0,1.74,1.13],dark);
 for(const side of [-1,1]){
  box(T,boomPivot,'fixed boom hinge cheek',[.12,.40,.58],[side*.42,0,.05],steel);
  box(T,boomTilt,'boom reinforcing rib',[.04,.10,2.3],[side*.38,.11,1.40],steel);
  const pulley=mesh(T,boomTip,'medium cable sheave rim',new T.CylinderGeometry(.24,.24,.045,24),steel,[side*.35,0,0]);pulley.rotation.z=Math.PI/2;
 }
}
export function detailCarrierDeck(T,bed,length){
 const steel=material(T,0x929ea4,.53,.6),dark=material(T,0x263039,.78,.3),amber=material(T,0xe0a43d,.37,.15);
 // All these meshes follow the original moving deck; the deck top,
 // winch position and collision dimensions stay exactly the same.
 for(const side of [-1,1]){
  box(T,bed,'carrier side extrusion',[.075,.16,length-.14],[side*1.21,-.025,0],steel);
  for(const z of [-length*.34,0,length*.34])box(T,bed,'recessed side marker',[.022,.055,.13],[side*1.253,-.025,z],amber);
 }
 const drum=mesh(T,bed,'carrier cable spool',new T.CylinderGeometry(.13,.13,.48,24),steel,[0,.33,-length/2+.29]);drum.rotation.z=Math.PI/2;
 for(const side of [-1,1]){
  const flange=mesh(T,bed,'carrier spool flange',new T.CylinderGeometry(.17,.17,.035,20),dark,[side*.255,.33,-length/2+.29]);flange.rotation.z=Math.PI/2;
 }
 for(const child of bed.children)if(child.name==='rollback winch drum')child.visible=false;
 // Tail edge stays within the original bed envelope.
 box(T,bed,'carrier tail reinforcement',[2.50,.10,.08],[0,-.025,length/2-.045],dark);
}

// Original civilian recovery body for the woodland 8×8. The boom and
// wheel lift are mounted separately by the vehicle builder.
export function addOffroadBody(T,body,color){
 const paint=material(T,color,.44,.28),dark=material(T,0x252c28,.72,.25);
 const glass=material(T,0x35565b,.21,.32),metal=material(T,0x868b81,.42,.55),amber=material(T,0xe8a939,.34,.14);
 const part=(name,size,pos,surface=paint)=>box(T,body,name,size,pos,surface);
 part('forward control cab',[2.48,1.47,2.23],[0,2.16,-2.98]);
 part('cab roof extension',[2.54,.18,2.31],[0,2.96,-2.97]);
 part('steel brush bumper',[2.78,.42,.46],[0,1.15,-4.19],dark);
 part('front winch fairlead',[.70,.24,.12],[0,1.02,-4.43],dark);
 part('front cable eye',[.20,.15,.10],[0,.96,-4.50],amber);
 part('front grille',[1.1,.41,.08],[0,1.68,-4.13],dark);
 part('engine enclosure',[2.14,.90,1.48],[0,1.96,-.93]);
 part('rear recovery platform',[2.49,.22,4.51],[0,1.52,1.46],dark);
 part('amber warning bar',[.98,.15,.25],[0,3.12,-2.66],amber);
 for(const side of [-1,1]){
  part('frame rail',[.19,.32,7.8],[side*.65,1.18,-.15],dark);
  part('split windscreen',[1.03,.60,.055],[side*.56,2.53,-4.11],glass);
  part('side window',[.055,.62,1.25],[side*1.251,2.51,-3.10],glass);
  part('cab access step',[.32,.17,.64],[side*1.28,1.38,-2.16],metal);
  part('front headlight',[.39,.23,.085],[side*.91,1.50,-4.13],metal);
  part('corner marker',[.14,.13,.08],[side*1.24,1.68,-4.13],amber);
  part('recovery equipment locker',[.41,.61,3.55],[side*1.02,1.91,1.55]);
  part('rear lamp',[.36,.18,.05],[side*.98,1.55,3.75],material(T,0x9e3d30,.34,.16));
  for(const z of [.30,1.48,2.66])part('locker handle',[.036,.06,.20],[side*1.24,2.03,z],metal);
 }
 for(const z of [-2.75,-1.27,1.33,2.80]){
  part('drive axle',[2.2,.16,.16],[0,.76,z],dark);
  part('differential',[.39,.29,.37],[0,.76,z],dark);
 }
 return body;
}
