import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Twin } from "../operations/types";
export type Geography = {
  origin: number[];
  scope: string;
  url: string;
  extractTimestamp: string;
  buildings: {
    id: string;
    demoAssetId?: string;
    polygon: number[][];
    centre: number[];
    height: number;
    heightSource: string;
  }[];
  roads: { id: string; kind: string; points: number[][] }[];
};
type Props = {
  geo: Geography;
  frame: Twin;
  selected: string;
  onSelect: (id: string) => void;
  focus: number;
  layer: string;
  imported: ArrayBuffer | null;
};
export default function CityScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    runtime = useRef<{ update: () => void; focus: () => void } | null>(null);
  latest.current = props;
  const [error, setError] = useState("");
  useEffect(() => {
    const el = host.current!;
    let renderer: T.WebGLRenderer,
      raf = 0,
      dead = false;
    try {
      renderer = new T.WebGLRenderer({ antialias: true });
    } catch {
      setError(
        "WebGL is unavailable. Use the asset register and numerical tools.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x080f1c);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Orbitable Yinchuan geographic context. Drag to orbit; right drag to pan; scroll to zoom; arrow keys orbit; Home resets.",
    );
    el.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.fog = new T.FogExp2(0x080f1c, 0.00023);
    scene.add(new T.HemisphereLight(0xcde9ff, 0x0c1824, 2.5));
    const sun = new T.DirectionalLight(0xffedce, 3);
    sun.position.set(-500, 1000, 200);
    scene.add(sun);
    const camera = new T.PerspectiveCamera(42, 1, 1, 15000),
      orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.maxPolarAngle = Math.PI * 0.49;
    orbit.minDistance = 30;
    orbit.maxDistance = 5000;
    const activeBuildings = props.geo.buildings.filter((b) => b.demoAssetId);
    const centre = activeBuildings
      .reduce(
        (a, b) => a.add(new T.Vector3(b.centre[0], 0, b.centre[1])),
        new T.Vector3(),
      )
      .divideScalar(activeBuildings.length || 1);
    const overviewOffset = new T.Vector3(430, 430, 560);
    camera.position.copy(centre).add(overviewOffset);
    orbit.target.copy(centre);
    const ground = new T.Mesh(
      new T.PlaneGeometry(12000, 12000),
      new T.MeshStandardMaterial({ color: 0x0c1725, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    scene.add(ground);
    const grid = new T.GridHelper(5000, 100, 0x213043, 0x132231);
    grid.position.y = -4;
    scene.add(grid);
    const sourceGroup = new T.Group(),
      network = new T.Group(),
      labels = document.createElement("div");
    labels.className = "city-labels";
    el.appendChild(labels);
    scene.add(sourceGroup, network);
    const meshes: T.Mesh[] = [],
      markers: { id: string; point: T.Vector3; button: HTMLButtonElement }[] =
        [],
      positions = new Map<string, T.Vector3>();
    const facade = document.createElement("canvas");
    facade.width = 128;
    facade.height = 128;
    const ctx = facade.getContext("2d")!;
    ctx.fillStyle = "#536576";
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        ctx.fillStyle = (x + y) % 3 === 0 ? "#cab785" : "#202f3e";
        ctx.fillRect(x * 32 + 8, y * 32 + 7, 13, 17);
        ctx.fillStyle = "#687787";
        ctx.fillRect(x * 32 + 6, y * 32 + 26, 17, 2);
      }
    const texture = new T.CanvasTexture(facade);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.colorSpace = T.SRGBColorSpace;
    function badge(id: string, p: T.Vector3) {
      const button = document.createElement("button");
      button.dataset.asset = id;
      button.setAttribute("aria-label", `Select ${id} in 3D`);
      button.onclick = () => latest.current.onSelect(id);
      labels.appendChild(button);
      markers.push({ id, point: p.clone(), button });
      positions.set(id, p);
    }
    for (const b of props.geo.buildings) {
      const shape = new T.Shape(
          b.polygon.map((p) => new T.Vector2(p[0], -p[1])),
        ),
        g = new T.ExtrudeGeometry(shape, {
          depth: b.height,
          bevelEnabled: false,
        });
      g.rotateX(-Math.PI / 2);
      const material = new T.MeshStandardMaterial({
        color: 0x667e94,
        roughness: 0.85,
        metalness: 0.1,
      });
      const side = new T.MeshStandardMaterial({
        color: 0x879daf,
        map: texture,
        roughness: 0.85,
      });
      // Normalise generated world-space UVs to a visual facade grid; not surveyed fenestration.
      const uv = g.getAttribute("uv");
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, uv.getX(i) / 24, uv.getY(i) / 12);
      const mesh = new T.Mesh(g, [material, side]);
      mesh.userData.assetId = b.demoAssetId;
      sourceGroup.add(mesh);
      meshes.push(mesh);
      const edge = new T.LineSegments(
        new T.EdgesGeometry(g, 30),
        new T.LineBasicMaterial({
          color: 0x748da0,
          transparent: true,
          opacity: 0.2,
        }),
      );
      sourceGroup.add(edge);
      if (b.demoAssetId)
        badge(
          b.demoAssetId,
          new T.Vector3(b.centre[0], b.height + 12, b.centre[1]),
        );
    }
    for (const road of props.geo.roads) {
      if (road.points.length < 2) continue;
      const curve = new T.CatmullRomCurve3(
        road.points.map((p) => new T.Vector3(p[0], -2, p[1])),
        false,
        "catmullrom",
        0,
      );
      sourceGroup.add(
        new T.Mesh(
          new T.TubeGeometry(
            curve,
            Math.min(100, road.points.length * 4),
            ["primary", "secondary", "tertiary"].includes(road.kind) ? 5 : 2.3,
            4,
            false,
          ),
          new T.MeshStandardMaterial({ color: 0x293746, roughness: 1 }),
        ),
      );
    }
    const station = centre.clone().add(new T.Vector3(-220, 12, 100));
    badge("ST01", station);
    // Explicit schematic overlays: these are not underground survey coordinates or pipe sizes.
    const stationGlyph = new T.Mesh(
      new T.OctahedronGeometry(13),
      new T.MeshStandardMaterial({ color: 0x67e2d5, emissive: 0x153d45 }),
    );
    stationGlyph.position.copy(station);
    stationGlyph.userData.assetId = "ST01";
    network.add(stationGlyph);
    meshes.push(stationGlyph);
    const routes: { mesh: T.Mesh; zone: string }[] = [];
    for (const [zone, index] of [
      ["near", 0],
      ["mid", 1],
      ["far", 2],
    ] as const) {
      const members = props.geo.buildings.filter(
        (b) =>
          b.demoAssetId &&
          Math.floor((Number(b.demoAssetId.slice(1)) - 1) / 4) === index,
      );
      if (!members.length) continue;
      const junction = members
        .reduce(
          (a, b) => a.add(new T.Vector3(b.centre[0], 5, b.centre[1])),
          new T.Vector3(),
        )
        .divideScalar(members.length);
      badge(zone, junction.clone().add(new T.Vector3(0, 28, 0)));
      for (const target of [
        junction,
        ...members.map((b) => new T.Vector3(b.centre[0], 5, b.centre[1])),
      ])
        for (const offset of [-3, 3]) {
          const start = target === junction ? station : junction;
          const path = [
            start.clone().setY(4),
            new T.Vector3(start.x, 4, target.z),
            target.clone().setY(4),
          ].map((p) => p.add(new T.Vector3(offset, 0, 0)));
          const curve = new T.CatmullRomCurve3(path, false, "catmullrom", 0.1),
            material = new T.MeshStandardMaterial({
              color: offset < 0 ? 0xf39b5c : 0x389eff,
              emissive: offset < 0 ? 0x71331b : 0x143d80,
              emissiveIntensity: 0.8,
            });
          const mesh = new T.Mesh(
            new T.TubeGeometry(curve, 32, 1.7, 6, false),
            material,
          );
          mesh.userData.assetId = zone;
          network.add(mesh);
          meshes.push(mesh);
          routes.push({ mesh, zone });
        }
    }
    const selection = new T.Box3Helper(new T.Box3(), 0x8ff6df);
    selection.visible = false;
    scene.add(selection);
    let importedGroup: T.Group | null = null;
    if (props.imported)
      new GLTFLoader().parse(
        props.imported,
        "",
        (g) => {
          if (dead) {
            g.scene.traverse(disposeObject);
            return;
          }
          importedGroup = g.scene;
          sourceGroup.visible = false;
          network.visible = false;
          selection.visible = false;
          const box = new T.Box3().setFromObject(g.scene),
            c = box.getCenter(new T.Vector3()),
            span = box.getSize(new T.Vector3()).length();
          g.scene.position.sub(c).add(centre);
          scene.add(g.scene);
          camera.position.copy(centre).add(new T.Vector3(span, span, span));
          orbit.target.copy(centre);
        },
        () =>
          setError(
            "The local model could not be parsed. Geographic context remains available.",
          ),
      );
    function update() {
      const p = latest.current;
      network.visible = !importedGroup && p.layer !== "buildings";
      const chosen = meshes.filter((m) => m.userData.assetId === p.selected);
      selection.visible = !importedGroup && chosen.length > 0;
      selection.box.makeEmpty();
      chosen.forEach((m) => selection.box.union(new T.Box3().setFromObject(m)));
      const selectedZone =
        p.frame.buildings.find((b) => b.id === p.selected)?.zone || p.selected;
      routes.forEach((r) => {
        const mat = r.mesh.material as T.MeshStandardMaterial;
        mat.emissiveIntensity = r.zone === selectedZone ? 2 : 0.5;
      });
      for (const b of props.geo.buildings) {
        if (!b.demoAssetId) continue;
        const record = p.frame.buildings.find((x) => x.id === b.demoAssetId),
          mesh = meshes.find((m) => m.userData.assetId === b.demoAssetId)!;
        const colour =
          p.layer === "temperature" && record
            ? record.quality === "suspect"
              ? 0xa996ee
              : record.indoorC < 20
                ? 0x4b9ed1
                : record.indoorC > 23
                  ? 0xda8b62
                  : 0x76bdb0
            : 0x70869a;
        (mesh.material as T.MeshStandardMaterial[]).forEach((m) =>
          m.color.setHex(colour),
        );
      }
      markers.forEach(({ id, button }) => {
        const b = p.frame.buildings.find((x) => x.id === id),
          z = p.frame.zones.find((x) => x.id === id);
        button.className = id === p.selected ? "active" : "";
        button.textContent = b
          ? `${id}  ${b.indoorC.toFixed(1)}°C`
          : z
            ? `${id.toUpperCase()} · ${z.delayMinutes.toFixed(0)} min`
            : "ST01 · HEAT EXCHANGE";
      });
    }
    function focus() {
      const p = latest.current;
      if (p.selected === "ST01" && p.focus === 0) {
        orbit.target.copy(centre);
        camera.position.copy(centre).add(overviewOffset);
        return;
      }
      const target = positions.get(p.selected) || centre;
      orbit.target.copy(target);
      camera.position.copy(target).add(new T.Vector3(180, 170, 240));
    }
    runtime.current = { update, focus };
    update();
    let down = [0, 0];
    const pointerDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const pointerUp = (e: PointerEvent) => {
      if (importedGroup) return;
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray
        .intersectObjects(meshes)
        .find(
          (h) =>
            h.object.userData.assetId &&
            (h.object.parent !== network || network.visible),
        );
      if (hit) latest.current.onSelect(hit.object.userData.assetId);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Home") {
        orbit.target.copy(centre);
        camera.position.copy(centre).add(overviewOffset);
        e.preventDefault();
      } else if (e.key.startsWith("Arrow")) {
        const v = camera.position.clone().sub(orbit.target);
        v.applyAxisAngle(
          new T.Vector3(0, 1, 0),
          e.key === "ArrowLeft" ? 0.12 : e.key === "ArrowRight" ? -0.12 : 0,
        );
        if (e.key === "ArrowUp") v.multiplyScalar(0.9);
        if (e.key === "ArrowDown") v.multiplyScalar(1.1);
        camera.position.copy(orbit.target).add(v);
        e.preventDefault();
      }
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("keydown", key);
    const resize = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    });
    resize.observe(el);
    function render() {
      raf = requestAnimationFrame(render);
      orbit.update();
      for (const m of markers) {
        const p = m.point.clone().project(camera);
        m.button.style.transform = `translate(${((p.x + 1) * el.clientWidth) / 2}px,${((-p.y + 1) * el.clientHeight) / 2}px) translate(-50%,-100%)`;
        m.button.hidden =
          p.z > 1 ||
          p.z < -1 ||
          Math.abs(p.x) > 1.1 ||
          Math.abs(p.y) > 1.1 ||
          !!importedGroup;
      }
      renderer.render(scene, camera);
    }
    render();
    function disposeObject(o: T.Object3D) {
      if (o instanceof T.Mesh || o instanceof T.Line) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    }
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      orbit.dispose();
      scene.traverse(disposeObject);
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.remove();
      runtime.current = null;
    };
  }, [props.geo, props.imported]);
  useEffect(
    () => runtime.current?.update(),
    [props.frame, props.selected, props.layer],
  );
  useEffect(() => {
    if (props.focus) runtime.current?.focus();
  }, [props.focus]);
  return (
    <div className="city-scene" ref={host}>
      {error && (
        <div className="scene-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
