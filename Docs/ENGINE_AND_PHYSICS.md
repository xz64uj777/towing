# Engine and simulation architecture

## Engine decision
Use **Unreal Engine 5.8 (stable)** as the production engine. UE 5.9 is currently a Preview release, so it is not the baseline. UE 5.8 includes mobile renderer improvements, Android workflow improvements, and the Chaos vehicle/physics stack.

## Simulation systems
- **Vehicle dynamics:** Chaos Vehicles for wheel suspension, steering, tire forces, drivetrain, braking, and chassis response.
- **Recovery forces:** custom runtime components layered over Chaos physics for winch cable length, slack, spring/damper response, tension limits, break force, and pulley mechanical advantage.
- **Rigging:** attach points, chains, straps, shackles, snatch blocks, and load-rated equipment.
- **Terrain:** physical materials and per-surface tire parameters for pavement, gravel, dirt, mud, grass, and snow.
- **Stability:** center of mass, load transfer, slope, outrigger support polygon, and rollover thresholds.
- **Mobile rendering:** scalable quality tiers; prioritize stable frame time and thermal behavior over desktop-only effects.

## First playable milestone
A single roadside/ditch recovery: drive a wrecker to a stuck pickup, inspect it, choose a rated recovery point, deploy the winch, manage cable slack and tension, recover without exceeding equipment limits, then tow to a drop-off.

## Build note
This repository contains the Unreal project scaffold and source baseline. A compiled Android APK requires an installed Unreal Engine 5.8 toolchain and Android SDK/NDK; the repository scaffold alone is not a compiled or tested APK.
