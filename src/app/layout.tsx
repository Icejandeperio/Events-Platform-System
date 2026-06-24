import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TenantKit',
  description: 'Multi-tenant event registration and payment management',
};

/**
 * Root layout — wraps every page with the base HTML shell.
 *
 * @param props - App Router layout props; `children` is the active page subtree.
 * @returns The HTML shell with the global stylesheet applied.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
