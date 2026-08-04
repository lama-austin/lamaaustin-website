// Polls GroupMe's (unofficial) Calendar Events API and reconciles
// content/events/ to match: creates new events, updates changed ones,
// and removes ones that were deleted or un-RSVP'd from GroupMe.
// Triggered on a schedule by .github/workflows/sync-groupme-calendar.yml,
// since GroupMe has no push notification for calendar changes.
import { githubListDir, githubPutFile, githubDeleteFile, yamlString } from '../_lib/github.js';

const GROUP_ID = '64017028';
const EVENTS_DIR = 'content/events';
const FILE_RE = /^groupme-([a-z0-9-]+)\.md$/i;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.SYNC_SECRET || request.headers.get('Authorization') !== `Bearer ${env.SYNC_SECRET}`) {
    return json({ error: 'Forbidden' }, 403);
  }
  if (!env.GITHUB_TOKEN || !env.GROUPME_USER_TOKEN || !env.GITHUB_BRANCH) {
    return json({ error: 'server not configured (missing GITHUB_TOKEN, GROUPME_USER_TOKEN, or GITHUB_BRANCH)' }, 500);
  }

  const [activeEvents, existingFiles] = await Promise.all([
    fetchActiveEvents(env),
    listSyncedFiles(env),
  ]);

  const results = { created: [], updated: [], deleted: [], errors: [] };
  const seenIds = new Set();

  for (const event of activeEvents) {
    seenIds.add(event.event_id);
    const path = `${EVENTS_DIR}/groupme-${event.event_id}.md`;
    const existing = existingFiles.get(event.event_id);
    const content = eventToMarkdown(event);
    try {
      await githubPutFile(env, path, content, `Sync event from GroupMe: ${event.name}`, existing?.sha, env.GITHUB_BRANCH);
      results[existing ? 'updated' : 'created'].push(event.name);
    } catch (err) {
      results.errors.push(`${event.name}: ${err.message}`);
    }
  }

  for (const [id, file] of existingFiles) {
    if (seenIds.has(id)) continue;
    try {
      await githubDeleteFile(env, file.path, file.sha, `Remove event no longer on GroupMe calendar (${id})`, env.GITHUB_BRANCH);
      results.deleted.push(id);
    } catch (err) {
      results.errors.push(`delete ${id}: ${err.message}`);
    }
  }

  return json(results, 200);
}

async function fetchActiveEvents(env) {
  const endAt = new Date().toISOString();
  const url =
    `https://api.groupme.com/v3/conversations/${GROUP_ID}/events/list` +
    `?end_at=${encodeURIComponent(endAt)}&limit=100&token=${env.GROUPME_USER_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GroupMe list events returned ${res.status}`);
  const body = await res.json();
  return (body.response?.events || []).filter((e) => !e.deleted_at);
}

async function listSyncedFiles(env) {
  const entries = await githubListDir(env, EVENTS_DIR, env.GITHUB_BRANCH);
  const map = new Map();
  for (const entry of entries) {
    const match = entry.name.match(FILE_RE);
    if (match) map.set(match[1], { path: entry.path, sha: entry.sha });
  }
  return map;
}

function eventToMarkdown(event) {
  const start = event.start_at.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}/);
  const [, datePart, hourStr, minute] = start;
  const hour = parseInt(hourStr, 10);
  const displayTime = `${((hour + 11) % 12) + 1}:${minute} ${hour < 12 ? 'AM' : 'PM'}`;

  const endDatePart = event.end_at?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const isMultiDay = endDatePart && endDatePart !== datePart;

  const location = event.location?.name || event.location?.address || '';
  const type = guessType(event.name, event.description);

  let description = (event.description || '').trim() || `${event.name}.`;
  if (isMultiDay) description = `${datePart} through ${endDatePart}.\n\n${description}`;

  const frontMatter = [
    '---',
    `title: ${yamlString(event.name)}`,
    `date: ${datePart}T${hourStr}:${minute}:00`,
    `time: ${yamlString(displayTime)}`,
    `location: ${yamlString(location)}`,
    `type: ${type}`,
    `groupme_event_id: ${event.event_id}`,
    'draft: false',
    '---',
    description,
    '',
  ];
  return frontMatter.join('\n');
}

function guessType(name, description) {
  const text = `${name} ${description || ''}`.toLowerCase();
  if (/\bmeeting\b/.test(text)) return 'social';
  if (/\b(anniversary|rally)\b/.test(text)) return 'state';
  return 'ride';
}

function json(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
