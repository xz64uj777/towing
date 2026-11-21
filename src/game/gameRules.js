// Testable completion and navigation rules for all seven dispatches.
export function canCompleteJob(kind,{reached,loaded,strapped,hook,recoveryConnected}) {
 if(!reached) return false;
 if(kind==='tow') return Boolean(loaded&&strapped);
 if(kind==='flatbed') return Boolean(loaded);
 if(kind==='heavy') return Boolean(recoveryConnected);
 return Boolean(hook);
}
export const minimapX=x=>70+x*1.5;
export const minimapY=z=>105+z*.9;
