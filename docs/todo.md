# To do later

Items we agreed to come back to. Newest decisions at the top of each item.

## 1. Move accounts and tokens off personal accounts (handoff blocker)

Everything automated currently runs on one person's accounts. Before the
site can be handed off, move each of these to chapter-owned accounts:

- [ ] **GitHub token used by the GroupMe sync** (`GITHUB_TOKEN` in the
      Cloudflare Pages environment variables). Every sync commit is
      authored as `bict0r`. Re-create it from the **LAMA Austin admin GitHub
      account** and replace the value in Cloudflare.
- [ ] **GroupMe token** (`GROUPME_USER_TOKEN`). It is a *user* token, so if
      that user leaves the group the sync stops. Plan: create a GroupMe
      account on the **chapter phone number**, add it to the group, and use
      its token instead.
- [ ] **`SYNC_SECRET`**: stored both as a GitHub Actions secret and a
      Cloudflare variable; they must match. Record where it lives.
- [ ] **Cloudflare account** (Pages project + DNS) owned by the chapter.
- [ ] **Domain registrar** for lamaaustin.com owned by the chapter.
- [ ] **Admin-panel login**: the Cloudflare Worker `lama-oauth`
      (source: `workers/oauth/worker.js`) uses a **GitHub OAuth app** whose
      client ID/secret are Worker variables. Re-create the OAuth app under
      the **LAMA Austin admin GitHub account** (callback URL
      `https://oauth.lamaaustin.com/callback`) and update the two variables.
- [x] **Deploy the security fix in `workers/oauth/worker.js`** to the
      `lama-oauth` Worker. Done 2026-10-15.
- [ ] **Delete the unused `lama-contact` Worker** in Cloudflare (old email
      version of the contact form; its email service, MailChannels' free
      API, no longer exists).
- [ ] Write all of the above (where each thing lives, who has access) into
      the README's "Accounts" section.

## 2. Contact form delivery

Goal: someone can send us their info **without needing WhatsApp
themselves**. Today the form opens WhatsApp on the visitor's phone (number
editable in admin → Site Settings → WhatsApp Number).

Options discussed:

| Option | Cost | Notes |
| --- | --- | --- |
| Post into a GroupMe chat via a GroupMe bot | Free | Simplest; fits how the chapter already talks |
| Email to a chapter inbox | Free | Needs an email-sending service |
| Twilio → WhatsApp (`functions/api/contact.js`, already written) | Paid per message | WhatsApp only allows free-form automated messages within 24h of the recipient messaging the business number; otherwise needs Meta-approved templates and a verified sender |

Whichever is chosen, add spam protection (Cloudflare Turnstile + a hidden
honeypot field).

**Meanwhile:** `functions/api/contact.js` is deployed, unused by the site,
and has no spam protection. Each POST to it can send a paid Twilio message
if the Twilio variables are set in Cloudflare. Either delete it or protect
it when this item is picked up.

## 3. Multi-day events disappear early

The site only shows events whose **start** date is today or later, and
that check happens when the site is rebuilt. If a rebuild happens on day 2
of a multi-day event (e.g. an anniversary weekend), the event disappears
while it's still going on. Fix: have the GroupMe sync also save the end
date, and filter on the end date instead.

## 4. Facebook event sync (idea)

Pull events from the chapter Facebook page the same way GroupMe events are
pulled, and possibly post website events to Facebook automatically.
Facebook's API requires an approved app and a Page access token, so this
needs research first.

## 5. Smaller items

- Duplicated CSS/JS between `layouts/index.html` and
  `layouts/_default/join.html` (contact form) could be shared.
- Gallery images aren't resized for phones; consider Hugo image processing.
- Add a `fonts.gstatic.com` preconnect in `baseof.html`.
- `static/images/668458265_…_n.jpg` (birthday photo) isn't used anywhere on
  the site but is still publicly reachable. Delete it if it isn't needed.
- `static/images/patches/international-patch.webp` isn't used yet; it could
  be the image for the International stage on the Join page (admin → Pages
  → Join Page → Membership Stages).
