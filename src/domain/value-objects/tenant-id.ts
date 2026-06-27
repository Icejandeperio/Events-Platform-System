import { err, ok } from '@shared/result';
import type { Result } from '@shared/result';
import { ValidationError } from '@shared/errors';

// UUIDv4: 8-4-4-4-12 hex groups; third group starts with '4' (version);
// fourth group's first nibble is 8, 9, a, or b (RFC 4122 variant).
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Tenant identifier value object — a validated UUIDv4 that uniquely identifies a tenant.
 *
 * @remarks
 * Maps directly to `organization.id` in the Better Auth schema and the
 * `tenant_id` column on every tenant-scoped application table (ADR 0001, ADR 0004).
 * Constructed only via `TenantId.create()`. The stored value is always lowercase.
 * Two `TenantId` instances are equal when their values are identical.
 */
export class TenantId {
  private constructor(
    /** The normalized lowercase UUIDv4 string. */
    readonly value: string,
  ) {}

  /**
   * Validates and constructs a `TenantId` from a raw string.
   *
   * @param raw - The raw UUID string; comparison is case-insensitive and the result is normalized to lowercase.
   * @returns `ok(TenantId)` when `raw` is a valid UUIDv4, or `err(ValidationError)`.
   */
  static create(raw: string): Result<TenantId, ValidationError> {
    if (!UUID_V4_RE.test(raw)) {
      return err(
        new ValidationError(`Invalid tenant ID — expected a UUIDv4: "${raw}"`, 'tenantId'),
      );
    }
    return ok(new TenantId(raw.toLowerCase()));
  }

  /**
   * Returns `true` when both tenant IDs represent the same tenant.
   *
   * @param other - The `TenantId` to compare against.
   * @returns `true` if the UUIDs are identical (case-insensitive).
   */
  equals(other: TenantId): boolean {
    return this.value === other.value;
  }

  /**
   * Returns the lowercase UUIDv4 string.
   *
   * @returns The tenant UUID string.
   */
  toString(): string {
    return this.value;
  }
}
