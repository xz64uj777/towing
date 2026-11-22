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
