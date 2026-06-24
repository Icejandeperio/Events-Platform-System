/**
 * RBAC role constants — the four roles in the TenantKit access-control model.
 *
 * @remarks
 * `SUPER_ADMIN` is a platform-level role stored on the user record (ADR 0004).
 * The tenant-scoped roles map to Better Auth Organization member roles:
 * TENANT_ADMIN → `owner`, STAFF → `admin` | `member`, PARTICIPANT → `member`.
 * Use these constants in `assertRole()` guards rather than bare strings.
 */
export const Role = {
  SUPER_ADMIN: 'super_admin',
  TENANT_ADMIN: 'tenant_admin',
  STAFF: 'staff',
  PARTICIPANT: 'participant',
} as const;

/** Union of all valid role strings. */
export type RoleValue = (typeof Role)[keyof typeof Role];
