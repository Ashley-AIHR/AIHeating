# Shanghai: fictional riverside energy district

Select **SHANGHAI · 上海** in the workspace header. Switching cities starts a fresh simulation, stops auto-step/agent cycles and removes old forecasts, manual proposals, imports and observation displays. Scenario resets retain the chosen city. Revisions increase across resets and old application tokens are invalidated.

## Published basis versus authored details

The [Shanghai Statistics Bureau climate overview](https://tjj.sh.gov.cn/zrdl/20180819/0014-216816.html) describes a mild, humid subtropical monsoon climate. Its numerical annual statistics describe 2017 and are **not** used as current weather or climate normals.

A [published Shanghai ground-source heat-pump study](https://shgtzy.xml-data.cn/article/id/ab3c784e-ca6f-4f87-9e81-32a01974af2d) reports testing and surveying 23 projects. This supports the plausibility of a heat-pump energy concept, not the existence or measured performance of our fictional residential network.

The neighbourhood, river, landscaping, architecture, equipment layout, all building parameters and all operating values are authored. The river is not a reconstruction of the Huangpu. The model reuses the demonstrator's twelve aggregate building archetypes and three-branch network, not Shanghai building-stock data.

| Synthetic scenario                                          |                                   Outdoor temperature | Solar input |
| ----------------------------------------------------------- | ----------------------------------------------------: | ----------: |
| Hydraulic imbalance / sensor disagreement / local heat loss |                                                  5 °C |     60 W/m² |
| Sunrise demand drop                                         | 8 °C initially, then +1.2 °C/h capped after six hours |    180 W/m² |
| Cold-front resilience                                       |                                                  0 °C |     25 W/m² |

Initial source supply is 44 °C, equivalent pump frequency 40 Hz and descriptive wind input 2.8 m/s. These are design inputs, not measurements. The initial simulation snapshot follows thirty minutes of integration. Outdoor temperature and solar gains drive the thermal solver; wind is descriptive, not a separately calibrated infiltration model.

## Functional scope

Manual 3D valve/pump/supply controls, verification, optimisation rollouts, replay and agent world context all use the active city's state. The fictional Shanghai scene removes snow coatings, introduces broadleaf evergreen crowns, green courtyards, a river embankment and a taller background skyline. Connected building/equipment identity remains unchanged across the district and mechanical view.

The physics represents heating-water hydraulics and aggregate building thermal storage only. A conceptual upstream heat pump is not a refrigerant model: no COP, cooling, humidity, defrost or compressor optimisation is claimed. There is no field actuation. The existing read-only observation gateway remains scoped to the separate Yinchuan reference and is disabled in the Shanghai interface.

Deployment is unchanged: native Node.js on Render, build `npm ci && npm run build`, start `npm start`.
