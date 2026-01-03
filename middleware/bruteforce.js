const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Configurable via env
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10) || 10; // max requests per window per IP

const SLOW_DOWN_WINDOW_MS = parseInt(process.env.SLOW_DOWN_WINDOW_MS, 10) || 60 * 1000; // 1 minute
const SLOW_DOWN_DELAY_AFTER = parseInt(process.env.SLOW_DOWN_DELAY_AFTER, 10) || 5; // requests
const SLOW_DOWN_DELAY_MS = parseInt(process.env.SLOW_DOWN_DELAY_MS, 10) || 500; // base delay per extra hit

const LOCKOUT_ENABLED = process.env.LOCKOUT_ENABLED === '1' || process.env.LOCKOUT_ENABLED === 'true';
const LOCKOUT_MAX_ATTEMPTS = parseInt(process.env.LOCKOUT_MAX_ATTEMPTS, 10) || 5;
const LOCKOUT_WINDOW_MS = parseInt(process.env.LOCKOUT_WINDOW_MS, 10) || 15 * 60 * 1000; // track attempts for 15min
const LOCKOUT_DURATION_MS = parseInt(process.env.LOCKOUT_DURATION_MS, 10) || 15 * 60 * 1000; // lock for 15min

const authRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).send('Troppi tentativi. Riprova più tardi.');
  },
});

// Use a function for delayMs so the delay grows linearly with hits over the threshold
const authSlowDown = slowDown({
  windowMs: SLOW_DOWN_WINDOW_MS,
  delayAfter: SLOW_DOWN_DELAY_AFTER,
  delayMs: (hits) => Math.max(0, hits - SLOW_DOWN_DELAY_AFTER) * SLOW_DOWN_DELAY_MS,
});

// Simple in-memory tracking for failed attempts per identifier (email). Suitable for single-instance or as MVP.
const attempts = new Map();

function isLocked(identifier) {
  if (!identifier) return false;
  const id = String(identifier).trim().toLowerCase();
  const e = attempts.get(id);
  if (!e) return false;
  return !!(e.lockedUntil && Date.now() < e.lockedUntil);
}

function recordFailedLogin(identifier) {
  if (!identifier) return;
  const id = String(identifier).trim().toLowerCase();
  const now = Date.now();
  let e = attempts.get(id);
  if (!e) e = { count: 0, firstAt: now, lockedUntil: null, timeoutId: null };

  // reset if firstAt outside window
  if (now - e.firstAt > LOCKOUT_WINDOW_MS) {
    e.count = 0;
    e.firstAt = now;
    e.lockedUntil = null;
  }

  e.count += 1;
  if (!e.lockedUntil && e.count >= LOCKOUT_MAX_ATTEMPTS) {
    e.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  if (e.timeoutId) clearTimeout(e.timeoutId);
  e.timeoutId = setTimeout(() => attempts.delete(id), LOCKOUT_WINDOW_MS + LOCKOUT_DURATION_MS + 1000);

  attempts.set(id, e);
}

function resetFailedLogin(identifier) {
  if (!identifier) return;
  const id = String(identifier).trim().toLowerCase();
  attempts.delete(id);
}

function checkLockoutMiddleware(req, res, next) {
  if (!LOCKOUT_ENABLED) return next();
  const identifier = (req.body && req.body.email) ? req.body.email : null;
  if (!identifier) return next();

  if (isLocked(identifier)) {
    const id = String(identifier).trim().toLowerCase();
    const e = attempts.get(id);
    const secs = e && e.lockedUntil ? Math.ceil((e.lockedUntil - Date.now()) / 1000) : 60;
    res.set('Retry-After', String(Math.max(1, secs)));
    return res.status(429).send('Troppi tentativi su questo account. Riprova più tardi.');
  }
  return next();
}

module.exports = {
  authRateLimiter,
  authSlowDown,
  LOCKOUT_ENABLED,
  checkLockoutMiddleware,
  recordFailedLogin,
  resetFailedLogin,
};
