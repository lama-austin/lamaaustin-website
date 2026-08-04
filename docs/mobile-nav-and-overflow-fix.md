# Mobile navigation menu + horizontal overflow — fixed 2026-08-04

Two separate mobile bugs, found from screenshots the user shared (a phone
screenshot of `/join/` showing the requirements box get cut off at the
right edge, and a note that there was no way to reach Members/Rides/Media
from a phone).

## Bug 1 — no mobile navigation menu

`.nav-links { display: none; }` at `max-width: 768px` in
[`layouts/_default/baseof.html`](../layouts/_default/baseof.html) hid the
entire nav list on phones with nothing to replace it. Below 768px wide there
was no way to reach About, Members, Rides, Media, or the language selector —
only the logo (home link) and the Join button (which happened to survive
because it's also styled `.nav-cta`, not because it was meant to survive)
were reachable.

Confirmed with a screenshot at 390×844 before the fix: the top bar has a logo
and nothing else.

### Fix

Added a proper mobile menu to `baseof.html`:

- A hamburger `<button class="nav-toggle">` next to the logo, shown only
  below 768px (`display:none` above it).
- The *same* `<ul class="nav-links">` Hugo already renders — not a duplicate
  — re-styled by the media query into a full-width dropdown panel anchored
  under the nav bar. Reusing the same markup means `#google_translate_element`
  stays a single element with a unique id; a second copy would have broken
  Google's translate widget, which binds to that id once.
- A small IIFE at the bottom of `<body>` toggles a `.nav-open` class on
  `<nav>`, closes the panel on link click (needed because in-page anchors
  like `#members` don't reload the page) and on Escape, and resets state if
  the viewport is resized past 768px while open.
- `aria-expanded` on the button and `aria-controls` pointing at the panel's
  `id="nav-links"` for screen readers.

Verified with Playwright: after clicking the toggle, `aria-expanded` flips to
`"true"`, all five real nav links are present in the DOM (`Chapter`,
`Members`, `Rides`, `Media`, `Join`), and `document.documentElement.scrollWidth`
stays equal to the viewport width with the panel open (390px in, 390px out) —
so the open panel doesn't itself introduce an overflow. Screenshots of both
states are referenced in the PR/commit for this change.

New i18n key `nav_menu: Menu` added to
[`i18n/en.yaml`](../i18n/en.yaml) for the button's `aria-label`. **The
Spanish translation file needs the same key** — see the "Follow-up" note in
[repo-review-2026-08-04.md](repo-review-2026-08-04.md) about `i18n/` only
having an `en.yaml`.

## Bug 2 — page locked to a fixed width on phones, clipping content off-screen

This is the bug in the screenshot: the "At A Glance" requirements box on
`/join/` (and the equivalent contact form on the homepage) got cut off at the
right edge instead of reflowing to fit the screen.

### Root cause

Measured with a headless-Chromium script (`document.documentElement.scrollWidth`
at 360/390/414px viewports) before touching anything:
**every phone width rendered the page at a fixed 704px**, wider than any phone
screen, with `body { overflow-x: hidden }` silently clipping the excess
instead of showing a scrollbar — so the content wasn't just cramped, part of
it was genuinely unreachable.

Root cause was CSS Grid's default `min-width: auto` on grid items, combined
with two things that set an intrinsic width floor wider than a phone:

1. **`<input>`/`<textarea>` elements don't shrink below their intrinsic
   content width inside a grid column by default.** A grid item's
   `min-width` defaults to `auto`, which for a text input resolves to
   roughly its unconstrained natural width — wide enough that the whole
   `.form-row` grid, and therefore the page, couldn't shrink below it.
2. **An inline `style="grid-template-columns: 1fr 1.5fr 1.5fr"`** on the
   Year/Make/Model row in both
   [`layouts/_default/join.html`](../layouts/_default/join.html) and
   [`layouts/index.html`](../layouts/index.html). Inline styles beat any
   stylesheet rule regardless of specificity tricks, so the existing
   `@media (max-width: 900px) { .form-row { grid-template-columns: 1fr; } }`
   rule was silently never applying to that particular row.

The same inline-style-beats-media-query pattern had already bitten this
codebase once — `.op-grid` on the homepage has an inline
`style="grid-template-columns: repeat(N, 1fr)"` and someone had already
patched around it with `.op-grid { ... !important }` in the mobile media
query. That override is why the officers grid wasn't part of this bug; the
contact form rows just hadn't gotten the same treatment yet.

Two more instances of the general "a fixed minimum wider than a phone" issue
turned up once the obvious one was fixed and the page was re-measured, not
visible in the original screenshot but real:

- `.preview-grid { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)) }`
  on the homepage's upcoming-events cards — 340px minimum is wider than a
  360px phone once side padding is subtracted.
- `.footer-links` had no `flex-wrap`, and `footer`'s `3rem` (48px) side
  padding was never reduced on mobile (only `flex-direction: column` was
  applied) — so five nav labels in an unwrapped row at 360px overflowed by
  about 21px.

### Fix

In `layouts/index.html` and `layouts/_default/join.html`:

- Added `min-width: 0` to `.form-field` and to the `input`/`textarea` rule.
  This is the actual fix — it's the standard override for "grid/flex item
  won't shrink below its content." Everything else here is secondary.
- Replaced the inline `style="grid-template-columns: 1fr 1.5fr 1.5fr"` with a
  `.form-row-bike` class carrying the same rule, so the mobile media query
  can win the cascade normally instead of losing to an inline style.
- `.preview-grid` gets `grid-template-columns: 1fr` at `max-width: 768px` —
  chose a single column over shrinking the 340px minimum, since a squeezed
  312px event card reads worse than a full-width one.

In `layouts/_default/baseof.html`:

- `.footer-links` gets `flex-wrap: wrap` and `justify-content: center`.
- The mobile `footer` rule gets `padding: 2rem 1.5rem` instead of inheriting
  the unconditional `3rem`.

### Verification

Same headless-Chromium measurement script, before and after, at 360/390/414px
on both `/` and `/join/`:

| | Before | After |
| --- | --- | --- |
| `docScrollWidth` at 360px | 704 | 360 |
| `docScrollWidth` at 390px | 704 | 390 |
| `docScrollWidth` at 414px | 704 | 414 |
| Elements wider than viewport | 30–45 per page | 0, aside from one decorative element (below) |

The one remaining flag from the measurement script is `.hero-accent`, a
`position:absolute; pointer-events:none` decorative radial-gradient circle on
the homepage hero that's intentionally positioned partly off-screen
(`right: -5%`). It doesn't move `docScrollWidth` at any width — confirmed
its containing block clips it — so it's a false positive from the
measurement heuristic (which flags anything with `rect.right > viewport`),
not a real bug. Left unchanged.

## How this was verified, for anyone re-checking later

No visual inspection tool was available for phones directly, so the
verification here is a headless-Chromium script (`playwright`, installed for
this session), not eyeballing. It builds the site with `hugo`, loads each
page at 360/390/414px, and reports:

1. `document.documentElement.scrollWidth` vs. the viewport width (the
   authoritative "does this page horizontally scroll" signal — a mismatch
   means content is being clipped or would scroll if `overflow-x: hidden`
   weren't hiding it).
2. Every element whose bounding box extends past the viewport, sorted by
   how far it overflows, to localize which rule is responsible.

The script and screenshots used aren't committed to the repo (they lived in
a scratch directory for this session) — if this needs re-verifying later,
the same approach (`playwright` + `hugo --destination <dir>` + a script
walking `document.querySelectorAll('body *')` for `getBoundingClientRect()`)
is the fastest way to get a real answer instead of guessing from reading CSS.
