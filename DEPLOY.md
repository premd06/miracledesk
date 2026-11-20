# deploying miracledesk

how to put this on a server so real agents just open a url in their browser and log in. one server, one office — this isn't multi-tenant, so each brokerage gets its own copy and its own database.

## what you need

- node 22 or newer — the database uses `node:sqlite`, which needs it. check with `node --version`
- the repo on the server: `git clone https://github.com/premd06/miracledesk.git`
- a domain pointed at the server (or just the server's ip to start with)

## first time

```
cd server && npm install
cd ../client && npm install && npm run build
```

that builds the site into `client/dist`, which the server hands out itself — so one `npm start` runs the whole app, api and pages together.

```
cd ../server
npm run setup <username> <email> <password>
```

that makes the first broker account. it only works on an empty database, and it refuses if any account already exists, so run it once and that's it. then:

```
npm start
```

the app is on port 3001 unless `PORT` says otherwise. open it, log in as the broker, and add your agents from the Accounts page.

## environment variables

| variable | what it does |
| --- | --- |
| `PORT` | the port the server listens on (3001 if you leave it out) |
| `SMTP_HOST` | the mail server that sends the password-reset emails |
| `SMTP_PORT` | 587 if you leave it out |
| `SMTP_USER` | the login for that mail server |
| `SMTP_PASS` | the password for it |
| `MAIL_FROM` | the address the reset email comes from (defaults to `SMTP_USER`) |
| `RESET_BASE_URL` | where the reset link points — the address agents open the app at, like `https://miracledesk.ca` |

put them in a file the server reads as plain `KEY=value` lines, one per line — never commit that file. the server warns on startup when SMTP or `RESET_BASE_URL` is missing: don't ignore those warnings on a real deploy, or password resets silently do nothing (the link just prints to the server log instead).

## keeping it running

a systemd service, so it starts on boot and restarts if it falls over. save this as `/etc/systemd/system/miracledesk.service` (change the paths to where you put it):

```
[Unit]
Description=miracledesk
After=network.target

[Service]
WorkingDirectory=/home/prem/miracledesk/server
ExecStart=/usr/bin/node index.js
Restart=always
EnvironmentFile=/home/prem/miracledesk/server/.env
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

then:

```
sudo systemctl enable --now miracledesk
journalctl -u miracledesk -f   # watch the log
```

the `.env` file there is just the variables from the table above, `KEY=value` per line. systemd reads it — node doesn't need anything extra for it.

## in front of it (worth doing)

nginx in front for https, so agents get a proper `https://` address. it just passes everything through to the server:

```
server {
    listen 443 ssl;
    server_name miracledesk.ca;
    ssl_certificate /etc/letsencrypt/live/miracledesk.ca/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/miracledesk.ca/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header Host $host;
    }
}
```

the `X-Forwarded-For` line matters: the per-ip rate limits need the visitor's real address, and without it they'd only ever see the proxy's. (certbot from let's encrypt makes the certificate for free — `sudo certbot --nginx -d miracledesk.ca`.)

## updating it

```
cd ~/miracledesk && git pull
cd client && npm install && npm run build
cd ../server && npm install
sudo systemctl restart miracledesk
```

the database is just `server/miracledesk.db` — it stays put through updates, nothing in it gets touched. never run `node seed.js` against a real office's database: it wipes every deal, client, account and login in it. for backups, the broker can hit "Download a backup" on the Broker view page — that downloads a clean copy of the whole database (deals, clients, accounts, the audit trail, everything). grab one every week or so and keep it somewhere safe. if the server ever dies, that file is the office: put it back as `server/miracledesk.db` and start the server.

## if something's wrong

- the server warns on startup about missing SMTP or `RESET_BASE_URL` — see the table above.
- "port already in use" — something's already on 3001. set `PORT` to something else, or stop the other one.
- blank page or api errors in the browser — check the server is actually running (`curl localhost:3001/api/health` should say `{"ok":true}`) and that `client/dist` exists (did `npm run build` actually run?).
- logins failing for everyone at once — the per-ip limit trips at 50 failed logins in 15 minutes from one address. it clears itself when the window passes, so just wait it out.
