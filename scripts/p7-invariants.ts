import assert from 'node:assert/strict';
import {
  applicationStatus,
  deriveCustomerStatus,
  getGuidedRuntime,
  resolveProviderAvailability,
} from '../src/p7-provider';

const runtime = getGuidedRuntime();
let assertions = 0;
const equal = (actual: unknown, expected: unknown, label: string) => {
  assert.deepEqual(actual, expected, label);
  assertions += 1;
};

const rapid = deriveCustomerStatus(runtime.statusScenarios.rapidOptimal);
equal(rapid.optimisation, 'MPC_OPTIMAL', 'Rapid Warming is optimal');
equal(rapid.verification, 'VERIFIED_IN_DIGITAL_TWIN', 'Rapid Warming is nonlinearly verified');
equal(rapid.fallback, 'NOT_ACTIVE', 'Rapid Warming has no fallback');
equal(applicationStatus('optimised', rapid), 'APPLIED', 'Rapid Warming accepted action auto-applies');

const sunny = deriveCustomerStatus(runtime.statusScenarios.sunnyOptimal);
equal(sunny.optimisation, 'MPC_OPTIMAL', 'Sunny Winter is optimal');
equal(sunny.safety, 'NORMAL_VERIFIED', 'Sunny Winter is normally verified');

const cold = deriveCustomerStatus(runtime.statusScenarios.coldVerifiedFallback);
equal(cold.optimisation, 'SOLVER_LIMIT_REACHED', 'Cold Wave user_limit has an explained status');
equal(cold.verification, 'VERIFIED_FALLBACK', 'Cold Wave fallback is verified');
equal(cold.fallback, 'VERIFIED_FALLBACK_ACTIVE', 'Cold Wave fallback is explicit');
equal(cold.safety, 'VERIFIED_FALLBACK', 'Cold Wave safety is fallback-verified');
equal(applicationStatus('optimised', cold), 'APPLIED', 'Verified fallback can apply under frozen policy');

const near18 = deriveCustomerStatus(runtime.statusScenarios.near18Infeasible);
equal(near18.optimisation, 'CONSTRAINT_INFEASIBLE', 'Near-18 robust constraint is infeasible');
equal(near18.verification, 'NOT_VERIFIED', 'Near-18 fallback is not verified');
equal(near18.fallback, 'FALLBACK_ACTIVE', 'Near-18 fallback remains explicit');
equal(near18.safety, 'SAFETY_NOT_GUARANTEED', 'Near-18 safety is not guaranteed');
equal(applicationStatus('optimised', near18), 'FAILED_TO_APPLY', 'Unsafe action cannot auto-apply');

equal(applicationStatus('advisory', rapid), 'NOT_APPLIED', 'Advisory defaults to not applied');
equal(applicationStatus('advisory', rapid, true), 'APPLIED', 'Advisory applies only after operator action');
equal(applicationStatus('traditional', rapid), 'NOT_APPLIED', 'Traditional never applies an MPC recommendation');
equal(applicationStatus('optimised', rapid, false, true), 'SUPERSEDED', 'Superseded remains a product state');

equal(runtime.providers.optimisation.version, 'Formal MPC v1', 'Final optimiser version');
equal(runtime.legacyPreview.role, 'Intermediate Prototype / Engineering Benchmark', 'Preview is legacy only');
equal('applied' in runtime.optimisation, false, 'Optimisation response excludes application state');
equal(runtime.simulationTime, runtime.forecastAsOf, 'Guided snapshot timestamps align');
equal(runtime.optimisation.status.forecastAsOf, runtime.forecastAsOf, 'MPC decision uses the guided forecast issue time');
equal(runtime.recommendationEffectiveAt.endsWith('11:00:00+08:00'), true, 'Recommendation effective time preserves local offset');

equal(runtime.comparison.mpc.complianceRate, 1, 'Accepted P6 compliance is unchanged');
equal(runtime.comparison.mpc.overheatingRate, 0.30844907407407407, 'Accepted P6 overheating is unchanged');
equal(runtime.comparison.mpc.excessDeliveredHeatMWh, 1.184468923170793, 'Accepted P6 oversupply is unchanged');
equal(runtime.statusScenarios.near18Infeasible.realisedMinimumC, 17.380542524267337, 'Accepted P6 stress result is unchanged');

equal(resolveProviderAvailability({ hasData: false }).status, 'UNAVAILABLE', 'Missing prediction is unavailable');
equal(resolveProviderAvailability({ hasData: true, timedOut: true }).status, 'TIMEOUT', 'Provider timeout is explicit');
equal(resolveProviderAvailability({ hasData: true, ageMinutes: 31, maxAgeMinutes: 30 }), { status: 'STALE', usable: false, stale: true }, 'Stale success data cannot be used');
equal(resolveProviderAvailability({ hasData: true }), { status: 'AVAILABLE', usable: true, stale: false }, 'Fresh provider data is usable');
equal(deriveCustomerStatus({ ...runtime.statusScenarios.rapidOptimal, optimisationStatus: 'solver_error', verificationStatus: 'failed' }).optimisation, 'OPTIMISATION_FAILED', 'Solver failure is explicit');
equal(deriveCustomerStatus({ ...runtime.statusScenarios.rapidOptimal, optimisationStatus: 'user_limit', verificationStatus: 'failed' }).optimisation, 'SOLVER_LIMIT_REACHED', 'Unverified solver limit is never optimal');

console.log(`P7 integration invariants: ${assertions} passed, 0 failed, 0 skipped`);
