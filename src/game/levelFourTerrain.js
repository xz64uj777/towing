// Level 4-only ravine. Identical height function drives the scene mesh,
// winch targets, truck suspension, placed anchors and steep-slope forces.
// Eighteen metres (about 59 feet) deep: an eroded steep-sided gorge, not a ditch.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const LEVEL_FOUR_DEPTH_METRES=18;
export const LEVEL_FOUR_STAGING={x:0,z:-49};
export function levelFourHeight(x,z){
 const distance=-z,west=-x;
 // Channel is cut beside the west road shoulder. It has tapered head and tail
 // and a narrow, shaded river bottom, with the far bank climbing to a ridge.
 const reach=smooth(34,48,distance)*(1-smooth(99,122,distance));
 const lip=6.2+.55*Math.sin((z+63)*.115);
 const nearWall=.70*smooth(lip,lip+4.7,west)+.30*smooth(lip+4.7,lip+13.4,west);
 const oppositeBank=smooth(29,45,west)*LEVEL_FOUR_DEPTH_METRES*reach;
 const mountain=23*smooth(42,78,west)*(.82+.18*Math.sin(z*.035+1.3));
 const erosion=(Math.sin(x*.27+z*.13)+Math.sin(x*.55-z*.23)*.5)*.16*smooth(6.3,15,west);
 return -.12-LEVEL_FOUR_DEPTH_METRES*nearWall*reach+oppositeBank+mountain+erosion;
}
export function levelFourSlope(x,z){
 const h=.35;
 return {x:(levelFourHeight(x+h,z)-levelFourHeight(x-h,z))/(2*h),
         z:(levelFourHeight(x,z+h)-levelFourHeight(x,z-h))/(2*h)};
}
export function levelFourDownhillAcceleration(x,z,strength=1){
 const slope=levelFourSlope(x,z),d=1+slope.x*slope.x+slope.z*slope.z;
 return {x:-9.81*strength*slope.x/d,z:-9.81*strength*slope.z/d};
}
