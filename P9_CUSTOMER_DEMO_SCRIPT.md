# P9 Customer Demo Script (8–12 minutes)

## 1. Problem — 1 minute

“District-heating systems often react to today’s outdoor temperature. On a cold morning that is about to warm rapidly, this can keep too much heat in the network and buildings. This PoC asks whether prediction plus supervisory optimisation can act earlier.”

State the boundary: this is a **Synthetic Digital Twin PoC**, not live equipment and not a production controller.

## 2. Current state — 1 minute

Open **Overview**. Select **Rapid Daytime Warming** (the frozen primary story). Point to the 10:30 simulation snapshot: observed outdoor, network and indoor-temperature state. Explain that all values come from an accepted P7 provider snapshot.

## 3. Weather forecast — 45 seconds

Follow **FORECAST**. “The issued forecast says the outdoor temperature and solar gain will rise. This is information available at the decision time, not future truth.”

## 4. Predicted heat demand — 1 minute

Open **Forecast**. “P4 LightGBM predicts that Required Heat Load will fall. The interval is calibrated on held-out synthetic simulation. It is not field accuracy.” Distinguish Required Heat Load from Actual Heat Supply.

## 5. Building thermal prediction — 1 minute

Show the P5 trajectory. “Buildings retain heat, so indoor temperature can continue rising even after demand starts falling. P5 is an effective H/C grey-box model calibrated on synthetic data.”

## 6. Formal MPC recommendation — 1 minute

Open **Simulation**. “Formal Supervisory MPC recommends future supply temperature, pump frequency and zone-valve movements under equipment and movement limits.” In Advisory, show `NOT_APPLIED`; in Optimised, show only a verified accepted action as `APPLIED`.

## 7. Verification and safety — 1 minute

Show **MPC Optimal** and **Verified in Digital Twin** for Rapid Warming. Open engineering status and show Cold Wave’s **Solver Limit Reached / Verified Fallback Active**, then the near-18 validation case’s **Constraint Infeasible / Safety Not Guaranteed**. Say: “Verification is in the synthetic Digital Twin; it is not a guarantee of real-site safety.”

## 8. Simulation result — 45 seconds

Explain that the accepted full-day result is a deterministic evidence replay, not a new run caused by this click.

## 9. Traditional comparison — 1 minute

Open **Results**. Lead with Traditional v1.2 versus Formal MPC v1. Preview v0 is an intermediate engineering benchmark. Explain the accepted reduction in heat use, oversupply and overheating while maintaining 100% compliance in this synthetic Rapid Warming benchmark. Report pump electricity separately.

## 10. Grounded Tutor — 1 minute

Open **AI Tutor** and ask “Why did MPC reduce overheating?” Explain: “This is Deterministic Grounded Tutor v1. It uses structured P7 context and curated knowledge, supports English and Chinese, cannot control the simulation, and is not a live LLM.”

## 11. Limitations and next step — 1 minute

Close with the honest boundary: guided validated evidence replay only; no real sensors, weather service, PLC/DCS, primary-network optimisation or production certification. The next phase starts read-only, then validates data, calibrates the site, runs shadow prediction/MPC, and only later considers bounded closed-loop control with independent protection.
