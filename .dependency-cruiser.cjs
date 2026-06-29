// Enforces the hexagonal dependency rule (ARCHITECTURE.md §2).
// A violation fails `npm run lint` and therefore blocks CI.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── domain must be pure ─────────────────────────────────────────────────
    // domain/ imports NOTHING outside domain/ and shared/.
    {
      name: 'no-domain-importing-application',
      comment: 'domain core must not depend on application layer',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/application' },
    },
    {
      name: 'no-domain-importing-infrastructure',
      comment: 'domain core must not depend on infrastructure adapters',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'no-domain-importing-interfaces',
      comment: 'domain core must not depend on driving adapters (HTTP/UI)',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/interfaces' },
    },

    // ── application must not reach into outer layers ─────────────────────────
    {
      name: 'no-application-importing-infrastructure',
      comment: 'application defines ports; infrastructure implements them — not the reverse',
      severity: 'error',
      from: {
        path: '^src/application',
        // Test files are composition roots: they wire fakes into use cases.
        pathNot: '/__tests__/',
      },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'no-application-importing-interfaces',
      comment: 'application layer must not depend on the driving-adapter layer',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^src/interfaces' },
    },

    // ── interfaces must only reach inward (not into infrastructure) ──────────
    // Exception: src/app/_bootstrap/ is the composition root — it wires
    // everything and is explicitly excluded from this rule.
    {
      name: 'no-interfaces-importing-infrastructure',
      comment:
        'interfaces call use-cases, not adapters directly; wiring is done only in app/_bootstrap',
      severity: 'error',
      from: {
        path: '^src/interfaces',
        pathNot: '^src/interfaces/.*_bootstrap',
      },
      to: { path: '^src/infrastructure' },
    },

    // ── no circular dependencies ─────────────────────────────────────────────
    {
      name: 'no-circular',
      comment: 'circular imports are forbidden in all layers',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],

  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
