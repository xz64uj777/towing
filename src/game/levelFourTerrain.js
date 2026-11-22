// Level 4 only: the road stays at grade while the west shoulder drops
// into a 9–10 m (roughly 30 ft) ravine and rises toward a mountainside.
// All quantities are world metres. Keep deterministic for replay and restart.
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const LEVEL_FOUR_DEPTH_METRES=9.4;
export function levelFourHeight(x,z){
 const distance=-z,west=-x;
 const reach=smooth(37,53,distance)*(1-smooth(94,113,distance));
 const cross=smooth(6.2,15.5,west)*(1-smooth(27,39,west));
 const carved=-LEVEL_FOUR_DEPTH_METRES*cross*reach;
 const ridge=16.5*smooth(38,74,west)*(.78+.22*Math.sin(z*.035+1.6));
 const ripple=(Math.sin(x*.35+z*.17)+Math.sin(x*.19-z*.31)*.65)*.16;
 const texture=ripple*smooth(5.5,12,Math.abs(x))*(1-smooth(7,11,Math.max(0,Math.abs(x)-39)));
 return -.12+carved+ridge+texture;
}
export function levelFourSlope(x,z){
 const h=.5;
 return {x:(levelFourHeight(x+h,z)-levelFourHeight(x-h,z))/(2*h),
         z:(levelFourHeight(x,z+h)-levelFourHeight(x,z-h))/(2*h)};
}
export function levelFourDownhillAcceleration(x,z,strength=1){
 const slope=levelFourSlope(x,z),d=1+slope.x*slope.x+slope.z*slope.z;
 return {x:-9.81*strength*slope.x/d,z:-9.81*strength*slope.z/d};
}
