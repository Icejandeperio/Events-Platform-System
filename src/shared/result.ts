/**
 * Discriminated union used at every use-case boundary.
 * Infrastructure errors never cross into `interfaces/` as raw exceptions.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Constructs a successful Result.
 *
 * @param value - The success payload.
 * @returns A Result in the success state.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Constructs a failed Result.
 *
 * @param error - The error payload.
 * @returns A Result in the failure state.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
