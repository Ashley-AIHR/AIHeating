import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import type { Twin } from "../operations/types";
import {
  createVisionDistrict,
  districtPlan,
  stationPosition,
} from "./vision-assets";
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
  view: "district" | "plant";
  equipment: string;
  suspended: boolean;
  onView: (view: "district" | "plant") => void;
  onEquipment: (id: string) => void;
};
export default function CityScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    runtime = useRef<{
      update: () => void;
      focus: () => void;
      view: () => void;
    } | null>(null);
  latest.current = props;
  const [error, setError] = useState(""),
    [dusk, setDusk] = useState(false),
    [highQuality, setHighQuality] = useState(() => window.innerWidth > 760);
  const lighting = useRef(false),
    quality = useRef(true);
  lighting.current = dusk;
  quality.current = highQuality;
  useEffect(() => {
    const el = host.current!;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setError(
        "WebGL is unavailable. Asset inspection and numerical tools remain available.",
      );
      return;
    }
    let dead = false,
      raf = 0;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.info.autoReset = false;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Orbitable winter-city twin. Drag to orbit; right drag to pan; scroll to zoom; arrow keys orbit; Home resets.",
    );
    el.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.background = new T.Color("#c0cfda");
    scene.fog = new T.FogExp2("#c0cfda", 0.0011);
    const pmrem = new T.PMREMGenerator(renderer),
      room = new RoomEnvironment(),
      environment = pmrem.fromScene(room, 0.035);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.38;
    room.dispose();
    pmrem.dispose();
    const skyLight = new T.HemisphereLight("#bfd5ef", "#625e4d", 0.48);
    scene.add(skyLight);
    const sun = new T.DirectionalLight("#ffe8c5", 3.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.00003;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 2;
    scene.add(sun, sun.target);
    const camera = new T.PerspectiveCamera(39, 1, 0.2, 4000),
      orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.065;
    orbit.maxPolarAngle = Math.PI * 0.482;
    orbit.minDistance = 8;
    orbit.maxDistance = 1000;
    const model = createVisionDistrict();
    scene.add(model.root);
    el.dataset.instances = String(model.stats.instances);
    const plantLights = [-10, 9].map((x) => {
      const light = new T.PointLight("#ffdaa5", 0, 36, 2);
      light.position.copy(stationPosition).add(new T.Vector3(x, 7.5, -3));
      scene.add(light);
      return light;
    });
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, 1, 1);
    ao.updateGtaoMaterial({
      radius: 1.2,
      distanceExponent: 2,
      thickness: 1.4,
      samples: 8,
    });
    ao.blendIntensity = 0.75;
    composer.addPass(ao);
    const antialias = new SMAAPass();
    composer.addPass(antialias);
    const output = new OutputPass();
    composer.addPass(output);
    const overviewTarget = new T.Vector3(-7, 3, 22),
      overviewOffset = new T.Vector3(160, 145, 225);
    const destination = {
      position: overviewTarget.clone().add(overviewOffset),
      target: overviewTarget.clone(),
      active: false,
    };
    camera.position.copy(destination.position);
    orbit.target.copy(destination.target);
    function setLighting(plant: boolean) {
      const centre = plant ? stationPosition : overviewTarget,
        extent = plant ? 26 : 210;
      sun.position.copy(centre).add(new T.Vector3(-110, 125, 95));
      sun.target.position.copy(centre);
      const s = sun.shadow.camera;
      s.left = -extent;
      s.right = extent;
      s.top = extent;
      s.bottom = -extent;
      s.near = 0.5;
      s.far = 650;
      s.updateProjectionMatrix();
      sun.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
    }
    function go(target: T.Vector3, offset: T.Vector3) {
      destination.position.copy(target).addScaledVector(offset, Math.max(1, 0.95 / camera.aspect));
      destination.target.copy(target);
      destination.active = true;
    }
    function changeView() {
      const plant = latest.current.view === "plant";
      setLighting(plant);
      ao.updateGtaoMaterial({ radius: plant ? 0.9 : 2 });
      if (plant)
        go(
          stationPosition.clone().add(new T.Vector3(0, 3, 0)),
          new T.Vector3(23, 18, 30),
        );
      else go(overviewTarget, overviewOffset);
    }
    setLighting(false);
    const labels = document.createElement("div");
    labels.className = "city-labels";
    el.appendChild(labels);
    const markers: {
      id: string;
      point: T.Vector3;
      button: HTMLButtonElement;
      plant: boolean;
    }[] = [];
    const positions = new Map<string, T.Vector3>();
    function badge(id: string, point: T.Vector3, plant = false, name = "") {
      const button = document.createElement("button");
      button.dataset.asset = id;
      button.setAttribute("aria-label", `Select ${id} in 3D`);
      button.title = name;
      button.onclick = () => {
        if (plant) {
          latest.current.onSelect("ST01");
          latest.current.onEquipment(id);
        } else {
          latest.current.onSelect(id);
          if (id === "ST01") latest.current.onView("plant");
        }
      };
      labels.appendChild(button);
      markers.push({ id, point, button, plant });
      positions.set(id, point);
    }
    for (const b of districtPlan)
      badge(b.id, new T.Vector3(b.x, b.floors * 3.3 + 5, b.z));
    badge("ST01", stationPosition.clone().add(new T.Vector3(0, 9, 0)));
    for (const item of model.equipment)
      badge(item.id, item.point.clone().add(stationPosition), true, item.name);
    const network = new T.Group();
    scene.add(network);
    const flowMaterial = new T.MeshStandardMaterial({
      color: "#ff9440",
      emissive: "#ff6f12",
      emissiveIntensity: 0.85,
      metalness: 0.3,
      roughness: 0.35,
    });
    const returnMaterial = new T.MeshStandardMaterial({
      color: "#2cbded",
      emissive: "#008aff",
      emissiveIntensity: 0.65,
      metalness: 0.3,
      roughness: 0.35,
    });
    const paths: {
      curve: T.CatmullRomCurve3;
      zone: string;
      reverse: boolean;
    }[] = [];
    for (const [zone, index] of [
      ["near", 0],
      ["mid", 1],
      ["far", 2],
    ] as const) {
      const row = districtPlan.filter((_, i) => Math.floor(i / 4) === index),
        zz = row[0].z + 19;
      badge(zone, new T.Vector3(-111, 3, zz));
      for (const reverse of [false, true]) {
        const offset = reverse ? 1.2 : 0,
          points = [
            [-101, 1, 118 + offset],
            [-113 + offset, 1, 118 + offset],
            [-113 + offset, 1, zz + offset],
            [102, 1, zz + offset],
          ];
        const curve = new T.CatmullRomCurve3(
          points.map((v) => new T.Vector3(...v)),
          false,
          "catmullrom",
          0.025,
        );
        paths.push({ curve, zone, reverse });
        const pipe = new T.Mesh(
          new T.TubeGeometry(curve, 100, 0.3, 8, false),
          reverse ? returnMaterial : flowMaterial,
        );
        pipe.userData.assetId = zone;
        network.add(pipe);
        for (const b of row) {
          const branch = new T.CatmullRomCurve3(
            [
              new T.Vector3(b.x + offset, 1, zz + offset),
              new T.Vector3(b.x + offset, 1, b.z + 10),
              new T.Vector3(b.x + offset, 2, b.z + 9),
            ],
            false,
            "catmullrom",
            0.05,
          );
          const mesh = new T.Mesh(
            new T.TubeGeometry(branch, 12, 0.2, 8, false),
            reverse ? returnMaterial : flowMaterial,
          );
          mesh.userData.assetId = b.id;
          network.add(mesh);
        }
      }
    }
    const particles = new T.InstancedMesh(
      new T.SphereGeometry(0.45, 6, 4),
      new T.MeshBasicMaterial({ color: "#d7fcff" }),
      72,
    );
    network.add(particles);
    const helper = new T.Object3D(),
      rings = new T.Group();
    scene.add(rings);
    const thermalMeshes = new Map<string, T.Mesh>();
    for (const b of districtPlan) {
      const shape = new T.Shape();
      shape.moveTo(-15, -10);
      shape.lineTo(15, -10);
      shape.lineTo(15, 10);
      shape.lineTo(-15, 10);
      shape.closePath();
      const hole = new T.Path();
      hole.moveTo(-14.4, -9.4);
      hole.lineTo(-14.4, 9.4);
      hole.lineTo(14.4, 9.4);
      hole.lineTo(14.4, -9.4);
      hole.closePath();
      shape.holes.push(hole);
      const mesh = new T.Mesh(
        new T.ShapeGeometry(shape),
        new T.MeshBasicMaterial({
          color: "#fcb365",
          transparent: true,
          opacity: 0.9,
          side: T.DoubleSide,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(b.x, 0.46, b.z);
      rings.add(mesh);
      thermalMeshes.set(b.id, mesh);
    }
    const selection = new T.Box3Helper(new T.Box3(), new T.Color("#63e7d0"));
    scene.add(selection);
    if (props.imported)
      new GLTFLoader().parse(
        props.imported,
        "",
        (gltf) => {
          if (dead) {
            dispose(gltf.scene);
            return;
          }
          const loaded = gltf.scene,
            bounds = new T.Box3().setFromObject(loaded),
            size = bounds.getSize(new T.Vector3()),
            centre = bounds.getCenter(new T.Vector3());
          const scale = 200 / Math.max(size.x, size.y, size.z, 1);
          loaded.position.set(
            -centre.x * scale,
            -bounds.min.y * scale,
            -centre.z * scale,
          );
          loaded.scale.setScalar(scale);
          scene.add(loaded);
          model.root.visible = false;
          network.visible = false;
          labels.style.display = "none";
        },
        () =>
          setError(
            "Unable to load the local visual model. The vision district remains available.",
          ),
      );
    function update() {
      const { frame, layer, selected, view } = latest.current;
      network.visible = !props.imported && layer !== "buildings";
      rings.visible =
        !props.imported && layer === "temperature" && view === "district";
      for (const marker of markers) {
        const building = frame.buildings.find((b) => b.id === marker.id),
          zone = frame.zones.find((z) => z.id === marker.id);
        marker.button.textContent = building
          ? `${marker.id}  ${building.indoorC.toFixed(1)}°`
          : zone
            ? `${marker.id.toUpperCase()} · ${zone.delayMinutes.toFixed(0)} min`
            : marker.id === "ST01"
              ? "ST01  ENERGY CENTRE ↗"
              : marker.id;
        marker.button.classList.toggle(
          "active",
          marker.plant === (view === "plant") &&
            marker.id === (marker.plant ? latest.current.equipment : selected),
        );
        marker.button.classList.toggle("plant-label", marker.plant);
      }
      for (const b of frame.buildings) {
        const m = thermalMeshes.get(b.id);
        if (m)
          (m.material as T.MeshBasicMaterial).color.set(
            b.quality === "suspect"
              ? "#ec84eb"
              : b.indoorC < 20
                ? "#49b7ff"
                : b.indoorC > 23
                  ? "#ff954f"
                  : "#7bd9bb",
          );
      }
      const b = districtPlan.find((b) => b.id === selected);
      selection.visible = !!b && view === "district" && !props.imported;
      if (b)
        selection.box.set(
          new T.Vector3(b.x - 14.2, 0.45, b.z - 10),
          new T.Vector3(b.x + 14.2, b.floors * 3.3 + 4, b.z + 10),
        );
      if (view === "plant" && !props.imported) {
        const component = model.equipment.find(
          (e) => e.id === latest.current.equipment,
        );
        if (component) {
          const p = component.point.clone().add(stationPosition),
            hx = component.id.startsWith("HX"),
            mcc = component.id === "MCC";
          selection.visible = true;
          selection.box.set(
            new T.Vector3(
              p.x - (mcc ? 6 : hx ? 2.3 : 2.2),
              stationPosition.y + 0.7,
              p.z - (mcc ? 1.5 : 3),
            ),
            new T.Vector3(
              p.x + (mcc ? 5 : hx ? 2.3 : 2.2),
              stationPosition.y + (hx ? 6.7 : mcc ? 5.8 : 3.9),
              p.z + (mcc ? 1 : 3),
            ),
          );
        }
      }
    }
    function focus() {
      const { selected, view } = latest.current;
      if (selected === "ST01") {
        if (view !== "plant") latest.current.onView("plant");
        else changeView();
        return;
      }
      if (view === "plant") {
        latest.current.onView("district");
        return;
      }
      const p = positions.get(selected);
      if (p) go(p.clone().setY(p.y * 0.4), new T.Vector3(62, 52, 82));
    }
    runtime.current = { update, focus, view: changeView };
    update();
    if (latest.current.view === "plant") changeView();
    const resize = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      const portraitChanged = (camera.aspect < 1) !== (w / h < 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (portraitChanged) changeView();
    });
    resize.observe(el);
    let pointer = { x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      destination.active = false;
    };
    const ray = new T.Raycaster();
    const up = (e: PointerEvent) => {
      if (
        Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 5 ||
        props.imported
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray
        .intersectObjects([model.root, network], true)
        .find(
          (h) =>
            h.object.userData.assetId ||
            (h.instanceId !== undefined &&
              h.object.userData.ids?.[h.instanceId]),
        );
      if (hit) {
        const id =
          hit.object.userData.assetId ||
          hit.object.userData.ids[hit.instanceId!];
        if (model.equipment.some((e) => e.id === id)) {
          latest.current.onSelect("ST01");
          latest.current.onEquipment(id);
          latest.current.onView("plant");
        } else {
          latest.current.onSelect(id);
          if (id === "ST01") latest.current.onView("plant");
        }
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Home") {
        e.preventDefault();
        changeView();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        destination.active = false;
        const offset = camera.position.clone().sub(orbit.target),
          spherical = new T.Spherical().setFromVector3(offset);
        spherical.theta +=
          e.key === "ArrowLeft" ? 0.12 : e.key === "ArrowRight" ? -0.12 : 0;
        spherical.phi = T.MathUtils.clamp(
          spherical.phi +
            (e.key === "ArrowUp" ? -0.08 : e.key === "ArrowDown" ? 0.08 : 0),
          0.15,
          1.48,
        );
        camera.position
          .copy(orbit.target)
          .add(new T.Vector3().setFromSpherical(spherical));
        orbit.update();
      }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("keydown", key);
    const clock = new T.Clock();
    let last = performance.now(),
      previousDusk: boolean | undefined;
    function animate() {
      if (dead) return;
      raf = requestAnimationFrame(animate);
      if (latest.current.suspended || document.hidden) return;
      const t = clock.getElapsedTime(),
        now = performance.now(),
        dt = (now - last) / 1000;
      if (dt < 1 / 30) return;
      last = now;
      if (previousDusk !== lighting.current) {
        previousDusk = lighting.current;
        const dark = lighting.current;
        const colour = dark ? "#1a2c48" : "#c0cfda";
        (scene.background as T.Color).set(colour);
        (scene.fog as T.FogExp2).color.set(colour);
        sun.color.set(dark ? "#98bbec" : "#ffe8c5");
        sun.intensity = dark ? 0.65 : 3.8;
        skyLight.color.set(dark ? "#517cad" : "#bfd5ef");
        skyLight.intensity = dark ? 0.58 : 0.48;
        model.materials.warm.emissiveIntensity = dark ? 2.6 : 0.35;
        flowMaterial.emissiveIntensity = dark ? 2 : 0.85;
        returnMaterial.emissiveIntensity = dark ? 1.5 : 0.65;
        plantLights.forEach((light) => (light.intensity = dark ? 180 : 0));
      }
      if (destination.active) {
        const alpha = 1 - Math.exp(-dt / 0.24);
        camera.position.lerp(destination.position, alpha);
        orbit.target.lerp(destination.target, alpha);
        if (camera.position.distanceTo(destination.position) < 0.05)
          destination.active = false;
      }
      orbit.update();
      if (network.visible)
        for (let i = 0; i < 72; i++) {
          const path = paths[Math.floor(i / 12)],
            zone = latest.current.frame.zones.find((z) => z.id === path.zone),
            phase =
              ((i % 12) / 12 + (t * 0.024 * (zone?.flowM3h || 10)) / 15) % 1;
          helper.position.copy(
            path.curve.getPoint(path.reverse ? 1 - phase : phase),
          );
          helper.updateMatrix();
          particles.setMatrixAt(i, helper.matrix);
        }
      particles.instanceMatrix.needsUpdate = true;
      for (const marker of markers) {
        const point = marker.point.clone().project(camera),
          visible =
            point.z < 1 &&
            point.z > -1 &&
            marker.plant === (latest.current.view === "plant") &&
            (el.clientWidth > 600 ||
              marker.id === latest.current.selected ||
              marker.plant);
        marker.button.style.display = visible ? "" : "none";
        if (visible)
          marker.button.style.transform = `translate(${(point.x * 0.5 + 0.5) * el.clientWidth}px,${(-point.y * 0.5 + 0.5) * el.clientHeight}px) translate(-50%,-100%)`;
      }
      renderer.info.reset();
      ao.enabled = quality.current;
      composer.render();
      el.dataset.drawCalls = String(renderer.info.render.calls);
      el.dataset.triangles = String(renderer.info.render.triangles);
      el.dataset.cameraSettled = String(!destination.active);
    }
    animate();
    function dispose(root: T.Object3D) {
      const geometries = new Set<T.BufferGeometry>(),
        materials = new Set<T.Material>();
      root.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.LineSegments) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            materials.add(m),
          );
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    }
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      resize.disconnect();
      orbit.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("keydown", key);
      dispose(scene);
      model.textures.forEach((t) => t.dispose());
      environment.dispose();
      sun.shadow.dispose();
      ao.dispose();
      output.dispose();
      antialias.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.remove();
      runtime.current = null;
    };
  }, [props.imported]);
  useEffect(
    () => runtime.current?.update(),
    [props.frame, props.selected, props.layer, props.view, props.equipment],
  );
  useEffect(() => {
    if (props.focus) runtime.current?.focus();
  }, [props.focus]);
  useEffect(() => runtime.current?.view(), [props.view]);
  return (
    <div
      ref={host}
      className={`city-scene ${props.view === "plant" ? "plant-view" : ""}`}
    >
      {error && (
        <div className="scene-error" role="alert">
          {error}
        </div>
      )}
      <div className="render-settings">
        <button
          onClick={() => setDusk(!dusk)}
          aria-pressed={dusk}
          title="Art-directed lighting, independent of the simulation clock"
        >
          {dusk ? "☾ Blue hour" : "☀ Winter daylight"}
        </button>
        <button
          onClick={() => setHighQuality(!highQuality)}
          aria-pressed={highQuality}
        >
          {highQuality ? "Quality: cinematic" : "Quality: performance"}
        </button>
      </div>
      <div className="orbit-hint">
        DRAG TO ORBIT <span>·</span> SCROLL TO EXPLORE <span>·</span> CLICK TO
        INSPECT
      </div>
    </div>
  );
}
