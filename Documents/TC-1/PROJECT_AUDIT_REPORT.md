### 📌 PROJECT AUDIT REPORT

<!-- ✅ RISOLTO: Configurazione sessione + session fixation mitigata.
- In `src/config/env.js`: in produzione fail-fast se `SESSION_SECRET` mancante o < 16.
- In `src/config/session.js`: cookie sessione con `httpOnly`, `sameSite`, `secure` (in prod) e `saveUninitialized: false`.
- In `routes/auth.js`: `req.session.regenerate()` su login e register.
-->
1) Titolo del problema: Configurazione delle sessioni non sicura per produzione
Area coinvolta: Backend / Sicurezza
Descrizione chiara del problema: `server.js` usa un valore di `SESSION_SECRET` di fallback e configura il cookie della sessione senza `secure`, `httpOnly` e `sameSite` espliciti; la rigenerazione della sessione dopo il login non viene eseguita.
Perché è un problema: Espone la sessione a possibili furti o fixation in ambienti di produzione e rende più facile l'escalation di attacchi basati su sessione.
Beneficio del miglioramento: Migliora significativamente la sicurezza delle sessioni e riduce il rischio di account takeover.
Impatto del refactor: Basso — modifica concentrata in `server.js`/config sessione e comportamento login.
Priorità: 🟥 Alta

<!-- ✅ RISOLTO: CSRF aggiunto alle rotte auth.
- In `routes/auth.js`: `csurf({ cookie: false })` applicato al router auth.
- Endpoint token: `GET /auth/csrf-token` (più compat: `GET /csrf-token` redirect in `src/app.js`).
- Frontend: `public/csrf.js` inietta automaticamente `_csrf` in tutti i form; caricato in `views/index.html`, `views/login.html`, `views/register.html`.
-->
2) Titolo del problema: Mancanza di protezione CSRF per endpoint POST
Area coinvolta: Backend / Sicurezza / UX
Descrizione chiara del problema: Le route che accettano POST (`/register`, `/login`) non hanno protezione CSRF (nessun token o meccanismo anti-CSRF).
Perché è un problema: Applicazioni form-based senza CSRF protection possono essere sfruttate da pagine malevole per inviare richieste a nome dell'utente.
Beneficio del miglioramento: Previene attacchi CSRF che potrebbero forzare azioni non volute dagli utenti autenticati.
Impatto del refactor: Medio — aggiunta di middleware CSRF e aggiornamento dei form/views per includere token.
Priorità: 🟥 Alta

<!-- ✅ RISOLTO: rate limiting + slowdown + lockout opzionale.
- In `middleware/bruteforce.js`: `express-rate-limit`, `express-slow-down`, lockout in-memory (abilitabile via env).
- In `routes/auth.js`: applicati su `POST /auth/register` e `POST /auth/login`.
-->
3) Titolo del problema: Assenza di rate limiting e protezione da brute-force
Area coinvolta: Backend / Sicurezza
Descrizione chiara del problema: Non esiste alcun throttling su endpoint di autenticazione né lockout per tentativi ripetuti.
Perché è un problema: Espone l'app a brute-force e credential stuffing, aumentando il rischio di accessi non autorizzati.
Beneficio del miglioramento: Riduce drasticamente la probabilità di compromissione degli account.
Impatto del refactor: Medio — integrazione di middleware (express-rate-limit) e logica per lockout o aumento delay.
Priorità: 🟥 Alta

<!-- ✅ RISOLTO (parziale) ⚠️
- In `utils/validation.js`: `normalizeEmail`, `isValidEmail`, `validatePassword`, `sanitizeName`.
- In `routes/auth.js`: usate su register/login.
⚠️ Mancano ancora: validazione più completa lato client, uniformare messaggi/UX (es. render errori nelle views), e limiti più chiari (password policy) documentati.
-->
4) Titolo del problema: Mancata validazione e sanitizzazione input lato server
Area coinvolta: Backend / Logica applicativa
Descrizione chiara del problema: La validazione si limita a check di presenza; non si usano pattern di validazione (email formati, lunghezza password, caratteri) né librerie come `express-validator` o `Joi`.
Perché è un problema: Dati non validati generano cattiva UX, possibili edge-case non gestiti e maggiore superficie di errore.
Beneficio del miglioramento: Migliore qualità dei dati, messaggi di errore coerenti e riduzione di bug.
Impatto del refactor: Basso/Medio — aggiunta di validazione sui controller auth e possibili utility condivise.
Priorità: 🟨 Media

<!-- ✅ RISOLTO (parziale) ⚠️
- In `src/config/session.js`: scelta esplicita store via `SESSION_STORE` (`pg` o `memory`), con controlli e fallback; con `pg` `createTableIfMissing: true`.
⚠️ Mancano ancora: indicazioni operative nel README su `SESSION_STORE=pg`, nome tabella (`SESSION_PG_TABLE`), e chiarire che in produzione `DATABASE_URL` è richiesto se `SESSION_STORE=pg`.
-->
5) Titolo del problema: Session store non esplicitamente configurato e dipendenza dal valore `DATABASE_URL`
Area coinvolta: Backend / Architettura
Descrizione chiara del problema: Lo store di sessione (`connect-pg-simple`) viene attivato solo se `DATABASE_URL` è presente; non ci sono istruzioni per creare la tabella delle sessioni né fallback dettagliati.
Perché è un problema: In produzione la mancata persistenza delle sessioni porta a logout improvvisi e a problemi di scalabilità; la creazione della tabella può risultare non chiara per un deploy.
Beneficio del miglioramento: Sessioni persistenti e condivisibili fra istanze, comportamento prevedibile in produzione.
Impatto del refactor: Basso — configurazione esplicita e documentazione/creazione tabella.
Priorità: 🟨 Media

6) Titolo del problema: Layout del progetto e separazione responsabilità minimalista
Area coinvolta: Architettura / Manutenibilità
Descrizione chiara del problema: Il progetto è piccolo e funzionale, ma la struttura è piatta (file root con `server.js`, `db.js`, `routes/`, `views/`). Mancano cartelle `controllers/`, `services/` o `config/` che facilitino la crescita.
Perché è un problema: Man mano che l'app cresce, la mancanza di convenzioni causa confusione e refactor più grandi.
Beneficio del miglioramento: Migliore manutenibilità e facilità di onboarding, separazione chiara tra HTTP-layer e logica di dominio.
Impatto del refactor: Medio — riorganizzazione incrementale: estrarre controller e service dove serve.
Priorità: 🟨 Media

7) Titolo del problema: Mescolanza di API e view routes
Area coinvolta: Backend / Architettura / Frontend
Descrizione chiara del problema: Le rotte API (`/api/me`) e le rotte web/views non sono chiaramente separate (auth router monta percorsi misti sulla root).
Perché è un problema: Complica versioning API, test e potenziali client SPA; rende difficile applicare middleware differenti (es. JSON only, CORS, rate limit differente).
Beneficio del miglioramento: Chiarezza, facilità di evoluzione verso SPA o mobile client, isolamento dei contract API.
Impatto del refactor: Basso — rimontare router sotto `/api` e `/auth` è rapido.
Priorità: 🟩 Bassa

<!-- ✅ RISOLTO (parziale) ⚠️
- `helmet()` è presente e nelle risposte si vede CSP impostata.
⚠️ Mancano ancora: configurazione CSP esplicita nel codice (non solo default), `compression`, e caching ottimizzato per asset statici.
-->
8) Titolo del problema: Protezioni di sicurezza HTTP incomplete (CSP, cookie flags, compression)
Area coinvolta: Backend / Sicurezza / Performance
Descrizione chiara del problema: `helmet()` è presente ma non è configurata con una Content Security Policy adeguata; mancano `compression` e header per caching static assets ottimizzati.
Perché è un problema: CSP migliora la protezione XSS; compressione e cache-control migliorano velocità e TTFB.
Beneficio del miglioramento: Migliori security headers e percezione di performance per utenti mobili.
Impatto del refactor: Basso — aggiustamenti di middleware e headers.
Priorità: 🟨 Media

<!-- ✅ RISOLTO: `req.session.regenerate()` su login (e register) in `routes/auth.js`. -->
9) Titolo del problema: Mancanza di rigenerazione sessione dopo login (session fixation)
Area coinvolta: Backend / Sicurezza
Descrizione chiara del problema: Dopo l'autenticazione il codice non chiama `req.session.regenerate()`; la sessione esistente viene riutilizzata.
Perché è un problema: Session fixation attack permette a un attacker di fissare un id di sessione e forzare l'utente ad usarlo.
Beneficio del miglioramento: Protezione semplice ed efficace contro un vettore di attacco noto.
Impatto del refactor: Basso — aggiungere una chiamata a `regenerate` al login.
Priorità: 🟥 Alta

10) Titolo del problema: Logging minimale con `console.error`
Area coinvolta: Backend / Manutenibilità / Operazioni
Descrizione chiara del problema: Il progetto usa console per logging senza livelli strutturati né rotazione/integrazione con servizi di monitoring.
Perché è un problema: Difficile monitorare errori in produzione, analizzare performance o correlare eventi tra istanze.
Beneficio del miglioramento: Migliore diagnosi in produzione e integrazione con strumenti APM/monitoring.
Impatto del refactor: Basso/Medio — introdurre logger (pino/winston) e sostituire console.
Priorità: 🟨 Media

11) Titolo del problema: UX e feedback agli utenti su errori di login/registrazione
Area coinvolta: Frontend / UX
Descrizione chiara del problema: Le pagine sono statiche e non forniscono feedback strutturati all'utente sui motivi di errore (ad esempio, messaggi restituiti in testo semplice o redirect senza avvisi).
Perché è un problema: Porta a frustrazione degli utenti e confusione; impedisce diagnosi rapida di problemi di input.
Beneficio del miglioramento: Migliora conversione registrazioni/login e UX mobile-first.
Impatto del refactor: Basso — aggiungere messaggi di errore server->view o passare a fetch con UI dinamica.
Priorità: 🟨 Media

12) Titolo del problema: Mancanza di test automated (unit / integration)
Area coinvolta: Manutenibilità / Qualità
Descrizione chiara del problema: Non sono presenti test per il backend o flussi critici.
Perché è un problema: Rischio di regressioni e refactor più costosi man mano che il prodotto evolve.
Beneficio del miglioramento: Maggiore affidabilità, possibilità di refactor sicuri e CI.
Impatto del refactor: Alto — aggiungere test richiede lavoro iniziale ma paga dividendi.
Priorità: 🟨 Media

<!-- ✅ RISOLTO: lo script `dev` non usa più `nodemon` (vedi `package.json`). -->
13) Titolo del problema: Dipendenze e script dev non dichiarati
Area coinvolta: Tooling / Developer Experience
Descrizione chiara del problema: Lo script `dev` usa `nodemon` ma `nodemon` non è elencato in `devDependencies`.
Perché è un problema: Nuovi contributor potrebbero non avere gli strumenti necessari eseguibili.
Beneficio del miglioramento: Onboarding più rapido e riproducibilità dello sviluppo locale.
Impatto del refactor: Basso — aggiornare `package.json` con devDependencies.
Priorità: 🟩 Bassa

14) Titolo del problema: Nessuna policy per la gestione dei segreti e `.env`
Area coinvolta: Sicurezza / Operazioni
Descrizione chiara del problema: `.env.example` è presente ma non ci sono regole documentate per gestione dei segreti né suggerimenti su secret rotation / vault.
Perché è un problema: Segreti in chiaro o gestione manuale porta a errori operativi e possibili leak.
Beneficio del miglioramento: Più sicurezza operativa e compliance con best practice.
Impatto del refactor: Basso — aggiungere note a README e suggerire strumenti (Vault, AWS Secrets Manager).
Priorità: 🟨 Media

15) Titolo del problema: Database SSL e opzioni di connessione hard-coded
Area coinvolta: Database / Architettura
Descrizione chiara del problema: `db.js` imposta `ssl` a `rejectUnauthorized: false` in produzione senza opzioni configurabili; `connectionString` può essere null.
Perché è un problema: Configurazioni SSL generiche possono essere non sicure o non compatibili con provider; `null` può causare comportamenti imprevedibili.
Beneficio del miglioramento: Connessioni DB più robuste e sicure, errori espliciti in assenza di configurazione.
Impatto del refactor: Basso — rendere SSL e connection behavior configurabili e fail-fast.
Priorità: 🟨 Media


---

Conclusione sintetica:
La codebase è una base solida e minimale: le scelte tecnologiche sono appropriate (Express, pg, bcrypt, helmet). Le priorità immediate sono sicurezza delle sessioni (rigenerazione, cookie flags), protezione CSRF e rate limiting per l'autenticazione. Gli interventi consigliati sono perlopiù incrementali e mirati: configurazione middleware, validazione, logging strutturato e separazione di router/API. Operazioni più invasive (test coverage, riorganizzazione in `controllers/services`) sono raccomandate ma possono essere pianificate come fasi successive.

*** Fine del report
