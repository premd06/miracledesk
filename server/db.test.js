// tests for the database setup — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const { applyPragmas } = require('./db')

// a throwaway database file, cleaned up after each test — the real
// database never gets touched by these tests.
function tempDb() {
  const file = path.join(
    os.tmpdir(),
    `miracledesk-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
  )
  return { file, database: new DatabaseSync(file) }
}

function cleanup(file, database) {
  database.close()
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(file + suffix)
    } catch {
      // already gone, nothing to clean
    }
  }
}

test('the pragmas land: wal mode, 5 second busy timeout, foreign keys on', () => {
  const { file, database } = tempDb()
  try {
    applyPragmas(database)
    assert.equal(
      database.prepare('PRAGMA journal_mode').get().journal_mode,
      'wal'
    )
    assert.equal(
      database.prepare('PRAGMA busy_timeout').get().timeout,
      5000
    )
    assert.equal(
      database.prepare('PRAGMA foreign_keys').get().foreign_keys,
      1
    )
  } finally {
    cleanup(file, database)
  }
})

test('a deal cannot point at an agent that does not exist', () => {
  const { file, database } = tempDb()
  try {
    applyPragmas(database)
    database.exec(`
      CREATE TABLE agents (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE deals (
        id INTEGER PRIMARY KEY,
        agent_id INTEGER NOT NULL,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      );
    `)
    // no agent 999 — with foreign keys on, this has to fail.
    assert.throws(() =>
      database.prepare('INSERT INTO deals (agent_id) VALUES (999)').run()
    )
    database.prepare("INSERT INTO agents (id, name) VALUES (1, 'Sam')").run()
    database.prepare('INSERT INTO deals (agent_id) VALUES (1)').run()
    assert.equal(
      database.prepare('SELECT COUNT(*) AS n FROM deals').get().n,
      1
    )
  } finally {
    cleanup(file, database)
  }
})
