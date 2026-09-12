import { useEffect, useRef, useState } from "react";
import { tx, useLocale } from "../localisation";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { substationId } from "./model";
import type {
  Asset,
  BimModel,
  Measurement,
  Network,
  Pose,
  Vec3,
} from "./model";

type Props = {
  dark?: boolean;
  mode: "bim" | "network";
  bim: BimModel | null;
  network: Network | null;
  localGlb: ArrayBuffer | null;
  selected: string;
  kind: string;
  hidden: string[];
  isolated: string | null;
  highlight: string[];
  removed: string[];
  clipAxis: "none" | "x" | "y" | "z";
  clipPercent: number;
  measure: boolean;
  command: {
    id: number;
    type: "fit" | "top" | "focus" | "restore";
    pose?: Pose;
  };
  onSelect: (id: string) => void;
  onMeasure: (m: Measurement) => void;
  onPose: (p: Pose) => void;
  onLocalAssets: (assets: Asset[]) => void;
};
function dispose(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      geometries.add(object.geometry);
      for (const m of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materials.add(m);
        for (const v of Object.values(m))
          if (v instanceof THREE.Texture) textures.add(v);
      }
    }
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  for (const t of textures) t.dispose();
}
export default function EngineeringScene(props: Props) {
  const locale = useLocale();
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    runtime = useRef<{
      update: () => void;
      command: () => void;
      resetMeasure: () => void;
    } | null>(null);
  latest.current = props;
  const [status, setStatus] = useState("Loading engineering geometry…"),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    host.current?.querySelector("canvas")?.setAttribute(
      "aria-label",
      tx("Orbitable engineering model. Drag to orbit, right-drag to pan, scroll to zoom. Arrow keys orbit, plus/minus zoom, Home fits the model."),
    );
  }, [locale, status]);
  useEffect(() => {
    if (
      (props.mode === "bim" && !props.bim && !props.localGlb) ||
      (props.mode === "network" && !props.network)
    )
      return;
    const el = host.current!;
    let dead = false,
      frame = 0,
      renderer: THREE.WebGLRenderer;
    setFailed(false);
    setStatus("Loading engineering geometry…");
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailed(true);
      setStatus(
        "WebGL is unavailable. The asset register and analysis remain accessible.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(props.dark ? 0x0b1422 : 0xe9edf2);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.localClippingEnabled = true;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Orbitable engineering model. Drag to orbit, right-drag to pan, scroll to zoom. Arrow keys orbit, plus/minus zoom, Home fits the model.",
    );
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      root = new THREE.Group(),
      tools = new THREE.Group();
    scene.add(root, tools);
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment(),
      environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.3;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x667b93, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(20, 35, 15);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 20000);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.09;
    orbit.screenSpacePanning = true;
    orbit.maxPolarAngle = Math.PI;
    const objects: THREE.Mesh[] = [],
      originals = new Map<
        THREE.Mesh,
        { colour: THREE.Color; opacity: number }
      >();
    const replacedMaterials = new Set<THREE.Material>();
    let bounds = new THREE.Box3(),
      span = 10,
      measureStart: THREE.Vector3 | null = null,
      selectionBox: THREE.Box3Helper | null = null;
    const clipping = new THREE.Plane(),
      raycaster = new THREE.Raycaster(),
      mouse = new THREE.Vector2();
    const abort = new AbortController();
    function fit(box = bounds, top = false) {
      if (box.isEmpty()) return;
      const centre = box.getCenter(new THREE.Vector3());
      const direction = (
        top ? new THREE.Vector3(0, 1, 0.0001) : new THREE.Vector3(0.9, 0.65, 1)
      ).normalize();
      const right = new THREE.Vector3()
        .crossVectors(camera.up, direction)
        .normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      let distance = 0.1;
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            const corner = new THREE.Vector3(x, y, z).sub(centre);
            distance = Math.max(
              distance,
              corner.dot(direction) +
                Math.max(
                  Math.abs(corner.dot(up)) / tangent,
                  Math.abs(corner.dot(right)) / (tangent * camera.aspect),
                ),
            );
          }
      distance *= 1.12;
      orbit.target.copy(centre);
      camera.position.copy(centre).add(direction.multiplyScalar(distance));
      camera.near = Math.max(span / 10000, 0.001);
      camera.far = Math.max(span * 100, 100);
      camera.updateProjectionMatrix();
      orbit.minDistance = Math.max(span / 500, 0.03);
      orbit.maxDistance = span * 15;
      orbit.update();
      latest.current.onPose({
        position: camera.position.toArray() as Vec3,
        target: orbit.target.toArray() as Vec3,
      });
    }
    function pickable(object: THREE.Mesh) {
      return object.visible;
    }
    function update() {
      const p = latest.current,
        hidden = new Set(p.hidden),
        highlights = new Set(p.highlight),
        removed = new Set(p.removed);
      if (p.clipAxis !== "none") {
        const axis = p.clipAxis,
          coordinate =
            bounds.min[axis] +
            ((bounds.max[axis] - bounds.min[axis]) * p.clipPercent) / 100;
        clipping.normal.set(
          axis === "x" ? 1 : 0,
          axis === "y" ? 1 : 0,
          axis === "z" ? 1 : 0,
        );
        clipping.constant = -coordinate;
      }
      for (const object of objects) {
        const id = object.userData.assetId as string,
          kind = object.userData.kind as string,
          m = object.material as THREE.MeshStandardMaterial,
          base = originals.get(object)!;
        object.visible =
          !hidden.has(id) &&
          (!p.isolated || id === p.isolated) &&
          (p.kind === "all" || kind === p.kind);
        m.clippingPlanes = p.clipAxis === "none" ? [] : [clipping];
        m.color.copy(base.colour);
        m.emissive.set(0);
        m.opacity = base.opacity;
        m.transparent = base.opacity < 1;
        if (removed.has(id)) {
          m.color.set(0xe44045);
          m.emissive.set(0x571011);
        }
        if (highlights.has(id)) {
          m.color.set(0xf3ae34);
          m.emissive.set(0x51360a);
        }
        if (id === p.selected) {
          m.color.set(0x17649c);
          m.emissive.set(0x07314c);
        }
        if (removed.has(id)) {
          m.color.set(0xd8483f);
          m.emissive.set(0x481411);
        }
        m.needsUpdate = true;
      }
      if (selectionBox) {
        scene.remove(selectionBox);
        selectionBox.geometry.dispose();
        (selectionBox.material as THREE.Material).dispose();
        selectionBox = null;
      }
      const selected = objects.filter(
        (o) => o.userData.assetId === p.selected && o.visible,
      );
      if (selected.length && p.mode === "bim") {
        const box = new THREE.Box3();
        for (const o of selected) box.expandByObject(o);
        selectionBox = new THREE.Box3Helper(box, 0x147eaf);
        scene.add(selectionBox);
      }
    }
    function command() {
      const c = latest.current.command;
      if (c.type === "restore" && c.pose) {
        camera.position.fromArray(c.pose.position);
        orbit.target.fromArray(c.pose.target);
        orbit.update();
        latest.current.onPose({
          position: camera.position.toArray() as Vec3,
          target: orbit.target.toArray() as Vec3,
        });
        return;
      }
      if (c.type === "focus") {
        const box = new THREE.Box3();
        for (const o of objects)
          if (o.visible && o.userData.assetId === latest.current.selected)
            box.expandByObject(o);
        if (!box.isEmpty()) fit(box);
        return;
      }
      fit(bounds, c.type === "top");
    }
    function resetMeasure() {
      measureStart = null;
      dispose(tools);
      tools.clear();
    }
    function register(mesh: THREE.Mesh, id: string, kind: string) {
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        replacedMaterials.add(material);
      const source = Array.isArray(mesh.material)
        ? mesh.material[0]
        : mesh.material;
      const material =
        source instanceof THREE.MeshStandardMaterial
          ? source.clone()
          : new THREE.MeshStandardMaterial({
              color: 0x8e9da9,
              roughness: 0.5,
              metalness: 0.2,
            });
      mesh.material = material;
      mesh.userData.assetId = id;
      mesh.userData.kind = kind;
      objects.push(mesh);
      originals.set(mesh, {
        colour: material.color.clone(),
        opacity: material.opacity,
      });
    }
    async function load() {
      if (props.mode === "bim") {
        let bytes = props.localGlb;
        if (!bytes) {
          const response = await fetch("/engineering-assets/duplex-mep.glb", {
            signal: abort.signal,
          });
          if (!response.ok) throw new Error("BIM mesh file unavailable");
          bytes = await response.arrayBuffer();
        }
        const gltf = await new GLTFLoader().parseAsync(bytes, "");
        if (dead) {
          dispose(gltf.scene);
          return;
        }
        root.add(gltf.scene);
        root.updateMatrixWorld(true);
        const imported: Asset[] = [];
        gltf.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const id = String(
            object.userData.assetId ||
              object.name ||
              `mesh-${objects.length + 1}`,
          );
          const known = props.localGlb
            ? undefined
            : props.bim?.assets.find((a) => a.id === id);
          const uniqueId =
            props.localGlb && imported.some((a) => a.id === id)
              ? `${id}-${objects.length + 1}`
              : id;
          register(
            object,
            uniqueId,
            known?.kind ?? String(object.userData.ifcClass ?? "ImportedMesh"),
          );
          if (props.localGlb) {
            const box = new THREE.Box3().setFromObject(object);
            imported.push({
              id: uniqueId,
              name: object.name || uniqueId,
              kind: String(object.userData.ifcClass ?? "ImportedMesh"),
              systems: [],
              properties: { ...object.userData },
              bounds: [box.min.toArray() as Vec3, box.max.toArray() as Vec3],
              triangles:
                (object.geometry.index?.count ??
                  object.geometry.attributes.position.count) / 3,
            });
          }
        });
        if (props.localGlb) latest.current.onLocalAssets(imported);
      } else {
        const data = props.network!,
          nodes = new Map(
            data.nodes.map((n) => [n.id, new THREE.Vector3(...n.position)]),
          );
        const allBounds = new THREE.Box3().setFromPoints([...nodes.values()]);
        const width = allBounds.getSize(new THREE.Vector3()).length();
        // Screen-legible network glyphs, not solid pipe dimensions. Source diameters stay in the register.
        const geometry = new THREE.CylinderGeometry(1, 1, 1, 7);
        for (const p of data.pipes) {
          const a = nodes.get(p.from)!,
            b = nodes.get(p.to)!,
            delta = b.clone().sub(a);
          if (delta.length() < 1e-8) continue;
          const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
              color: p.supply ? 0xdd744e : 0x318cba,
              roughness: 0.6,
              metalness: 0.1,
            }),
          );
          mesh.position.copy(a).add(b).multiplyScalar(0.5);
          mesh.scale.set(width / 750, delta.length(), width / 750);
          mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            delta.normalize(),
          );
          root.add(mesh);
          register(mesh, p.id, p.supply ? "Supply pipe" : "Return pipe");
        }
        for (const plant of data.plants) {
          const node = nodes.get(plant.outlet_node)!;
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(width / 120, 18, 12),
            new THREE.MeshStandardMaterial({ color: 0x0a516e }),
          );
          mesh.position.copy(node);
          root.add(mesh);
          register(mesh, plant.hs_id, "Heat source");
        }
        const terminalGeometry = new THREE.OctahedronGeometry(width / 450);
        for (const station of data.substations) {
          const mesh = new THREE.Mesh(
            terminalGeometry,
            new THREE.MeshStandardMaterial({
              color: 0x40958d,
              roughness: 0.65,
            }),
          );
          mesh.position.copy(nodes.get(station.inlet_node)!);
          root.add(mesh);
          register(mesh, substationId(station), "Substation");
        }
      }
      if (!objects.length)
        throw new Error("This file has no renderable geometry.");
      root.updateMatrixWorld(true);
      bounds.setFromObject(root);
      span = Math.max(bounds.getSize(new THREE.Vector3()).length(), 0.2);
      const gridSize = Math.pow(10, Math.ceil(Math.log10(span)));
      const grid = new THREE.GridHelper(gridSize, 20, props.dark?0x334955:0xb3c2cf, props.dark?0x203440:0xd7dfe6);
      grid.position.copy(bounds.getCenter(new THREE.Vector3()));
      grid.position.y = bounds.min.y - span * 0.03;
      scene.add(grid);
      fit();
      update();
      setStatus(
        `${objects.length.toLocaleString("en-GB")} mesh objects · ${props.mode === "bim" ? "metre-scale geometry" : "topology glyphs; widths not to scale"}`,
      );
    }
    load().catch((e) => {
      if (!dead) {
        setFailed(true);
        setStatus(e instanceof Error ? e.message : "Unable to load model");
      }
    });
    function resize() {
      const w = Math.max(el.clientWidth, 1),
        h = Math.max(el.clientHeight, 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let down = { x: 0, y: 0 },
      lastPose = 0;
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (
        e.button !== 0 ||
        Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster
        .intersectObjects(objects, false)
        .find(
          (h) =>
            pickable(h.object as THREE.Mesh) &&
            (latest.current.clipAxis === "none" ||
              clipping.distanceToPoint(h.point) >= 0),
        );
      if (!hit) return;
      if (latest.current.measure && latest.current.mode === "bim") {
        if (!measureStart) {
          resetMeasure();
          measureStart = hit.point.clone();
        } else {
          const a = measureStart.clone(),
            b = hit.point.clone();
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([a, b]),
            new THREE.LineBasicMaterial({ color: 0xda4b38, depthTest: false }),
          );
          line.renderOrder = 1000;
          tools.add(line);
          latest.current.onMeasure({
            a: a.toArray() as Vec3,
            b: b.toArray() as Vec3,
            distance: a.distanceTo(b),
          });
          measureStart = null;
        }
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(span / 600, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xda4b38, depthTest: false }),
        );
        dot.position.copy(hit.point);
        dot.renderOrder = 1001;
        tools.add(dot);
      } else latest.current.onSelect(String(hit.object.userData.assetId));
    };
    const keyDown = (e: KeyboardEvent) => {
      if (
        ![
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "+",
          "=",
          "-",
          "Home",
        ].includes(e.key)
      )
        return;
      e.preventDefault();
      if (e.key === "Home") {
        fit();
        return;
      }
      const offset = camera.position.clone().sub(orbit.target),
        spherical = new THREE.Spherical().setFromVector3(offset);
      if (e.key === "ArrowLeft") spherical.theta -= 0.12;
      if (e.key === "ArrowRight") spherical.theta += 0.12;
      if (e.key === "ArrowUp") spherical.phi -= 0.12;
      if (e.key === "ArrowDown") spherical.phi += 0.12;
      if (e.key === "+" || e.key === "=") spherical.radius *= 0.9;
      if (e.key === "-") spherical.radius *= 1.1;
      spherical.makeSafe();
      camera.position
        .copy(orbit.target)
        .add(new THREE.Vector3().setFromSpherical(spherical));
      orbit.update();
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("keydown", keyDown);
    const onLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
      setStatus(
        "Graphics context lost. Reload the page to restore the model. Asset data remains available.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    const changed = () => {
      if (performance.now() - lastPose > 150) {
        latest.current.onPose({
          position: camera.position.toArray() as Vec3,
          target: orbit.target.toArray() as Vec3,
        });
        lastPose = performance.now();
      }
    };
    orbit.addEventListener("change", changed);
    runtime.current = { update, command, resetMeasure };
    function draw() {
      if (dead) return;
      frame = requestAnimationFrame(draw);
      orbit.update();
      renderer.render(scene, camera);
    }
    draw();
    return () => {
      dead = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      orbit.dispose();
      runtime.current = null;
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("keydown", keyDown);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      dispose(scene);
      for (const material of replacedMaterials) material.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.mode, props.bim, props.network, props.localGlb]);
  useEffect(
    () => runtime.current?.update(),
    [
      props.selected,
      props.kind,
      props.hidden,
      props.isolated,
      props.highlight,
      props.removed,
      props.clipAxis,
      props.clipPercent,
    ],
  );
  useEffect(() => runtime.current?.command(), [props.command]);
  useEffect(() => runtime.current?.resetMeasure(), [props.measure]);
  return (
    <div className="eng-viewport">
      <div className="eng-canvas" ref={host} />
      <div
        className={`eng-render-status ${failed ? "failed" : ""}`}
        role="status"
      >
        {tx(status)}
      </div>
      <div className="eng-axis" aria-hidden="true">
        <b>Y</b>
        <span>Z └ X</span>
      </div>
      <div className="eng-orbit-help">
        {tx("Drag to orbit · right-drag to pan · scroll to zoom")}
      </div>
    </div>
  );
}
