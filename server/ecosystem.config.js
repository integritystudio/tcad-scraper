module.exports = {
  apps: [
    {
      name: 'tcad-api',
      script: 'npx',
      args: 'tsx src/index.ts',
      cwd: '/home/aledlie/tcad-scraper/server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: 'localhost',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tcad_scraper',
      },
      error_file: '/home/aledlie/tcad-scraper/server/logs/pm2-error.log',
      out_file: '/home/aledlie/tcad-scraper/server/logs/pm2-out.log',
      log_file: '/home/aledlie/tcad-scraper/server/logs/pm2-combined.log',
      time: true,
      merge_logs: true,
      // Run with doppler for environment variables
      interpreter: 'bash',
      interpreter_args: '-c',
      script: 'doppler run -- npx tsx src/index.ts',
      args: '',
    },
  ],
};
