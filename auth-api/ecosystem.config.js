module.exports = {
  apps: [{
    name: 'auth-api',
    script: 'dist/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: '3110',
      JWT_SECRET: 'change-me-in-production-use-long-random-string'
    }
  }]
}
