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

## Stale production deployment (found 2026-08-04, separate from the bot-challenge fix)

While investigating a report that a synced event ("Testing Calendar Sync",
`groupme-2026-08-12-testing-calendar-sync-66c639eb.md`, commit `15a3b9f`) was
showing on the homepage but missing from `/events/`, and that "SW REGIONAL
RALY" showed the old un-renamed spelling on one page but the corrected
"RALLY" on the other — traced it to Cloudflare Pages, not the templates.

**What was checked**, all with cache-busted requests
(`Cache-Control: no-cache`) so the answers aren't just browser cache:

- GitHub's API (`.../commits/<sha>/check-runs`) shows a **"Cloudflare
  Pages: success"** check for commit `7ea77dc` (the `main` tip at the time,
  which includes both the Testing Calendar Sync event and the RALLY rename)
  completing at `2026-08-04T16:52:35Z`.
- A fresh `curl` to `https://lamaaustin.com/events/` **20+ minutes later**
  still returned the old content — no Testing Calendar Sync event, "RALY"
  not "RALLY".
- The same fresh content (i.e. still stale) was returned by
  `https://lamaaustin-website.pages.dev/events/` — the pages.dev alias,
  which bypasses the custom domain and any zone-level settings entirely.
  Since both hostnames agreed on the same stale content, this rules out a
  custom-domain-to-deployment aliasing problem specifically; it points at
  the actual Pages deployment/build itself lagging behind what GitHub's
  check-run reported as deployed.
- `cache-control: public, max-age=0, must-revalidate` and
  `cf-cache-status: DYNAMIC` on both responses — the response isn't being
  served from Cloudflare's edge cache, so this isn't an edge-cache-not-yet-
  purged situation either.

**Not resolved this session** — there's no Cloudflare API token, no
`wrangler`, and no dashboard access from this environment, so it wasn't
possible to inspect build logs or force a redeploy. Left as an open item:

1. Check the Pages project's **Deployments** tab and confirm the deployment
   marked as currently live actually corresponds to a recent commit SHA. If
   it's stuck on an older one, use **Retry deployment** on the latest.
2. If that doesn't clear it, any new push to `main` (the scheduled GroupMe
   sync will produce one on its own — see the schedule change below for how
   often) should trigger a fresh build that supersedes whatever's stuck.

Also worth noting while investigating this: the GroupMe sync recommits every
active event on every run, even when the file content hasn't changed
(visible as duplicate "Sync event from GroupMe: LAMA HOUSTON ANNIVERSARY"-
style commits, one cron interval apart, with byte-identical file content).
That's why 5 commits landed in the batch that included the one real change
(the Testing Calendar Sync event) — 4 of them were no-op resyncs. Harmless,
but it means every cron tick triggers a Pages rebuild regardless of whether
anything actually changed on GroupMe. Not fixed this session; the sync code
would need a content-diff check before calling `githubPutFile` to avoid the
redundant commits.

## Sync schedule reduced from every 30 minutes to every 3 hours

`.github/workflows/sync-groupme-calendar.yml`'s cron changed from
`*/30 * * * *` to `0 */3 * * *` (fires at 00:00, 03:00, 06:00 UTC, etc. — 8
times a day instead of 48).

**Why:** 30 minutes was more frequency than the actual use case needs — a
club calendar edited by a person in GroupMe occasionally, not something
anyone needs updated within minutes of a change. At that interval it was
also making the two problems above worse: more redundant no-op commits (see
above), and more frequent Pages builds arriving in tighter bursts, which
looked related to the deployment-promotion issue also documented above (Prod
staying pinned to an older commit despite newer ones building successfully).
Fewer, more spaced-out runs reduces both without fixing either at the root.

Manual syncs remain available any time regardless of the schedule, via
`workflow_dispatch` — GitHub repo → **Actions** tab → **Sync GroupMe
calendar** → **Run workflow**.

## Fixed the actual cause: sync no longer commits when nothing changed

The root fix for the redundant-commit problem mentioned above, not just a
schedule-based mitigation of it.

**Change:** `functions/api/groupme-calendar-sync.js` now skips the GitHub
write entirely for an event whose file content hasn't actually changed.
`functions/_lib/github.js` gained a `gitBlobSha(content)` helper that
computes the git blob SHA-1 of a content string — the exact same hash
GitHub's Contents API already returns as each file's `sha` in a directory
listing (`git hash-object` computes it the same way: `sha1("blob " +
byteLength + "\0" + content)`). Since `listSyncedFiles()` already fetches
that directory listing, comparing against it costs no extra API call — the
sync computes what the hash *would* be for the freshly-generated markdown
and skips the `PUT` if it already matches.

**Verified correct**, not just "looks right": computed the hash for one of
the real committed event files both with the new JS function and with `git
hash-object` on the actual file, confirmed they're byte-for-byte identical
(`04be47bbe4dae81592396aa918bf34300cc7b88c` both ways).
`crypto.subtle.digest` is standard Web Crypto, supported natively in
Cloudflare's Workers/Pages Functions runtime — same interface used here as
in the local Node verification.

The response JSON gained an `unchanged: []` array alongside
`created`/`updated`/`deleted` so a sync run's logs show explicitly which
events were checked and skipped, instead of that being invisible.

**Not changed:** the *rename* path (title/date change moves an event to a
new filename) still always writes, since that's a real content change by
definition — the skip only applies when the path and the content are both
unchanged from what's already committed.

Every synced event lands at `12:00 PM`
(`content/events/groupme-*.md`). `eventToMarkdown()` formats the display time
straight from the UTC hour in GroupMe's `start_at` with no conversion to
America/Chicago. For the current events this is probably harmless — they look
like GroupMe all-day events that default to noon — but if a timed event ever
syncs with a visibly wrong hour, that formatting is where to look.
