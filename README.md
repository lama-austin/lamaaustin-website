# LAMA Austin website

The official website of the L.A.M.A. Austin chapter: **https://lamaaustin.com**

This guide is for whoever looks after the site. You don't need to know how
to code for anything in the first section.

## Everyday editing (no code needed)

Go to **https://lamaaustin.com/admin/** and sign in with GitHub. Your GitHub
account needs access to the `lama-austin/lamaaustin-website` repository.

After you click **Save/Publish**, the live site updates on its own within a
few minutes. If you don't see your change, wait a little and refresh.

| To change… | Go to |
| --- | --- |
| Homepage, About, Join or Members page text | **Pages** |
| Officers (org chart on the Members page) | **Leadership** |
| Members (Full Patch, Probate, Prospect, Associate, Dama de LAMA, Spouse, Youth) | **Chapter Members** |
| Photo albums | **Gallery Albums** |
| Events that aren't in GroupMe | **Events & Rides** |
| Facebook/Instagram links, founded year, member count, **WhatsApp number for the Join form** | **Site Settings** |

### Events and GroupMe

Events on the **GroupMe calendar show up on the website automatically**
(checked every 3 hours). Their files start with `groupme-`.

- To change or cancel a GroupMe event, **change it in GroupMe**. Edits made
  to a `groupme-` event in the admin panel get overwritten at the next sync.
- To add an event that isn't on GroupMe, add it in **Events & Rides**.
- Events disappear from the site automatically after they happen.
- To sync right away instead of waiting: on GitHub, open the repository →
  **Actions** → **Sync GroupMe calendar** → **Run workflow**.

### Social media on member cards

Officers and members can have **Instagram**, **Facebook** and **TikTok**
filled in; each shows as a small icon under their name on the Members page.
A full link or just the handle (`@name`) both work. Only add someone's
accounts with their OK. Icons are never shown for the **Youth** section,
even if filled in.

### Officers

Pick each officer's **Position** from the list. The President goes on top of
the chart, the Vice President below, and everyone else on the bottom row
(ordered by **Display Order**). To hand a position to someone new, edit that
officer's entry (name and photo) or add a new one and delete the old one.

## How it works (for whoever fixes things)

- **Hugo** builds the site from `content/` (text), `layouts/` (page designs,
  CSS is inline in each template), `data/settings.json` (site settings) and
  `static/` (images and other files served as-is).
- **Cloudflare Pages** rebuilds and hosts the site on every push to `main`.
- **Admin panel**: Sveltia CMS, configured in `static/admin/config.yml`,
  saves straight to `main` on GitHub. Login goes through the Cloudflare
  Worker `lama-oauth` at `oauth.lamaaustin.com` (source in
  `workers/oauth/worker.js`; deployed by pasting it into the Cloudflare
  dashboard, not automatically). Editors need a GitHub account with write
  access to the repository.
- **GroupMe sync**: `.github/workflows/sync-groupme-calendar.yml` calls
  `functions/api/groupme-calendar-sync.js` every 3 hours, which writes
  `content/events/groupme-*.md` through the GitHub API.
- **Translation**: the Google Translate button in the nav (English ↔ Spanish).
- **`functions/_middleware.js`** serves a Markdown copy of pages to AI tools
  that ask for one (see `static/llms.txt`).

More detail and past troubleshooting notes are in [`docs/`](docs/).
Outstanding work, including moving accounts to chapter ownership, is in
[`docs/todo.md`](docs/todo.md).

## Accounts

Filling in this list is part of [`docs/todo.md`](docs/todo.md) item 1.

| What | Where | Owned by |
| --- | --- | --- |
| Code and content | GitHub `lama-austin/lamaaustin-website` | |
| Hosting and DNS | Cloudflare (Pages project `lamaaustin-website`) | |
| Domain lamaaustin.com | Registrar: ? | |
| Admin login service | Cloudflare Worker `lama-oauth` at `oauth.lamaaustin.com` | |
| GitHub OAuth app used by the login | GitHub → Settings → Developer settings → OAuth Apps (on the account that created it); its ID/secret are `lama-oauth` variables `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | |
| GroupMe sync token | Cloudflare Pages variable `GROUPME_USER_TOKEN` | |
| GitHub token for the sync | Cloudflare Pages variable `GITHUB_TOKEN` | |
| Sync shared secret | GitHub Actions secret + Cloudflare variable `SYNC_SECRET` | |
