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

// agent, address, price, commission %, side, sold, closing, condition deadline, status, source, referral %, lat, lng
// the condition deadline is only set on conditional deals — it's the
// date the buyer has to waive conditions by, or the deal falls apart.
// lat/lng are rough pins in the right city for the deal map — the
// addresses are made up, so these are approximate, not real locations.
const deals = [
  [1, '12 Maple Grove Cres, Brampton', 925000, 2.5, 'buyer', '2026-01-14', '2026-02-20', null, 'closed', 'sphere', 0, 43.7312, -79.762],
  [1, '48 Alderwood Dr, Mississauga', 1180000, 2.5, 'seller', '2026-03-02', '2026-04-15', null, 'closed', 'referral', 25, 43.589, -79.654],
  [1, '7 Birch Hollow Ct, Caledon', 1450000, 2.5, 'buyer', '2026-05-20', '2026-06-30', null, 'closed', 'open house', 0, 43.875, -79.842],
  [1, '220 Larkspur Ave, Brampton', 780000, 2.5, 'buyer', '2026-09-10', '2026-11-12', null, 'pending', 'online lead', 0, 43.708, -79.79],
  [2, '33 Cedar Pointe Blvd, Vaughan', 1320000, 2.5, 'seller', '2026-02-05', '2026-03-18', null, 'closed', 'sphere', 0, 43.821, -79.521],
  [2, '91 Stonebridge Rd, Brampton', 865000, 2.5, 'buyer', '2026-04-11', '2026-05-22', null, 'closed', 'referral', 20, 43.752, -79.741],
  [2, '5 Willowmere Lane, Mississauga', 1040000, 2.5, 'buyer', '2026-07-08', '2026-08-27', null, 'closed', 'sphere', 0, 43.612, -79.681],
  [2, '17 Fairview Heights, Caledon', 1580000, 2.5, 'seller', '2026-10-02', '2026-12-04', '2026-11-15', 'conditional', 'open house', 0, 43.884, -79.858],
  [3, '64 Red Pine St, Brampton', 710000, 2.5, 'buyer', '2026-01-28', '2026-03-06', null, 'closed', 'online lead', 0, 43.694, -79.771],
  [3, '28 Aspen Court, Brampton', 895000, 2.5, 'seller', '2026-06-15', '2026-07-24', null, 'closed', 'sphere', 0, 43.744, -79.719],
  [3, '102 Meadowlark Dr, Caledon', 1210000, 2.5, 'buyer', '2026-08-19', '2026-11-20', null, 'pending', 'referral', 25, 43.868, -79.835],
  [4, '9 Juniper Way, Mississauga', 985000, 2.5, 'buyer', '2026-03-17', '2026-04-29', null, 'closed', 'sphere', 0, 43.603, -79.639],
  [4, '76 Brookfield Cres, Vaughan', 1290000, 2.5, 'seller', '2026-05-27', '2026-07-10', null, 'closed', 'open house', 0, 43.845, -79.498],
  [4, '41 Spruce Hollow, Brampton', 845000, 2.5, 'buyer', '2026-09-25', '2026-10-30', null, 'closed', 'online lead', 0, 43.719, -79.783],
  [4, '3 Chestnut Ridge, Caledon', 1390000, 2.5, 'seller', '2026-10-14', '2026-12-18', '2026-11-25', 'conditional', 'sphere', 0, 43.879, -79.851],
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
   (agent_id, address, price, commission_pct, side, sold_date, closing_date, condition_deadline, status, source, referral_pct, lat, lng)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
