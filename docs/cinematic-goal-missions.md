# Cinematic city context and precise operating missions

## Operator workflow

Select a building in the orbitable district, then **Set a precise operating goal**, or select a specialist in **Agents**. Set the scope, numerical target, deadline and all-building comfort limits. Building targets use the supplying branch; enabling shared control also permits station temperature and pump changes. There is no invented individual building actuator.

Six specialist missions share the same world, evidence, simulator and streamed orchestration:

- Comfort recovery: target temperature, evaluated for every target building with ±0.3°C tolerance.
- Heat budget: cumulative heat reduction against an unchanged-control baseline to the deadline. District scope uses station heat; local scope uses heat delivered to the selected buildings.
- Hydraulic balancing: target maximum indoor-temperature spread across a branch or district. This is a thermal distribution objective, not proof of hydraulic commissioning.
- Pump efficiency: district-wide pump electricity reduction; the model has a shared equivalent pump.
- Sensor investigation: compare synthetic sensor and physical-model evidence, with no optimisation tool or application authority.
- Engineering review: inspect linked item-level BIM evidence and connected heat paths. Source geometry does not establish an equipment fault or a verified actuator mapping.

The operator's structured goal is bound on the server. The LLM cannot replace it through tool arguments. Different target values change the numerical search, not merely the report wording. The existing weighted optimiser remains available.

The search uses two 90-minute control blocks within existing control/ramp limits and four bounded pattern-search scales. Every candidate is rolled out for three hours. Targets are assessed at the selected deadline; comfort is checked every five minutes throughout the rollout. Before the deadline, existing comfort violations must not worsen; from the deadline onwards, all buildings must satisfy the complete specified band. Existing physical verification remains mandatory.

Unmet targets return the best tested outcome, affected comfort constraints and a non-applicable 3D trajectory. They receive no application token. A bounded search failing to find a solution does not prove physical impossibility. A successful plan still requires operator approval and applies only the next 30 simulated minutes. Precise goals disable unattended three-cycle operation because the current implementation does not persist an absolute deadline or cumulative savings baseline across replans. Revisit the target after each approved step. Generic three-cycle missions remain available.

Selecting another asset, city or scenario clears the goal draft. Editing a goal clears the previous plan and report. State changes still invalidate application authority. No real-world control is connected.

## Visual implementation and limits

Three new generated city panoramas supply detailed distant scenery. A scenic dome uses deliberately art-directed, mirrored UV mapping, not geospatial/equirectangular calibration. This avoids treating an ordinary generated panorama as calibrated spherical photography. Distant repeated imagery can be visible during a full orbit. The default district camera and local foreground remain genuine 3D. Imported CC0 façade/vegetation meshes, item picking, network animation, direct controls and BIM inspection remain intact.

The cinematic treatment adds warm/cool colour separation, a restrained vignette, lower-angle warm light and richer shadows. Operational objects are not blurred by depth-of-field. A performance toggle disables the additional grading. Buildings are still an engineering demonstrator assembled from public meshes, not photogrammetric replicas of the reference photographs. This update improves scenery and lighting; it does **not** claim to achieve the reference images' full photorealism at every orbit angle. No remote 4090 reconstruction job was run.

Implementation references: [Three.js backgrounds](https://threejs.org/manual/en/backgrounds.html), [Scene](https://threejs.org/docs/pages/Scene.html). City profiles remain fictional, based on city climate context; no new measured city feed is introduced.

## Generated asset provenance and prompt set

Mode: **built-in image generation**, one generation per city, using the existing city reference as art direction. The references were inspected first and remain unchanged. No CLI image generation or image-to-mesh conversion was used.

Saved application assets:

- `public/site-assets/beijing-environment-v1.png`, inspired by `beijing-district-vision-v1.png`.
- `public/site-assets/shanghai-environment-v1.png`, inspired by `shanghai-district-vision-v2.png`.
- `public/site-assets/yinchuan-environment-v1.png`, inspired by `yinchuan-district-vision-v2.png`.

Final prompt briefs (condensed record):

**Shared:** Photorealistic-natural, production-ready wide 2:1 city environment panorama, maximum architectural detail; reference image for art direction only. Request a level horizon, aerial camera around 45 metres, continuous distant urban context, seamless edges and cinematic natural light. Keep depicted objects distant from the camera. No heating plant, glowing pipes, interface, text or labels. Fictional city-inspired setting, not georeferenced photography. The generated outputs did not meet strict calibrated 360° geometry, so the application explicitly uses them as scenic imagery.

**Beijing:** Snow-covered grey-brick siheyuan and grey tiled roofs, red gates, bare winter trees and broad avenues; dense beige mid-rise residential layers; China Zun and CCTV-inspired CBD in a distant quadrant, western hills. Winter golden-hour amber sun, blue shadows and layered clouds. Preserve realistic scale and material/weather detail.

**Shanghai:** Huangpu river bend, Bund stone architecture, shikumen lanes and bare plane trees; Shanghai Tower, Oriental Pearl and World Financial Center in a distant skyline cluster. Wet winter streets, no snow, humid blue haze and pearl-blue/amber sunset.

**Yinchuan:** Helan mountain ridges, arid foothills, reed wetlands and frozen lakes, compact tan residential districts, Gulou-inspired civic tower and red pavilion. Dry, clear winter air, selective snow, silver-blue ice and golden sunlight; no Shanghai-style skyscraper skyline.

## Verification

`npm run test:goals` covers server validation, real target-dependent schedules, shared-control restrictions, infeasible-plan refusal, exact-deadline energy accounting, comfort checks between timeline samples, immutable LLM goal binding, diagnostic-only tool permissions, streamed fixture execution, actual simulator application, bilingual UI, fullscreen and mobile behaviour. The provider transport is a labelled fixture; it does not prove current live DeepSeek availability or reliability.

`npm run test:operations`, `npm run test:i18n`, `npm run test:studio` and `npm run test:city-life` retain physics, language, item-BIM and three-city regression checks. City browser tests require successful scenery, public mesh, vegetation and HDR loading before taking screenshots.
