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
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/voice-agent-error.log',
      out_file: './logs/voice-agent-out.log',
      log_file: './logs/voice-agent.log',
      // Clean up PM2 logging
      pmx: false,                              // Disable PM2 monitoring/metrics
      log_type: 'raw',                         // Raw logs without PM2 prefixes
      merge_logs: true,                        // Merge logs from instances
      log_date_format: 'YYYY-MM-DD HH:mm:ss'  // Clean date format
    }
  ]
}; 