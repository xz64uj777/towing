import test from 'node:test';
import assert from 'node:assert/strict';
import {canCompleteJob,minimapX,minimapY,wheelLiftCaptureReady,winchLoadBand,poweredWinchForce,stopWinchCoast,recoveryCableTension,canPowerBothRecoveryLines} from './gameRules.js';

test('no job finishes before reaching its destination',()=>{
 for(const kind of ['tow','flatbed','recovery','heavy'])
  assert.equal(canCompleteJob(kind,{reached:false,loaded:true,strapped:true,hook:true,recoveryConnected:true}),false);
});
test('light wheel-lift pays only after completed depot unloading',()=>{
 assert.equal(canCompleteJob('tow',{reached:true,loaded:true,strapped:true,delivered:false}),false);
 assert.equal(canCompleteJob('tow',{reached:true,loaded:true,strapped:false,delivered:true}),false);
 assert.equal(canCompleteJob('tow',{reached:true,loaded:false,strapped:false,delivered:false}),false);
 assert.equal(canCompleteJob('tow',{reached:true,loaded:false,strapped:false,delivered:true}),true);
});
test('rollback requires secured load',()=>{
 assert.equal(canCompleteJob('flatbed',{reached:true,loaded:false}),false);
 assert.equal(canCompleteJob('flatbed',{reached:true,loaded:true}),true);
});
test('medium recovery requires hook',()=>{
 assert.equal(canCompleteJob('recovery',{reached:true,hook:false}),false);
 assert.equal(canCompleteJob('recovery',{reached:true,hook:true}),true);
});
test('heavy recovery uses its independent winch lines, not legacy hook',()=>{
 assert.equal(canCompleteJob('heavy',{reached:true,recoveryConnected:false,hook:true}),false);
 assert.equal(canCompleteJob('heavy',{reached:true,recoveryConnected:true,hook:false}),true);
});
test('map covers all seven missions including last ravine and depot',()=>{
 for(const x of [-24,0,12])assert.ok(minimapX(x)>=0&&minimapX(x)<=140);
 for(const z of [-106,-100,-88,-63,-42,-18,7,23])assert.ok(minimapY(z)>=0&&minimapY(z)<=140);
 assert.ok(minimapY(-106)<minimapY(23));
});

test('wheel lift captures front tires only when both sides are lined up and lowered',()=>{
 const good={leftError:.55,rightError:.7,facing:.9,height:.05};
 assert.equal(wheelLiftCaptureReady(good),true);
 assert.equal(wheelLiftCaptureReady({...good,leftError:1.4}),false);
 assert.equal(wheelLiftCaptureReady({...good,rightError:1.4}),false);
 assert.equal(wheelLiftCaptureReady({...good,facing:.2}),false);
 assert.equal(wheelLiftCaptureReady({...good,height:.5}),false);
 assert.equal(wheelLiftCaptureReady({...good,rightError:NaN}),false);
});

test('line-load indicators warn before standard and heavy winch limits',()=>{
 assert.equal(winchLoadBand(0,42).level,'normal');
 assert.equal(winchLoadBand(24,42).level,'normal');
 assert.equal(winchLoadBand(26,42).level,'warning');
 assert.equal(winchLoadBand(36,42).level,'danger');
 assert.equal(winchLoadBand(20,32).level,'warning');
 assert.equal(winchLoadBand(28,32).level,'danger');
 assert.equal(winchLoadBand(100,42).fraction,1);
});
test('releasing motor eliminates pulling force and rolling coast',()=>{
 assert.equal(poweredWinchForce(false,40000),0);
 assert.equal(poweredWinchForce(true,28000),28000);
 assert.equal(stopWinchCoast(3,.25),0);
 assert.equal(stopWinchCoast(-2,.25),0);
 assert.ok(stopWinchCoast(3,1/60)<3);
});

test('an idle taut recovery cable carries opposing load without powered reeling',()=>{
 assert.equal(recoveryCableTension(10,10,0),0);
 assert.equal(recoveryCableTension(10,12,-4),0); // slack never pushes a car
 assert.equal(recoveryCableTension(12,10,0),14400); // fixed idle spool
 assert.equal(recoveryCableTension(12,10,-2),16400); // pulling away increases load
 assert.equal(recoveryCableTension(12,10,2),12400); // moving toward guide reduces load
 assert.equal(recoveryCableTension(100,10,0),42000); // simulated rating
});
test('dual-winch motor command requires two connected lines and secured truck',()=>{
 const lines=[{connected:true},{connected:true}];
 assert.equal(canPowerBothRecoveryLines(lines,true),true);
 assert.equal(canPowerBothRecoveryLines([{connected:true},{connected:false}],true),false);
 assert.equal(canPowerBothRecoveryLines(lines,false),false);
});
