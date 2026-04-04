const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The @unlink-xyz/sdk bundles a Node-only code path that calls
// `await import("module")` and `createRequire(import.meta.url)`.
// These APIs don't exist in React Native / Hermes.
// We point the "module" built-in to an empty shim so the import
// resolves without crashing the bundler. The EdDSA code path that
// needs it will fail at runtime (not at bundle time), and the SDK's
// main API surface (deposit/transfer/withdraw) works without it.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  module: require.resolve("./shims/module.js"),
};

module.exports = config;
