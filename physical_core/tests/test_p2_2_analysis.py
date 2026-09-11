from dataclasses import asdict
from math import isclose

import pytest

from ai_heating_core.contracts import Controls, Weather
from ai_heating_core.control.commissioning import commission
from ai_heating_core.physical_fixture_v1_1 import design_load_parameters
from ai_heating_core.shadow_commissioning_analysis import compare_commissioning
from ai_heating_core.simulation import SimulationEngine
from ai_heating_core.static_envelope_analysis import StaticEvaluator, relaxed_zone_certificate, violations


@pytest.mark.parametrize("outdoor",[-5,-10])
@pytest.mark.parametrize("actuators",[(40,30,.2,.2,.2),(60,50,1,1,1),(56.5,30,.2,.5,.75)])
def test_exact_static_solution_matches_accepted_dynamic_equilibrium(outdoor,actuators):
    p=design_load_parameters();e=StaticEvaluator(p)
    result=e.evaluate(actuators,outdoor)
    c=Controls(actuators[0],actuators[1],tuple(actuators[2:]))
    frame=SimulationEngine(p,c,result["buildingIndoorC"]).step(Weather(outdoor,0))
    assert result["thermalResidualW"]<1e-6
    assert result["hydraulicResidual"]<1e-8
    assert max(abs(s.indoor_temperature_c-result["buildingIndoorC"][k]) for k,s in frame.buildings.items())<1e-10
    assert max(abs(s.heating_power_w-result["radiatorPowerW"][k]) for k,s in frame.buildings.items())<1e-6


def test_static_bands_are_independent_and_include_endpoints():
    assert violations([18,25],"hard")==[0,0]
    assert violations([20,22],"comfort")==[0,0]
    assert violations([18,25],"comfort")==[2,3]
    assert violations([17,26,21],"hard")==[1,1,0]


def test_scope_does_not_mistake_one_zone_for_station_feasibility():
    e=StaticEvaluator(design_load_parameters())
    r=e.evaluate((47.5,44,.35,.9,.7),-5)
    assert e.annotate(r,"hard","mid")["feasible"]
    assert not e.annotate(r,"hard","all")["feasible"]


def test_documented_minus5_hard_witness():
    e=StaticEvaluator(design_load_parameters())
    r=e.evaluate((56.5,30,.2,.5,.75),-5)
    assert e.annotate(r,"hard","all")["feasible"]
    assert not e.annotate(r,"comfort","all")["feasible"]


@pytest.mark.parametrize("bad",[(39,30,.2,.2,.2),(60,51,.5,.5,.5),(50,40,.19,.5,.5)])
def test_static_equipment_bounds(bad):
    with pytest.raises(ValueError):StaticEvaluator(design_load_parameters()).evaluate(bad,-5)


@pytest.mark.parametrize("outdoor,band,zone",[(-10,"hard","near"),(-5,"comfort","near"),(-10,"comfort","near"),(-5,"comfort","far"),(-10,"comfort","far")])
def test_interval_certificate_covers_entire_relaxed_flow_domain(outdoor,band,zone):
    certificate=relaxed_zone_certificate(design_load_parameters(),outdoor,zone,band)
    assert certificate["certifiedInfeasible"]
    intervals=sorted(certificate["excludedIntervals"],key=lambda r:r["flowIntervalM3s"][0])
    assert intervals[0]["flowIntervalM3s"][0]==0
    assert intervals[-1]["flowIntervalM3s"][1]==certificate["relaxedFlowBoundsM3s"][1]
    assert all(a["flowIntervalM3s"][1]==b["flowIntervalM3s"][0] for a,b in zip(intervals,intervals[1:]))
    assert all(r["requiredSupplyLowerBoundC"]>r["allowedSupplyUpperBoundC"]+1e-7 for r in intervals)


def test_feasible_zone_is_not_falsely_certified():
    assert not relaxed_zone_certificate(design_load_parameters(),-5,"near","hard")["certifiedInfeasible"]


def test_shadow_uses_same_commissioning_without_mutating_parameters():
    p=design_load_parameters();before=asdict(p)
    result=compare_commissioning(p)
    assert asdict(p)==before and asdict(design_load_parameters())==before
    assert result["area"]["fixedValveFractions"]==commission(p)["fixedValveFractions"]
    total=sum(result["zoneDesignLoadsW"].values())
    assert total==470011
    for z,load in result["zoneDesignLoadsW"].items():
        assert isclose(result["shadowDesignLoad"]["targetShares"][z],load/total,abs_tol=1e-15)
    assert result["shadowDesignLoad"]["fixedValveFractions"]==(.35,.55,.85)
    assert result["shadowDesignLoad"]["designFrequencyHz"]==45
    assert result["shadowDesignLoad"]["roundingIncrementFraction"]==.05


def test_hydraulic_cache_uses_exact_same_inputs_only():
    e=StaticEvaluator(design_load_parameters())
    a=e.evaluate((40,40,.5,.5,.5),-5)
    b=e.evaluate((60,40,.5,.5,.5),-10)
    assert e.hydraulic_solves==1
    assert a["zoneFlowsM3s"]==b["zoneFlowsM3s"]
    e.evaluate((60,41,.5,.5,.5),-10)
    assert e.hydraulic_solves==2
