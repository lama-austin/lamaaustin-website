# TODO: harden the contact form

**Status: open. Nothing has been implemented yet — this is a plan, not a record.**

Written 2026-08-04, immediately after Bot Fight Mode was disabled to fix the
GroupMe calendar sync (see
[groupme-sync-troubleshooting.md](groupme-sync-troubleshooting.md)).

## The concern

Disabling Bot Fight Mode was the right call for the sync, but it removed the
only thing standing in front of
[`functions/api/contact.js`](../functions/api/contact.js).

That endpoint currently has:

- no rate limit
- no captcha
- no honeypot
- no origin/referer check
- no length caps on any field

and every accepted POST sends a Twilio WhatsApp message. Twilio bills per
message. So an abusive script can run up a real bill and flood the WhatsApp
thread at whatever rate it can issue requests.

The endpoint is trivially discoverable (it is the action of the public
membership form) and takes a plain `multipart/form-data` POST with only
`first`, `last` and `email` required — no token of any kind. A one-line `curl`
in a loop is the entire attack.

This was true before today as well; Bot Fight Mode was incidentally masking it.
Turning it off did not create the hole, it just uncovered it.

## Recommended fixes, in priority order

### 1. Cloudflare Turnstile on the form

The proper fix, and free on the current plan. It is the purpose-built version of
what Bot Fight Mode was doing by accident, and unlike Bot Fight Mode it applies
only where it is wanted rather than to every request to the zone.

Steps:

1. Cloudflare dashboard → Turnstile → add a widget for `lamaaustin.com`. This
   yields a **site key** (public, goes in the template) and a **secret key**
   (goes in Pages → Settings → Environment variables, production).
2. Add the widget div + script to the contact form template, which will render a
   `cf-turnstile-response` field into the form body.
3. In `contact.js`, before the Twilio call, POST that token to
   `https://challenges.cloudflare.com/turnstile/v0/siteverify` along with the
   secret key and the client IP from `request.headers.get('CF-Connecting-IP')`.
   Reject with a 400 if the response is not `success: true`.

Note the form template needs locating first — the form markup lives under
`layouts/`, and the site is bilingual (there is an `i18n/` directory), so check
whether the form is rendered once or per-language before editing.

### 2. A rate limiting rule on `/api/contact`

Cloudflare dashboard → Security → WAF → Rate limiting rules. The free plan
includes one rule, and this is the best use for it.

Suggested: match `http.request.uri.path eq "/api/contact"`, count by client IP,
something like 5 requests per 10 minutes, action Block. Tune to taste — a real
prospective member submits once.

Worth doing *even with Turnstile in place*, since it is the thing that caps the
financial damage if the captcha is ever defeated or misconfigured.

### 3. Honeypot field (the ten-minute stopgap)

Needs no dashboard access and no keys, so it can be done entirely in this repo.
Add a field that is hidden from humans via CSS (not `type="hidden"` — bots read
that too; use an off-screen or `display:none` wrapper with `autocomplete="off"`
and `tabindex="-1"`), then in `contact.js` return a fake `{ success: true }` if
it arrives non-empty. Returning success rather than an error avoids telling the
bot it was caught.

This catches the unsophisticated majority and nothing else. It is a stopgap, not
a substitute for 1 and 2.

### 4. Minor hardening worth folding in whenever the above is done

- Cap field lengths before building the message body. There is currently nothing
  stopping a multi-megabyte `message` field being POSTed straight into a Twilio
  API call.
- Validate that `email` actually looks like an email — it is only checked for
  presence.
- Consider whether a failed Twilio call should return the upstream error message
  to the client. [`contact.js:57`](../functions/api/contact.js#L57) currently
  passes `err.message` from Twilio through to the response body, which can leak
  more about the account setup than a public endpoint should.

## Interim risk

Low but non-zero, and asymmetric — the likely outcome is that nothing happens,
but the bad outcome costs money and is discovered late, via a bill. If the form
is going to sit unprotected for more than a few days, the honeypot (#3) is worth
the ten minutes on its own, or set a Twilio spend alert as a tripwire.
