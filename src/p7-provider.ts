import payload from './p7-runtime-data.json';

export type OptimisationStatus = 'optimal' | 'optimal_inaccurate' | 'user_limit' | 'infeasible' | 'solver_error';
export type VerificationStatus = 'passed' | 'fallback_verified' | 'fallback_unverified' | 'failed';
export type FallbackStatus = 'not_used' | 'fallback_verified' | 'fallback_unverified';
export type SafetyStatus = 'NORMAL_VERIFIED' | 'VERIFIED_FALLBACK' | 'SAFETY_NOT_GUARANTEED' | 'NONLINEAR_VERIFICATION_FAILED';
export type ApplicationStatus = 'NOT_APPLIED' | 'APPLIED' | 'SUPERSEDED' | 'FAILED_TO_APPLY';
export type RuntimeMode = 'traditional' | 'advisory' | 'optimised';
export type ProviderAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'TIMEOUT' | 'STALE';

export interface ProviderAvailabilityInput {
  hasData: boolean;
  error?: unknown;
  timedOut?: boolean;
  ageMinutes?: number;
  maxAgeMinutes?: number;
}

export interface ProviderAvailabilityState {
  status: ProviderAvailability;
  usable: boolean;
  stale: boolean;
}

export interface ProviderStatusRecord {
  recommendationId: string;
  forecastAsOf: string;
  optimisationStatus: string;
  verificationStatus: string;
  fallbackStatus: string;
  fallbackReason: string | null;
  robustMarginC: number;
}

export interface CustomerStatus {
  optimisation: 'MPC_OPTIMAL' | 'SOLVER_LIMIT_REACHED' | 'CONSTRAINT_INFEASIBLE' | 'OPTIMISATION_FAILED';
  verification: 'VERIFIED_IN_DIGITAL_TWIN' | 'VERIFIED_FALLBACK' | 'NOT_VERIFIED';
  fallback: 'NOT_ACTIVE' | 'VERIFIED_FALLBACK_ACTIVE' | 'FALLBACK_ACTIVE';
  safety: SafetyStatus;
}

export function deriveCustomerStatus(record: ProviderStatusRecord): CustomerStatus {
  if (record.fallbackStatus === 'fallback_verified') return {
    optimisation: record.optimisationStatus === 'user_limit' ? 'SOLVER_LIMIT_REACHED' : 'OPTIMISATION_FAILED',
    verification: 'VERIFIED_FALLBACK', fallback: 'VERIFIED_FALLBACK_ACTIVE', safety: 'VERIFIED_FALLBACK',
  };
  if (record.fallbackStatus === 'fallback_unverified' || record.optimisationStatus === 'infeasible') return {
    optimisation: 'CONSTRAINT_INFEASIBLE', verification: 'NOT_VERIFIED', fallback: 'FALLBACK_ACTIVE', safety: 'SAFETY_NOT_GUARANTEED',
  };
  if (record.optimisationStatus === 'user_limit') return {
    optimisation: 'SOLVER_LIMIT_REACHED', verification: 'NOT_VERIFIED', fallback: 'NOT_ACTIVE', safety: 'NONLINEAR_VERIFICATION_FAILED',
  };
  if (record.optimisationStatus === 'solver_error') return {
    optimisation: 'OPTIMISATION_FAILED', verification: 'NOT_VERIFIED', fallback: 'NOT_ACTIVE', safety: 'NONLINEAR_VERIFICATION_FAILED',
  };
  if (record.verificationStatus !== 'passed') return {
    optimisation: 'OPTIMISATION_FAILED', verification: 'NOT_VERIFIED', fallback: 'NOT_ACTIVE', safety: 'NONLINEAR_VERIFICATION_FAILED',
  };
  return { optimisation: 'MPC_OPTIMAL', verification: 'VERIFIED_IN_DIGITAL_TWIN', fallback: 'NOT_ACTIVE', safety: 'NORMAL_VERIFIED' };
}

export function resolveProviderAvailability(input: ProviderAvailabilityInput): ProviderAvailabilityState {
  if (input.timedOut) return { status: 'TIMEOUT', usable: false, stale: false };
  if (input.error || !input.hasData) return { status: 'UNAVAILABLE', usable: false, stale: false };
  if ((input.ageMinutes ?? 0) > (input.maxAgeMinutes ?? 30)) return { status: 'STALE', usable: false, stale: true };
  return { status: 'AVAILABLE', usable: true, stale: false };
}

export function applicationStatus(mode: RuntimeMode, status: CustomerStatus, advisoryApplied = false, superseded = false): ApplicationStatus {
  if (superseded) return 'SUPERSEDED';
  if (mode === 'advisory') return advisoryApplied ? 'APPLIED' : 'NOT_APPLIED';
  if (mode === 'traditional') return 'NOT_APPLIED';
  return status.safety === 'NORMAL_VERIFIED' || status.safety === 'VERIFIED_FALLBACK' ? 'APPLIED' : 'FAILED_TO_APPLY';
}

export const getGuidedRuntime = () => payload;
export const SimulationProvider = { current: () => payload.now };
export const PredictionProvider = { current: () => payload.predictions };
export const ThermalPredictionProvider = { current: () => payload.thermalPrediction };
export const OptimisationProvider = { current: () => payload.optimisation };
export const ResultsProvider = { current: () => payload.comparison };
export const ScenarioProvider = { current: () => ({ scenario: payload.scenario, family: payload.scenarioFamily }) };
export const ApplicationStateProvider = { derive: applicationStatus };
