module.exports = {
  apps: [
    {
      name: 'voice-agent',
      script: 'src/index.ts',
      cwd: './voice-agent',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DEBUG: '' // Disable express debug logging
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/voice-agent-error.log',
      out_file: './logs/voice-agent-out.log',
      log_file: './logs/voice-agent.log',
      // Disable PM2 monitoring noise
      pmx: false,
      monitoring: false,
      log_type: 'raw',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Reduce PM2 internal logging
      disable_logs: false,
      source_map_support: false,
      instance_var: 'INSTANCE_ID'
    }
  ]
}; 