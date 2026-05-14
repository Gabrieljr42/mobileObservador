module.exports = ({ config }) => {
  const appUrl = process.env.APP_URL || "https://ais-dev-25jh6at6vr2id6dzrli2pv-319224760917.us-east1.run.app";

  return {
    ...config,
    extra: {
      ...config.extra,
      router: {
        ...config.extra?.router,
        origin: appUrl,
      },
    },
  };
};
