# Engine and physics strategy

## Production engine: Godot 4.7.2 stable
Godot is selected because this project must produce repeatable Android APKs using a phone-accessible GitHub Actions workflow. Unreal Engine 5.8 remains the stronger option for maximum high-end rendering and built-in vehicle physics, but obtaining and provisioning its full licensed toolchain in a free runner is a major blocker.

## Physics approach
- Vehicle chassis uses Godot VehicleBody3D / VehicleWheel3D for the initial drivable wrecker.
- Recovery line uses a spring-damper force model with cable length, winch-in, tension readout and a breaking threshold.
- Future work will replace the single-line approximation with multi-segment cable/rigging, rated hardware, terrain-specific tire grip, load transfer, and rollover calculations.

## First playable goal
Drive to a pickup stuck in a ditch, attach the winch, shorten cable, control tension, recover it without breaking the line, and tow it away.
