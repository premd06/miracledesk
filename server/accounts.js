// accounts for miracledesk — what the broker sees on the Accounts
// page. an agent account is two rows: one in agents (the name, the
// split plan, the goal — that's the person on the leaderboard) and
// one in users (the login: username, email, password, role). the
// broker creates them here, resets passwords, and turns accounts
// off and on. nothing here touches deals or clients — it's just the
// logins, so a mistake here can't wipe anyone's work.
const {
  hashPassword,
  checkPassword,
  logoutAll,
  MIN_PASSWORD_LENGTH,
} = require('./auth')
const { validateSplitPlan } = require('./commission')

// the split and goal a new agent starts with when the broker doesn't
// say otherwise. they're just the middle of the road — the broker
// can pick different ones in the form, and change the goal later
// from the Accounts page (setAgentGoal below).
const DEFAULT_SPLIT_PLAN = '70'
const DEFAULT_YEARLY_GOAL = 150000

// one row per account, newest first, with the agent's name next to
// it so the broker can tell people apart. the broker sees every
// account, including their own — there's no hiding here.
function listAccounts(db) {
  return db
    .prepare(
      `SELECT users.id, users.username, users.email, users.role,
              users.active, users.agent_id,
              agents.name AS agent_name, agents.yearly_goal
       FROM users LEFT JOIN agents ON users.agent_id = agents.id
       ORDER BY agents.name IS NULL, agents.name, users.username`
    )
    .all()
    .map((row) => ({
      id: row.id,
      name: row.agent_name || 'Broker',
      username: row.username,
      email: row.email,
      role: row.role,
      agentId: row.agent_id,
      yearlyGoal: row.yearly_goal === null ? null : row.yearly_goal,
      active: row.active !== 0,
    }))
}

// look a user up by username or email, case-insensitive — so the
// broker can't make "Sam" when "sam" already exists and end up with
// two accounts that both answer to the same login.
function findAccount(db, username, email) {
  return (
    db
      .prepare(
        `SELECT * FROM users
         WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE`
      )
      .get(username, email) || null
  )
}

// make a new agent account. returns { account } on success, or
// { error } when something's missing, taken, or the password is too
// short. the password is hashed the same way logins are — never
// stored as plain text, same as everywhere else in this app.
function createAccount(db, fields) {
  const name = (fields.name || '').trim()
  const username = (fields.username || '').trim()
  const email = (fields.email || '').trim()
  const password = fields.password || ''
  const splitPlan = (fields.splitPlan || DEFAULT_SPLIT_PLAN).trim() || DEFAULT_SPLIT_PLAN
  const yearlyGoal = Number(fields.yearlyGoal) || DEFAULT_YEARLY_GOAL

  if (!name || !username || !email || !password) {
    return { error: 'a name, username, email and password are all required' }
  }
  if (!email.includes('@')) {
    return { error: 'that email does not look like an email address' }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: 'password must be at least 8 characters' }
  }
  if (yearlyGoal <= 0) {
    return { error: 'the yearly goal has to be more than 0' }
  }
  // a bad split plan used to save fine and then break every office
  // total with NaN — check the shape here, before it gets stored.
  const planError = validateSplitPlan(splitPlan)
  if (planError) {
    return { error: planError }
  }
  if (findAccount(db, username, email)) {
    return { error: 'that username or email is already taken' }
  }

  const agent = db
    .prepare(
      'INSERT INTO agents (name, split_plan, yearly_goal) VALUES (?, ?, ?)'
    )
    .run(name, splitPlan, yearlyGoal)
  const { salt, hash } = hashPassword(password)
  const user = db
    .prepare(
      `INSERT INTO users
       (agent_id, username, email, password_salt, password_hash, role, active)
       VALUES (?, ?, ?, ?, ?, 'agent', 1)`
    )
    .run(agent.lastInsertRowid, username, email, salt, hash)

  return {
    account: {
      id: user.lastInsertRowid,
      name,
      username,
      email,
      role: 'agent',
      agentId: agent.lastInsertRowid,
      active: true,
    },
  }
}

// the broker sets a new password for someone. the old one stops
// working right away, and every login that person has open anywhere
// stops too — if the reset happened because the password leaked,
// the leak stops here.
function resetAccountPassword(db, userId, newPassword) {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: 'password must be at least 8 characters' }
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) {
    return { error: 'no account with that id' }
  }
  const { salt, hash } = hashPassword(newPassword)
  db.prepare(
    'UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?'
  ).run(salt, hash, userId)
  logoutAll(db, userId)
  return { ok: true }
}

// turn an account off (active = 0) or back on. turning it off logs
// them out everywhere on the spot, and they can't log back in until
// the broker turns it back on — that's the whole point of it.
function setAccountActive(db, userId, active) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) {
    return { error: 'no account with that id' }
  }
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(
    active ? 1 : 0,
    userId
  )
  if (!active) {
    logoutAll(db, userId)
  }
  return { ok: true }
}

// set one agent's yearly goal. the office goal on the dashboard is
// just the sum of everyone's goal, so changing one person's goal
// moves the office goal too — and the leaderboard shows each agent
// against their own goal straight away. the goal has to be a real
// number over 0; an agent always has a goal, there's no "unset".
function setAgentGoal(db, agentId, yearlyGoal) {
  const goal = Number(yearlyGoal)
  if (!yearlyGoal || !goal || goal <= 0) {
    return { error: 'the yearly goal has to be a number over 0' }
  }
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(agentId)
  if (!agent) {
    return { error: 'no agent with that id' }
  }
  db.prepare('UPDATE agents SET yearly_goal = ? WHERE id = ?').run(
    goal,
    agentId
  )
  return {
    ok: true,
    agent: { id: agent.id, name: agent.name, yearly_goal: goal },
  }
}

// change your own password: the current one has to be right first,
// and the new one has to be at least 8 characters. your current
// login keeps working — this is you changing your own password,
// not someone locking you out.
function changePassword(db, userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: 'password must be at least 8 characters' }
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  if (!user) {
    return { error: 'no account with that id' }
  }
  if (!checkPassword(currentPassword, user.password_salt, user.password_hash)) {
    return { error: 'your current password is not right' }
  }
  const { salt, hash } = hashPassword(newPassword)
  db.prepare(
    'UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?'
  ).run(salt, hash, userId)
  return { ok: true }
}

module.exports = {
  DEFAULT_SPLIT_PLAN,
  DEFAULT_YEARLY_GOAL,
  listAccounts,
  findAccount,
  createAccount,
  resetAccountPassword,
  setAccountActive,
  setAgentGoal,
  changePassword,
}
