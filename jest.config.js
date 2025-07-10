module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/generated/**",
    "!src/index.ts",
  ],
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: [
    "<rootDir>/src/lib/tests/prismaPublicMock.ts",
    "<rootDir>/src/lib/tests/prismaWeb2Mock.ts",
  ],
};
