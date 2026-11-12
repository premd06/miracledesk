// tests for the csv import — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { DatabaseSync } = require('node:sqlite')
const { parseCsv, importDeals, rowError } = require('./csvImport')

// a throwaway in-memory database with the tables the import touches.
function testDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE agents (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      split_plan TEXT NOT NULL,
      yearly_goal INTEGER NOT NULL
    );
    CREATE TABLE deals (
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
      lng REAL
    );
  `)
  db.prepare(
    'INSERT INTO agents (name, split_plan, yearly_goal) VALUES (?, ?, ?)'
  ).run('Sam Patel', '70', 150000)
  return db
}

test('parseCsv reads plain rows and maps the headers', () => {
  const rows = parseCsv(
    'address,price,commission %,side,status,closing date,city\n' +
      '12 Maple Grove Cres,925000,2.5,buyer,pending,2026-02-20,Brampton\n' +
      '48 Alderwood Dr,1180000,2.5,seller,closed,2026-04-15,Mississauga\n'
  )
  assert.equal(rows.length, 2)
  assert.equal(rows[0].address, '12 Maple Grove Cres')
  assert.equal(rows[0].price, '925000')
  assert.equal(rows[0].commission_pct, '2.5')
  assert.equal(rows[0].closing_date, '2026-02-20')
  assert.equal(rows[0].city, 'Brampton')
  assert.equal(rows[1].status, 'closed')
})

test('parseCsv handles quoted commas, doubled quotes and blank lines', () => {
  const rows = parseCsv(
    'address,price,commission %,side,status\n' +
      '"12 Maple Grove Cres, Brampton",925000,2.5,buyer,pending\n' +
      '\n' +
      '"7 ""Birch"" Hollow Ct",1450000,2.5,buyer,closed\n'
  )
  assert.equal(rows.length, 2)
  assert.equal(rows[0].address, '12 Maple Grove Cres, Brampton')
  assert.equal(rows[1].address, '7 "Birch" Hollow Ct')
})

test('parseCsv accepts the other header spellings', () => {
  const rows = parseCsv(
    'Address,Price,commission_pct,Side,Status,closing_date\n' +
      '12 Maple Grove Cres,925000,2.5,buyer,pending,2026-02-20\n'
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].commission_pct, '2.5')
  assert.equal(rows[0].closing_date, '2026-02-20')
})

test('rowError flags the same problems POST /api/deals does', () => {
  assert.equal(
    rowError({ price: '925000', commission_pct: '2.5', side: 'buyer', status: 'pending' }),
    'missing address'
  )
  assert.equal(
    rowError({ address: '12 Maple Grove', price: '0', commission_pct: '2.5', side: 'buyer', status: 'pending' }),
    'price has to be a number over 0'
  )
  assert.equal(
    rowError({ address: '12 Maple Grove', price: 'abc', commission_pct: '2.5', side: 'buyer', status: 'pending' }),
    'price has to be a number over 0'
  )
  assert.equal(
    rowError({ address: '12 Maple Grove', price: '925000', commission_pct: '0', side: 'buyer', status: 'pending' }),
    'commission % has to be between 0 and 100'
  )
  assert.equal(
    rowError({ address: '12 Maple Grove', price: '925000', commission_pct: '2.5', side: '', status: 'pending' }),
    'missing side'
  )
  assert.equal(
    rowError({ address: '12 Maple Grove', price: '925000', commission_pct: '2.5', side: 'buyer', status: '' }),
    'missing status'
  )
  assert.equal(
    rowError({ address: '12 Maple Grove', price: '925000', commission_pct: '2.5', side: 'buyer', status: 'pending' }),
    null
  )
})

test('importDeals imports the good rows and reports the bad ones', () => {
  const db = testDb()
  const result = importDeals(
    db,
    'address,price,commission %,side,status,closing date,city\n' +
      '12 Maple Grove Cres,925000,2.5,buyer,pending,2026-02-20,Brampton\n' +
      ',925000,2.5,buyer,pending,2026-02-20,Brampton\n' +
      '48 Alderwood Dr,0,2.5,seller,closed,2026-04-15,\n' +
      '7 Birch Hollow Ct,1450000,2.5,buyer,Closed,2026-06-30,Caledon\n',
    1
  )
  assert.equal(result.error, undefined)
  assert.equal(result.importedIds.length, 2)
  assert.equal(result.skipped.length, 2)
  assert.deepEqual(result.skipped[0], { row: 3, reason: 'missing address' })
  assert.deepEqual(result.skipped[1], {
    row: 4,
    reason: 'price has to be a number over 0',
  })

  const deals = db.prepare('SELECT * FROM deals ORDER BY id').all()
  assert.equal(deals.length, 2)
  assert.equal(deals[0].address, '12 Maple Grove Cres')
  assert.equal(deals[0].source, 'csv import')
  // the city pin landed on the deal, so it shows on the map
  assert.equal(deals[0].lat, 43.73)
  assert.equal(deals[0].lng, -79.76)
  // the status got lowercased, so the table filter sees it
  assert.equal(deals[1].status, 'closed')
})

test('importDeals keeps a row with a city it does not know, just without a pin', () => {
  const db = testDb()
  const result = importDeals(
    db,
    'address,price,commission %,side,status\n' +
      '12 Maple Grove Cres,925000,2.5,buyer,pending\n',
    1
  )
  // no city column at all — still fine, city is optional
  assert.equal(result.importedIds.length, 1)
  const deal = db.prepare('SELECT * FROM deals').get()
  assert.equal(deal.lat, null)

  const withUnknownCity = importDeals(
    db,
    'address,price,commission %,side,status,city\n' +
      '48 Alderwood Dr,1180000,2.5,seller,pending,Georgetown\n',
    1
  )
  assert.equal(withUnknownCity.importedIds.length, 1)
  const second = db
    .prepare('SELECT * FROM deals WHERE address = ?')
    .get('48 Alderwood Dr')
  assert.equal(second.lat, null)
})

test('importDeals says so when the file is empty', () => {
  const db = testDb()
  assert.equal(importDeals(db, '', 1).error, 'the file is empty')
  assert.equal(importDeals(db, '   \n', 1).error, 'the file is empty')
})

test('a closed row with no closing date is skipped, not imported', () => {
  assert.equal(
    rowError({ address: '1 Main St', price: '900000', commission_pct: '2.5', side: 'buyer', status: 'closed' }),
    'a closing date is required when a deal is closed'
  )
  const db = testDb()
  const result = importDeals(
    db,
    'address,price,commission %,side,status\n' +
      '1 Main St,900000,2.5,buyer,closed\n' +
      '2 Oak Ave,800000,2.5,seller,closed\n',
    1
  )
  // both rows are closed with no date, so nothing imports
  assert.equal(result.importedIds.length, 0)
  assert.equal(result.skipped.length, 2)
  assert.equal(result.skipped[0].reason, 'a closing date is required when a deal is closed')
})

test('a bad side, a bad status, or a commission % over 100 is skipped', () => {
  assert.equal(
    rowError({ address: '1 Main St', price: '900000', commission_pct: '2.5', side: 'both', status: 'pending' }),
    'side has to be buyer or seller'
  )
  assert.equal(
    rowError({ address: '1 Main St', price: '900000', commission_pct: '2.5', side: 'buyer', status: 'sold' }),
    'status has to be pending, conditional or closed'
  )
  assert.equal(
    rowError({ address: '1 Main St', price: '900000', commission_pct: '150', side: 'buyer', status: 'pending' }),
    'commission % has to be between 0 and 100'
  )
  // "Closed" with a capital still counts as closed, and it needs a date
  assert.equal(
    rowError({ address: '1 Main St', price: '900000', commission_pct: '2.5', side: 'Buyer', status: 'Closed' }),
    'a closing date is required when a deal is closed'
  )
})
