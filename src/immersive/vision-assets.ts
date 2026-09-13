/** Authored winter-city art assets. All dimensions and placement are design geometry,
 * not survey data. Repeated architectural/mechanical components are GPU instanced. */
import * as T from "three";
import vision from "../../public/site-assets/vision-district.json";
export const districtPlan = vision.buildings.map((b) => ({
  id: b.id,
  x: b.centre[0],
  z: b.centre[1],
  floors: b.floors,
  width: 27,
  depth: 17,
}));
export const stationPosition = new T.Vector3(-83, 0, 118);
type Mat = T.MeshStandardMaterial;
type Batch = {
  geometry: T.BufferGeometry;
  material: Mat;
  matrices: T.Matrix4[];
  ids: string[];
};
class Builder {
  batches = new Map<string, Batch>();
  root = new T.Group();
  boxGeo = new T.BoxGeometry(1, 1, 1);
  cylinder = new T.CylinderGeometry(1, 1, 1, 16);
  sphere = new T.IcosahedronGeometry(1, 1);
  transform = new T.Object3D();
  pickables: T.InstancedMesh[] = [];
  put(
    g: T.BufferGeometry,
    m: Mat,
    pos: number[],
    scale: number[],
    id = "",
    rotation: T.Euler | undefined = undefined,
  ) {
    const key = g.uuid + m.uuid;
    let b = this.batches.get(key);
    if (!b) {
      b = { geometry: g, material: m, matrices: [], ids: [] };
      this.batches.set(key, b);
    }
    this.transform.position.set(pos[0], pos[1], pos[2]);
    this.transform.scale.set(scale[0], scale[1], scale[2]);
    this.transform.rotation.copy(rotation || new T.Euler());
    this.transform.updateMatrix();
    b.matrices.push(this.transform.matrix.clone());
    b.ids.push(id);
  }
  box(
    m: Mat,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    id = "",
    ry = 0,
  ) {
    this.put(this.boxGeo, m, [x, y, z], [w, h, d], id, new T.Euler(0, ry, 0));
  }
  cyl(m: Mat, a: number[], b: number[], radius: number, id = "") {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      q = new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        end.clone().sub(start).normalize(),
      );
    this.put(
      this.cylinder,
      m,
      start.add(end).multiplyScalar(0.5).toArray(),
      [radius, new T.Vector3(...a).distanceTo(new T.Vector3(...b)), radius],
      id,
      new T.Euler().setFromQuaternion(q),
    );
  }
  finish() {
    for (const b of this.batches.values()) {
      const mesh = new T.InstancedMesh(
        b.geometry,
        b.material,
        b.matrices.length,
      );
      b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.ids = b.ids;
      this.root.add(mesh);
      if (b.ids.some(Boolean)) this.pickables.push(mesh);
    }
    return this.root;
  }
}
function noiseTexture(base: string, kind: "stone" | "road" | "tile", seed = 5) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.fillStyle = base;
  c.fillRect(0, 0, 256, 256);
  let state = seed;
  const rnd = () =>
    ((state = (Math.imul(1664525, state) + 1013904223) | 0) >>> 0) / 4294967296;
  for (let i = 0; i < 16000; i++) {
    c.fillStyle = `rgba(${rnd() > 0.5 ? "255,255,255" : "0,0,0"},${rnd() * 0.13})`;
    c.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  if (kind === "tile") {
    c.strokeStyle = "#929da3";
    c.lineWidth = 1;
    for (let y = 0; y <= 256; y += 32) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(256, y);
      c.stroke();
      for (let x = y % 64 ? 16 : 0; x <= 256; x += 64) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + 32);
        c.stroke();
      }
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(kind === "road" ? 8 : 2, kind === "road" ? 8 : 2);
  texture.anisotropy = 8;
  return texture;
}
function material(colour: string, roughness = 0.75, metalness = 0) {
  return new T.MeshStandardMaterial({ color: colour, roughness, metalness });
}
export function worldMapped(m: Mat, metres: number) {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
    vec4 vp=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
      vp=instanceMatrix*vp;
    #endif
    vp=modelMatrix*vp;
    vec3 vn=abs(objectNormal);
    vec2 vu=vn.y>.5?vp.xz:vn.x>.5?vp.zy:vp.xy;
    #ifdef USE_MAP
      vMapUv=vu/${metres.toFixed(3)};
    #endif
    #ifdef USE_NORMALMAP
      vNormalMapUv=vu/${metres.toFixed(3)};
    #endif
    #ifdef USE_ROUGHNESSMAP
      vRoughnessMapUv=vu/${metres.toFixed(3)};
    #endif
  `,
    );
  };
  m.customProgramCacheKey = () => `world-material-${metres}`;
}
function pineCard() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  let seed = 4;
  const rnd = () =>
    ((seed = (Math.imul(1664525, seed) + 1013904223) | 0) >>> 0) / 4294967296;
  ctx.strokeStyle = "#6d6650";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, 128);
  ctx.lineTo(490, 125);
  ctx.stroke();
  for (let i = 0; i < 85; i++) {
    const x = 22 + i * 5.2,
      extent = (1 - i / 90) * 95;
    for (const side of [-1, 1])
      for (let j = 0; j < 14; j++) {
        const yy = 128 + (side * extent * j) / 15,
          xx = x + j * 3;
        ctx.strokeStyle =
          rnd() > 0.77 ? "#dce6dc" : rnd() > 0.5 ? "#485a3e" : "#263e32";
        ctx.lineWidth = 1.6 + rnd();
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx - 7 - rnd() * 12, yy + side * (7 + rnd() * 6));
        ctx.stroke();
      }
  }
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
export function createVisionDistrict(cityId = "yinchuan") {
  const shanghai = cityId === "shanghai";
  const b = new Builder(),
    plant = new Builder();
  const legacyFacades = new Builder(),
    districtBuilder = b;
  const treePlacements: {
    x: number;
    z: number;
    size: number;
    evergreen: boolean;
  }[] = [];
  plant.root.position.copy(stationPosition);
  const mats = {
    stone: material("#b7b4ab"),
    trim: material("#b9b8ae"),
    dark: material("#42494a"),
    snow: material("#edf3f3", 0.92),
    ground: material(shanghai ? "#45594b" : "#edf3f3", 0.92),
    road: material("#515b60", 0.95),
    pave: material("#b7b9b4"),
    glass: material("#425967", 0.18, 0.52),
    window: material("#293b44", 0.25, 0.48),
    frame: material("#9da4a2", 0.38, 0.5),
    bronze: material("#625d4e", 0.4, 0.65),
    warm: new T.MeshStandardMaterial({
      color: "#eac79a",
      emissive: "#ffc76b",
      emissiveIntensity: 0.35,
      roughness: 0.4,
    }),
    hedge: material("#374c3d"),
    leaf: material("#526347"),
    leaf2: material("#687255"),
    bark: material("#756754"),
    line: material("#d5d7ce"),
    yellow: material("#eac56c"),
    steel: material("#b9c9d3", 0.23, 0.92),
    blue: material("#174c8b", 0.35, 0.5),
    black: material("#27323a", 0.7, 0.15),
    concrete: material("#b5b5ab"),
    red: material("#a45540", 0.5, 0.4),
    water: material("#739aa6", 0.17, 0.25),
    car: material("#d9dddd", 0.28, 0.48),
    carDark: material("#364b58", 0.25, 0.5),
    tyre: material("#20272a"),
    copper: material("#f9a251", 0.3, 0.55),
  };
  // Snow coatings remain separate from roofing, structure and instrumentation.
  // Shanghai is an authored snow-free winter landscape, not surveyed geography.
  mats.snow.visible = !shanghai;
  if (shanghai) {
    mats.stone.color.set("#bbc4c8");
    mats.trim.color.set("#a9b9b8");
    mats.glass.color.set("#365e6b");
    mats.water.color.set("#386a72");
  }
  mats.stone.map = noiseTexture(shanghai ? "#b9c0be" : "#c5b99f", "stone");
  worldMapped(mats.stone, 4);
  const textures = Object.values(mats)
    .map((m) => m.map)
    .filter(Boolean) as T.Texture[];
  const loader = new T.TextureLoader();
  for (const [name, id, metres] of [
    ["road", "asphalt_02", 5],
    ["snow", "snow_02", 5],
    ["concrete", "concrete_wall_007", 3],
    ["pave", "concrete_pavement", 3],
  ] as const) {
    if (shanghai && name === "snow") continue;
    const m = mats[name];
    m.color.set("#ffffff");
    const load = (suffix: string, colour = false) => {
      const t = loader.load(`/vision-materials/${id}-${suffix}.jpg`);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 8;
      if (colour) t.colorSpace = T.SRGBColorSpace;
      textures.push(t);
      return t;
    };
    m.map = load("colour", true);
    m.normalMap = load("normal");
    m.normalScale.set(0.35, 0.35);
    m.roughnessMap = load("arm");
    worldMapped(m, metres);
  }
  if (shanghai) mats.road.roughness = 0.48;
  const foliageTexture = pineCard();
  textures.push(foliageTexture);
  const foliage = new T.MeshStandardMaterial({
      map: foliageTexture,
      alphaTest: 0.4,
      side: T.DoubleSide,
      roughness: 0.95,
      color: "#b4c6ad",
    }),
    cardGeometry = new T.PlaneGeometry(1, 1);
  b.box(shanghai ? mats.ground : mats.snow, 0, -0.5, -60, 850, 1, 900);
  b.box(mats.pave, 0, -0.04, 9, 257, 0.12, 234);
  // A legible hierarchy of avenues, local streets and pedestrian courtyards.
  for (const x of [-124, 0, 124]) {
    b.box(mats.road, x, 0.06, -60, x === 0 ? 18 : 16, 0.15, 590);
    for (const side of [-1, 1])
      b.box(
        mats.trim,
        x + side * (x === 0 ? 9.3 : 8.3),
        0.23,
        -60,
        0.3,
        0.3,
        590,
      );
    for (let z = -340; z < 220; z += 8) {
      b.box(mats.line, x - 4, 0.15, z, 0.16, 0.015, 3);
      b.box(mats.line, x + 4, 0.15, z, 0.16, 0.015, 3);
      b.box(mats.yellow, x, 0.15, z, 0.12, 0.015, 6.5);
    }
  }
  for (const z of [-312, -250, -188, -124, -96, -35, 25, 90, 145, 210]) {
    b.box(mats.road, 0, 0.08, z, 720, 0.18, 12);
    for (const side of [-1, 1])
      b.box(mats.trim, 0, 0.23, z + side * 6.3, 720, 0.3, 0.3);
    for (let x = -355; x < 360; x += 8)
      b.box(mats.line, x, 0.185, z, 4, 0.015, 0.14);
    for (const x of [-124, 0, 124])
      for (const side of [-1, 1])
        for (let j = -4; j <= 4; j++) {
          b.box(mats.line, x + side * 12, 0.19, z + j, 0.7, 0.015, 0.52);
          b.box(mats.line, x + j, 0.19, z + side * 9, 0.52, 0.015, 2.5);
        }
  }
  function architecture(
    x: number,
    z: number,
    floors: number,
    w: number,
    d: number,
    id = "",
    detail = true,
  ) {
    let b = id ? legacyFacades : districtBuilder;
    const h = floors * 3.3 + 1,
      base = 0.35;
    b.box(mats.stone, x, h / 2 + base, z, w, h, d, id);
    b.box(mats.dark, x, 1.25, z, w + 0.25, 2.1, d + 0.25, id);
    // Slab bands, piers and deep window/balcony recesses give geometry at grazing angles.
    for (const side of [-1, 1]) {
      for (let col = 0; col < 6; col++) {
        const xx = x + (col - 2.5) * 4.25,
          zz = z + side * (d / 2 + 0.08);
        b.box(mats.dark, xx, h / 2, zz, 3.1, h - 1, 0.22, id);
        for (let floor = 0; floor < floors; floor++) {
          const yy = 2.3 + floor * 3.3;
          b.box(
            Math.sin(x * 3.13 + floor * 11.7 + col * 5.91 + side * 2.1) > 0.46
              ? mats.warm
              : mats.glass,
            xx,
            yy,
            zz + side * 0.15,
            2.55,
            2.23,
            0.16,
            id,
          );
          b.box(mats.frame, xx, yy, zz + side * 0.25, 0.055, 2.25, 0.07, id);
          b.box(
            mats.frame,
            xx,
            yy + 0.3,
            zz + side * 0.25,
            2.55,
            0.05,
            0.07,
            id,
          );
          if (detail) {
            const balcony = col === 1 || col === 4,
              depth = balcony ? 1.45 : 0.43;
            b.box(
              mats.trim,
              xx,
              yy - 1.2,
              zz + side * (depth * 0.5),
              3.45,
              0.19,
              depth,
              id,
            );
            if (balcony) {
              b.box(
                mats.trim,
                xx - 1.65,
                yy - 0.15,
                zz + side * 0.6,
                0.18,
                2.35,
                1.4,
                id,
              );
              b.box(
                mats.trim,
                xx + 1.65,
                yy - 0.15,
                zz + side * 0.6,
                0.18,
                2.35,
                1.4,
                id,
              );
              b.box(
                mats.glass,
                xx,
                yy - 0.64,
                zz + side * 1.35,
                3.1,
                0.85,
                0.05,
                id,
              );
              b.box(
                mats.bronze,
                xx,
                yy - 0.2,
                zz + side * 1.4,
                3.2,
                0.055,
                0.06,
                id,
              );
              for (const offset of [-1.4, 0, 1.4])
                b.box(
                  mats.bronze,
                  xx + offset,
                  yy - 0.65,
                  zz + side * 1.4,
                  0.045,
                  0.9,
                  0.045,
                  id,
                );
            } else if ((col + floor) % 4 === 0) {
              b.box(
                mats.trim,
                xx + 1.4,
                yy - 0.62,
                zz + side * 0.5,
                0.55,
                0.62,
                0.7,
                id,
              );
              for (let j = 0; j < 4; j++)
                b.box(
                  mats.dark,
                  xx + 1.4,
                  yy - 0.82 + j * 0.11,
                  zz + side * 0.87,
                  0.44,
                  0.035,
                  0.02,
                  id,
                );
            }
          }
        }
      }
      for (let col = 0; col < 7; col++)
        b.box(
          mats.trim,
          x + (col - 3) * 4.25,
          h / 2 + 0.4,
          z + side * (d / 2 + 0.32),
          0.42,
          h,
          0.55,
          id,
        );
      for (let floor = 1; floor <= floors; floor++)
        b.box(
          mats.trim,
          x,
          0.55 + floor * 3.3,
          z + side * (d / 2 + 0.2),
          w + 0.55,
          0.17,
          0.75,
          id,
        );
    }
    // Side elevation windows and ashlar corners.
    for (const side of [-1, 1]) {
      for (let j = -1; j <= 1; j++)
        for (let floor = 0; floor < floors; floor++) {
          b.box(
            mats.window,
            x + side * (w / 2 + 0.05),
            2.2 + floor * 3.3,
            z + j * 4,
            0.14,
            2.05,
            1.9,
            id,
          );
          b.box(
            mats.trim,
            x + side * (w / 2 + 0.16),
            1.1 + floor * 3.3,
            z + j * 4,
            0.4,
            0.18,
            2.25,
            id,
          );
        }
      b.box(mats.trim, x + (side * w) / 2, h / 2, z - d / 2, 0.7, h, 0.8, id);
    }
    b = districtBuilder; // Existing roof equipment remains above the replacement facades.
    b.box(mats.snow, x, h + 0.43, z, w + 0.8, 0.28, d + 0.8, id);
    b.box(mats.dark, x, h + 0.62, z, w - 1, 0.18, d - 1, id);
    for (const side of [-1, 1]) {
      b.box(mats.trim, x + (side * w) / 2, h + 0.95, z, 0.4, 1, d + 0.6, id);
      b.box(
        mats.snow,
        x + (side * w) / 2,
        h + 1.48,
        z,
        0.55,
        0.13,
        d + 0.8,
        id,
      );
      b.box(mats.trim, x, h + 0.95, z + (side * d) / 2, w, 0.95, 0.4, id);
      b.box(
        mats.snow,
        x,
        h + 1.48,
        z + (side * d) / 2,
        w + 0.4,
        0.13,
        0.55,
        id,
      );
    }
    b.box(mats.trim, x - 5, h + 1.9, z, 5, 2.8, 6, id);
    b.box(mats.snow, x - 5, h + 3.38, z, 5.35, 0.17, 6.35, id);
    for (let j = 0; j < 3; j++) {
      b.box(mats.frame, x + 2 + j * 2.5, h + 1.15, z + 2, 1.8, 1, 2.5, id);
      b.cyl(
        mats.dark,
        [x + 2 + j * 2.5, h + 1.66, z + 2],
        [x + 2 + j * 2.5, h + 1.7, z + 2],
        0.58,
        id,
      );
      b.box(mats.snow, x + 2 + j * 2.5, h + 1.66, z + 1, 1.8, 0.07, 0.35, id);
    }
    b.box(mats.dark, x, 1.5, z + d / 2 + 0.3, 3.5, 2.7, 0.45, id);
    b.box(mats.warm, x, 1.4, z + d / 2 + 0.56, 2.5, 2.3, 0.05, id);
    b.box(mats.trim, x, 3, z + d / 2 + 1.3, 5, 0.3, 3, id);
    b.box(mats.snow, x, 3.2, z + d / 2 + 1.3, 5.1, 0.12, 3.1, id);
  }
  let seed = 32;
  const random = () =>
    ((seed = (Math.imul(1664525, seed) + 1013904223) | 0) >>> 0) / 4294967296;
  function tree(x: number, z: number, size = 1, evergreen = true) {
    // Deciduous streets and Shanghai vegetation now use imported textured meshes.
    if (shanghai || !evergreen) {
      treePlacements.push({ x, z, size, evergreen });
      return;
    }
    b.cyl(mats.bark, [x, 0.3, z], [x, 5.8 * size, z], 0.16 * size);
    if (shanghai && evergreen) {
      // Layered evergreen broadleaf crowns with visible branching, not snowy conifers.
      for (let j = 0; j < 9; j++) {
        const angle = j * 2.399,
          r = (j % 3) * 0.9 * size;
        const tip = [
          x + Math.cos(angle) * r,
          (5 + (j % 3) * 0.6) * size,
          z + Math.sin(angle) * r,
        ];
        b.cyl(mats.bark, [x, 3 * size, z], tip, 0.06 * size);
        b.put(b.sphere, j % 2 ? mats.leaf : mats.leaf2, tip, [
          1.7 * size,
          1.3 * size,
          1.6 * size,
        ]);
      }
      return;
    }
    if (evergreen) {
      for (let level = 0; level < 6; level++)
        for (let j = 0; j < 8; j++) {
          const angle = (j * Math.PI) / 4 + level * 0.61 + random() * 0.2,
            r = (3.2 - level * 0.42) * size,
            y = (2.1 + level * 0.72) * size;
          const xx = x + Math.cos(angle) * r * 0.43,
            zz = z + Math.sin(angle) * r * 0.43;
          b.put(
            cardGeometry,
            foliage,
            [xx, y, zz],
            [r * 1.6, r * 0.73, 1],
            "",
            new T.Euler(Math.PI / 2 - 0.14 - random() * 0.2, 0, -angle),
          );
        }
    } else {
      for (let j = 0; j < 7; j++) {
        const angle = j * 2.399,
          r = (1.7 + random()) * size,
          tip = [
            x + Math.cos(angle) * r,
            (5.3 + random() * 2) * size,
            z + Math.sin(angle) * r,
          ];
        b.cyl(mats.bark, [x, 3.2 * size, z], tip, 0.055 * size);
        b.cyl(
          mats.snow,
          [x, 3.25 * size, z],
          tip.map((v, k) => (k === 1 ? v + 0.07 : v)),
          0.025 * size,
        );
        for (let k = 0; k < 3; k++) {
          const a = angle + k * 0.8,
            top = [
              tip[0] + Math.cos(a) * size * 0.8,
              tip[1] + size * (0.3 + k * 0.2),
              tip[2] + Math.sin(a) * size * 0.8,
            ];
          b.cyl(mats.bark, tip, top, 0.022 * size);
        }
      }
    }
  }
  for (const building of districtPlan) {
    const { x, z, id, floors, width, depth } = building;
    b.box(shanghai ? mats.ground : mats.snow, x, 0.17, z, width + 17, 0.2, 43);
    b.box(mats.pave, x, 0.29, z + 13, width + 17, 0.1, 5);
    b.box(mats.pave, x, 0.3, z + 20, 3.5, 0.1, 16);
    architecture(x, z, floors, width, depth, id);
    for (const dx of [-20, 20])
      for (const dz of [-15, -5, 7, 18])
        tree(x + dx, z + dz, 1.05 + random() * 0.4, random() > 0.3);
    for (const dx of [-12, 12]) {
      b.box(mats.hedge, x + dx, 0.7, z + 17, 13, 0.9, 1.2);
      b.box(mats.snow, x + dx, 1.16, z + 17, 13.1, 0.13, 1.3);
      for (let j = 0; j < 3; j++)
        b.box(mats.bark, x + dx, 0.95, z + 13 + j * 0.15, 2, 0.12, 0.1);
      for (const s of [-0.8, 0.8])
        b.box(mats.dark, x + dx + s, 0.65, z + 13.2, 0.1, 0.6, 0.6);
    }
  }
  // Neighbourhood continues past the modelled loads; no empty "island on a grid".
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 9; col++) {
      const x = -260 + col * 62,
        z = -155 - row * 62;
      architecture(x, z, 9 + ((col * 3 + row * 2) % 10), 28, 19, "", false);
      b.box(mats.pave, x, 0.12, z + 20, 49, 0.1, 5);
      for (const dx of [-21, 21])
        tree(x + dx, z + 16, 1.25 + random() * 0.5, true);
    }
  for (const side of [-1, 1])
    for (let j = 0; j < 5; j++)
      architecture(
        side * (185 + (j % 2) * 50),
        -65 + j * 53,
        7 + (j % 4),
        25,
        18,
        "",
        false,
      );
  // Small urban water garden, edged with snow and walking paths.
  if (shanghai) {
    // Fictional river and embankment. Not a reconstruction of the Huangpu River.
    b.box(mats.water, 405, 0.05, -85, 105, 0.15, 800);
    for (const x of [349, 461]) {
      b.box(mats.pave, x, 0.23, -85, 7, 0.4, 800);
      b.box(mats.trim, x + (x < 400 ? 3 : -3), 0.75, -85, 0.35, 1, 800);
      for (let z = -400; z < 260; z += 22) tree(x - 5, z, 1.2, true);
    }
    for (let i = 0; i < 5; i++)
      architecture(-215 + i * 112, -395, 26 + (i % 3) * 7, 31, 24, "", false);
  }
  b.box(mats.pave, 65, 0.07, 127, 92, 0.12, 43);
  b.box(mats.water, 63, 0.16, 127, 76, 0.1, 27);
  for (let i = 0; i < 10; i++) tree(24 + i * 9, 149, 0.9, false);
  for (let i = 0; i < 9; i++) tree(-151, -105 + i * 28, 1.05, i % 3 !== 0);
  function lamp(x: number, z: number) {
    b.cyl(mats.dark, [x, 0.25, z], [x, 7, z], 0.055);
    b.cyl(mats.dark, [x, 7, z], [x + 2, 7, z], 0.045);
    b.box(mats.dark, x + 2, 7, z, 1, 0.13, 0.4);
    b.box(mats.warm, x + 2, 6.91, z, 0.8, 0.04, 0.3);
  }
  for (let z = -100; z < 145; z += 26)
    for (const x of [-135, -12, 12, 135]) lamp(x, z);
  for (let x = -110; x <= 110; x += 25) for (const z of [-105, 99]) lamp(x, z);
  // Low-poly vehicle bodies have actual glazing, lights, wheels and roof snow.
  const movingCars: T.Group[] = [];
  function car(x: number, z: number, rotation: number, bus = false) {
    const v = new Builder();
    const body = random() > 0.35 ? mats.car : mats.carDark;
    const length = bus ? 10 : 4.3,
      width = bus ? 2.5 : 1.8;
    v.box(body, 0, 0.78, 0, width, 0.65, length);
    v.box(
      bus ? body : mats.glass,
      0,
      bus ? 1.85 : 1.36,
      -0.18,
      width - 0.12,
      bus ? 1.7 : 0.7,
      length * 0.59,
    );
    v.box(
      mats.snow,
      0,
      bus ? 2.76 : 1.74,
      -0.18,
      width - 0.1,
      0.08,
      length * 0.56,
    );
    if (bus)
      for (let i = 0; i < 6; i++)
        for (const s of [-1, 1])
          v.box(mats.glass, s * 1.255, 2, -3.7 + i * 1.45, 0.04, 0.9, 1.1);
    for (const s of [-1, 1])
      for (const zz of [-length * 0.32, length * 0.32])
        v.cyl(
          mats.tyre,
          [s * (width / 2 - 0.1), 0.45, zz],
          [s * (width / 2 + 0.14), 0.45, zz],
          bus ? 0.48 : 0.34,
        );
    for (const s of [-1, 1]) {
      v.box(mats.warm, s * 0.58, 0.86, length / 2 + 0.02, 0.32, 0.14, 0.05);
      v.box(mats.red, s * 0.58, 0.85, -length / 2 - 0.02, 0.3, 0.12, 0.05);
    }
    const group = v.finish();
    // GTAO supplies live contact shading; avoid frozen vehicle shadows in the
    // cached district shadow map as the decorative traffic moves.
    group.traverse((object) => {
      if (object instanceof T.Mesh) object.castShadow = false;
    });
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    b.root.add(group);
    movingCars.push(group);
  }
  for (let i = 0; i < 24; i++) {
    const vertical = i % 2 === 0;
    car(
      vertical ? -4 + (i % 4) * 2.6 : -115 + i * 9,
      vertical ? -90 + i * 9 : [22, 28, 87, 93][i % 4],
      vertical ? (i % 4 ? 0 : Math.PI) : Math.PI / 2,
      i === 9 || i === 18,
    );
  }
  // Human-scale silhouettes and street furniture.
  for (let i = 0; i < 55; i++) {
    const x = i % 2 ? -11 : 11,
      z = -105 + random() * 235;
    b.cyl(i % 3 ? mats.dark : mats.bronze, [x, 0.5, z], [x, 1.35, z], 0.16);
    b.put(b.sphere, mats.bark, [x, 1.58, z], [0.14, 0.17, 0.14]);
    for (const side of [-1, 1])
      b.cyl(
        mats.dark,
        [x + side * 0.08, 0.08, z + side * 0.08],
        [x + side * 0.08, 0.7, z],
        0.055,
      );
  }
  // Detailed cutaway station in exactly the same world coordinates.
  let id = "ST01";
  const pb = (
    m: Mat,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ) => plant.box(m, x, y, z, w, h, d, id);
  pb(mats.concrete, 0, 0.25, 0, 34, 0.5, 23);
  pb(mats.pave, 0, 0.56, 0, 32, 0.12, 21);
  pb(mats.concrete, 0, 4, -11, 34, 8, 0.45);
  pb(mats.concrete, -17, 4, 0, 0.45, 8, 22);
  pb(mats.concrete, 17, 1.25, 0, 0.45, 2.5, 22);
  pb(mats.concrete, 0, 0.9, 11, 34, 1.8, 0.45);
  pb(mats.snow, 0, 8.1, -11, 34.3, 0.16, 0.65);
  pb(mats.snow, -17, 8.1, 0, 0.65, 0.16, 22);
  // Drained trench perimeter, visible individual grates.
  for (const z of [-8.9, 8.7]) {
    pb(mats.black, 0, 0.65, z, 30, 0.06, 0.8);
    for (let x = -14.8; x < 15; x += 0.32)
      pb(mats.steel, x, 0.7, z, 0.09, 0.05, 0.8);
  }
  for (const x of [-14, 14]) {
    pb(mats.black, x, 0.65, 0, 0.8, 0.06, 18);
    for (let z = -8.5; z < 9; z += 0.32)
      pb(mats.steel, x, 0.7, z, 0.8, 0.05, 0.09);
  }
  const pipeGeometries: T.BufferGeometry[] = [];
  function pipe(points: number[][], radius = 0.26, mat = mats.steel) {
    const path = new T.CurvePath<T.Vector3>(),
      v = points.map((p) => new T.Vector3(...p));
    let current = v[0];
    for (let i = 1; i < v.length - 1; i++) {
      const r = Math.min(
        radius * 2.6,
        v[i].distanceTo(v[i - 1]) * 0.45,
        v[i].distanceTo(v[i + 1]) * 0.45,
      );
      const before = v[i]
          .clone()
          .add(v[i - 1].clone().sub(v[i]).normalize().multiplyScalar(r)),
        after = v[i]
          .clone()
          .add(v[i + 1].clone().sub(v[i]).normalize().multiplyScalar(r));
      path.add(new T.LineCurve3(current, before));
      path.add(new T.QuadraticBezierCurve3(before, v[i], after));
      current = after;
    }
    path.add(new T.LineCurve3(current, v[v.length - 1]));
    const geo = new T.TubeGeometry(
      path,
      Math.max(24, points.length * 14),
      radius,
      16,
      false,
    );
    pipeGeometries.push(geo);
    const mesh = new T.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.assetId = id;
    plant.root.add(mesh);
  }
  function flange(
    x: number,
    y: number,
    z: number,
    axis: "x" | "z" | "y" = "x",
    r = 0.37,
  ) {
    const at = (offset: number) => [
      x + (axis === "x" ? offset : 0),
      y + (axis === "y" ? offset : 0),
      z + (axis === "z" ? offset : 0),
    ];
    plant.cyl(mats.steel, at(-0.09), at(0.09), r, id);
    plant.cyl(mats.black, at(-0.015), at(0.015), r + 0.01, id);
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4,
        dx = Math.cos(a) * r * 0.81,
        dy = Math.sin(a) * r * 0.81;
      const a0 = at(-0.14),
        a1 = at(0.14);
      for (const ar of [a0, a1]) {
        if (axis === "x") {
          ar[1] += dx;
          ar[2] += dy;
        } else if (axis === "z") {
          ar[0] += dx;
          ar[1] += dy;
        } else {
          ar[0] += dx;
          ar[2] += dy;
        }
      }
      plant.cyl(mats.steel, a0, a1, 0.045, id);
    }
  }
  function gauge(x: number, y: number, z: number) {
    plant.cyl(mats.steel, [x, y - 0.55, z], [x, y, z], 0.045, id);
    plant.cyl(mats.black, [x, y, z - 0.07], [x, y, z + 0.07], 0.19, id);
    plant.cyl(mats.trim, [x, y, z + 0.075], [x, y, z + 0.09], 0.16, id);
    plant.cyl(
      mats.dark,
      [x, y, z + 0.1],
      [x + 0.09, y + 0.07, z + 0.1],
      0.012,
      id,
    );
  }
  function valve(x: number, y: number, z: number) {
    plant.cyl(mats.blue, [x - 0.3, y, z], [x + 0.3, y, z], 0.34, id);
    flange(x - 0.36, y, z);
    flange(x + 0.36, y, z);
    plant.cyl(mats.steel, [x, y, z], [x, y + 0.8, z], 0.055, id);
    const torus = new T.TorusGeometry(0.32, 0.034, 8, 24);
    pipeGeometries.push(torus);
    const mesh = new T.Mesh(torus, mats.black);
    mesh.position.set(x, y + 0.82, z);
    mesh.rotation.x = Math.PI / 2;
    mesh.userData.assetId = id;
    plant.root.add(mesh);
    for (const angle of [0, Math.PI / 2])
      plant.cyl(
        mats.black,
        [x - Math.cos(angle) * 0.3, y + 0.82, z - Math.sin(angle) * 0.3],
        [x + Math.cos(angle) * 0.3, y + 0.82, z + Math.sin(angle) * 0.3],
        0.023,
        id,
      );
  }
  for (const x of [-9, -1]) {
    id = x === -9 ? "HX-A" : "HX-B";
    pb(mats.concrete, x, 1, -4, 4.8, 0.65, 5.7);
    // Individually modelled stainless plates compressed between blue end frames.
    for (let j = 0; j < 42; j++)
      pb(
        j % 2 ? mats.steel : mats.black,
        x,
        3.65,
        -5.9 + j * 0.095,
        3.1,
        4.65,
        0.045,
      );
    for (const z of [-6.2, -1.85]) {
      pb(mats.blue, x, 3.65, z, 3.7, 5, 0.24);
      pb(mats.blue, x, 1.13, z, 4.3, 0.3, 0.9);
      for (const dx of [-1.48, 1.48])
        for (const yy of [1.75, 3.3, 5.15]) {
          plant.cyl(
            mats.steel,
            [x + dx, yy, -6.5],
            [x + dx, yy, -1.5],
            0.065,
            id,
          );
          plant.cyl(
            mats.steel,
            [x + dx, yy, z - 0.2],
            [x + dx, yy, z + 0.2],
            0.12,
            id,
          );
        }
    }
    for (const dx of [-1.03, 1.03])
      for (const yy of [2, 5.2]) {
        pipe(
          [
            [x + dx, yy, -1.7],
            [x + dx, yy, -0.8],
            [x + dx + 1.6, yy, -0.8],
          ],
          0.23,
        );
        flange(x + dx, yy, -1.5, "z", 0.36);
      }
    pb(mats.steel, x, 6.5, -4, 0.14, 0.15, 6.3);
    pipe(
      [
        [x - 1, 5.2, -6.2],
        [x - 1, 5.2, -8],
        [x - 1, 6.6, -8],
        [12, 6.6, -8],
      ],
      0.32,
    );
    pipe(
      [
        [x + 1, 2, -6.2],
        [x + 1, 2, -7.1],
        [x + 1, 4.7, -7.1],
        [12, 4.7, -7.1],
      ],
      0.26,
    );
  }
  const equipment = [
    {
      id: "HX-A",
      name: "Plate heat exchanger A",
      point: new T.Vector3(-9, 6, -3),
    },
    {
      id: "HX-B",
      name: "Plate heat exchanger B",
      point: new T.Vector3(-1, 6, -3),
    },
    {
      id: "P-01",
      name: "Circulation pump 01",
      point: new T.Vector3(-8, 3.7, 4.6),
    },
    {
      id: "P-02",
      name: "Circulation pump 02",
      point: new T.Vector3(-1, 3.7, 4.6),
    },
    { id: "P-03", name: "Standby pump 03", point: new T.Vector3(6, 3.7, 4.6) },
    {
      id: "MCC",
      name: "Motor control centre",
      point: new T.Vector3(10, 5, -8.4),
    },
  ];
  for (const x of [-8, -1, 6]) {
    id = x === -8 ? "P-01" : x === -1 ? "P-02" : "P-03";
    pb(mats.concrete, x, 1, 4.4, 4.6, 0.7, 5.9);
    pb(mats.blue, x, 1.42, 4.4, 3.9, 0.18, 5.35);
    for (const zz of [2.1, 6.55])
      for (const dx of [-1.5, 1.5]) {
        plant.cyl(mats.steel, [x + dx, 1.35, zz], [x + dx, 1.6, zz], 0.07, id);
      }
    plant.cyl(mats.blue, [x, 2.5, 3.9], [x, 2.5, 6.6], 1.04, id);
    for (let j = 0; j < 32; j++) {
      const a = (j * Math.PI) / 16;
      pb(
        mats.blue,
        x + Math.cos(a) * 1.01,
        2.5 + Math.sin(a) * 1.01,
        5.2,
        0.09,
        0.09,
        2.35,
      );
    }
    plant.cyl(mats.dark, [x, 2.5, 6.62], [x, 2.5, 6.67], 0.94, id);
    for (let j = -7; j <= 7; j++)
      pb(
        mats.blue,
        x + j * 0.115,
        2.5,
        6.72,
        0.035,
        Math.sqrt(Math.max(0, 0.85 ** 2 - (j * 0.115) ** 2)) * 2,
        0.05,
      );
    pb(mats.blue, x, 3.58, 5.2, 1.05, 0.52, 0.9);
    plant.cyl(mats.yellow, [x, 2.5, 3], [x, 2.5, 3.9], 0.51, id);
    for (let j = 0; j < 8; j++)
      pb(mats.black, x - 0.4 + j * 0.11, 2.95, 3.5, 0.025, 0.025, 0.7);
    plant.cyl(mats.blue, [x, 2.5, 1.6], [x, 2.5, 3], 0.83, id);
    pipe(
      [
        [x, 2.5, 1.6],
        [x, 2.5, 0.6],
        [x, 5.2, 0.6],
      ],
      0.3,
    );
    flange(x, 3.8, 0.6, "y", 0.45);
    gauge(x + 0.5, 4, 0.6);
    pipe(
      [
        [x, 2.5, 2.2],
        [x - 1.6, 2.5, 2.2],
        [x - 1.6, 1.5, 2.2],
        [x - 1.6, 1.5, 7.5],
        [12, 1.5, 7.5],
      ],
      0.27,
    );
    pipe(
      [
        [x, 5.2, 0.6],
        [12, 5.2, 0.6],
      ],
      0.35,
    );
    valve(x + 2, 5.2, 0.6);
  }
  for (const [y, z] of [
    [6.6, -8],
    [4.7, -7.1],
    [5.2, 0.6],
    [1.5, 7.5],
  ]) {
    id = "ST01";
    pipe(
      [
        [12, y, z],
        [14.3, y, z],
        [14.3, y, 9.8],
        [17.5, y, 9.8],
      ],
      0.32,
    );
    flange(13, y, z, "x", 0.47);
    valve(15.7, y, 9.8);
    gauge(12.5, y + 0.85, z);
    for (const x of [-12, -4, 4, 12]) {
      plant.cyl(mats.dark, [x, 0.7, z], [x, y - 0.4, z], 0.055, id);
      pb(mats.steel, x, y - 0.34, z, 1, 0.11, 0.85);
    }
  }
  for (let i = 0; i < 4; i++) {
    id = "MCC";
    const x = 5 + i * 2.55;
    pb(mats.frame, x, 3.12, -9.55, 2.35, 4.9, 1.15);
    pb(mats.trim, x, 3.1, -8.95, 2.17, 4.65, 0.08);
    pb(mats.black, x, 4.25, -8.89, 0.72, 0.5, 0.06);
    pb(mats.blue, x, 4.25, -8.85, 0.52, 0.32, 0.015);
    pb(mats.dark, x + 0.78, 2.9, -8.83, 0.065, 0.42, 0.09);
    for (let j = 0; j < 3; j++) {
      plant.cyl(
        j === 0 ? mats.hedge : mats.red,
        [x - 0.55 + j * 0.3, 3.67, -8.9],
        [x - 0.55 + j * 0.3, 3.67, -8.8],
        0.065,
        id,
      );
    }
    for (let j = 0; j < 8; j++)
      pb(mats.dark, x, 1.35 + j * 0.09, -8.87, 1.7, 0.025, 0.02);
  }
  for (const z of [-10.5, -0.9]) {
    id = "ST01";
    pb(mats.dark, 0, 7.4, z, 32, 0.13, 0.65);
    for (let x = -15.5; x < 16; x += 0.4)
      pb(mats.steel, x, 7.48, z, 0.055, 0.04, 0.68);
    for (let j = 0; j < 4; j++)
      plant.cyl(
        mats.black,
        [-16, 7.58, z - 0.2 + j * 0.12],
        [16, 7.58, z - 0.2 + j * 0.12],
        0.038,
        id,
      );
  }
  for (const x of [-12, -4, 4, 12]) {
    pb(mats.dark, x, 7.3, -10.63, 2, 0.2, 0.25);
    pb(mats.warm, x, 7.18, -10.52, 1.8, 0.06, 0.2);
  }
  // Secondary supply/return physically meet the district overlay at the west wall.
  pipe(
    [
      [-8, 5.2, 0.6],
      [-12.7, 5.2, 0.6],
      [-12.7, 1, 0],
      [-18, 1, 0],
    ],
    0.3,
  );
  pipe(
    [
      [-9.6, 1.5, 7.5],
      [-13.7, 1.5, 7.5],
      [-13.7, 1, 1.2],
      [-18, 1, 1.2],
    ],
    0.3,
  );
  // Entrance pads and landscaping frame the open-cut station rather than a floating prop.
  b.box(mats.pave, stationPosition.x, 0.2, stationPosition.z, 42, 0.15, 29);
  for (let i = 0; i < 5; i++)
    tree(stationPosition.x - 24, 99 + i * 8, 0.8, true);
  const root = b.finish();
  root.add(legacyFacades.finish());
  root.add(plant.finish());
  return {
    root,
    legacyFacades: legacyFacades.root,
    treePlacements,
    plant: plant.root,
    materials: mats,
    textures,
    pipeGeometries,
    pickables: [...b.pickables, ...plant.pickables],
    equipment,
    movingCars,
    stats: {
      buildings: districtPlan.length,
      contextBuildings: 37,
      instances: [...b.batches.values(), ...plant.batches.values()].reduce(
        (n, v) => n + v.matrices.length,
        0,
      ),
    },
  };
}
