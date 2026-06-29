import type { Result } from '@shared/result';
import type { NotFoundError } from '@shared/errors';
import type { Money } from '@domain/value-objects/money';
import type { TenantId } from '@domain/value-objects/tenant-id';

/**
 * Lifecycle states for an event.
 *
 * @remarks
 * State machine: `draft → open → closed | cancelled`.
 * The `RegisterForEvent` use case rejects registrations for events not in `open` state.
 */
export type EventStatus = 'draft' | 'open' | 'closed' | 'cancelled';

/**
 * A pricing tier available for an event.
 *
 * @remarks
 * `amount` is integer centavos — never floats (SECURITY.md §8, GLOSSARY).
 * `null` slot count means unlimited availability.
 */
export interface PricingTierRecord {
  readonly id: string;
  readonly name: string;
  readonly amount: Money;
  readonly isActive: boolean;
  readonly availableSlots: number | null;
}

/**
 * A read model of an event, used by the registration use case.
 *
 * @remarks
 * Includes active pricing tiers so the use case can resolve the payment
 * amount from a tier ID without a separate repository call.
 * `null` capacity limit means the event has unlimited slots.
 */
export interface EventRecord {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly status: EventStatus;
  readonly capacityLimit: number | null;
  readonly pricingTiers: readonly PricingTierRecord[];
}

/**
 * Read port for event data, used by the registration use case.
 *
 * @remarks
 * Write operations on events are out of scope for the registration slice
 * and will be added in the events-management feature.
 */
export interface EventRepositoryPort {
  /**
   * Loads an event by ID, scoped to the given tenant.
   *
   * @param id - The event's UUIDv4.
   * @param tenantId - The tenant scope; different tenants never see each other's events.
   * @returns The event record, or `NotFoundError` if absent for this tenant.
   */
  findById(id: string, tenantId: TenantId): Promise<Result<EventRecord, NotFoundError>>;
}
