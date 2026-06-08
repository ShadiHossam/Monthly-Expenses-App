const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  input: "./global.css",
  // Disable TypeScript env generation (we handle it manually)
  disableTypeScriptGeneration: true,
});
