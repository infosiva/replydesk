module.exports = {
  apps: [
    {
      name: 'business-agent',
      script: 'node',
      args: '--import tsx/esm src/index.ts',
      cwd: '/root/business-agent',
      env: {
        NODE_ENV: 'production',
        PORT: '3103',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
