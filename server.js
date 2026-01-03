const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const pgSession = require('connect-pg-simple')(session);
const db = require('./db');
require('dotenv').config();
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

if (process.env.DATABASE_URL) {
  sessionOptions.store = new pgSession({ pool: db.pool });
} else if (isProd) {
  console.error('WARNING: No DATABASE_URL set in production — sessions will use MemoryStore which is not suitable for production.');
  // Optional strict mode: fail-fast if running in production without a persistent session store
  if (process.env.STRICT_SESSION_STORE === '1') {
    console.error('FATAL: STRICT_SESSION_STORE=1 and no DATABASE_URL set — exiting to avoid MemoryStore in production.');
    process.exit(1);
  }
}

// Warn if in production and TRUST_PROXY not enabled — this may prevent secure cookies from being set
if (isProd && !trustProxyEnabled) {
  console.error('WARNING: NODE_ENV=production but TRUST_PROXY is not enabled. If TLS is terminated by a proxy, set TRUST_PROXY=1 so secure cookies work correctly.');
}

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
