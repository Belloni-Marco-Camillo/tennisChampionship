require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const trustProxyEnabled = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
const sessionStoreEnv = process.env.SESSION_STORE || (isProd ? 'pg' : 'memory');
const sessionName = process.env.SESSION_NAME || 'connect.sid';
const sessionSecret = process.env.SESSION_SECRET;

// Fail-fast in production for missing/weak session secret
if (isProd) {
  if (!sessionSecret || sessionSecret.length < 16) {
    console.error('FATAL: In production, SESSION_SECRET must be set and at least 16 characters long.');
    process.exit(1);
  }
}

module.exports = {
  isProd,
  trustProxyEnabled,
  sessionStoreEnv,
  sessionName,
  sessionSecret,
};
