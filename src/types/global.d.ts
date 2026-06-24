/**
 * Global ambient declarations for TypeScript.
 *
 * @remarks
 * CSS files are handled by Next.js's compiler at build time; tsc --noEmit
 * does not run the compiler so we declare CSS as an importable side-effect
 * module here. Do not add application types here — they belong in the
 * relevant layer (domain, shared, etc.).
 */

// Allow CSS side-effect imports (import './globals.css') in the App Router.
// Next.js handles the actual processing; TypeScript only needs to know the
// module exists, not what it exports.
declare module '*.css' {}
