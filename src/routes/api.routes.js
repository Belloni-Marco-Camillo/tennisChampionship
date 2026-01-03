const express = require('express');
const router = express.Router();
const db = require('../../db');

// API: /api/me => JSON only
router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) return res.json({ loggedIn: false });

    const result = await db.query('SELECT id, name, email FROM users WHERE id = $1', [req.session.userId]);
    if (!result.rows.length) return res.json({ loggedIn: false });

    return res.json({ loggedIn: true, user: result.rows[0] });
  } catch (err) {
    console.error('API /api/me error:', err);
    // Always respond JSON for the API
    return res.status(500).json({ loggedIn: false });
  }
});

module.exports = router;
