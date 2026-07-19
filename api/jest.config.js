module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Replace @azure/functions with a silent stub so top-level app.http() calls
  // in function files don't flood the console with "test mode" warnings.
  moduleNameMapper: {
    '^@azure/functions$': '<rootDir>/src/__mocks__/@azure/functions.js'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Provide required environment variables before any modules are loaded.
  // JWT_SECRET is mandatory in tokenService.ts — without this the module throws at load time.
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Integration tests share a single Azurite instance; running suites in parallel causes
  // cleanupTestData() calls in one suite to race against live data in another.
  // maxWorkers: 1 is equivalent to --runInBand at the suite level.
  maxWorkers: 1
};

// Made with Bob
