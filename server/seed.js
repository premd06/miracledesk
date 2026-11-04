// fills the database with sample data so I can actually see the app
// work. none of this is real — fake agents, fake deals, fake addresses.
// run it any time with: node seed.js (from the server folder)
// it wipes the tables first so running it twice doesn't double up.
const db = require('./db')

const agents = [
  // name, split plan, yearly goal
  ['Sam Patel', '70', 150000],
  ['Jess Wong', '70/90@100000', 200000],
  ['Dan Okafor', '80', 120000],
  ['Priya Nair', '60/80@75000', 180000],
]

// agent, address, price, commission %, side, sold, closing, status, source, referral %
const deals = [
  [1, '12 Maple Grove Cres, Brampton', 925000, 2.5, 'buyer', '2026-01-14', '2026-02-20', 'closed', 'sphere', 0],
  [1, '48 Alderwood Dr, Mississauga', 1180000, 2.5, 'seller', '2026-03-02', '2026-04-15', 'closed', 'referral', 25],
  [1, '7 Birch Hollow Ct, Caledon', 1450000, 2.5, 'buyer', '2026-05-20', '2026-06-30', 'closed', 'open house', 0],
  [1, '220 Larkspur Ave, Brampton', 780000, 2.5, 'buyer', '2026-09-10', '2026-11-12', 'pending', 'online lead', 0],
  [2, '33 Cedar Pointe Blvd, Vaughan', 1320000, 2.5, 'seller', '2026-02-05', '2026-03-18', 'closed', 'sphere', 0],
  [2, '91 Stonebridge Rd, Brampton', 865000, 2.5, 'buyer', '2026-04-11', '2026-05-22', 'closed', 'referral', 20],
  [2, '5 Willowmere Lane, Mississauga', 1040000, 2.5, 'buyer', '2026-07-08', '2026-08-27', 'closed', 'sphere', 0],
  [2, '17 Fairview Heights, Caledon', 1580000, 2.5, 'seller', '2026-10-02', '2026-12-04', 'conditional', 'open house', 0],
  [3, '64 Red Pine St, Brampton', 710000, 2.5, 'buyer', '2026-01-28', '2026-03-06', 'closed', 'online lead', 0],
  [3, '28 Aspen Court, Brampton', 895000, 2.5, 'seller', '2026-06-15', '2026-07-24', 'closed', 'sphere', 0],
  [3, '102 Meadowlark Dr, Caledon', 1210000, 2.5, 'buyer', '2026-08-19', '2026-11-20', 'pending', 'referral', 25],
  [4, '9 Juniper Way, Mississauga', 985000, 2.5, 'buyer', '2026-03-17', '2026-04-29', 'closed', 'sphere', 0],
  [4, '76 Brookfield Cres, Vaughan', 1290000, 2.5, 'seller', '2026-05-27', '2026-07-10', 'closed', 'open house', 0],
  [4, '41 Spruce Hollow, Brampton', 845000, 2.5, 'buyer', '2026-09-25', '2026-10-30', 'closed', 'online lead', 0],
  [4, '3 Chestnut Ridge, Caledon', 1390000, 2.5, 'seller', '2026-10-14', '2026-12-18', 'conditional', 'sphere', 0],
]

// agent, name, type, status, last contacted. dates are spread out on
// purpose — some clients I talked to last week, some I haven't talked
// to in weeks, so the follow-up nudges have something to catch.
const clients = [
  [1, 'Maya Chen', 'buyer', 'active', '2026-10-12'],
  [1, 'Tom Rivera', 'seller', 'active', '2026-11-02'],
  [2, 'Ana Lopez', 'buyer', 'active', '2026-10-15'],
  [2, 'Ben Carter', 'seller', 'past', '2026-09-20'],
  [3, 'Sara Kim', 'buyer', 'active', '2026-11-01'],
  [3, 'Omar Haddad', 'seller', 'active', '2026-10-05'],
  [4, 'Lily Zhang', 'buyer', 'active', '2026-10-30'],
  [4, 'Chris Doyle', 'seller', 'past', '2026-10-18'],
]

// checklist rows point at deals, and clients point at agents, so wipe
// the children first or sqlite complains about the foreign keys.
db.exec('DELETE FROM checklist_items')
db.exec('DELETE FROM deals')
db.exec('DELETE FROM clients')
db.exec('DELETE FROM agents')

const insertAgent = db.prepare(
  'INSERT INTO agents (name, split_plan, yearly_goal) VALUES (?, ?, ?)'
)
for (const agent of agents) {
  insertAgent.run(...agent)
}

const insertDeal = db.prepare(
  `INSERT INTO deals
   (agent_id, address, price, commission_pct, side, sold_date, closing_date, status, source, referral_pct)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
)
for (const deal of deals) {
  insertDeal.run(...deal)
}

const insertClient = db.prepare(
  `INSERT INTO clients
   (agent_id, name, type, status, last_contacted)
   VALUES (?, ?, ?, ?, ?)`
)
for (const client of clients) {
  insertClient.run(...client)
}

const agentCount = db.prepare('SELECT COUNT(*) AS n FROM agents').get().n
const dealCount = db.prepare('SELECT COUNT(*) AS n FROM deals').get().n
const clientCount = db.prepare('SELECT COUNT(*) AS n FROM clients').get().n
console.log(
  `seeded ${agentCount} agents, ${dealCount} deals and ${clientCount} clients`
)
