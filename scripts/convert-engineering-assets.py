"""Offline, deterministic IFC tessellation and OpenDHN data import. No AI geometry.

Run in a separate conversion environment with ifcopenshell==0.8.5 installed.
The application/runtime does not require IfcOpenShell or upload engineering files.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import struct
import zipfile


def convert_ifc(source, destination):
    expected = '13976a8e223f177a6d7123679e4b02e750cd90c13f7bb20c593be125d9407119'
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
        raise ValueError('This reference-asset converter is pinned to the credited public Duplex IFC. For another source, use IfcConvert or supply a separately reviewed provenance-aware conversion; do not reuse this attribution.')
    import ifcopenshell
    import ifcopenshell.geom
    import ifcopenshell.util.element
    import numpy as np

    model = ifcopenshell.open(str(source))
    settings = ifcopenshell.geom.settings()
    settings.set(settings.USE_WORLD_COORDS, True)
    settings.set(settings.WELD_VERTICES, False)
    products = [p for p in model.by_type('IfcElement') if p.Representation and not p.is_a('IfcOpeningElement')]
    gltf = {'asset': {'version': '2.0', 'generator': 'HeatPilot / IfcOpenShell 0.8.5',
             'copyright': 'BSI (2020) Duplex Apartment Test Files, buildingSMART International; CC BY 4.0'},
            'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [],
            'materials': [], 'buffers': []}
    binary = bytearray()
    assets, failed = [], []
    palette = {'IfcFlowSegment': [.48,.61,.68,1], 'IfcFlowFitting': [.38,.48,.53,1],
               'IfcFlowController': [.12,.34,.53,1], 'IfcFlowMovingDevice': [.09,.29,.55,1],
               'IfcEnergyConversionDevice': [.13,.38,.58,1], 'IfcFlowTerminal': [.72,.77,.8,1]}
    materials = {}

    def accessor(array, kind, component):
        while len(binary) % 4: binary.append(0)
        offset = len(binary)
        binary.extend(array.tobytes())
        view = len(gltf['bufferViews'])
        gltf['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(binary)-offset})
        result = {'bufferView': view, 'componentType': component, 'count': len(array), 'type': kind}
        if kind == 'VEC3': result.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        gltf['accessors'].append(result)
        return len(gltf['accessors'])-1

    for index, product in enumerate(products):
        try:
            shape = ifcopenshell.geom.create_shape(settings, product)
            vertices = np.array(shape.geometry.verts, dtype='<f4').reshape(-1,3)
            # IFC world Z-up to glTF Y-up, metres maintained. Proper rotation (det=+1).
            vertices = np.column_stack((vertices[:,0], vertices[:,2], -vertices[:,1])).astype('<f4')
            triangles = np.array(shape.geometry.faces, dtype='<u4').reshape(-1,3)
            if not len(vertices) or not len(triangles): raise ValueError('Empty tessellation')
            if not np.isfinite(vertices).all(): raise ValueError('Non-finite vertices')
            normals = np.zeros_like(vertices)
            face_normals = np.cross(vertices[triangles[:,1]]-vertices[triangles[:,0]], vertices[triangles[:,2]]-vertices[triangles[:,0]])
            for col in range(3): np.add.at(normals, triangles[:,col], face_normals)
            normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
            kind = product.is_a()
            if kind not in materials:
                materials[kind] = len(gltf['materials'])
                gltf['materials'].append({'name': kind, 'doubleSided': True, 'pbrMetallicRoughness': {
                    'baseColorFactor': palette.get(kind, [.65,.69,.72,1]), 'metallicFactor': .28, 'roughnessFactor': .46}})
            mesh = {'name': product.GlobalId, 'primitives': [{'attributes': {
                'POSITION': accessor(vertices, 'VEC3', 5126), 'NORMAL': accessor(normals.astype('<f4'), 'VEC3', 5126)},
                'indices': accessor(triangles.flatten(), 'SCALAR', 5125), 'material': materials[kind]}]}
            node = {'name': product.GlobalId, 'mesh': len(gltf['meshes']),
                    'extras': {'assetId': product.GlobalId, 'ifcClass': kind, 'sourceExpressId': product.id()}}
            gltf['scenes'][0]['nodes'].append(len(gltf['nodes']))
            gltf['nodes'].append(node); gltf['meshes'].append(mesh)
            psets = ifcopenshell.util.element.get_psets(product)
            groups = [r.RelatingGroup.Name or r.RelatingGroup.GlobalId for r in getattr(product,'HasAssignments',[]) if r.is_a('IfcRelAssignsToGroup')]
            container = ifcopenshell.util.element.get_container(product)
            assets.append({'id': product.GlobalId, 'name': product.Name or kind, 'kind': kind,
                'expressId': product.id(), 'tag': getattr(product,'Tag',None), 'systems': groups,
                'storey': container.Name if container else None, 'properties': psets,
                'bounds': [vertices.min(axis=0).tolist(),vertices.max(axis=0).tolist()], 'triangles': len(triangles)})
        except Exception as error:
            failed.append({'id': product.GlobalId, 'name': product.Name, 'reason': str(error)})
        if index % 100 == 0: print(f'Tessellated {index}/{len(products)}', flush=True)

    if not assets: raise ValueError('No IFC geometry was converted')
    # Only explicit IFC port relationships count; never infer connections from proximity.
    owners = {}
    for relation in model.by_type('IfcRelConnectsPortToElement'):
        owners[relation.RelatingPort.GlobalId] = relation.RelatedElement.GlobalId
    connections = []
    for relation in model.by_type('IfcRelConnectsPorts'):
        a,b = relation.RelatingPort,relation.RelatedPort
        connections.append({'fromPort': a.GlobalId, 'toPort': b.GlobalId,
                            'fromAsset': owners.get(a.GlobalId), 'toAsset': owners.get(b.GlobalId)})
    gltf['buffers'] = [{'byteLength': len(binary)}]
    encoded = json.dumps(gltf,separators=(',',':')).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    binary += b'\0' * ((-len(binary)) % 4)
    total = 12 + 8 + len(encoded) + 8 + len(binary)
    destination.mkdir(parents=True,exist_ok=True)
    (destination/'duplex-mep.glb').write_bytes(struct.pack('<III',0x46546c67,2,total)+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
    manifest = {'schemaVersion':1, 'id':'duplex-mep', 'title':'Duplex MEP · public BIM benchmark', 'units':'metres',
        'source':'BSI (2020) "Duplex Apartment Test Files," buildingSMART International',
        'sourceUrl':'https://github.com/buildingsmart-community/Community-Sample-Test-Files/tree/7ddf57a201f88a0c213d5322b02ed15e94a60a40/IFC%202.3.0.1%20(IFC%202x3)/Duplex%20Apartment',
        'licence':'CC BY 4.0', 'licenceUrl':'https://creativecommons.org/licenses/by/4.0/',
        'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'ifcSchema':model.schema,
        'conversion':'IfcOpenShell 0.8.5 tessellation; metre units; Z-up to Y-up rotation; class-based display materials; no authored geometry.',
        'scope':'Public coordination benchmark, not a district-heating substation or customer site. No mapped telemetry or calibrated equipment physics.',
        'assets':assets, 'connections':connections, 'failed':failed,
        'quality':{'sourceRepresentations':len(products),'converted':len(assets),'failed':len(failed),'explicitPortConnections':len(connections)}}
    (destination/'duplex-mep.json').write_text(json.dumps(manifest,separators=(',',':'),default=str))
    print(json.dumps(manifest['quality']), flush=True)


def convert_network(source,destination):
    with zipfile.ZipFile(source) as archive:
        def rows(name): return list(csv.DictReader(io.StringIO(archive.read(name).decode('utf-8-sig'))))
        nodes=[{'id':r['node_id'],'supply':r['is_supply']=='True','position':[float(r['x']),float(r['z']),-float(r['y'])]} for r in rows('network/nodes.csv')]
        pipes=[{'id':r['pipe_id'],'from':r['inlet_node'],'to':r['outlet_node'],'supply':r['is_supply']=='True',
                'length':float(r['length']),'diameter':float(r['d_int']),'insulation':float(r['t_ins']),
                'roughnessMm':float(r['roughness'])} for r in rows('network/pipes.csv')]
        plants=rows('network/heating_stations.csv'); substations=rows('network/substations.csv')
        result={'id':'opendhn','title':'OpenDHN · Verbier network benchmark', 'nodes':nodes,'pipes':pipes,'plants':plants,'substations':substations,
            'source':'Roberto Boghetti and Jérôme Kämpf, OpenDHN data (2024); benchmark paper (2023)',
            'sourceUrl':'https://zenodo.org/records/10793816','licence':'CC BY 4.0','licenceUrl':'https://creativecommons.org/licenses/by/4.0/',
            'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'scope':'Anonymised Swiss benchmark, not Chinese field data. Source node layout is not surveyed 3D geometry; z values are zero. Source pipe lengths differ from displayed node-to-node chords. No elevations, valve inventory or live telemetry are supplied.',
            'conversion':'CSV graph to JSON; x/y plan coordinates rotated to Y-up. No topology or hydraulic properties invented.'}
        ids={n['id'] for n in nodes}
        if len(ids)!=len(nodes) or any(p['from'] not in ids or p['to'] not in ids for p in pipes): raise ValueError('Invalid network identities/connectivity')
        destination.mkdir(parents=True,exist_ok=True)
        (destination/'opendhn.json').write_text(json.dumps(result,separators=(',',':')))
        (destination/'opendhn-source-readme.md').write_bytes(archive.read('README.md'))
        print(json.dumps({'nodes':len(nodes),'pipes':len(pipes),'plants':plants,'substations':len(substations)}))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('kind',choices=['ifc','network']);parser.add_argument('source',type=Path);parser.add_argument('destination',type=Path)
    args=parser.parse_args()
    (convert_ifc if args.kind=='ifc' else convert_network)(args.source,args.destination)
