# Connected BIM work studio

The main workspace rail exposes **BIM Studio**. The asset inspector and Evidence library also open the same in-session studio, not a separate route. The old `/engineering` URL remains a standalone compatibility entry point.

The studio retains real source-component inspection, class filtering, local GLB import, orbit/pan, focus/isolation/hiding, variable section planes, surface measurements, saved viewpoints, review notes, provenance and JSON review export. Its in-memory state survives closing and reopening; closing suspends BIM rendering without destroying the model. The original city canvas stays mounted, with rendering suspended while the studio is open. Review export is necessary for persistence across reloads.

## Operating loop

The supply-chain strip uses the **same current Twin and selected asset** as the district: station → branch → connected buildings. Choosing a chain node changes the district selection too. Displayed values are current synthetic station/circuit readings, never values assigned to the public mesh. The controls button returns directly to the selected circuit's existing 3D preview/approval controls.

From the studio, diagnostic or optimisation requests carry `engineeringReview` into the existing streamed agent loop. Source component identity, last ten picked measurements and last five notes for that component accompany the current city, circuit, revision, mechanical context where applicable, and numerical diagnosis. The server:

- validates known source hashes and resolves public component metadata itself;
- tags local geometry as unverified and recomputes distances from finite points;
- labels notes and picked points as untrusted review observations;
- emits `inspect_engineering_review` evidence before the numerical/LLM loop;
- retains that evidence for the independent report step;
- does not grant new tools, geometry-derived telemetry, equipment bindings or actuation privileges.

The studio displays the shared streamed public report and executed tool events. **Review mission & simulation plan** returns to the same mission's forecast, bounded verification and explicit simulator-approval controls. The resulting change is visible in the district and studio on return. A BIM pick is deliberately *not* treated as a validated equipment mapping.

## Boundaries and language

Public buildingSMART Duplex MEP and OpenDHN remain independent references. The supply-chain strip is the fictional Chinese district simulation, not the OpenDHN benchmark. Reviewing the benchmark cannot remove a simulator pipe or close a real valve. Notes are evidence, not commands. No field system is connected.

English/Simplified Chinese support now includes the full engineering controls and connected studio. Source names, IFC identities and raw property JSON retain their source format. Language switching does not rewrite existing agent reports or alter filters, source IDs or physics.

## Verification

- `npm run test:operations`: source identity/measurement validation and agent prompt, event and reporting evidence tests, alongside existing control and stream tests.
- `npm run test:engineering` and `npm run test:engineering:browser`: actual public geometry, orbit, real raycasting measurements, import, exports and independent topology analysis.
- `npm run test:studio`: integrated browser workflow, retained review, shared circuit selection, English/Chinese, review export, mobile and a BIM-originated agent plan applied to the actual numerical simulator. Uses the isolated **provider fixture**, not live DeepSeek.
- `BASE_URL=... npm run test:studio`: non-paid deployed UI checks; skips agent/provider calls and simulator application.
