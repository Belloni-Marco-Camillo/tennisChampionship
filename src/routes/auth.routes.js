const express = require('express');
const router = express.Router();

// re-export existing routes file for compatibility with new layout
const existing = require('../../routes/auth');

// mount the existing router under the root path
router.use('/', existing);

module.exports = router;
