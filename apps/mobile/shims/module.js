// Shim for the Node.js "module" built-in.
// @unlink-xyz/sdk imports this at bundle time but only uses it in a
// Node-specific EdDSA code path. Providing a stub lets Metro resolve
// the import without pulling in Node internals.
export function createRequire() {
  throw new Error(
    "createRequire is not available in React Native. " +
      "This code path requires a Node.js environment.",
  );
}
