// importing deals from a csv — offices already have spreadsheets,
// and nobody wants to re-type their history one deal at a time.
// the broker uploads a file on the Deals page, the browser sends
// the text to the server, and this module parses it and inserts
// the good rows. bad rows don't kill the whole import — they're
// skipped and reported back with a reason, so the broker can fix
// the file and try again.
//
// the validation is the same as POST /api/deals on purpose: a row
// needs an address, a price over 0, a commission % over 0, a side
// and a status. the route checks the role rule (agents only import
// their own deals) and that the agent exists before this runs.

// the cities the add-deal form knows, with the same rough
// city-centre pins for the map. a city I don't know just means
// no pin — the row still imports fine.
const cityPins = {
  brampton: [43.73, -79.76],
  mississauga: [43.6, -79.65],
  caledon: [43.87, -79.84],
  vaughan: [43.83, -79.51],
}

// header names I accept, all lowercased and trimmed — spreadsheets
// call the same column different things, so "commission %" and
// "commission_pct" both work.
const columnNames = {
  address: ['address'],
  price: ['price'],
  commission_pct: ['commission %', 'commission_pct', 'commission'],
  side: ['side'],
  status: ['status'],
  closing_date: ['closing date', 'closing_date', 'closing'],
  city: ['city'],
}

function headerKey(name) {
  const clean = name.trim().toLowerCase()
  for (const key of Object.keys(columnNames)) {
    if (columnNames[key].includes(clean)) {
      return key
    }
  }
  return null
}

// a small csv parser — no dependency, spreadsheets are simple enough
// for this. quotes let a field hold commas ("12 Maple Grove Cres,
// Brampton"), and two quotes in a row inside a quoted field mean
// one real quote. blank lines are skipped.
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      // \r\n is one line break, not two
      if (ch === '\r' && text[i + 1] === '\n') {
        i++
      }
      row.push(field)
      field = ''
      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row)
      }
      row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.trim() !== '')) {
      rows.push(row)
    }
  }

  if (rows.length === 0) {
    return []
  }
  const headers = rows[0].map((name) => headerKey(name))
  return rows.slice(1).map((cells) => {
    const out = {}
    cells.forEach((cell, i) => {
      const key = headers[i]
      if (key) {
        out[key] = cell.trim()
      }
    })
    return out
  })
}

// the checks POST /api/deals does, per row — same messages, so a
// row that fails here would have failed there too. side and status
// get lowercased because spreadsheets write "Closed" and the table
// filter only knows "closed".
function rowError(row) {
  if (!row.address) {
    return 'missing address'
  }
  if (!row.side) {
    return 'missing side'
  }
  if (!row.status) {
    return 'missing status'
  }
  const price = Number(row.price)
  if (!row.price || !price || price <= 0) {
    return 'price has to be a number over 0'
  }
  const commissionPct = Number(row.commission_pct)
  if (!row.commission_pct || !commissionPct || commissionPct <= 0) {
    return 'commission % has to be a number over 0'
  }
  return null
}

// import every row: good ones get inserted, bad ones get skipped
// with a reason. returns { importedIds, skipped } — the route turns
// the ids into full deals with their math worked out. row numbers
// count the header as row 1, so the first data row is row 2.
function importDeals(db, csvText, agentId) {
  if (!csvText || !csvText.trim()) {
    return { error: 'the file is empty' }
  }
  const rows = parseCsv(csvText)
  const importedIds = []
  const skipped = []

  const insert = db.prepare(
    `INSERT INTO deals
     (agent_id, address, price, commission_pct, side, sold_date,
      closing_date, condition_deadline, status, source, referral_pct, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  rows.forEach((row, i) => {
    const error = rowError(row)
    if (error) {
      skipped.push({ row: i + 2, reason: error })
      return
    }
    const pin = row.city ? cityPins[row.city.trim().toLowerCase()] : null
    const result = insert.run(
      agentId,
      row.address,
      Number(row.price),
      Number(row.commission_pct),
      row.side.toLowerCase(),
      null,
      row.closing_date || null,
      null,
      row.status.toLowerCase(),
      'csv import',
      0,
      pin ? pin[0] : null,
      pin ? pin[1] : null
    )
    importedIds.push(result.lastInsertRowid)
  })

  return { importedIds, skipped }
}

module.exports = { parseCsv, importDeals, rowError }
