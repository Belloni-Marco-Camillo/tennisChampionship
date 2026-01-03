const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const pgSession = require('connect-pg-simple')(session);
const db = require('./db');
require('dotenv').config();
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 },
};

if (process.env.DATABASE_URL) {
  sessionOptions.store = new pgSession({ pool: db.pool });
}

app.use(session(sessionOptions));

// Mount auth routes (register, login, logout, /api/me)
app.use('/', authRouter);

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Serve login/register pages (static views)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
