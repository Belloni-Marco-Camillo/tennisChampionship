# Tennis Championship - Minimal Web App

Questo repository contiene una web app minimale con pagine di registrazione, login e una home per ospiti.

Prerequisiti:
- Node.js (consigliato 18+)
- Un database PostgreSQL che crei manualmente (viene spiegato sotto)

Installazione

1. Copia `.env.example` in `.env` e imposta `DATABASE_URL` e `SESSION_SECRET`.

```bash
cp .env.example .env
# edit .env and set DATABASE_URL and SESSION_SECRET
```

2. Installa dipendenze e avvia

```bash
npm install
npm start
```

Connessione al database

Questa app usa la variabile d'ambiente `DATABASE_URL` per collegarsi a PostgreSQL. Esempio di formato:

```
postgres://dbuser:dbpassword@localhost:5432/mydatabase
```

Creare la tabella degli utenti

Esegui questa query (ad esempio con `psql`) per creare la tabella `users`:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

Session store

- In `development` la sessione è memorizzata in memoria (non persistente).
- Se imposti `DATABASE_URL`, la app userà automaticamente la tabella delle sessioni di `connect-pg-simple`.
  Per usare un store di sessione persistente assicurati di avere la tabella per `connect-pg-simple` (la libreria la può creare automaticamente).

API e pagine

- `GET /` - home (ospite o utente loggato)
- `GET /login` - pagina di login
- `GET /register` - pagina di registrazione
- `POST /register` - registra un nuovo utente
- `POST /login` - effettua il login
- `POST /logout` - logout (use POST to avoid forced-logout via CSRF)
- `GET /api/me` - ritorna stato login + info utente

Note di sicurezza e prossimi passi

- Per produzione: impostare `NODE_ENV=production`, fornire `SESSION_SECRET` forte e usare HTTPS.
- Considera di usare `connect-pg-simple` (già installato) o un altro store per sessioni.
- Valida meglio i campi lato server e client e aggiungi throttling/ratelimiting.
 - Valida meglio i campi lato server e client e aggiungi throttling/ratelimiting.

Rate limiting e lockout

Questa app ora include middleware opzionali per proteggere gli endpoint di autenticazione.
Abilita tramite variabili d'ambiente nel tuo `.env`:

```
# Rate limiting (per IP)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=10

# Slowdown (adds delay after X requests)
SLOW_DOWN_WINDOW_MS=60000
SLOW_DOWN_DELAY_AFTER=5
SLOW_DOWN_DELAY_MS=500

# Account lockout (per email identifier) - optional
LOCKOUT_ENABLED=1
LOCKOUT_MAX_ATTEMPTS=5
LOCKOUT_WINDOW_MS=900000
LOCKOUT_DURATION_MS=900000
```

Dopo aver aggiornato `package.json` con le nuove dipendenze esegui `npm install`.
# tennisChampionship
