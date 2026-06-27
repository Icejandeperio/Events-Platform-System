/**
 * Base class for all domain and application errors.
 *
 * @remarks
 * Infrastructure errors must be caught at the adapter boundary and re-thrown
 * (or mapped) as a subclass of this type before they cross into the application
 * or domain layers. This keeps use-case code free of framework-specific error
 * types (ADR 0001 — hexagonal dependency rule).
 */
export class DomainError extends Error {
  /**
   * @param message - Human-readable description of the error.
   */
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Raised when a value object or inbound input fails domain validation rules.
 *
 * @remarks
 * Return this inside a `Result` rather than throwing it in use-case code.
 * The `field` property (optional) identifies which input field caused the failure,
 * which is useful for surfacing per-field errors in API responses.
 */
export class ValidationError extends DomainError {
  /** The name of the offending field, if known (e.g. `"email"`, `"amount"`). */
  readonly field?: string;

  /**
   * @param message - Human-readable description of the validation failure.
   * @param field - Optional field name that triggered the error.
   */
  constructor(message: string, field?: string) {
    super(message);
    if (field !== undefined) {
      this.field = field;
    }
  }
}

/**
 * Raised when a required entity cannot be found within the caller's tenant scope.
 *
 * @remarks
 * Always indicates a within-tenant lookup failure (i.e. the resource does not
 * exist for this tenant). Cross-tenant lookups that are blocked by RLS look
 * identical to a genuine absence — this is intentional (no information leak).
 */
export class NotFoundError extends DomainError {
  /** The type of resource that was not found (e.g. `"Participant"`). */
  readonly resourceType: string;
  /** The ID that was looked up. */
  readonly resourceId: string;

  /**
   * @param resourceType - The entity type (e.g. `"Participant"`, `"Event"`).
   * @param resourceId - The ID that was looked up.
   */
  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} not found: ${resourceId}`);
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Raised when an operation would create a duplicate of a unique resource.
 *
 * @remarks
 * Use this when a uniqueness constraint would be violated — e.g. registering
 * a participant with an email that already exists for this tenant.
 */
export class ConflictError extends DomainError {}

/**
 * Raised when the caller lacks permission for the requested operation.
 *
 * @remarks
 * Distinct from `NotFoundError`: use `UnauthorizedError` when the resource
 * exists but the caller is not permitted to access or mutate it. In public
 * APIs, it is often safer to surface this as a 404 (security through obscurity).
 */
export class UnauthorizedError extends DomainError {}
