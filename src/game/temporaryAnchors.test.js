import test from 'node:test';
import assert from 'node:assert/strict';
import {anchorCapacity,redirectLoad} from './temporaryAnchors.js';

test('portable anchors can use hard surfaces, weak mud holds less, and submerged ground is unavailable',()=>{
 assert.ok(anchorCapacity({name:'BRIDGE DECK',depth:0},0)>0);
 assert.ok(anchorCapacity({name:'MUD',depth:0},0)<anchorCapacity({name:'GRAVEL',depth:0},0));
 assert.equal(anchorCapacity({name:'SUBMERGED',depth:.4},0),0);
 assert.ok(anchorCapacity({name:'FOREST FLOOR',depth:0},.1,true)>anchorCapacity({name:'GRAVEL',depth:0},.1));
});

test('a return pull loads a redirect more than a straight line',()=>{
 const point={x:0,y:0,z:0},a={x:1,y:0,z:0};
 assert.equal(redirectLoad(16000,a,point,{x:-1,y:0,z:0}),0);
 assert.equal(redirectLoad(16000,a,point,{x:2,y:0,z:0}),32000);
});
