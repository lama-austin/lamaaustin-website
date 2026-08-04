# Repo review — 2026-08-04

Requested by the user: "go through the repo, find things that are redundant,
find things that need to be cleaned up, things that could improve the overall
experience... make sure the site works well on mobile as well, most of our
views are mobile." Two bugs found along the way (a broken weekday label and a
stale-deployment mystery) are documented separately, linked below. This file
covers the mobile fixes that were implemented, plus the broader findings that
were only reported, not acted on.

## Fixed this session

### Tap targets on social icons too small for fingers

`layouts/_default/baseof.html`: `.footer-social-link` had `padding: 0`
(11-18px visible icon, no padding — for
comparison, Apple/Google guidance is ~44px) and the mobile nav's
`.nav-social-link` had `padding: 0 !important` inherited from its desktop
rule. On a site where most traffic is mobile (per the user), that's a real
miss-tap risk on the only two external links (Facebook, Instagram) in the
footer and mobile nav.

**Fix:** added padding to both, shrank the surrounding `gap`/`margin` by a
matching amount so the visual spacing looks about the same as before.
Measured with Playwright post-fix:

| Element | Before | After |
| --- | --- | --- |
| `.footer-social-link` tap box | 18×18px | 40×40px |
| `.nav-social-link` tap box (mobile menu) | 20×20px (see note) | 41×41px |

**Note on the nav fix, worth remembering if this pattern comes up again:**
the first attempt used a plain `padding: 0.65rem` override in the mobile media
query and measured no change (still 20×20px). Cause: `.nav-social-link`'s
*desktop* rule at `baseof.html:77` sets `padding: 0 !important`, and
`!important` beats a later, more-specific, non-`!important` rule regardless
of media query or source order. Had to mark the override `!important` too.
This is the same class of bug as the original horizontal-overflow issue
(inline styles / `!important` silently defeating a media query) — worth
grepping for other `!important` rules in `baseof.html` before adding new
mobile overrides near them.

### No visual hint that the events filter bar scrolls

`layouts/events/list.html`: `.filter-bar` (All / Rides / Meetings / Social /
Sanctioned Events) gets `overflow-x: auto` on mobile, but nothing indicated
it scrolls — the tabs just look like they got cut off. On a 360-390px phone,
"Sanctioned Events" is entirely off-screen with no affordance.

**Fix:** added a static right-edge fade (`.filter-bar::after`, a
`pointer-events:none` gradient into the bar's own background color) that
signals "there's more this way." Confirmed visually via screenshot — the
last visible label now visibly trails off into a fade instead of hard-cutting.

**Known limitation:** it's CSS-only, no scroll listener, so the fade doesn't
disappear once you've scrolled all the way to the end. Good enough to signal
scrollability; a JS-driven version that hides the fade at scroll-end would be
a nice-to-have, not needed now.

Both fixes verified with the same headless-Chromium measurement method used
for the earlier overflow fix (see
[mobile-nav-and-overflow-fix.md](mobile-nav-and-overflow-fix.md)) — 0
unexpected overflow across all 6 page types at 360/390/414px both before and
after.

## Also fixed: events always showing "Mon"

Separate small bug, same session: [layouts/index.html:217](../layouts/index.html#L217)
had `time.Format "MON — Jan 2, 2006"`. Hugo/Go's date layout is matched by
exact substring against a reference date; the weekday token is `Mon`, not
`MON`. Since `MON` doesn't match any token it was rendered as a literal
string every time, regardless of the event's actual day of the week — hence
every homepage event card said "MON" even when the date was a Saturday.
Fixed to `"Mon — Jan 2, 2006"` (still piped through `| upper` for the same
all-caps display).

## Investigated, not a code bug: stale production deployment

While checking the homepage/events-page inconsistency the user reported (an
event showing on one page and not the other), traced it to Cloudflare Pages
itself serving content that doesn't match what's on `main`/GitHub's reported
successful deploy — not a template bug. Full writeup, including exactly what
was checked and what to look at in the Cloudflare dashboard, is in
[groupme-sync-troubleshooting.md](groupme-sync-troubleshooting.md) under
"stale production deployment."

## Reported, not yet acted on

These came out of a full-repo audit. None were touched — listed here so the
work doesn't need re-discovering.

### Redundant code

- **`.contact-form`/`.form-row`/`.form-field`/`.form-submit` CSS is
  duplicated near-verbatim** between `layouts/index.html` and
  `layouts/_default/join.html` (~15 rules). Same for the WhatsApp-submit JS
  at the bottom of each file (same phone number, same message template, same
  4-second button-reset timeout). Worth extracting into one shared partial.
- **`.map-link` styles** duplicated identically across `index.html`,
  `events/list.html`, and `gallery/list.html`.
- **`.stat-box`/`.stat-num`/`.stat-label`** near-duplicated between
  `index.html` and `_default/about.html` (only the background color
  differs).
- **`functions/api/contact.js` (the Twilio WhatsApp backend) is not wired to
  either contact form.** Both forms build a `wa.me` deep link client-side
  instead of POSTing to this endpoint. The endpoint is still deployed and
  directly POST-able, so the hardening concern raised in
  [contact-form-hardening.md](contact-form-hardening.md) (no rate limit, no
  captcha, billable Twilio calls) is still live even though the endpoint is
  disconnected from the actual UI. This needs a decision, not just cleanup:
  wire the form to it, or delete the function.

### i18n scaffolding is inert

`hugo.toml` has no `[languages]` block, meaning Hugo is not actually running
in multilingual mode — `.Language.Lang` is always `"en"`,
`.AllTranslations` is always empty. Consequently, the `/es` URL prefix logic
(`$pfx := cond (eq .Language.Lang "es") "/es" ""`) repeated in 5+ templates,
the `hreflang` loop in `baseof.html`, and `lang="{{.Language.Lang}}"` are all
dead code — they can never produce anything other than `en`/no-prefix. The
actual (and only) translation mechanism live on the site is the client-side
Google Translate widget in the nav. This is a product decision, not a bug:
either build real Hugo multilingual support (`content/es/`, `i18n/es.yaml`)
to match what the templates already assume, or strip the dead scaffolding to
reduce confusion for whoever edits these templates next.

### Smaller items

- Several gallery JPEGs are 300-500KB with no responsive `srcset` or Hugo
  image processing (`resources.Resize`/`fill` unused anywhere in
  `layouts/`) — meaningful on mobile data connections.
- `baseof.html` preconnects to `fonts.googleapis.com` but not
  `fonts.gstatic.com`, which is where the actual font files are served from
  — adds an avoidable round-trip before fonts start loading.
- `members/list.html`'s org-chart fixed-width tier nodes (300px/270px,
  reduced to 220px/200px under 900px) were checked specifically for mobile
  overflow given the fixed pixel widths — they fit under a 360px viewport's
  available width once padding is subtracted. No action needed.
- The GroupMe sync recommits every event on every scheduled run even when
  nothing changed (visible as duplicate "Sync event from GroupMe: X" commits
  a cron interval apart with identical file content) — harmless but adds
  noise to history and triggers unnecessary Pages rebuilds. Not investigated
  further this session.
