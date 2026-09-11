"""Central, deterministic Synthetic PoC Parameters; no customer calibration."""
from dataclasses import dataclass

from .constants import PhysicalConstants, WATER, positive
from .contracts import BuildingStaticProfile, ZONES
from .units import m3h_to_m3s, minutes_to_seconds


@dataclass(frozen=True)
class PumpParameters:
    reference_frequency_hz: float = 50
    shutoff_head_m: float = 16
    curve_a_s2_m5: float = 40000
    efficiency: float = 0.76

    def __post_init__(self):
        for name, value in vars(self).items():
            positive(name, value)
        if self.efficiency > 1:
            raise ValueError("pump efficiency must be <= 1")


@dataclass(frozen=True)
class BranchParameters:
    zone: str
    pipe_k_pa_s2_m6: float
    valve_ref_k_pa_s2_m6: float
    equivalent_volume_m3: float

    def __post_init__(self):
        if self.zone not in ZONES:
            raise ValueError("invalid zone")
        positive("pipe resistance", self.pipe_k_pa_s2_m6, allow_zero=True)
        positive("valve reference resistance", self.valve_ref_k_pa_s2_m6)
        positive("equivalent pipe volume", self.equivalent_volume_m3)


@dataclass(frozen=True)
class Parameters:
    buildings: tuple[BuildingStaticProfile, ...]
    branches: tuple[BranchParameters, ...]
    pump: PumpParameters = PumpParameters()
    water: PhysicalConstants = WATER
    common_k_pa_s2_m6: float = 1.5e8
    target_indoor_c: float = 21

    def __post_init__(self):
        positive("common resistance", self.common_k_pa_s2_m6, allow_zero=True)
        positive("target indoor temperature", self.target_indoor_c)
        if tuple(b.zone for b in self.branches) != ZONES:
            raise ValueError("branches must be near, mid, far in order")
        if {b.building_id for b in self.buildings} != {f"B{i:02}" for i in range(1, 13)} or len(self.buildings) != 12:
            raise ValueError("exactly B01–B12 required")
        if any(sum(b.zone == z for b in self.buildings) != 4 for z in ZONES):
            raise ValueError("each zone requires four buildings")


# Permitted P0 design references used ONLY to derive transport volumes.
TRANSPORT_REFERENCES = ((17.8, 10), (14.2, 20), (10.6, 35))


def synthetic_parameters() -> Parameters:
    metadata = [
        (1200, 2018, "High"), (980, 2010, "High"), (980, 1978, "Low"), (1100, 2015, "High"),
        (1100, 2015, "Medium"), (1050, 2012, "Medium"), (920, 2008, "Medium"), (1180, 2014, "Medium"),
        (900, 2005, "Low"), (1050, 2012, "Medium"), (1300, 2008, "Medium"), (1150, 2014, "Medium"),
    ]
    loss_per_area = {"Low": 1.8, "Medium": 1.3, "High": 0.9}  # W/(m² K)
    buildings = tuple(BuildingStaticProfile(
        building_id=f"B{i + 1:02}", heated_area_m2=area, construction_year=year,
        insulation_level=insulation, zone=ZONES[i // 4], terminal_type="radiator",
        orientation_factor=(0.75, 1.0, 0.85, 0.65)[i % 4], effective_solar_area_m2=0.04 * area,
        internal_gain_w=3 * area, thermal_resistance_k_w=1 / (loss_per_area[insulation] * area),
        thermal_capacitance_j_k=area * (180000 + 10000 * (i % 4)),
        radiator_ua_w_k=area * 1.4, flow_share_weight=area,
        window_conductance_w_k=2 * area,
    ) for i, (area, year, insulation) in enumerate(metadata))
    branches = tuple(BranchParameters(z, pipe_k, valve_k,
        m3h_to_m3s(flow) * minutes_to_seconds(delay))
        for z, pipe_k, valve_k, (flow, delay) in zip(
            ZONES, (0.6e9, 1.2e9, 2.0e9), (0.8e9, 1.0e9, 1.2e9), TRANSPORT_REFERENCES))
    return Parameters(buildings, branches)
