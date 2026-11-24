// Coordinate-based surface sampling, shared by the wrecker and both recovery targets.
// Coefficients are gameplay tuning, not real-world tire or winch ratings.
import {siteConfig,siteSurface} from './dispatchSites.js';
import {lakeHeight,LAKE_SURFACE} from './lakeScene.js';
import {levelFourHeight,levelFourSlope} from './levelFourTerrain.js';
import {recoveryGroundVelocity} from './gameRules.js';

const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=(a,b,n)=>{const t=clamp01((n-a)/(b-a));return t*t*(3-2*t);};
const profiles=Object.freeze({
 pavement:Object.freeze({name:'PAVEMENT',traction:1,lateralGrip:1,drag:.36}),
 gravel:Object.freeze({name:'GRAVEL',traction:.85,lateralGrip:.85,drag:.70}),
 grass:Object.freeze({name:'GRASS',traction:.72,lateralGrip:.72,drag:1.05}),
 mud:Object.freeze({name:'MUD',traction:.48,lateralGrip:.50,drag:1.80}),
 water:Object.freeze({name:'SUBMERGED',traction:.27,lateralGrip:.32,drag:2.65})
});
function mix(a,b,t){
 t=clamp01(t);
 return {name:t>=.5?b.name:a.name,traction:a.traction+(b.traction-a.traction)*t,
 lateralGrip:a.lateralGrip+(b.lateralGrip-a.lateralGrip)*t,drag:a.drag+(b.drag-a.drag)*t,
 depth:0};
}
// Smooth footprint edges to avoid instantaneous acceleration changes at the shoulder.
function footprint(x,z,cx,cz,hx,hz){
 return (1-smooth(hx-.35,hx+.35,Math.abs(x-cx)))*(1-smooth(hz-.35,hz+.35,Math.abs(z-cz)));
}
export function sampleSurface(levelIndex,x,z){
 if(siteConfig(levelIndex))return siteSurface(levelIndex,x,z);
 let ground=profiles.grass,depth=0;
 if(levelIndex>=3&&levelIndex!==4){
  const height=levelFourHeight(x,z),slope=levelFourSlope(x,z);
  // Exposed ravine soil and rock have more rolling resistance than pavement.
  const rough=Math.max(smooth(.25,1.1,Math.hypot(slope.x,slope.z)),smooth(1,12,-height));
  ground=mix(profiles.grass,profiles.mud,rough*.65);
 }
 if(levelIndex===2){
  ground=mix(ground,profiles.mud,footprint(x,z,10.5,-20,2,14));
 }
 if(levelIndex===4){
  const shore=smooth(5,9,-x)*(1-smooth(32,42,Math.abs(z+78)));
  ground=mix(ground,profiles.mud,shore);
  // Same footprint and elevation as the visible water mesh; no imaginary lake on the road.
  if(x>=-84&&x<=-10&&z>=-107&&z<=-49){
   depth=Math.max(0,LAKE_SURFACE-lakeHeight(x,z));
   ground=mix(ground,profiles.water,smooth(0,1.2,depth));
  }
 }
 // Road and pull-off geometry comes from TowingGame.jsx. The ditch overlaps the gravel
 // shoulder, so the visibly lower ditch takes priority over the gravel there.
 const shoulder=footprint(x,z,7.1,-36,2.5,90)*(levelIndex===2?1-footprint(x,z,10.5,-20,2,14):1);
 ground=mix(ground,profiles.gravel,shoulder);
 if(levelIndex===1)ground=mix(ground,profiles.gravel,footprint(x,z,3,-42,4,8.5));
 const road=footprint(x,z,0,-36,5,90);
 const lot=levelIndex===0?footprint(x,z,4,-19,8,8.5):0;
 ground=mix(ground,profiles.pavement,Math.max(road,lot));
 return {...ground,depth};
}
export function recoverySurfaceVelocity(x,z,yaw,roll,seconds,surface){
 const v=recoveryGroundVelocity(x,z,yaw,roll,seconds*surface.lateralGrip);
 // Isotropic rolling/water drag is separate from tire side-slip resistance.
 const drag=surface.drag+.16*(1-Math.max(0,Math.cos(roll)));
 const decay=Math.exp(-drag*seconds);
 return {x:v.x*decay,z:v.z*decay};
}
