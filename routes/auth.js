const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const csurf = require('@dr.pogodin/csurf');
const {
  authRateLimiter,
  authSlowDown,
  LOCKOUT_ENABLED,
  checkLockoutMiddleware,
  recordFailedLogin,
  resetFailedLogin,
} = require('../middleware/bruteforce');

const router = express.Router();
const cookieName = process.env.SESSION_NAME || 'connect.sid';

// Apply CSRF protection only to auth routes (minimizes impact on future API endpoints)
router.use(csurf({ cookie: false }));

// CSRF token endpoint for auth forms (no-cache)
router.get('/csrf-token', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.json({ csrfToken: req.csrfToken() });
  } catch (err) {
    console.error('Error generating CSRF token:', err);
    return res.status(500).json({ error: 'Unable to generate CSRF token' });
  }
});

// Registration
// Apply rate limiting and slowdown to registration to prevent abuse
router.post('/register', authRateLimiter, authSlowDown, async (req, res) => {
  const { name, email, password } = req.body;
  const emailNorm = (email || '').trim().toLowerCase();
  if (!emailNorm || !password) return res.status(400).send('Missing email or password');
  try {
    const exists = await db.query('SELECT id FROM users WHERE email = $1', [emailNorm]);
    if (exists.rows.length) {
      // Avoid user enumeration: return a generic message
      return res.status(400).send('Registration failed');
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users(name, email, password_hash) VALUES($1, $2, $3) RETURNING id, name, email',
      [name || null, emailNorm, hashed]
    );

    // Prevent session fixation: regenerate before assigning user id
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error on register:', err);
        return res.status(500).send('Server error');
      }
      req.session.userId = result.rows[0].id;
      // Ensure session is persisted before redirecting (helpful with external stores)
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error on register:', saveErr);
          return res.status(500).send('Server error');
        }
        res.redirect('/');
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Login
// Login
// Check account lockout first (if enabled), then rate-limit and slowdown per IP
router.post('/login', checkLockoutMiddleware, authRateLimiter, authSlowDown, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send('Missing email or password');
  const emailNorm = (email || '').trim().toLowerCase();
  try {
    const result = await db.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [emailNorm]);
    if (!result.rows.length) {
      // record failed attempt for this identifier
      try { recordFailedLogin(emailNorm); } catch (e) { /* no-op */ }
      return res.status(400).send('Invalid credentials');
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      try { recordFailedLogin(emailNorm); } catch (e) { /* no-op */ }
      return res.status(400).send('Invalid credentials');
    }

    // Reset failed-attempts on successful login
    try { resetFailedLogin(emailNorm); } catch (e) { /* no-op */ }

    // Prevent session fixation: regenerate session before assigning user id
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error on login:', err);
        return res.status(500).send('Server error');
      }
      req.session.userId = user.id;
      // Ensure session is persisted before redirecting
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error on login:', saveErr);
          return res.status(500).send('Server error');
        }
        res.redirect('/');
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Logout — POST to avoid CSRF via img/src or link
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    const isProd = process.env.NODE_ENV === 'production';
    if (err) {
      console.error('Session destroy error on logout:', err);
      return res.status(500).send('Error logging out');
    }
    // Clear cookie on client side as well (use same name as server config)
    res.clearCookie(cookieName, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
    });
    res.redirect('/');
  });
});

// Current user info (mounted under /api in server.js)
router.get('/api/me', async (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  try {
    const result = await db.query('SELECT id, name, email FROM users WHERE id = $1', [req.session.userId]);
    if (!result.rows.length) return res.json({ loggedIn: false });
    res.json({ loggedIn: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ loggedIn: false });
  }
});

module.exports = router;
