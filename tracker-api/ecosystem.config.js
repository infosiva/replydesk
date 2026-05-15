module.exports = {
  apps: [{
    name: "tracker-api",
    script: "src/index.js",
    env: {
      PORT: 3098,
      STATS_KEY: "sitestats2025",
      NODE_ENV: "production",
    },
    restart_delay: 3000,
    max_restarts: 10,
  }],
};
