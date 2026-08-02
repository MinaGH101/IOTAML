const config = {
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['dist/**', 'tests/**'],
    },
  },
};
export default config;
