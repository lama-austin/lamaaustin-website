# LAMA Austin Website — Hugo + Decap CMS

## Setup Instructions

### 1. Replace your current files
Delete everything in `C:\lamaaustin-website` EXCEPT the `.git` folder, then copy everything from this folder into it.

### 2. Update Cloudflare Pages build settings
1. Go to dash.cloudflare.com → Compute → your lamaaustin-website project
2. Go to Settings → Build & deployments
3. Set:
   - Build command: `hugo --minify`
   - Build output directory: `public`
4. Add environment variable:
   - Variable name: `HUGO_VERSION`
   - Value: `0.140.0`
5. Save and trigger a new deployment

### 3. Set up GitHub OAuth for the admin panel
1. Go to github.com → Settings → Developer Settings → OAuth Apps → New OAuth App
2. Fill in:
   - Application name: LAMA Austin CMS
   - Homepage URL: https://lamaaustin.com
   - Authorization callback URL: https://api.netlify.com/auth/done
3. Copy the Client ID and generate a Client Secret
4. Go to Netlify (netlify.com) → create a free account
5. Go to Site configuration → Access & security → OAuth
6. Add GitHub as a provider using your Client ID and Secret

### 4. Push to GitHub
```bash
cd C:\lamaaustin-website
git add .
git commit -m "Migrate to Hugo"
git push
```

### 5. Access your admin panel
Go to lamaaustin.com/admin and log in with GitHub!

---

## Daily Use

### Add a new event
lamaaustin.com/admin → Events & Rides → New Event → fill in form → Publish

### Add gallery photos
lamaaustin.com/admin → Gallery Albums → New Album → upload photos → Publish

### Add/update officers
lamaaustin.com/admin → Chapter Officers → New Officer → fill in name, role, photo → Publish

### Update site settings
lamaaustin.com/admin → Site Settings → General Settings → edit → Save

---

## Manual updates (git)
```bash
git add .
git commit -m "describe your change"
git push
```
Cloudflare auto-deploys in ~30 seconds.
