# Interactive reference workspace — 12 September 2026

The user approved **interactive imagery first, clearly labelled, with genuine 3D later**. This release replaces the default procedural scene with two linked AI-generated reference renderings. It does not claim that image generation produces an engineering-accurate digital twin.

## Included

- District: winter Chinese residential estate, twelve illustrative building anchors, heating-station drill-down, indoor reading/flow/identity overlays.
- Mechanical: station cutaway with two plate heat exchangers, one aggregate pump-set selector, secondary headers and a motor-control cabinet.
- A single backend simulation session and clock. View, layer, camera and asset changes do not advance the model. Branch navigation retains a selected building when it belongs to the chosen branch.
- Zoom from 100% to 300%; drag to pan after zooming. Focus the scene and use +/−, arrow keys or Home. A separate asset selector remains usable without the image.
- Existing deterministic diagnostics, three-hour five-strategy comparisons, explicit confirmation and server-side re-verification for simulator changes.
- Server-side OpenRouter investigation, with operator access code and numeric tool evidence. Provider secrets are never included in the browser bundle or evidence export. UI-context changes mark an earlier AI response as belonging to a different asset.
- Native modal focus management; mobile layouts; reduced-motion support. No external font request or weaker content-security policy is required.

## Provenance

Both 1672 × 941 PNGs were created by the available built-in image-generation tool using the user's previously generated combined design as style/material inspiration. An exact “Image 2.5” model selector was not exposed. They are generated concepts, not manufacturer assets, photographs of a real site, certified assemblies or surveyed geometry.

| Imported asset | Original generation filename | Use |
|---|---|---|
| src/operations/assets/district-reference.png | exec-584c4a16-bc90-436a-9416-8b5689bae4ce.png | District scene |
| src/operations/assets/mechanical-reference.png | exec-4fa77427-3dc2-4952-9646-a3bba34206a3.png | Mechanical scene |

Vite imports the images into content-hashed assets. Only the active scene is requested by the browser; no raster image contains operational text or numeric readings. Labels and metrics are HTML/SVG overlays populated from the simulator. Complete prompts are retained in `docs/reference-render-prompts.md`.

## Interpretation boundaries

The screen-space anchors are illustrative visual associations with synthetic model IDs. The imagery does not establish physical topology, metric scale, pipe diameters, individual pump capacities, exchanger duties, equipment condition or connectivity. Buildings shown in the art are not guaranteed to match the floor counts or heated areas of the simulation archetypes.

Pump and header panels explicitly show aggregate station-boundary simulation results. HX-01, HX-02 and MCC are reference-only items with no individual readings. The 20–23 °C display band and 18 °C trajectory floor are demonstrator settings, not a legal-compliance or field-safety determination. The model's optimisation objective uses its own documented discomfort penalty.

The history trace contains simulated readings, including a known synthetic sensor bias in the sensor scenario. Prediction traces come from physical-model rollouts and are labelled separately. Comparison values are three-hour increments; heat energy is building-delivered heat, not purchased primary-side energy.

## Route to a genuine spatial twin

Obtain surveyed GIS and as-built CAD/BIM or validated equipment meshes; reconcile asset identity and hydraulic topology; import metric geometry; connect validated telemetry with timestamps and quality flags; calibrate and validate the model. Equipment-level simulation needs new physical components and parameters, not just more detailed artwork. Add genuine orbitable rendering only when those assets and requirements are available.

## Verification

Run `npm run build`, `npm test`, `npm run test:operations`, then start the backend and run `BASE_URL=http://127.0.0.1:3000 npm run test:workspace`.

The browser suite covers linked views, non-mutating navigation, twelve/five hotspots, temperature/flow layers, zoom/reset, stepping, five candidates, confirmed application, invalidated comparisons, sensor diagnosis, export without credentials, mobile overflow, missing-image fallback and both preserved routes. No paid provider calls are part of this suite.

No new server dependencies or Render command changes are required for this UI release. Use the existing Docker web service and `node server/index.mjs`; deployment is a separate operation.
