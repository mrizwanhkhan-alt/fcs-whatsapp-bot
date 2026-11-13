# fcs-whatsapp-bot
FCS Express WhatsApp AI Bot (optional)

## Staff WhatsApp calling

Open `/staff-calling` over HTTPS. Enter the staff access secret and connect the
panel to see incoming calls. Use **Check Calling Permission** to verify Meta's
current permission and limits before dialing. A free-form permission request
uses the open customer service window. Configure an approved permission template
to send a request outside that window.

The existing WhatsApp phone number must have Cloud API calling enabled. In the
Meta app, subscribe the WhatsApp Business Account webhook to `calls` alongside
`messages` on the existing `/webhook` endpoint.

- `PHONE_NUMBER_ID` and `WHATSAPP_TOKEN` use the existing WhatsApp configuration.
- `META_APP_SECRET` is the secret of the Meta app sending the webhooks. Call
  signaling uses this to verify the signature on the original webhook body.
- `STAFF_CALLING_SECRET` is a separate staff bearer secret of at least 24 characters.
- `CALL_PERMISSION_TEMPLATE_NAME` and `CALL_PERMISSION_TEMPLATE_LANGUAGE`
  are optional. Use the approved Meta template name and its language code.
- `STAFF_CALLING_ICE_SERVERS` optionally overrides the default STUN server with a
  JSON array of browser ICE servers. Include TURN for staff networks that block
  direct WebRTC. Use credentials intended for authenticated browser clients.

Call signaling is stored in the running bot process. The staff panel and Meta
webhook must reach the same instance. A restart interrupts active signaling.

Run `npm test` after installing the existing dependencies. Before production
deployment, verify with a staging WhatsApp number and a consenting test phone.
Check permission request and approval, answer and decline an incoming call,
complete an outgoing call, confirm two-way audio, and hang up from both ends.
Verify a normal bot message on the same webhook.

## WhatsApp admin dashboard

Open `/admin` over HTTPS to sign in and send to one WhatsApp number at a time.
The dashboard uses the bot's existing `PHONE_NUMBER_ID` and `WHATSAPP_TOKEN`
on the server. It also uses the existing `META_APP_SECRET` to verify incoming
messages for the 24-hour customer service window.

Set `ADMIN_PASSWORD_HASH` in the **existing Render service's Environment**
settings. Generate its value locally in Bash using a unique password of at
least 24 characters and up to 256 characters. This prompts without echoing
the password and prints only the salted hash:

```bash
read -rsp 'Admin password: ' admin_password; printf '\n' >&2
printf '%s' "$admin_password" | node -e 'const fs = require("node:fs"); const crypto = require("node:crypto"); const password = fs.readFileSync(0, "utf8"); if (password.trim().length < 24 || password.length > 256) process.exitCode = 1; else { const salt = crypto.randomBytes(16); console.log(salt.toString("hex") + ":" + crypto.scryptSync(password, salt, 64).toString("hex")); }'
unset admin_password
```

Optionally set `ADMIN_WHATSAPP_TEMPLATES` to a JSON list of templates already
approved for this WhatsApp Business Account. For example:

```json
[
  {"name":"customer_follow_up","language":"en","bodyParameters":1},
  {"name":"shipment_document","language":"en","header":"document"},
  {"name":"shipment_photo","language":"en","header":"image"}
]
```

Use the exact approved template names and language codes. The dashboard
supports static templates and templates with positional text body parameters
and an optional image or PDF header. The operator confirms customer opt-in
before each template send. Meta validates the selected template at send time.

Free-form text and media require a verified inbound message from that number
in the last 24 hours. The dashboard uses the message timestamp from Meta
and rechecks the window just before sending. Session and window state are
held in memory on the same bot instance as the webhook. A restart signs
administrators out and requires a new inbound message to establish a
free-form window. Approved templates can still be used after a restart.

The dashboard accepts JPG and PNG up to 5 MB and supported documents up to
20 MB. Files are uploaded directly to Meta through the server and are not
stored on the Render filesystem. A success message means Meta accepted the
message for delivery.

Run `npm test` before deploying. After deploying, verify sign-in and window
detection, then send a text, a file and a configured template to a consenting
test phone.

### WhatsApp Inbox

The Super Admin dashboard includes an Inbox for new verified customer messages and
outbound messages sent through the bot and Admin Messaging. It shows the latest
100 conversations and up to 100 messages per conversation. WhatsApp attachments
appear as captions or message-type labels.

To enable it, set `FCS_INBOX_DIR` to a writable absolute path on a persistent
disk attached to the existing single-instance service. The Inbox stores its
message journal and read state there. Keep access to the disk and its backups
restricted to authorized administrators. With no directory configured, the
existing messaging routes operate and the Inbox reports that storage is unavailable.
