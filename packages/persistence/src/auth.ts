import type Database from 'better-sqlite3';
import type {
  AccountBindingStore, Clock, ProfileOwnershipStore, SourceConfigStore, SourceObservationStore,
} from '../../application/src/ports.js';
import type {
  AccountBinding, ApprovedSourceConfig, ProfileOwnerIdentity, ProfileOwnership, ProfileReservation,
  SourceId, SourceObservation, WriteContext,
} from '../../domain/src/model.js';
import { StorageError } from './database.js';

const pending = (): never => { throw new StorageError('NOT_IMPLEMENTED'); };

export class SQLiteSourceConfigStore implements SourceConfigStore {
  constructor(readonly db: Database.Database, readonly clock: Clock = { now: () => Date.now() }) {}
  async read(_source: SourceId): Promise<ApprovedSourceConfig | null> { return pending(); }
  async confirm(_config: ApprovedSourceConfig, _context: WriteContext): Promise<void> { pending(); }
}

export class SQLiteSourceObservationStore implements SourceObservationStore {
  constructor(readonly db: Database.Database, readonly clock: Clock = { now: () => Date.now() }) {}
  async read(_source: SourceId): Promise<SourceObservation | null> { return pending(); }
  async write(_observation: SourceObservation, _context: WriteContext): Promise<void> { pending(); }
}

export class SQLiteAccountBindingStore implements AccountBindingStore {
  constructor(readonly db: Database.Database, readonly clock: Clock = { now: () => Date.now() }) {}
  async read(): Promise<AccountBinding> { return pending(); }
  async write(_binding: AccountBinding, _context: WriteContext): Promise<void> { pending(); }
}

export class SQLiteProfileOwnershipStore implements ProfileOwnershipStore {
  constructor(readonly db: Database.Database, readonly clock: Clock = { now: () => Date.now() }) {}
  async read(): Promise<ProfileOwnership> { return pending(); }
  async acquire(_reservation: ProfileReservation, _context: WriteContext): Promise<ProfileOwnership> { return pending(); }
  async renew(_owner: ProfileOwnerIdentity, _leaseUntil: number, _context: WriteContext): Promise<ProfileOwnership> { return pending(); }
  async markConfirmedExited(_owner: ProfileOwnerIdentity, _context: WriteContext): Promise<ProfileOwnership> { return pending(); }
  async release(_owner: ProfileOwnerIdentity, _context: WriteContext): Promise<void> { pending(); }
}
