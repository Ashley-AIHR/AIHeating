# Winter-city vision demonstrator

The primary experience is an authored Yinchuan-inspired residential district, not a surveyed reconstruction. The supplied winter district and blue-and-steel station renders are the art direction. Dark operational chrome surrounds a sunlit, richly modelled winter environment. Geometry is orbitable and equipment detail belongs to the same scene, selection and timeline. BIM remains an optional inspection tool.

Implementation: detailed modular architecture, balconies and roof equipment; landscaped courtyards, snow, roads, crossings, vehicles and a surrounding skyline; cutaway station with heat exchangers, pumps, flanged headers, valves, cabinets and drainage. Repeated geometry is instanced. Building temperatures and network overlays use the same session simulation as inspectors, alarms, replay, forecasts and agent tools.

Runtime: native Node.js on Render. The physical engine moves to a Node worker thread, using the existing deterministic fixture, an analytical solution of the three-branch hydraulic equations, packet transport and exact piecewise-linear building thermal integration. The Python engine remains an offline numerical oracle, not a runtime dependency. Existing bounded optimisation and operator-approval constraints remain in force.

Acceptance: compare all five scenarios and intervention trajectories with the Python oracle; run API/security tests and production build; exercise orbit, plant inspection, scenario reset, replay and optimisation in a browser; inspect district and mechanical screenshots. Visual fidelity is assessed from actual browser output, not a generated image substituted for 3D.
