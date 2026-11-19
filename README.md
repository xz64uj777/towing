# Towing & Recovery Simulator

A 3D mobile-first towing and vehicle recovery simulator.

## Engine decision
The production target is **Godot 4.7.2 stable**. Unreal Engine 5.8 was evaluated for maximum visual fidelity, but its licensed engine distribution and large Android toolchain make reliable builds on the available free cloud runner impractical. Godot provides a reproducible Android export path without Epic source access.

## Current prototype
- 3D roadside recovery scene
- Medium-duty wrecker with physics-based vehicle chassis and suspension wheels
- Heavy stuck pickup target
- Winch cable with spring/damper tension, winch-in, and overload release
- Touch buttons and keyboard fallback
- Third-person chase camera

## Build
Pushes to `main` run the Android APK workflow. The APK is uploaded as a GitHub Actions artifact.

## Next milestones
1. Verify APK build and install on a real Android device.
2. Improve tire/terrain interaction and vehicle handling.
3. Add hookup points, cable slack, rated rigging and pulley mechanics.
4. Add rollback and wheel-lift equipment.
5. Add dispatch, jobs, fleet progression and maintenance.

This repository is independent of other simulator projects.
