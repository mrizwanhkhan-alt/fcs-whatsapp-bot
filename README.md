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
