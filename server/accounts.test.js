// tests for the broker accounts page — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { DatabaseSync } = require('node:sqlite')
const { hashPassword, loginUser, getUser } = require('./auth')
const {
  listAccounts,
  createAccount,
  resetAccountPassword,
  setAccountActive,
  changePassword,
} = require('./accounts')

// a throwaway in-memory database with the sample agents and logins,
// same shape as the real tables.
function testDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE agents (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      split_plan TEXT NOT NULL,
      yearly_goal INTEGER NOT NULL
    );
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `)
  db.prepare(
    "INSERT INTO agents (id, name, split_plan, yearly_goal) VALUES (1, 'Sam Patel', '70', 150000)"
  ).run()
  db.prepare(
    "INSERT INTO agents (id, name, split_plan, yearly_goal) VALUES (2, 'Jess Wong', '70/90@100000', 200000)"
  ).run()
  const sam = hashPassword('demo1234')
  db.prepare(
    `INSERT INTO users (agent_id, username, email, password_salt, password_hash, role)
     VALUES (1, 'sam', 'sam@miracledesk.test', ?, ?, 'agent')`
  ).run(sam.salt, sam.hash)
  const broker = hashPassword('demo1234')
  db.prepare(
    `INSERT INTO users (agent_id, username, email, password_salt, password_hash, role)
     VALUES (NULL, 'broker', 'broker@miracledesk.test', ?, ?, 'broker')`
  ).run(broker.salt, broker.hash)
  return db
}

test('the broker sees every account, with names and roles', () => {
  const db = testDb()
  const accounts = listAccounts(db)
  assert.equal(accounts.length, 2)
  const sam = accounts.find((account) => account.username === 'sam')
  assert.equal(sam.name, 'Sam Patel')
  assert.equal(sam.email, 'sam@miracledesk.test')
  assert.equal(sam.role, 'agent')
  assert.equal(sam.active, true)
  const broker = accounts.find((account) => account.username === 'broker')
  assert.equal(broker.name, 'Broker')
  assert.equal(broker.role, 'broker')
})

test('creating an agent makes an agent row and a login that works', () => {
  const db = testDb()
  const result = createAccount(db, {
    name: 'New Agent',
    username: 'newagent',
    email: 'new@miracledesk.test',
    password: 'starting-pass',
    splitPlan: '80',
    yearlyGoal: 120000,
  })
  assert.ok(result.account)
  assert.equal(result.account.name, 'New Agent')
  assert.equal(result.account.role, 'agent')
  // the agent row exists too, with the split and goal from the form
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(result.account.agentId)
  assert.equal(agent.split_plan, '80')
  assert.equal(agent.yearly_goal, 120000)
  // and the new login works straight away
  const login = loginUser(db, 'newagent', 'starting-pass')
  assert.ok(login)
  assert.equal(login.user.name, 'New Agent')
})

test('creating an account with no split or goal uses the defaults', () => {
  const db = testDb()
  const result = createAccount(db, {
    name: 'Plain Agent',
    username: 'plain',
    email: 'plain@miracledesk.test',
    password: 'starting-pass',
  })
  assert.ok(result.account)
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(result.account.agentId)
  assert.equal(agent.split_plan, '70')
  assert.equal(agent.yearly_goal, 150000)
})

test('a missing field, a bad email, or a short password is rejected', () => {
  const db = testDb()
  assert.equal(
    createAccount(db, {
      name: '',
      username: 'x',
      email: 'x@miracledesk.test',
      password: 'starting-pass',
    }).error,
    'a name, username, email and password are all required'
  )
  assert.equal(
    createAccount(db, {
      name: 'X',
      username: 'x',
      email: 'not-an-email',
      password: 'starting-pass',
    }).error,
    'that email does not look like an email address'
  )
  assert.equal(
    createAccount(db, {
      name: 'X',
      username: 'x',
      email: 'x@miracledesk.test',
      password: 'short',
    }).error,
    'password must be at least 8 characters'
  )
  // and nothing was saved
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM agents').get().n,
    2
  )
})

test('a username or email that is already taken is rejected — even with different capital letters', () => {
  const db = testDb()
  assert.equal(
    createAccount(db, {
      name: 'Copy Sam',
      username: 'SAM',
      email: 'copy@miracledesk.test',
      password: 'starting-pass',
    }).error,
    'that username or email is already taken'
  )
  assert.equal(
    createAccount(db, {
      name: 'Copy Sam',
      username: 'copysam',
      email: 'SAM@MIRACLEDESK.TEST',
      password: 'starting-pass',
    }).error,
    'that username or email is already taken'
  )
})

test('the broker resets a password — old one stops, new one works, and the account is logged out everywhere', () => {
  const db = testDb()
  const login = loginUser(db, 'sam', 'demo1234')
  assert.ok(getUser(db, login.token))
  const sam = db.prepare("SELECT * FROM users WHERE username = 'sam'").get()
  assert.deepEqual(resetAccountPassword(db, sam.id, 'fresh-password'), {
    ok: true,
  })
  assert.equal(loginUser(db, 'sam', 'demo1234'), null)
  assert.ok(loginUser(db, 'sam', 'fresh-password'))
  assert.equal(getUser(db, login.token), null)
})

test('resetting with a short password or a bad id fails and changes nothing', () => {
  const db = testDb()
  const sam = db.prepare("SELECT * FROM users WHERE username = 'sam'").get()
  assert.equal(
    resetAccountPassword(db, sam.id, 'short').error,
    'password must be at least 8 characters'
  )
  assert.ok(loginUser(db, 'sam', 'demo1234'))
  assert.equal(
    resetAccountPassword(db, 9999, 'fresh-password').error,
    'no account with that id'
  )
})

test('deactivating an account blocks logins and kills its token — reactivating brings it back', () => {
  const db = testDb()
  const login = loginUser(db, 'sam', 'demo1234')
  const sam = db.prepare("SELECT * FROM users WHERE username = 'sam'").get()
  assert.deepEqual(setAccountActive(db, sam.id, false), { ok: true })
  assert.equal(loginUser(db, 'sam', 'demo1234'), null)
  assert.equal(getUser(db, login.token), null)
  assert.deepEqual(setAccountActive(db, sam.id, true), { ok: true })
  assert.ok(loginUser(db, 'sam', 'demo1234'))
})

test('changing your own password works, and a wrong current password fails', () => {
  const db = testDb()
  const sam = db.prepare("SELECT * FROM users WHERE username = 'sam'").get()
  assert.equal(
    changePassword(db, sam.id, 'not-my-password', 'my-new-password').error,
    'your current password is not right'
  )
  assert.ok(loginUser(db, 'sam', 'demo1234'))
  assert.deepEqual(
    changePassword(db, sam.id, 'demo1234', 'my-new-password'),
    { ok: true }
  )
  assert.equal(loginUser(db, 'sam', 'demo1234'), null)
  assert.ok(loginUser(db, 'sam', 'my-new-password'))
})

test('changing to a short password is rejected and the old one still works', () => {
  const db = testDb()
  const sam = db.prepare("SELECT * FROM users WHERE username = 'sam'").get()
  assert.equal(
    changePassword(db, sam.id, 'demo1234', 'short').error,
    'password must be at least 8 characters'
  )
  assert.ok(loginUser(db, 'sam', 'demo1234'))
})
