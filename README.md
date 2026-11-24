# Towing & Recovery Simulator

A mobile-first 3D towing and recovery simulator. The browser build follows the same architecture as Slingline: Three.js for the 3D world and simulation, React for the interface, Vite for fast builds, and GitHub Actions for browser deployment.

## Play
https://xz64uj777.github.io/towing/

## Current prototype
- 3D medium-duty wrecker and disabled pickup in a roadside ditch
- Live driving, steering, braking, and basic vehicle inertia
- Winch cable with spring/damper tension, hook/unhook, and an overload stall at rated line load
- Touch controls, keyboard controls, orbit camera, and pinch zoom
- Autosave: an unfinished dispatch is checkpointed every few seconds and when the tab is hidden;
  the last few dispatches are kept and offered for resume on load or from the menu

This is an early physics prototype. Suspension, tire-ground contact, terrain-dependent traction, detailed rigging, and recovery scenarios are still being developed. The Android/Godot experiment is retained while the browser prototype becomes the main development target.
