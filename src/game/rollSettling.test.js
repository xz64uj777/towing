import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryRollStep,rollHull} from './rollContact.js';

const hull=rollHull([
 {x:-1,y:0}, {x:1,y:0}, {x:-1,y:2.6}, {x:1,y:2.6}
]);

function advance(roll,cableAcceleration,seconds){
 let state={roll,velocity:0};
 for(let i=0;i<seconds*120;i++){
  state=recoveryRollStep(hull,state.roll,state.velocity,cableAcceleration,1/120);
 }
 return state;
}

test('slack wrecks settle on their tires, sides, or roofs from either roll direction',()=>{
 const poses=[[13*Math.PI/180,0],[1.2,Math.PI/2],[2.66,Math.PI]];
 for(const [start,rest] of poses){
  for(const direction of [-1,1]){
   const state=advance(direction*start,0,20);
   assert.ok(Math.abs(Math.abs(state.roll)-rest)<.01,JSON.stringify(state));
   assert.ok(Math.abs(state.velocity)<.015,JSON.stringify(state));
  }
 }
});

test('a wreck resting on level tires holds under slack and small cable loads',()=>{
 assert.deepEqual(advance(0,0,2),{roll:0,velocity:0});
 assert.deepEqual(advance(0,.05,2),{roll:0,velocity:0});
});

test('sustained cable torque rolls a wreck off either side',()=>{
 const left=advance(-Math.PI/2,.65,4);
 const right=advance(Math.PI/2,-.65,4);
 assert.ok(Math.abs(left.roll)<1,JSON.stringify(left));
 assert.ok(Math.abs(right.roll)<1,JSON.stringify(right));
 assert.ok(Math.abs(left.roll+right.roll)<.01);
});

test('a wreck carrying roll momentum can rotate across its roof in either direction',()=>{
 for(const direction of [-1,1]){
  const state=recoveryRollStep(hull,direction*(Math.PI-.01),direction*.75,0,.08);
  assert.ok(direction*state.roll < -3,JSON.stringify(state));
  assert.ok(direction*state.velocity > .5,JSON.stringify(state));
 }
});
