/** Local identity and ambient street life. Authored illustrative scenery, not
 * surveyed landmarks or additional simulator loads. No asset/actuator IDs. */
import * as T from "three";
type Materials = Record<string, T.MeshStandardMaterial>;
export const cityIdentity = {
  shanghai: {
    title: "Shanghai · river city",
    details: "Lujiazui-inspired skyline · shikumen lanes · plane trees",
    image: "/site-assets/shanghai-district-vision-v2.png",
  },
  yinchuan: {
    title: "Yinchuan · mountain and wetland city",
    details: "Helan-inspired ridgeline · Gulou pavilion · reed wetlands",
    image: "/site-assets/yinchuan-district-vision-v2.png",
  },
};
export function createCityAtmosphere(city: string, mats: Materials) {
  const shanghai = city === "shanghai",
    root = new T.Group();
  root.name = shanghai ? "Shanghai local identity" : "Yinchuan local identity";
  const box = new T.BoxGeometry(),
    sphere = new T.SphereGeometry(1, 20, 12);
  const batches = new Map<
    string,
    { geo: T.BufferGeometry; mat: T.Material; transforms: T.Matrix4[] }
  >();
  const helper = new T.Object3D();
  function put(
    geo: T.BufferGeometry,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry = 0,
  ) {
    helper.position.set(x, y, z);
    helper.scale.set(sx, sy, sz);
    helper.rotation.set(0, ry, 0);
    helper.updateMatrix();
    const key = geo.uuid + mat.uuid;
    if (!batches.has(key)) batches.set(key, { geo, mat, transforms: [] });
    batches.get(key)!.transforms.push(helper.matrix.clone());
  }
  const cube = (
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    ry = 0,
  ) => put(box, mat, x, y, z, w, h, d, ry);
  function add(geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0) {
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }
  const warmStone = new T.MeshStandardMaterial({
    color: shanghai ? "#bcc5c8" : "#c4a67e",
    roughness: 0.85,
  });
  const brick = new T.MeshStandardMaterial({
    color: "#7e453b",
    roughness: 0.88,
    map: mats.stone.map,
  });
  const roof = new T.MeshStandardMaterial({
    color: "#39464d",
    roughness: 0.8,
    map: mats.concrete.map,
    normalMap: mats.concrete.normalMap,
    normalScale: new T.Vector2(0.18, 0.18),
  });
  const lantern = new T.MeshStandardMaterial({
    color: "#e1a572",
    emissive: "#ffc37c",
    emissiveIntensity: 1.4,
    roughness: 0.6,
  });
  const glass = new T.MeshStandardMaterial({
    color: "#688b99",
    metalness: 0.66,
    roughness: 0.2,
  });
  const mountainMaterial = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
  });
  const reed = new T.MeshStandardMaterial({
    color: "#ae9664",
    roughness: 0.95,
    side: T.DoubleSide,
  });
  if (shanghai) {
    // A distant, compositionally placed riverfront: no georeferencing claimed.
    cube(mats.water, 0, 0.18, -460, 1200, 0.15, 105);
    cube(mats.pave, 0, 0.35, -404, 1200, 0.45, 7);
    cube(mats.trim, 0, 1, -407, 1200, 1.2, 0.6);
    for (let x = -530; x < 540; x += 18) {
      cube(mats.dark, x, 3.8, -403, 0.15, 7, 0.15);
      cube(lantern, x, 7.2, -403, 1.2, 0.14, 0.6);
    }
    // Shanghai Tower-inspired twisting taper. Ribs follow the actual curved
    // surface rather than stacking opaque rectangular placeholders.
    const rings = 45,
      sides = 32,
      vertices: number[] = [],
      indices: number[] = [];
    for (let j = 0; j <= rings; j++)
      for (let i = 0; i < sides; i++) {
        const t = j / rings,
          a = (i / sides) * Math.PI * 2 + t * 1.85;
        const r =
          21 * (1 - t * 0.56) * (1 + 0.1 * Math.sin((i / sides) * Math.PI * 6));
        vertices.push(Math.cos(a) * r, (j / rings) * 215, Math.sin(a) * r);
      }
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < sides; i++) {
        const a = j * sides + i,
          b = j * sides + ((i + 1) % sides);
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    const tower = new T.BufferGeometry();
    tower.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    tower.setIndex(indices);
    tower.computeVertexNormals();
    add(tower, glass, -70, 0, -620);
    for (let i = 0; i < sides; i += 2) {
      const pts = [];
      for (let j = 0; j <= rings; j++)
        pts.push(
          new T.Vector3(
            vertices[(j * sides + i) * 3] - 70,
            vertices[(j * sides + i) * 3 + 1],
            vertices[(j * sides + i) * 3 + 2] - 620,
          ),
        );
      add(
        new T.TubeGeometry(new T.CatmullRomCurve3(pts), 45, 0.18, 4, false),
        mats.frame,
      );
    }
    for (let j = 1; j < 42; j++) {
      const p = j / rings;
      const ring = new T.TorusGeometry(21 * (1 - p * 0.56), 0.13, 3, 32);
      const mesh = add(
        ring,
        j % 4 === 0 ? lantern : mats.frame,
        -70,
        p * 215,
        -620,
      );
      mesh.rotation.x = Math.PI / 2;
    }
    // World Financial Center-inspired open trapezoid crown.
    const outline = new T.Shape();
    outline.moveTo(-18, 0);
    outline.lineTo(18, 0);
    outline.lineTo(12, 175);
    outline.lineTo(-12, 175);
    outline.closePath();
    const opening = new T.Path();
    opening.moveTo(-9, 146);
    opening.lineTo(-8, 166);
    opening.lineTo(8, 166);
    opening.lineTo(9, 146);
    opening.closePath();
    outline.holes.push(opening);
    add(
      new T.ExtrudeGeometry(outline, { depth: 17, bevelEnabled: false }),
      glass,
      -143,
      0,
      -588,
    );
    for (let y = 6; y < 142; y += 4)
      cube(mats.frame, -143, y, -570.8, 34 - y * 0.065, 0.12, 0.18);
    // Oriental Pearl-inspired spheres and supporting pylons, distant scale.
    for (const dx of [-6, 0, 6])
      add(
        new T.CylinderGeometry(0.8, 1.6, 120, 12),
        mats.concrete,
        99 + dx,
        60,
        -577,
      );
    put(sphere, glass, 99, 54, -577, 14, 14, 14);
    put(sphere, mats.frame, 99, 113, -577, 9, 9, 9);
    add(new T.CylinderGeometry(0.35, 0.65, 44, 12), mats.frame, 99, 140, -577);
    for (const y of [44, 54, 64, 107, 114]) {
      const r = y < 80 ? Math.sqrt(Math.max(1, 196 - (y - 54) ** 2)) : 8;
      const ring = add(
        new T.TorusGeometry(r, 0.3, 4, 32),
        lantern,
        99,
        y,
        -577,
      );
      ring.rotation.x = Math.PI / 2;
    }
    // Shikumen-inspired residential lane block on the west of the active loads.
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 7; col++) {
        const x = -312 + col * 10,
          z = -48 + row * 24;
        cube(brick, x, 4.7, z, 8.8, 9, 15);
        for (const side of [-1, 1]) {
          const r = add(
            new T.PlaneGeometry(5.5, 16),
            roof,
            x + side * 2.3,
            10.1,
            z,
          );
          r.rotation.set(-Math.PI / 2, side * 0.52, 0);
          for (let f = 0; f < 2; f++)
            for (const dx of [-2.4, 2.4]) {
              cube(mats.dark, x + dx, 3.1 + f * 3, z + 7.55, 1.6, 2, 0.16);
              cube(
                (col + f) % 3 ? mats.window : lantern,
                x + dx,
                3.1 + f * 3,
                z + 7.65,
                1.3,
                1.7,
                0.1,
              );
            }
        }
        for (const dx of [-1.1, 1.1])
          cube(warmStone, x + dx, 1.6, z + 7.8, 0.45, 3.2, 0.5);
        cube(warmStone, x, 3.35, z + 7.8, 2.7, 0.45, 0.6);
        cube(mats.dark, x, 1.6, z + 7.75, 1.75, 3, 0.15);
      }
  } else {
    // Multi-layer sculpted Helan-inspired ridge; mountains are scenery only.
    for (let layer = 0; layer < 3; layer++) {
      const nx = 180,
        nz = 18,
        geo = new T.PlaneGeometry(2400, 300, nx, nz);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position,
        colours: number[] = [];
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          z = p.getZ(i),
          envelope = Math.sin(((z + 150) / 300) * Math.PI);
        const ridge =
          100 +
          42 * Math.sin(x * 0.008 + layer) +
          28 * Math.sin(x * 0.021 + 2) +
          22 * Math.abs(Math.sin(x * 0.053 + layer * 3)) +
          15 * Math.sin(x * 0.119) * Math.cos(x * 0.037 + z * 0.024);
        const height = Math.max(0, envelope * (ridge + layer * 16));
        p.setY(i, height);
        const col = new T.Color(
          height > 155
            ? "#ced8de"
            : layer === 2
              ? "#9aa9b5"
              : layer === 1
                ? "#8d9096"
                : "#a49380",
        );
        col.multiplyScalar(0.83 + 0.17 * Math.sin(x * 0.065 + z * 0.028));
        colours.push(col.r, col.g, col.b);
      }
      geo.setAttribute("color", new T.Float32BufferAttribute(colours, 3));
      geo.computeVertexNormals();
      add(geo, mountainMaterial, -90, 0, -730 - layer * 140);
    }
    // Gulou-inspired civic pavilion with a real arched opening and shaped roofs.
    const gate = new T.Shape();
    gate.moveTo(-12, 0);
    gate.lineTo(12, 0);
    gate.lineTo(12, 9);
    gate.lineTo(-12, 9);
    gate.closePath();
    const arch = new T.Path();
    arch.moveTo(-3, 0);
    arch.lineTo(-3, 4);
    arch.absarc(0, 4, 3, Math.PI, 0, true);
    arch.lineTo(3, 0);
    arch.closePath();
    gate.holes.push(arch);
    add(
      new T.ExtrudeGeometry(gate, { depth: 17, bevelEnabled: false }),
      warmStone,
      -211,
      0,
      -93,
    );
    for (let level = 0; level < 2; level++) {
      const y = 9 + level * 5,
        w = level ? 9 : 12;
      for (const x of [-w + 1, 0, w - 1])
        for (const z of [-6, 6])
          cube(brick, -211 + x, y + 1.8, -84 + z, 0.5, 3.6, 0.5);
      cube(brick, -211, y + 1.6, -84, w * 1.65, 3, 9);
      for (let n = -3; n <= 3; n++)
        cube(lantern, -211 + n * 2.1, y + 1.8, -77.9, 1.1, 1.7, 0.15);
      const pts: number[] = [],
        idx: number[] = [];
      for (let ring = 0; ring < 4; ring++)
        for (let side = 0; side < 4; side++) {
          const a = Math.PI / 4 + (side * Math.PI) / 2,
            radius = w * (1 - ring * 0.21);
          pts.push(
            Math.cos(a) * radius * 1.45,
            ring === 0 ? 0.4 : ring * 0.75,
            Math.sin(a) * radius,
          );
        }
      for (let ring = 0; ring < 3; ring++)
        for (let side = 0; side < 4; side++) {
          const a = ring * 4 + side,
            b = ring * 4 + ((side + 1) % 4);
          idx.push(a, b, a + 4, b, b + 4, a + 4);
        }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const roofMat = roof.clone();
      roofMat.side = T.DoubleSide;
      add(g, roofMat, -211, y + 3.6, -84);
      cube(mats.snow, -211, y + 5.9, -84, 9, 0.14, 0.35);
    }
    // Reed edge beside the existing water garden; no desert transplanted into town.
    for (let i = 0; i < 140; i++) {
      const x = 27 + (i % 70) * 1.03,
        z = i < 70 ? 113.5 : 140.5,
        h = 1.1 + (i % 9) * 0.09;
      cube(reed, x, h / 2, z, 0.045, h, 0.045);
      cube(reed, x, h, z, 0.14, 0.48, 0.12, 0.2);
    }
    for (let i = 0; i < 7; i++)
      cube(mats.snow, 35 + i * 8, 0.225, 117 + (i % 3) * 7, 7, 0.02, 4);
  }
  for (const batch of batches.values()) {
    const mesh = new T.InstancedMesh(
      batch.geo,
      batch.mat,
      batch.transforms.length,
    );
    batch.transforms.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  // Shared time uniform animates only reflected surface normals, not hydraulics.
  const waterTime = { value: 0 };
  mats.water.onBeforeCompile = (shader) => {
    shader.uniforms.cityTime = waterTime;
    shader.vertexShader =
      "varying vec3 cityWaterPosition;\n" +
      shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
      vec4 cp=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
      cp=instanceMatrix*cp;
      #endif
      cityWaterPosition=(modelMatrix*cp).xyz;`,
      );
    shader.fragmentShader =
      "uniform float cityTime; varying vec3 cityWaterPosition;\n" +
      shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
      normal=normalize(normal+vec3(sin(cityWaterPosition.x*.65+cityTime*.7)*.085,0.,cos(cityWaterPosition.z*.8-cityTime*.6)*.07));`,
      );
  };
  mats.water.customProgramCacheKey = () => "city-water-ripple-v1";
  // Walking residents use instanced articulated limbs; decorative, never agents.
  const people = new T.Group(),
    count = 18,
    personParts = [
      new T.InstancedMesh(
        new T.CapsuleGeometry(0.16, 0.48, 3, 6),
        mats.dark,
        count,
      ),
      new T.InstancedMesh(new T.SphereGeometry(0.14, 8, 6), warmStone, count),
      new T.InstancedMesh(
        new T.CylinderGeometry(0.055, 0.055, 0.65, 6),
        mats.dark,
        count * 2,
      ),
    ];
  personParts.forEach((m) => {
    m.castShadow = false;
    people.add(m);
  });
  root.add(people);
  function update(time: number, dusk: boolean) {
    waterTime.value = time;
    lantern.emissiveIntensity = dusk ? 1.8 : 0.3;
    for (let i = 0; i < count; i++) {
      const direction = i % 2 ? 1 : -1,
        x = i % 2 ? 11.2 : -11.2,
        z = -105 + ((((i * 17 + time * 0.8 * direction) % 245) + 245) % 245);
      helper.scale.set(1, 1, 1);
      helper.rotation.set(0, 0, 0);
      helper.position.set(x, 1.08, z);
      helper.updateMatrix();
      personParts[0].setMatrixAt(i, helper.matrix);
      helper.position.y = 1.62;
      helper.updateMatrix();
      personParts[1].setMatrixAt(i, helper.matrix);
      for (let side = 0; side < 2; side++) {
        helper.rotation.x = Math.sin(time * 4 + i + side * Math.PI) * 0.35;
        helper.position.set(x + (side ? -0.08 : 0.08), 0.43, z);
        helper.updateMatrix();
        personParts[2].setMatrixAt(i * 2 + side, helper.matrix);
      }
    }
    personParts.forEach((m) => (m.instanceMatrix.needsUpdate = true));
  }
  update(0, false);
  return {
    root,
    update,
    identity: shanghai ? cityIdentity.shanghai : cityIdentity.yinchuan,
  };
}
