module.exports = {
  apps: [
    {
      name: 'monetization-dashboard',
      script: 'npx',
      args: 'tsx src/dashboard.ts',
      cwd: '/root/monetization-agent',
      env: {
        NODE_ENV: 'production',
        MON_DASHBOARD_PORT: '3102',
      },
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
