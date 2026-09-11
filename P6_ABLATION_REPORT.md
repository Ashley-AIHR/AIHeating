# P6 Rapid Warming Actuator Ablation

All three variants used the identical Rapid Warming canonical initial state, issued forecasts, objective, P4/P5 models, horizon and safety policy.

| MPC actuators | Heat MWh | Pump kWh | >23°C | Compliance | Oversupply MWh | Spread |
|---|---:|---:|---:|---:|---:|---:|
| Supply only | 7.9745 | 23.4073 | 36.08% | 100% | 1.2304 | 1.3792°C |
| Supply + pump | 7.9421 | 21.4788 | 34.35% | 100% | 1.2144 | 1.3715°C |
| Supply + pump + zone valves | 7.8745 | 21.5032 | 30.84% | 100% | 1.1845 | 1.3579°C |

Supply optimisation captures most heat reduction. Pump authority materially reduces pump electricity and slightly improves heat matching. Zone-valve authority adds the best overheating, oversupply and temperature-spread result, at a small +0.0244 kWh pump difference versus supply+pump. No ablation creates underheating or severe overheating.
