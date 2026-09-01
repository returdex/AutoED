import { randomUUID } from 'node:crypto';
import { SyntheticEvidenceReceiptSchema } from '../../contracts/src/index.js';
import type { NativePlatform, SourceId, UatScenario } from '../../domain/src/model.js';

export interface SyntheticReceiptInput {
  platform: NativePlatform;
  source: SourceId;
  scenario: UatScenario;
  buildId?: string;
  version?: string;
  checkedAt?: string;
}

/** Creates rejection-oriented synthetic evidence and cannot be promoted to native or live evidence. */
export function makeSyntheticReceipt(input: SyntheticReceiptInput) {
  return SyntheticEvidenceReceiptSchema.parse({
    receiptId: randomUUID(),
    buildId: input.buildId ?? 'a'.repeat(64),
    version: input.version ?? '0.1.0',
    platform: input.platform,
    source: input.source,
    scenario: input.scenario,
    evidence: 'S',
    status: 'fail',
    resultCode: 'SYNTHETIC_REJECTION_OBSERVED',
    bindingConsistency: 'not_observed',
    gaps: [],
    checkedAt: input.checkedAt ?? '2026-09-01T00:00:00.000Z',
    provenance: { kind: 'automated', evidence: 'S', producerId: 'phase-02-contract-fixture' },
  });
}
