# CSRF Hardening Fix

## 1) Riepilogo modifiche applicate
- Aggiunta dipendenza: `csurf` (middleware Express per synchronizer-token).
- Montato `csurf` dopo il middleware di sessione (`express-session`) in `server.js`.
- Aggiunto endpoint `GET /csrf-token` che restituisce `{ csrfToken }` per i form HTML.
- Aggiunto handler di errore per `EBADCSRFTOKEN` che risponde con 403 e messaggio user-friendly.
- Modificati `views/login.html` e `views/register.html` per recuperare il token via `fetch('/csrf-token')` e inserire un campo hidden `_csrf` prima del submit.

Notes on improvements applied:
- Replaced `csurf` with the maintained fork `@dr.pogodin/csurf` to avoid supply-chain/maintenance issues.
- Scoped CSRF middleware to auth routes only (`routes/auth.js`) to avoid breaking future JSON API endpoints.
- Added `Cache-Control: no-store` on `/csrf-token` to prevent caching of tokens by intermediate proxies.
- Moved inline JS to `public/csrf.js` and included it in the views (`<script src="/csrf.js"></script>`) to be compatible with stricter CSP later on.

## 2) Motivazioni di sicurezza (minacce mitigate)
- Previene attacchi CSRF (Cross-Site Request Forgery) su endpoint POST sensibili come `/login` e `/register`.
- Impedisce che pagine remote forzino l'esecuzione di POST autenticati a nome dell'utente.

## 3) Trade-off e limitazioni
- La soluzione usa fetch client-side per inserire il token nei form. Questo richiede JavaScript abilitato sul client. Se è necessario supportare utenti senza JS, bisogna passare a rendering server-side (template engine) per iniettare il token direttamente nell'HTML.
- CSRF token non mitiga XSS: se la pagina è vulnerabile a XSS un attacker può leggere/inviare token. Continuare a hardenare contro XSS (CSP, input sanitization, httpOnly cookies).

## 4) Istruzioni di deploy / env
- Installare la nuova dipendenza:
  ```bash
  npm install csurf
  ```
- In produzione assicurarsi che `TRUST_PROXY` e `SESSION_SECRET` siano configurati correttamente (già documentati in `SESSION_HARDENING_FIX.md`).

## 5) Checklist di test + criteri di successo
- Test manuale dev:
  - Avvia il server in dev.
  - Apri `/login` e verifica che il form contenga un input nascosto `_csrf` (devtools -> Elements).
  - Invia login valido: deve funzionare.
  - Rimuovi `_csrf` dal form manualmente e invia: server deve rispondere 403.
- Test prod-like (con `NODE_ENV=production`, `SESSION_SECRET` e `TRUST_PROXY` se applicabile): ripeti i test e verifica che `Set-Cookie` abbia flag `Secure` e che fetch `/csrf-token` funzioni.

## 6) Rollback rapido
- Ripristinare il commit precedente o rimuovere il middleware `csurf` da `server.js` e le modifiche ai form.

---

File generato automaticamente.
