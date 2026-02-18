// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*", ".expo/*", "expo-env.d.ts"],
  },
  {
    rules: {
      // Warn on console.log left in code; allow warn/error for legitimate diagnostics.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Catch missing/incorrect dependency arrays in hooks.
      "react-hooks/exhaustive-deps": "warn",
      // Prevent defining components inside render which breaks memoisation.
      "react/no-unstable-nested-components": "warn",
    },
  },
]);
