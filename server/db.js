// the database for miracledesk — just two tables for now.
// agents hold each realtor, deals hold their sales. the seed script
// (coming next) fills these with sample data, nothing real.
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
    status TEXT NOT NULL,
    source TEXT,
    referral_pct REAL DEFAULT 0,
    FOREIGN KEY (agent_id) REFERENCES agents (id)
  );
`)

module.exports = db
