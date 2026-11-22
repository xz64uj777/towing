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
