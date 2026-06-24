import { z } from 'zod';

/**
 * Branded UUID string validated by Zod v4.
 *
 * @remarks
 * Use this schema wherever a public ID is accepted at a system boundary
 * (API route params, form inputs, webhooks). Never expose or accept raw
 * integer IDs — all public identifiers must be UUIDv4 (golden rule 4).
 */
export const UuidSchema = z.string().uuid();

/** Branded type for a validated UUID string. */
export type Uuid = z.infer<typeof UuidSchema>;

/**
 * Integer-cent money guard — rejects decimals and negative values.
 *
 * @remarks
 * All monetary amounts in TenantKit are stored and transmitted as
 * integer centavos (PHP) to avoid floating-point rounding errors.
 * This schema is the Zod-layer enforcement of that invariant.
 * Use it on every inbound amount from a client or external service.
 *
 * @example
 * ```ts
 * MoneySchema.parse(1000);  // ok — ₱10.00
 * MoneySchema.parse(10.5);  // throws — decimals not allowed
 * MoneySchema.parse(-1);    // throws — negative not allowed
 * ```
 */
export const MoneySchema = z
  .number()
  .int('monetary amounts must be integer centavos (no decimals)')
  .nonnegative('monetary amounts must be ≥ 0');

/** Branded type for a validated centavo integer. */
export type Money = z.infer<typeof MoneySchema>;
