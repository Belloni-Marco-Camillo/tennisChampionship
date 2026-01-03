const session = require('express-session');
const pgSessionFactory = require('connect-pg-simple')(session);
const env = require('./env');
const db = require('../../db');

function buildSessionOptions() {
  const isProd = env.isProd;
  const secret = env.sessionSecret || (isProd ? null : 'dev-secret-change-me');
  if (!secret) {
    throw new Error('Missing SESSION_SECRET: in production set SESSION_SECRET to a value at least 16 characters long.');
  }

  return {
    secret,
    name: env.sessionName,
    proxy: env.trustProxyEnabled || false,
    resave: false,
    saveUninitialized: false,
    cookie: {
      path: '/',
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
    },
  };
}

// Prepare session middleware; returns a Promise that resolves to the session middleware
function prepareSessionMiddleware() {
  const sessionOptions = buildSessionOptions();
  const storeType = env.sessionStoreEnv;

  // Validate allowed store types
  if (storeType !== 'memory' && storeType !== 'pg') {
    console.error("FATAL: Unknown SESSION_STORE value:", storeType, "— expected 'pg' or 'memory'.");
    process.exit(1);
  }

  if (storeType === 'memory') {
    // Memory store is acceptable in development only; disallow in prod unless explicitly overridden
    if (env.isProd && process.env.ALLOW_MEMORY_STORE_IN_PROD !== '1') {
      console.error('FATAL: SESSION_STORE=memory is not allowed in production. Set SESSION_STORE=pg and provide DATABASE_URL, or set ALLOW_MEMORY_STORE_IN_PROD=1 to override.');
      process.exit(1);
    }
    console.warn('Using MemoryStore for sessions. This is acceptable for development only.');
    return Promise.resolve(session(sessionOptions));
  }

  // storeType === 'pg'
  if (!db || !db.pool) {
    const msg = 'SESSION_STORE=pg but database pool is not available. Set DATABASE_URL or ensure db.pool is exported from ./db.';
    console.error('FATAL:', msg);
    if (env.isProd) process.exit(1);
    console.warn('Using MemoryStore fallback because db.pool is missing.');
    return Promise.resolve(session(sessionOptions));
  }

  // Verify DB connectivity before attaching pg store
  return db.pool.query('SELECT 1')
    .then(() => {
      sessionOptions.store = new pgSessionFactory({
        pool: db.pool,
        tableName: process.env.SESSION_PG_TABLE || 'session',
        createTableIfMissing: true,
      });
      console.log('Session store (Postgres) is reachable.');
      return session(sessionOptions);
    })
    .catch((err) => {
      console.error('FATAL: Unable to reach Postgres for session store:', err && err.message ? err.message : err);
      if (env.isProd) process.exit(1);
      console.warn('Falling back to MemoryStore for sessions (dev only).');
      return session(sessionOptions);
    });
}

module.exports = prepareSessionMiddleware;
