export default {
  core: { disableTelemetry: true },
  framework: { name: '@storybook/react-vite', options: {} },
  stories: ['../stories/components/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  // Same two notes as the app's vite.config.ts: google-libphonenumber (PhoneInput story) uses direct
  // eval in its prebuilt file, and a static Storybook ships larger chunks than the app does.
  viteFinal(config) {
    config.build ??= {};
    config.build.chunkSizeWarningLimit = 1500;
    const rolldownOptions = (config.build.rolldownOptions ??= {});
    const previous = rolldownOptions.onwarn;
    rolldownOptions.onwarn = (warning, defaultHandler) => {
      if (warning.code === 'EVAL' && warning.id?.includes('google-libphonenumber')) return;
      if (previous) previous(warning, defaultHandler);
      else defaultHandler(warning);
    };
    return config;
  },
};
