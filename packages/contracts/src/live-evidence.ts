import { z } from 'zod';
import type {
  EvidenceRequirement,
  LiveCheckpointBinding,
  PairedLiveResult,
  PendingLiveAction,
  PendingLiveActionIssue,
} from '../../domain/src/live-evidence.js';

const phase2Requirement = z.enum(['AUTH-01', 'AUTH-02', 'AUTH-03', 'AUTH-04', 'SEC-02', 'UAT-01']);
const platform = z.enum(['macos', 'windows']);
const source = z.enum(['moodle', 'edstem']);
const scenario = z.enum([
  'a.login', 'a.binding', 'a.course_visibility', 'b.reopen_1', 'b.reopen_2', 'b.reopen_3', 'b.worker_restart',
  'b.codex_exit', 'c.os_restart', 'd.24h_recheck', 'reauth',
]);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const safeCode = z.string().min(1).max(128).regex(/^[A-Z0-9_]+$/);
const version = z.string().regex(/^0\.\d+\.\d+(?:-beta\.[1-9]\d*)?$/);

export const EvidenceRequirementSchema: z.ZodType<EvidenceRequirement> = z.strictObject({
  requirement: phase2Requirement,
  platform: z.enum(['macos', 'windows', 'cross-platform']),
  source: z.enum(['moodle', 'edstem', 'both', 'none']),
  scenario: z.union([scenario, z.enum(['security_matrix', 'native_preflight', 'distribution'])]),
  evidence: z.enum(['S', 'I', 'N', 'L']),
  producer: z.enum(['signed_automated', 'paired_human_action']),
}).superRefine((requirement, context) => {
  if (requirement.evidence === 'L' && requirement.producer !== 'paired_human_action') {
    context.addIssue({ code: 'custom', message: 'Live evidence requires paired human authority' });
  }
  if (requirement.evidence !== 'L' && requirement.producer !== 'signed_automated') {
    context.addIssue({ code: 'custom', message: 'Automated evidence requires signed production authority' });
  }
  if (scenario.safeParse(requirement.scenario).success &&
      (requirement.evidence !== 'L' || requirement.platform === 'cross-platform' || requirement.source === 'both' || requirement.source === 'none')) {
    context.addIssue({ code: 'custom', message: 'Live scenario requirements are exact L cells' });
  }
});

const bindingShape = {
  buildId: hash,
  artifactId: hash,
  version,
  installationId: z.uuid(),
  platform,
  source,
  scenario,
  approvedConfigId: z.uuid(),
  approvedScopeId: z.uuid(),
  bindingFingerprint: hash,
  generation: z.number().int().nonnegative(),
  parentCheckpointId: z.uuid(),
  priorEvidenceEventId: z.uuid().nullable(),
} as const;

export const LiveCheckpointBindingSchema: z.ZodType<LiveCheckpointBinding> = z.strictObject(bindingShape);
export const PendingLiveActionIssueSchema: z.ZodType<PendingLiveActionIssue> = z.strictObject({
  ...bindingShape,
  ttlMs: z.number().int().min(60_000).max(7 * 24 * 60 * 60 * 1000),
});

export const PendingLiveActionSchema: z.ZodType<PendingLiveAction> = z.strictObject({
  actionId: z.uuid(),
  ...bindingShape,
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  state: z.enum(['pending', 'consumed', 'expired']),
  consumedAt: z.iso.datetime().nullable(),
}).superRefine((action, context) => {
  if (Date.parse(action.expiresAt) <= Date.parse(action.issuedAt)) {
    context.addIssue({ code: 'custom', message: 'Action expiry must follow issuance' });
  }
  if ((action.state === 'consumed') !== (action.consumedAt !== null)) {
    context.addIssue({ code: 'custom', message: 'Consumed actions require one consumption time' });
  }
});

export const PairedLiveResultSchema: z.ZodType<PairedLiveResult> = z.strictObject({
  actionId: z.uuid(),
  status: z.enum(['pass', 'fail']),
  resultCode: safeCode,
  bindingConsistency: z.enum(['consistent', 'mismatch', 'not_observed']),
  gaps: z.array(safeCode).max(32),
  checkedAt: z.iso.datetime(),
  correctionOfEventId: z.uuid().nullable(),
}).superRefine((result, context) => {
  if (result.status === 'pass' && result.gaps.length !== 0) {
    context.addIssue({ code: 'custom', message: 'Passing live results cannot retain gaps' });
  }
  if (result.status === 'pass' && result.bindingConsistency !== 'consistent') {
    context.addIssue({ code: 'custom', message: 'Passing live results require consistent binding' });
  }
});
