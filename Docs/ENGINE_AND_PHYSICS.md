# Engine and physics strategy

## Production target: browser build

The browser prototype is the main development target. It is Vite 8 + React 19 + Three.js, deployed
to GitHub Pages by `.github/workflows/web-build.yml`. Rendering data and simulation data are kept
separate: everything that can be expressed as a pure function lives in its own module under
`src/game/` so `npm test` can exercise it without a DOM or a GPU.

- `TowingGame.jsx` — scene assembly, input handling and HUD. It runs the simulation loop.
- `gameRules.js` — completion rules, winch load bands, yaw/coast helpers.
- `cablePhysics.js` — line geometry, path speed, drum reel step and load demand.
- `supportPhysics.js` — rig support reaction and grip-limited support state.
- `terrainPhysics.js` / `levelFourTerrain.js` / `lakeScene.js` — one shared height function per
  terrain, sampled by the scene mesh, the vehicles and the steep-slope forces.
- `rollbackPhysics.js` — flatbed deck geometry and load travel.
- `progressSave.js` — validated device-local autosaves: a short ring of unfinished dispatches,
  newest first, one slot per dispatch.

## Physics approach

- Fixed 120 Hz substeps with bounded catch-up, inside the render loop.
- Vehicle motion is an arcade model: engine force scaled by surface traction, lateral grip, drag and
  a speed cap. Steering authority falls off with speed.
- Line recovery uses a spring-damper cable: tension grows with stretch beyond the spooled length,
  falls off with path speed, and the drum stalls at rated line load instead of snapping.
- A 2:1 moving block trades cable travel for line force; fixed redirects only change direction.
- The advanced dispatches (4–7) use a heightfield whose analytic height, slope and gravity vector
  drive the visible mesh, the vehicles and the steep-slope forces, so ground contact has one source
  of truth. The flat yard maps use simple meshes plus the shared surface sampler.
- All coefficients are game tuning. They are not equipment ratings, and nothing here is field
  rigging advice.

## Retained experiment: Godot 4.7.2 Android shell

`project.godot`, `scenes/` and `scripts/` are the older Godot prototype, kept so the manual
`android-build.yml` workflow can still export a debug APK. It is not where new features go, and it
does not share code with the browser build.

## Next work

Line breaking and rig tip-over consequences, extractable simulation tests, and a browser regression
check in CI. See the README for the current feature list.
