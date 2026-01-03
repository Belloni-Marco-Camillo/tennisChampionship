# Session hardening - Fix summary

## Modifiche applicate
- `server.js`
  - Aggiunta di fail-fast: se `NODE_ENV=production` e `SESSION_SECRET` non è impostato o è troppo corto (<16), il processo termina con errore.
  - Introduzione di `trust proxy` abilitabile via `TRUST_PROXY=1` (necessario quando TLS è terminato dal reverse proxy).
  - Hardened cookie flags: `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in produzione.
  - Esposto `SESSION_NAME` opzionale (env) con default `connect.sid`.
  - Aggiunto warning se `NODE_ENV=production` ma `TRUST_PROXY` non è abilitato (può impedire il set del cookie `secure`).
  - Aggiunta opzione `STRICT_SESSION_STORE=1` per forzare fail-fast se in produzione manca `DATABASE_URL`.

- `routes/auth.js`
  - Aggiunta di `req.session.regenerate()` su login e registrazione per prevenire session fixation.
  - Miglior gestione del logout: `req.session.destroy()` con gestione errori e `res.clearCookie(...)` con gli stessi flag di sicurezza.

## Perché queste modifiche
- Fail-fast per `SESSION_SECRET` evita che la app parta in produzione con una secret insicura.
- `trust proxy` evita problemi con cookie `secure` quando TLS è terminato upstream.
- Cookie flags (`httpOnly`, `sameSite`, `secure`) mitigano XSS/CSRF e la fuga del cookie.
- Rigenerazione sessione elimina rischio di session fixation.

## Trade-offs e note
- In sviluppo locale (NODE_ENV!=production) la cookie `secure` rimane disabilitata per permettere test via HTTP.
- Abilitare `TRUST_PROXY=1` richiede che il deployment abbia un proxy affidabile davanti al node process.

## Comandi di deploy / env consigliati
- In produzione impostare almeno le seguenti variabili:
  - `NODE_ENV=production`
  - `SESSION_SECRET` (>=16 chars)
  - `DATABASE_URL` (se si vuole usare store persistente per sessioni)
  - `TRUST_PROXY=1` se l'app è dietro proxy che termina TLS (es. Nginx, Cloudflare, Render)
  - `STRICT_SESSION_STORE=1` (opzionale) — se impostato e `DATABASE_URL` non è presente, l'app farà exit(1) per evitare MemoryStore in produzione.

## Rollback rapido
- Se qualcosa va storto, riportare temporaneamente `NODE_ENV=development` e rimuovere/aggiornare variabili modificate, oppure ripristinare commit precedente.

---

File generato automaticamente.
