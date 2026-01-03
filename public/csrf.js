// Fetch CSRF token and inject into all forms on the page.
// Exposes `window.injectCsrfTokens()` so pages can call it after dynamic DOM updates.
// Cache token for the duration of the page load to avoid repeated fetches
window._csrfCachedToken = null;
window.injectCsrfTokens = async function() {
  try {
    let token = window._csrfCachedToken;
    if (!token) {
      // Try primary path, then fallback to legacy path for compatibility
      const paths = ['/auth/csrf-token', '/csrf-token'];
      let data = null;
      for (const p of paths) {
        try {
          console.debug('Fetching CSRF token from', p);
          const resp = await fetch(p, { credentials: 'same-origin' });
          if (!resp.ok) {
            console.debug('CSRF token fetch failed for', p, 'status', resp.status);
            continue;
          }
          data = await resp.json();
          break;
        } catch (inner) {
          console.debug('CSRF token fetch error for', p, inner && inner.message);
        }
      }
      token = data && data.csrfToken;
      if (token) {
        window._csrfCachedToken = token;
        console.debug('CSRF token acquired');
      } else {
        console.warn('CSRF token not acquired from any path');
      }
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
    console.error('Failed to fetch or inject CSRF token', e);
  }
};

// Auto-run once on load for existing forms
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.injectCsrfTokens());
} else {
  window.injectCsrfTokens();
}

