/**
 * Layout for authentication pages (`/login`, etc.).
 *
 * @param props - Layout props; `children` is the active auth page.
 * @returns The auth page content (the root layout provides the HTML shell).
 */
export default function AuthLayout({ children }: { readonly children: React.ReactNode }) {
  return <>{children}</>;
}
