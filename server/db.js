// the database for miracledesk — agents, deals, clients, and a
// checklist per deal. agents hold each realtor, deals hold their
// sales, clients hold their buyers and sellers, and checklist items
// track what still has to happen before a deal closes.
// the seed script fills these with sample data, nothing real.
const { DatabaseSync } = require('node:sqlite')
const path = require('path')

const db = new DatabaseSync(path.join(__dirname, 'miracledesk.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    split_plan TEXT NOT NULL,
    yearly_goal INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    address TEXT NOT NULL,
    price INTEGER NOT NULL,
    commission_pct REAL NOT NULL,
    side TEXT NOT NULL,
    sold_date TEXT,
    closing_date TEXT,
    condition_deadline TEXT,
    status TEXT NOT NULL,
    source TEXT,
    referral_pct REAL DEFAULT 0,
    lat REAL,
    lng REAL,
    FOREIGN KEY (agent_id) REFERENCES agents (id)
  );
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY,
    agent_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_contacted TEXT,
    FOREIGN KEY (agent_id) REFERENCES agents (id)
  );
  CREATE TABLE IF NOT EXISTS checklist_items (
    id INTEGER PRIMARY KEY,
    deal_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    UNIQUE (deal_id, label),
    FOREIGN KEY (deal_id) REFERENCES deals (id)
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    agent_id INTEGER,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents (id)
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`)

// the deals table started without a condition deadline column, so add
// it to databases that were made before this change. same story for
// the map pins — lat/lng came later too.
const dealColumns = db
  .prepare('PRAGMA table_info(deals)')
  .all()
  .map((column) => column.name)
if (!dealColumns.includes('condition_deadline')) {
  db.exec('ALTER TABLE deals ADD COLUMN condition_deadline TEXT')
}
if (!dealColumns.includes('lat')) {
  db.exec('ALTER TABLE deals ADD COLUMN lat REAL')
}
if (!dealColumns.includes('lng')) {
  db.exec('ALTER TABLE deals ADD COLUMN lng REAL')
}

// the users table started without an email column, so add it to
// databases that were made before this change — same pattern as the
// deal columns above. the unique index keeps two accounts from
// sharing one email, and it skips the nulls so old rows without an
// email don't clash with each other.
const userColumns = db
  .prepare('PRAGMA table_info(users)')
  .all()
  .map((column) => column.name)
if (!userColumns.includes('email')) {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT')
}
db.exec(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)'
)

// the users table started without an active flag, so add it to
// databases that were made before this change. active = 1 means the
// account can log in; the broker flips it to 0 to deactivate
// someone, and they can't log in (or keep using an old token) until
// it's flipped back. defaults to 1 so every existing account stays
// active.
if (!userColumns.includes('active')) {
  db.exec('ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1')
}

module.exports = db
