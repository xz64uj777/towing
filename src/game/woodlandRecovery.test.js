import test from 'node:test';
import assert from 'node:assert/strict';
import {frontWinchReach,frontWinchStep,woodlandBogged} from './woodlandRecovery.js';

test('only a nearby anchor ahead of the chassis is in reach',()=>{
 const head={x:0,y:1,z:0},forward={x:0,z:-1};
 assert.equal(frontWinchReach(head,forward,{x:2,y:0,z:-8}),true);
 assert.equal(frontWinchReach(head,forward,{x:0,y:1,z:4}),false);
 assert.equal(frontWinchReach(head,forward,{x:0,y:1,z:-25}),false);
});

test('the front winch reels in with the park brake released and pulls toward the anchor',()=>{
 const head={x:4,y:1,z:0},anchor={x:4,y:1,z:-8};
 const line={spool:7,motor:1,previousDistance:null};
 const tug=frontWinchStep(line,head,anchor,false,1/60,1.2);
 assert.ok(tug.spool<7&&tug.z<0&&tug.tension>0);
 assert.equal(tug.x,0);
 const parked=frontWinchStep(line,head,anchor,true,1/60,1.2);
 assert.equal(parked.spool,7);
 assert.equal(Math.abs(parked.z),0);
 const payout=frontWinchStep({...line,motor:-1},head,anchor,true,1/60,1.2);
 assert.ok(payout.spool>7);
});

test('deep ruts can bog a slow truck while the higher route stays passable',()=>{
 assert.equal(woodlandBogged(false,.4,.1),false);
 assert.equal(woodlandBogged(false,.85,3),false);
 assert.equal(woodlandBogged(false,.85,.4),true);
 assert.equal(woodlandBogged(true,.5,.5),true);
 assert.equal(woodlandBogged(true,.3,.5),false);
});
