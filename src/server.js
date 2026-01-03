const http = require('http');
const env = require('./config/env');
const buildSessionMiddleware = require('./config/session');
const createApp = require('./app');

async function start() {
  const sessionMiddleware = await buildSessionMiddleware();
  const app = createApp(sessionMiddleware);

  const server = http.createServer(app);
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
