// ESLint flat config — includes NFR3.2 banned-API rules.
// Banned inside systems/handlers: Math.random, Date.now, performance.now,
// new Date(), crypto.getRandomValues, crypto.randomUUID.
// The single seeded RNG is the only entropy source.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['packages/u1-sim-foundation/src/**/*.ts'],
    extends: [tseslint.configs.base],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'NFR3.2: use ctx.rng, never Math.random.' },
        { object: 'Date', property: 'now', message: 'NFR3.2: no Date.now in sim code; time flows through the tick.' },
        { object: 'performance', property: 'now', message: 'NFR3.2: no performance.now in sim code.' },
        { object: 'crypto', property: 'getRandomValues', message: 'NFR3.2: use ctx.rng, never crypto.getRandomValues.' },
        { object: 'crypto', property: 'randomUUID', message: 'NFR3.2: no crypto.randomUUID in sim code.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'NFR3.2: no new Date() in sim code; time flows through the tick.' },
      ],
    },
  },
  {
    files: ['packages/u1-sim-foundation/tests/**/*.ts'],
    extends: [tseslint.configs.base],
    rules: {
      // Tests may use timers and dates for fixtures; sim ban does not apply.
      'no-restricted-properties': 'off',
      'no-restricted-globals': 'off',
    },
  },
);
