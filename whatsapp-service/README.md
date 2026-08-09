# Gym WhatsApp service

Sends the gym's WhatsApp messages automatically, from the gym's own number, so
staff no longer open a `wa.me` link and press send by hand.

It links to WhatsApp the same way WhatsApp Web does — you scan a QR once from
the gym's phone — and then Laravel calls it over loopback whenever a message
should go out.

## Read this before deploying

This uses an **unofficial** WhatsApp connection (Baileys). It is against
WhatsApp's Terms of Service, and **the gym's number can be banned**. That risk
is managed here, not eliminated:

- sends are serialised with a random 5–20 second gap (`MIN_GAP_MS` / `MAX_GAP_MS`)
- a "typing" indicator precedes each message
- messages only go to existing members, who know the gym

Do not lower the gap to push messages out faster, and do not point this at a
bulk marketing list. If the number matters to the business, consider using a
second SIM for it. The manual WhatsApp button in the dashboard keeps working, so
a ban degrades the gym back to today's flow rather than breaking it.

## Setup on the Hostinger VPS

The site user (`atpgymegypt-api`) has **no root**, so this is kept alive by cron
and `flock`, exactly like the Laravel queue worker already in that crontab.
pm2 is not usable here: `npm install -g` cannot write to `/usr`, and
`pm2 startup` needs sudo.

```bash
# Node 20+ required; the server has v22.
cd ~/htdocs/api.atpgymegypt.com/whatsapp-service
npm install --omit=dev

cp .env.example .env
openssl rand -hex 32        # paste into WHATSAPP_SERVICE_TOKEN
nano .env
```

Put the **same** token in the Laravel `.env`
(`~/htdocs/api.atpgymegypt.com/backend/.env`):

```
WHATSAPP_SERVICE_URL=http://127.0.0.1:3001
WHATSAPP_SERVICE_TOKEN=<the same value>
WHATSAPP_AUTO_SEND=true
```

Apply the migration, then add one line to `crontab -e`:

```bash
php ~/htdocs/api.atpgymegypt.com/backend/artisan migrate
```

```cron
# WhatsApp gateway. flock -n makes the once-a-minute tick a no-op while the
# service is already up, and relaunches it within a minute if it ever dies —
# same approach as the queue worker above, since there is no root for systemd.
* * * * * cd /home/atpgymegypt-api/htdocs/api.atpgymegypt.com/whatsapp-service && /usr/bin/flock -n /home/atpgymegypt-api/whatsapp-service.lock /usr/bin/node src/index.js >> /home/atpgymegypt-api/logs/whatsapp-service.log 2>&1
```

That also covers reboots: cron restarts it on the next tick.

## Linking the number

1. Open **Dashboard → Settings → WhatsApp** — it shows a QR code.
2. On the gym's phone: WhatsApp → Settings → **Linked devices** → Link a device.
3. Scan. The status turns to *Connected* and the QR disappears.

The credentials are written to `auth_info/`, so restarts and reboots reconnect on
their own. Only an explicit unlink — from the dashboard, or from the phone's
Linked devices screen — forces a new scan.

**Back up `auth_info/`.** Losing it means re-scanning from the phone.

## Firewall

The service binds to `127.0.0.1` by default and must stay that way. Anyone who
can reach the port can send WhatsApp messages as the gym — the token is the only
thing in the way. Do not open port 3001 in the Hostinger firewall.

## API

All routes except `/health` need `Authorization: Bearer $WHATSAPP_SERVICE_TOKEN`.

| Route | Purpose |
| --- | --- |
| `GET /health` | Liveness check; no auth. |
| `GET /status` | `{ state, connected, number, error, queued }` — `state` is `connected`, `qr_pending`, `disconnected` or `logged_out`. |
| `GET /qr` | `{ qr, state }` — `qr` is a data-URL image, or `null` when already linked. |
| `POST /send` | `{ phone, message, image_url? }`. `phone` is digits only in international format (`201012345678`). With `image_url` the message is sent as an image with the text as its caption. |

`image_url` is fetched and re-encoded before sending, not passed to WhatsApp as a
link. barcodeapi.org returns a 1-bit greyscale PNG, which many WhatsApp clients
cannot draw — they show an empty box with a download arrow. The service converts
it to an 8-bit JPEG on white, enlarges it, adds a quiet zone so door scanners
read it off a phone screen, and attaches an explicit thumbnail.

If the barcode cannot be fetched or converted, the message still goes out as
plain text and the failure is logged as `barcode unavailable, sending text only`.
The member is not blocked: the template body carries the barcode link too, which
is exactly why that link is worth keeping alongside the picture.
| `POST /logout` | Unlinks the number and wipes the credentials. |

`POST /send` status codes, which the Laravel job treats differently:

| Code | Meaning | Laravel's response |
| --- | --- | --- |
| 200 | Sent | Logged as `sent` |
| 429 | Queue is full | Retried later |
| 503 | Not linked | Retried later |
| 504 | Send timed out | Retried later |
| 422 | Bad number, or not on WhatsApp | Logged as `failed`, not retried |

## Troubleshooting

```bash
tail -f ~/logs/whatsapp-service.log     # what the service is doing
curl -H "Authorization: Bearer $TOKEN" 127.0.0.1:3001/status

# Restart it: kill it and let the next cron tick bring it back.
pkill -f 'node src/index.js'
```

- **Stuck on `qr_pending`** — the QR expires every ~20s and regenerates; reload
  the settings page for a fresh one.
- **Went to `logged_out` on its own** — the device was unlinked from the phone,
  or WhatsApp dropped it. Re-scan.
- **Messages queue but never arrive** — check `queued` in `/status`. With a 5–20s
  gap, 50 pending messages take roughly 10 minutes to drain. That is intentional.
- **Message arrives but the barcode is an empty box** — grep the log for
  `barcode unavailable`. If it is there, barcodeapi.org was unreachable or rate
  limiting and the text-only fallback ran.
