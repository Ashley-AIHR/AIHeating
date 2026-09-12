"""Session-isolated interactive adapter over the accepted P1A physical core.

JSON-lines RPC on stdin/stdout. No field-device interface. New scenario search is
explicitly NOT the frozen P6 MPC. Every trajectory uses the nonlinear P1A engine.
"""
import json
import sys
import time
import uuid
from copy import deepcopy
from dataclasses import replace
from pathlib import Path
from statistics import mean

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'physical_core' / 'src'))
from ai_heating_core.contracts import Controls, Weather, ZONES
from ai_heating_core.physical_fixture_v1_2 import coherent_parameters
from ai_heating_core.simulation import SimulationEngine

SCENARIOS = {
    'imbalance': {'name': 'Cold at the end of the network', 'outdoor': -8, 'solar': 45,
                  'description': 'Restricted far-zone valve; warm near-zone buildings and colder far-zone buildings.'},
    'warming': {'name': 'Sunrise demand drop', 'outdoor': -3, 'solar': 240,
                'description': 'Rising outdoor temperature and solar gains reduce demand while stored heat arrives later.'},
    'cold': {'name': 'Cold-front resilience', 'outdoor': -14, 'solar': 15,
             'description': 'Weather is colder than the synthetic radiator design point; check capacity before promising comfort.'},
    'sensor': {'name': 'A reading that does not fit', 'outdoor': -8, 'solar': 45,
               'description': 'B10 indoor sensor has an injected negative bias; independent model estimate stays separate.'},
    'window': {'name': 'Local building heat loss', 'outdoor': -8, 'solar': 45,
               'description': 'B03 has additional ventilation loss. A local loss should not automatically raise station-wide supply.'},
}
sessions = {}


def weather(s, offset=0):
    spec = SCENARIOS[s['scenario']]
    hours = (s['engine'].elapsed_s + offset) / 3600
    return Weather(spec['outdoor'] + (min(hours, 6) * 1.2 if s['scenario'] == 'warming' else 0),
                   spec['solar'], 3.4)


def new_session(scenario='imbalance'):
    if scenario not in SCENARIOS:
        raise ValueError('Unknown scenario')
    p = coherent_parameters()
    temps = {f'B{i+1:02}': [23.5, 23.1, 22.5, 23.6, 21.3, 21.6, 21.1, 21.4, 19.0, 18.6, 18.9, 19.1][i] for i in range(12)}
    if scenario != 'imbalance':
        temps = {f'B{i+1:02}': 21 + (i % 4) * 0.15 for i in range(12)}
    c = Controls(52, 45, (0.78, 0.58, 0.35) if scenario == 'imbalance' else (0.60, 0.65, 0.85))
    s = {'scenario': scenario, 'engine': SimulationEngine(p, c, temps), 'history': [],
         'events': [], 'revision': 0, 'candidates': {}, 'touched': time.time(),
         'windows': {'B03': 0.45} if scenario == 'window' else {}}
    # Six physical substeps produce a valid first frame at the 30-minute boundary.
    advance(s, 6)
    s['events'].append({'time': s['frame'].simulation_time, 'title': 'Session initialised',
                        'detail': 'Synthetic residential archetype · P1A nonlinear physics · 5-minute substeps'})
    return s


def advance(s, steps, controls=None):
    # Batch-level rollback: a later failed substep cannot leave an invisible partial change.
    working = deepcopy(s)
    if working['engine'].elapsed_s + steps * 300 > 24 * 3600:
        raise ValueError('24-hour demonstration complete; reset to start again')
    _advance(working, steps, controls)
    s.clear()
    s.update(working)


def _advance(s, steps, controls=None):
    engine = s['engine']
    for i in range(steps):
        s['frame'] = engine.step(weather(s), controls if i == 0 else None, s['windows'])
    s['revision'] += 1
    s['candidates'] = {}
    record = snapshot(s, history=False)
    s['history'].append({'time': record['time'][11:16], 'elapsedMinutes': record['elapsedMinutes'],
        'supplyC': record['supplyC'], 'returnC': record['returnC'], 'loadKw': record['loadKw'],
        'heatKw': record['heatKw'], 'minimumC': min(b['indoorC'] for b in record['buildings']),
        'meanC': mean(b['indoorC'] for b in record['buildings'])})
    s['history'] = s['history'][-48:]


def snapshot(s, history=True):
    f, e = s['frame'], s['engine']
    buildings = []
    for i, p in enumerate(e.parameters.buildings):
        b = f.buildings[p.building_id]
        biased = s['scenario'] == 'sensor' and p.building_id == 'B10'
        reading = b.indoor_temperature_c - (3.2 if biased else 0)
        buildings.append({'id': p.building_id, 'zone': p.zone, 'areaM2': p.heated_area_m2,
            'year': p.construction_year, 'insulation': p.insulation_level, 'floors': p.floors,
            'indoorC': reading, 'modelC': b.indoor_temperature_c,
            'quality': 'suspect' if biased else 'simulated', 'heatKw': b.heating_power_w / 1000,
            'flowM3h': b.building_water_flow_kg_s / e.parameters.water.rho_water * 3600,
            'returnC': b.radiator_return_temperature_c, 'envelopeKw': b.envelope_loss_w / 1000,
            'windowKw': b.window_loss_w / 1000, 'solarKw': b.solar_gain_w / 1000,
            'storageKw': b.storage_power_w / 1000,
            'position': [(-14 + (i % 4) * 9), (-11 + (i // 4) * 12)]})
    zones = [{'id': z, 'flowM3h': f.hydraulics.flows_m3_s[i] * 3600,
        'valvePct': f.controls.valves[i] * 100, 'delayMinutes': (f.delay_s[z] or 0) / 60,
        'supplyC': f.delivered_supply_c[z], 'returnC': f.zone_return_c[z]} for i, z in enumerate(ZONES)]
    return {'scenario': s['scenario'], 'scenarioName': SCENARIOS[s['scenario']]['name'],
        'scenarioDescription': SCENARIOS[s['scenario']]['description'], 'revision': s['revision'],
        'time': f.simulation_time, 'elapsedMinutes': f.elapsed_s / 60,
        'source': 'Interactive synthetic P1A · coherent fixture v1.2',
        'outdoorC': f.weather.outdoor_c, 'solarWm2': f.weather.solar_w_m2, 'windMs': f.weather.wind_m_s,
        'supplyC': f.controls.supply_c, 'returnC': f.station_return_c, 'pumpHz': f.controls.frequency_hz,
        'pressureKpa': f.hydraulics.available_pressure_pa / 1000,
        'flowM3h': f.hydraulics.total_flow_m3_s * 3600, 'pumpKw': f.hydraulics.pump_power_w / 1000,
        'loadKw': f.required_heat_w / 1000, 'heatKw': f.actual_heat_w / 1000,
        'sourceHeatKw': f.source_heat_w / 1000, 'pipeStorageKw': f.pipe_storage_power_w / 1000,
        'heatKwh': f.heat_energy_j / 3.6e6, 'pumpKwh': f.pump_energy_j / 3.6e6,
        'solverResidual': f.hydraulics.solver.normalized_residual,
        'energyResidual': max(f.heat_balance_residual, f.pipe_heat_balance_residual, f.building_heat_balance_residual),
        'buildings': buildings, 'zones': zones, 'history': s['history'] if history else [],
        'events': s['events'][-30:], 'thresholdC': 18, 'targetC': 21,
        'limits': {'supplyC': [40, 60], 'pumpHz': [30, 50], 'valvePct': [20, 100],
                   'stepSupplyC': 2, 'stepPumpHz': 2, 'stepValvePct': 10},
        'assumptions': ['12 aggregate buildings; not individual flats or a surveyed site',
            'Adiabatic supply transport; return delay and pipe heat loss are not modelled',
            '18°C is a demonstration floor, not a nationwide compliance certification',
            'No real SCADA, weather feed, resident complaints or field controls connected']}


def diagnose(s, building_id=None):
    view = snapshot(s)
    selected = next((b for b in view['buildings'] if b['id'] == building_id), None)
    findings = []
    for b in view['buildings']:
        if b['quality'] == 'suspect':
            findings.append({'id': 'sensor-' + b['id'], 'severity': 'warning', 'asset': b['id'],
                'title': 'Temperature measurement disagreement',
                'evidence': f"Reading {b['indoorC']:.2f}°C differs from synthetic model {b['modelC']:.2f}°C by -3.20°C.",
                'action': 'Check a reference thermometer and timestamp before changing heat supply.',
                'certainty': 'Injected demonstration fault; no trained virtual-sensor model.'})
        elif b['indoorC'] < 20:
            zone = next(z for z in view['zones'] if z['id'] == b['zone'])
            findings.append({'id': 'cold-' + b['id'], 'severity': 'critical' if b['indoorC'] < 18 else 'warning',
                'asset': b['id'], 'title': 'Building below comfort band',
                'evidence': f"{b['indoorC']:.2f}°C; branch flow {zone['flowM3h']:.2f} m³/h; valve {zone['valvePct']:.0f}%; delay {zone['delayMinutes']:.1f} min.",
                'action': 'Compare branch balancing with a station supply increase; inspect local losses.',
                'certainty': 'Observed in simulation; root cause requires comparison and site measurements.'})
        if b['windowKw'] > 1:
            findings.append({'id': 'loss-' + b['id'], 'severity': 'warning', 'asset': b['id'],
                'title': 'Additional local ventilation loss',
                'evidence': f"Injected ventilation term contributes {b['windowKw']:.2f} kW.",
                'action': 'Inspect the local ventilation condition; retain resident ventilation requirements.',
                'certainty': 'Known scenario input, not inferred window-opening detection.'})
    warm = [b['id'] for b in view['buildings'] if b['indoorC'] > 23 and b['quality'] != 'suspect']
    if warm:
        findings.append({'id': 'overheat', 'severity': 'info', 'asset': warm[0], 'title': 'Uneven heat distribution',
            'evidence': ', '.join(warm) + ' exceed the demo 23°C overheating threshold.',
            'action': 'Test flow redistribution before adding heat for the whole network.',
            'certainty': 'Temperature spread is observed; a cause is not established by correlation alone.'})
    return {'revision': s['revision'], 'selected': selected, 'findings': findings,
            'summary': f"{len(findings)} findings across 12 simulated buildings", 'source': 'P1A numerical evidence + explicit diagnostic rules'}


def candidate_controls(s, args):
    c = s['engine'].controls
    values = args.get('valvesPct', [v * 100 for v in c.valves])
    if not isinstance(values, list) or len(values) != 3:
        raise ValueError('valvesPct requires exactly three values')
    candidate = Controls(float(args.get('supplyC', c.supply_c)), float(args.get('pumpHz', c.frequency_hz)),
                         tuple(float(x) / 100 for x in values))
    candidate.validate(c)
    return candidate


def rollout(s, controls, hours=3):
    e = deepcopy(s['engine'])
    initial_heat, initial_pump = e.heat_energy_j, e.pump_energy_j
    trace = []
    min_c = min(e.temperatures.values())
    overheated, count, discomfort = 0, 0, 0
    for i in range(int(hours * 12)):
        # The issued synthetic weather path is the same for every candidate.
        f = e.step(weather(s, i * 300), controls if i == 0 else None, s['windows'])
        temps = [b.indoor_temperature_c for b in f.buildings.values()]
        min_c = min(min_c, *temps)
        overheated += sum(t > 23 for t in temps)
        count += len(temps)
        discomfort += sum(max(20-t, 0)**2 + max(t-22, 0)**2 for t in temps) / 12
        if (i+1) % 6 == 0:
            trace.append({'minutes': (i+1)*5, 'minimumC': min(temps), 'meanC': mean(temps),
                          'heatKw': f.actual_heat_w / 1000, 'returnC': f.station_return_c})
    heat = (e.heat_energy_j - initial_heat) / 3.6e6
    pump = (e.pump_energy_j - initial_pump) / 3.6e6
    return {'heatKwh': heat, 'pumpKwh': pump, 'minimumC': min_c,
        'endMinimumC': min(e.temperatures.values()), 'overheatingPct': 100*overheated/count,
        'comfortPenalty': discomfort, 'trace': trace, 'verified': min_c >= 18,
        'verification': 'Passed 18°C simulation floor' if min_c >= 18 else 'Rejected: 18°C simulation floor violated',
        'controls': {'supplyC': controls.supply_c, 'pumpHz': controls.frequency_hz,
                     'valvesPct': [v*100 for v in controls.valves]},
        'method': 'P1A nonlinear rollout · fixed candidate · 3 h · not P6 MPC', 'hours': hours}


def compare(s):
    c = s['engine'].controls
    clamp = lambda v, lo, hi: max(lo, min(v, hi))
    v = c.valves
    options = [('hold', 'Hold current controls', c),
        ('balance', 'Redistribute branch flow', Controls(c.supply_c, c.frequency_hz,
            (clamp(v[0]-.1,.2,1), v[1], clamp(v[2]+.1,.2,1)))),
        ('cool', 'Reduce supply by 2°C', Controls(clamp(c.supply_c-2,40,60), c.frequency_hz, v)),
        ('warm', 'Raise supply by 2°C', Controls(clamp(c.supply_c+2,40,60), c.frequency_hz, v)),
        ('pump', 'Raise pump by 2 Hz', Controls(c.supply_c, clamp(c.frequency_hz+2,30,50), v))]
    rows = []
    for key, label, control in options:
        r = rollout(s, control)
        r.update({'id': key, 'label': label})
        rows.append(r)
    feasible = [r for r in rows if r['verified']]
    best = min(feasible, key=lambda r: r['heatKwh']*.01 + r['pumpKwh']*.1 + r['comfortPenalty']) if feasible else None
    if best:
        if len(s['candidates']) >= 20:
            s['candidates'].pop(next(iter(s['candidates'])))
        token = str(uuid.uuid4())
        s['candidates'][token] = {'revision': s['revision'], 'controls': best['controls']}
        best['candidateId'] = token
    return {'revision': s['revision'], 'candidates': rows, 'recommendation': best,
            'baseline': rows[0], 'objective': 'Illustrative weighted heat + pump energy + quadratic discomfort; not a tariff or savings guarantee.'}


def dispatch(session_id, method, args):
    now = time.time()
    for k in list(sessions):
        if now-sessions[k]['touched'] > 3600:
            del sessions[k]
    if session_id not in sessions:
        if len(sessions) >= 100:
            raise ValueError('Demo capacity reached; try again later')
        sessions[session_id] = new_session()
    s = sessions[session_id]
    s['touched'] = now
    if method == 'reset':
        sessions[session_id] = new_session(args.get('scenario', 'imbalance'))
        return snapshot(sessions[session_id])
    if method == 'snapshot':
        return snapshot(s)
    if method == 'advance':
        if s['engine'].elapsed_s >= 24*3600:
            raise ValueError('24-hour demonstration complete; reset to start again')
        advance(s, 6)
        return snapshot(s)
    if method == 'diagnose':
        return diagnose(s, args.get('buildingId'))
    if method == 'compare':
        return compare(s)
    if method == 'simulate':
        return rollout(s, candidate_controls(s, args))
    if method == 'apply':
        proposal = s['candidates'].get(args.get('candidateId'))
        if not proposal or proposal['revision'] != s['revision']:
            raise ValueError('Recommendation expired; compare again against the current state')
        controls = candidate_controls(s, proposal['controls'])
        check = rollout(s, controls)
        if not check['verified']:
            raise ValueError('Trajectory did not pass the simulation floor')
        advance(s, 6, controls)
        s['events'].append({'time': s['frame'].simulation_time, 'title': 'Operator applied simulated controls',
            'detail': f"Supply {controls.supply_c:.1f}°C · pump {controls.frequency_hz:.1f} Hz · verified 3-hour model rollout"})
        return snapshot(s)
    raise ValueError('Unknown twin tool')


if __name__ == '__main__':
    for line in sys.stdin:
        request = {}
        try:
            request = json.loads(line)
            result = dispatch(request['session'], request['method'], request.get('args', {}))
            print(json.dumps({'id': request['id'], 'result': result}, allow_nan=False), flush=True)
        except Exception as exc:
            print(json.dumps({'id': request.get('id'), 'error': str(exc)}), flush=True)
