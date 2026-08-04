# GroupMe calendar sync — outage of 2026-08-04

Notes from debugging the failing `Sync GroupMe calendar` GitHub Action, so we
remember what was changed and why.

> **Picking this up later:** this file and the repo changes it describes live on
> the branch **`fix/groupme-sync-bot-challenge`**, branched from `main` at
> `4d00c40`. The Cloudflare-side fix is already live in production and is not
> part of this branch — the sync works right now regardless of whether this
> branch is ever merged. All the branch contains is the workflow's error
> reporting plus these notes.
>
> Outstanding follow-up work is in
> [contact-form-hardening.md](contact-form-hardening.md), which is **not done**.

## Symptom

Every scheduled run of `.github/workflows/sync-groupme-calendar.yml` failed at
the `Call sync endpoint` step:

```
Error: Process completed with exit code 22.
```

Exit code 22 is `curl`'s "the server returned an HTTP status >= 400", which
`curl -f` turns into a failure. Because the flags were `-sf`, the response body
was discarded, so the logs showed no reason for the failure.

## Root cause

**Cloudflare's bot protection on the `lamaaustin.com` zone was challenging the
request before it ever reached the Pages Function.** Nothing was wrong with the
sync code or the secrets.

Evidence gathered by hitting the endpoint directly:

| Request | Result |
| --- | --- |
| `POST https://lamaaustin.com/api/groupme-calendar-sync` | `403`, `content-type: text/html`, `cf-mitigated: challenge`, body is the "Just a moment..." interstitial |
| `GET https://lamaaustin.com/` | `403`, `cf-mitigated: challenge` (so it is zone-wide, not specific to the API route) |
| `POST https://lamaaustin-website.pages.dev/api/groupme-calendar-sync` | `403`, `content-type: application/json`, body `{"error":"Forbidden"}` |

The `cf-mitigated: challenge` response header is the tell. That is Cloudflare's
edge announcing it served a managed/JS challenge instead of proxying to the
origin. A browser solves that challenge invisibly; a GitHub Actions runner
running `curl` cannot, so it just receives a 403 HTML page.

The third row is the important one — on the `*.pages.dev` hostname the request
reaches our Function and gets a correct JSON `403 Forbidden` from our own
`SYNC_SECRET` check in
[`functions/api/groupme-calendar-sync.js`](../functions/api/groupme-calendar-sync.js#L17).
Same deployment, same code, same environment variables. Only the hostname (and
therefore the zone WAF in front of it) differed.

## Fix applied — CONFIRMED WORKING

**Bot Fight Mode was turned off** in the Cloudflare dashboard
(Security → Bots), on 2026-08-04. That was the root cause and it is now
resolved at the source rather than worked around.

**Confirmed by a green run:** workflow run `30928909563` (manual
`workflow_dispatch`, 2026-08-04 16:23 UTC) succeeded in 17s, returning
`{"created":[],"updated":[5 events],"deleted":[],"errors":[]}` and landing six
commits on `main` — the five event syncs plus a `Rename synced event: SW
REGIONAL RALLY`, which incidentally proves the rename path works when a title is
corrected in GroupMe.

For context on how bad it was: **this workflow had never once succeeded.** All 9
runs from its creation (02:24 UTC) until the fix failed. The endpoint itself was
fine the whole time — the five event files committed at 03:43 UTC were the same
code triggered from a laptop, where a residential IP and a real browser pass the
bot challenge that an Actions runner cannot.

Verification immediately after disabling:

| Check | Before | After |
| --- | --- | --- |
| `GET lamaaustin.com/` | `403`, `cf-mitigated: challenge` | `200 text/html`, no `cf-mitigated` header |
| `POST lamaaustin.com/api/groupme-calendar-sync` | `403` HTML interstitial | `403 application/json` → `{"error":"Forbidden"}` (our own auth check, correct for an unauthenticated probe) |
| `GET lamaaustin.com/` with `Accept: text/markdown` | `403`, challenge | `200 text/markdown` |

Note the third row — Bot Fight Mode had also been silently defeating the
"Markdown for Agents" content negotiation in
[`functions/_middleware.js`](../functions/_middleware.js). That feature exists
to serve clean markdown to AI agents and crawlers, and those are exactly the
clients Bot Fight Mode was challenging. It works again now.

Worth knowing for next time: free-tier Bot Fight Mode **ignores WAF skip
rules**, so exempting just the sync path was never an option — it had to be off
outright. On Pro and above, the more surgical alternative would have been a WAF
custom rule with a `Skip` action matching
`http.request.uri.path eq "/api/groupme-calendar-sync"`.

## Changes made to this repo

`.github/workflows/sync-groupme-calendar.yml`:

1. **Replaced `-sf` with `--fail-with-body` and echoed the response.** The old
   flags threw away the response body, which is why the original failure was
   opaque — exit code 22 and nothing else. Now a non-2xx response prints
   whatever the server actually said.
2. **Added a check on the `errors` array in the JSON response.** The endpoint
   returns `200` with a populated `errors[]` when individual events fail to
   commit to GitHub, so a partial failure used to show up as a green run. It
   now fails the job.
3. **Added a comment on `SYNC_URL`** pointing back at this file, so that if the
   same 403-with-HTML symptom recurs, Cloudflare's bot settings get checked
   before anyone re-debugs the Function.

`SYNC_URL` itself is unchanged — it still points at `https://lamaaustin.com/`.
It was briefly switched to the `*.pages.dev` alias as a workaround (that
hostname is not behind the custom domain's zone WAF) but that was reverted once
Bot Fight Mode was disabled, since the workaround is no longer needed.

## ⚠️ Follow-up still outstanding: the contact form is now unprotected

Bot Fight Mode, for all its problems, was the only thing standing in front of
[`functions/api/contact.js`](../functions/api/contact.js). That endpoint has **no
rate limit, no captcha, and no honeypot**, and every accepted POST sends a
Twilio WhatsApp message — which costs money per send. A spam bot can now flood
both the WhatsApp thread and the Twilio bill at whatever rate it likes.

Recommended, in order:

1. **Cloudflare Turnstile on the contact form.** Free on this plan, invisible to
   real users, and it is the purpose-built version of what Bot Fight Mode was
   doing by accident. Needs a site key + secret key from the dashboard, then
   a widget in the form template and a verification call in `contact.js`.
2. **A rate limiting rule on `/api/contact`.** The free plan includes one
   rule. Good backstop even with Turnstile in place.
3. A **honeypot field** is the ten-minute version if the above has to wait — it
   catches the dumb-bot majority and needs no dashboard keys.

## Unrelated observation, not changed

Every synced event lands at `12:00 PM`
(`content/events/groupme-*.md`). `eventToMarkdown()` formats the display time
straight from the UTC hour in GroupMe's `start_at` with no conversion to
America/Chicago. For the current events this is probably harmless — they look
like GroupMe all-day events that default to noon — but if a timed event ever
syncs with a visibly wrong hour, that formatting is where to look.
