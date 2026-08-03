// Temporary diagnostic route: confirms whether the unofficial GroupMe
// Calendar Events API (community-documented, not officially supported)
// actually works with our token before anything is built on top of it.
// Delete this file once verified.
export async function onRequestGet(context) {
  const { env } = context;

  if (!env.GROUPME_USER_TOKEN) {
    return json({ error: 'GROUPME_USER_TOKEN not configured' }, 500);
  }

  const groupId = '64017028';
  const endAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
  const url =
    `https://api.groupme.com/v3/conversations/${groupId}/events/list` +
    `?end_at=${encodeURIComponent(endAt)}&limit=50&token=${env.GROUPME_USER_TOKEN}`;

  const res = await fetch(url);
  const bodyText = await res.text();

  return json({ requestedUrl: url.replace(env.GROUPME_USER_TOKEN, '***'), status: res.status, body: safeParse(bodyText) }, 200);
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function json(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
