const staticConfig = require('./app.json');

module.exports = () => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

  return {
    ...staticConfig,
    expo: {
      ...staticConfig.expo,
      ...(googleMapsApiKey
        ? {
            android: {
              ...staticConfig.expo.android,
              config: {
                ...staticConfig.expo.android?.config,
                googleMaps: { apiKey: googleMapsApiKey },
              },
            },
          }
        : {}),
    },
  };
};
