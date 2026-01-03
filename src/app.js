const express = require('express');
const path = require('path');
const helmet = require('helmet');
const env = require('./config/env');

module.exports = function createApp(sessionMiddleware) {
  const app = express();

  app.use(helmet());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  if (env.trustProxyEnabled) app.set('trust proxy', 1);

  if (sessionMiddleware) app.use(sessionMiddleware);

  // mount web auth router and API router
  const authWebRouter = require('./routes/auth.web.routes');
  const apiRouter = require('./routes/api.routes');

  app.use('/auth', authWebRouter);
  app.use('/api', apiRouter);

  // Compatibility: allow legacy CSRF token path for older clients
  app.get('/csrf-token', (req, res) => res.redirect(302, '/auth/csrf-token'));

  // serve views routes (these are mounted by auth routes too, but keep here for parity)
  // public views (still served at top-level paths for browser UX)
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'index.html')));
  app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'login.html')));
  app.get('/register', (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'register.html')));

  // CSRF friendly error handler
  app.use((err, req, res, next) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
      console.warn('CSRF token validation failed:', req.method, req.path);
      return res.status(403).send('Richiesta non valida o scaduta. Ricarica la pagina e riprova.');
    }
    next(err);
  });

  return app;
};
