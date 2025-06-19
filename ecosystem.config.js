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
      log_file: './logs/voice-agent.log'
    },
    {
      name: 'finance-http',
      script: 'src/http-server.ts',
      cwd: './mcp-servers/finance-mcp',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      error_file: './logs/finance-http-error.log',
      out_file: './logs/finance-http-out.log',
      log_file: './logs/finance-http.log'
    }
  ]
}; 