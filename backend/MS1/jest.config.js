module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest', // Handle TypeScript files
    },
    testMatch: ['**/src/tests/**/*.test.ts'], // Match your test files
  };
  