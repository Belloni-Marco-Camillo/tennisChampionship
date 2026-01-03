require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const pgSession = require('connect-pg-simple')(session);
const db = require('./db');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// Trust proxy can be enabled via env when the app is behind a TLS-terminating proxy
const trustProxyEnabled = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
if (trustProxyEnabled) {
  app.set('trust proxy', 1);
}

// Production checks and session secret handling (fail-fast in prod)
const isProd = process.env.NODE_ENV === 'production';
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProd) {
    console.error('FATAL: In production, SESSION_SECRET must be set and at least 16 characters long.');
    process.exit(1);
  }
  // development fallback (only used in non-production)
  sessionSecret = 'dev-secret-change-me';
}

if (isProd && sessionSecret.length < 16) {
  console.error('FATAL: SESSION_SECRET must be at least 16 characters long in production.');
  process.exit(1);
}

const sessionOptions = {
  secret: sessionSecret,
  name: process.env.SESSION_NAME || 'connect.sid',
  proxy: trustProxyEnabled || false,
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd, // requires HTTPS in production
  },
};
// Decide which session store to use. Default: in prod use 'pg', in dev use 'memory'
const sessionStoreEnv = process.env.SESSION_STORE || (isProd ? 'pg' : 'memory');

// Handle non-pg stores / validation now; pg-specific store and DB connectivity
// will be validated before starting the server below.
if (sessionStoreEnv === 'memory') {
  if (isProd && process.env.ALLOW_MEMORY_STORE_IN_PROD !== '1') {
    console.error('FATAL: SESSION_STORE=memory is not allowed in production. Set SESSION_STORE=pg and provide DATABASE_URL, or set ALLOW_MEMORY_STORE_IN_PROD=1 to override.');
    process.exit(1);
  }
  console.warn('Using MemoryStore for sessions. This is acceptable for development only.');
} else if (sessionStoreEnv !== 'pg') {
  console.error('FATAL: Unknown SESSION_STORE value:', sessionStoreEnv, " — expected 'pg' or 'memory'.");
  process.exit(1);
}

// Hard check: if SESSION_STORE=pg but no db.pool, fail in prod
if (sessionStoreEnv === 'pg' && (!db || !db.pool)) {
  console.error('FATAL: SESSION_STORE=pg but database pool is not available. Set DATABASE_URL or ensure db.pool is exported from ./db.');
  if (isProd) process.exit(1);
  console.warn('Continuing in non-production without PG-backed session store.');
  console.warn('Using MemoryStore fallback because db.pool is missing.');
}

// Warn if in production and TRUST_PROXY not enabled — this may prevent secure cookies from being set
if (isProd && !trustProxyEnabled) {
  console.error('WARNING: NODE_ENV=production but TRUST_PROXY is not enabled. If TLS is terminated by a proxy, set TRUST_PROXY=1 so secure cookies work correctly.');
}


function start() {
  // mount session and routers (do this at startup after any DB checks)
  app.use(session(sessionOptions));
  // Mount auth routes (register, login, logout, /api/me)
  app.use('/', authRouter);

  // Serve pages
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  });

  // Serve login/register pages (static views)
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
  });

  app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
  });

  // CSRF error handler: friendly 403 when token invalid or missing
  app.use((err, req, res, next) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
      // log the incident server-side
      console.warn('CSRF token validation failed:', req.method, req.path);
      // respond with a user-friendly message (no technical details)
      return res.status(403).send('Richiesta non valida o scaduta. Ricarica la pagina e riprova.');
    }
    next(err);
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// If using Postgres store and we have a pool, validate DB connectivity before starting
if (sessionStoreEnv === 'pg' && db && db.pool) {
  db.pool.query('SELECT 1')
    .then(() => {
      sessionOptions.store = new pgSession({
        pool: db.pool,
        tableName: process.env.SESSION_PG_TABLE || 'session',
        createTableIfMissing: true,
      });
      console.log('Session store (Postgres) is reachable.');
      start();
    })
    .catch((err) => {
      console.error('FATAL: Unable to reach Postgres for session store:', err && err.message ? err.message : err);
      if (isProd) return process.exit(1);
      console.warn('Falling back to MemoryStore for sessions (dev only).');
      start();
    });
} else {
  start();
}
