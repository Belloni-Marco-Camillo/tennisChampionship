// Fetch CSRF token and inject into all forms on the page.
// Exposes `window.injectCsrfTokens()` so pages can call it after dynamic DOM updates.
// Cache token for the duration of the page load to avoid repeated fetches
window._csrfCachedToken = null;
window.injectCsrfTokens = async function() {
  try {
    let token = window._csrfCachedToken;
    if (!token) {
      const resp = await fetch('/csrf-token', { credentials: 'same-origin' });
      if (!resp.ok) return;
      const data = await resp.json();
      token = data && data.csrfToken;
      if (token) window._csrfCachedToken = token;
    }
    if (!token) return;
    const forms = document.querySelectorAll('form');
    forms.forEach((form) => {
      // Avoid duplicating the hidden input
      if (form.querySelector('input[name="_csrf"]')) return;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = '_csrf';
      input.value = token;
      form.appendChild(input);
    });
  } catch (e) {
    console.error('Failed to fetch CSRF token', e);
  }
};

// Auto-run once on load for existing forms
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.injectCsrfTokens());
} else {
  window.injectCsrfTokens();
}

