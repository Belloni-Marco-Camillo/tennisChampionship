# Collegare un database MySQL (phpMyAdmin) al progetto Tennis Championship

Questa guida mostra come collegare un database MySQL locale (gestito via phpMyAdmin) al progetto Node.js `tennisChampionship`. Nota: il progetto originale usa PostgreSQL; per passare a MySQL ci sono piccoli cambiamenti nel codice (driver SQL e session store). Qui trovi i passaggi passo‑a‑passo, comandi e frammenti di codice da applicare.

Prerequisiti
- phpMyAdmin + MySQL / MariaDB in esecuzione in locale (tipicamente su `http://localhost/phpmyadmin`).
- Node.js (consigliato 18+) e `npm` installati.
- Terminale zsh (macOS): i comandi sono testati per questa shell.

Panoramica dei passaggi
1. Creare database e utente in phpMyAdmin 
2. Installare driver e session store per MySQL nel progetto
3. Aggiornare le variabili d'ambiente
4. Sostituire il client DB (`db.js`) con `mysql2` (snippet)
5. Aggiornare il session store (`src/config/session.js`) per usare `express-mysql-session` (snippet)
6. Creare le tabelle richieste (users e sessioni)
7. Adeguare le query (placeholder `?` invece di `$1`) — nota importante
8. Avviare e testare

1) Creare database e utente (phpMyAdmin)
- Apri `http://localhost/phpmyadmin`.
- Crea un nuovo database, es: `tennis_championship`.
- Vai su `Users` → `Add user` e crea un utente (es: `tc_user`) con password sicura; assegna tutti i privilegi sul database `tennis_championship`.

Oppure via MySQL CLI:
```sql
CREATE DATABASE tennis_championship CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER 'tc_user'@'localhost' IDENTIFIED BY 'your_password_here';
GRANT ALL PRIVILEGES ON tennis_championship.* TO 'tc_user'@'localhost';
FLUSH PRIVILEGES;
```

2) Installare pacchetti npm necessari
Nella root del progetto esegui:
```bash
# driver MySQL
npm install mysql2

# session store per express (opzionale: preferibile a connect-pg-simple)
npm install express-mysql-session
```

3) Aggiornare le variabili d'ambiente
Apri `.env` (copia `.env.example` se non esiste) e aggiungi le variabili per MySQL. Puoi usare la singola `DATABASE_URL` in formato MySQL oppure variabili separate.
Esempio `DATABASE_URL`:
```env
DATABASE_URL=mysql://tc_user:your_password_here@localhost:3306/tennis_championship
SESSION_SECRET=replace_with_a_long_random_string
NODE_ENV=development
SESSION_STORE=mysql
```
Oppure usare variabili separate:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=tc_user
DB_PASSWORD=your_password_here
DB_NAME=tennis_championship
SESSION_SECRET=replace_with_a_long_random_string
SESSION_STORE=mysql
```

4) Aggiornare `db.js` (sostituire client Postgres con mysql2)
Sostituisci il contenuto di `db.js` con questo snippet minimo che usa `mysql2/promise` e mantiene un'API simile (`query(text, params)`).

> Nota: dovrai adattare tutte le query nel codice che usano placeholder `$1, $2` a `?` per MySQL.

Esempio `db.js` per MySQL:
```javascript
// db.js (MySQL)
const mysql = require('mysql2/promise');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || null;

let pool;
if (connectionString) {
  // mysql://user:pass@host:port/db
  pool = mysql.createPool(connectionString);
} else {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tennis_championship',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

module.exports = {
  query: async (sql, params) => {
    const [rows] = await pool.execute(sql, params);
    return { rows };
  },
  pool,
};
```

5) Aggiornare il session store (`src/config/session.js`)
Il progetto originale usa `connect-pg-simple`. Per MySQL installa e usa `express-mysql-session`. Sostituisci la parte che crea `sessionOptions.store` con il seguente snippet (mostro la porzione da integrare):

```javascript
// all'inizio del file
const MySQLStore = require('express-mysql-session')(session);

// dove si configura sessionOptions, dopo aver preparato sessionOptions:
if (storeType === 'mysql' || process.env.SESSION_STORE === 'mysql') {
  const mysqlOptions = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'tc_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tennis_championship',
    createDatabaseTable: true,
    schema: {
      tableName: process.env.SESSION_MYSQL_TABLE || 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  };
  sessionOptions.store = new MySQLStore(mysqlOptions);
  return session(sessionOptions);
}
```

6) Creare le tabelle richieste
- Tabella `users` (MySQL): puoi creare via phpMyAdmin eseguendo questa query SQL:
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name TEXT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
- Tabella sessioni: `express-mysql-session` può creare la tabella automaticamente se `createDatabaseTable: true` (vedi snippet sopra). In alternativa puoi creare manualmente la tabella con lo schema della libreria (controlla la doc del pacchetto per lo schema aggiornato).

7) Adeguare le query nel codice
Postgres usa placeholder `$1, $2`. MySQL (con `mysql2`) usa `?` e un array di parametri.
Esempio di conversione:
- Postgres: `db.query('SELECT id FROM users WHERE email = $1', [email])`
- MySQL: `db.query('SELECT id FROM users WHERE email = ?', [email])` (il wrapper `db.query` sopra restituisce `{ rows }`)

Cerca nel progetto tutte le occorrenze di `$1`, `$2` e convertili, oppure invece puoi usare una query builder (es. `knex`) o ORM (`sequelize`) per minimizzare riscritture.

8) Avviare e testare
- Installa i pacchetti (passo 2) e ricostruisci l'app se necessario.
- Assicurati `.env` contiene le variabili per MySQL.
- Avvia il server:
```bash
npm start
```
- Testa il flusso:
  - Apri `http://localhost:3000`.
  - Registra un utente (POST `/auth/register`) e verifica che la riga venga inserita in `users` via phpMyAdmin.
  - Login e verifica sessione; prova logout.

Note, suggerimenti e troubleshooting
- Se preferisci non riscrivere tutte le query, considera usare `knex` o `sequelize` come livello di astrazione per supportare entrambi i DB con minime modifiche.
- Errori comuni:
  - `ER_ACCESS_DENIED_ERROR`: verifica utente/password/host in phpMyAdmin.
  - `ECONNREFUSED`: MySQL non in ascolto sulla porta; controlla servizio MySQL/MariaDB.
  - Query che usano `$1` non funzioneranno: convertile a `?`.
- Session store: se non vuoi cambiare lo store ora, puoi usare `SESSION_STORE=memory` in sviluppo (non raccomandato per produzione), ma per deploy usare `mysql` o un store esterno (Redis) per scalabilità.

Esempi rapidi di comandi (copiabili)
```bash
# install
npm install mysql2 express-mysql-session

# create DB via CLI (opzionale)
mysql -u root -p -e "CREATE DATABASE tennis_championship CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci; CREATE USER 'tc_user'@'localhost' IDENTIFIED BY 'your_password_here'; GRANT ALL PRIVILEGES ON tennis_championship.* TO 'tc_user'@'localhost'; FLUSH PRIVILEGES;"

# start server
npm start
```

Conclusione
Cambiare backend da Postgres a MySQL è totalmente fattibile, ma richiede:
- cambiare il driver (`pg` → `mysql2`),
- adattare il `db.js` e le query,
- sostituire lo store delle sessioni (`connect-pg-simple` → `express-mysql-session`),
- creare le tabelle su MySQL (users + sessions).

Se vuoi, posso generare automaticamente i file aggiornati (`db.js`, istruzioni per `src/config/session.js`) e un diff che mostra le modifiche da applicare al repository: dimmi se preferisci che le applichi direttamente o se vuoi prima rivedere i frammenti.
