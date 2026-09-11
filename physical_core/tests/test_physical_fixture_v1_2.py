from dataclasses import asdict
from math import exp, fsum, isfinite

import pytest

from ai_heating_core.contracts import ZONES
from ai_heating_core.parameters import synthetic_parameters
from ai_heating_core.physical_fixture_v1_2 import (
    DESIGN_INDOOR_C, DESIGN_OUTDOOR_C, DESIGN_RETURN_C, DESIGN_SUPPLY_C,
    coherent_parameters, size_profile,
)


def test_design_point_equations_and_positive_values():
    base = synthetic_parameters()
    sized = coherent_parameters()
    for old, new in zip(base.buildings, sized.buildings, strict=True):
        s = size_profile(old, base.water)
        capacity = s.design_mass_flow_kg_s * base.water.cp_water
        output = capacity * (1 - exp(-s.radiator_ua_w_k / capacity)) * (DESIGN_SUPPLY_C - DESIGN_INDOOR_C)
        assert output == pytest.approx(s.design_heat_load_w, rel=1e-12)
        assert capacity * (DESIGN_SUPPLY_C - DESIGN_RETURN_C) == pytest.approx(s.design_heat_load_w, rel=1e-12)
        assert all(isfinite(x) and x > 0 for x in (s.design_mass_flow_kg_s, s.design_volumetric_flow_m3_h, s.radiator_ua_w_k))
        assert new.radiator_ua_w_k == s.radiator_ua_w_k
        assert new.flow_share_weight == s.design_mass_flow_kg_s


def test_only_allowed_fixture_fields_change_and_result_is_deterministic():
    base = synthetic_parameters()
    sized = coherent_parameters()
    assert sized == coherent_parameters()
    for old, new in zip(base.buildings, sized.buildings, strict=True):
        old_values, new_values = asdict(old), asdict(new)
        changed = {k for k in old_values if old_values[k] != new_values[k]}
        assert changed == {"radiator_ua_w_k", "flow_share_weight"}
    assert asdict(base)["branches"] == asdict(sized)["branches"]
    assert asdict(base)["pump"] == asdict(sized)["pump"]
    assert asdict(base)["water"] == asdict(sized)["water"]


def test_within_zone_shares_normalize_exactly():
    p = coherent_parameters()
    for zone in ZONES:
        weights = [b.flow_share_weight for b in p.buildings if b.zone == zone]
        shares = [w / fsum(weights) for w in weights]
        assert fsum(shares) == pytest.approx(1.0, abs=1e-15)


def test_infeasible_design_point_is_rejected_without_clamping():
    base = synthetic_parameters()
    impossible = base.buildings[0].__class__(**{**asdict(base.buildings[0]), "internal_gain_w": 1e12})
    with pytest.raises(ValueError, match="invalid effectiveness"):
        size_profile(impossible, base.water)
