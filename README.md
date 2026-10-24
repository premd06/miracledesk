# miracledesk

a dashboard I'm building for the realtors at my brokerage (HomeLife/Miracle Realty, in the GTA) to track their deals and commissions. right now, if you want to know what you've actually made this year, you're digging through closing paperwork or a spreadsheet somebody made in 2015. this puts it on one page. I called it MiracleDesk — the agents' desk at Miracle.

heads up: everything in here runs on **sample data** — fake agents, fake deals, fake addresses. it's a demo of how the system would work. real client info would never go in a public repo.

## what it does

two sides to it:

**agent view**
- add a deal: address, sale price, commission %, listing side or buyer side, closing date
- the app does the math: gross commission, the brokerage's cut from your split, what you actually take home
- cards at the top: made this year, closing soon, number of deals

**broker view**
- the whole office on one page: every agent's totals, the office total, a leaderboard
- see what's closing this month across the brokerage

## the commission math (ontario)

gross commission = sale price × commission rate. every agent is on a split plan with the brokerage (like 95/5 — the agent keeps 95%). the dashboard takes the brokerage's share out and shows the agent's net. commissions here also have HST (13%) charged on top, so the numbers show that too instead of pretending it doesn't exist.

## tech

same stack as my other projects, on purpose: react + vite frontend (`client/`), node + express api (`server/`), sqlite database. third project on this stack — I'd rather know one stack properly than three badly.

## run it

```
# api
cd server && npm install && npm start     # localhost:3001

# frontend
cd client && npm install && npm run dev   # localhost:5173
```

## status

just started (oct 2026). building it in small commits, same as my other projects — the plan is in ROADMAP.md.

---

I'm Prem — realtor at HomeLife/Miracle and a CS student. other stuff: [davehomes.ca](https://davehomes.ca) · [seo-dashboard](https://github.com/premd06/seo-dashboard) · [halal-eats](https://github.com/premd06/halal-eats)
