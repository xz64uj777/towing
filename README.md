# Towing & Recovery Simulator

A mobile-first 3D towing and recovery simulator. The browser build follows the same architecture as Slingline: Three.js for the 3D world and simulation, React for the interface, Vite for fast builds, and GitHub Actions for browser deployment.

## Play
https://xz64uj777.github.io/towing/

## Current prototype
- 3D medium-duty wrecker and disabled pickup in a roadside ditch
- Live driving, steering, braking, and basic vehicle inertia
- Winch cable with spring/damper tension, hook/unhook, and overload release
- Touch controls, keyboard controls, orbit camera, and pinch zoom

This is an early physics prototype. Suspension, tire-ground contact, terrain-dependent traction, detailed rigging, and recovery scenarios are still being developed. The Android/Godot experiment is retained while the browser prototype becomes the main development target.

## Level 4 browser regression

Install Chromium with `npx playwright install chromium`, then run `npm run test:level-four`.
The test drives a starter rotator, rights the casualty, and checks for the $2,600 payout.
