# Agentic decision support for Chinese residential district heating

## Executive assessment

The strongest direction for AIHeating is an operator-facing, physics-backed investigation system for a residential secondary network. Its differentiator should be the ability to connect a cold-building observation to plausible causes, ask for missing evidence, compare bounded interventions and preserve an auditable decision. A three-dimensional estate is useful when it makes those relationships easier to inspect; visual realism alone is not an engineering advance.

The evidence cut-off for this assessment is 12 September 2026. Public Chinese deployment announcements, technical research and current agentic-system publications support the direction, but do not establish that an autonomous language-model controller is ready for this application. The recommended positioning is a **commissioning and operational decision-support twin**, initially in simulation and subsequently in read-only shadow operation.

Three research signals matter. Beijing's 2025 retrofit programme explicitly includes sensing, metering and regulation at building entrances as well as upstream equipment.[^1] A July 2026 conference paper investigates graph-based virtual sensing for measurement faults, evaluated in a controlled laboratory.[^4] A June 2026 preprint connects a language-model interface to a physics-based household simulator using structured tool execution, but does not constitute a Chinese district-heating field trial.[^5] Together they suggest an engineering-led product: asset context, data-quality checks, numerical counterfactuals and controlled human decisions.

This release implements a tangible first version of that approach. It does not claim to reproduce those papers' models, achieve a published saving percentage, represent a surveyed estate or control a real heating system.

## 1. The operating scenario

The initial customer archetype is an operator responsible for a northern Chinese residential estate supplied through a heat-exchange substation and a secondary water network. The application boundary starts with secondary-side supply temperature and circulation, continues through parallel distribution branches and building entrances, and ends at an aggregate thermal representation of each building.

The prototype contains twelve synthetic buildings in three groups: near, middle and far. It includes one station supply-temperature control, one pump-frequency control and three branch-valve controls. Individual radiators, risers, apartments, resident preferences and room-by-room readings are not resolved. The illustrated geography is schematic. Physical branch parameters, rather than the rendered pipe lengths, determine the current simulation's transport delay.

This boundary is deliberate. A secondary-network operator needs to distinguish a station-wide shortage from uneven allocation, local building losses and unreliable observations. A full city energy-system model would add complexity before those questions are answered. Domestic hot water, primary-network generation dispatch, storage plants and electricity-market participation remain outside the implemented system.

An appropriate pilot unit is therefore one substation with identifiable branches, known building entrances and accessible historical data. It should have an accountable operations team and a way to inspect disputed readings. “Chinese residential heating” is not itself a calibration dataset: climate, terminal type, building construction, operating arrangements and service obligations must be established for the actual location.

## 2. Industrial pain points and their product consequences

The table below is an engineering synthesis, not an estimate of national fault prevalence. Local validation is required before treating any row as the dominant problem at a particular estate.

| Operating problem | Why a temperature dashboard is insufficient | Product response | Evidence still needed on site |
|---|---|---|---|
| Warm near branches and cold far branches | A spatial temperature pattern alone does not establish hydraulic causation | Relate branch flow, valve position, pressure and delay; compare redistribution with additional supply | Reliable flow/pressure readings, actual valve authority and position feedback |
| An isolated cold reading | Sensor bias, time misalignment and a genuine cold building can look similar | Separate reported reading, model estimate and quality flag | Reference thermometer, timestamp, sensor placement and representative room sampling |
| Weather warms while heat is in transit | The current outdoor temperature does not describe stored heat or future demand | Show transport delay and compare candidate trajectories | Issued weather forecast, thermal response and pipe inventory |
| Additional building heat loss | A network-wide change can affect many buildings for one local problem | Expose building-level energy terms and recommend a local check | Envelope/ventilation information and on-site inspection |
| Alarm-to-dispatch fragmentation | An alarm does not identify what a technician should verify | Attach asset identity, supporting measurements and the next check | Work-order integration, ownership and inspection outcomes |
| Optimisation without a credible baseline | Reduced energy can simply reflect reduced comfort or milder weather | Report comfort and energy together against an unchanged-control trajectory | Matched conditions, approved service criteria and independent evaluation |
| Inconsistent asset and sensor records | A fluent answer can join unrelated measurements incorrectly | Treat asset identity, units, provenance and time as part of the data contract | Tag mapping, device registry, topology and calibration history |

These concerns align with the direction of public programmes rather than proving every implementation detail. Beijing describes a multi-level instrumentation and management upgrade.[^1] Guangrao's municipal example links operational monitoring with warnings and maintenance dispatch.[^2] The IEA DHC TS9 programme identifies digital infrastructure and data integration across the heat chain as an ongoing focus.[^6]

The implication is that integration quality should be a product feature, not an invisible preliminary task. An attractive application that cannot identify the origin and age of a reading may make operational interpretation worse by giving weak data a convincing presentation.

Hydraulic balancing and indoor-temperature-oriented control should not be marketed as newly invented in 2026. A 2022 Chinese secondary-network case study already addresses intelligent balancing.[^3] The newer opportunity is a usable, evidence-preserving investigation workflow around such engineering methods, with evaluation that establishes where it helps.

## 3. What is genuinely current, and what remains experimental

### Tool-governed simulation interfaces

The June 2026 household-digital-twin preprint describes an interface that translates requests into structured simulator inputs, with domain knowledge and governed execution. Its evaluation uses a small curated prompt set and a different residential-energy model.[^5] It supports the plausibility of conversational access to engineering tools; it does not establish reliable control of Chinese secondary networks.

The implemented design follows that architectural principle without claiming research replication. OpenRouter receives a question and can request a small allowlist of local tools. The server executes the numerical work and returns results. A fixed call budget, control validation and application-generated evidence cards keep that workflow bounded.

The commercially relevant test is not whether an agent can produce a convincing explanation. It is whether it selects the right asset and time window, calls the appropriate calculation, notices missing evidence and distinguishes a verified result from an untested hypothesis.

### Sensor-aware twins and graph models

The July 2026 PHM paper uses a heterogeneous spatial–temporal graph neural network to support virtual sensing and measurement-fault detection. Its experimental setting is a controlled Aalborg laboratory, not a Chinese estate.[^4] This makes it a relevant research lead, not a transferable accuracy guarantee.

A future trained model should be compared with simpler residual thresholds and physics-based estimates. A graph should encode meaningful hydraulic/thermal relationships, not just distance in a 3D scene. Evaluation needs held-out operating periods, sensor failures not used for training, missing-data patterns and building-to-building transfer tests.

This release uses a deliberately injected sensor bias and explicit rules. It shows a reported reading separately from simulator truth and labels the fault as known scenario input. It is not a trained virtual sensor. Presenting simulator truth as an independently inferred estimate would overstate the demonstration.

### Robust, uncertainty-aware intervention testing

A deterministic prediction is useful for learning the workflow, but an operational recommendation must account for uncertainty in weather, building parameters, available capacity and observations. The next engineering increment should be an ensemble of plausible trajectories, with a clear account of when the action is unacceptable.

The current comparison evaluates five fixed candidates on the same nonlinear model and synthetic weather path. It reports a demonstration temperature floor, heat delivery, pump electricity and end-state temperature. The preferred candidate minimises an illustrative weighted score. It is not a general optimiser, a robust controller or a live implementation of the repository's frozen P6 MPC.

The BOPTEST framework is a useful reference for repeatable testing through emulators, control interfaces and consistent performance indicators.[^7] The present application uses its own existing P1A physical engine. A future independent benchmark should avoid testing a controller only against the same simplified model used to design it.

### Agent orchestration versus unnecessary agent multiplication

There is no need to introduce a separate language-model persona for every engineering discipline in the first release. Multiple model calls can add cost and inconsistency without providing independent evidence. A shared authoritative state, a small set of numerical tools and a transparent action boundary are more important.

Separate specialist agents would become justifiable if they had genuinely distinct responsibilities and independently testable inputs: for example, interpreting maintenance documents, resolving asset identities and evaluating a forecast ensemble. Their outputs should still be proposals to an explicit decision contract. Agreement between several language models is not physical validation.

## 4. Recommended operator workflow

The workflow begins with an observation: a building is cold, a branch is unbalanced, a reading disagrees with expectations or a weather change is approaching. The operator should see the source and age of the observation before interpreting its significance.

Next, the system establishes context: which building and branch, what the station is doing, whether the measurement is trustworthy and what transport delay is relevant. It distinguishes facts available in the data from hypotheses that need another measurement. This step prevents an injected or stale reading from immediately becoming a control recommendation.

The investigation then compares interventions against holding current controls. In the implemented workbench, the alternatives are branch redistribution, a supply decrease, a supply increase and a pump-frequency increase. Each is evaluated from the same current model state.

The presentation must separate **lowest temperature throughout the horizon** from **minimum temperature at the horizon's end**. An early low point can persist as the trajectory minimum even when the final temperature improves. This distinction was material during live AI integration testing: the first provider response conflated the two. Numerical evidence is now rendered from tool output rather than entrusted to generated prose.

Finally, the operator reviews a recommendation and explicitly approves a simulated change. The server checks that the proposal belongs to that session, is still tied to the current revision, remains within control-change limits and still passes the numerical floor test. The event is recorded. A stale recommendation cannot be replayed after the state changes.

That sequence demonstrates the intended product behaviour. For a real installation, approval would additionally require site-specific operating rules, authenticated roles, independent interlocks and an approved integration pathway. This release has no such field-control pathway.

## 5. The implemented product

### Spatial interface

The new default page is a Three.js residential district scene with selectable apartment-block archetypes, supply and return routes, circulation particles, orbit/zoom controls and a top view. Thermal, flow and sensor-quality layers alter the visible asset information. An accessible building list provides the same selection independently of WebGL.

The scene is connected to numerical state rather than random visual values. Building selection changes the inspector. Scenario changes update the geometry's labels and colours even when a reset reuses the same revision number. Animated particles illustrate direction and relative branch flow; they are not literal water parcels or calibrated transit-time visualisations.

### Physical simulation

The server reuses the repository's accepted P1A nonlinear engine and coherent fixture. Its calculations include parallel-branch hydraulics, pump behaviour, aggregate building thermal dynamics, radiator heat exchange and adiabatic supply transport with delay. The operations adapter does not replace the physical solver with a language model.

Each operator step advances six five-minute physical substeps. A browser session starts with its own synthetic state, and the demonstration is bounded to a simulated day. Comparison trajectories are isolated copies. Batch rollback prevents a failure in a later substep from leaving a partially advanced state hidden behind an unchanged interface.

The default imbalance scenario produces a useful illustration, not a saving claim. At its initial state, the three-hour branch-redistribution candidate delivers approximately 1,260.69 kWh of building heat and uses 3.42 kWh of pump electricity. Its lowest modelled temperature remains approximately 18.62°C because the starting state is included; the end-of-horizon minimum reaches approximately 18.80°C. Holding controls gives an end minimum of approximately 18.71°C. Redistribution increases delivered heat in this case; it is not automatically an energy-saving intervention.

Those numbers come from the implemented synthetic model, not from a field study. Heat energy is integrated building heat delivery, not purchased source energy. Source-side accounting, pipe loss and tariffs would be needed before assigning financial savings.

### AI investigation

The server exposes tools to inspect the network, diagnose a building, compare candidate interventions, simulate bounded controls and read the curated research register, using OpenRouter's tool-calling interface.[^9] There is no actuator tool, arbitrary shell command, unrestricted file access or autonomous web-browsing tool in the application agent.

The final explanation is qualitative. Exact quantitative results appear in an application-generated evidence card. A lexical guard withholds generated prose containing unchecked digits, other than building identifiers. This addresses a demonstrated numeric-labelling failure but is not a comprehensive semantic fact checker: qualitative explanations can still be wrong, and the UI states that advice requires review.

The register is a curated source set, not a vector database or live retrieval-augmented web search. The visible trace records requested tools and returned evidence, not private internal model reasoning. Export includes the relevant synthetic state, diagnostics, comparisons, answer and source register, without the provider key or operator access code.

### Preservation and deployment

The original research dashboard remains available under the legacy route. Its frozen providers, evaluations and physical-core research code are preserved. The new interface does not relabel historical replay results as newly generated field data.

The deployment is a Docker web service containing a Node static/API server and a Python physical worker. Vite builds the frontend; its preview server is no longer the production runtime for the new operations interface. Render supports repository-based Docker deployment.[^10] Provider credentials are supplied through server environment variables and are not embedded in the browser bundle.

## 6. Safety, security and scientific boundaries

The 18°C floor is an explicit demonstration setting, not a nationwide legal compliance statement. The 20–23°C comfort band is also a prototype convention. A real pilot must establish the applicable locality, measurement procedure, contract, exceptions and authorised operating envelope before presenting a compliance indicator.

All twelve building temperatures are aggregates. A warm average cannot establish that every occupied room is comfortable. A sensor disagreement cannot be resolved by treating a simplified model as ground truth. No actual complaints, resident information, SCADA feeds, weather forecasts or field measurements are connected.

The transport model is adiabatic on the supply side. Return-side transport delay and pipe heat loss are not represented. Building thermal parameters are not calibrated to a real estate. Accordingly, neither a small solver residual nor a passed trajectory establishes field accuracy or safety.

NIST's OT guidance emphasises that security decisions must account for operational performance, reliability and safety.[^8] The proposed production interpretation is separation: site controllers and protective mechanisms remain authoritative, while an AI investigation system is a bounded advisory client. This is an architectural recommendation, not a statement of certification.

The public demo's protections include HttpOnly session cookies, same-origin write checks, a separate high-entropy operator AI code, request-size limits, a numerical queue limit and a process-local paid-request budget. These do not substitute for organisational identity, persistent audit storage, durable rate limits, external abuse controls or an OT security assessment. A restart clears session state and resets in-memory budgets.

The questions and synthetic tool outputs used in an AI investigation are sent to OpenRouter and a selected model provider. A production Chinese deployment must make an explicit data-governance and deployment-region decision before transmitting real plant or resident data. No legal conclusion about cross-border processing is made here.

## 7. A realistic path from prototype to pilot

### Stage A: establish the data contract

Obtain an approved topology, asset identifiers, station-side temperature/flow/pressure signals, branch or building-entrance measurements, control histories and known sensor locations. Document units, timestamps, sampling intervals, interpolation and gaps. Separate measured, inferred and manually entered values in the storage model.

Select a representative set of indoor observations with the operator. Do not equate the number of sensors with population coverage. Record placement and known biases. Explicitly identify unsupported buildings and time periods rather than filling them with apparently precise estimates.

A useful exit criterion is that an operator can trace an alarm back to its device, timestamp and transformation. Asset and time alignment should be tested before model-fitting begins.

### Stage B: calibrate and validate in shadow mode

Estimate model parameters from authorised historical periods. Use separate periods for fitting and evaluation, including colder conditions, warmer shoulder periods and known operating changes. Compare predicted temperatures, return water and flows with actual observations.

The system should make no field changes during this stage. Operators should record whether suggested hypotheses were confirmed, contradicted or untestable. Failure analysis should include missing and stale data rather than excluding difficult days.

Before promoting an intervention model, establish acceptance thresholds with the site team. They should cover error distribution, comfort-risk false negatives, uncertainty calibration, data coverage and predictable handling of infeasible states. A single average prediction error is not sufficient.

### Stage C: evaluate useful decisions

Compare the advisory system with the existing operating procedure and transparent engineering baselines. Measure correctly localised faults, time to a useful inspection request, rejected unsupported recommendations and operator acceptance. Track unnecessary investigations as well as successful ones.

For energy evaluation, preserve comfort and boundary conditions. Document weather normalisation, heat accounting boundaries, operating hours and any changed service level. Report heat and pump electricity separately unless a justified tariff or carbon conversion is supplied.

The prototype's five-candidate comparison is a starting point for this evaluation, not its conclusion. Independent emulation or a validated higher-fidelity model would help reveal model-specific blind spots.

### Stage D: introduce constrained assistance only with separate authority

Only after successful shadow evaluation should the organisation consider supervised control recommendations within a narrow approved envelope. Any field interface should have role-based permissions, independent limits, expiry, acknowledgements and a tested rollback or fallback procedure.

The language model should remain unable to bypass an infeasibility result or an operating permission. A failed provider request must not interrupt local heating operation. Changes to model versions, prompts or tool definitions need regression tests because they can change behaviour even if the physical code is unchanged.

## 8. Product priorities and differentiation

The near-term investment priority is a commissioning-quality evidence layer: a reliable relationship between asset, reading, hypothesis, numerical alternative and operator decision. This is more defensible than an undifferentiated “AI optimiser” promise.

The next technical priority is uncertainty-aware comparison with calibrated building parameters. After that, sensor-quality inference is a promising research increment, provided it is measured against strong simple baselines and separated from known injected faults.

Maintenance integration can follow when genuine work-order data is available. The application could request a reference temperature measurement or valve inspection, then use the returned evidence to update the investigation. This would make the system operationally useful without claiming automatic root-cause certainty.

Advanced graph learning, multimodal document interpretation and specialist agent orchestration should be treated as testable additions rather than prerequisites for an impressive product. Each should earn its place by reducing an observed failure or manual burden.

The appropriate current claim is: **an interactive research twin that lets an operator inspect a synthetic residential secondary network, test bounded alternatives with a physical solver and use an evidence-linked AI assistant without granting it control authority**. Field effectiveness and financial value remain questions for a properly designed pilot.

## Sources

[^1]: Beijing Municipal Government / Beijing Daily. [8个供热设施智能改造项目获得批复 431个小区将实现按需供热](https://www.beijing.gov.cn/ywdt/gzdt/202504/t20250407_4056614.html). 7 April 2025. Official announcement of approved projects; intended outcomes, not independent impact measurement.

[^2]: Shandong Big Data Bureau. [Guangrao smart-heating operational monitoring and service coordination](https://bdb.shandong.gov.cn/art/2025/2/18/art_79183_10332859.html). 18 February 2025. Municipal implementation example; not a national prevalence study.

[^3]: Integrated Intelligent Energy. [Application of secondary network intelligent balance system based on big data analysis](https://www.hdpower.net/EN/10.3969/j.issn.2097-0706.2022.03.007). 2022. DOI: 10.3969/j.issn.2097-0706.2022.03.007. Case-study evidence; reported improvements are not applied to this prototype.

[^4]: Keivan Faghih Niresi and Olga Fink. [Sensor Fault Detection via Virtual Smart Heat Metering with Spatial-Temporal Graph Neural Networks](https://papers.phmsociety.org/index.php/phme/article/view/4944). PHM Society European Conference, 9(1), 1–10, 3 July 2026. DOI: 10.36001/phme.2026.v9i1.4944. Controlled-laboratory evaluation.

[^5]: Costas Mylonas, Titos Georgoulakis and Magda Foti. [A Conversational Agentic Interface to Physics-Based Household Digital Twins for Residential Energy Decision Support](https://arxiv.org/abs/2606.31744). arXiv preprint, submitted 30 June 2026. Not treated as a district-heating field validation.

[^6]: IEA DHC Technology Collaboration Programme. [Annex TS9: Digitalisation of District Heating and Cooling](https://www.iea-dhc.org/the-research/annexes/2024-2028-annex-ts9). Programme period 2024–2028; accessed 12 September 2026. Programme scope and research coordination, not a finished product validation.

[^7]: IBPSA Project 2. [The Building Optimization Testing Framework (BOPTEST)](https://ibpsa.github.io/project1-boptest/index.html). Accessed 12 September 2026. Official project description of emulator-based control benchmarking.

[^8]: NIST. [Guide to Operational Technology (OT) Security](https://www.nist.gov/publications/guide-operational-technology-ot-security). SP 800-82 Revision 3, September 2023. OT security guidance; not a certification of this application.

[^9]: OpenRouter. [Tool and function calling](https://openrouter.ai/docs/guides/features/tool-calling). Accessed 12 September 2026. Official interface documentation supporting the server-side tool loop.

[^10]: Render. [Docker on Render](https://render.com/docs/docker). Accessed 12 September 2026. Official repository-based Docker deployment documentation.
