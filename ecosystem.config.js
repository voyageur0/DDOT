module.exports = {
  apps: [
    {
      name: 'ddot-node',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001
      },
      error_file: './logs/node-error.log',
      out_file: './logs/node-out.log',
      log_file: './logs/node-combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'ddot-python',
      script: 'run.py',
      interpreter: 'python3',
      instances: 1,
      exec_mode: 'fork',
      env: {
        FLASK_ENV: 'development',
        FLASK_DEBUG: 'True'
      },
      env_production: {
        FLASK_ENV: 'production',
        FLASK_DEBUG: 'False'
      },
      error_file: './logs/python-error.log',
      out_file: './logs/python-out.log',
      log_file: './logs/python-combined.log',
      time: true,
      max_memory_restart: '512M'
    }
  ]
} 