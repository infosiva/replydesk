module.exports = {
  apps: [
    {
      name: 'aigotitwrong',
      script: 'dist/index.js',
      cwd: '/root/agents/aigotitwrong',
      env_file: '.env',
      watch: false,
      autorestart: true,
      restart_delay: 60000, // 1 min before restart on crash
      max_restarts: 10,
      log_file: 'logs/pm2.log',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      node_args: '--max-old-space-size=512',
    },
  ],
};
