import { tx, useLocale } from "../localisation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { loadProfessionalAssets } from "./professional-assets";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createCityAtmosphere, cityIdentity } from "./city-atmosphere";
import type { Twin, Finding } from "../operations/types";
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
  affected: string[];
  comparison?: Twin;
  findings: Finding[];
  controlContent: ReactNode;
  onOperate: () => void;
  onOpenBim: () => void;
};
export default function CityScene(props: Props) {
  const locale = useLocale();
  const host = useRef<HTMLDivElement>(null),
    controlAnchor = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    runtime = useRef<{
      update: () => void;
      focus: () => void;
      view: () => void;
    } | null>(null);
  latest.current = props;
  const [error, setError] = useState(""),
    [dusk, setDusk] = useState(true),
    [ambientMotion, setAmbientMotion] = useState(true),
    [referenceOpen, setReferenceOpen] = useState(false),
    [highQuality, setHighQuality] = useState(() => window.innerWidth > 760);
  const referenceDialog = useRef<HTMLDialogElement>(null);
  const motion = useRef(true);
  motion.current = ambientMotion;
  const identity =
    cityIdentity[props.frame.cityId as keyof typeof cityIdentity] ||
    cityIdentity.yinchuan;
  useEffect(() => {
    if (referenceOpen) referenceDialog.current?.showModal();
    else referenceDialog.current?.close();
  }, [referenceOpen]);
  const lighting = useRef(false),
    quality = useRef(true);
  lighting.current = dusk;
  quality.current = highQuality;
  useEffect(() => {
    const el = host.current!;
    setError("");
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
      tx(
        `Orbitable ${props.frame.city?.name || "Yinchuan"} fictional district twin. Drag to orbit; right drag to pan; scroll to zoom; arrow keys orbit; Home resets.`,
      ),
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
    let outdoorEnvironment: T.WebGLRenderTarget | undefined;
    new RGBELoader().load(
      "/visual-models/kloppenheim_06_1k.hdr",
      (hdr) => {
        if (dead) {
          hdr.dispose();
          return;
        }
        hdr.mapping = T.EquirectangularReflectionMapping;
        const generator = new T.PMREMGenerator(renderer);
        outdoorEnvironment = generator.fromEquirectangular(hdr);
        scene.environment = outdoorEnvironment.texture;
        scene.environmentIntensity = 0.55;
        hdr.dispose();
        generator.dispose();
        el.dataset.environment = "outdoor-hdri";
      },
      undefined,
      () => {
        el.dataset.environment = "fallback";
      },
    );
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
    const model = createVisionDistrict(props.frame.cityId);
    const shanghai = props.frame.cityId === "shanghai";
    (scene.fog as T.FogExp2).density = shanghai ? 0.0006 : 0.00075;
    const atmosphere = createCityAtmosphere(
      props.frame.cityId || "yinchuan",
      model.materials,
    );
    model.root.add(atmosphere.root);
    el.dataset.identity = atmosphere.identity.title;
    el.dataset.cameraSettled = "false";
    el.dataset.ambientTime = "0";
    el.dataset.city = props.frame.cityId || "yinchuan";
    scene.add(model.root);
    const professional = loadProfessionalAssets(
      props.frame.cityId || "yinchuan",
      model.treePlacements,
    );
    model.root.add(professional.root);
    el.dataset.facades = "loading";
    el.dataset.vegetation = "loading";
    professional.facadeReady
      .then(() => {
        if (dead) return;
        model.legacyFacades.visible = false;
        el.dataset.facades = "professional-cc0";
        renderer.shadowMap.needsUpdate = true;
      })
      .catch(() => {
        if (!dead) {
          el.dataset.facades = "fallback";
          setError(
            "Professional facade assets could not load. Basic geometry remains available.",
          );
        }
      });
    professional.vegetationReady
      .then(() => {
        if (dead) return;
        el.dataset.vegetation = "professional-cc0";
        renderer.shadowMap.needsUpdate = true;
      })
      .catch(() => {
        if (!dead) {
          el.dataset.vegetation = "unavailable";
          setError(
            "Professional vegetation assets could not load. Retry the page to restore landscape detail.",
          );
        }
      });
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
    const bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.14, 0.32, 1.15);
    composer.addPass(bloom);
    const output = new OutputPass();
    composer.addPass(output);
    const overviewTarget = new T.Vector3(-7, 20, -25),
      overviewOffset = new T.Vector3(130, 110, 365);
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
      destination.position
        .copy(target)
        .addScaledVector(offset, Math.max(1, 0.95 / camera.aspect));
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
      button.setAttribute("aria-label", tx(`Select ${id} in 3D`));
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
      phase: number;
      speed: number;
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
        paths.push({ curve, zone, reverse, phase: 0, speed: 0 });
        const material = (reverse ? returnMaterial : flowMaterial).clone();
        const pipe = new T.Mesh(
          new T.TubeGeometry(curve, 100, 0.3, 8, false),
          material,
        );
        pipe.userData.assetId = zone;
        pipe.userData.zone = zone;
        pipe.userData.reverse = reverse;
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
            material,
          );
          mesh.userData.assetId = b.id;
          mesh.userData.zone = zone;
          mesh.userData.reverse = reverse;
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
    const lastReadings = new Map<string, number>();
    function update() {
      renderer.domElement.setAttribute(
        "aria-label",
        tx(
          `Orbitable ${latest.current.frame.city?.name || "Yinchuan"} fictional district twin. Drag to orbit; right drag to pan; scroll to zoom; arrow keys orbit; Home resets.`,
        ),
      );
      const { frame, layer, selected, view, affected, comparison } =
        latest.current;
      el.dataset.stateRevision = String(frame.revision);
      el.dataset.physicalTime = String(frame.elapsedMinutes);
      el.dataset.comparison = String(!!comparison);
      network.visible = !props.imported && layer !== "buildings";
      rings.visible =
        !props.imported && layer === "temperature" && view === "district";
      for (const marker of markers) {
        marker.button.setAttribute(
          "aria-label",
          tx(`Select ${marker.id} in 3D`),
        );
        const building = frame.buildings.find((b) => b.id === marker.id),
          zone = frame.zones.find((z) => z.id === marker.id);
        const reference = comparison?.buildings.find((b) => b.id === marker.id);
        const delta =
          reference && building ? building.modelC - reference.modelC : null;
        const severity = building
          ? building.quality === "suspect"
            ? "suspect"
            : building.indoorC < 18
              ? "critical"
              : building.indoorC < 20
                ? "warning"
                : building.indoorC > 23
                  ? "warm"
                  : "normal"
          : "normal";
        marker.button.dataset.severity = severity;
        const reading = building?.indoorC ?? zone?.flowM3h ?? frame.pumpHz;
        const previous = lastReadings.get(marker.id);
        const changed =
          previous !== undefined &&
          Math.abs(previous - reading) >= (building ? 0.01 : 0.05);
        if (changed) {
          marker.button.classList.remove("reading-change");
          void marker.button.offsetWidth;
          marker.button.classList.add("reading-change");
        }
        lastReadings.set(marker.id, reading);
        marker.button.textContent =
          (severity === "critical"
            ? "⛔ "
            : severity === "suspect"
              ? "◇ "
              : severity === "warning" || severity === "warm"
                ? "△ "
                : "") +
          (building
            ? `${marker.id}  ${building.indoorC.toFixed(1)}°${delta !== null ? ` · ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}°` : ""}`
            : zone
              ? `${tx(marker.id.toUpperCase())} · ${zone.flowM3h.toFixed(1)} m³/h · ${zone.delayMinutes.toFixed(0)} ${tx("min")}`
              : marker.id === "ST01"
                ? `ST01 · ${frame.supplyC.toFixed(1)}°C · ${frame.pumpHz.toFixed(1)} Hz ↗`
                : marker.id.startsWith("P-") && marker.id !== "P-03"
                  ? tx(
                      `${marker.id} · equivalent drive ${frame.pumpHz.toFixed(1)} Hz`,
                    )
                  : marker.id) +
          (changed && !comparison ? ` ${reading > previous! ? "↑" : "↓"}` : "");
        marker.button.title = tx(
          building
            ? `${building.id}: ${severity === "suspect" ? "sensor disagreement — verify before control" : severity === "normal" ? "within displayed comfort band" : "outside displayed comfort band"}. Click to inspect or operate its supplying branch.`
            : "Click to inspect and operate this circuit",
        );
        marker.button.classList.toggle(
          "mission-affected",
          affected.includes(marker.plant ? "ST01" : marker.id),
        );
        marker.button.classList.toggle(
          "active",
          marker.plant === (view === "plant") &&
            marker.id === (marker.plant ? latest.current.equipment : selected),
        );
        marker.button.classList.toggle("plant-label", marker.plant);
      }
      network.traverse((obj) => {
        if (!(obj instanceof T.Mesh) || !obj.userData.zone) return;
        const z = frame.zones.find((z) => z.id === obj.userData.zone);
        if (!z) return;
        const material = obj.material as T.MeshStandardMaterial;
        const temperature = obj.userData.reverse ? z.returnC : z.supplyC;
        const value = T.MathUtils.clamp((temperature - 25) / 35, 0, 1);
        material.color.setHSL(
          obj.userData.reverse ? 0.57 - value * 0.08 : 0.14 - value * 0.13,
          0.92,
          0.5,
        );
        material.emissive.copy(material.color);
        material.emissiveIntensity =
          affected.length && !affected.includes(obj.userData.zone)
            ? 0.15
            : 0.85;
      });
      for (const b of frame.buildings) {
        const m = thermalMeshes.get(b.id);
        if (m) {
          (m.material as T.MeshBasicMaterial).color.set(
            b.quality === "suspect"
              ? "#ec84eb"
              : b.indoorC < 18
                ? "#ff5264"
                : b.indoorC < 20
                  ? "#49b7ff"
                  : b.indoorC > 23
                    ? "#ff954f"
                    : "#7bd9bb",
          );
          m.userData.warning =
            b.quality === "suspect" || b.indoorC < 20 || b.indoorC > 23;
        }
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
      const portraitChanged = camera.aspect < 1 !== w / h < 1;
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
    let ambientTime = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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
      const animated = motion.current && !reducedMotion.matches;
      if (animated) ambientTime += Math.min(dt, 0.1);
      atmosphere.update(ambientTime, lighting.current);
      model.movingCars.forEach((car, i) => {
        const lane = i % 6,
          direction = lane % 2 ? 1 : -1;
        const progress = (Math.floor(i / 6) * 137.5 + ambientTime * 7.5) % 550;
        car.position.set(
          [-128.2, -119.8, -4.2, 4.2, 119.8, 128.2][lane],
          0,
          direction > 0 ? -330 + progress : 220 - progress,
        );
        car.rotation.y = direction > 0 ? 0 : Math.PI;
      });
      el.dataset.ambientTime = ambientTime.toFixed(2);
      el.dataset.ambientMotion = String(animated);
      el.dataset.identity = atmosphere.identity.title;
      if (previousDusk !== lighting.current) {
        previousDusk = lighting.current;
        const dark = lighting.current;
        const colour = dark
          ? shanghai
            ? "#657c99"
            : "#868895"
          : shanghai
            ? "#bac9d3"
            : "#b1cbdc";
        (scene.background as T.Color).set(colour);
        (scene.fog as T.FogExp2).color.set(colour);
        sun.color.set(dark ? (shanghai ? "#ffd5b3" : "#ffbc7e") : "#ffe8c5");
        sun.intensity = dark ? (shanghai ? 1.05 : 1.45) : 3.8;
        skyLight.color.set(dark ? "#517cad" : "#bfd5ef");
        skyLight.intensity = dark ? 0.72 : 0.48;
        model.materials.warm.emissiveIntensity = dark ? 1.25 : 0.25;
        flowMaterial.emissiveIntensity = dark ? 2 : 0.85;
        returnMaterial.emissiveIntensity = dark ? 1.5 : 0.65;
        plantLights.forEach((light) => (light.intensity = dark ? 180 : 0));
      }
      professional.update(lighting.current);
      if (destination.active) {
        const alpha = 1 - Math.exp(-dt / 0.24);
        camera.position.lerp(destination.position, alpha);
        orbit.target.lerp(destination.target, alpha);
        if (camera.position.distanceTo(destination.position) < 0.05)
          destination.active = false;
      }
      orbit.update();
      for (const path of paths) {
        const flow =
          latest.current.frame.zones.find((z) => z.id === path.zone)?.flowM3h ||
          0;
        path.speed += (flow - path.speed) * (1 - Math.exp(-dt * 3));
        path.phase = (path.phase + (dt * 0.024 * path.speed) / 15) % 1;
      }
      for (const m of thermalMeshes.values()) {
        const pulse =
          m.userData.warning &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0.5 + 0.5 * Math.sin(t * 3)
            : 0;
        m.scale.setScalar(1 + pulse * 0.035);
        (m.material as T.MeshBasicMaterial).opacity = m.userData.warning
          ? 0.55 + pulse * 0.4
          : 0.7;
      }
      if (network.visible)
        for (let i = 0; i < 72; i++) {
          const path = paths[Math.floor(i / 12)],
            phase = ((i % 12) / 12 + path.phase) % 1;
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
      if (controlAnchor.current) {
        const anchor = controlAnchor.current;
        const selectedPoint = positions
          .get(
            latest.current.view === "plant"
              ? latest.current.equipment
              : latest.current.selected,
          )
          ?.clone()
          .project(camera);
        const px = selectedPoint
          ? (selectedPoint.x * 0.5 + 0.5) * el.clientWidth + 22
          : 20;
        const py = selectedPoint
          ? (-selectedPoint.y * 0.5 + 0.5) * el.clientHeight + 20
          : 150;
        anchor.style.left = `${Math.max(12, Math.min(el.clientWidth - anchor.offsetWidth - 12, px))}px`;
        anchor.style.top = `${Math.max(120, Math.min(el.clientHeight - anchor.offsetHeight - 20, py))}px`;
        anchor.style.display =
          props.imported || latest.current.suspended ? "none" : "";
      }
      renderer.info.reset();
      ao.enabled = quality.current;
      bloom.enabled = quality.current && lighting.current;
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
      professional.dispose();
      flowMaterial.dispose();
      returnMaterial.dispose();
      model.textures.forEach((t) => t.dispose());
      environment.dispose();
      outdoorEnvironment?.dispose();
      sun.shadow.dispose();
      ao.dispose();
      output.dispose();
      antialias.dispose();
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.remove();
      runtime.current = null;
    };
  }, [props.imported, props.frame.cityId]);
  useEffect(
    () => runtime.current?.update(),
    [
      props.frame,
      props.selected,
      props.layer,
      props.view,
      props.equipment,
      props.affected,
      props.comparison,
      props.findings,
      locale,
    ],
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
      <div
        ref={controlAnchor}
        className="scene-control-anchor"
        data-open={!!props.controlContent}
      >
        {tx(
          props.controlContent || (
            <button className="operate-trigger" onClick={props.onOperate}>
              {tx("⚙ Operate")}
              {tx(" ")}
              {tx(props.view === "plant" ? props.equipment : props.selected)}
            </button>
          ),
        )}
      </div>
      {tx(
        error && (
          <div className="scene-error" role="alert">
            {tx(error)}
          </div>
        ),
      )}
      <div className="render-settings">
        <button
          className="viewport-bim"
          onClick={props.onOpenBim}
          aria-label={tx("Open connected BIM Studio")}
          title={tx(
            "Inspect source BIM with the selected asset, heat supply chain and agent context",
          )}
        >
          ▧ {tx("BIM Studio")}
        </button>
        <button onClick={() => setReferenceOpen(true)}>
          {tx("City vision")}
        </button>
        <button
          onClick={() => setAmbientMotion(!ambientMotion)}
          aria-pressed={ambientMotion}
          title={tx(
            "Decorative traffic and water motion; does not advance simulation",
          )}
        >
          {tx(ambientMotion ? "City life: on" : "City life: paused")}
        </button>
        <button
          onClick={() => setDusk(!dusk)}
          aria-pressed={dusk}
          title={tx(
            "Art-directed lighting, independent of the simulation clock",
          )}
        >
          {tx(dusk ? "☾ Blue hour" : "☀ Winter daylight")}
        </button>
        <button
          onClick={() => setHighQuality(!highQuality)}
          aria-pressed={highQuality}
        >
          {tx(highQuality ? "Quality: cinematic" : "Quality: performance")}
        </button>
      </div>
      <dialog
        className="city-reference-dialog"
        ref={referenceDialog}
        aria-label={tx("City visual reference")}
        onCancel={() => setReferenceOpen(false)}
      >
        <header>
          <div>
            <small>{tx("AI-GENERATED VISION · NOT LIVE 3D")}</small>
            <h2>{tx(identity.title)}</h2>
          </div>
          <button
            onClick={() => setReferenceOpen(false)}
            aria-label={tx("Close city reference")}
          >
            ×
          </button>
        </header>
        <p>{tx(identity.details)}</p>
        {referenceOpen && <img src={identity.image} alt={tx(identity.title)} />}
        <p>
          {tx(
            "Fictional district composition inspired by local landmarks. This image is a visual target, not an as-built survey or the orbitable simulation.",
          )}
        </p>
      </dialog>
      <div className="orbit-hint">
        {tx("DRAG TO ORBIT ")}
        <span>·</span>
        {tx(" SCROLL TO EXPLORE ")}
        <span>·</span>
        {tx(" CLICK TO INSPECT")}
      </div>
    </div>
  );
}
