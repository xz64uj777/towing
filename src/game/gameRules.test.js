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

import {recoveryYawMoment,recoveryEyeSpeed,recoveryYawStep,recoveryGroundVelocity} from './gameRules.js';

test("front and rear eyes pivot oppositely; centered pull has no yaw",()=>{
 assert.ok(recoveryYawMoment({x:0,z:-1.85},{x:1,z:0},10000)>0);
 assert.ok(recoveryYawMoment({x:0,z:1.83},{x:1,z:0},10000)<0);
 assert.equal(recoveryYawMoment({x:0,z:-1.85},{x:0,z:-1},10000),0);
});

test("mirror corner hooks balance; unequal dual pulls rotate",()=>{
 const a=recoveryYawMoment({x:-.86,z:-1.65},{x:0,z:-1},24000),b=recoveryYawMoment({x:.86,z:-1.65},{x:0,z:-1},24000);
 assert.ok(a>0&&b<0&&Math.abs(a+b)<1e-8);
 assert.equal(recoveryYawStep(0,a+b,14,1/120,true),0);
 assert.ok(recoveryYawStep(0,a+b/2,14,1/120,true)>0);
});

test("rolled and rotated world-space eyes respond to the final redirect",()=>{
 const rolled={x:-.73,z:-1.85};
 assert.ok(recoveryYawMoment(rolled,{x:0,z:-1},10000)>0);
 assert.ok(recoveryYawMoment({x:1.85,z:0},{x:0,z:1},10000)>0);
 assert.ok(recoveryYawMoment(rolled,{x:0,z:1},10000)<0);
});

test("yaw and roll eye velocity change cable approach speed",()=>{
 const zero={x:0,y:0,z:0},front={x:0,y:0,z:-2},right={x:1,y:0,z:0};
 assert.equal(recoveryEyeSpeed(zero,front,right,.5),1);
 assert.equal(recoveryEyeSpeed(zero,front,right,-.5),-1);
 assert.equal(recoveryEyeSpeed(zero,{x:0,y:1,z:0},right,0,.5,0),-.5);
});

test("upright tires scrub sideways but preserve longitudinal motion",()=>{
 const u=recoveryGroundVelocity(2,3,0,0,.2),r=recoveryGroundVelocity(2,3,0,Math.PI/2,.2);
 assert.ok(u.x>0&&u.x<r.x&&r.x<2&&u.z===3);
 const t=recoveryGroundVelocity(3,2,Math.PI/2,0,.2);
 assert.ok(Math.abs(t.x-3)<1e-8&&t.z<2);
});

test("yaw response is mass-sensitive, time-step stable and bounded",()=>{
 const torque=30000,light=recoveryYawStep(0,torque,4,.1,true),heavy=recoveryYawStep(0,torque,14,.1,true);
 assert.ok(light>heavy&&heavy>0);
 let rate=0;for(let i=0;i<12;i++)rate=recoveryYawStep(rate,torque,14,1/120,true);
 assert.ok(Math.abs(rate-heavy)<1e-10);
 assert.equal(recoveryYawStep(0,1e9,1,.1,true),1.8);
 assert.ok(recoveryYawStep(.8,0,14,.2,false)<recoveryYawStep(.8,0,14,.2,true));
});

test("a sustained side pull aligns the front with the guide",()=>{
 let yaw=0,rate=0,x=0,z=0,vx=0,vz=0;const h=1/120;
 for(let i=0;i<1200;i++){
  const eye={x:1.85*Math.sin(yaw),z:-1.85*Math.cos(yaw)};
  const dx=20-x-eye.x,dz=-z-eye.z,d=Math.hypot(dx,dz),dir={x:dx/d,z:dz/d};
  rate=recoveryYawStep(rate,recoveryYawMoment(eye,dir,15000),12,h,true);
  yaw+=rate*h;vx+=dir.x*h;vz+=dir.z*h;
  const ground=recoveryGroundVelocity(vx,vz,yaw,0,h);
  vx=ground.x*Math.exp(-h);vz=ground.z*Math.exp(-h);x+=vx*h;z+=vz*h;
 }
 assert.ok(yaw>1.3&&yaw<2&&x>3&&Math.abs(rate)<.08);
});

import {sampleSurface,recoverySurfaceVelocity} from './terrainPhysics.js';

test("surface follows actual road, parking lot, gravel bay and grass footprints",()=>{
 assert.equal(sampleSurface(0,0,-19).name,'PAVEMENT');
 assert.equal(sampleSurface(0,9,-19).name,'PAVEMENT');
 assert.equal(sampleSurface(1,6,-42).name,'GRAVEL');
 assert.equal(sampleSurface(1,20,-42).name,'GRASS');
 assert.equal(sampleSurface(4,2,-76).name,'PAVEMENT');
});

test("ditch mud replaces gravel only inside the cut",()=>{
 assert.equal(sampleSurface(2,11,-28).name,'MUD');
 assert.equal(sampleSurface(2,7,-28).name,'GRAVEL');
 assert.equal(sampleSurface(2,11,0).name,'GRASS');
});

test("lake depth comes from the visible basin and not the entire mission",()=>{
 const deep=sampleSurface(4,-19,-76),shore=sampleSurface(4,-9,-76);
 assert.equal(deep.name,'SUBMERGED');
 assert.ok(deep.depth>1.2);
 assert.equal(shore.name,'MUD');
 assert.equal(shore.depth,0);
 assert.equal(sampleSurface(4,-19,-25).depth,0);
 assert.equal(sampleSurface(3,-18,-63).depth,0);
});

test("traction decreases and longitudinal drag increases from road to grass to mud to lake",()=>{
 const surfaces=[sampleSurface(4,0,-76),sampleSurface(4,20,-76),sampleSurface(4,-9,-76),sampleSurface(4,-19,-76)];
 const speeds=surfaces.map(s=>recoverySurfaceVelocity(0,3,0,0,1,s).z);
 for(let i=1;i<surfaces.length;i++){
  assert.ok(surfaces[i].traction<surfaces[i-1].traction);
  assert.ok(surfaces[i].drag>surfaces[i-1].drag);
  assert.ok(speeds[i]>0&&speeds[i]<speeds[i-1]);
 }
});

test("pavement to shoulder blends continuously without a speed discontinuity",()=>{
 const a=sampleSurface(3,4.99,-63),b=sampleSurface(3,5.01,-63);
 assert.ok(Math.abs(a.traction-b.traction)<.05);
 assert.ok(Math.abs(a.drag-b.drag)<.05);
});

test("submerged vehicles remain movable; opposite velocities damp symmetrically",()=>{
 const s=sampleSurface(4,-19,-76),h=1/120;
 let v=0,x=0;
 for(let i=0;i<1200;i++){v+=1.5*h;v=recoverySurfaceVelocity(v,0,Math.PI/2,0,h,s).x;x+=v*h;}
 assert.ok(x>4&&v>0&&v<1);
 const a=recoverySurfaceVelocity(2,3,.2,.9,.1,s),b=recoverySurfaceVelocity(-2,-3,.2,.9,.1,s);
 assert.ok(Math.abs(a.x+b.x)<1e-10&&Math.abs(a.z+b.z)<1e-10);
});

test("terrain drag is frame-rate independent and never creates motion",()=>{
 const s=sampleSurface(4,-19,-76);
 const a=recoverySurfaceVelocity(2,3,.5,0,.2,s);
 let b={x:2,z:3};
 for(let i=0;i<24;i++)b=recoverySurfaceVelocity(b.x,b.z,.5,0,1/120,s);
 assert.ok(Math.abs(a.x-b.x)<1e-10&&Math.abs(a.z-b.z)<1e-10);
 assert.deepEqual(recoverySurfaceVelocity(0,0,0,0,.2,s),{x:0,z:0});
});

test("each recovery target samples its own location and improves as it exits the lake",()=>{
 const deep=sampleSurface(4,-19,-76),bank=sampleSurface(4,-9,-76),road=sampleSurface(4,0,-76);
 assert.ok(deep.drag>bank.drag&&bank.drag>road.drag);
 assert.ok(deep.lateralGrip<bank.lateralGrip&&bank.lateralGrip<road.lateralGrip);
});

import {cableGeometry,cablePathSpeed,cableLoad,cableReelStep} from './cablePhysics.js';
const cp=(x,y=0,z=0)=>({x,y,z});
test('fixed redirects change direction and path length but not mechanical advantage',()=>{
 const g=cableGeometry([cp(0),cp(0,0,10),cp(10,0,10)]);
 assert.equal(g.distance,20);assert.equal(g.advantage,1);
 assert.deepEqual(g.force,{x:-1,y:0,z:0});
});
test('moving block has two supporting legs and uses twice the straight cable length',()=>{
 const g=cableGeometry([cp(0),cp(10),cp(0)],true);
 assert.equal(g.distance,20);assert.equal(g.advantage,1.9);
 assert.equal(g.force.x,-1.9);
});
test('moving block advantage falls with opposing leg angles',()=>{
 const g=cableGeometry([cp(-10),cp(0),cp(10)],true);
 assert.ok(Math.abs(g.advantage-.1)<1e-9);
 const angled=cableGeometry([cp(0),cp(10),cp(10,0,10)],true);
 assert.ok(angled.advantage>1&&angled.advantage<1.9);
});
test('two redirects and a moving block count every cable segment',()=>{
 const g=cableGeometry([cp(0),cp(3),cp(3,0,4),cp(6,0,4),cp(6,0,0)],true);
 assert.equal(g.distance,14);assert.ok(g.advantage>1);
});
test('slack cable has no tensile load; stretching and separation increase tension',()=>{
 assert.equal(cableLoad(19,20,10,42000).tension,0);
 const a=cableLoad(21,20,0,42000),b=cableLoad(21,20,2,42000),c=cableLoad(21,20,-2,42000);
 assert.equal(a.strain,5);assert.ok(b.tension>a.tension&&a.tension>c.tension);
 assert.equal(cableLoad(100,20,12,42000).tension,42000);
 assert.equal(cableLoad(100,20,12,42000).stalled,true);
});
test('long cable is more compliant than short cable under equal extension',()=>{
 assert.ok(cableLoad(11,10,0,42000).tension>cableLoad(41,40,0,42000).tension);
});
test('drum slows with load, stalls at rating, allows payout and resumes below rating',()=>{
 const reel=t=>cableReelStep(20,1,2,1,t,42000);
 assert.ok(reel(0)<reel(21000)&&reel(21000)<reel(41000));
 assert.equal(reel(42000),20);
 assert.ok(cableReelStep(20,-1,2,1,42000,42000)>20);
 assert.equal(cableReelStep(20,0,2,1,0,42000),20);
 assert.ok(reel(41000)<20);
});
test('reel bounds do not jump a connected cable and path speed is bounded on resume',()=>{
 assert.equal(cableReelStep(2,1,2,1,0,42000),2);
 assert.equal(cableReelStep(95,-1,2,1,0,42000),95);
 assert.equal(cablePathSpeed(20,null,1/120),0);
 assert.equal(cablePathSpeed(20,19,0),0);
 assert.equal(cablePathSpeed(20,19,.01),12);
 assert.equal(cablePathSpeed(20,21,.01),-12);
});
test('moving block trades cable travel for reduced target travel',()=>{
 const single=cableGeometry([cp(0),cp(9)]),doubled=cableGeometry([cp(0),cp(9),cp(0)],true);
 assert.equal(10-single.distance,1);assert.equal(20-doubled.distance,2);
});
test('moving block survives save and resume; old saves default to single line',()=>{
 const fixture=checkpointFixture();fixture.recoveryLines[0].doubled=true;
 const saved=captureRecoverySave({job:4},fixture);
 assert.equal(parseRecoverySave(JSON.stringify(saved),7).lines[0].doubled,true);
 const fresh=checkpointFixture();restoreRecoverySave(fresh,saved,checkpointVector);
 assert.equal(fresh.recoveryLines[0].doubled,true);assert.equal(fresh.recoveryLines[0].motor,0);
 assert.equal(fresh.recoveryLines[0].previousDistance,null);
 delete saved.lines[0].doubled;assert.ok(parseRecoverySave(saved,7));
 restoreRecoverySave(fresh,saved,checkpointVector);assert.equal(fresh.recoveryLines[0].doubled,false);
 saved.lines[0].doubled='yes';assert.equal(parseRecoverySave(saved,7),null);
});
