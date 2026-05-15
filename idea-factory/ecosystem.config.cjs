module.exports = {
  apps: [
    {
      name: 'idea-factory-dashboard',
      script: 'node',
      args: '--import tsx/esm src/dashboard.ts',
      cwd: '/root/idea-factory',
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
