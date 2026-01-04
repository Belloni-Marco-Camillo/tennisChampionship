const express = require('express');
const router = express.Router();
const db = require('../../db'); // se questo file è in src/routes, questo path è giusto

router.get('/me', async (req, res) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.json({ loggedIn: false });
    }

    const rows = await db.query(
      'SELECT id, nome, cognome, email, championship_owner FROM player WHERE id = ?',
      [userId]
    );

    if (!rows.length) {
      // sessione punta a utente che non esiste più
      return res.json({ loggedIn: false });
    }

    const u = rows[0];
    const name = `${u.nome} ${u.cognome}`.trim();

    return res.json({
      loggedIn: true,
      user: {
        id: u.id,
        name,
        email: u.email,
        championship_owner: !!u.championship_owner
      }
    });
  } catch (err) {
    console.error('GET /api/me error:', err);
    return res.status(500).json({ loggedIn: false });
  }
});

module.exports = router;
