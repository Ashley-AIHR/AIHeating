import unittest
import time
from copy import deepcopy
import twin

class OptimiserTests(unittest.TestCase):
    def setUp(self):
        twin.sessions.clear()

    def test_bounded_reproducible_schedule_and_fresh_verification(self):
        before=twin.dispatch('opt','snapshot',{})
        a=twin.dispatch('opt','optimise',{})
        b=twin.dispatch('opt','optimise',{})
        self.assertEqual(before,twin.dispatch('opt','snapshot',{}))
        self.assertEqual(a['bestAttempt']['planHash'],b['bestAttempt']['planHash'])
        self.assertLessEqual(a['evaluations'],42)
        self.assertTrue(a['verification']['passed'])
        plan=a['recommendation']
        self.assertEqual(len(plan['trace']),6)
        for row in plan['trace']:
            self.assertEqual(len(row['state']['buildings']),12)
            self.assertEqual(row['state']['elapsedMinutes'],before['elapsedMinutes']+row['minutes'])
        self.assertLessEqual(abs(plan['schedule'][0]['supplyC']-before['supplyC']),2)
        self.assertLessEqual(abs(plan['schedule'][1]['supplyC']-plan['schedule'][0]['supplyC']),2)
        after=twin.dispatch('opt','apply',{'candidateId':plan['candidateId']})
        self.assertEqual(after['elapsedMinutes'],before['elapsedMinutes']+30)
        with self.assertRaises(ValueError):twin.dispatch('opt','apply',{'candidateId':plan['candidateId']})

    def test_expired_plan_and_infeasible_initial_state(self):
        r=twin.dispatch('exp','optimise',{})
        token=r['recommendation']['candidateId']
        twin.sessions['exp']['candidates'][token]['expires']=time.time()-1
        with self.assertRaises(ValueError):twin.dispatch('exp','apply',{'candidateId':token})
        twin.sessions['exp']['engine'].temperatures['B01']=17
        r=twin.dispatch('exp','optimise',{})
        self.assertIsNone(r['recommendation'])
        self.assertFalse(r['verification']['passed'])

    def test_replay_is_immutable_and_reset_clears_it(self):
        twin.dispatch('rep','snapshot',{})
        first=deepcopy(twin.dispatch('rep','replay',{})['frames'][0])
        twin.dispatch('rep','advance',{})
        history=twin.dispatch('rep','replay',{})
        self.assertEqual(first,history['frames'][0])
        self.assertEqual(len(history['frames']),2)
        twin.dispatch('rep','reset',{'scenario':'sensor'})
        self.assertEqual(len(twin.dispatch('rep','replay',{})['frames']),1)

    def test_bad_objective_and_cross_session_plan(self):
        with self.assertRaises(ValueError):twin.dispatch('a','optimise',{'objective':'unsafe'})
        token=twin.dispatch('a','optimise',{})['recommendation']['candidateId']
        with self.assertRaises(ValueError):twin.dispatch('b','apply',{'candidateId':token})
