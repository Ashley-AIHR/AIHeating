"""Bounded, reproducible two-block direct-search optimisation over the nonlinear plant.

Not a global optimum, tariff optimiser or calibrated field MPC. No external writes.
"""
import hashlib
import json
import time
import uuid
from dataclasses import asdict
from ai_heating_core.contracts import Controls


def optimise(s, args):
    # Import the active module when run as a worker; importing twin would create another registry.
    import sys
    twin = sys.modules['__main__'] if hasattr(sys.modules['__main__'], 'rollout') else sys.modules['twin']
    objective = args.get('objective', 'balanced')
    weights = {'balanced': (0.01, 0.1, 1), 'comfort': (0.002, 0.02, 3), 'energy': (0.03, 0.3, 1)}
    if objective not in weights:
        raise ValueError('Unknown optimisation objective')
    base = s['engine'].controls
    start = [base.supply_c, base.frequency_hz, *base.valves]
    lo, hi, ramp = [40, 30, .2, .2, .2], [60, 50, 1, 1, 1], [2, 2, .1, .1, .1]
    cache = {}
    def controls(x):
        first = [max(lo[i], min(hi[i], start[i] + x[i] * ramp[i])) for i in range(5)]
        second = [max(lo[i], min(hi[i], first[i] + x[i+5] * ramp[i])) for i in range(5)]
        a, b = Controls(first[0], first[1], tuple(first[2:])), Controls(second[0], second[1], tuple(second[2:]))
        a.validate(base)
        b.validate(a)
        return a, b
    def evaluate(x):
        key = tuple(round(v, 5) for v in x)
        if key not in cache:
            a, b = controls(x)
            row = twin.rollout(s, a, second=b)
            valid = row['verified'] and row['maxResidual'] <= 1e-6 and row['maxPressureKpa'] <= 250
            cost = sum(w*v for w, v in zip(weights[objective], [row['heatKwh'], row['pumpKwh'], row['comfortPenalty']]))
            cache[key] = (cost if valid else 1e9 + max(0, 18-row['minimumC'])*1e6 + cost, row)
        return cache[key]
    x = [0.0]*10
    baseline = evaluate(x)[1]
    # Two decreasing mesh sizes; every coordinate is tested in both directions.
    for step in (1.0, .5):
        for i in range(10):
            trials = [x]
            for direction in (-1, 1):
                trial = x.copy()
                trial[i] = max(-1, min(1, trial[i]+direction*step))
                trials.append(trial)
            x = min(trials, key=lambda v: evaluate(v)[0])
    score, chosen = evaluate(x)
    a, b = controls(x)
    # A fresh rollout, not cached search output, verifies the chosen trajectory.
    check = twin.rollout(s, a, second=b)
    feasible = check['verified'] and check['maxResidual'] <= 1e-6 and check['maxPressureKpa'] <= 250
    schedule = [{'minute': 0, 'supplyC': a.supply_c, 'pumpHz': a.frequency_hz, 'valvesPct': [v*100 for v in a.valves]},
                {'minute': 90, 'supplyC': b.supply_c, 'pumpHz': b.frequency_hz, 'valvesPct': [v*100 for v in b.valves]}]
    proof = {'revision': s['revision'], 'scenario': s['scenario'], 'schedule': schedule, 'model': 'P1A-coherent-v1.2'}
    digest = hashlib.sha256(json.dumps(proof, sort_keys=True).encode()).hexdigest()
    result = {**chosen, 'id': 'optimised', 'label': 'Numerically optimised schedule', 'verified': feasible,
              'schedule': schedule, 'planHash': digest}
    if feasible:
        token = str(uuid.uuid4())
        if len(s['candidates']) >= 20:
            s['candidates'].pop(next(iter(s['candidates'])))
        s['candidates'][token] = {'revision': s['revision'], 'controls': chosen['controls'],
            'second': asdict(b), 'expires': time.time()+300, 'optimised': True}
        result['candidateId'] = token
    return {'revision': s['revision'], 'objective': objective, 'baseline': baseline,
        'recommendation': result if feasible else None, 'bestAttempt': result,
        'evaluations': len(cache)+1, 'solver': 'Bounded coordinate pattern search; two 90-minute control blocks',
        'status': 'feasible best found' if feasible else 'no feasible plan found',
        'verification': {'passed': feasible, 'minimumC': check['minimumC'], 'maxResidual': check['maxResidual'],
            'maxPressureKpa': check['maxPressureKpa'], 'planHash': digest,
            'scope': 'Fresh rollout using the same model; not independent field validation'},
        'limitations': ['No global optimality guarantee; fixed evaluation budget',
            'Synthetic forecast and uncalibrated aggregate building parameters',
            '18°C and 250 kPa are demonstration gates, not site operating limits',
            'Apply commits only the next 30 minutes in simulation; re-optimise afterwards',
            'Uncertainty is not quantified; no field actuation']}
