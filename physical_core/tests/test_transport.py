import pytest

from ai_heating_core.constants import WATER
from ai_heating_core.parameters import TRANSPORT_REFERENCES, synthetic_parameters
from ai_heating_core.transport import DelayLine
from ai_heating_core.units import m3h_to_m3s


def arrival(volume, flow):
    line = DelayLine(volume, 45)
    for step in range(1, 30):
        line.advance(50, flow, 300)
        if line.delivered_supply_c >= 45.25:
            return step * 300
    raise AssertionError("step never arrived")


def test_nominal_arrivals_and_flow_dependency():
    p = synthetic_parameters()
    measured = [arrival(b.equivalent_volume_m3, m3h_to_m3s(ref[0]))
                for b, ref in zip(p.branches, TRANSPORT_REFERENCES)]
    assert measured[0] < measured[1] < measured[2]
    assert all(abs(a - expected) <= 300 for a, expected in zip(measured, (600, 1200, 2100)))
    reduced = arrival(p.branches[2].equivalent_volume_m3, m3h_to_m3s(10.6) * .8)
    assert reduced > measured[2]
    assert abs(reduced - 2100 / .8) <= 300


def test_changing_flow_volume_and_enthalpy():
    line = DelayLine(3, 45)
    for flow, inlet, dt in [(0.002, 50, 300), (.004, 48, 600), (.01, 55, 900), (0, 40, 300)]:
        before = line.energy_j()
        segments = line.advance(inlet, flow, dt)
        assert sum(s.duration_s for s in segments) == pytest.approx(dt)
        assert line.volume_m3 == pytest.approx(3)
        output = sum(s.duration_s * flow * s.temperature_c for s in segments) * WATER.rho_water * WATER.cp_water
        incoming = flow * dt * inlet * WATER.rho_water * WATER.cp_water
        assert line.energy_j() - before == pytest.approx(incoming - output, abs=1e-6)
        assert all(v > 0 for v, _ in line.packets)


def test_no_early_arrival_and_zero_flow():
    line = DelayLine(3, 45)
    line.advance(50, 0, 300)
    assert line.estimated_delay_s is None
    assert line.delivered_supply_c == 45
    for _ in range(2):
        line.advance(50, .005, 300)
        assert line.delivered_supply_c == 45
    line.advance(50, .005, 300)
    assert line.delivered_supply_c == 50


def test_flow_change_during_transit_moves_existing_packets():
    line = DelayLine(3, 45)
    slow = DelayLine(3, 45)
    for step in range(4):
        line.advance(50, .0025 if step < 2 else .005, 300)
        slow.advance(50, .0025, 300)
        if step < 3:
            assert line.delivered_supply_c == 45
    assert line.delivered_supply_c == 50
    assert slow.delivered_supply_c == 45
