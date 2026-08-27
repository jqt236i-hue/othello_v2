from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_IMAGE = PROJECT_ROOT / "assets" / "images" / "special-stones" / "ESCAPE_WILL-white.png"
OUTPUT_DIR = PROJECT_ROOT / "assets" / "models" / "special-stones"
BLEND_PATH = OUTPUT_DIR / "ESCAPE_WILL-white.blend"
GLB_PATH = OUTPUT_DIR / "ESCAPE_WILL-white.glb"
PREVIEW_PATH = OUTPUT_DIR / "ESCAPE_WILL-white-preview.png"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def make_principled_material(name, base_color, roughness=0.35, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = base_color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = 0.18
    return material


def create_body(asset_collection):
    bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.5, depth=0.14, location=(0, 0, 0))
    body = bpy.context.object
    body.name = "ESCAPE_WILL_White_Body"
    body.data.name = "ESCAPE_WILL_White_Body_Mesh"
    body.data.materials.append(make_principled_material("Stone_White", (0.92, 0.94, 0.96, 1.0), 0.24))
    body["asset_role"] = "render_mesh"
    body["collision_shape"] = "cylinder"
    body["collision_radius_m"] = 0.5
    body["collision_half_height_m"] = 0.07

    bevel = body.modifiers.new("Rounded stone edge", "BEVEL")
    bevel.width = 0.055
    bevel.segments = 6
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for polygon in body.data.polygons:
        polygon.use_smooth = True
    move_to_collection(body, asset_collection)
    return body


def create_front_rim(asset_collection):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.468,
        minor_radius=0.012,
        major_segments=128,
        minor_segments=12,
        location=(0, 0, 0.076),
    )
    rim = bpy.context.object
    rim.name = "ESCAPE_WILL_White_Front_Rim"
    rim.data.name = "ESCAPE_WILL_White_Front_Rim_Mesh"
    rim.data.materials.append(make_principled_material("Stone_Rim", (0.68, 0.72, 0.76, 1.0), 0.2, 0.08))
    for polygon in rim.data.polygons:
        polygon.use_smooth = True
    move_to_collection(rim, asset_collection)
    return rim


def create_decal_material():
    material = bpy.data.materials.new("ESCAPE_WILL_White_Artwork")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")

    image = bpy.data.images.load(str(SOURCE_IMAGE), check_existing=True)
    image.name = "ESCAPE_WILL-white_Artwork"

    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "Artwork_Texture"
    texture.image = image
    texture.interpolation = "Linear"
    links.new(texture.outputs["Color"], principled.inputs["Base Color"])
    links.new(texture.outputs["Alpha"], principled.inputs["Alpha"])
    principled.inputs["Roughness"].default_value = 0.32
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = 0.1

    grayscale = nodes.new("ShaderNodeRGBToBW")
    relief_map = nodes.new("ShaderNodeValToRGB")
    relief_map.color_ramp.elements[0].color = (1, 1, 1, 1)
    relief_map.color_ramp.elements[1].color = (0, 0, 0, 1)
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.16
    bump.inputs["Distance"].default_value = 0.008
    links.new(texture.outputs["Color"], grayscale.inputs["Color"])
    links.new(grayscale.outputs["Val"], relief_map.inputs["Fac"])
    links.new(relief_map.outputs["Color"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], principled.inputs["Normal"])
    return material


def create_artwork_disc(asset_collection):
    segments = 128
    radius = 0.455
    vertices = [(0.0, 0.0, 0.0)]
    uvs = [(0.5, 0.5)]
    for index in range(segments):
        angle = 2 * pi * index / segments
        x = radius * cos(angle)
        y = radius * sin(angle)
        vertices.append((x, y, 0.0))
        uvs.append((0.5 + 0.5 * cos(angle), 0.5 + 0.5 * sin(angle)))

    faces = []
    for index in range(segments):
        current = index + 1
        following = ((index + 1) % segments) + 1
        faces.append((0, current, following))

    mesh = bpy.data.meshes.new("ESCAPE_WILL_White_Artwork_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    artwork = bpy.data.objects.new("ESCAPE_WILL_White_Artwork", mesh)
    artwork.location.z = 0.077
    asset_collection.objects.link(artwork)
    mesh.materials.append(create_decal_material())

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs[vertex_index]
    return artwork


def move_to_collection(obj, target_collection):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    target_collection.objects.link(obj)


def point_at(obj, target=(0, 0, 0)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_preview_scene():
    preview_collection = bpy.data.collections.new("Preview_Setup_Not_Exported")
    bpy.context.scene.collection.children.link(preview_collection)

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.15))
    ground = bpy.context.object
    ground.name = "Preview_Ground"
    ground.data.materials.append(make_principled_material("Preview_Ground_Material", (0.035, 0.045, 0.06, 1), 0.52))
    move_to_collection(ground, preview_collection)

    bpy.ops.object.light_add(type="AREA", location=(-1.5, -1.7, 2.4))
    key = bpy.context.object
    key.name = "Preview_Key_Light"
    key.data.energy = 700
    key.data.shape = "DISK"
    key.data.size = 2.2
    point_at(key)
    move_to_collection(key, preview_collection)

    bpy.ops.object.light_add(type="AREA", location=(1.6, 0.8, 1.2))
    fill = bpy.context.object
    fill.name = "Preview_Fill_Light"
    fill.data.energy = 420
    fill.data.size = 1.8
    point_at(fill)
    move_to_collection(fill, preview_collection)

    bpy.ops.object.camera_add(location=(0.82, -1.28, 1.35))
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    camera.data.lens = 58
    point_at(camera, (0, 0, 0.01))
    move_to_collection(camera, preview_collection)
    bpy.context.scene.camera = camera


def configure_scene():
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.world.color = (0.012, 0.018, 0.03)


def main():
    if not SOURCE_IMAGE.exists():
        raise FileNotFoundError(f"Source image not found: {SOURCE_IMAGE}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    clear_scene()
    configure_scene()

    asset_collection = bpy.data.collections.new("ESCAPE_WILL_White_Asset")
    bpy.context.scene.collection.children.link(asset_collection)
    body = create_body(asset_collection)
    rim = create_front_rim(asset_collection)
    artwork = create_artwork_disc(asset_collection)
    asset_objects = [body, rim, artwork]

    bpy.ops.object.select_all(action="DESELECT")
    for obj in asset_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )

    add_preview_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.render.render(write_still=True)

    print(f"BLEND={BLEND_PATH}")
    print(f"GLB={GLB_PATH}")
    print(f"PREVIEW={PREVIEW_PATH}")


if __name__ == "__main__":
    main()
