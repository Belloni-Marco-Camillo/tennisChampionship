const session = require('express-session');
const env = require('./env');
const db = require('../../db');

// MySQL session store
const MySQLStoreFactory = require('express-mysql-session')(session);

function buildSessionOptions() {
  const isProd = env.isProd;
  const secret = env.sessionSecret || (isProd ? null : 'dev-secret-change-me');
  if (!secret) {
    throw new Error(
      'Missing SESSION_SECRET: in production set SESSION_SECRET to a value at least 16 characters long.'
    );
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
  const storeType = env.sessionStoreEnv; // expected: 'memory' | 'mysql'

  // Validate allowed store types
  if (storeType !== 'memory' && storeType !== 'mysql') {
    console.error(
      "FATAL: Unknown SESSION_STORE value:",
      storeType,
      "— expected 'mysql' or 'memory'."
    );
    process.exit(1);
  }

  if (storeType === 'memory') {
    if (env.isProd && process.env.ALLOW_MEMORY_STORE_IN_PROD !== '1') {
      console.error(
        'FATAL: SESSION_STORE=memory is not allowed in production. Set SESSION_STORE=mysql and provide DB credentials, or set ALLOW_MEMORY_STORE_IN_PROD=1 to override.'
      );
      process.exit(1);
    }
    console.warn('Using MemoryStore for sessions. This is acceptable for development only.');
    return Promise.resolve(session(sessionOptions));
  }

  // storeType === 'mysql'
  // Expect db.pool from mysql2/promise createPool
  if (!db || !db.pool) {
    const msg =
      'SESSION_STORE=mysql but database pool is not available. Ensure db.pool is exported from ../../db and .env has DB_* variables.';
    console.error('FATAL:', msg);
    if (env.isProd) process.exit(1);
    console.warn('Using MemoryStore fallback because db.pool is missing.');
    return Promise.resolve(session(sessionOptions));
  }

  // Verify DB connectivity before attaching MySQL store
  return db.pool.query('SELECT 1')
    .then(() => {
      sessionOptions.store = new MySQLStoreFactory(
        {
          // Table + columns customization (optional)
          table: process.env.SESSION_MYSQL_TABLE || 'sessions',
          // Automatically create sessions table if missing
          createDatabaseTable: true,
        },
        db.pool
      );

      console.log('Session store (MySQL) is reachable.');
      return session(sessionOptions);
    })
    .catch((err) => {
      console.error('FATAL: Unable to reach MySQL for session store:', err?.message || err);
      if (env.isProd) process.exit(1);
      console.warn('Falling back to MemoryStore for sessions (dev only).');
      return session(sessionOptions);
    });
}

module.exports = prepareSessionMiddleware;
