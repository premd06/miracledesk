// first-run setup for a real office. run once, from the server folder:
//   node setup.js <username> <email> <password>
//
// it makes the first broker account — the one the broker logs in
// with and then adds agents from the Accounts page. it only works
// on an empty database: if any account already exists it refuses,
// so it can never be used to sneak a second broker in over the top
// of a real office. the seed script is NOT the setup path — seed
// wipes everything, and it must never run against a real office's
// database. this script only ever adds one row.
const { hashPassword, MIN_PASSWORD_LENGTH } = require('./auth')

// returns { account } on success, or { error } when the inputs are
// bad or the database already has accounts in it.
function setupBroker(db, fields) {
  const username = (fields.username || '').trim()
  const email = (fields.email || '').trim()
  const password = fields.password || ''

  if (!username || !email || !password) {
    return { error: 'a username, email and password are all required' }
  }
  if (!email.includes('@')) {
    return { error: 'that email does not look like an email address' }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: 'password must be at least 8 characters' }
  }

  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get().n
  if (existing > 0) {
    return {
      error:
        'this database already has accounts — setup only runs once, on an empty database',
    }
  }

  const { salt, hash } = hashPassword(password)
  const user = db
    .prepare(
      `INSERT INTO users
       (agent_id, username, email, password_salt, password_hash, role, active)
       VALUES (NULL, ?, ?, ?, ?, 'broker', 1)`
    )
    .run(username, email, salt, hash)

  return {
    account: {
      id: user.lastInsertRowid,
      username,
      email,
      role: 'broker',
    },
  }
}

// run as a script: node setup.js <username> <email> <password>
if (require.main === module) {
  const db = require('./db')
  const [username, email, password] = process.argv.slice(2)
  const result = setupBroker(db, { username, email, password })
  if (result.error) {
    console.log('setup failed: ' + result.error)
    process.exit(1)
  }
  console.log(
    `broker account "${result.account.username}" created — log in with it, then add your agents from the Accounts page.`
  )
}

module.exports = { setupBroker }
