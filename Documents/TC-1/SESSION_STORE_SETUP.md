# Session store setup

Questa sezione spiega come configurare lo store delle sessioni per l'app.

Environment variables principali
- `NODE_ENV` — `development` o `production`.
- `SESSION_SECRET` — segreto forte per le sessioni (in produzione obbligatorio).
- `SESSION_STORE` — `pg` o `memory`. Default: `pg` in produzione, `memory` in sviluppo.
- `DATABASE_URL` — stringa di connessione Postgres (usata da `./db`).
- `SESSION_PG_TABLE` — nome della tabella per le sessioni (default `session`).
- `ALLOW_MEMORY_STORE_IN_PROD` — se impostato a `1` permette `SESSION_STORE=memory` in produzione (USARE SOLO PER TEST).

Comportamento dell'app
- Se `SESSION_STORE=pg` l'app userà `connect-pg-simple` con `pool` da `./db` e proverà a creare la tabella se mancante tramite `createTableIfMissing: true`.
- In produzione, se la connessione al DB fallisce l'app esegue `process.exit(1)` (fail-fast) per evitare di girare con MemoryStore.
- Se `SESSION_STORE=memory` verrà usato MemoryStore: è accettabile solo in sviluppo.

SQL per creare la tabella delle sessioni (esecuzione manuale consigliata)
---
-- Esegui questo script sul database usato dall'applicazione
CREATE TABLE "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
) WITH (OIDS=FALSE);

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
---

Nota: `connect-pg-simple` può creare automaticamente questa tabella se `createTableIfMissing: true` è passato alle opzioni. Tuttavia in produzione è preferibile applicare migrazioni versionate.

Esempio `.env` (development)
```
NODE_ENV=development
SESSION_SECRET=dev-secret-change-me
SESSION_STORE=memory
TRUST_PROXY=0
# DATABASE_URL can be left empty for dev if you don't use Postgres
# DATABASE_URL=postgres://user:pass@localhost:5432/dbname
```

Esempio `.env` (production)
```
NODE_ENV=production
SESSION_SECRET=replace-with-a-strong-secret-of-32+ chars
SESSION_STORE=pg
DATABASE_URL=postgres://dbuser:dbpassword@db-host:5432/mydatabase
TRUST_PROXY=1
SESSION_PG_TABLE=session
```

Verifiche rapide
- Avvia l'app e fai il login: verifica che la tabella `session` abbia righe dopo una sessione creata.
- Esegui `SELECT count(*) FROM session;` per vedere le sessioni attive.
- Se `createTableIfMissing` è abilitato e la tabella non esiste, `connect-pg-simple` può crearla; preferisci però creare la tabella via migration.

Checklist di deploy (breve)
1. Assicurati che `NODE_ENV=production` e `SESSION_SECRET` sia impostato a un valore forte.
2. Imposta `SESSION_STORE=pg` e `DATABASE_URL` verso il Postgres di produzione.
3. (Opzionale ma raccomandato) Crea la tabella delle sessioni con lo script SQL sopra tramite migrazione.
4. Avvia l'app in staging e verifica `SELECT count(*) FROM session;` dopo un login.
5. Verifica che `TRUST_PROXY=1` se c'è un TLS-terminating proxy a monte (altrimenti i cookie `secure` non saranno inviati correttamente).
6. Non usare `SESSION_STORE=memory` in produzione; se per qualche motivo temporaneo necessario, impostare `ALLOW_MEMORY_STORE_IN_PROD=1` ma pianificare la migrazione a `pg` subito.
