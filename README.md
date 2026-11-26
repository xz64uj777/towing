# Towing & Recovery Simulator

**[▶ Play now — free browser game](https://xz64uj777.github.io/towing/)**

Run your own towing and recovery operation in a mobile-first 3D simulator. Start with everyday wheel-lift tows, move on to rollback transports and ditch extractions, then take on heavy rollovers, submerged vehicles and multi-vehicle rescues with a dual-winch rotator.

Position your truck, operate the hydraulics, rig the recovery, watch cable tension and stability, and finish the dispatch to earn your payout. This is a hands-on equipment simulator: loading, securement, unloading and stowing matter as much as driving.

**Current game: Build .84 — Woodland Recovery.** The browser version includes nine dispatches, five playable trucks, career earnings and upgrades, touch and keyboard controls, and local progress saves. Development is ongoing, with gameplay feedback from the owner's hands-on testing.

## Career and dispatches

Complete a job to earn cash and automatically advance to the next dispatch with its assigned truck. Use **MENU → FLEET / GARAGE** to spend earnings on engine and winch upgrades (three levels each, costing $500, $1,000 and $1,500). The HUD tracks cash, completed dispatches and equipment upgrades.

During development, **all jobs and trucks are available in test mode**. You can choose a dispatch from the MENU job selector or test-drive another truck in the garage without purchasing it. Career progression still records your earnings and completed jobs, and the nine-dispatch sequence repeats after the last rescue.

| # | Dispatch | Assigned truck | Base payout |
| --- | --- | --- | ---: |
| 1 | [Parking Lot Tow](https://xz64uj777.github.io/towing/?level=1) | Light Wheel-Lift | $450 |
| 2 | [AWD Rollback Transport](https://xz64uj777.github.io/towing/?level=2) | Rollback Flatbed | $750 |
| 3 | [Ditch Extraction](https://xz64uj777.github.io/towing/?level=3) | Medium Wrecker | $1,200 |
| 4 | [Heavy Rollover Recovery](https://xz64uj777.github.io/towing/?level=4) | Heavy Rotator | $2,600 |
| 5 | [Lakeside Vehicle Recovery](https://xz64uj777.github.io/towing/?level=5) | Heavy Rotator | $3,400 |
| 6 | [Winter Freight Terminal](https://xz64uj777.github.io/towing/?level=6) | Heavy Rotator | $4,200 |
| 7 | [Highway Bridge Rescue](https://xz64uj777.github.io/towing/?level=7) | Heavy Rotator | $5,800 |
| 8 | [Quarry Tandem Practice](https://xz64uj777.github.io/towing/?level=8) | Heavy Rotator + Medium Wrecker | $4,800 |
| 9 | [Woodland Recovery](https://xz64uj777.github.io/towing/?level=9) | Trail Recovery 8×8 | $3,800 |

Levels 4–7 now take place in a wooded ravine, a muddy lakeshore, a snowy freight terminal with ice, packed snow and cargo obstacles, and an elevated highway bridge over a river. Overturned vehicles now rest on their actual model envelope instead of a fixed height. The bridge has separate recovery bays for both casualties and an edge-failure rule. Old in-progress saves for redesigned dispatches restart the site while retaining career data.

The quarry introduces tandem control: one winch per truck, switching operator tabs while the inactive cable holds its spool length. Both trucks can be driven independently and have their own parking brake and boom controls. Stop before switching; the inactive truck is parked automatically. Selecting an unrigged truck releases its brake for driving and switches to the chase camera. Connected or rigged trucks stay parked. Disconnect only the selected truck's cable before repositioning it. The medium has a fixed boom (raise/lower and telescope, no swing). Both trucks' positions and boom setups are saved. Both winches must take load before the exercise completes.

Woodland Recovery starts at a trailhead. Drive the 8×8 into the woods, winch the work truck onto the gravel, then use the wheel lift and straps to tow it back to the marked bay.

Direct dispatch links select that job in your local career. Use the main play link to continue normally. Progress and control settings are stored in your browser on the current device. MENU also offers **SAVE IN-PROGRESS** and **RESUME SAVED JOB** for interrupted recoveries.

## Quick controls

| Control | What it does |
| --- | --- |
| Left joystick or LEFT / RIGHT | Steer; choose joystick or arrows in SETTINGS |
| GAS / REV / BRAKE | Drive forward, reverse or slow down |
| PARK BRAKE | Secure the truck and unlock stationary equipment operations |
| Equipment panel (right) | Open the controls for the current truck; hold hydraulic and winch buttons to move, release to stop |
| Boom controls (left) | Joystick raises and lowers the boom and swings the rotator. Hold EXTEND or RETRACT to telescope |
| FINE / MEDIUM / HIGH | Select winch speed |
| CAM / ANGLES | Cycle or select camera presets, including rear, hook, top and wide views |
| Drag / pinch | Orbit the camera / zoom |
| MAP / MENU | Minimap, job selection, garage, saves, settings and in-game instructions |

**Keyboard:** W/S or Up/Down to drive and reverse; A/D or Left/Right to steer; R for the standard winch, subject to equipment interlocks; H toggles the standard non-flatbed hook. Use the equipment panel for heavy Line A/B controls, rollback loading and hydraulic operations.

## Fleet and equipment

### Light Wheel-Lift

Lower the unloaded lift while stopped or creeping, align both front tires, park, close the L-arms, raise the axle and fit tire straps. Deliver to the depot, then park, remove straps, lower the lift and release the tires.

### Rollback Flatbed

Independent **SLIDE OUT / IN** and **TILT DOWN / UP** hydraulics, a loading winch and four visible tire tie-downs. Align the car before loading; the ramp will not automatically center a misaligned vehicle. Fit the straps, level the deck and retract it before driving.

At the depot, deploy the bed manually, remove the straps, pay out the winch, and disconnect once the tires are on the ground. The empty, disconnected truck can creep straight forward at up to 4 km/h with the ramp deployed to clear the car before stowing. Ramp contact deducts $75 per incident, capped at the job payout.

### Medium Wrecker

A fixed rear boom with raise/lower and telescope controls, winch and separate wheel lift. Extract vehicles using the cable or capture their tires with the lift. Unloaded lift positioning is available at walking speed; capture, lifting a secured axle and strap operations require the parking brake. The medium boom does not rotate.

### Heavy Rotator

A dedicated heavy-duty body with dual rear tires, a rotating telescoping boom and four terrain-contact outrigger pads. Two independent recovery lines support:

- Separate A/B winch and payout controls, or WINCH BOTH / PAY BOTH.
- Preset and custom attachment points, redirect anchors and an optional second redirect.
- 1:1 lines or a simulated 2:1 moving block.
- Independent vehicle targeting in the two-vehicle rescue.
- Cable tension, strain, overload stall, chassis grip and pad-contact/stability feedback.

Deploy riggers and engage the parking brake before powering the heavy winches. Watch the load indicators and vehicle roll angle while bringing the wrecks upright into the recovery zone.

## Simulation features

- Terrain-dependent traction and drag on pavement, gravel, grass, mud and water.
- Cable spring/damper loading, load-dependent winch speed, redirected forces and tension-dependent visual cable sag.
- Vehicle yaw and rollover response, heavy-truck suspension response, and load distribution across individual outrigger pads.
- Manual equipment interlocks, simulated rollback collision and payout deductions.
- Dedicated procedural 3D bodies for each truck and disabled vehicle type, textured terrain, multiple camera views, engine/winch/hydraulic sounds and configurable controls.

The game uses simplified, game-tuned physics. It is **not real-world towing or rigging training**, and its simulated load values, equipment capacities and operating sequences must not be used as field guidance.

## Development

The main project is the browser game, built with **React, Three.js and Vite** and deployed to GitHub Pages using GitHub Actions. The earlier Godot/Android experiment remains in the repository.

Requires Node.js 22.12+ (or a supported Node 20.19+ release).

```sh
npm install
npm run dev
```

Open the local Vite URL to play. For validation and production builds:

```sh
npm test
npm run build
npm run preview
```

The automated suite covers recovery rules, saves, cable forces, rollback hydraulics and clearance, steering, stability and model geometry. Build .77 passed 103 automated tests; visual gameplay and device performance continue to be refined through hands-on testing.

See [engine and physics notes](Docs/ENGINE_AND_PHYSICS.md) for additional development context.
