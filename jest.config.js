module.exports = {
  preset: "jest-expo",
  testMatch: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
  testPathIgnorePatterns: ["/node_modules/", "/.expo/", "/dist/", "lib/__tests__/test-utils.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "constants/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
  coveragePathIgnorePatterns: ["/node_modules/", "/.expo/", "/dist/"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
