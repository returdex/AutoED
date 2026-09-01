export type ThreatId =
  | 'T2-01'
  | 'T2-02'
  | 'T2-03'
  | 'T2-04'
  | 'T2-05'
  | 'T2-06'
  | 'T2-07'
  | 'T2-08';

export type SecurityCaseId =
  | 'AUTH_UNAUTHENTICATED'
  | 'AUTH_EXPIRED'
  | 'AUTH_PERMISSION_DENIED'
  | 'AUTH_NETWORK_TIMEOUT'
  | 'AUTH_PARSER_DRIFT'
  | 'BINDING_SAME_NAME_DIFFERENT_SUBJECT'
  | 'BINDING_IDENTITY_MISMATCH'
  | 'ORIGIN_OUT_OF_ORIGIN'
  | 'INPUT_ARBITRARY_OPERATION'
  | 'EFFECT_BUSINESS_WRITE'
  | 'EFFECT_DOWNLOAD'
  | 'OUTPUT_SENSITIVE_SENTINEL'
  | 'PROFILE_HELD'
  | 'PROFILE_PID_REUSE'
  | 'WORKER_STALE_BEFORE_REQUEST'
  | 'WORKER_STALE_BEFORE_COMMIT'
  | 'RETENTION_LAST_SUCCESS'
  | 'UI_UNPAIRED_PROTECTED_READ'
  | 'EVIDENCE_OS_POLLUTION'
  | 'EVIDENCE_CLASS_POLLUTION'
  | 'EVIDENCE_SCENARIO_POLLUTION'
  | 'EVIDENCE_FIXTURE_L';

export type SecurityLayer =
  | 'contract'
  | 'state'
  | 'adapter'
  | 'profile'
  | 'worker'
  | 'persistence'
  | 'api'
  | 'evidence';

export type ForbiddenSideEffect =
  | 'source_request'
  | 'source_write'
  | 'download'
  | 'profile_reclaim'
  | 'job_commit'
  | 'ledger_append_l';

export interface SecurityMatrixCase {
  id: SecurityCaseId;
  threats: readonly ThreatId[];
  layers: readonly SecurityLayer[];
  expectedCode: string;
  expectedDisposition: 'reject' | 'human_needed' | 'preserve_and_pause';
  mustNotCall: readonly ForbiddenSideEffect[];
}

export const REQUIRED_SECURITY_CASE_IDS = Object.freeze([
  'AUTH_UNAUTHENTICATED',
  'AUTH_EXPIRED',
  'AUTH_PERMISSION_DENIED',
  'AUTH_NETWORK_TIMEOUT',
  'AUTH_PARSER_DRIFT',
  'BINDING_SAME_NAME_DIFFERENT_SUBJECT',
  'BINDING_IDENTITY_MISMATCH',
  'ORIGIN_OUT_OF_ORIGIN',
  'INPUT_ARBITRARY_OPERATION',
  'EFFECT_BUSINESS_WRITE',
  'EFFECT_DOWNLOAD',
  'OUTPUT_SENSITIVE_SENTINEL',
  'PROFILE_HELD',
  'PROFILE_PID_REUSE',
  'WORKER_STALE_BEFORE_REQUEST',
  'WORKER_STALE_BEFORE_COMMIT',
  'RETENTION_LAST_SUCCESS',
  'UI_UNPAIRED_PROTECTED_READ',
  'EVIDENCE_OS_POLLUTION',
  'EVIDENCE_CLASS_POLLUTION',
  'EVIDENCE_SCENARIO_POLLUTION',
  'EVIDENCE_FIXTURE_L',
] as const satisfies readonly SecurityCaseId[]);

export const SECURITY_MATRIX_SENTINELS = Object.freeze({
  identity: 'SYNTHETIC_PRIVATE_IDENTITY_SENTINEL',
  organization: 'SYNTHETIC_PRIVATE_ORGANIZATION_SENTINEL',
  tenant: 'SYNTHETIC_PRIVATE_TENANT_SENTINEL',
  course: 'SYNTHETIC_PRIVATE_COURSE_SENTINEL',
  exception: 'SYNTHETIC_PRIVATE_EXCEPTION_SENTINEL',
  stack: 'SYNTHETIC_PRIVATE_STACK_SENTINEL',
});

function matrixCase(value: SecurityMatrixCase): Readonly<SecurityMatrixCase> {
  return Object.freeze({
    ...value,
    threats: Object.freeze([...value.threats]),
    layers: Object.freeze([...value.layers]),
    mustNotCall: Object.freeze([...value.mustNotCall]),
  });
}

export const SECURITY_MATRIX_CASES: readonly Readonly<SecurityMatrixCase>[] = Object.freeze([
  matrixCase({ id: 'AUTH_UNAUTHENTICATED', threats: ['T2-06'], layers: ['state', 'persistence'], expectedCode: 'AUTH_REQUIRED', expectedDisposition: 'preserve_and_pause', mustNotCall: ['job_commit'] }),
  matrixCase({ id: 'AUTH_EXPIRED', threats: ['T2-05', 'T2-06'], layers: ['state', 'worker', 'persistence'], expectedCode: 'REAUTH_REQUIRED', expectedDisposition: 'preserve_and_pause', mustNotCall: ['job_commit'] }),
  matrixCase({ id: 'AUTH_PERMISSION_DENIED', threats: ['T2-06'], layers: ['state', 'adapter', 'persistence'], expectedCode: 'CAPABILITY_DENIED', expectedDisposition: 'preserve_and_pause', mustNotCall: ['source_write'] }),
  matrixCase({ id: 'AUTH_NETWORK_TIMEOUT', threats: ['T2-05', 'T2-06'], layers: ['state', 'adapter', 'worker', 'persistence'], expectedCode: 'NETWORK_UNAVAILABLE', expectedDisposition: 'preserve_and_pause', mustNotCall: ['source_write'] }),
  matrixCase({ id: 'AUTH_PARSER_DRIFT', threats: ['T2-01', 'T2-06'], layers: ['state', 'adapter', 'persistence'], expectedCode: 'PARSER_CHANGED', expectedDisposition: 'preserve_and_pause', mustNotCall: ['source_write'] }),
  matrixCase({ id: 'BINDING_SAME_NAME_DIFFERENT_SUBJECT', threats: ['T2-03'], layers: ['state'], expectedCode: 'IDENTITY_MISMATCH', expectedDisposition: 'reject', mustNotCall: ['source_request', 'job_commit'] }),
  matrixCase({ id: 'BINDING_IDENTITY_MISMATCH', threats: ['T2-03'], layers: ['state', 'persistence'], expectedCode: 'IDENTITY_MISMATCH', expectedDisposition: 'preserve_and_pause', mustNotCall: ['source_request', 'job_commit'] }),
  matrixCase({ id: 'ORIGIN_OUT_OF_ORIGIN', threats: ['T2-01'], layers: ['contract', 'adapter'], expectedCode: 'ORIGIN_MISMATCH', expectedDisposition: 'reject', mustNotCall: ['source_request', 'source_write'] }),
  matrixCase({ id: 'INPUT_ARBITRARY_OPERATION', threats: ['T2-01', 'T2-07'], layers: ['contract', 'api'], expectedCode: 'INVALID_REQUEST', expectedDisposition: 'reject', mustNotCall: ['source_request', 'source_write', 'download', 'profile_reclaim', 'job_commit', 'ledger_append_l'] }),
  matrixCase({ id: 'EFFECT_BUSINESS_WRITE', threats: ['T2-01'], layers: ['adapter'], expectedCode: 'BROWSER_WRITE_BLOCKED', expectedDisposition: 'reject', mustNotCall: ['source_write'] }),
  matrixCase({ id: 'EFFECT_DOWNLOAD', threats: ['T2-01'], layers: ['adapter'], expectedCode: 'BROWSER_DOWNLOAD_BLOCKED', expectedDisposition: 'reject', mustNotCall: ['download'] }),
  matrixCase({ id: 'OUTPUT_SENSITIVE_SENTINEL', threats: ['T2-02', 'T2-07'], layers: ['contract', 'persistence', 'api'], expectedCode: 'INTERNAL_ERROR', expectedDisposition: 'reject', mustNotCall: ['ledger_append_l'] }),
  matrixCase({ id: 'PROFILE_HELD', threats: ['T2-04'], layers: ['profile'], expectedCode: 'PROFILE_IN_USE', expectedDisposition: 'human_needed', mustNotCall: ['profile_reclaim'] }),
  matrixCase({ id: 'PROFILE_PID_REUSE', threats: ['T2-04'], layers: ['profile'], expectedCode: 'PROFILE_OWNERSHIP_UNCONFIRMED', expectedDisposition: 'human_needed', mustNotCall: ['profile_reclaim'] }),
  matrixCase({ id: 'WORKER_STALE_BEFORE_REQUEST', threats: ['T2-05'], layers: ['worker'], expectedCode: 'AUTH_JOB_STALE', expectedDisposition: 'reject', mustNotCall: ['source_request', 'job_commit'] }),
  matrixCase({ id: 'WORKER_STALE_BEFORE_COMMIT', threats: ['T2-05'], layers: ['worker', 'persistence'], expectedCode: 'AUTH_JOB_STALE', expectedDisposition: 'reject', mustNotCall: ['job_commit'] }),
  matrixCase({ id: 'RETENTION_LAST_SUCCESS', threats: ['T2-06'], layers: ['state', 'persistence'], expectedCode: 'LAST_SUCCESS_RETAINED', expectedDisposition: 'preserve_and_pause', mustNotCall: ['job_commit'] }),
  matrixCase({ id: 'UI_UNPAIRED_PROTECTED_READ', threats: ['T2-02', 'T2-07'], layers: ['api'], expectedCode: 'UNAUTHORIZED', expectedDisposition: 'reject', mustNotCall: ['source_request', 'job_commit'] }),
  matrixCase({ id: 'EVIDENCE_OS_POLLUTION', threats: ['T2-08'], layers: ['persistence', 'evidence'], expectedCode: 'EVIDENCE_AUTHORITY_PLATFORM_MISMATCH', expectedDisposition: 'reject', mustNotCall: ['ledger_append_l'] }),
  matrixCase({ id: 'EVIDENCE_CLASS_POLLUTION', threats: ['T2-08'], layers: ['contract', 'persistence', 'evidence'], expectedCode: 'EVIDENCE_AUTHORITY_MISMATCH', expectedDisposition: 'reject', mustNotCall: ['ledger_append_l'] }),
  matrixCase({ id: 'EVIDENCE_SCENARIO_POLLUTION', threats: ['T2-08'], layers: ['persistence', 'evidence'], expectedCode: 'EVIDENCE_CELL_MISMATCH', expectedDisposition: 'reject', mustNotCall: ['ledger_append_l'] }),
  matrixCase({ id: 'EVIDENCE_FIXTURE_L', threats: ['T2-08'], layers: ['contract', 'evidence'], expectedCode: 'EVIDENCE_LIVE_AUTHORITY_REQUIRED', expectedDisposition: 'reject', mustNotCall: ['ledger_append_l'] }),
]);

const THREATS = Object.freeze(['T2-01', 'T2-02', 'T2-03', 'T2-04', 'T2-05', 'T2-06', 'T2-07', 'T2-08'] as const);
const LAYERS = Object.freeze(['contract', 'state', 'adapter', 'profile', 'worker', 'persistence', 'api', 'evidence'] as const);

export function assertSecurityMatrixCoverage<T extends readonly SecurityMatrixCase[]>(cases: T): T {
  const required = new Set<string>(REQUIRED_SECURITY_CASE_IDS);
  const seen = new Set<string>();
  const coveredThreats = new Set<string>();
  const coveredLayers = new Set<string>();
  for (const item of cases) {
    if (!required.has(item.id)) throw new Error('SECURITY_CASE_UNKNOWN');
    if (seen.has(item.id)) throw new Error('SECURITY_CASE_DUPLICATE');
    seen.add(item.id);
    if (item.threats.length === 0) throw new Error('SECURITY_CASE_THREAT_REQUIRED');
    if (item.layers.length === 0) throw new Error('SECURITY_CASE_LAYER_REQUIRED');
    if (item.mustNotCall.length === 0) throw new Error('SECURITY_CASE_SIDE_EFFECT_REQUIRED');
    for (const threat of item.threats) {
      if (!(THREATS as readonly string[]).includes(threat)) throw new Error('SECURITY_CASE_THREAT_UNKNOWN');
      coveredThreats.add(threat);
    }
    for (const layer of item.layers) {
      if (!(LAYERS as readonly string[]).includes(layer)) throw new Error('SECURITY_CASE_LAYER_UNKNOWN');
      coveredLayers.add(layer);
    }
  }
  for (const id of REQUIRED_SECURITY_CASE_IDS) if (!seen.has(id)) throw new Error('SECURITY_CASE_MISSING');
  for (const threat of THREATS) if (!coveredThreats.has(threat)) throw new Error('SECURITY_THREAT_MISSING');
  for (const layer of LAYERS) if (!coveredLayers.has(layer)) throw new Error('SECURITY_LAYER_MISSING');
  return cases;
}

assertSecurityMatrixCoverage(SECURITY_MATRIX_CASES);
