'use client';

/**
 * Global error boundary for the App Router.
 *
 * @remarks Must be a Client Component per Next.js requirements.
 * Logs the error server-side; never exposes stack traces to the client.
 * @param props - Error boundary props: `error` is the thrown Error (may carry a
 *   Next.js server-side `digest` ID); `reset` retries the failing subtree.
 * @returns A generic error screen with a retry action.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Please try again.</p>
          <button onClick={reset}>Try again</button>
          {/* digest is a Next.js server-side error ID — safe to show, not a stack trace */}
          {error.digest && <p>Error ID: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
