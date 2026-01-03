async function fetchMe() {
  const res = await fetch('/api/me', { credentials: 'same-origin' });
  const data = await res.json();
  const el = document.getElementById('content');
  if (data.loggedIn) {
    el.innerHTML = `<p>Benvenuto, ${data.user.name || data.user.email}!</p>` +
             `<form id="logoutForm" method="post" action="/auth/logout" style="display:inline"><button type="submit">Logout</button></form>`;
    // ensure CSRF token gets injected into dynamically created form
    if (window.injectCsrfTokens) window.injectCsrfTokens();
  } else {
    el.innerHTML = `<p>Sei ospite. Effettua il <a href="/login">login</a> o <a href="/register">registrati</a>.</p>`;
  }
}
fetchMe();