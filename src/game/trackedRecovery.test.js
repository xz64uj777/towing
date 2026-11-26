import test from 'node:test';
import assert from 'node:assert/strict';
import {cableBreaks,desertSurface,desertHeight,trackMotion,damagedTrackSpeed} from './trackedRecovery.js';
import {migrateJobIndex} from './tandemRecovery.js';
test('the desert gives road tracks more grip than loose sand and supports pivot steering',()=>{
 assert.ok(desertSurface(0,-100).traction>desertSurface(12,-100).traction);
 const pivot=trackMotion(0,1,0,.9);
 assert.ok(pivot.left>0&&pivot.right<0&&pivot.yaw>0);
});
test('rear cable snaps under excess separation without breaking on slack',()=>{
 assert.equal(cableBreaks(14,15,12,32000),false);
 assert.equal(cableBreaks(25,15,12,32000),true);
 assert.equal(cableBreaks(15.7,15,1,32000),false);
});
test('adding a tenth dispatch retains the slot in older career loops',()=>{
 assert.equal(migrateJobIndex(17,9,10),18);
 assert.equal(migrateJobIndex(8,9,10),8);
});

test('the return road climbs a ridge and damaged tracks resist motion and stop quickly',()=>{
 assert.ok(desertHeight(0,-112)>desertHeight(0,-143)+3);
 assert.ok(damagedTrackSpeed(1,1,true,.1)<damagedTrackSpeed(1,0,true,.1));
 assert.equal(damagedTrackSpeed(.6,1,false,.15),0);
});
