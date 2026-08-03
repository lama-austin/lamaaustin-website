// GroupMe bot callback: turns a `/event Title | YYYY-MM-DD H:MM AM/PM | Location | type?`
// chat message into a commit to content/events/, which triggers the normal
// Cloudflare Pages auto-deploy (same mechanism the CMS itself uses).
const GITHUB_OWNER = 'lama-austin';
const GITHUB_REPO = 'lamaaustin-website';
const GITHUB_BRANCH = 'main';
const COMMAND_RE = /^\/event\s+(.*)$/is;
const VALID_TYPES = new Set(['ride', 'social', 'state']);

export async function onRequestPost(context) {
  const { request, env } = context;

  if (env.GROUPME_WEBHOOK_SECRET) {
    const key = new URL(request.url).searchParams.get('key');
    if (key !== env.GROUPME_WEBHOOK_SECRET) return new Response('Forbidden', { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('OK', { status: 200 });
  }

  // GroupMe echoes the bot's own posts back through the same callback.
  if (!body || body.sender_type === 'bot' || typeof body.text !== 'string') {
    return new Response('OK', { status: 200 });
  }

  const match = body.text.match(COMMAND_RE);
  if (!match) return new Response('OK', { status: 200 });

  const parsed = parseEventCommand(match[1]);
  if (!parsed.ok) {
    await replyToGroup(env, parsed.error);
    return new Response('OK', { status: 200 });
  }

  try {
    await commitEvent(env, parsed.event, body);
    await replyToGroup(
      env,
      `✅ Added "${parsed.event.title}" — ${parsed.event.displayDate} — to the site. It'll be live in a few minutes.`
    );
  } catch (err) {
    await replyToGroup(env, `⚠️ Couldn't add that event: ${err.message}`);
  }

  return new Response('OK', { status: 200 });
}

function parseEventCommand(rest) {
  const parts = rest.split('|').map((s) => s.trim());
  if (parts.length < 3) {
    return {
      ok: false,
      error: 'Couldn\'t parse that. Format: /event Title | YYYY-MM-DD H:MM AM/PM | Location | type (optional: ride/social/state)',
    };
  }

  const [title, dateTime, location, typeRaw] = parts;
  if (!title) return { ok: false, error: 'Event needs a title. Format: /event Title | YYYY-MM-DD H:MM AM/PM | Location' };

  const dtMatch = dateTime.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!dtMatch) {
    return {
      ok: false,
      error: `Couldn't parse the date/time "${dateTime}". Use YYYY-MM-DD H:MM AM/PM, e.g. 2026-09-12 10:00 AM`,
    };
  }
  const [, datePart, hourStr, minuteStr, ampm] = dtMatch;
  let hour = parseInt(hourStr, 10) % 12;
  if (ampm.toUpperCase() === 'PM') hour += 12;
  const isoDate = `${datePart}T${String(hour).padStart(2, '0')}:${minuteStr}:00`;
  const displayTime = `${hourStr}:${minuteStr} ${ampm.toUpperCase()}`;

  if (!location) return { ok: false, error: 'Event needs a location. Format: /event Title | YYYY-MM-DD H:MM AM/PM | Location' };

  const type = VALID_TYPES.has((typeRaw || '').toLowerCase()) ? typeRaw.toLowerCase() : 'ride';

  return {
    ok: true,
    event: {
      title,
      isoDate,
      datePart,
      displayTime,
      displayDate: `${datePart} ${displayTime}`,
      location,
      type,
    },
  };
}

async function commitEvent(env, event, groupmeMessage) {
  if (!env.GITHUB_TOKEN) throw new Error('server not configured (missing GITHUB_TOKEN)');

  const slug = slugify(event.title);
  const shortId = String(groupmeMessage.id || Date.now()).slice(-6);
  const filename = `${event.datePart}-${slug}-${shortId}.md`;
  const path = `content/events/${filename}`;

  const frontMatter = [
    '---',
    `title: ${yamlString(event.title)}`,
    `date: ${event.isoDate}`,
    `time: ${yamlString(event.displayTime)}`,
    `location: ${yamlString(event.location)}`,
    `type: ${event.type}`,
    'draft: false',
    '---',
    `Added via GroupMe by ${groupmeMessage.name || 'a member'}.`,
    '',
  ].join('\n');

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'lama-austin-groupme-bot',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Add event via GroupMe: ${event.title}`,
        content: base64Encode(frontMatter),
        branch: GITHUB_BRANCH,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API returned ${res.status}`);
  }
}

async function replyToGroup(env, text) {
  if (!env.GROUPME_BOT_ID) return;
  await fetch('https://api.groupme.com/v3/bots/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_id: env.GROUPME_BOT_ID, text }),
  }).catch(() => {});
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function yamlString(str) {
  return `"${str.replace(/"/g, '\\"')}"`;
}

function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
