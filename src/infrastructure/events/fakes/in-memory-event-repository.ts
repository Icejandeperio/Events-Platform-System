import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError } from '@shared/errors';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type {
  EventRecord,
  EventRepositoryPort,
} from '@application/events/ports/event-repository.port';

/**
 * In-memory implementation of `EventRepositoryPort` for unit tests.
 *
 * @remarks
 * Keyed by `"<tenantId>:<id>"` to mirror the RLS-based cross-tenant isolation
 * of the production Drizzle adapter. Use `seed()` to pre-load fixture events
 * before running use-case tests.
 */
export class InMemoryEventRepository implements EventRepositoryPort {
  private readonly records = new Map<string, EventRecord>();

  /**
   * Finds an event by ID, scoped to the given tenant.
   *
   * @param id - The event's UUIDv4.
   * @param tenantId - The tenant scope.
   * @returns The event record, or `NotFoundError` if absent for this tenant.
   */
  async findById(id: string, tenantId: TenantId): Promise<Result<EventRecord, NotFoundError>> {
    const record = this.records.get(`${tenantId.value}:${id}`);
    if (record === undefined) {
      return err(new NotFoundError('Event', id));
    }
    return ok(record);
  }

  /**
   * Seeds an event record into the fake store.
   *
   * @param record - The event record to insert; overwrites any existing entry.
   */
  seed(record: EventRecord): void {
    this.records.set(`${record.tenantId.value}:${record.id}`, record);
  }

  /** Clears all records. Call in `beforeEach` to reset state between tests. */
  clear(): void {
    this.records.clear();
  }
}
