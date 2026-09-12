/** Real public CC0 meshes, prepared in Blender, then GPU-instanced here.
 * Geometry is an art-directed demonstrator, never an as-built survey. */
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { districtPlan, worldMapped } from "./vision-assets";

export function loadProfessionalAssets(
  city: string,
  trees: { x: number; z: number; size: number; evergreen: boolean }[],
) {
  const root = new T.Group();
  root.name = "Professional CC0 district assets";
  const pickables: T.InstancedMesh[] = [];
  const resources: T.Object3D[] = [root];
  const textures = new Set<T.Texture>(),
    materials = new Set<T.Material>(),
    geometries = new Set<T.BufferGeometry>();
  let disposed = false;
  const lightingMaterials: T.MeshStandardMaterial[] = [];
  function track(object: T.Object3D) {
    object.traverse((o) => {
      if (o instanceof T.Mesh) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          materials.add(m);
          Object.values(m).forEach((v) => {
            if (v instanceof T.Texture) textures.add(v);
          });
        }
      }
    });
  }
  async function load(name: string) {
    const manager = new T.LoadingManager();
    let failed = false;
    manager.onError = () => {
      failed = true;
    };
    const loader = new GLTFLoader(manager);
    const gltf = await loader.loadAsync(`/visual-models/${name}.glb`);
    resources.push(gltf.scene);
    track(gltf.scene);
    if (disposed) {
      dispose();
      throw Error("Scene disposed");
    }
    if (failed) throw Error("An embedded asset texture failed to load");
    gltf.scene.updateMatrixWorld(true);
    return gltf.scene;
  }
  const helper = new T.Object3D();
  const batches = new Map<
    string,
    {
      geometry: T.BufferGeometry;
      material: T.Material;
      matrices: T.Matrix4[];
      ids: string[];
    }
  >();
  function instances(
    g: T.BufferGeometry,
    m: T.Material,
    transforms: T.Matrix4[],
    ids: string[],
  ) {
    if (!transforms.length) return;
    const mesh = new T.InstancedMesh(g, m, transforms.length);
    transforms.forEach((t, i) => mesh.setMatrixAt(i, t));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.ids = ids;
    mesh.computeBoundingSphere();
    root.add(mesh);
    track(mesh);
    if (ids.some(Boolean)) pickables.push(mesh);
  }
  const facadeReady = load("apartment-facade-kit").then(async (kit) => {
    const stoneLoader = new T.TextureLoader();
    const [stoneMap, normalMap, roughMap] = await Promise.all(
      ["colour", "normal", "arm"].map((s) =>
        stoneLoader.loadAsync(`/vision-materials/concrete_wall_007-${s}.jpg`),
      ),
    );
    stoneMap.colorSpace = T.SRGBColorSpace;
    for (const t of [stoneMap, normalMap, roughMap]) {
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.anisotropy = 8;
      textures.add(t);
    }
    if (disposed) {
      dispose();
      return;
    }
    const source = new Map<
      string,
      { geometry: T.BufferGeometry; material: T.MeshStandardMaterial }[]
    >();
    for (const name of [
      "wall_window_centered_large_01",
      "wall_window_centered_large_02",
      "wall_window_centered_large_03",
      "window_centered_large_01",
      "window_centered_large_02",
      "window_centered_large_03",
      "cornice_standard_standard_01",
      "crown_standard_standard_01",
    ]) {
      const node = kit.getObjectByName(name);
      if (!node) throw Error(`Missing facade module: ${name}`);
      const parts: {
        geometry: T.BufferGeometry;
        material: T.MeshStandardMaterial;
      }[] = [];
      node.traverse((o) => {
        if (o instanceof T.Mesh) {
          const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
          const m = o.material as T.MeshStandardMaterial;
          // Non-path-traced glass must remain opaque for predictable depth sorting.
          if (m.name.includes("glass")) {
            m.transparent = false;
            m.opacity = 1;
            m.metalness = 0.5;
            m.roughness = 0.22;
            m.color.set("#637d88");
          }
          if (m.name.includes("plaster")) {
            m.map = stoneMap;
            m.normalMap = normalMap;
            m.roughnessMap = roughMap;
            m.normalScale.set(0.18, 0.18);
            m.color.set(
              city === "beijing"
                ? "#bcc0bd"
                : city === "shanghai"
                  ? "#d5dad6"
                  : "#ddcfb8",
            );
            worldMapped(m, 3);
            m.needsUpdate = true;
          }
          parts.push({ geometry: g, material: m });
          geometries.add(g);
        }
      });
      source.set(name, parts);
    }
    function module(
      name: string,
      x: number,
      y: number,
      z: number,
      angle: number,
      sx: number,
      id: string,
    ) {
      helper.position.set(x, y, z);
      helper.rotation.set(0, angle, 0);
      helper.scale.set(sx, 1.1, 1);
      helper.updateMatrix();
      const matrix = helper.matrix
        .clone()
        .multiply(new T.Matrix4().makeTranslation(1.5, 0, 0));
      for (const p of source.get(name)!) {
        const key = p.geometry.uuid + p.material.uuid;
        if (!batches.has(key))
          batches.set(key, { ...p, matrices: [], ids: [] });
        const b = batches.get(key)!;
        b.matrices.push(matrix);
        b.ids.push(id);
      }
    }
    const roomMat = new T.MeshStandardMaterial({
      color: "#6c6660",
      roughness: 1,
    });
    materials.add(roomMat);
    const roomGeometry = new T.BoxGeometry();
    geometries.add(roomGeometry);
    const roomMatrices: T.Matrix4[] = [],
      roomIds: string[] = [];
    const balconyMat = new T.MeshStandardMaterial({
      color: "#bcc3bf",
      roughness: 0.65,
    });
    const railMat = new T.MeshStandardMaterial({
      color: "#647679",
      metalness: 0.65,
      roughness: 0.3,
    });
    const balconies: T.Matrix4[] = [],
      rails: T.Matrix4[] = [],
      balconyIds: string[] = [],
      railIds: string[] = [];
    function balconyPart(
      list: T.Matrix4[],
      ids: string[],
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      id: string,
    ) {
      helper.position.set(x, y, z);
      helper.rotation.set(0, 0, 0);
      helper.scale.set(w, h, d);
      helper.updateMatrix();
      list.push(helper.matrix.clone());
      ids.push(id);
    }
    for (const [index, b] of districtPlan.entries()) {
      for (let side = 0; side < 4; side++) {
        const width = side % 2 ? b.depth : b.width,
          count = side % 2 ? 4 : 6,
          angle = (side * Math.PI) / 2;
        for (let floor = 0; floor < b.floors; floor++)
          for (let col = 0; col < count; col++) {
            const u = -width / 2 + ((col + 0.5) * width) / count;
            const x =
              b.x +
              (side === 0
                ? u
                : side === 1
                  ? b.width / 2
                  : side === 2
                    ? -u
                    : -b.width / 2);
            const z =
              b.z +
              (side === 0
                ? b.depth / 2
                : side === 1
                  ? -u
                  : side === 2
                    ? -b.depth / 2
                    : u);
            const y = 0.35 + floor * 3.3,
              variant = String(1 + ((col + index + floor) % 3)).padStart(
                2,
                "0",
              );
            module(
              "wall_window_centered_large_" + variant,
              x,
              y,
              z,
              angle,
              width / count / 3,
              b.id,
            );
            module(
              "window_centered_large_" + variant,
              x,
              y,
              z,
              angle,
              width / count / 3,
              b.id,
            );
            module(
              "cornice_standard_standard_01",
              x,
              y + 3.05,
              z,
              angle,
              width / count / 3,
              b.id,
            );
            // Room-backed windows: depth behind glazing instead of an opaque outer box.
            helper.position.set(
              x - Math.sin(angle) * 1.25,
              y + 1.55,
              z - Math.cos(angle) * 1.25,
            );
            helper.rotation.set(0, angle, 0);
            helper.scale.set(width / count - 0.06, 3.1, 1.6);
            helper.updateMatrix();
            roomMatrices.push(helper.matrix.clone());
            roomIds.push(b.id);
            if (side === 0 && (col === 1 || col === 4)) {
              balconyPart(
                balconies,
                balconyIds,
                x,
                y + 0.15,
                z + 0.9,
                3.5,
                0.17,
                1.9,
                b.id,
              );
              balconyPart(
                rails,
                railIds,
                x,
                y + 1.16,
                z + 1.8,
                3.5,
                0.055,
                0.055,
                b.id,
              );
              for (let k = -3; k <= 3; k++)
                balconyPart(
                  rails,
                  railIds,
                  x + k * 0.55,
                  y + 0.7,
                  z + 1.8,
                  0.035,
                  0.9,
                  0.035,
                  b.id,
                );
              for (const s of [-1, 1])
                balconyPart(
                  rails,
                  railIds,
                  x + s * 1.72,
                  y + 1.16,
                  z + 0.9,
                  0.045,
                  0.045,
                  1.8,
                  b.id,
                );
            }
          }
        for (let col = 0; col < count; col++) {
          const u = -width / 2 + ((col + 0.5) * width) / count;
          module(
            "crown_standard_standard_01",
            b.x +
              (side === 0
                ? u
                : side === 1
                  ? b.width / 2
                  : side === 2
                    ? -u
                    : -b.width / 2),
            b.floors * 3.3 + 0.35,
            b.z +
              (side === 0
                ? b.depth / 2
                : side === 1
                  ? -u
                  : side === 2
                    ? -b.depth / 2
                    : u),
            angle,
            width / count / 3,
            b.id,
          );
        }
      }
    }
    for (const batch of batches.values())
      instances(batch.geometry, batch.material, batch.matrices, batch.ids);
    instances(roomGeometry, roomMat, roomMatrices, roomIds);
    instances(roomGeometry, balconyMat, balconies, balconyIds);
    instances(roomGeometry, railMat, rails, railIds);
    // Source glass geometry gets deterministic, subdued occupied-window variation.
    for (const child of root.children)
      if (
        child instanceof T.InstancedMesh &&
        (child.material as T.Material).name.includes("glass")
      ) {
        const mat = (child.material as T.MeshStandardMaterial).clone();
        mat.emissive.set("#d99950");
        mat.emissiveIntensity = 0.15;
        mat.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
          #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
            totalEmissiveRadiance *= step(0.45, vColor.r);
          #endif`,
          );
        };
        mat.customProgramCacheKey = () => "occupied-glass-v1";
        child.material = mat;
        lightingMaterials.push(mat);
        materials.add(mat);
        for (let i = 0; i < child.count; i++)
          child.setColorAt(i, new T.Color(i % 7 < 2 ? "#f4c38d" : "#526674"));
      }
  });
  const vegetationReady = Promise.all([
    load("tree-winter"),
    load("tree-summer"),
    load("shrub"),
  ]).then(([winter, summer, shrub]) => {
    for (const [n, asset] of [winter, summer, shrub].entries()) {
      const bounds = new T.Box3().setFromObject(asset),
        height = bounds.max.y - bounds.min.y;
      const positions =
        n === 2
          ? districtPlan.flatMap((b) =>
              [-1, 1].flatMap((s) =>
                Array.from({ length: 7 }, (_, i) => ({
                  x: b.x + s * 17,
                  z: b.z - 10 + i * 3.5,
                  size: 1,
                  evergreen: true,
                })),
              ),
            )
          : trees.filter((_, i) =>
              n === 1
                ? city === "shanghai" && i % 8 === 0
                : city !== "shanghai" || i % 8 !== 0,
            );
      const transforms = positions.map((p, i) => {
        const scale = ((n === 2 ? 1.2 : 7.5) * p.size) / height;
        helper.position.set(p.x, 0.2 - bounds.min.y * scale, p.z);
        helper.rotation.set(0, i * 2.399, 0);
        helper.scale.setScalar(scale);
        helper.updateMatrix();
        return helper.matrix.clone();
      });
      asset.traverse((o) => {
        if (o instanceof T.Mesh) {
          const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
          geometries.add(g);
          const m = o.material as T.MeshStandardMaterial;
          m.side = T.DoubleSide;
          m.alphaTest = 0.45;
          m.transparent = false;
          instances(
            g,
            m,
            transforms,
            positions.map(() => ""),
          );
        }
      });
    }
  });
  function dispose() {
    disposed = true;
    resources.forEach(track);
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
    geometries.forEach((g) => g.dispose());
    root.clear();
  }
  return {
    root,
    pickables,
    facadeReady,
    vegetationReady,
    dispose,
    update(dusk: boolean) {
      lightingMaterials.forEach(
        (m) => (m.emissiveIntensity = dusk ? 0.3 : 0.03),
      );
    },
  };
}
