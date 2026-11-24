import test from 'node:test';
import assert from 'node:assert/strict';
import {canCompleteJob,minimapX,minimapY,wheelLiftCaptureReady,winchLoadBand,poweredWinchForce,stopWinchCoast,recoveryCableTension,canPowerBothRecoveryLines,parkingBrakeForRiggers,cameraPresetPose} from './gameRules.js';
import {LEVEL_FOUR_DEPTH_METRES,LEVEL_FOUR_STAGING,levelFourHeight,levelFourSlope,levelFourDownhillAcceleration} from './levelFourTerrain.js';

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

test('camera angles are relative to the truck and the overhead camera is higher',()=>{
 const truck={x:0,z:0},vehicle={x:8,z:-12};
 assert.ok(cameraPresetPose('chase',truck,0,vehicle).position.z>0);
 assert.ok(cameraPresetPose('front',truck,0,vehicle).position.z<0);
 assert.ok(cameraPresetPose('left',truck,0,vehicle).position.x<0);
 assert.ok(cameraPresetPose('right',truck,0,vehicle).position.x>0);
 assert.ok(cameraPresetPose('top',truck,0,vehicle).position.y>cameraPresetPose('chase',truck,0,vehicle).position.y);
});
test('hook camera focuses vehicle and wide camera frames recovery center; zoom increases distance',()=>{
 const truck={x:10,z:-20},vehicle={x:-5,z:-50};
 const hook=cameraPresetPose('hook',truck,.4,vehicle),wide=cameraPresetPose('wide',truck,.4,vehicle);
 assert.equal(hook.target.x,vehicle.x);assert.equal(hook.target.z,vehicle.z);
 assert.equal(wide.target.x,(truck.x+vehicle.x)/2);assert.equal(wide.target.z,(truck.z+vehicle.z)/2);
 const large=cameraPresetPose('chase',truck,.4,vehicle,20),normal=cameraPresetPose('chase',truck,.4,vehicle,13);
 assert.ok(Math.hypot(large.position.x-truck.x,large.position.z-truck.z)>Math.hypot(normal.position.x-truck.x,normal.position.z-truck.z));
 for(const mode of ['chase','reverse','front','left','right','top','hook','wide']){
  const pose=cameraPresetPose(mode,truck,.7,vehicle);
  assert.ok([...Object.values(pose.position),...Object.values(pose.target)].every(Number.isFinite),mode);
 }
});

test('level 4 has a steep, visibly deep canyon cut directly beside road',()=>{
 const road=levelFourHeight(0,-63),bottom=levelFourHeight(-22,-63);
 assert.ok(Math.abs(road+.12)<.01,'road must stay flat at grade');
 assert.ok(road-bottom>17,'channel must drop over 17 metres under roadside');
 assert.ok(road-bottom<19,'channel is approximately 60 feet deep');
 assert.equal(LEVEL_FOUR_DEPTH_METRES,18);
 assert.ok(road-levelFourHeight(-11,-63)>7,'near road edge should descend sharply');
 assert.ok(Math.abs(levelFourHeight(-22,-63)-levelFourHeight(-27,-63))<2,'bottom is a narrow channel');
 assert.ok(levelFourHeight(-55,-63)>road+3,'far canyon wall must rise above road');
 assert.ok(levelFourHeight(-22,-128)>bottom+15,'ravine must taper away outside accident area');
 assert.equal(LEVEL_FOUR_STAGING.z,-49,'truck should spawn near canyon');
});
test('level 4 downslope acceleration pushes stranded truck toward the bottom',()=>{
 const bank=levelFourSlope(-9,-63),gravity=levelFourDownhillAcceleration(-9,-63);
 assert.ok(bank.x>1.0,'bank must have a substantial grade');
 assert.ok(gravity.x<-.1,'vehicle must accelerate downhill toward the west');
 assert.ok(Number.isFinite(gravity.z));
 for(const x of [-80,-35,-22,-18,-11,-5,0,8])
  for(const z of [-130,-100,-75,-63,-45,0])
   assert.ok(Number.isFinite(levelFourHeight(x,z)),'terrain must have no holes');
});

test('deep ravine recovery slope and road approach remain physically distinct',()=>{
 const road=levelFourHeight(-4,-76),lip=levelFourHeight(-8,-76),wall=levelFourHeight(-12,-76),floor=levelFourHeight(-22,-76);
 assert.ok(road-lip>0.3,'road shoulder must break into a drop');
 assert.ok(lip-wall>5,'near wall must have a steep fall');
 assert.ok(road-floor>17,'wreck rests at least 17 metres below the road');
 const gravity=levelFourDownhillAcceleration(-10,-76,.36);
 assert.ok(gravity.x<-.5,'gravity must resist uphill winching');
});


import {captureRecoverySave,parseRecoverySave,restoreRecoverySave} from './progressSave.js';
const checkpointVector=(x,y,z)=>({x,y,z,set(a,b,c){this.x=a;this.y=b;this.z=c;}});
function checkpointFixture(){
 const marker=()=>({visible:false,position:checkpointVector(0,0,0)});
 return {jobIndex:4,type:{id:'rotator'},pos:checkpointVector(0,0,-61),vel:checkpointVector(0,0,0),yaw:0,
 pickPos:checkpointVector(-19,-.7,-76),pickVel:checkpointVector(0,0,0),pickYaw:-.18,pickRoll:1.2,
 secondary:{pos:checkpointVector(-22,-.4,-100),vel:checkpointVector(0,0,0),yaw:0,roll:0,active:false,mesh:{visible:false}},
 parkingBrake:true,riggersDeployed:true,boomDeployed:true,boomAngle:.5,boomSwing:0,boomExtension:1.2,
 liftDeployed:false,liftHeight:0,liftExtension:0,gridWidth:0,armsClosed:false,loaded:false,strapsOn:false,
 bedTilt:false,hook:false,hookPoint:0,hookRedirect:0,cableLength:14,autoLoad:false,autoUnload:false,
 dropoffArrived:false,dropoffComplete:false,winchSpeed:'fine',
 riggingAnchors:[{pos:null},{pos:null},{pos:null},{pos:checkpointVector(-9,.7,-69),marker:marker()},{pos:checkpointVector(-11,.8,-70),marker:marker()}],
 recoveryLines:[{connected:true,point:6,customPoint:{id:'custom',label:'CUSTOM HOOK',x:.8,y:.73,z:-1.6},redirect:3,secondRedirect:4,target:0,spool:28,motor:1,tension:3000},
 {connected:true,point:7,redirect:0,secondRedirect:0,target:0,spool:22,motor:-1,tension:900}],
 cameraMode:'orbit',cameraYaw:.5,cameraPitch:.3,presetYaw:0,presetPitch:0,zoom:15};
}
test('save preserves player placed anchors, custom tow point, and both cables',()=>{
 const save=captureRecoverySave({job:4,cash:1000},checkpointFixture());
 const fromStorage=parseRecoverySave(JSON.stringify(save),7);
 assert.ok(fromStorage);assert.equal(fromStorage.jobIndex,4);
 assert.equal(fromStorage.lines[0].customPoint.x,.8);
 assert.deepEqual(fromStorage.anchors[1],{x:-11,y:.8,z:-70});
 assert.equal(fromStorage.lines[0].secondRedirect,4);
 assert.equal(fromStorage.lines[1].connected,true);
});
test('resume restores positions, line tension settings, brakes without restarting motors',()=>{
 const saved=captureRecoverySave({job:4},checkpointFixture()),fresh=checkpointFixture();
 fresh.pos.set(5,0,5);fresh.pickPos.set(0,0,0);fresh.parkingBrake=false;
 fresh.recoveryLines[0].connected=false;fresh.riggingAnchors[3].pos=null;
 restoreRecoverySave(fresh,saved,checkpointVector);
 assert.deepEqual([fresh.pickPos.x,fresh.pickPos.z],[-19,-76]);
 assert.equal(fresh.parkingBrake,true);assert.equal(fresh.recoveryLines[0].connected,true);
 assert.equal(fresh.recoveryLines[0].motor,0);assert.equal(fresh.recoveryLines[1].motor,0);
 assert.equal(fresh.riggingAnchors[3].marker.visible,true);
 assert.ok(Math.abs(fresh.riggingAnchors[3].marker.position.y-.15)<1e-8);
});
test('invalid saved games are ignored rather than crashing startup',()=>{
 assert.equal(parseRecoverySave('{',7),null);
 const saved=captureRecoverySave({job:4},checkpointFixture());
 assert.equal(parseRecoverySave({...saved,version:2},7),null);
 assert.equal(parseRecoverySave({...saved,lines:[{...saved.lines[0],redirect:99},saved.lines[1]]},7),null);
});

test('deploying riggers engages parking brake automatically',()=>{
 assert.equal(parkingBrakeForRiggers(false,true),true);
 assert.equal(parkingBrakeForRiggers(true,true),true);
});
test('retracting riggers leaves parking brake engaged until manually released',()=>{
 assert.equal(parkingBrakeForRiggers(true,false),true);
 assert.equal(parkingBrakeForRiggers(false,false),false);
});
test('restoring a saved rigged recovery always engages parking brake',()=>{
 const saved=captureRecoverySave({job:4},checkpointFixture());
 saved.equipment.parkingBrake=false;
 saved.equipment.riggersDeployed=true;
 const fresh=checkpointFixture();
 fresh.parkingBrake=false;fresh.riggersDeployed=false;
 restoreRecoverySave(fresh,saved,checkpointVector);
 assert.equal(fresh.riggersDeployed,true);
 assert.equal(fresh.parkingBrake,true);
});
