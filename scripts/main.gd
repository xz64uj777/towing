extends Node3D

const MAX_TENSION := 26000.0
const CABLE_STIFFNESS := 8500.0
const CABLE_DAMPING := 950.0

var truck: VehicleBody3D
var target: RigidBody3D
var cable_line: MeshInstance3D
var camera_rig: Node3D
var cable_length := 8.0
var hooked := false
var tension := 0.0
var throttle := 0.0
var steering := 0.0
var braking := false
var winching := false
var hud: Label

func _ready() -> void:
    _build_world()
    _build_truck()
    _build_target()
    _build_camera()
    _build_hud()

func _build_world() -> void:
    var world_env := WorldEnvironment.new()
    var env := Environment.new()
    env.background_mode = Environment.BG_SKY
    env.sky = Sky.new()
    env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
    env.ambient_light_color = Color(0.65, 0.7, 0.76)
    env.ambient_light_energy = 0.65
    world_env.environment = env
    add_child(world_env)

    var sun := DirectionalLight3D.new()
    sun.rotation_degrees = Vector3(-48, -28, 0)
    sun.light_energy = 1.25
    add_child(sun)

    _static_box("Ground", Vector3(0, -0.55, -8), Vector3(90, 1, 90), Color(0.22, 0.31, 0.19))
    _static_box("Road", Vector3(0, 0.015, -5), Vector3(9, 0.08, 65), Color(0.13, 0.14, 0.15))
    _static_box("Shoulder", Vector3(6.3, -0.02, -8), Vector3(4, 0.12, 65), Color(0.38, 0.34, 0.25))
    _static_box("Ditch", Vector3(10, -0.28, -17), Vector3(5, 0.25, 25), Color(0.25, 0.29, 0.19))
    _static_box("Far bank", Vector3(13.3, 0.12, -17), Vector3(2, 0.45, 25), Color(0.30, 0.34, 0.22))
    for i in range(12):
        var marker := MeshInstance3D.new()
        var mesh := BoxMesh.new()
        mesh.size = Vector3(0.12, 0.015, 2.2)
        marker.mesh = mesh
        marker.position = Vector3(0, 0.07, -32 + i * 5)
        var mat := StandardMaterial3D.new()
        mat.albedo_color = Color(0.86, 0.82, 0.62)
        marker.material_override = mat
        add_child(marker)

func _static_box(label: String, pos: Vector3, size: Vector3, color: Color) -> void:
    var body := StaticBody3D.new()
    body.name = label
    body.position = pos
    var shape_node := CollisionShape3D.new()
    var shape := BoxShape3D.new()
    shape.size = size
    shape_node.shape = shape
    body.add_child(shape_node)
    var visual := MeshInstance3D.new()
    var mesh := BoxMesh.new()
    mesh.size = size
    visual.mesh = mesh
    var mat := StandardMaterial3D.new()
    mat.albedo_color = color
    visual.material_override = mat
    body.add_child(visual)
    add_child(body)

func _build_truck() -> void:
    truck = VehicleBody3D.new()
    truck.name = "MediumDutyWrecker"
    truck.position = Vector3(0, 1.0, 8)
    truck.mass = 6200.0
    truck.engine_force = 0.0
    truck.brake = 0.0
    truck.steering = 0.0
    var chassis_shape := CollisionShape3D.new()
    var chassis := BoxShape3D.new()
    chassis.size = Vector3(2.15, 0.9, 4.8)
    chassis_shape.shape = chassis
    chassis_shape.position = Vector3(0, 0.15, 0)
    truck.add_child(chassis_shape)
    _box_visual(truck, Vector3(0, 0.18, 0), Vector3(2.15, 0.9, 4.8), Color(0.78, 0.12, 0.07))
    _box_visual(truck, Vector3(0, 0.95, -0.45), Vector3(1.85, 1.0, 1.65), Color(0.82, 0.84, 0.86))
    _box_visual(truck, Vector3(0, 0.78, -1.95), Vector3(1.8, 0.28, 1.25), Color(0.18, 0.19, 0.2))
    for x in [-0.98, 0.98]:
        for z in [-1.55, 1.55]:
            var wheel := VehicleWheel3D.new()
            wheel.position = Vector3(x, -0.25, z)
            wheel.wheel_radius = 0.48
            wheel.wheel_rest_length = 0.22
            wheel.suspension_travel = 0.2
            wheel.suspension_stiffness = 28.0
            wheel.damping_compression = 0.45
            wheel.damping_relaxation = 0.55
            wheel.wheel_friction_slip = 3.2
            wheel.use_as_traction = z > 0
            wheel.use_as_steering = z < 0
            truck.add_child(wheel)
            var tire := MeshInstance3D.new()
            var cyl := CylinderMesh.new()
            cyl.top_radius = 0.46
            cyl.bottom_radius = 0.46
            cyl.height = 0.28
            tire.mesh = cyl
            tire.rotation_degrees.z = 90
            tire.position = Vector3.ZERO
            var rubber := StandardMaterial3D.new()
            rubber.albedo_color = Color(0.045, 0.05, 0.055)
            tire.material_override = rubber
            wheel.add_child(tire)
    add_child(truck)

func _build_target() -> void:
    target = RigidBody3D.new()
    target.name = "StuckPickup"
    target.position = Vector3(10.2, 0.7, -15)
    target.mass = 2350.0
    target.linear_damp = 0.4
    target.angular_damp = 1.8
    var col := CollisionShape3D.new()
    var box := BoxShape3D.new()
    box.size = Vector3(2.0, 0.85, 4.2)
    col.shape = box
    target.add_child(col)
    _box_visual(target, Vector3(0, 0, 0), Vector3(2.0, 0.85, 4.2), Color(0.12, 0.28, 0.58))
    _box_visual(target, Vector3(0, 0.63, -0.25), Vector3(1.75, 0.72, 1.9), Color(0.15, 0.19, 0.24))
    add_child(target)
    cable_line = MeshInstance3D.new()
    var im := ImmediateMesh.new()
    cable_line.mesh = im
    add_child(cable_line)

func _box_visual(parent: Node3D, pos: Vector3, size: Vector3, color: Color) -> void:
    var visual := MeshInstance3D.new()
    var mesh := BoxMesh.new()
    mesh.size = size
    visual.mesh = mesh
    visual.position = pos
    var mat := StandardMaterial3D.new()
    mat.albedo_color = color
    mat.metallic = 0.15
    mat.roughness = 0.65
    visual.material_override = mat
    parent.add_child(visual)

func _build_camera() -> void:
    camera_rig = Node3D.new()
    add_child(camera_rig)
    var spring := SpringArm3D.new()
    spring.spring_length = 11.0
    spring.position = Vector3(0, 3.5, 0)
    camera_rig.add_child(spring)
    var cam := Camera3D.new()
    cam.current = true
    cam.fov = 70
    cam.position = Vector3(0, 0, 0)
    spring.add_child(cam)

func _build_hud() -> void:
    var layer := CanvasLayer.new()
    add_child(layer)
    var panel := PanelContainer.new()
    panel.position = Vector2(18, 18)
    panel.custom_minimum_size = Vector2(310, 110)
    layer.add_child(panel)
    hud = Label.new()
    hud.add_theme_font_size_override("font_size", 18)
    panel.add_child(hud)

    var controls := HBoxContainer.new()
    controls.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
    controls.offset_left = 12
    controls.offset_right = -12
    controls.offset_top = -90
    controls.offset_bottom = -12
    controls.add_theme_constant_override("separation", 8)
    layer.add_child(controls)
    _add_hold_button(controls, "LEFT", func(v: bool): steering = -1.0 if v else 0.0)
    _add_hold_button(controls, "RIGHT", func(v: bool): steering = 1.0 if v else 0.0)
    _add_hold_button(controls, "THROTTLE", func(v: bool): throttle = 1.0 if v else 0.0)
    _add_hold_button(controls, "BRAKE", func(v: bool): braking = v)
    _add_hold_button(controls, "WINCH", func(v: bool): winching = v)
    var hook_button := Button.new()
    hook_button.text = "HOOK"
    hook_button.custom_minimum_size = Vector2(95, 68)
    hook_button.pressed.connect(_toggle_hook)
    controls.add_child(hook_button)

func _add_hold_button(parent: HBoxContainer, title: String, callback: Callable) -> void:
    var button := Button.new()
    button.text = title
    button.custom_minimum_size = Vector2(90, 68)
    button.button_down.connect(func(): callback.call(true))
    button.button_up.connect(func(): callback.call(false))
    parent.add_child(button)

func _toggle_hook() -> void:
    if hooked:
        hooked = false
        tension = 0.0
        return
    if truck.global_position.distance_to(target.global_position) < 16.0:
        hooked = true
        cable_length = truck.global_position.distance_to(target.global_position)

func _physics_process(delta: float) -> void:
    var drive := throttle
    var steer := steering
    if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
        drive = 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
        drive = -0.65
    if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
        steer = -1.0
    if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
        steer = 1.0
    truck.engine_force = drive * 11500.0
    truck.brake = 8500.0 if (braking or Input.is_key_pressed(KEY_SPACE)) else 0.0
    truck.steering = steer * 0.42

    if hooked:
        if winching or Input.is_key_pressed(KEY_R):
            cable_length = max(2.0, cable_length - 2.0 * delta)
        var a := truck.global_position + Vector3(0, 0.1, -2.3)
        var b := target.global_position + Vector3(0, 0.2, 2.0)
        var offset := b - a
        var distance := offset.length()
        var direction := offset.normalized()
        var relative_speed := (target.linear_velocity - truck.linear_velocity).dot(direction)
        tension = maxf(0.0, (distance - cable_length) * CABLE_STIFFNESS + relative_speed * CABLE_DAMPING)
        if tension > MAX_TENSION:
            hooked = false
            tension = 0.0
        elif distance > cable_length:
            var force := direction * minf(tension, MAX_TENSION)
            target.apply_central_force(-force)
            truck.apply_central_force(force)
        _draw_cable(a, b)
    else:
        tension = 0.0
        _draw_cable(Vector3.ZERO, Vector3.ZERO)

    camera_rig.global_position = truck.global_position + Vector3(0, 0, 0)
    var speed := truck.linear_velocity.length() * 3.6
    hud.text = "TOWING & RECOVERY  |  FIELD TEST\nSpeed: %03.0f km/h\nCable: %0.1f m   Tension: %0.1f kN\n%s" % [speed, cable_length, tension / 1000.0, "HOOKED" if hooked else "NOT HOOKED"]

func _draw_cable(a: Vector3, b: Vector3) -> void:
    var im := cable_line.mesh as ImmediateMesh
    im.clear_surfaces()
    if not hooked:
        return
    im.surface_begin(Mesh.PRIMITIVE_LINES)
    im.surface_set_color(Color(0.95, 0.76, 0.22))
    im.surface_add_vertex(cable_line.to_local(a))
    im.surface_add_vertex(cable_line.to_local(b))
    im.surface_end()
