// Simple validation utilities (no external deps)
function normalizeEmail(email) {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  if (!email) return false;
  if (email.length > 254) return false;
  // Simple email regex: local@domain (not full RFC)
  // - local: letters, numbers, dot, underscore, hyphen
  // - domain: letters, numbers, hyphen, dot
  const re = /^[\w.%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return re.test(email);
}

function validatePassword(password) {
  if (password == null || password === '') return 'Missing password';
  const s = String(password);
  if (s.length < 8) return 'Password must be at least 8 characters long';
  if (s.length > 72) return 'Password must be at most 72 characters long';
  return null;
}

function sanitizeName(name) {
  if (name == null) return { value: null, error: null };
  const v = String(name).trim();
  if (v === '') return { value: null, error: null };
  if (v.length > 60) return { value: null, error: 'Name must be at most 60 characters long' };
  return { value: v, error: null };
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  validatePassword,
  sanitizeName,
};
