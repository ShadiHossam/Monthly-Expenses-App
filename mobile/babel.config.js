module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // worklets: false — nativewind/babel (v5 preview) already composes
      // react-native-worklets/plugin itself; letting babel-preset-expo also
      // auto-inject it registers the worklets transform twice and breaks
      // config validation ("nativewind/babel" is preset-shaped, not a plain
      // plugin, so it must live here rather than in `plugins` below).
      ["babel-preset-expo", { worklets: false }],
      "nativewind/babel",
    ],
  };
};
