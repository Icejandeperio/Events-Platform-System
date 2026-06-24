// Enforces Conventional Commits (CONTRIBUTING.md).
// Scopes mirror the module names listed in the contributing guide.
/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        // Hexagonal layers / modules (CONTRIBUTING.md)
        'core',
        'payments',
        'registration',
        'participants',
        'tenancy',
        'auth',
        'entitlements',
        'dashboard',
        'ui',
        'db',
        'ci',
        // Toolchain / repo (Stage 0 work)
        'repo',
        'ts',
        'lint',
        'arch',
        'hooks',
        'env',
        'docker',
        'test',
        'adr',
      ],
    ],
    'scope-case': [2, 'always', 'kebab-case'],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'],
    ],
    // Scope is mandatory on every commit (CONTRIBUTING.md always shows scoped commits)
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
    'header-max-length': [2, 'always', 100],
  },
};
