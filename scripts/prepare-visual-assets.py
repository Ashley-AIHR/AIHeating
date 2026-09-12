"""Blender preparation of public CC0 meshes, not image-to-3D reconstruction.
Run: blender -b --python scripts/prepare-visual-assets.py
Source downloads stay outside git; runtime GLBs are self-contained.
"""
import bpy, math, os
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sources = root.parent / 'work' / 'visual-sources'
dest = root / 'public' / 'visual-models'
dest.mkdir(exist_ok=True)

def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def export(name):
    bpy.ops.export_scene.gltf(filepath=str(dest / (name+'.glb')), export_format='GLB', export_yup=True, export_image_format='AUTO', export_texcoords=True, export_normals=True)
    print('PREPARED',name,[(o.name,len(o.data.polygons))for o in bpy.data.objects if o.type=='MESH'])

fresh()
asset='modular_urban_apartments_facade'
bpy.ops.import_scene.gltf(filepath=str(sources/asset/(asset+'.gltf')))
keep=['wall_window_centered_large_01','wall_window_centered_large_02','wall_window_centered_large_03',
      'window_centered_large_01','window_centered_large_02','window_centered_large_03',
      'wall_door_centered_large_01','door_centered_large_01','cornice_standard_standard_01','crown_standard_standard_01']
for obj in list(bpy.data.objects):
    if obj.name not in keep:
        bpy.data.objects.remove(obj,do_unlink=True)
        continue
    obj.location=(0,0,0)
    bpy.context.view_layer.objects.active=obj
    # Flat source walls are heavily subdivided; dissolve coplanar internal edges.
    if obj.name.startswith('wall_'):
        mod=obj.modifiers.new('Planar optimisation','DECIMATE');mod.decimate_type='DISSOLVE';mod.angle_limit=0.01
        bpy.ops.object.modifier_apply(modifier=mod.name)
export('apartment-facade-kit')

for asset,target,cap in [('tree_small_02','tree-summer',8500),('shrub_01','shrub',1800)]:
    fresh()
    bpy.ops.import_scene.gltf(filepath=str(sources/asset/(asset+'.gltf')))
    for obj in list(bpy.data.objects):
        if obj.type!='MESH': continue
        bpy.context.view_layer.objects.active=obj
        tris=sum(len(p.vertices)-2 for p in obj.data.polygons)
        if tris>cap:
            mod=obj.modifiers.new('Browser mesh budget','DECIMATE');mod.ratio=cap/tris
            bpy.ops.object.modifier_apply(modifier=mod.name)
    export(target)
    if asset=='tree_small_02':
        # A winter variant retains real branches; removes leaf material faces.
        import bmesh
        fresh()
        bpy.ops.import_scene.gltf(filepath=str(sources/asset/(asset+'.gltf')))
        for obj in list(bpy.data.objects):
            if obj.type!='MESH':continue
            bm=bmesh.new();bm.from_mesh(obj.data)
            faces=[f for f in bm.faces if f.material_index<len(obj.material_slots) and any(t in (obj.material_slots[f.material_index].name or '').lower()for t in ['leaf','leaves'])]
            bmesh.ops.delete(bm,geom=faces,context='FACES');bm.to_mesh(obj.data);bm.free()
            bpy.context.view_layer.objects.active=obj
            tris=sum(len(p.vertices)-2 for p in obj.data.polygons)
            if tris>8500:
                mod=obj.modifiers.new('Winter branch budget','DECIMATE');mod.ratio=8500/tris
                bpy.ops.object.modifier_apply(modifier=mod.name)
        export('tree-winter')
