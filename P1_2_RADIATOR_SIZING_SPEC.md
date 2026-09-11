# Physical Fixture v1.2 Radiator Sizing Specification

The design condition is a synthetic PoC point: indoor 21°C, outdoor −10°C, supply 55°C, return 45°C, zero solar, closed windows, and unchanged static internal gains.

For building *i*, `H_i = 1/R_i` and `Q_design_i = max(0, H_i × (21 − (−10)) − internalGain_i)`. Design mass flow is `m_i = Q_design_i / (cp × (55 − 45))`; volumetric flow is `m_i / rho × 3600`. Within each zone, the raw share weight is this design mass flow and normalized shares are `m_i / sum_zone(m)`.

With `M_i = m_i × cp`, the accepted NTU radiator model requires `effectiveness_i = Q_design_i / (M_i × (55 − 21))`. Generation must stop unless `0 < effectiveness_i < 1`. The derived emitter size is `UA_i = −M_i × ln(1 − effectiveness_i)`. No clamping, KPI fitting, or building-specific multiplier is permitted.

At the chosen common design point, effectiveness is exactly `10/34 = 0.2941176470588235` for every positive-load building. The generator retains all non-UA/non-share physical fields unchanged.
