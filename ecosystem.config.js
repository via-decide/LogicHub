// LogicHub V2 - PM2 Ecosystem Configuration
// Designed for Mac Mini Local-First Deployment

module.exports = {
  apps: [
    {
      name: "logichub-api",
      script: "./api/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "zayvora-engine",
      script: "./engine/zayvora.py",
      interpreter: "python3",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        PORT: 3001
      }
    },
    {
      name: "websocket-gateway",
      script: "./ws/gateway.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        PORT: 3002
      }
    },
    {
      name: "analysis-worker",
      script: "./workers/analyzer.js",
      instances: 2, // Scale workers based on M-series core count
      autorestart: true,
      watch: false
    }
  ]
};
