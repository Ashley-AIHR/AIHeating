import math
import unittest
from copy import deepcopy
from unittest.mock import patch
import twin


class TwinTests(unittest.TestCase):
    def setUp(self):
        twin.sessions.clear()

    def test_all_scenarios_conserve_and_advance(self):
        for name in twin.SCENARIOS:
            with self.subTest(name=name):
                s = twin.new_session(name)
                before = twin.snapshot(s)
                twin.advance(s, 6)
                after = twin.snapshot(s)
                self.assertEqual(after['elapsedMinutes'] - before['elapsedMinutes'], 30)
                self.assertEqual(after['revision'], before['revision'] + 1)
                self.assertLess(after['solverResidual'], 1e-6)
                self.assertLess(after['energyResidual'], 1e-6)
                self.assertEqual(len(after['buildings']), 12)
                self.assertTrue(all(math.isfinite(b['indoorC']) for b in after['buildings']))

    def test_comparison_is_nonmutating_and_reproducible(self):
        s = twin.new_session()
        before = twin.snapshot(s)
        first = twin.compare(s)
        second = twin.compare(s)
        self.assertEqual(twin.snapshot(s), before)
        self.assertEqual(len(first['candidates']), 5)
        for a, b in zip(first['candidates'], second['candidates']):
            self.assertEqual(a['heatKwh'], b['heatKwh'])
            self.assertEqual(a['minimumC'], b['minimumC'])
            self.assertEqual(a['verified'], a['minimumC'] >= 18)
        self.assertEqual(first['recommendation']['id'], 'balance')

    def test_candidate_limits_reject_unbounded_and_nonfinite(self):
        s = twin.new_session()
        for args in [{'supplyC': 80}, {'supplyC': 55}, {'pumpHz': 48}, {'valvesPct': [90, 58, 35]}, {'valvesPct': [30]}, {'supplyC': float('nan')}]:
            with self.subTest(args=args), self.assertRaises(ValueError):
                twin.candidate_controls(s, args)

    def test_approval_and_replay_protection(self):
        twin.dispatch('one', 'snapshot', {})
        result = twin.dispatch('one', 'compare', {})
        token = result['recommendation']['candidateId']
        after = twin.dispatch('one', 'apply', {'candidateId': token})
        self.assertEqual(after['revision'], 2)
        self.assertEqual(len(after['events']), 2)
        with self.assertRaises(ValueError):
            twin.dispatch('one', 'apply', {'candidateId': token})

    def test_expired_and_cross_session_proposals(self):
        token = twin.dispatch('a', 'compare', {})['recommendation']['candidateId']
        with self.assertRaises(ValueError):
            twin.dispatch('b', 'apply', {'candidateId': token})
        twin.dispatch('a', 'advance', {})
        with self.assertRaises(ValueError):
            twin.dispatch('a', 'apply', {'candidateId': token})
        self.assertEqual(twin.dispatch('b', 'snapshot', {})['revision'], 1)

    def test_sensor_and_local_loss_remain_explicit(self):
        s = twin.new_session('sensor')
        b = twin.snapshot(s)['buildings'][9]
        self.assertAlmostEqual(b['modelC'] - b['indoorC'], 3.2)
        self.assertIn('Injected demonstration', twin.diagnose(s)['findings'][0]['certainty'])
        w = twin.new_session('window')
        self.assertTrue(any(f['id'] == 'loss-B03' for f in twin.diagnose(w)['findings']))

    def test_infeasible_initial_comfort_rejects_all_candidates(self):
        s = twin.new_session('cold')
        s['engine'].temperatures['B10'] = 17.5
        result = twin.compare(s)
        self.assertIsNone(result['recommendation'])
        self.assertTrue(all(not c['verified'] for c in result['candidates']))

    def test_batch_failure_rolls_back_all_state(self):
        s = twin.new_session()
        before = twin.snapshot(s)
        original = twin.SimulationEngine.step
        calls = 0
        def failing_step(engine, *args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 3:
                raise ValueError('Injected third-substep failure')
            return original(engine, *args, **kwargs)
        with patch.object(twin.SimulationEngine, 'step', failing_step), self.assertRaises(ValueError):
            twin.advance(s, 6)
        self.assertEqual(twin.snapshot(s), before)

    def test_day_limit_cannot_be_bypassed_by_apply(self):
        twin.dispatch('limit', 'snapshot', {})
        twin.advance(twin.sessions['limit'], 282)
        result = twin.dispatch('limit', 'compare', {})
        token = result['recommendation']['candidateId']
        with self.assertRaises(ValueError):
            twin.dispatch('limit', 'apply', {'candidateId': token})


if __name__ == '__main__':
    unittest.main()
