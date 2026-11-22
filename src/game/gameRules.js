// Testable completion and navigation rules for all seven dispatches.
export function canCompleteJob(kind,{reached,loaded,strapped,hook,recoveryConnected,delivered}) {
 if(!reached) return false;
 if(kind==='tow') return Boolean(delivered&&!loaded&&!strapped);
 if(kind==='flatbed') return Boolean(loaded);
 if(kind==='heavy') return Boolean(recoveryConnected);
 return Boolean(hook);
}
export const minimapX=x=>70+x*1.5;
export const minimapY=z=>105+z*.9;

// Both front tires must be positioned within the wheel grid before closing the L-arms.
export function wheelLiftCaptureReady({leftError,rightError,facing,height}) {
 return Number.isFinite(leftError)&&Number.isFinite(rightError)&&
  leftError<=1.05&&rightError<=1.05&&facing>=.60&&height<.38;
}

// Tension in kN against the game's rated winch capacity.
export function winchLoadBand(tension,limit){const fraction=Number.isFinite(tension)&&Number.isFinite(limit)&&limit>0?Math.max(0,Math.min(1,tension/limit)):0;return {fraction,level:fraction>=.85?'danger':fraction>=.60?'warning':'normal'};}
export const poweredWinchForce=(active,force)=>active&&Number.isFinite(force)?Math.max(0,force):0;
// Fast rolling resistance when the winch motor stops; seconds are frame-delta.
export function stopWinchCoast(speed,seconds){if(!Number.isFinite(speed)||!Number.isFinite(seconds))return 0;const v=Math.max(0,Math.abs(speed)-16*Math.max(0,seconds));return v<.035?0:Math.sign(speed)*v;}

// An idle recovery drum is braked, not free-spooling. A taut cable can therefore
// take opposing load even while its own motor is off. relativeSpeed is positive
// when the vehicle is approaching the guide and negative when moving away.
export function recoveryCableTension(distance,spool,relativeSpeed=0,limit=42000){
 if(![distance,spool,relativeSpeed,limit].every(Number.isFinite)||limit<=0)return 0;
 const stretch=distance-spool;
 if(stretch<=0)return 0;
 return Math.max(0,Math.min(limit,stretch*7200-relativeSpeed*1000));
}
export const canPowerBothRecoveryLines=(lines,ready)=>Boolean(ready&&Array.isArray(lines)&&lines.length===2&&lines.every(line=>line.connected));

// Presets use truck-relative orientation and can zoom without changing the target.
export function cameraPresetPose(mode,truck,yaw,vehicle,zoom=13){
 const scale=Math.max(.4,Math.min(3,zoom/13));
 const f={x:Math.sin(yaw),z:-Math.cos(yaw)},right={x:Math.cos(yaw),z:Math.sin(yaw)};
 const offset=(forward,side,height,lookX=truck.x,lookZ=truck.z,lookY=1.4)=>({
  position:{x:truck.x+f.x*forward*scale+right.x*side*scale,y:height*scale+1,z:truck.z+f.z*forward*scale+right.z*side*scale},
  target:{x:lookX,y:lookY,z:lookZ}
 });
 switch(mode){
  case 'chase':return offset(-7.5,0,3.1,truck.x+f.x*2.8,truck.z+f.z*2.8,1.7);
  case 'reverse':return offset(-3.3,0,6.6,truck.x-f.x*5.5,truck.z-f.z*5.5,.9);
  case 'front':return offset(8.3,0,2.9);
  case 'left':return offset(-1,-8.2,3.2);
  case 'right':return offset(-1,8.2,3.2);
  case 'top':return offset(-1.5,0,13.2);
  case 'hook':{
   const dx=truck.x-vehicle.x,dz=truck.z-vehicle.z,length=Math.max(.01,Math.hypot(dx,dz));
   return {position:{x:vehicle.x-dz/length*5.8*scale+dx/length*2*scale,y:3.6*scale+1,z:vehicle.z+dx/length*5.8*scale+dz/length*2*scale},target:{x:vehicle.x,y:1.35,z:vehicle.z}};
  }
  case 'wide':{
   const dx=vehicle.x-truck.x,dz=vehicle.z-truck.z,length=Math.max(.01,Math.hypot(dx,dz)),mid={x:(truck.x+vehicle.x)/2,z:(truck.z+vehicle.z)/2};
   const distance=Math.min(62,Math.max(11,length*.85+7))*scale;
   return {position:{x:mid.x-dz/length*distance,y:5+Math.min(24,length*.25)*scale,z:mid.z+dx/length*distance},target:{x:mid.x,y:1.4,z:mid.z}};
  }
  default:return offset(-9,0,5);
 }
}
