module.exports = ({ config }) => {
  const appUrl = process.env.APP_URL || "https://ais-dev-25jh6at6vr2id6dzrli2pv-319224760917.us-east1.run.app";

  return {
    ...config,
    android: {
      ...config.android,
      package: "com.gabrieljunior.observadorconcursos",
    },
    plugins: Array.from(new Set([
      ...(config.plugins || []),
      "expo-sqlite",
      "expo-background-task",
      "expo-secure-store",
    ])),
    extra: {
      ...config.extra,
      router: {
        ...config.extra?.router,
        origin: appUrl,
      },
    },
  };
};
