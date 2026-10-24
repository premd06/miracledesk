const express = require('express')
const app = express()
const PORT = 3001

app.use(express.json())

// just to check the server is up — the real routes come later
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`)
})
