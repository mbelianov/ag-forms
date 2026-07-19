// Jest setup: provide required environment variables before any modules are loaded.
// JWT_SECRET is mandatory in tokenService.ts — without this the module throws at load time.
process.env.JWT_SECRET = 'test-jwt-secret-for-jest-do-not-use-in-production-64chars-padding';
