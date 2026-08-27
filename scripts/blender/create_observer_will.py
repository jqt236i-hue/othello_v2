from math import atan2, cos, pi, sin
from pathlib import Path
import random

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
REFERENCE_DIR = (
    PROJECT_ROOT
    / "assets"
    / "images"
    / "special-cards"
    / "characters"
    / "observer_will_reference"
)
TURNAROUND_PATH = REFERENCE_DIR / "observer_will_turnaround.png"
DETAIL_PATH = REFERENCE_DIR / "observer_will_detail_sheet.png"
OUTPUT_DIR = (
    PROJECT_ROOT
    / "assets"
    / "models"
    / "special-cards"
    / "characters"
    / "observer_will"
)
BLEND_PATH = OUTPUT_DIR / "observer_will.blend"
GLB_PATH = OUTPUT_DIR / "observer_will.glb"
PREVIEW_PATH = OUTPUT_DIR / "observer_will-preview.png"

RNG = random.Random(8675309)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection" and collection.users == 0:
            bpy.data.collections.remove(collection)


def move_to_collection(obj, target_collection):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    target_collection.objects.link(obj)


def make_material(name, base_color, roughness=0.55, metallic=0.0, emission=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = base_color
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = base_color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if "IOR Level" in principled.inputs:
        principled.inputs["IOR Level"].default_value = 0.18
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = 0.08
    if emission:
        color, strength = emission
        emission_input = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
        strength_input = principled.inputs.get("Emission Strength")
        if emission_input:
            emission_input.default_value = color
        if strength_input:
            strength_input.default_value = strength
    return material


def smooth_object(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def add_bevel(obj, width=0.012, segments=2):
    modifier = obj.modifiers.new("Edge softening", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def create_irregular_shell(name, rings, segments, material, collection, seed_offset=0.0):
    vertices = []
    faces = []
    for ring_index, (z, radius_x, radius_y) in enumerate(rings):
        for segment in range(segments):
            angle = 2 * pi * segment / segments
            ripple = 1.0 + 0.045 * sin(segment * 5.0 + ring_index * 1.7 + seed_offset)
            ripple += 0.025 * sin(segment * 11.0 + seed_offset * 2.3)
            bottom_fray = 0.0
            if ring_index == 0:
                bottom_fray = -0.09 * (0.5 + 0.5 * sin(segment * 7.0 + 0.6))
                bottom_fray -= 0.04 * (0.5 + 0.5 * sin(segment * 13.0 + 1.1))
            vertices.append(
                (
                    cos(angle) * radius_x * ripple,
                    sin(angle) * radius_y * ripple,
                    z + bottom_fray,
                )
            )
    for ring_index in range(len(rings) - 1):
        for segment in range(segments):
            current = ring_index * segments + segment
            following = ring_index * segments + (segment + 1) % segments
            upper = (ring_index + 1) * segments + segment
            upper_following = (ring_index + 1) * segments + (segment + 1) % segments
            faces.append((current, following, upper_following, upper))
    faces.append(tuple(range(segments - 1, -1, -1)))
    top_start = (len(rings) - 1) * segments
    faces.append(tuple(top_start + index for index in range(segments)))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    smooth_object(obj)
    obj["asset_role"] = "render_mesh"
    return obj


def create_panel_mesh(name, panels, material, collection):
    vertices = []
    faces = []
    for panel in panels:
        start, direction, side, width, length, curl = panel
        direction = Vector(direction).normalized()
        side = Vector(side).normalized()
        start = Vector(start)
        mid = start + direction * (length * 0.55) + Vector(curl) * 0.35
        tip = start + direction * length + Vector(curl)
        base_index = len(vertices)
        vertices.extend(
            [
                start - side * width,
                start + side * width,
                mid + side * width * 0.68,
                tip + side * width * 0.12,
                tip - side * width * 0.12,
                mid - side * width * 0.68,
            ]
        )
        faces.append(tuple(base_index + index for index in range(6)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    solidify = obj.modifiers.new("Cloth thickness", "SOLIDIFY")
    solidify.thickness = 0.008
    solidify.offset = 0.0
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=solidify.name)
    obj.select_set(False)
    obj["asset_role"] = "render_mesh"
    return obj


def build_skirt_panels(material, collection):
    panels = []
    for layer, (z, radius, length, count) in enumerate(
        ((1.62, 0.51, 1.52, 28), (1.33, 0.59, 1.30, 32), (1.03, 0.67, 1.05, 36))
    ):
        for index in range(count):
            angle = 2 * pi * (index + 0.33 * layer) / count
            if sin(angle) < -0.72:
                continue
            outward = Vector((cos(angle), sin(angle), 0.0))
            tangent = Vector((-sin(angle), cos(angle), 0.0))
            start = outward * radius + Vector((0, 0, z + 0.04 * sin(index * 3.1)))
            direction = (outward * 0.14 + Vector((0, 0, -1.0))).normalized()
            curl = outward * (0.10 + 0.05 * sin(index * 2.7))
            curl += tangent * (0.045 * sin(index * 4.3 + layer))
            panels.append((start, direction, tangent, 0.08 + 0.025 * (index % 3), length, curl))
    return create_panel_mesh("ObserverWill_TatteredSkirtLayers", panels, material, collection)


def build_shoulder_panels(material, collection):
    panels = []
    for layer, (z, radius, length, count) in enumerate(
        ((2.24, 0.39, 0.72, 24), (2.10, 0.48, 0.64, 28), (1.96, 0.57, 0.56, 30))
    ):
        for index in range(count):
            angle = 2 * pi * (index + layer * 0.25) / count
            if sin(angle) < -0.42:
                continue
            outward = Vector((cos(angle), sin(angle), 0.0))
            tangent = Vector((-sin(angle), cos(angle), 0.0))
            start = outward * radius + Vector((0, 0, z + 0.025 * sin(index * 5.0)))
            direction = (outward * 0.48 + Vector((0, 0, -0.88))).normalized()
            curl = outward * 0.13 + tangent * 0.025 * sin(index * 2.9)
            panels.append((start, direction, tangent, 0.07 + 0.018 * (index % 2), length, curl))
    return create_panel_mesh("ObserverWill_ShoulderLayers", panels, material, collection)


def build_hood_panels(material, collection):
    panels = []
    for layer, (z, radius, length, count) in enumerate(
        ((2.28, 0.34, 0.50, 14), (2.46, 0.31, 0.44, 13), (2.63, 0.27, 0.38, 12))
    ):
        for index in range(count):
            angle = 2 * pi * (index + layer * 0.38) / count
            if sin(angle) < -0.56:
                continue
            outward = Vector((cos(angle), sin(angle), 0.0))
            tangent = Vector((-sin(angle), cos(angle), 0.0))
            start = outward * radius + Vector((0, 0, z))
            direction = (outward * 0.22 + Vector((0, 0, 1.0))).normalized()
            curl = outward * (0.08 + 0.025 * sin(index * 2.1))
            panels.append((start, direction, tangent, 0.075, length, curl))
    return create_panel_mesh("ObserverWill_HoodLayers", panels, material, collection)


def cylinder_between(name, start, end, radius, material, collection, vertices=12, end_radius=None):
    start = Vector(start)
    end = Vector(end)
    midpoint = (start + end) * 0.5
    direction = end - start
    depth = direction.length
    if end_radius is None or abs(end_radius - radius) < 1e-5:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=midpoint)
    else:
        bpy.ops.mesh.primitive_cone_add(
            vertices=vertices,
            radius1=end_radius,
            radius2=radius,
            depth=depth,
            location=midpoint,
        )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    smooth_object(obj)
    move_to_collection(obj, collection)
    obj["asset_role"] = "render_mesh"
    return obj


def add_sleeve(side_sign, cloth_material, ridge_material, collection):
    prefix = "L" if side_sign < 0 else "R"
    shoulder = Vector((0.52 * side_sign, -0.01, 2.05))
    elbow = Vector((0.78 * side_sign, -0.03, 1.62))
    wrist = Vector((1.03 * side_sign, -0.11, 1.27))
    upper = cylinder_between(
        f"ObserverWill_{prefix}_UpperSleeve",
        shoulder,
        elbow,
        0.23,
        ridge_material,
        collection,
        vertices=16,
        end_radius=0.18,
    )
    lower = cylinder_between(
        f"ObserverWill_{prefix}_LowerSleeve",
        elbow,
        wrist,
        0.19,
        cloth_material,
        collection,
        vertices=16,
        end_radius=0.115,
    )
    panels = []
    arm_direction = (wrist - shoulder).normalized()
    side_vector = Vector((0, -1, 0))
    for index in range(8):
        t = index / 7
        start = shoulder.lerp(wrist, t) + Vector((0, 0.03 * sin(index), 0.02))
        direction = (arm_direction * 0.18 + Vector((0, 0, -1))).normalized()
        panels.append(
            (
                start,
                direction,
                side_vector,
                0.055 + 0.012 * (index % 2),
                0.32 + 0.06 * (index % 3),
                Vector((0.02 * side_sign, 0.01 * sin(index * 2.0), -0.02)),
            )
        )
    hanging = create_panel_mesh(
        f"ObserverWill_{prefix}_SleeveTatters", panels, cloth_material, collection
    )
    return [upper, lower, hanging], wrist


def add_hand(side_sign, wrist, hand_material, collection):
    prefix = "L" if side_sign < 0 else "R"
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.13, location=wrist)
    palm = bpy.context.object
    palm.name = f"ObserverWill_{prefix}_Palm"
    palm.scale = (0.75, 0.45, 1.05)
    palm.data.materials.append(hand_material)
    move_to_collection(palm, collection)
    smooth_object(palm)
    palm["asset_role"] = "render_mesh"

    objects = [palm]
    finger_offsets = (-0.075, -0.038, 0.0, 0.038, 0.075)
    for index, offset in enumerate(finger_offsets):
        base = wrist + Vector((0.035 * side_sign, -0.005, offset))
        length = 0.15 - abs(index - 2) * 0.012
        end = base + Vector((0.105 * side_sign, -0.035, -length * 0.42))
        finger = cylinder_between(
            f"ObserverWill_{prefix}_Finger_{index + 1}",
            base,
            end,
            0.024,
            hand_material,
            collection,
            vertices=10,
            end_radius=0.013,
        )
        claw_end = end + Vector((0.045 * side_sign, -0.018, -0.045))
        claw = cylinder_between(
            f"ObserverWill_{prefix}_Claw_{index + 1}",
            end,
            claw_end,
            0.014,
            hand_material,
            collection,
            vertices=8,
            end_radius=0.002,
        )
        objects.extend((finger, claw))
    return objects


def create_curve_spire(name, points, radius, material, collection):
    curve = bpy.data.curves.new(f"{name}_Curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    curve.resolution_u = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point_index, (point, coordinate) in enumerate(zip(spline.points, points)):
        point.co = (*coordinate, 1.0)
        point.radius = (1.0, 0.58, 0.04)[point_index]
    obj = bpy.data.objects.new(name, curve)
    curve.materials.append(material)
    collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    obj["asset_role"] = "render_mesh"
    return obj


def add_head_spires(ridge_material, collection):
    objects = []
    for index in range(20):
        angle = 2 * pi * index / 20 + 0.15 * sin(index * 1.8)
        lower_radius = 0.28 + 0.06 * sin(index * 2.2)
        start_z = 2.35 + 0.18 * (0.5 + 0.5 * sin(index * 3.4))
        height = 0.45 + 0.22 * (0.5 + 0.5 * sin(index * 1.27 + 0.8))
        start = Vector((cos(angle) * lower_radius, sin(angle) * lower_radius * 0.78, start_z))
        outward = Vector((cos(angle), sin(angle) * 0.7, 0))
        mid = start + outward * (0.08 + 0.06 * sin(index)) + Vector((0, 0, height * 0.55))
        tip = mid + outward * (0.07 + 0.04 * cos(index * 2.1)) + Vector((0, 0, height * 0.45))
        objects.append(
            create_curve_spire(
                f"ObserverWill_HeadSpire_{index + 1:02d}",
                (start, mid, tip),
                0.024 + 0.007 * (index % 3),
                ridge_material,
                collection,
            )
        )
    return objects


def add_board_grid(grid_material, dark_material, white_material, collection):
    objects = []
    board_width = 0.70
    board_bottom = 0.78
    board_top = 2.02
    front_y = -0.455

    for index in range(9):
        x = -board_width / 2 + board_width * index / 8
        objects.append(
            cylinder_between(
                f"ObserverWill_Grid_V_{index}",
                (x, front_y - 0.01, board_bottom),
                (x, front_y - 0.01, board_top),
                0.0035,
                grid_material,
                collection,
                vertices=8,
            )
        )
    for index in range(9):
        z = board_bottom + (board_top - board_bottom) * index / 8
        objects.append(
            cylinder_between(
                f"ObserverWill_Grid_H_{index}",
                (-board_width / 2, front_y - 0.01, z),
                (board_width / 2, front_y - 0.01, z),
                0.0035,
                grid_material,
                collection,
                vertices=8,
            )
        )
    stone_pattern = [
        (3, 2, True),
        (4, 2, False),
        (3, 3, False),
        (4, 3, True),
        (2, 4, False),
        (3, 4, True),
        (4, 4, False),
        (5, 4, True),
        (3, 5, False),
        (4, 5, True),
    ]
    cell_w = board_width / 8
    cell_h = (board_top - board_bottom) / 8
    for index, (col, row, is_white) in enumerate(stone_pattern):
        x = -board_width / 2 + (col + 0.5) * cell_w
        z = board_top - (row + 0.5) * cell_h
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1.0, location=(x, front_y - 0.027, z))
        stone = bpy.context.object
        stone.name = f"ObserverWill_Stone_{index + 1:02d}_{'White' if is_white else 'Black'}"
        stone.scale = (0.027, 0.008, 0.027)
        stone.data.materials.append(white_material if is_white else dark_material)
        move_to_collection(stone, collection)
        smooth_object(stone)
        stone["asset_role"] = "render_mesh"
        objects.append(stone)
    return objects


def add_reference_images(reference_collection):
    for path, name in ((TURNAROUND_PATH, "Reference_Turnaround"), (DETAIL_PATH, "Reference_Details")):
        if not path.exists():
            continue
        image = bpy.data.images.load(str(path), check_existing=True)
        obj = bpy.data.objects.new(name, None)
        obj.empty_display_type = "IMAGE"
        obj.data = image
        obj.empty_display_size = 3.0
        obj.hide_render = True
        obj.hide_viewport = True
        obj["source_file"] = str(path.relative_to(PROJECT_ROOT)).replace("\\", "/")
        reference_collection.objects.link(obj)


def build_optimized_export_objects(asset_collection, export_collection):
    groups = {}
    for source in asset_collection.objects:
        if source.type != "MESH":
            continue
        material_name = source.data.materials[0].name if source.data.materials else "Unassigned"
        duplicate = source.copy()
        duplicate.data = source.data.copy()
        duplicate.animation_data_clear()
        export_collection.objects.link(duplicate)
        groups.setdefault(material_name, []).append(duplicate)

    export_objects = []
    for material_name, group in sorted(groups.items()):
        bpy.ops.object.select_all(action="DESELECT")
        for obj in group:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        joined = bpy.context.object
        safe_name = "".join(character if character.isalnum() else "_" for character in material_name)
        joined.name = f"ObserverWill_Export_{safe_name}"
        joined.data.name = f"{joined.name}_Mesh"
        joined["asset_role"] = "optimized_render_mesh"
        export_objects.append(joined)
    return export_objects


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_preview_setup(preview_collection, materials):
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -0.18))
    ground = bpy.context.object
    ground.name = "Preview_Ground"
    ground.data.materials.append(materials["preview_ground"])
    move_to_collection(ground, preview_collection)

    light_specs = (
        ("Preview_Key", (-3.8, -4.5, 5.2), 720, 3.2, (0.78, 0.86, 1.0)),
        ("Preview_Fill", (3.6, -2.5, 3.2), 360, 3.0, (0.48, 0.62, 1.0)),
        ("Preview_Rim", (1.5, 2.8, 4.4), 900, 2.5, (0.78, 0.84, 1.0)),
    )
    for name, location, energy, size, color in light_specs:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, (0, 0, 1.45))
        move_to_collection(light, preview_collection)

    bpy.ops.object.camera_add(location=(4.25, -6.6, 3.3))
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    camera.data.lens = 62
    point_at(camera, (0, 0, 1.45))
    move_to_collection(camera, preview_collection)
    bpy.context.scene.camera = camera


def configure_scene():
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"
    scene.world.color = (0.035, 0.045, 0.06)
    scene.view_settings.exposure = -0.65
    if "AgX - Medium High Contrast" in [item.name for item in bpy.types.ColorManagedViewSettings.bl_rna.properties["look"].enum_items]:
        scene.view_settings.look = "AgX - Medium High Contrast"


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    clear_scene()
    configure_scene()

    asset_collection = bpy.data.collections.new("ObserverWill_Asset")
    reference_collection = bpy.data.collections.new("ObserverWill_References_Hidden")
    preview_collection = bpy.data.collections.new("Preview_Setup_Not_Exported")
    export_collection = bpy.data.collections.new("ObserverWill_Export_Temporary")
    bpy.context.scene.collection.children.link(asset_collection)
    bpy.context.scene.collection.children.link(reference_collection)
    bpy.context.scene.collection.children.link(preview_collection)
    bpy.context.scene.collection.children.link(export_collection)

    materials = {
        "cloth": make_material("ObserverWill_Cloth", (0.008, 0.011, 0.014, 1), 0.78),
        "ridge": make_material("ObserverWill_CharredRidges", (0.006, 0.008, 0.011, 1), 0.76, 0.04),
        "void": make_material("ObserverWill_FaceVoid", (0.0002, 0.0002, 0.0003, 1), 1.0),
        "hand": make_material("ObserverWill_Hands", (0.012, 0.014, 0.017, 1), 0.40, 0.1),
        "grid": make_material("ObserverWill_AgedGrid", (0.075, 0.060, 0.040, 1), 0.52, 0.42),
        "stone_white": make_material("ObserverWill_StoneWhite", (0.36, 0.37, 0.34, 1), 0.34, 0.12),
        "eye": make_material(
            "ObserverWill_EyeGlow",
            (0.95, 0.84, 0.56, 1),
            0.15,
            0.0,
            emission=((1.0, 0.74, 0.34, 1), 18.0),
        ),
        "preview_ground": make_material("Preview_Ground", (0.018, 0.022, 0.030, 1), 0.92),
    }

    objects = []
    objects.append(
        create_irregular_shell(
            "ObserverWill_CoreCloak",
            (
                (0.12, 0.68, 0.50),
                (0.48, 0.64, 0.48),
                (0.92, 0.53, 0.43),
                (1.38, 0.46, 0.38),
                (1.78, 0.44, 0.36),
                (2.06, 0.52, 0.38),
                (2.24, 0.38, 0.31),
            ),
            48,
            materials["cloth"],
            asset_collection,
            0.3,
        )
    )
    objects.append(build_skirt_panels(materials["cloth"], asset_collection))
    objects.append(build_shoulder_panels(materials["ridge"], asset_collection))
    objects.append(build_hood_panels(materials["ridge"], asset_collection))
    objects.append(
        create_irregular_shell(
            "ObserverWill_Hood",
            (
                (2.12, 0.38, 0.32),
                (2.38, 0.36, 0.30),
                (2.66, 0.30, 0.27),
                (2.88, 0.20, 0.19),
                (3.04, 0.07, 0.07),
            ),
            36,
            materials["ridge"],
            asset_collection,
            1.4,
        )
    )

    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0, location=(0, -0.335, 2.58))
    face = bpy.context.object
    face.name = "ObserverWill_FaceVoid"
    face.scale = (0.15, 0.018, 0.23)
    face.data.materials.append(materials["void"])
    smooth_object(face)
    move_to_collection(face, asset_collection)
    face["asset_role"] = "render_mesh"
    objects.append(face)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.036, location=(0, -0.359, 2.65))
    eye = bpy.context.object
    eye.name = "ObserverWill_EyeGlow"
    eye.scale = (1.0, 0.45, 1.0)
    eye.data.materials.append(materials["eye"])
    smooth_object(eye)
    move_to_collection(eye, asset_collection)
    eye["asset_role"] = "render_mesh"
    objects.append(eye)

    objects.extend(add_head_spires(materials["ridge"], asset_collection))
    for side_sign in (-1, 1):
        sleeve_objects, wrist = add_sleeve(
            side_sign, materials["cloth"], materials["ridge"], asset_collection
        )
        objects.extend(sleeve_objects)
        objects.extend(add_hand(side_sign, wrist, materials["hand"], asset_collection))

    objects.extend(
        add_board_grid(
            materials["grid"], materials["void"], materials["stone_white"], asset_collection
        )
    )

    for obj in objects:
        obj["character"] = "observer_will"
        obj["orientation"] = "front_negative_y_z_up"
    asset_collection["asset_height_m"] = 3.15
    asset_collection["model_status"] = "static_model_ready_for_rigging"
    asset_collection["source_turnaround"] = str(TURNAROUND_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/")
    asset_collection["source_detail_sheet"] = str(DETAIL_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/")

    add_reference_images(reference_collection)

    export_objects = build_optimized_export_objects(asset_collection, export_collection)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in export_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = export_objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )

    mesh_count = len(export_objects)
    vertex_count = sum(len(obj.data.vertices) for obj in export_objects)
    triangle_count = sum(len(obj.data.loop_triangles) for obj in export_objects)
    for obj in list(export_objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(export_collection)

    add_preview_setup(preview_collection, materials)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.render.render(write_still=True)

    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"PREVIEW={PREVIEW_PATH}")
    print(f"MESH_OBJECTS={mesh_count}")
    print(f"VERTICES={vertex_count}")
    print(f"TRIANGLES={triangle_count}")


if __name__ == "__main__":
    main()
