import { createHash } from 'node:crypto';
import { z } from 'zod';
import type {
  AccountBinding,
  ApprovedSourceConfig,
  EvidenceReceipt,
  ProtectedSourceIdentity,
  SourceId,
  SourceObservation,
} from '../../domain/src/model.js';
import {
  AccountBindingSchema,
  ApprovedSourceConfigSchema,
  ProtectedSourceIdentitySchema,
  SourceObservationSchema,
} from './index.js';

/** Pure, shared CLI/UI feedback. Only known public fields reach presentation. */
interface DisplayIdentity {version:string;buildId:string;commit:string;tree:string;dependencyHash:string;protocol:number;schemaMin:number;schemaMax:number;capabilities:string[]}
interface DisplayComponent {role:string;build:DisplayIdentity|null;health:string;freshness?:string|undefined;checkedAt:string|null;evidence:string}
interface DisplayStatus {
  manifest?:{build:DisplayIdentity;manifestHash:string;checkedAt:string;evidence:string}|null|undefined;
  api:DisplayComponent|null;worker:DisplayComponent|null;
  install:{stage:string;result:string;cleanup:string;targetBuild:DisplayIdentity|null;actualBuild:DisplayIdentity|null;checkedAt:string|null;previousInstallation?:'none'|'present'|'unknown'|undefined}|null;
  selfcheck:{jobId:string|null;featureResult:string;probes:DisplayComponent[];checkedAt:string|null}|null;
}
export interface PublicFeedback {code:string;stage:string;impact:string;nextAction:string;message:string}
const unverifiedCopy='未验证，不代表已通过。';
const stages=new Set(['preview','download','verify','stage','quiesce','backup','migrate','activate','selfcheck','cleanup','complete','rollback','stopped']);
function displaySame(a:DisplayIdentity|null,b:DisplayIdentity|null) {return Boolean(a&&b&&a.version===b.version&&a.buildId===b.buildId&&a.commit===b.commit&&a.tree===b.tree&&a.dependencyHash===b.dependencyHash&&a.protocol===b.protocol&&a.schemaMin===b.schemaMin&&a.schemaMax===b.schemaMax&&[...a.capabilities].sort().join() === [...b.capabilities].sort().join());}
function betaVersion(value:string) {return /^0\.\d+\.\d+(?:-beta\.[1-9]\d*)?$/.test(value)?value:'未验证';}
function feedback(code:string,stage:string,message:string,impact='操作未完成或尚未验证。',nextAction='请通过本安装的 CLI 查看脱敏诊断。'):PublicFeedback {return {code,stage:stages.has(stage)?stage:'unknown',message,impact,nextAction};}
export function presentInstall(status:DisplayStatus):PublicFeedback&{complete:boolean} {
  const i=status.install;
  const output=(code:string,message:string,complete=false)=>({...feedback(code,i?.stage??'unknown',message,complete?'上次操作记录已通过验证；当前运行状态单独观察。':undefined),complete});
  if(!i)return output('NOT_OBSERVED',unverifiedCopy);
  if(i.result==='human_needed')return output('HUMAN_NEEDED','操作已停止，尚不能确认安全恢复方式。请查看脱敏原因并等待人工确认；不要删除资料或强制降级。');
  if(i.result==='restored')return output('UPGRADE_RESTORED',i.actualBuild?`升级失败，已恢复旧版。当前运行 ${betaVersion(i.actualBuild.version)}；未自动重试升级。`:'恢复结果未验证；不能确认已恢复旧版。');
  if(i.result==='failed')return output('INSTALL_FAILED',i.previousInstallation==='none'?'安装失败，服务尚未就绪。当前没有可恢复的旧版；请按诊断结果处理。':'操作失败；旧版本与恢复状态尚未确认。请通过本安装的 CLI 检查诊断结果。');
  if(i.cleanup==='cleanup_pending')return output('CLEANUP_PENDING','旧受管程序、入口或进程尚未清理完成，操作未完成；目标运行状态请查看自检结果。');
  if(i.targetBuild&&i.actualBuild&&!displaySame(i.targetBuild,i.actualBuild))return output('VERSION_MISMATCH','检测到组件版本不一致，操作未完成。请查看差异并通过本安装的升级流程处理。');
  const check=status.selfcheck;
  // Historical completion does not expire with heartbeats. Its proof must still
  // describe the target, including all four actual component observations.
  const manifest=status.manifest;
  const proven=manifest&&['build_manifest','verified_release_manifest'].includes(manifest.evidence)&&manifest.manifestHash.length===64&&displaySame(manifest.build,i.targetBuild)&&check?.featureResult==='pass'&&check.jobId!==null&&check.checkedAt!==null&&Date.parse(manifest.checkedAt)<=Date.parse(check.checkedAt)&&check.probes.length===4&&new Set(check.probes.map(p=>p.role)).size===4&&['api','worker','cli','mcp'].every(role=>check.probes.some(p=>p.role===role&&p.health==='healthy'&&p.evidence!=='not_observed'&&p.checkedAt!==null&&displaySame(p.build,i.targetBuild)));
  if(i.result==='succeeded'&&i.stage==='complete'&&i.checkedAt!==null&&i.cleanup==='complete'&&displaySame(i.targetBuild,i.actualBuild)&&proven)return output('INSTALL_COMPLETE','操作完成：目标版本已启动，实际接线自检通过，旧版本清理完成。'+(i.previousInstallation==='none'?'首次安装，无旧版本需要清理。':''),true);
  if(i.targetBuild&&[status.api,status.worker,...(check?.probes??[])].some(c=>c?.build&&!displaySame(c.build,i.targetBuild)))return output('VERSION_MISMATCH','检测到组件版本不一致，操作未完成。请查看差异并通过本安装的升级流程处理。');
  return output('NOT_VERIFIED',`操作未完成。${unverifiedCopy}`);
}
export function presentWorker(worker:DisplayComponent|null,offline:boolean):string {
  if(offline)return '旧快照：API 与 Worker 当前运行状态未确认。';
  if(!worker||worker.evidence==='not_observed')return '尚未观察到 Worker；当前运行状态未确认。请通过本安装的 CLI 检查服务。';
  if(worker.freshness!=='fresh')return 'Worker 观察已过期，当前运行状态未确认。请通过本安装的 CLI 检查服务。';
  if(worker.health==='not_observed')return 'API 可连接，但 Worker 未运行，后台任务暂不能执行。请通过本安装的 CLI 检查服务。';
  if(worker.health==='healthy')return 'Worker 最近观察为健康；观察时间见下方。';
  return 'Worker 报告异常或降级；是否仍在运行尚未确认。请通过本安装的 CLI 检查服务。';
}
export function presentFailure(code:string,stage:string):PublicFeedback {
  const allowed=new Set(['NETWORK_ERROR','PERMISSION_DENIED','RIGHTS_RESTRICTED','SCOPE_DENIED','GENERATION_MISMATCH','JOB_FAILED','CLEANUP_PENDING']);
  return feedback(allowed.has(code)?code:'UNKNOWN_ERROR',stage,'操作失败。请查看脱敏错误代码并通过本安装的诊断步骤处理。');
}
export function presentHumanGate(version:string):PublicFeedback {return feedback('HUMAN_NEEDED','selfcheck',`自动检查已完成；请更新到已发布的 ${betaVersion(version)} 并按测试清单操作，结果等待你的反馈。`,'人工验收尚未完成。','请更新已发布测试版并反馈测试结果。');}

export type SafeAuthErrorCode =
  | 'AUTHENTICATED'
  | 'NOT_OBSERVED'
  | 'AUTH_REQUIRED'
  | 'REAUTH_REQUIRED'
  | 'NETWORK_UNAVAILABLE'
  | 'PARSER_CHANGED'
  | 'CAPABILITY_DENIED'
  | 'IDENTITY_MISMATCH'
  | 'PROFILE_IN_USE'
  | 'PROFILE_OWNERSHIP_UNCONFIRMED'
  | 'CONFIGURATION_CONFIRMED'
  | 'LOGIN_OPENED'
  | 'PROBE_ACCEPTED'
  | 'LOGOUT_RECORDED'
  | 'BINDING_CONFIRMED'
  | 'BINDING_REJECTED'
  | 'INVALID_REQUEST'
  | 'CONFIGURATION_MISMATCH'
  | 'SCOPE_MISMATCH'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'PAIRING_DENIED'
  | 'UNKNOWN_SOURCE_ERROR'
  | 'INTERNAL_ERROR';

const SafeAuthErrorCodeSchema = z.enum([
  'AUTHENTICATED', 'NOT_OBSERVED', 'AUTH_REQUIRED', 'REAUTH_REQUIRED', 'NETWORK_UNAVAILABLE', 'PARSER_CHANGED',
  'CAPABILITY_DENIED', 'IDENTITY_MISMATCH', 'PROFILE_IN_USE', 'PROFILE_OWNERSHIP_UNCONFIRMED',
  'CONFIGURATION_CONFIRMED', 'LOGIN_OPENED', 'PROBE_ACCEPTED', 'LOGOUT_RECORDED', 'BINDING_CONFIRMED',
  'BINDING_REJECTED', 'INVALID_REQUEST', 'CONFIGURATION_MISMATCH', 'SCOPE_MISMATCH', 'FORBIDDEN',
  'UNAUTHORIZED', 'PAIRING_DENIED', 'UNKNOWN_SOURCE_ERROR', 'INTERNAL_ERROR',
]);

const sourceId = z.enum(['moodle', 'edstem']);
const timestamp = z.iso.datetime().nullable();
const gapCode = z.string().min(1).max(128).regex(/^[A-Z0-9_]+$/);
const displayFingerprint = z.string().regex(/^[A-Z2-7]{12}$/).nullable();
const bindingConsistency = z.enum(['not_observed', 'candidate', 'confirmed', 'mismatch']);
const sourceAuth = z.enum(['not_observed', 'authenticated', 'unauthenticated', 'reauth_required', 'identity_mismatch']);
const sourceCapability = z.enum(['unknown', 'available', 'unavailable', 'denied']);
const sourceHealth = z.enum(['not_observed', 'healthy', 'degraded', 'error']);
const sourceFreshness = z.enum(['not_observed', 'fresh', 'stale']);
const sourceCompleteness = z.enum(['not_observed', 'complete', 'partial']);

export interface ProtectedAuthStatusProjection {
  overall: { code: SafeAuthErrorCode; phase3Eligibility: 'blocked'; gaps: readonly string[] };
  sources: readonly {
    source: SourceId;
    officialOrigin: string;
    identity: { displayName: string; schoolEmail: string } | null;
    auth: SourceObservation['auth'];
    capability: SourceObservation['capability'];
    health: SourceObservation['health'];
    freshness: SourceObservation['freshness'];
    completeness: SourceObservation['completeness'];
    checkedAt: string | null;
    resultCode: SafeAuthErrorCode;
    sharedProfile: 'candidate' | 'observed' | 'unverified';
  }[];
  binding: { consistency: 'not_observed' | 'candidate' | 'confirmed' | 'mismatch'; identityFingerprint: string | null };
  nextAction:
    | { kind: 'open_login'; source: SourceId; approvedConfigId: string }
    | { kind: 'confirm_binding'; candidateBindingId: string }
    | { kind: 'wait' | 'none' };
}

export interface RedactedAuthStatusProjection {
  overall: { code: SafeAuthErrorCode; phase3Eligibility: 'blocked'; gaps: readonly string[] };
  sources: readonly {
    source: SourceId;
    auth: string;
    capability: string;
    health: string;
    freshness: string;
    completeness: string;
    checkedAt: string | null;
    resultCode: SafeAuthErrorCode;
    identityFingerprint: string | null;
  }[];
  bindingConsistency: 'not_observed' | 'candidate' | 'confirmed' | 'mismatch';
}

export interface RedactedEvidenceReceipt {
  receiptId: string;
  buildId: string;
  version: string;
  platform: 'macos' | 'windows';
  source: SourceId;
  scenario: string;
  evidence: 'S' | 'I' | 'N' | 'L';
  status: 'pass' | 'fail' | 'not_run' | 'human_needed';
  resultCode: SafeAuthErrorCode | string;
  bindingConsistency: 'consistent' | 'mismatch' | 'not_observed';
  identityFingerprint: string | null;
  gaps: readonly string[];
  checkedAt: string;
  nextAction: 'none' | 'resolve_gaps' | 'human_action_required';
}

export interface AuthActionAccepted {
  accepted: true;
  actionReceiptId: string;
  resultCode: SafeAuthErrorCode;
}

export interface SafeAuthApiError {
  code: SafeAuthErrorCode;
  stage: 'auth_api';
  nextAction: string;
}

const overallSchema = z.strictObject({ code: SafeAuthErrorCodeSchema, phase3Eligibility: z.literal('blocked'), gaps: z.array(gapCode).max(64) });
const protectedSourceSchema = z.strictObject({
  source: sourceId,
  officialOrigin: z.url().refine(value => new URL(value).origin === value, 'Canonical origin required'),
  identity: z.strictObject({ displayName: z.string().min(1).max(256), schoolEmail: z.email().max(320) }).nullable(),
  auth: sourceAuth,
  capability: sourceCapability,
  health: sourceHealth,
  freshness: sourceFreshness,
  completeness: sourceCompleteness,
  checkedAt: timestamp,
  resultCode: SafeAuthErrorCodeSchema,
  sharedProfile: z.enum(['candidate', 'observed', 'unverified']),
});
const redactedSourceSchema = z.strictObject({
  source: sourceId,
  auth: sourceAuth,
  capability: sourceCapability,
  health: sourceHealth,
  freshness: sourceFreshness,
  completeness: sourceCompleteness,
  checkedAt: timestamp,
  resultCode: SafeAuthErrorCodeSchema,
  identityFingerprint: displayFingerprint,
});
const protectedNextActionSchema = z.union([
  z.strictObject({ kind: z.literal('open_login'), source: sourceId, approvedConfigId: z.uuid() }),
  z.strictObject({ kind: z.literal('confirm_binding'), candidateBindingId: z.uuid() }),
  z.strictObject({ kind: z.enum(['wait', 'none']) }),
]);

export const ProtectedAuthStatusProjectionSchema: z.ZodType<ProtectedAuthStatusProjection> = z.strictObject({
  overall: overallSchema,
  sources: z.array(protectedSourceSchema).max(2),
  binding: z.strictObject({ consistency: bindingConsistency, identityFingerprint: displayFingerprint }),
  nextAction: protectedNextActionSchema,
});

export const RedactedAuthStatusProjectionSchema: z.ZodType<RedactedAuthStatusProjection> = z.strictObject({
  overall: overallSchema,
  sources: z.array(redactedSourceSchema).max(2),
  bindingConsistency,
});

export const RedactedEvidenceReceiptSchema: z.ZodType<RedactedEvidenceReceipt> = z.strictObject({
  receiptId: z.uuid(),
  buildId: z.string().regex(/^[a-f0-9]{64}$/),
  version: z.string().regex(/^0\.\d+\.\d+(?:-beta\.[1-9]\d*)?$/),
  platform: z.enum(['macos', 'windows']),
  source: sourceId,
  scenario: z.enum(['a.login', 'a.binding', 'a.course_visibility', 'b.reopen_1', 'b.reopen_2', 'b.reopen_3', 'b.worker_restart', 'b.codex_exit', 'c.os_restart', 'd.24h_recheck', 'reauth']),
  evidence: z.enum(['S', 'I', 'N', 'L']),
  status: z.enum(['pass', 'fail', 'not_run', 'human_needed']),
  resultCode: z.string().min(1).max(128).regex(/^[A-Z0-9_]+$/),
  bindingConsistency: z.enum(['consistent', 'mismatch', 'not_observed']),
  identityFingerprint: displayFingerprint,
  gaps: z.array(gapCode).max(32),
  checkedAt: z.iso.datetime(),
  nextAction: z.enum(['none', 'resolve_gaps', 'human_action_required']),
});

export const AuthActionAcceptedSchema: z.ZodType<AuthActionAccepted> = z.strictObject({
  accepted: z.literal(true), actionReceiptId: z.uuid(), resultCode: SafeAuthErrorCodeSchema,
});

export const SafeAuthApiErrorSchema: z.ZodType<SafeAuthApiError> = z.strictObject({
  code: SafeAuthErrorCodeSchema,
  stage: z.literal('auth_api'),
  nextAction: z.enum(['pair_local_browser', 'retry_or_check_local_service', 'confirm_configuration', 'reauthenticate', 'human_action_required']),
});

export type RedactedAuthDestination = 'local_cli' | 'model' | 'log' | 'diagnostic' | 'receipt';
export interface AuthStatusPresentationInput {
  sources: Record<SourceId, {
    config: ApprovedSourceConfig | null;
    observation: SourceObservation | null;
    identity: ProtectedSourceIdentity | null;
    sharedProfile: 'candidate' | 'observed' | 'unverified';
  }>;
  binding: AccountBinding;
  gaps: readonly string[];
  nextAction: ProtectedAuthStatusProjection['nextAction'];
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function deriveDisplayFingerprint(fullKeyedFingerprint: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(fullKeyedFingerprint)) throw new Error('INVALID_KEYED_FINGERPRINT');
  const bytes = createHash('sha256').update('autoed-display-fingerprint-v1\0', 'utf8').update(fullKeyedFingerprint, 'ascii').digest();
  let accumulator = 0;
  let bits = 0;
  let output = '';
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5 && output.length < 12) {
      bits -= 5;
      output += BASE32[(accumulator >>> bits) & 31];
    }
    if (output.length === 12) return output;
    accumulator &= (1 << bits) - 1;
  }
  throw new Error('INVALID_KEYED_FINGERPRINT');
}

function consistency(binding: AccountBinding): ProtectedAuthStatusProjection['binding']['consistency'] {
  switch (binding.status) {
    case 'unbound': return 'not_observed';
    case 'candidate': return 'candidate';
    case 'confirmed': return 'confirmed';
    case 'identity_mismatch': return 'mismatch';
  }
}

function safeSourceCode(observation: SourceObservation | null): SafeAuthErrorCode {
  return observation?.resultCode ?? 'NOT_OBSERVED';
}

function overallCode(input: AuthStatusPresentationInput): SafeAuthErrorCode {
  if (input.binding.status === 'identity_mismatch') return 'IDENTITY_MISMATCH';
  const observations = Object.values(input.sources).map(value => value.observation);
  if (observations.every(value => value?.resultCode === 'AUTHENTICATED')) return 'AUTHENTICATED';
  return observations.find(value => value?.resultCode && value.resultCode !== 'NOT_OBSERVED')?.resultCode ?? 'NOT_OBSERVED';
}

function fingerprintFor(binding: AccountBinding, source: SourceId): string | null {
  const evidence = binding[source];
  return evidence ? deriveDisplayFingerprint(evidence.subjectFingerprint) : null;
}

function validatedInput(input: AuthStatusPresentationInput): AuthStatusPresentationInput {
  const binding = AccountBindingSchema.parse(input.binding);
  const gaps = z.array(gapCode).max(64).parse([...input.gaps]);
  const sources = Object.fromEntries((['moodle', 'edstem'] as const).map(source => {
    const value = input.sources[source];
    const config = value.config === null ? null : ApprovedSourceConfigSchema.parse(value.config);
    const observation = value.observation === null ? null : SourceObservationSchema.parse(value.observation);
    const identity = value.identity === null ? null : ProtectedSourceIdentitySchema.parse(value.identity);
    if (config !== null && config.source !== source || observation !== null && observation.source !== source || identity !== null && identity.source !== source) {
      throw new Error('SOURCE_PRESENTATION_MISMATCH');
    }
    return [source, { config, observation, identity, sharedProfile: value.sharedProfile }];
  })) as AuthStatusPresentationInput['sources'];
  return { sources, binding, gaps, nextAction: protectedNextActionSchema.parse(input.nextAction) };
}

function sourceDefaults(source: SourceId, observation: SourceObservation | null) {
  return {
    source,
    auth: observation?.auth ?? 'not_observed',
    capability: observation?.capability ?? 'unknown',
    health: observation?.health ?? 'not_observed',
    freshness: observation?.freshness ?? 'not_observed',
    completeness: observation?.completeness ?? 'not_observed',
    checkedAt: observation?.checkedAt ?? null,
    resultCode: safeSourceCode(observation),
  };
}

export function presentProtectedAuthStatus(
  raw: AuthStatusPresentationInput,
  context: { destination: 'local_ui'; paired: boolean },
): ProtectedAuthStatusProjection {
  if (context.destination !== 'local_ui' || context.paired !== true) throw new Error('PROTECTED_PRESENTATION_DENIED');
  const input = validatedInput(raw);
  const sources = (['moodle', 'edstem'] as const).flatMap(source => {
    const value = input.sources[source];
    if (!value.config) return [];
    const identityValue = value.identity ? { displayName: value.identity.displayName, schoolEmail: value.identity.schoolEmail } : null;
    return [{ ...sourceDefaults(source, value.observation), officialOrigin: value.config.officialOrigin, identity: identityValue, sharedProfile: value.sharedProfile }];
  });
  return ProtectedAuthStatusProjectionSchema.parse({
    overall: { code: overallCode(input), phase3Eligibility: 'blocked', gaps: [...input.gaps] },
    sources,
    binding: { consistency: consistency(input.binding), identityFingerprint: input.binding.status === 'identity_mismatch' ? null : fingerprintFor(input.binding, 'moodle') },
    nextAction: input.nextAction,
  });
}

export function presentRedactedAuthStatus(
  raw: AuthStatusPresentationInput,
  context: { destination: RedactedAuthDestination },
): RedactedAuthStatusProjection {
  void context.destination;
  const input = validatedInput(raw);
  return RedactedAuthStatusProjectionSchema.parse({
    overall: { code: overallCode(input), phase3Eligibility: 'blocked', gaps: [...input.gaps] },
    sources: (['moodle', 'edstem'] as const).map(source => ({ ...sourceDefaults(source, input.sources[source].observation), identityFingerprint: fingerprintFor(input.binding, source) })),
    bindingConsistency: consistency(input.binding),
  });
}

export function presentEvidenceReceipts(receipts: readonly EvidenceReceipt[], binding: AccountBinding): RedactedEvidenceReceipt[] {
  const current = AccountBindingSchema.parse(binding);
  return receipts.map(raw => RedactedEvidenceReceiptSchema.parse({
    receiptId: raw.receiptId,
    buildId: raw.buildId,
    version: raw.version,
    platform: raw.platform,
    source: raw.source,
    scenario: raw.scenario,
    evidence: raw.evidence,
    status: raw.status,
    resultCode: raw.resultCode,
    bindingConsistency: raw.bindingConsistency,
    identityFingerprint: fingerprintFor(current, raw.source),
    gaps: [...raw.gaps],
    checkedAt: raw.checkedAt,
    nextAction: raw.status === 'human_needed' ? 'human_action_required' : raw.gaps.length > 0 || raw.status === 'fail' ? 'resolve_gaps' : 'none',
  }));
}
