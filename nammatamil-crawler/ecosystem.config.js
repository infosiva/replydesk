module.exports = {
  apps: [
    {
      // API server — always on
      name: 'nammatamil-api',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3096,
      },
    },
    {
      // Nightly AI crawler — runs once at 02:00 IST every day
      name: 'nammatamil-crawler',
      script: 'dist/crawler.js',
      instances: 1,
      autorestart: false,      // don't restart — it's a one-shot job
      cron_restart: '30 20 * * *', // 20:30 UTC = 02:00 IST
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
