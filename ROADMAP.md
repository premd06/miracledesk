# stuff I'm building, in order

one thing per session, small commits. this is a demo with sample data — no real deals, ever.

the idea got bigger than "commission dashboard" on purpose (oct 24): it's the agent's whole desk at the brokerage — money, clients, follow-ups, calendar, the lot. commissions are the core, everything else hangs off the same deal data.

## how I want it to look

professional, like something an office would actually use. clean tables, numbers big and easy to read. agents check this on their phones between showings, so mobile matters. theme picked (oct 24): **cream + gold luxury** — warm cream background, black text, gold accents, serif headings for the big numbers. same family as my davehomes.ca site, so the site and the app look like one brand. dark mode toggle included.

## scaffold (done)
- [x] project set up: client/ (react) + server/ (express) in one repo
- [x] /api/health route so I know the server runs
- [ ] dashboard shell: header, nav, the cards row — built to the mockup I approved

## database
- [ ] sqlite tables: agents (name, split plan, yearly goal) and deals (agent, address, price, commission %, side, sold + closing dates, status, where the deal came from)
- [ ] seed script with sample data — a few fake agents, ~15 fake deals spread over the year so the charts have something to show

## the money math (own piece, with tests)
- [ ] commission.js — one function that does the whole calculation: gross, referral fee off the top if there is one, the split (flat or tiered), HST, agent's net
- [ ] unit tests for it. money math is the one part I refuse to get wrong

## api
- [ ] GET /api/deals — all deals, or one agent's with ?agentId=
- [ ] GET /api/summary — the numbers for the cards (made this year, closing soon, deal count, goal progress)
- [ ] GET /api/leaderboard — every agent's totals for the broker view
- [ ] POST /api/deals — add a deal

## frontend
- [ ] deals table loaded from the api (status shown as little coloured labels)
- [ ] summary cards wired to /api/summary, goal progress bar included
- [ ] add-a-deal form that posts to the api and shows up in the table
- [ ] monthly earnings chart (recharts — same as my seo dashboard)

## broker view
- [ ] office page: every agent's totals + office total
- [ ] leaderboard (most net earned this year on top)
- [ ] what's closing this month
- [ ] export a pay-period summary as csv — the feature that would make an office actually use this

## look & feel pass
- [ ] apply the theme I picked (from the mockups) across the whole app with css variables
- [ ] dark mode toggle, saved so it sticks between visits

## the extras (picked oct 24)
- [ ] tax + HST set-aside card: HST collected so far + a rough "keep this much aside for taxes" number
- [ ] closing checklist on each deal: deposit in, conditions waived, lawyer has the docs, keys ready — so nothing falls through before closing day
- [ ] clients: a list of each agent's buyers/sellers with a status and last-contacted date (own table + api + page)
- [ ] follow-up nudges: "you haven't talked to this client in 14 days" + closing anniversaries ("1 year since they closed — send a text")
- [ ] calendar view: closings and condition deadlines on a month calendar
- [ ] pace forecast on the goal bar: "at this rate you finish the year at $X"
- [ ] badges + streaks: top producer of the month, closing streaks, first $100k — little stuff, agents love it
- [ ] office pulse feed: "sarah just closed in brampton" — recent activity across the office
- [ ] TV leaderboard: a fullscreen big-type version of the leaderboard for an office TV, refreshes itself
- [ ] deal map: leaflet map with a pin for every deal (same map setup as my real estate site) — where the office's business actually is
- [ ] PDF income report: a clean printable earnings report per agent (agents need these for mortgages and loans)

## accounts
- [ ] real login: agents log in and only see their own deals, the broker sees everything. hashed passwords, roles checked on the server, not just hidden in the frontend

## later
- [ ] import deals from a csv (offices already have spreadsheets — nobody's re-typing history)
- [ ] phone app feel (pwa) — installable, no app store
- [ ] deploy the demo (sample data) + screenshots in the readme
