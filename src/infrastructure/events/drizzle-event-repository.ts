import { eq } from 'drizzle-orm';
import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { NotFoundError } from '@shared/errors';
import { Money } from '@domain/value-objects/money';
import type { TenantId } from '@domain/value-objects/tenant-id';
import type {
  EventRecord,
  EventRepositoryPort,
} from '@application/events/ports/event-repository.port';
import type { AppDb } from '@infrastructure/db/client';
import { withTenantContext } from '@infrastructure/db/tenant-context';
import { events, pricingTiers } from '@infrastructure/db/schema';

/**
 * Drizzle implementation of `EventRepositoryPort`.
 *
 * @remarks
 * All queries run inside a tenant-scoped transaction via `withTenantContext()`.
 * RLS on both `events` and `pricing_tiers` guarantees cross-tenant rows are
 * invisible even if the WHERE clause omits an explicit `tenant_id` filter
 * (defense in depth — the use-case layer is the primary boundary, RLS is the backstop).
 */
export class DrizzleEventRepository implements EventRepositoryPort {
  /**
   * @param db - Injected Drizzle client; never the global singleton (ARCHITECTURE.md §4).
   */
  constructor(private readonly db: AppDb) {}

  /**
   * Loads an event and its active pricing tiers by ID, scoped to the given tenant.
   *
   * @param id - The event's UUIDv4.
   * @param tenantId - The tenant scope; cross-tenant rows are blocked by RLS.
   * @returns The event record with pricing tiers, or `NotFoundError` if absent.
   */
  async findById(id: string, tenantId: TenantId): Promise<Result<EventRecord, NotFoundError>> {
    return withTenantContext(this.db, tenantId, async (tx) => {
      const [event] = await tx.select().from(events).where(eq(events.id, id));
      if (event === undefined) {
        return err(new NotFoundError('Event', id));
      }

      const tiers = await tx.select().from(pricingTiers).where(eq(pricingTiers.eventId, id));

      const pricingTierRecords = tiers.map((t) => {
        const amountResult = Money.create(t.amount);
        // DB amounts are written only via use cases that validated them — a
        // failure here means data corruption, so throw rather than silently drop.
        if (!amountResult.ok) {
          throw new Error(`Corrupt amount in pricing_tiers row ${t.id}: ${t.amount}`);
        }
        return {
          id: t.id,
          name: t.name,
          amount: amountResult.value,
          isActive: t.isActive,
          availableSlots: t.availableSlots ?? null,
        };
      });

      return ok({
        id: event.id,
        tenantId,
        name: event.name,
        status: event.status,
        capacityLimit: event.capacityLimit ?? null,
        pricingTiers: pricingTierRecords,
      });
    });
  }
}
