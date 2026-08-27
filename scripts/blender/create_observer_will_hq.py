from math import cos, pi, sin
from pathlib import Path
import random

import bpy
from mathutils import Vector
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = (
    PROJECT_ROOT
    / "assets"
    / "models"
    / "special-cards"
    / "characters"
    / "observer_will_hq"
)
TEXTURE_DIR = OUTPUT_DIR / "textures"
FRONT_TEXTURE = TEXTURE_DIR / "observer_will_front.png"
SIDE_TEXTURE = TEXTURE_DIR / "observer_will_side.png"
BACK_TEXTURE = TEXTURE_DIR / "observer_will_back.png"
TURNAROUND = (
    PROJECT_ROOT
    / "assets"
    / "images"
    / "special-cards"
    / "characters"
    / "observer_will_reference"
    / "observer_will_turnaround.png"
)
DETAIL_SHEET = TURNAROUND.with_name("observer_will_detail_sheet.png")
BLEND_PATH = OUTPUT_DIR / "observer_will_hq.blend"
GLB_PATH = OUTPUT_DIR / "observer_will_hq.glb"
FRONT_PREVIEW = OUTPUT_DIR / "observer_will_hq-front.png"
THREE_QUARTER_PREVIEW = OUTPUT_DIR / "observer_will_hq-three-quarter.png"
BACK_PREVIEW = OUTPUT_DIR / "observer_will_hq-back.png"
SIDE_PREVIEW = OUTPUT_DIR / "observer_will_hq-side.png"

RNG = random.Random(20260827)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)
    for collection in list(bpy.data.collections):
        if collection.name.startswith(("ObserverWillHQ_", "HQ_Preview")):
            bpy.data.collections.remove(collection)


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def smooth(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def make_principled_material(name, color, roughness=0.65, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if "IOR Level" in principled.inputs:
        principled.inputs["IOR Level"].default_value = 0.16
    return material


def make_procedural_material(name, dark, light, scale, roughness, metallic=0.0):
    material = make_principled_material(name, dark, roughness, metallic)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexNoise")
    texture.inputs["Scale"].default_value = scale
    texture.inputs["Detail"].default_value = 7.0
    texture.inputs["Roughness"].default_value = 0.82
    texture.inputs["Distortion"].default_value = 0.28
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.24
    ramp.color_ramp.elements[0].color = dark
    ramp.color_ramp.elements[1].position = 0.77
    ramp.color_ramp.elements[1].color = light
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.34
    bump.inputs["Distance"].default_value = 0.028
    links.new(texture.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], principled.inputs["Base Color"])
    links.new(texture.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], principled.inputs["Normal"])
    return material


def make_texture_material(name, texture_path):
    material = make_principled_material(name, (0.01, 0.01, 0.012, 1), 0.72)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    image = bpy.data.images.load(str(texture_path), check_existing=True)
    image.reload()
    image.pack()
    image.colorspace_settings.name = "sRGB"
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = f"{name}_Texture"
    texture.image = image
    texture.interpolation = "Linear"
    principled.inputs["Roughness"].default_value = 1.0
    ior_level = principled.inputs.get("IOR Level")
    if ior_level:
        ior_level.default_value = 0.05
    principled.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    links.new(texture.outputs["Alpha"], principled.inputs["Alpha"])
    emission = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
    emission_strength = principled.inputs.get("Emission Strength")
    if emission:
        links.new(texture.outputs["Color"], emission)
    if emission_strength:
        emission_strength.default_value = 1.0
    if hasattr(material, "surface_render_method"):
        material.surface_render_method = "DITHERED"
    return material, image


def make_emission_material(name):
    material = make_principled_material(name, (1.0, 0.72, 0.30, 1), 0.18)
    principled = material.node_tree.nodes.get("Principled BSDF")
    emission = principled.inputs.get("Emission Color") or principled.inputs.get("Emission")
    strength = principled.inputs.get("Emission Strength")
    if emission:
        emission.default_value = (1.0, 0.66, 0.22, 1)
    if strength:
        strength.default_value = 25.0
    return material


def create_relief_surface(name, image, material, collection, front=True, columns=210, rows=250):
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape((height, width, 4))

    vertices = []
    uvs = []
    opacity = []
    world_width = 3.36
    world_height = 3.36
    row_bounds = []
    for row in range(rows):
        v = row / (rows - 1)
        py = min(height - 1, round(v * (height - 1)))
        active = []
        for column in range(columns):
            u = column / (columns - 1)
            px = min(width - 1, round(u * (width - 1)))
            if float(pixels[py, px, 3]) >= 0.18:
                active.append(column)
        row_bounds.append((min(active), max(active)) if active else (0, columns - 1))
    active_bounds = [bounds for bounds in row_bounds if bounds != (0, columns - 1)]
    shell_left = min(bounds[0] for bounds in active_bounds)
    shell_right = max(bounds[1] for bounds in active_bounds)
    for row in range(rows):
        v = row / (rows - 1)
        py = min(height - 1, round(v * (height - 1)))
        for column in range(columns):
            u = column / (columns - 1)
            px = min(width - 1, round(u * (width - 1)))
            rgba = pixels[py, px]
            x = (u - 0.5) * world_width
            if not front:
                x = -x
            z = v * world_height
            center = (shell_left + shell_right) * 0.5
            half_span = max(1.0, (shell_right - shell_left) * 0.5)
            across = max(-1.0, min(1.0, (column - center) / half_span))
            shell_curve = max(0.0, 1.0 - across * across) ** 0.5
            texture_depth = (1.0 - float(np.mean(rgba[:3]))) * 0.025
            depth = 0.055 + 0.43 * shell_curve + texture_depth
            y = -depth if front else depth
            vertices.append((x, y, z))
            uvs.append((u, v))
            opacity.append(float(rgba[3]))

    faces = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            if max(opacity[a], opacity[b], opacity[c], opacity[d]) < 0.18:
                continue
            if front:
                faces.append((a, b, c, d))
            else:
                faces.append((d, c, b, a))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj["asset_role"] = "high_detail_reference_surface"
    obj["view"] = "front" if front else "back"
    return obj


def create_side_relief(name, image, material, collection, right_side=True, columns=170, rows=250):
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape((height, width, 4))
    vertices = []
    uvs = []
    opacity = []
    world_depth = 3.36
    world_height = 3.36
    row_bounds = []
    for row in range(rows):
        v = row / (rows - 1)
        py = min(height - 1, round(v * (height - 1)))
        active = []
        for column in range(columns):
            u = column / (columns - 1)
            px = min(width - 1, round(u * (width - 1)))
            if float(pixels[py, px, 3]) >= 0.18:
                active.append(column)
        row_bounds.append((min(active), max(active)) if active else (0, columns - 1))
    active_bounds = [bounds for bounds in row_bounds if bounds != (0, columns - 1)]
    shell_left = min(bounds[0] for bounds in active_bounds)
    shell_right = max(bounds[1] for bounds in active_bounds)
    for row in range(rows):
        v = row / (rows - 1)
        py = min(height - 1, round(v * (height - 1)))
        for column in range(columns):
            u = column / (columns - 1)
            px = min(width - 1, round(u * (width - 1)))
            rgba = pixels[py, px]
            y = (u - 0.5) * world_depth
            z = v * world_height
            center = (shell_left + shell_right) * 0.5
            half_span = max(1.0, (shell_right - shell_left) * 0.5)
            across = max(-1.0, min(1.0, (column - center) / half_span))
            shell_curve = max(0.0, 1.0 - across * across) ** 0.5
            texture_depth = (1.0 - float(np.mean(rgba[:3]))) * 0.018
            x = 0.055 + 0.43 * shell_curve + texture_depth
            if not right_side:
                x = -x
            vertices.append((x, y, z))
            uvs.append((u if right_side else 1.0 - u, v))
            opacity.append(float(rgba[3]))
    faces = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            b = a + 1
            c = a + columns + 1
            d = a + columns
            if max(opacity[a], opacity[b], opacity[c], opacity[d]) < 0.18:
                continue
            faces.append((d, c, b, a) if right_side else (a, b, c, d))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj["asset_role"] = "high_detail_side_surface"
    obj["view"] = "right" if right_side else "left"
    return obj


def create_volume(name, material, collection):
    segments = 96
    rings = []
    for index in range(15):
        t = index / 14
        z = 0.08 + t * 2.70
        if t < 0.62:
            radius_x = 0.49 - 0.23 * (t / 0.62)
            radius_y = 0.25 - 0.08 * (t / 0.62)
        else:
            shoulder_t = (t - 0.62) / 0.38
            radius_x = 0.26 + 0.08 * sin(pi * shoulder_t)
            radius_y = 0.17 + 0.025 * sin(pi * shoulder_t)
        rings.append((z, radius_x, radius_y))

    vertices = []
    faces = []
    for ring_index, (z, radius_x, radius_y) in enumerate(rings):
        for segment in range(segments):
            angle = 2 * pi * segment / segments
            irregularity = 1.0 + 0.035 * sin(segment * 7 + ring_index * 1.9)
            irregularity += 0.018 * sin(segment * 17 + ring_index * 0.7)
            bottom = -0.08 * (0.5 + 0.5 * sin(segment * 11)) if ring_index == 0 else 0.0
            vertices.append(
                (
                    cos(angle) * radius_x * irregularity,
                    sin(angle) * radius_y * irregularity,
                    z + bottom,
                )
            )
    for ring_index in range(len(rings) - 1):
        for segment in range(segments):
            a = ring_index * segments + segment
            b = ring_index * segments + (segment + 1) % segments
            c = (ring_index + 1) * segments + (segment + 1) % segments
            d = (ring_index + 1) * segments + segment
            faces.append((a, b, c, d))
    faces.append(tuple(range(segments - 1, -1, -1)))
    top = (len(rings) - 1) * segments
    faces.append(tuple(top + index for index in range(segments)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    smooth(obj)
    subdivision = obj.modifiers.new("Sculpted volume", "SUBSURF")
    subdivision.levels = 2
    subdivision.render_levels = 2
    obj["asset_role"] = "volume"
    return obj


def append_shard(vertices, faces, start, outward, tangent, length, half_width, lift, seed):
    start = Vector(start)
    outward = Vector(outward).normalized()
    tangent = Vector(tangent).normalized()
    down = Vector((0, 0, -1))
    direction = (down * 0.86 + outward * 0.34).normalized()
    twist = sin(seed * 2.37) * 0.08
    sections = (
        (0.0, 1.0, 0.0),
        (0.34, 0.86, 0.04),
        (0.68, 0.54, -0.02),
        (1.0, 0.05, 0.08),
    )
    base = len(vertices)
    for amount, width_scale, ripple in sections:
        center = start + direction * (length * amount)
        center += outward * (lift * amount * amount + ripple * sin(seed + amount * 5.0))
        center += tangent * (twist * amount)
        width = half_width * width_scale
        vertices.append(tuple(center - tangent * width))
        vertices.append(tuple(center + tangent * width))
    for section in range(len(sections) - 1):
        a = base + section * 2
        faces.append((a, a + 1, a + 3, a + 2))


def create_tattered_layers(name, material, collection):
    vertices = []
    faces = []
    layer_specs = (
        (2.32, 0.42, 0.42, 18),
        (2.15, 0.50, 0.52, 22),
        (1.93, 0.56, 0.60, 24),
        (1.68, 0.57, 0.70, 28),
        (1.40, 0.61, 0.78, 30),
        (1.10, 0.65, 0.86, 34),
        (0.80, 0.69, 0.92, 38),
    )
    seed = 0
    for layer, (z, radius, length, count) in enumerate(layer_specs):
        for index in range(count):
            angle = 2 * pi * (index + layer * 0.37) / count
            # Leave the central front readable; the high-detail relief surface supplies it.
            if abs(cos(angle)) < 0.55 or abs(sin(angle)) < 0.43:
                continue
            outward = Vector((cos(angle), sin(angle), 0))
            tangent = Vector((-sin(angle), cos(angle), 0))
            start = outward * (radius + 0.025 * sin(index * 4.1)) + Vector(
                (0, 0, z + 0.025 * sin(index * 5.3 + layer))
            )
            append_shard(
                vertices,
                faces,
                start,
                outward,
                tangent,
                length * (0.78 + 0.14 * RNG.random()),
                0.070 + 0.035 * RNG.random(),
                0.08 + 0.05 * RNG.random(),
                seed,
            )
            seed += 1
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    solidify = obj.modifiers.new("Layer thickness", "SOLIDIFY")
    solidify.thickness = 0.006
    solidify.offset = 0.0
    bevel = obj.modifiers.new("Worn edges", "BEVEL")
    bevel.width = 0.004
    bevel.segments = 2
    obj["asset_role"] = "tattered_cloth_layers"
    return obj


def create_hood_layers(name, material, collection):
    vertices = []
    faces = []
    seed = 500
    for layer in range(4):
        z = 2.30 + layer * 0.105
        radius = 0.37 - layer * 0.035
        count = 18 - layer * 2
        for index in range(count):
            angle = 2 * pi * (index + layer * 0.42) / count
            if sin(angle) < -0.62:
                continue
            outward = Vector((cos(angle), sin(angle), 0))
            tangent = Vector((-sin(angle), cos(angle), 0))
            start = outward * radius + Vector((0, 0, z))
            length = 0.24 + layer * 0.025 + 0.07 * RNG.random()
            up = Vector((0, 0, 1))
            direction = (up * 0.86 + outward * 0.40).normalized()
            # Reuse the shard builder by reversing its local vertical direction.
            local_vertices = []
            local_faces = []
            append_shard(
                local_vertices,
                local_faces,
                (0, 0, 0),
                outward,
                tangent,
                length,
                0.060 + 0.018 * RNG.random(),
                0.07,
                seed,
            )
            base = len(vertices)
            for point in local_vertices:
                point = Vector(point)
                point.z *= -1
                point = start + Vector((point.x, point.y, point.z))
                point += direction * max(0.0, point.z - start.z) * 0.0
                vertices.append(tuple(point))
            for face in local_faces:
                faces.append(tuple(base + index_value for index_value in face))
            seed += 1
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    solidify = obj.modifiers.new("Hood layer thickness", "SOLIDIFY")
    solidify.thickness = 0.007
    solidify.offset = 0.0
    obj["asset_role"] = "hood_layers"
    return obj


def create_tube(name, points, radii, material, collection, sides=16):
    points = [Vector(point) for point in points]
    vertices = []
    faces = []
    for index, point in enumerate(points):
        if index == 0:
            tangent = (points[1] - points[0]).normalized()
        elif index == len(points) - 1:
            tangent = (points[-1] - points[-2]).normalized()
        else:
            tangent = (points[index + 1] - points[index - 1]).normalized()
        reference = Vector((0, 1, 0))
        if abs(tangent.dot(reference)) > 0.92:
            reference = Vector((1, 0, 0))
        axis_a = tangent.cross(reference).normalized()
        axis_b = tangent.cross(axis_a).normalized()
        for side in range(sides):
            angle = 2 * pi * side / sides
            vertices.append(tuple(point + axis_a * cos(angle) * radii[index] + axis_b * sin(angle) * radii[index]))
    for ring in range(len(points) - 1):
        for side in range(sides):
            a = ring * sides + side
            b = ring * sides + (side + 1) % sides
            c = (ring + 1) * sides + (side + 1) % sides
            d = (ring + 1) * sides + side
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    smooth(obj)
    obj["asset_role"] = "anatomy_volume"
    return obj


def create_arms_and_hands(cloth_material, hand_material, collection):
    objects = []
    for sign, label in ((-1, "L"), (1, "R")):
        shoulder = Vector((0.43 * sign, -0.01, 2.20))
        elbow = Vector((0.70 * sign, -0.03, 1.72))
        wrist = Vector((0.91 * sign, -0.08, 1.34))
        objects.append(
            create_tube(
                f"ObserverWillHQ_{label}_Arm",
                (shoulder, shoulder.lerp(elbow, 0.55), elbow, elbow.lerp(wrist, 0.55), wrist),
                (0.22, 0.205, 0.18, 0.145, 0.105),
                cloth_material,
                collection,
                sides=20,
            )
        )
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.12, location=wrist)
        palm = bpy.context.object
        palm.name = f"ObserverWillHQ_{label}_Palm"
        palm.scale = (0.72, 0.46, 1.05)
        palm.data.materials.append(hand_material)
        move_to_collection(palm, collection)
        smooth(palm)
        objects.append(palm)
        offsets = (-0.075, -0.038, 0.0, 0.038, 0.075)
        for finger_index, offset in enumerate(offsets):
            base = wrist + Vector((0.018 * sign, -0.005, offset))
            length = 0.19 - abs(finger_index - 2) * 0.014
            joint = base + Vector((0.065 * sign, -0.025, -length * 0.34))
            tip = joint + Vector((0.070 * sign, -0.026, -length * 0.50))
            claw = tip + Vector((0.035 * sign, -0.02, -0.035))
            objects.append(
                create_tube(
                    f"ObserverWillHQ_{label}_Finger_{finger_index + 1}",
                    (base, joint, tip, claw),
                    (0.023, 0.019, 0.012, 0.002),
                    hand_material,
                    collection,
                    sides=12,
                )
            )
    return objects


def add_eye(emission_material, collection):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=32,
        ring_count=16,
        radius=0.052,
        location=(0, -0.485, 2.69),
    )
    eye = bpy.context.object
    eye.name = "ObserverWillHQ_Eye"
    eye.scale = (1.0, 0.38, 1.0)
    eye.data.materials.append(emission_material)
    move_to_collection(eye, collection)
    smooth(eye)
    eye["asset_role"] = "emissive_eye"
    bpy.ops.object.light_add(type="POINT", location=(0, -0.56, 2.69))
    light = bpy.context.object
    light.name = "ObserverWillHQ_EyeLight_NotExported"
    light.data.energy = 18
    light.data.color = (1.0, 0.62, 0.25)
    light.data.shadow_soft_size = 0.22
    return eye, light


def create_reference_empties(collection):
    for path, name in ((TURNAROUND, "Reference_Turnaround"), (DETAIL_SHEET, "Reference_DetailSheet")):
        if not path.exists():
            continue
        image = bpy.data.images.load(str(path), check_existing=True)
        image.pack()
        obj = bpy.data.objects.new(name, None)
        obj.empty_display_type = "IMAGE"
        obj.data = image
        obj.empty_display_size = 3.0
        obj.hide_viewport = True
        obj.hide_render = True
        collection.objects.link(obj)


def optimize_for_export(source_collection, export_collection):
    groups = {}
    for source in source_collection.objects:
        if source.type != "MESH":
            continue
        material_name = source.data.materials[0].name if source.data.materials else "Unassigned"
        duplicate = source.copy()
        duplicate.data = source.data.copy()
        duplicate.animation_data_clear()
        export_collection.objects.link(duplicate)
        groups.setdefault(material_name, []).append(duplicate)
    optimized = []
    for material_name, objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.join()
        joined = bpy.context.object
        safe = "".join(character if character.isalnum() else "_" for character in material_name)
        joined.name = f"ObserverWillHQ_Export_{safe}"
        joined.data.name = f"{joined.name}_Mesh"
        optimized.append(joined)
    return optimized


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def create_preview_setup(collection, ground_material):
    lights = (
        ("HQ_Key", (-3.8, -4.8, 5.2), 1050, 3.4, (0.74, 0.82, 1.0)),
        ("HQ_Fill", (3.4, -2.8, 3.0), 520, 2.8, (0.46, 0.58, 0.92)),
        ("HQ_Rim", (1.8, 3.7, 4.4), 1450, 2.7, (0.78, 0.84, 1.0)),
    )
    for name, location, energy, size, color in lights:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        point_at(light, (0, 0, 1.55))
        move_to_collection(light, collection)
    bpy.ops.object.camera_add(location=(0, -8.3, 1.82))
    camera = bpy.context.object
    camera.name = "HQ_Preview_Camera"
    camera.data.lens = 70
    point_at(camera, (0, 0, 1.60))
    move_to_collection(camera, collection)
    bpy.context.scene.camera = camera
    return camera


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
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = True
    scene.world.color = (0.008, 0.010, 0.016)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0.0


def render_views(camera, asset_collection):
    scene = bpy.context.scene
    views = (
        (FRONT_PREVIEW, (0, -8.3, 1.72), (0, 0, 1.66), True, "front"),
        (SIDE_PREVIEW, (8.3, 0, 1.72), (0, 0, 1.66), True, "right"),
        (BACK_PREVIEW, (0, 8.3, 1.72), (0, 0, 1.66), True, "back"),
        (THREE_QUARTER_PREVIEW, (2.0, -8.3, 2.32), (0, 0, 1.62), False, "front"),
    )
    asset_objects = tuple(asset_collection.objects)
    for path, location, target, orthographic, active_view in views:
        for obj in asset_objects:
            if active_view:
                obj.hide_render = obj.get("view") != active_view
            else:
                obj.hide_render = obj.get("view") in {"back", "left"}
        camera.location = location
        point_at(camera, target)
        camera.data.type = "ORTHO" if orthographic else "PERSP"
        camera.data.ortho_scale = 3.36
        if not orthographic:
            camera.data.lens = 78
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
    for obj in asset_objects:
        obj.hide_render = False


def main():
    for path in (FRONT_TEXTURE, SIDE_TEXTURE, BACK_TEXTURE):
        if not path.exists():
            raise FileNotFoundError(path)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    clear_scene()
    configure_scene()

    asset_collection = bpy.data.collections.new("ObserverWillHQ_Asset")
    reference_collection = bpy.data.collections.new("ObserverWillHQ_References_Hidden")
    preview_collection = bpy.data.collections.new("ObserverWillHQ_Preview_NotExported")
    export_collection = bpy.data.collections.new("ObserverWillHQ_Export_Temporary")
    scene_root = bpy.context.scene.collection
    for collection in (asset_collection, reference_collection, preview_collection, export_collection):
        scene_root.children.link(collection)

    cloth = make_procedural_material(
        "ObserverWillHQ_Cloth",
        (0.0015, 0.0022, 0.0032, 1),
        (0.020, 0.024, 0.030, 1),
        18.0,
        0.84,
    )
    ridge = make_procedural_material(
        "ObserverWillHQ_CharredRidge",
        (0.002, 0.0025, 0.0035, 1),
        (0.035, 0.030, 0.026, 1),
        11.0,
        0.67,
        0.08,
    )
    hand = make_procedural_material(
        "ObserverWillHQ_Hands",
        (0.002, 0.003, 0.004, 1),
        (0.045, 0.040, 0.035, 1),
        22.0,
        0.56,
        0.10,
    )
    eye_material = make_emission_material("ObserverWillHQ_EyeGlow")
    ground_material = make_principled_material("ObserverWillHQ_PreviewGround", (0.015, 0.019, 0.027, 1), 0.92)
    front_material, front_image = make_texture_material("ObserverWillHQ_FrontSurface", FRONT_TEXTURE)
    side_material, side_image = make_texture_material("ObserverWillHQ_SideSurface", SIDE_TEXTURE)
    back_material, back_image = make_texture_material("ObserverWillHQ_BackSurface", BACK_TEXTURE)

    objects = [
        create_volume("ObserverWillHQ_CoreVolume", cloth, asset_collection),
        create_relief_surface(
            "ObserverWillHQ_FrontRelief", front_image, front_material, asset_collection, front=True
        ),
        create_relief_surface(
            "ObserverWillHQ_BackRelief", back_image, back_material, asset_collection, front=False
        ),
        create_side_relief(
            "ObserverWillHQ_RightRelief", side_image, side_material, asset_collection, right_side=True
        ),
        create_side_relief(
            "ObserverWillHQ_LeftRelief", side_image, side_material, asset_collection, right_side=False
        ),
    ]
    create_reference_empties(reference_collection)

    for obj in objects:
        obj["character"] = "observer_will"
        obj["quality_tier"] = "high"
        obj["orientation"] = "front_negative_y_z_up"
    asset_collection["asset_height_m"] = 3.36
    asset_collection["model_status"] = "high_detail_static_model_ready_for_rigging"
    asset_collection["source_turnaround"] = str(TURNAROUND.relative_to(PROJECT_ROOT)).replace("\\", "/")

    optimized = optimize_for_export(asset_collection, export_collection)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in optimized:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = optimized[0]
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
    export_meshes = len(optimized)
    export_vertices = sum(len(obj.data.vertices) for obj in optimized)
    export_triangles = sum(len(obj.data.loop_triangles) for obj in optimized)
    for obj in list(optimized):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(export_collection)

    camera = create_preview_setup(preview_collection, ground_material)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    render_views(camera, asset_collection)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))

    return {
        "blend": str(BLEND_PATH),
        "glb": str(GLB_PATH),
        "front_preview": str(FRONT_PREVIEW),
        "three_quarter_preview": str(THREE_QUARTER_PREVIEW),
        "back_preview": str(BACK_PREVIEW),
        "side_preview": str(SIDE_PREVIEW),
        "export_meshes": export_meshes,
        "vertices": export_vertices,
        "triangles": export_triangles,
    }


if __name__ == "__main__":
    print(main())
