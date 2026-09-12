import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Twin } from "./types";
import { fmt, tone } from "./types";

type Props = {
  twin: Twin;
  selected: string;
  onSelect: (id: string) => void;
  layer: string;
  view: number;
};
const palette = {
  blue: 0x65b9ff,
  amber: 0xf2b76b,
  mint: 0x6cdbc1,
  violet: 0xb79aff,
};
export default function DistrictScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    control = useRef<OrbitControls | null>(null);
  const [failed, setFailed] = useState(false);
  latest.current = props;
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x101a22, 1);
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D secondary heating network. Select buildings using the labelled buttons or asset list.",
    );
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x101a22, 90, 190);
    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 250);
    camera.position.set(48, 48, 60);
    const orbit = new OrbitControls(camera, renderer.domElement);
    control.current = orbit;
    orbit.target.set(-3, 0, 0);
    orbit.enableDamping = true;
    orbit.maxPolarAngle = Math.PI * 0.46;
    orbit.minDistance = 25;
    orbit.maxDistance = 115;
    orbit.saveState();
    const ambient = new THREE.HemisphereLight(0xc8e5f5, 0x24343b, 2.2);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffecd5, 3.0);
    sun.position.set(-20, 45, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -40,
      right: 40,
      top: 40,
      bottom: -40,
    });
    sun.shadow.bias = -0.0007;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x75bed0, 1.5);
    fill.position.set(25, 14, -30);
    scene.add(fill);
    const box = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      colour: number,
      parent: THREE.Object3D = scene,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: colour,
          roughness: 0.75,
          metalness: 0.15,
        }),
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    box(60, 0.6, 48, -3, -0.8, 1, 0x283840);
    box(59.5, 0.05, 47.5, -3, -0.45, 1, 0x192a31);
    const grid = new THREE.GridHelper(160, 80, 0x314049, 0x24313a);
    grid.position.y = -1.15;
    scene.add(grid);
    // Schematic geometry, deliberately not presented as a surveyed GIS/BIM estate.
    [-18, -5, 7, 19].forEach((z) => {
      box(54, 0.08, 2.4, -2, -0.35, z, 0x34444a);
      for (let x = -26; x < 24; x += 3)
        box(1.2, 0.015, 0.06, x, -0.29, z, 0x798385);
    });
    box(2.4, 0.08, 40, -24, -0.34, 0, 0x34444a);
    // Station: heat exchanger, two circulation pumps, primary boundary connection.
    const station = new THREE.Group();
    station.position.z = 26;
    scene.add(station);
    box(8, 0.3, 7, -25, -0.1, -14, 0x667577, station);
    box(6.5, 3.1, 5, -25, 1.55, -14, 0x798784, station);
    box(6.9, 0.3, 5.4, -25, 3.25, -14, 0x344a4e, station);
    for (let i = 0; i < 9; i++)
      box(0.08, 1.8, 2.6, -27 + i * 0.24, 1.65, -11.4, 0xaec4c0, station);
    for (let i = 0; i < 2; i++) {
      const pump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.35, 16),
        new THREE.MeshStandardMaterial({
          color: 0x65c8bb,
          metalness: 0.5,
          roughness: 0.3,
        }),
      );
      pump.rotation.z = Math.PI / 2;
      pump.position.set(-24 + i * 1.6, 1, -10.6);
      station.add(pump);
    }
    const parts = new Map<
      string,
      {
        base: THREE.Mesh;
        roof: THREE.Mesh;
        body: THREE.Mesh;
        label: HTMLButtonElement;
        point: THREE.Vector3;
      }
    >();
    const labels = document.createElement("div");
    labels.className = "scene-labels";
    el.appendChild(labels);
    const stationLabel = document.createElement("span");
    stationLabel.className = "building-label mint";
    stationLabel.style.pointerEvents = "none";
    stationLabel.textContent = "HX-01 · substation";
    labels.appendChild(stationLabel);
    for (const b of latest.current.twin.buildings) {
      const [x, z] = b.position,
        h = 2 + b.floors * 0.65;
      const g = new THREE.Group();
      g.userData.asset = b.id;
      scene.add(g);
      const base = box(6.8, 0.13, 5.8, x, -0.1, z, palette[tone(b)], g);
      const body = box(5.8, h, 4.4, x, h / 2, z, 0x859598, g);
      body.userData.asset = b.id;
      box(6.05, 0.15, 4.65, x, h - 0.4, z, 0x41555b, g);
      const roof = box(6.1, 0.14, 4.7, x, h + 0.02, z, 0x41555b, g);
      box(1.4, 0.6, 1.5, x + 1, h + 0.36, z - 0.5, 0x62777d, g);
      // Repeated balconies/window ribbons make the residential typology legible.
      for (let floor = 0; floor < b.floors; floor++) {
        const y = 0.8 + floor * 0.65;
        for (let col = 0; col < 6; col++) {
          const warm = (col + floor + Number(b.id.slice(1))) % 5 === 0;
          const colour = warm ? 0xcdb785 : 0x284953;
          box(0.53, 0.36, 0.035, x - 2.18 + col * 0.86, y, z + 2.22, colour, g);
          box(0.53, 0.36, 0.035, x - 2.18 + col * 0.86, y, z - 2.22, colour, g);
        }
        box(5.85, 0.055, 0.23, x, y - 0.26, z + 2.25, 0xa3abaa, g);
      }
      box(0.8, 0.7, 0.06, x, 0.35, z + 2.24, 0x1f383d, g);
      const label = document.createElement("button");
      label.type = "button";
      label.className = "building-label";
      label.onclick = () => latest.current.onSelect(b.id);
      labels.appendChild(label);
      parts.set(b.id, {
        base,
        body,
        roof,
        label,
        point: new THREE.Vector3(x, h + 1.45, z),
      });
    }
    for (let i = 0; i < 34; i++) {
      const x = -19.5 + (i % 6) * 7.5,
        z = -15 + Math.floor(i / 6) * 7;
      if (
        latest.current.twin.buildings.some(
          (b) =>
            Math.abs(b.position[0] - x) < 3.5 &&
            Math.abs(b.position[1] - z) < 3,
        )
      )
        continue;
      box(0.16, 1.1, 0.16, x, 0.45, z, 0x667161);
      const tree = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.85, 0),
        new THREE.MeshStandardMaterial({ color: 0x3d695c, roughness: 1 }),
      );
      tree.position.set(x, 1.55, z);
      tree.castShadow = true;
      scene.add(tree);
    }
    const particles: {
      mesh: THREE.Mesh;
      curve: THREE.CurvePath<THREE.Vector3>;
      phase: number;
      reverse: boolean;
      zone: number;
    }[] = [];
    function pipe(
      points: number[][],
      colour: number,
      reverse: boolean,
      zone: number,
      radius = 0.095,
    ) {
      const curve = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 1; i < points.length; i++)
        curve.add(
          new THREE.LineCurve3(
            new THREE.Vector3(...points[i - 1]),
            new THREE.Vector3(...points[i]),
          ),
        );
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, points.length * 10, radius, 6, false),
        new THREE.MeshStandardMaterial({
          color: colour,
          emissive: colour,
          emissiveIntensity: 0.4,
          metalness: 0.35,
          roughness: 0.4,
        }),
      );
      scene.add(mesh);
      for (let j = 0; j < 5; j++) {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 1.7, 6, 6),
          new THREE.MeshBasicMaterial({ color: colour }),
        );
        scene.add(dot);
        particles.push({ mesh: dot, curve, phase: j / 5, reverse, zone });
      }
    }
    for (let row = 0; row < 3; row++) {
      const z = -11 + row * 12;
      for (const reverse of [false, true]) {
        const offset = reverse ? 0.65 : 0,
          colour = reverse ? 0x63ccb9 : 0xeaae65;
        pipe(
          [
            [-23 + offset, 0.22, 15],
            [-21 + offset, 0.22, 15],
            [-21 + offset, 0.22, z + 3.7 + offset],
            [14, 0.22, z + 3.7 + offset],
          ],
          colour,
          reverse,
          row,
          0.14,
        );
        for (let col = 0; col < 4; col++) {
          const x = -14 + col * 9 + offset;
          pipe(
            [
              [x, 0.23, z + 3.7 + offset],
              [x, 0.23, z + 2.55],
              [x, 0.6, z + 2.55],
            ],
            colour,
            reverse,
            row,
            0.09,
          );
        }
      }
    }
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = [0, 0];
    const start = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const click = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = el.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      for (const hit of ray.intersectObjects(scene.children, true)) {
        const asset =
          hit.object.userData.asset || hit.object.parent?.userData.asset;
        if (asset) {
          latest.current.onSelect(asset);
          break;
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", start);
    renderer.domElement.addEventListener("pointerup", click);
    const onLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    const resize = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resize.observe(el);
    let frame = 0,
      previousTwin: Twin | null = null,
      previousSelected = "",
      previousLayer = "";
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      if (document.hidden) return;
      orbit.update();
      const p = latest.current;
      if (
        previousTwin !== p.twin ||
        previousSelected !== p.selected ||
        previousLayer !== p.layer
      ) {
        p.twin.buildings.forEach((b) => {
          const item = parts.get(b.id)!;
          const colour =
            p.layer === "flow"
              ? 0x6cdbc1
              : p.layer === "quality"
                ? b.quality === "suspect"
                  ? palette.violet
                  : 0x668587
                : palette[tone(b)];
          (item.base.material as THREE.MeshStandardMaterial).color.setHex(
            colour,
          );
          const material = item.roof.material as THREE.MeshStandardMaterial;
          material.color.setHex(b.id === p.selected ? colour : 0x41555b);
          material.emissive.setHex(b.id === p.selected ? colour : 0x000000);
          material.emissiveIntensity = 0.15;
          item.label.className = `building-label ${tone(b)} ${b.id === p.selected ? "selected" : ""}`;
          item.label.textContent =
            b.id +
            "  " +
            (p.layer === "flow"
              ? fmt(b.flowM3h) + " m³/h"
              : p.layer === "quality"
                ? b.quality
                : fmt(b.indoorC) + "°");
          item.label.setAttribute(
            "aria-label",
            `Select ${b.id}, ${fmt(b.indoorC)} degrees, ${b.quality}`,
          );
          item.label.setAttribute("aria-pressed", String(b.id === p.selected));
        });
        previousTwin = p.twin;
        previousSelected = p.selected;
        previousLayer = p.layer;
      }
      parts.forEach((item) => {
        const v = item.point.clone().project(camera);
        item.label.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) * el.clientWidth) / 2}px, ${((-v.y + 1) * el.clientHeight) / 2}px)`;
        item.label.style.display =
          Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1 ? "none" : "";
      });
      const sv = new THREE.Vector3(-25, 5, 12).project(camera);
      stationLabel.style.transform = `translate(-50%, -50%) translate(${((sv.x + 1) * el.clientWidth) / 2}px, ${((-sv.y + 1) * el.clientHeight) / 2}px)`;
      stationLabel.style.display =
        Math.abs(sv.x) > 1 || Math.abs(sv.y) > 1 || sv.z > 1 ? "none" : "";
      particles.forEach((part) => {
        const speed = Math.max(
          0.2,
          Math.min(2, p.twin.zones[part.zone].flowM3h / 15),
        );
        let u = (part.phase + (reduced ? 0 : time * 0.00004 * speed)) % 1;
        if (part.reverse) u = 1 - u;
        part.mesh.position.copy(part.curve.getPoint(u));
      });
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      orbit.dispose();
      control.current = null;
      renderer.domElement.removeEventListener("pointerdown", start);
      renderer.domElement.removeEventListener("pointerup", click);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      el.replaceChildren();
    };
  }, []);
  useEffect(() => {
    const c = control.current;
    if (!c) return;
    c.reset();
    if (props.view % 2) {
      c.object.position.set(-3, 75, 0.1);
      c.target.set(-3, 0, 0);
    }
    c.update();
  }, [props.view]);
  return (
    <div className="district-scene" ref={host}>
      {failed && (
        <div className="scene-fallback">
          <strong>3D rendering is unavailable on this device.</strong>
          <p>
            The physical twin still works. Select any building in the asset list
            below.
          </p>
        </div>
      )}
    </div>
  );
}
