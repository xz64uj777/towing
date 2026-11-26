import assert from 'node:assert/strict';
import test from 'node:test';
import * as contact from './vehicleContact.js';

const bounds = {min: {x: -1, y: 0, z: -2}, max: {x: 1, y: 3, z: 2}};
const body = (x, z, overrides = {}) => ({pos: {x, y: 0, z}, vel: {x: 0, z: 0}, yaw: 0, bounds, weight: 1, ...overrides});

test('a winched casualty stops at a parked wrecker and keeps glancing motion', () => {
 const parked = body(0, 0, {weight: 0});
 const casualty = body(1.5, 0, {vel: {x: -2, z: 1}});
 assert.equal(contact.resolveVehicleContact(parked, casualty), true);
 assert.deepEqual(parked.pos, {x: 0, y: 0, z: 0});
 assert.ok(casualty.pos.x >= 2);
 assert.deepEqual(casualty.vel, {x: 0, z: 1});
});

test('a moving tandem helper uses its live position, orientation and velocity', () => {
 const parked = body(10, -10, {weight: 0});
 const helper = body(7.2, -10, {yaw: Math.PI / 2, vel: {x: 3, z: 0}});
 assert.equal(contact.resolveVehicleContact(parked, helper), true);
 assert.ok(helper.pos.x <= 7);
 assert.equal(helper.vel.x, 0);
});

test('rolled bodies contact at their projected width but can pass at different elevations', () => {
 const parked = body(0, 0, {weight: 0});
 const casualty = body(2.2, 0, {roll: Math.PI / 2, lift: 1});
 assert.equal(contact.resolveVehicleContact(parked, casualty), true);
 assert.ok(casualty.pos.x >= 4);
 casualty.pos = {x: 2.2, y: -4, z: 0};
 assert.equal(contact.resolveVehicleContact(parked, casualty), false);
 assert.deepEqual(casualty.pos, {x: 2.2, y: -4, z: 0});
});

test('a lowered wheel lift grants rear clearance for the aligned approach only', () => {
 const truck = body(0, 0, {bounds: {...bounds, max: {...bounds.max, z: 3.4}}, weight: 0});
 const aligned = body(0, 4.5);
 const across = body(0, 4.5, {yaw: Math.PI / 2});
 assert.equal(contact.wheelLiftContactRear(truck, aligned, false), 3.4);
 assert.equal(contact.wheelLiftContactRear(truck, across, true), 3.4);
 assert.equal(contact.wheelLiftContactRear(truck, aligned, true), 2);
 assert.equal(contact.resolveVehicleContact({...truck, rear: contact.wheelLiftContactRear(truck, aligned, true)}, aligned), false);
});
