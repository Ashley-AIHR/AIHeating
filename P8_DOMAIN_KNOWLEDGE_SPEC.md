# P8 Domain Knowledge Specification

`p8_domain_knowledge_v1.json` is the versioned `p8-domain-knowledge-v1` package. It contains 24 bilingual items with ID, title, summary, technical detail, related terms, applicable question categories, project references and item version.

Coverage includes weather compensation; Required/Actual Heat and Avoidable Oversupply; radiator transfer, inertia, effective H/C and solar gain; shared hydraulics, pumps, valves and transport delay; P4/P5/P6 roles, local linearisation and nonlinear verification; uncertainty, solver limit, fallback, infeasibility and safety; Traditional comparison and synthetic-PoC limitations.

Key guarded interpretations:

- AI predicts heat requirement and reduces unnecessary supply; it does not reduce physical need.
- Effective H/C are calibrated synthetic predictive parameters, not measured material properties.
- Transport delay is flow-dependent network travel time; it is not building thermal inertia.
- Branch flows share a pump/pressure operating point and are coupled.
- OSQP solves a local linear optimisation; P1A performs nonlinear verification.
- Supply-temperature action is primary, pump optimisation second, valves third for fine-tuning/redistribution.
- Traditional v1.2 is fairly described as weather compensation plus pump scheduling and commissioned valves.
- All accuracy, safety and savings evidence is synthetic Digital Twin evidence.

Only category-relevant items are selected for each question; the whole package is not sent on every turn.
