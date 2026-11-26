// Game-tuned recovery dynamics. The values are for the simulation.
export const DESERT_INDEX=9;
export const DESERT_SITE={kind:'desert',start:{x:0,z:-70},goals:[{x:0,z:-65,r:7}],bounds:{minX:-35,maxX:35,minZ:-125,maxZ:-55}};
export function desertSurface(x,z){
 const sand=Math.max(0,Math.min(1,(Math.abs(x)-4)/8));
 return {name:sand>.5?'LOOSE SAND':'HARDPACK',traction:.92-.49*sand,lateralGrip:.84-.45*sand,drag:.55+1.7*sand,depth:0,sand};
}
export function desertHeight(x,z){
 return .04+desertSurface(x,z).sand*(.65*Math.sin(z*.14+x*.23)+.37*Math.cos(x*.51)-.6);
}
export function trackMotion(throttle,steer,speed,grip){
 return {left:throttle+steer*.8,right:throttle-steer*.8,yaw:steer*(.48+Math.min(1,Math.abs(speed)*.14))*grip};
}
export function cableBreaks(distance,spool,pathSpeed,limit){
 return distance>spool&&Math.max(0,distance-spool)*7200+Math.max(0,pathSpeed)*1000>limit*1.48;
}
