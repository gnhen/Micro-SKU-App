module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Strip console.log in production builds (keeps warn/error)
      [
        'babel-plugin-transform-remove-console',
        {
          include: ['log'],
          exclude: ['warn', 'error'],
        },
      ],
    ],
  };
};
