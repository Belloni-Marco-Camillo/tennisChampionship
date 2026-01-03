const express = require('express');
const router = express.Router();

// Re-use the existing legacy auth router implementation (register/login/logout, csrf token)
// Mount it under the web auth path so endpoints become /auth/register, /auth/login, /auth/logout
const legacyAuth = require('../../routes/auth');

router.use('/', legacyAuth);

module.exports = router;
