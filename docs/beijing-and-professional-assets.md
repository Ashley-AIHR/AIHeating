# Beijing and professional live-scene assets

## Scope

Beijing is a third synthetic heating case, with independent weather/source settings and city-aware agent context, forecasts, controls and replay. Initial imbalance inputs: outdoor −4°C, solar 65 W/m², supply 49°C, pump 43 Hz. Cold and warming inputs are authored scenarios, not local measurements or climate normals. All cities still share twelve aggregate building archetypes.

Public context: [Beijing heating](https://english.beijing.gov.cn/livinginbeijing/Housing1/202005/t20200513_1895777.html), [Beijing hutong](https://english.beijing.gov.cn/beijinginfo/culture/202005/t20200515_1898145.html). Courtyards and the China Zun-inspired skyline form an unregistered visual composition. No Shanghai river/landmarks or Yinchuan Helan ridge is reused for Beijing. The observation gateway remains restricted to its Yinchuan reference.

The built-in image-generation reference and exact prompt are in `beijing-image-prompt.md`; the original was preserved and copied to `public/site-assets/beijing-district-vision-v1.png`. City vision explicitly labels generated references as distinct from live 3D.

## Live rendering changes

- Public [Poly Haven modular apartment facade](https://polyhaven.com/a/modular_urban_apartments_facade): actual textured window frames, recessed wall openings and cornices, GPU-instanced onto the twelve mapped building IDs. Existing authored roof equipment and new balcony rails remain connected to those IDs.
- Public textured tree/shrub meshes, a separately prepared leafless winter variant and an outdoor HDR lighting environment. Shanghai retains some broadleaf foliage; winter streets use the leafless variant. These are illustrative vegetation assets, not verified local botanical species.
- Local Blender performs deterministic source preparation, not image-to-3D reconstruction. Source downloads are outside git. Render serves the prepared files directly; no Blender, Python or external asset API is needed at runtime.
- Main 3D toolbar has **BIM Studio** in district and mechanical views. It opens the existing connected studio without remounting the world canvas, retaining selection, heat-chain context, agent mission and studio state.
- CSP permits local `blob:` fetches needed to decode GLB-embedded textures. It still disallows external browser API connections. Texture errors cannot silently mark facade assets ready; fallback is explicitly reported.

Licences, source URLs and binary checksums: `public/visual-models/manifest.json`. Preparation scripts: `scripts/fetch-visual-sources.mjs`, `scripts/prepare-visual-assets.py`.

## Honest quality boundary

This is a material asset-quality upgrade, **not reference-level photorealism achieved**. The wider context buildings, terrain, industrial assemblies and global illumination still need a coordinated high-fidelity scene production pass. The live renderer is rasterised Three.js with ambient occlusion, not the path-traced image generator. Public meshes do not automatically reconstruct a coherent photographed district. Do not present the generated image as orbitable geometry or field telemetry.

## Verification

`npm run test:operations` includes Beijing physical-state, agent-boundary, forecast/control and stale-plan checks. `npm run test:city-life` checks all three images, fully loaded professional assets/HDR, errors, independent decorative motion, direct viewport BIM entry in both views, preserved world canvas and Chinese/mobile access. Existing i18n, Shanghai manual operation, connected-studio and vision tests remain applicable. Provider tests use fixtures, not paid live model calls.
