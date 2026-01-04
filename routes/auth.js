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
const {
  normalizeEmail,
  isValidEmail,
  validatePassword,
  sanitizeName,
} = require('../utils/validation');

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
  const { nome, cognome, email, password } = req.body;
  const championship_owner = req.body.championship_owner ? 1 : 0;

  const emailNorm = normalizeEmail(email);
  if (!emailNorm) return res.status(400).send('Missing email');
  if (!isValidEmail(emailNorm)) return res.status(400).send('Invalid email format');

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).send(pwErr);

  const { value: nomeSan, error: nomeErr } = sanitizeName(nome);
  if (nomeErr) return res.status(400).send(nomeErr);

  const { value: cognomeSan, error: cognomeErr } = sanitizeName(cognome);
  if (cognomeErr) return res.status(400).send(cognomeErr);

  try {
    // MySQL: placeholder "?"
    const exists = await db.query('SELECT id FROM player WHERE email = ?', [emailNorm]);
    if (exists.length) {
      // Avoid user enumeration: return a generic message
      return res.status(400).send('Registration failed');
    }

    const hashed = await bcrypt.hash(password, 10);

    // MySQL: niente RETURNING
    const insertResult = await db.query(
      'INSERT INTO player (nome, cognome, email, password_hash, championship_owner) VALUES (?, ?, ?, ?, ?)',
      [nomeSan, cognomeSan, emailNorm, hashed, championship_owner]
    );

    // mysql2: INSERT ritorna un OkPacket con insertId
    const newUserId = insertResult.insertId;

    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error on register:', err);
        return res.status(500).send('Server error');
      }
      req.session.userId = newUserId;
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error on register:', saveErr);
          return res.status(500).send('Server error');
        }
        res.redirect('/');
      });
    });
  } catch (err) {
    // Se vuoi un messaggio più chiaro su email duplicata:
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(400).send('Registration failed');
    }
    console.error(err);
    res.status(500).send('Server error');
  }
});


// Login
// Login
// Check account lockout first (if enabled), then rate-limit and slowdown per IP
router.post('/login', checkLockoutMiddleware, authRateLimiter, authSlowDown, async (req, res) => {
  const { email, password } = req.body;

  const emailNorm = normalizeEmail(email);
  if (!emailNorm) return res.status(400).send('Missing email');
  if (!isValidEmail(emailNorm)) return res.status(400).send('Invalid email format');
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).send(pwErr);
  try {
    const rows = await db.query(
  'SELECT id, nome, cognome, email, password_hash FROM player WHERE email = ?',
  [emailNorm]
);

if (!rows.length) {
  try { recordFailedLogin(emailNorm); } catch (e) { /* no-op */ }
  return res.status(400).send('Invalid credentials');
}

const user = rows[0];

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

module.exports = router;
