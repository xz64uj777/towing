# Towing & Recovery Simulator

A realism-first, mobile-targeted 3D towing and vehicle recovery simulator.

## Engine
**Unreal Engine 5.8 stable** is the production baseline. We are not targeting the 5.9 Preview. UE5 gives this project the strongest combination of high-fidelity 3D rendering, Chaos vehicle physics, and Android deployment support.

## First playable
A roadside ditch recovery: drive a wrecker to a stuck pickup, inspect the scene, select a rated recovery point, rig the winch, manage cable slack and tension, recover safely, and tow the vehicle away.

## Simulation priorities
- Vehicle mass, suspension, tire grip, steering, braking, and load transfer
- Cable length, slack, stretch, tension, winch speed, and overload failure
- Mud, gravel, grass, snow, pavement, slopes, and soft shoulders
- Rated chains, straps, shackles, snatch blocks, and recovery anchors
- Wheel-lift, rollback, medium-duty wrecker, heavy wrecker, and rotator progression
- Mobile touch controls, pinch zoom, camera modes, and scalable graphics

## Repository status
This is the initial Unreal C++ project scaffold. It is not yet a playable 3D build and no APK has been compiled. See [engine and physics architecture](Docs/ENGINE_AND_PHYSICS.md).
